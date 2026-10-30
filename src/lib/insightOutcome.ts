import { nameStandingOf } from './businessNames'
import { convertedFormationOf, notPublished } from './registrationStatus'
import { stateName } from './states'
import type { BusinessRecord, Derived } from './deriveResults'
import { dismissalOf, screenedOf } from './screening'

/**
 * Whether an insight passed, needs review, or failed — as a reviewer reads it.
 *
 * This stands in for the policy, which is not built yet: positive, negative
 * or neutral is the policy's call, read against the assessment's context
 * (assessmentContext.ts). Until then, this table emulates it.
 *
 * Not the score's polarity: that is a weighting, and it reads an inactive
 * filing as nothing and a filing it has no entry for as a point FOR the
 * business. This is the review task's own result word, mapped once, every
 * word the records carry listed: a clean result passes, something a reviewer
 * has to look at needs review, something against the business fails, and a
 * fact about the registry or a discovery step is context.
 */
export type Outcome = 'pass' | 'review' | 'fail' | 'neutral'

const P = 'pass'
const R = 'review'
const F = 'fail'
const N = 'neutral'

/** `key` → sub-label (lower case) → outcome. */
const TABLE: Record<string, Record<string, Outcome>> = {
  address_cmra: { cmra: R },
  address_deliverability: { deliverable: P, undeliverable: F },
  address_property_type: { commercial: P, residential: R },
  // An office at a registered agent's address is common and says nothing on its own.
  address_registered_agent: { 'registered agent': N },
  address_verification: { verified: P, 'similar match': R, 'approximate match': R, 'incomplete match': R, unverified: F },
  bankruptcies: { 'none found': P, found: F },
  business_connections: { found: N, 'not found': N },
  entity_type: { verified: P, unverified: R },
  industry: { 'no hits': P, hits: R },
  liens: { 'no liens': P, 'liens found': R, 'open liens found': R, 'high risk liens found': F },
  litigations: { 'none found': P, found: R },
  name: { verified: P, 'similar match': R, unverified: F },
  person_verification: { verified: P, unverified: F },
  profile_discovery: { found: P, submitted: P, 'not found': N },
  profile_status: { online: P, offline: R },
  risky_keywords: { none: P, 'needs review': R },
  sos_active: { active: P },
  sos_domestic: { 'domestic active': P, 'domestic inactive': F, 'domestic missing': F, 'domestic unknown': R },
  sos_domestic_sub_status: { 'good standing': P, dissolved: F, 'not in good standing': F, 'pending inactive': R, 'pending active': R, 'not provided by state': N },
  sos_inactive: { inactive: F, 'partially inactive': R },
  sos_match: { 'submitted active': P, 'submitted inactive': F, 'submitted not registered': F, 'submitted unknown': R },
  sos_not_found: { 'not registered': R },
  sos_unknown: { 'partially unknown': N },
  tin: { found: P, 'not found': F },
  tin_issued: { issued: P, 'not issued': R },
  web_address_verification: { verified: P, 'approximate match': R, mismatch: R, unverified: N },
  // A site that names the business otherwise — a trade name, a brand — is
  // context for the reader, not a flag.
  web_business_name_verification: { verified: P, 'similar match': P, mismatch: N, unverified: N },
  web_email_address_verification: { verified: P, mismatch: R, unverified: N },
  web_person_verification: { verified: P, mismatch: R, unverified: N },
  web_phone_number_verification: { verified: P, mismatch: R, unverified: N },
  website_status: { online: P, offline: R, parked: R },
  website_url_discovery: { found: P, submitted: P, 'not found': N },
  website_url_domain_ownership: { 'high confidence': P }
}

/** Insights the prototype derives, with no review task word of their own. */
const DERIVED: Record<string, (r: Derived, record: BusinessRecord) => Outcome> = {
  // The submitted name as another business's DBA, and that owner's filing:
  // context about how the name is held, not a finding against the business —
  // a DBA is a common, legitimate arrangement, and nothing in it is
  // conclusive. Only a found owner filing reads as a pass.
  submitted_name_dba: () => N,
  dba_owner_filing: (r) => (r.state === 'result' ? P : N),
  // The suffix against the type: a match passes; a mismatch is context — a
  // name's "Inc." or "LLC" drifts from the filing often, and says nothing
  // conclusive on its own.
  name_entity_type: (r) => (r.state === 'result' && r.value === 'match' ? P : N),
  submitted_name: (_r, record) => {
    const { assessment } = nameStandingOf(record)
    return assessment === 'CLEAR' ? P : assessment === 'NOTE' || assessment === 'REVIEW' ? R : F
  },
  trade_names: () => N,
  linked_domestic: () => N,
  former_formation: () => N
}

const keyOf = (insightId: string) => insightId.split(':')[0]

/** The domestic checks read through a conversion: what they come to, and how
 *  to say it, where the only inactive domestic filing is the one converted out. */
const conversionReading = (key: string, record: BusinessRecord): { outcome: Outcome; statement: string } | undefined => {
  if (key !== 'sos_domestic' && key !== 'sos_inactive') return undefined
  const c = convertedFormationOf(record)
  if (!c) return undefined
  const from = stateName(c.formed.state)
  const to = stateName(c.now.state)
  const silent = notPublished(c.now) || !c.now.status || /unknown/i.test(c.now.status)
  const active = /^active$/i.test(c.now.status ?? '')
  if (key === 'sos_domestic' && (active || silent))
    return {
      outcome: active ? P : N,
      statement: active
        ? `Converted from ${from}; the ${to} domestic filing is active`
        : `Converted from ${from}; ${to} publishes no status for its domestic filing`
    }
  if (key === 'sos_inactive') {
    const lapsed = record.registrations.filter((x) => !/^active$/i.test(x.status ?? '') && !notPublished(x) && !/unknown/i.test(x.status ?? ''))
    if (lapsed.every((x) => x === c.formed))
      return { outcome: N, statement: `The only inactive filing is the ${from} filing it converted out of` }
  }
  return undefined
}

/** The API's sentences that read as the system talking, in an analyst's words. */
const PLAIN: Record<string, string> = {
  'Identified people we believe are different from the submitted People': "The people found online don't match the submitted people",
  'The domestic sub-status is Not Provided by State.': 'The state gives no sub-status for the domestic filing'
}

/** The insight's sentence, restated where the record reads it differently than the check did. */
export const statementOf = (r: Derived, record: BusinessRecord) =>
  conversionReading(keyOf(r.insightId), record)?.statement ?? screenReading(r, record) ?? PLAIN[r.statement] ?? r.statement

/** A screen whose every match was dismissed passes (`outcomeOf`); its sentence
 *  says so, rather than the API's "2 Watchlists hit(s) have been identified". */
function screenReading(r: Derived, record: BusinessRecord): string | undefined {
  const key = keyOf(r.insightId)
  const screen = key === 'watchlist' ? 'watchlist' : key === 'politically_exposed_persons' ? 'pep' : key === 'adverse_media' ? 'media' : undefined
  if (!screen) return undefined
  const hits = screenedOf(record)[screen].hits as Array<Parameters<typeof dismissalOf>[1]>
  if (hits.length === 0 || hits.some((h) => !dismissalOf(screen, h))) return undefined
  const what = screen === 'watchlist' ? 'watchlist hit' : screen === 'pep' ? 'PEP hit' : 'adverse media hit'
  return hits.length === 1
    ? `We found 1 ${what}, which was dismissed as not a match.`
    : `We found ${hits.length} ${what}s, ${hits.length === 2 ? 'both' : 'all'} dismissed as not a match.`
}

/** A variant's rule: what one result of one insight counts as (`StatusOverride`). */
export type OutcomeRule = { insight: string; outcome: string; status: string }

const RULE_OUTCOME: Record<string, Outcome> = { success: 'pass', warning: 'review', failure: 'fail', neutral: 'neutral' }
/** "Not Provided by State" and `not_provided_by_state` are one result. */
const sameResult = (a: string, b: string) => a.toLowerCase().replace(/[^a-z0-9]/g, '') === b.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * How an insight reads. With `rules` — an assessment variant's — a rule for
 * the result this record came back with decides it, ahead of everything else:
 * the variant reads the same data, by its own rules. Without, the defaults.
 */
export const outcomeOf = (r: Derived, record: BusinessRecord, rules?: readonly OutcomeRule[]): Outcome => {
  const key = keyOf(r.insightId)
  if (rules?.length) {
    const result = record.reviewTasks.find((t) => t.key === key)?.subLabel
    const rule = result ? rules.find((x) => x.insight === key && sameResult(x.outcome, result)) : undefined
    if (rule && RULE_OUTCOME[rule.status]) return RULE_OUTCOME[rule.status]
  }
  // A registry that publishes nothing is a fact about the registry (Delaware,
  // New Jersey): never a finding.
  if (r.reason === 'not_published' || r.reason === 'not_required') return N

  /* The screens, by what still stands once the results that name someone
     else are dismissed (`screeningOf`): a hit the record does not tie to the
     business is not one. */
  if (key === 'watchlist' || key === 'politically_exposed_persons' || key === 'adverse_media') {
    const s = screenedOf(record)
    const screen = key === 'watchlist' ? 'watchlist' : key === 'politically_exposed_persons' ? 'pep' : 'media'
    const hits = s[screen].hits as Array<Parameters<typeof dismissalOf>[1]>
    const standing = hits.filter((h) => !dismissalOf(screen, h)).length
    if (standing === 0) return P
    return key === 'watchlist' ? F : R
  }

  // A formation filing that converted out (Andytown: California → Delaware)
  // is the business moving, not lapsing. Its current domestic filing decides
  // the domestic check — and one that publishes no status (Delaware) is not
  // inactive; the converted filing is not an inactive filing to flag.
  const moved = conversionReading(key, record)
  if (moved) return moved.outcome

  if (DERIVED[key]) return DERIVED[key](r, record)
  const word = (record.reviewTasks.find((t) => t.key === key)?.subLabel ?? '').toLowerCase()
  const mapped = TABLE[key]?.[word]
  if (mapped) return mapped
  if (r.reason === 'should_exist_not_found') return R
  return r.state === 'result' ? P : N
}
