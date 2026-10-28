import { claimCounts } from '../components/Report/ClaimTables'
import type { PanelGroup, PanelInsight } from '../components/Report/AssessmentPanel'
import { missingInputs } from './assessmentContext'
import type { BusinessRecord } from './deriveResults'
import { entityTypeShown } from './normalise'
import { dismissalOf, screenedOf } from './screening'

/**
 * An assessment's summary: what its insights found, said once, above them.
 *
 * Composed only from what the assessment's own insights and the record
 * state — never the report's prose — so it cannot say something the rows
 * under it don't. Where the assessment cannot be read yet, it is what it
 * needs (`missingInputs`). Where it would only repeat a lone insight, none.
 */
export const assessmentSummary = (group: PanelGroup, record: BusinessRecord): string | undefined => {
  const needs = missingInputs(group.cardId, record)
  if (needs.length) return needs.join(' ')
  const insights = group.insights.filter((i) => !i.synthetic)
  if (insights.length === 0) return undefined
  // A card's own composer adds what its rows don't (the counts); the generic
  // one only gathers the rows, so a lone insight needs none.
  const composer = COMPOSERS[group.cardId]
  const summary = composer ? composer(insights, record) : generic(insights)
  return insights.length === 1 && summary === sentence(insights[0].statement) ? undefined : summary
}

const keyOf = (i: PanelInsight) => i.id.split(':')[0]
const against = (i: PanelInsight) => i.intent === 'failure' || i.intent === 'warning'
const sentence = (s: string) => (/[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`)
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** The findings against the business, the worst first. With none, nothing:
 *  passes and context are the rows' to show, and saying the first again is noise. */
const generic = (insights: PanelInsight[]) => {
  const found = insights.filter(against)
  return found.length ? found.map((i) => sentence(i.statement)).join(' ') : undefined
}

type Composer = (insights: PanelInsight[], record: BusinessRecord) => string | undefined

/** Open and closed, in the card's own words. */
const claims =
  (kind: 'liens' | 'litigation' | 'bankruptcy', one: string, many: string): Composer =>
  (_insights, record) => {
    const c = claimCounts(record, kind)
    if (c.standing + c.cleared === 0) return `No ${many} found.`
    if (!c.cleared) return `${plural(c.standing, `open ${one}`, `open ${many}`)}.`
    if (!c.standing) return `No open ${many}; ${c.cleared} closed.`
    return `${plural(c.standing, `open ${one}`, `open ${many}`)}, ${c.cleared} closed.`
  }

/** What stands once the matches on someone else are dismissed. */
const screen =
  (which: 'watchlist' | 'pep' | 'media'): Composer =>
  (_insights, record) => {
    const hits = screenedOf(record)[which].hits as Array<Parameters<typeof dismissalOf>[1]>
    if (hits.length === 0) return 'No hits.'
    const dismissed = hits.filter((h) => dismissalOf(which, h)).length
    const standing = hits.length - dismissed
    if (!standing) return `${plural(hits.length, 'hit', 'hits')}, ${hits.length === 1 ? '' : 'all '}dismissed as not a match.`
    return dismissed
      ? `${plural(standing, 'hit stands', 'hits stand')}; ${dismissed} dismissed as not a match.`
      : `${plural(standing, 'hit stands', 'hits stand')}.`
  }

const COMPOSERS: Record<string, Composer> = {
  /**
   * The lead finding, then what offsets it — the filings still active, and as
   * what — then the registry's own context: "The business is inactive in the
   * state of the submitted office address, but 1 of 28 filings is active, as a
   * corporation. The state gives no sub-status for the domestic filing."
   */
  formation: (insights, record) => {
    const [lead] = insights
    const total = record.registrations.length
    const active = record.registrations.filter((r) => /^active$/i.test(r.status ?? '')).length
    const type = record.formation?.entityType ? entityTypeShown(record, record.formation.entityType) : undefined
    const as = type ? `, as ${/^[aeiou]/i.test(type) ? 'an' : 'a'} ${type.toLowerCase()}` : ''
    const filings = total
      ? `${active} of ${total} ${total === 1 ? 'filing' : 'filings'} ${active === 1 ? 'is' : 'are'} active${as}`
      : undefined
    const first =
      against(lead) && filings && active > 0
        ? `${lead.statement.replace(/[.]$/, '')}, but ${filings}.`
        : [sentence(lead.statement), filings && sentence(filings[0].toUpperCase() + filings.slice(1))].filter(Boolean).join(' ')
    // The sub-status, where it is a fact about the registry or a finding; a pass is the row's.
    const sub = insights.find((i) => keyOf(i) === 'sos_domestic_sub_status' && i !== lead && i.intent !== 'success')
    const others = insights.filter((i) => i !== lead && against(i) && !/^sos_(inactive|active|domestic)$/.test(keyOf(i)))
    return [first, sub && sentence(sub.statement), ...others.map((i) => sentence(i.statement))].filter(Boolean).join(' ')
  },
  liens: claims('liens', 'lien', 'liens'),
  litigation: claims('litigation', 'case', 'cases'),
  bankruptcy: claims('bankruptcy', 'bankruptcy', 'bankruptcies'),
  'screening-watchlist': screen('watchlist'),
  'screening-pep': screen('pep'),
  'screening-media': screen('media')
}
