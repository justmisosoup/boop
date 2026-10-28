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
  const summary = composer ? composer(insights, record, group) : generic(insights)
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

type Composer = (insights: PanelInsight[], record: BusinessRecord, group: PanelGroup) => string | undefined

/** "a, b and c". */
const listed = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)
const byKey = (insights: PanelInsight[], key: string) => insights.find((i) => keyOf(i) === key)
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

/** How many were found, then how many are open and closed. */
const claims =
  (kind: 'liens' | 'litigation' | 'bankruptcy', one: string, many: string): Composer =>
  (_insights, record) => {
    const c = claimCounts(record, kind)
    const total = c.standing + c.cleared
    if (total === 0) return `No ${many} found.`
    const found = plural(total, one, many)
    if (!c.cleared) return `${found} found, ${total === 1 ? 'open' : 'all open'}.`
    if (!c.standing) return `${found} found, ${total === 1 ? 'closed' : 'all closed'}.`
    return `${found} found: ${c.standing} open, ${c.cleared} closed.`
  }

/** Why a hit was dismissed, in a few words, by the kind of reason
 *  `dismissalOf` gives: another name, a weak match, or excluded. */
const dismissedFor = (reason: string) =>
  /excluded/i.test(reason) ? 'excluded on the platform' : /% name match/i.test(reason) ? 'weak name matches' : "names that don't match"

/** How many hits, how many stand, and why the rest were dismissed. */
const screen =
  (which: 'watchlist' | 'pep' | 'media', noun: string): Composer =>
  (_insights, record) => {
    const hits = screenedOf(record)[which].hits as Array<Parameters<typeof dismissalOf>[1]>
    if (hits.length === 0) return `No ${noun} hits found.`
    const reasons = hits.map((h) => dismissalOf(which, h)).filter((r): r is string => Boolean(r))
    const standing = hits.length - reasons.length
    const found = `${plural(hits.length, `${noun} hit`, `${noun} hits`)} found`
    const why = [...new Set(reasons.map(dismissedFor))]
    const dismissed = reasons.length
      ? `${reasons.length === hits.length ? (hits.length === 1 ? 'dismissed' : 'all dismissed') : `${reasons.length} dismissed`} for ${listed(why)}`
      : ''
    if (!standing) return `${found}, ${dismissed}.`
    if (!reasons.length) return `${found}, ${hits.length === 1 ? 'and it stands' : 'and all stand'}.`
    return `${found}: ${plural(standing, 'hit stands', 'hits stand')}, ${dismissed}.`
  }

/** What was found online, then what matches the business and what doesn't. */
const web: Composer = (insights, record) => {
  const site = (record.website as { url?: string | null; status?: string | null } | null)?.url
  const status = (record.website as { status?: string | null } | null)?.status
  const profiles = (record.profiles ?? []).length
  const found = [
    site ? `a website${status ? ` (${status.toLowerCase()})` : ''}` : undefined,
    profiles ? plural(profiles, 'third-party profile', 'third-party profiles') : undefined
  ].filter((x): x is string => Boolean(x))
  const FIELD: Record<string, string> = {
    web_business_name_verification: 'the business name',
    web_address_verification: 'the office address',
    web_phone_number_verification: 'the phone number',
    web_email_address_verification: 'the email address',
    web_person_verification: 'the people'
  }
  const matched = insights.filter((i) => FIELD[keyOf(i)] && i.intent === 'success').map((i) => FIELD[keyOf(i)])
  const off = insights.filter((i) => FIELD[keyOf(i)] && against(i)).map((i) => lower(i.statement.replace(/[.]$/, '')))
  return [
    found.length ? `Web presence found: ${listed(found)}.` : 'No web presence found.',
    matched.length ? `Matches ${listed(matched)}${off.length ? `; however, ${listed(off)}` : ''}.` : off.length ? `${sentence(off.map((o) => o.charAt(0).toUpperCase() + o.slice(1)).join('; '))}` : undefined
  ]
    .filter(Boolean)
    .join(' ')
}

/** The office: whether it is verified, deliverable, and what kind of place. */
const addresses: Composer = (insights, record) => {
  const office = record.addresses.find((a) => a.submitted)
  if (!office) return undefined
  const verified = byKey(insights, 'address_verification')
  const parts = [
    verified ? (verified.intent === 'success' ? 'verified' : 'not verified') : undefined,
    office.deliverable === true ? 'deliverable' : office.deliverable === false ? 'undeliverable' : undefined,
    office.propertyType ? `a ${office.propertyType.toLowerCase()} property` : undefined
  ].filter((x): x is string => Boolean(x))
  const flags = [office.isRegisteredAgent ? "a registered agent's address" : undefined, office.cmra ? 'a mail-receiving agency' : undefined].filter(
    (x): x is string => Boolean(x)
  )
  return [
    parts.length ? `The office address is ${listed(parts)}.` : undefined,
    flags.length ? `It is ${listed(flags)}.` : undefined
  ]
    .filter(Boolean)
    .join(' ')
}

/** The submitted name against the registered one, then the others found. */
const names: Composer = (insights, _record, group) => {
  const match = byKey(insights, 'name') ?? byKey(insights, 'submitted_name')
  const others = group.insights.find((i) => i.id === 'name:others')?.verdict
  const dba = byKey(insights, 'submitted_name_dba')
  return [
    match ? (match.intent === 'success' ? 'The submitted name matches the registered name.' : sentence(match.statement)) : undefined,
    others ? `${others.replace(/ found$/, '')} found${dba ? `, among them ${lower(dba.verdict.replace(/^Listed as /, ''))}` : ''}.` : undefined
  ]
    .filter(Boolean)
    .join(' ')
}

/** The submitted people against the filings. */
const people: Composer = (insights, record) => {
  const submitted = record.people.filter((p) => p.submitted).length
  const v = byKey(insights, 'person_verification')
  if (!submitted || !v) return undefined
  return v.intent === 'success'
    ? `${plural(submitted, 'submitted person', 'submitted people')} verified against the filings.`
    : `${plural(submitted, 'submitted person', 'submitted people')} not found on the filings.`
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
  'screening-watchlist': screen('watchlist', 'watchlist'),
  'screening-pep': screen('pep', 'PEP'),
  'screening-media': screen('media', 'adverse media'),
  website: web,
  address: addresses,
  name: names,
  people
}
