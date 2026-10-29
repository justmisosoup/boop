import { claimCounts } from '../components/Report/ClaimTables'
import type { PanelGroup, PanelInsight } from '../components/Report/AssessmentPanel'
import { missingInputs } from './assessmentContext'
import type { BusinessRecord } from './deriveResults'
import { entityTypeShown } from './normalise'
import { dismissalOf, screenedOf } from './screening'
import { confidentRelatedOf, relatedBusinessesOf } from './relatedBusinesses'

/**
 * An assessment's summary: what its insights found, said once, above them.
 *
 * Composed only from what the assessment's own insights and the record
 * state — never the report's prose — so it cannot say something the rows
 * under it don't. Where the assessment cannot be read yet, it is what it
 * needs (`missingInputs`). Where it would only repeat a lone insight, none.
 */
/** No em dashes in a summary: an insight's own sentence that carries one reads
 *  with a comma instead. */
const noDashes = (s: string | undefined) =>
  s
    ?.replace(/\s*—\s*/g, ', ')
    // The API capitalises its fields mid-sentence: "Inactive in the state of the submitted Office Address".
    .replace(/(?<=[a-z,] )(Office Address|Business Name|Email Address|Phone Number|People|Inactive|Active)\b/g, (w) => w.toLowerCase())

export const assessmentSummary = (group: PanelGroup, record: BusinessRecord): string | undefined =>
  noDashes(summaryOf(group, record))

const summaryOf = (group: PanelGroup, record: BusinessRecord): string | undefined => {
  const needs = missingInputs(group.cardId, record)
  if (needs.length) return needs.join(' ')
  const insights = group.insights.filter((i) => !i.synthetic)
  if (insights.length === 0) return undefined
  // A card's own composer adds what its rows don't (the counts); the generic
  // one only gathers the rows, so a lone insight needs none.
  const composer = COMPOSERS[group.cardId]
  const summary = composer ? composer(insights, record, group) : generic(insights)
  // Screening and bankruptcy with nothing standing: the insight says it.
  if (QUIET_WHEN_CLEAR.has(group.cardId) && !insights.some(against)) return undefined
  // Nothing found says itself: the assessment's own row reads "No liens", so
  // a summary that only repeats it is left out.
  if (summary && /^(No [^.]* found|We found no [^.]*)\.$/.test(summary)) return undefined
  return insights.length === 1 && summary === sentence(insights[0].statement) ? undefined : summary
}

/** Assessments whose insight is the whole story when nothing stands. */
const QUIET_WHEN_CLEAR = new Set(['bankruptcy', 'screening-watchlist', 'screening-pep', 'screening-media'])

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

/** "a and b", "a, b, and c": the examples' own serial comma. */
const listed = (xs: string[], and = 'and') =>
  xs.length <= 1 ? (xs[0] ?? '') : xs.length === 2 ? `${xs[0]} ${and} ${xs[1]}` : `${xs.slice(0, -1).join(', ')}, ${and} ${xs.at(-1)}`
const byKey = (insights: PanelInsight[], key: string) => insights.find((i) => keyOf(i) === key)
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

/** How many were found, then how many are open and closed. */
const claims =
  (kind: 'liens' | 'litigation' | 'bankruptcy', one: string, many: string): Composer =>
  (_insights, record) => {
    const c = claimCounts(record, kind)
    const total = c.standing + c.cleared
    if (total === 0) return `We found no ${many}.`
    const found = `We found ${plural(total, one, many)}`
    if (!c.cleared) return `${found}, ${total === 1 ? 'which is open' : total === 2 ? 'both open' : 'all open'}.`
    if (!c.standing) return `${found}, ${total === 1 ? 'which is closed' : total === 2 ? 'both closed' : 'all closed'}.`
    return `${found}, of which ${c.standing} ${c.standing === 1 ? 'is' : 'are'} open and ${c.cleared} ${c.cleared === 1 ? 'is' : 'are'} closed.`
  }

/** Closed, in any of the words a filing office or court uses — as the card's own filter reads it. */
const CLOSED = /closed|terminated|lapsed|released|dismissed|satisfied|discharged/i

/** "We found 14 liens, of which 2 are open. They are all UCC liens." */
const lienSummary: Composer = (_insights, record) => {
  const liens = record.liens ?? []
  if (liens.length === 0) return 'We found no liens.'
  const open = liens.filter((l) => !CLOSED.test(l.status ?? '')).length
  const first = `We found ${plural(liens.length, 'lien', 'liens')}, ${
    liens.length === 1 ? (open ? 'which is open' : 'which is closed') : open ? `of which ${open} ${open === 1 ? 'is' : 'are'} open` : 'none of them open'
  }.`
  // The kinds, most common first: "UCC", "state tax", "federal tax".
  const counts = new Map<string, number>()
  for (const l of liens) {
    const k = (l.type ?? 'other').toLowerCase()
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const KIND: Record<string, string> = { ucc: 'UCC', state: 'state tax', federal: 'federal tax' }
  const types = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => KIND[k] ?? k)
  const mix =
    liens.length === 1
      ? ` It is ${/^[aeiou]/i.test(types[0]) && types[0] !== 'UCC' ? 'an' : 'a'} ${types[0]} lien.`
      : types.length === 1
        ? ` They are all ${types[0]} liens.`
        : ` They are a mix of ${listed(types)} liens.`
  // The debt they secure, where a filing states it: the open liens' total.
  const owed = liens
    .filter((l) => !CLOSED.test(l.status ?? ''))
    .reduce((n, l) => n + ((l as { liabilityCents?: number | null }).liabilityCents ?? 0), 0)
  const debt = owed ? ` The open liens state ${money(owed)} in debt.` : ''
  return `${first}${mix}${debt}`
}

/** "$1,893" from cents. */
const money = (cents: number) => `$${Math.round(cents / 100).toLocaleString('en-US')}`

/** A judgment's amount: its own field, else the "Total Amount: $1,893.48" its text states. */
const judgmentCents = (j: { text?: string | null; amountCents?: number | null }) => {
  if (j.amountCents) return j.amountCents
  const m = (j.text ?? '').match(/(?:total\s+)?amount:\s*\$([\d,]+(?:\.\d+)?)/i)
  return m ? Math.round(parseFloat(m[1].replace(/,/g, '')) * 100) : 0
}

/** The cases by kind, how many of each are open, and which side the business is mostly on. */
const caseKind = (t: string | null | undefined) =>
  !t || /^unknown$/i.test(t) ? 'of an unstated type' : t.replace(/\s*-\s*other$/i, '').toLowerCase()
/**
 * "We found 10 cases, of which 8 are open and 1 closed with a judgement. They
 * are a mix of labor and employment, commercial and trade, and unstated case
 * types. The business is the defendant in 5 of these cases."
 */
const litigationSummary: Composer = (_insights, record) => {
  const cases = record.litigations ?? []
  if (cases.length === 0) return 'We found no cases.'
  type Judged = { judgments?: Array<{ text?: string | null; amountCents?: number | null }> }
  const isOpen = (c: (typeof cases)[number]) => !CLOSED.test(c.caseStatus ?? '')
  const judgmentsOf = (c: (typeof cases)[number]) => (c as Judged).judgments ?? []
  const settledCase = (c: (typeof cases)[number]) => judgmentsOf(c).some((j) => /settle/i.test(j.text ?? ''))
  const judgedCase = (c: (typeof cases)[number]) => judgmentsOf(c).length > 0 && !settledCase(c)
  const open = cases.filter(isOpen).length
  const closedJudged = cases.filter((c) => !isOpen(c) && judgedCase(c)).length
  const openJudged = cases.filter((c) => isOpen(c) && judgedCase(c)).length
  const settled = cases.filter(settledCase).length

  // How many, and where they stand.
  const standing = [
    open ? `${open} ${open === 1 ? 'is' : 'are'} open` : 'none are open',
    closedJudged ? `${closedJudged} closed with a judgement` : undefined,
    settled ? `${settled} ${settled === 1 ? 'was' : 'were'} settled` : undefined
  ].filter((x): x is string => Boolean(x))
  const first = `We found ${plural(cases.length, 'case', 'cases')}, of which ${listed(standing)}.`

  // The case types, most common first; "judgment" is an outcome, not a type.
  const counts = new Map<string, number>()
  for (const c of cases) {
    const k = caseKind(c.caseType)
    if (k !== 'judgment') counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  // Unstated last, whatever its count: it is the absence of a type.
  const UNSTATED = 'of an unstated type'
  const types = [...counts.entries()]
    .sort((a, b) => Number(a[0] === UNSTATED) - Number(b[0] === UNSTATED) || b[1] - a[1])
    .map(([k]) => (k === UNSTATED ? 'unstated' : k))
  const mix =
    types.length > 1
      ? ` They are a mix of ${listed(types)} case types.`
      : types.length === 1
        ? ` They are all ${types[0]} cases.`
        : ''

  // The side it is on, where one role leads.
  const roles = new Map<string, number>()
  for (const c of cases) {
    const r = c.partyType && !/^unknown$/i.test(c.partyType) ? c.partyType.toLowerCase() : undefined
    if (r) roles.set(r, (roles.get(r) ?? 0) + 1)
  }
  const ranked = [...roles.entries()].sort((a, b) => b[1] - a[1])
  const [lead, leadN] = ranked[0] ?? []
  const side =
    lead && leadN && (ranked.length === 1 || leadN > ranked[1][1])
      ? leadN === cases.length
        ? ` The business is the ${lead} in every case.`
        : ` The business is the ${lead} in ${leadN} of these cases.`
      : ''

  // An open case already judged, and the sums the judgements state.
  const awarded = cases.flatMap(judgmentsOf).reduce((n, j) => n + judgmentCents(j), 0)
  const after = [
    openJudged ? ` ${openJudged === 1 ? '1 open case has' : `${openJudged} open cases have`} a judgement.` : '',
    awarded ? ` The judgements state ${money(awarded)} in all.` : ''
  ].join('')
  return `${first}${mix}${side}${after}`
}

/** What industry it is: the classification it most likely is, by NAICS, and
 *  the merchant category beside it where that adds something. */
const industrySummary: Composer = (_insights, record) => {
  const all = (record as { industry?: Array<{ system: string; name: string; naicsCodes?: string[]; mccCodes?: string[]; score?: number }> }).industry ?? []
  const best = (system: string) => all.filter((i) => i.system === system).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]
  const naics = best('NAICS')
  const mcc = best('MCC')
  if (!naics && !mcc) return undefined
  const main = naics ?? mcc!
  // The classifications' own names, as their systems write them; the codes
  // are the Industry card's, not the summary's.
  const also = naics && mcc && mcc.name !== naics.name ? ` Its merchant category is ${mcc.name}.` : ''
  return `We classified the business as ${main.name}.${also}`
}

/**
 * What the connections add up to, by the Related businesses card's own cuts:
 * likely related (a confident match sharing people), possibly related
 * (sharing people or more than an address), and neighbours (one shared
 * commercial address, no one in common) — and what that suggests.
 */
const relatedSummary: Composer = (_insights, record) => {
  const all = record.connections ?? []
  if (all.length === 0) return undefined
  const likely = confidentRelatedOf(record)
  const related = relatedBusinessesOf(record)
  const possibly = related.filter((c) => !likely.includes(c))
  const neighbours = all.filter((c) => !related.includes(c) && !likely.includes(c))
  const are = (n: number) => (n === 1 ? 'is' : 'are')
  const lines: string[] = [`We found ${plural(all.length, 'connected business', 'connected businesses')}.`]
  if (likely.length)
    lines.push(
      likely.length === 1
        ? '1 is likely related, sharing its people with high confidence.'
        : `${likely.length} are likely part of the same ownership structure, sharing its people with high confidence.`
    )
  if (possibly.length) lines.push(`${possibly.length} ${are(possibly.length)} possibly related, sharing a person or addresses.`)
  if (neighbours.length)
    lines.push(
      neighbours.length === 1
        ? '1 shares only an address, so it is a neighbour, not an owner.'
        : `${neighbours.length} share only an address, so they are neighbours, not owners.`
    )
  if (!likely.length && !possibly.length) lines.push('We found no owning parties.')
  return lines.join(' ')
}

/** Why a hit was dismissed, in a few words, by the kind of reason
 *  `dismissalOf` gives: another name, a weak match, or excluded. */
const dismissedFor = (reason: string) =>
  /excluded/i.test(reason) ? 'they were excluded on the platform' : /% name match/i.test(reason) ? 'they were weak name matches' : "the names don't match"

/** How many hits, how many stand, and why the rest were dismissed. */
const screen =
  (which: 'watchlist' | 'pep' | 'media', noun: string): Composer =>
  (_insights, record) => {
    const hits = screenedOf(record)[which].hits as Array<Parameters<typeof dismissalOf>[1]>
    if (hits.length === 0) return `We found no ${noun} hits.`
    const reasons = hits.map((h) => dismissalOf(which, h)).filter((r): r is string => Boolean(r))
    const standing = hits.length - reasons.length
    const found = `We found ${plural(hits.length, `${noun} hit`, `${noun} hits`)}`
    const because = `because ${listed([...new Set(reasons.map(dismissedFor))], 'or')}`
    if (!standing)
      return `${found}, ${hits.length === 1 ? 'which was dismissed' : hits.length === 2 ? 'both dismissed' : 'all dismissed'} ${because}.`
    if (!reasons.length) return `${found}, ${hits.length === 1 ? 'which stands' : hits.length === 2 ? 'and both stand' : 'and all stand'}.`
    return `${found}, of which ${standing} ${standing === 1 ? 'stands' : 'stand'} and ${reasons.length} ${reasons.length === 1 ? 'was' : 'were'} dismissed ${because}.`
  }

/** What was found online, then what matches the business and what doesn't. */
const web: Composer = (insights, record) => {
  const site = (record.website as { url?: string | null; status?: string | null } | null)?.url
  const status = (record.website as { status?: string | null } | null)?.status
  const profiles = (record.profiles ?? []).length
  const withProfiles = profiles ? ` with ${plural(profiles, 'third-party profile', 'third-party profiles')}` : ''
  // "Found an online web presence with 5 third-party profiles."
  const first = site
    ? `Found ${status ? `an ${status.toLowerCase()}` : 'a'} web presence${withProfiles}.`
    : profiles
      ? `Found ${plural(profiles, 'third-party profile', 'third-party profiles')} but no website.`
      : 'No web presence found.'
  const FIELD: Record<string, string> = {
    web_business_name_verification: 'the business name',
    web_address_verification: 'the office address',
    web_phone_number_verification: 'the phone number',
    web_email_address_verification: 'the email address',
    web_person_verification: 'the people'
  }
  // What didn't match, in plain words: the people, against what was submitted.
  const OFF: Record<string, string> = { web_person_verification: "the people found online don't match what was submitted" }
  const matched = insights.filter((i) => FIELD[keyOf(i)] && i.intent === 'success').map((i) => FIELD[keyOf(i)])
  const off = insights.filter((i) => FIELD[keyOf(i)] && against(i)).map((i) => OFF[keyOf(i)] ?? lower(i.statement.replace(/[.]$/, '')))
  return [
    first,
    matched.length
      ? `Found matches to ${listed(matched)}${off.length ? `; however, ${listed(off)}` : ''}.`
      : off.length
        ? sentence(off.map((o) => o.charAt(0).toUpperCase() + o.slice(1)).join('; '))
        : undefined
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
    flags.length ? `It is also ${listed(flags)}.` : undefined
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
    others ? `We found ${others.replace(/ found$/, '')}${dba ? `, among them ${lower(dba.verdict.replace(/^Listed as /, ''))}` : ''}.` : undefined
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
    ? `We verified ${plural(submitted, 'submitted person', 'submitted people')} against the filings.`
    : `We couldn't find ${plural(submitted, 'submitted person', 'submitted people')} on the filings.`
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
      ? `${active} of its ${total} ${total === 1 ? 'filing' : 'filings'} ${active === 1 ? 'is' : 'are'} active${as}`
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
  liens: lienSummary,
  litigation: litigationSummary,
  bankruptcy: claims('bankruptcy', 'bankruptcy', 'bankruptcies'),
  'screening-watchlist': screen('watchlist', 'watchlist'),
  'screening-pep': screen('pep', 'PEP'),
  'screening-media': screen('media', 'adverse media'),
  website: web,
  industry: industrySummary,
  connections: relatedSummary,
  address: addresses,
  name: names,
  people
}
