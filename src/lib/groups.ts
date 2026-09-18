/**
 * Grouping, by subject.
 *
 * The catalog groups insights by what a fact is ABOUT: an address is an address
 * whether the check was verification, CMRA, deliverability or frequency, and
 * those are how it was found rather than what it is. The Insights tab reads the
 * same grouping from `catalog/insights.yaml` rather than restating one here.
 *
 * This replaces grouping by the review task's own `category`. That column mixed
 * two axes — `industry` and `location_frequency` are subjects, while `fraud`,
 * `creditworthiness`, `address_risk` and `operating_status` are what a fact
 * feeds. The second kind lives on `informs` in the catalog and never groups
 * anything here.
 *
 * Grouping is navigational only — it helps a reader find things and nothing
 * rests on it (00-MASTER-PLAN.md, standing rule 3).
 */
import catalog from '../data/catalog.json'

const SUBJECT_OF = (catalog as { subjectOf: Record<string, string> }).subjectOf

/** Display order and label. Identity first, then what it does, then screening. */
export const GROUPS = [
  { id: 'name', label: 'Names' },
  { id: 'formation', label: 'Formation' },
  { id: 'registration', label: 'Registrations' },
  // Separate from the US filings above. These answer the same questions about
  // countries rather than states, and read together they were one
  // undifferentiated list.
  { id: 'international_registration', label: 'Global registrations' },
  { id: 'tin', label: 'Tax ID' },
  { id: 'people', label: 'People' },
  { id: 'address', label: 'Addresses' },
  { id: 'connections', label: 'Connections' },
  { id: 'website', label: 'Website' },
  { id: 'profiles', label: 'Third-party profiles' },
  { id: 'phone', label: 'Phone' },
  { id: 'industry', label: 'Industry' },
  { id: 'licenses', label: 'Licenses' },
  { id: 'operating_as_claimed', label: 'Operating as claimed' },
  { id: 'screening', label: 'Screening' },
  { id: 'liens', label: 'Liens' },
  { id: 'litigation', label: 'Litigation' },
  { id: 'bankruptcy', label: 'Bankruptcy' },
  { id: 'ppp_loans', label: 'PPP loans' },
  { id: 'complaints', label: 'Complaints' },
  { id: 'kyc', label: 'KYC' },
  { id: 'other', label: 'Other' }
] as const

export type GroupId = (typeof GROUPS)[number]['id']

/** Short theme names for citation chips — a chip carries the theme, not the
 *  full insight statement, which is a sentence and cannot sit inside another. */
export const THEME: Record<GroupId, string> = {
  name: 'Names',
  formation: 'Formation',
  registration: 'Registrations',
  international_registration: 'Global registrations',
  tin: 'Tax ID',
  people: 'People',
  address: 'Addresses',
  connections: 'Connections',
  website: 'Website',
  profiles: 'Profiles',
  phone: 'Phone',
  industry: 'Industry',
  licenses: 'Licenses',
  operating_as_claimed: 'Operating',
  screening: 'Screening',
  liens: 'Liens',
  litigation: 'Litigation',
  bankruptcy: 'Bankruptcy',
  ppp_loans: 'PPP loans',
  complaints: 'Complaints',
  kyc: 'KYC',
  other: 'Other'
}

const KNOWN = new Set<string>(GROUPS.map((g) => g.id))

/**
 * Checks the runtime emits that the sheet's Factual rows do not name.
 *
 * `industry` and `location_frequency` appear there only as signal categories,
 * never as checks, though the API returns both as review tasks. The other three
 * are absent entirely and are most likely on the Opinionated sheet — adverse
 * media carries a risk score, risky keywords a flag, domain ownership a
 * confidence. All five are real; the sheet just does not define them as facts.
 */
const UNDEFINED_SUBJECT: Record<string, GroupId> = {
  industry: 'industry',
  location_frequency: 'address',
  adverse_media: 'screening',
  risky_keywords: 'industry',
  website_url_domain_ownership: 'website'
}

/**
 * The subject comes from the catalog. Ids fan out (`location_frequency:high`),
 * so the lookup is on the base key.
 *
 * Kept as a factory taking the record's category map so the call sites do not
 * change, but the map is no longer consulted: the catalog decides.
 */
export const makeGroupFor = (_categoryByKey: Map<string, string>) => (insightId: string): GroupId => {
  // Signals are keyed `signal:<subject>:<n>` — the subject is already in the id.
  if (insightId.startsWith('signal:')) {
    const subject = insightId.split(':')[1]
    return KNOWN.has(subject) ? (subject as GroupId) : 'other'
  }

  const key = insightId.split(':')[0]
  const subject = SUBJECT_OF[key] ?? UNDEFINED_SUBJECT[key]
  return subject && KNOWN.has(subject) ? (subject as GroupId) : 'other'
}
