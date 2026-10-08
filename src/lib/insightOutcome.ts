import { nameStandingOf } from './businessNames'
import type { BusinessRecord, Derived } from './deriveResults'
import { dismissalOf, screenedOf } from './screening'

/**
 * Whether an insight passed, needs review, or failed — as a reviewer reads it.
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
  web_business_name_verification: { verified: P, 'similar match': P, mismatch: R, unverified: N },
  web_email_address_verification: { verified: P, mismatch: R, unverified: N },
  web_person_verification: { verified: P, mismatch: R, unverified: N },
  web_phone_number_verification: { verified: P, mismatch: R, unverified: N },
  website_status: { online: P, offline: R, parked: R },
  website_url_discovery: { found: P, submitted: P, 'not found': N },
  website_url_domain_ownership: { 'high confidence': P }
}

/** Insights the prototype derives, with no review task word of their own. */
const DERIVED: Record<string, (r: Derived, record: BusinessRecord) => Outcome> = {
  // The submitted name as another business's DBA, the owner's filing, the
  // suffix against the type: each a question for the reviewer, not a failure.
  submitted_name_dba: (r) => (r.state === 'result' ? R : N),
  dba_owner_filing: (r) => (r.state === 'result' ? P : R),
  name_entity_type: (r) => (r.state === 'result' ? R : N),
  submitted_name: (_r, record) => {
    const { assessment } = nameStandingOf(record)
    return assessment === 'CLEAR' ? P : assessment === 'NOTE' || assessment === 'REVIEW' ? R : F
  },
  trade_names: () => N,
  linked_domestic: () => N,
  former_formation: () => N
}

const keyOf = (insightId: string) => insightId.split(':')[0]

export const outcomeOf = (r: Derived, record: BusinessRecord): Outcome => {
  const key = keyOf(r.insightId)
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

  if (DERIVED[key]) return DERIVED[key](r, record)
  const word = (record.reviewTasks.find((t) => t.key === key)?.subLabel ?? '').toLowerCase()
  const mapped = TABLE[key]?.[word]
  if (mapped) return mapped
  if (r.reason === 'should_exist_not_found') return R
  return r.state === 'result' ? P : N
}
