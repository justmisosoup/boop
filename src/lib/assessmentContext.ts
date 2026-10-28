import type { BusinessRecord } from './deriveResults'
import { notPublished } from './registrationStatus'
import { domesticOf } from './registrationStatus'
import { stateName } from './states'

/**
 * The context an assessment is read in: what it needs before it can say
 * anything, and why each of its insights matters for this business.
 *
 * Context is the back-end concept that drives an assessment — which insights
 * matter, for what reason, and what information is required to derive a
 * result. The assessment itself (its card, its insights) does not change
 * with it. Whether an insight reads for or against the business is the
 * policy's call, which is not built yet; `outcomeOf` (insightOutcome.ts)
 * emulates it.
 */
export type Requirement = {
  /** Whether the record holds the input. */
  present: (record: BusinessRecord) => boolean
  /** What the assessment needs, said as the assessment's summary when it is missing. */
  need: string
}

export type AssessmentContext = {
  /** The inputs the assessment cannot give a result without. */
  requires?: Requirement[]
}

const submittedTin = (r: BusinessRecord) => Boolean((r.tin as { tin?: string } | null)?.tin)
const submittedOffice = (r: BusinessRecord) => r.addresses.some((a) => a.submitted)
const submittedPeople = (r: BusinessRecord) => r.people.some((p) => p.submitted)
const anyWebsite = (r: BusinessRecord) => Boolean((r.website as { url?: string | null } | null)?.url)

/** By report card: the assessment's requirements. */
export const ASSESSMENT_CONTEXT: Record<string, AssessmentContext> = {
  tin: {
    requires: [
      {
        present: submittedTin,
        need: 'Needs a TIN to check against the IRS. Let Middesk find it, or submit it yourself.'
      }
    ]
  },
  address: { requires: [{ present: submittedOffice, need: 'Needs a submitted office address to verify.' }] },
  people: { requires: [{ present: submittedPeople, need: 'Needs a submitted person to verify against the filings.' }] },
  website: { requires: [{ present: anyWebsite, need: 'Needs a submitted or found website to review.' }] }
}

/** What an assessment still needs, in its own words; none, it can be read. */
export const missingInputs = (cardId: string, record: BusinessRecord): string[] =>
  (ASSESSMENT_CONTEXT[cardId]?.requires ?? []).filter((q) => !q.present(record)).map((q) => q.need)

/** The domestic state, by name, where the record has one. */
const domesticState = (r: BusinessRecord) => {
  const d = domesticOf(r)
  return d ? stateName(d.state) : undefined
}

/**
 * Why an insight matters for this business, by its key — shown on hover.
 * Generic where the reason holds for any business; read from the record
 * where the business changes it (the state, whether it publishes a status).
 */
const WHY: Record<string, (r: BusinessRecord) => string | undefined> = {
  sos_match: () => 'The submitted filing is where the business says it is registered; its status is the first thing to confirm.',
  sos_domestic: (r) =>
    `The domestic filing${domesticState(r) ? ` in ${domesticState(r)}` : ''} is where the business was formed: if it is inactive, the business may no longer exist as an entity.`,
  sos_domestic_sub_status: (r) => {
    const d = domesticOf(r)
    if (d && notPublished(d)) return `${stateName(d.state)} publishes no sub-status for its filings, so there is none to read.`
    return 'The sub-status says why a filing stands as it does — in good standing, dissolved, or pending.'
  },
  sos_active: () => 'An active filing shows the business is current with at least one state.',
  sos_inactive: () => 'Inactive filings outside the domestic state are often withdrawn registrations; many at once can mean the business has wound down.',
  sos_not_found: () => 'A business that operates in a state is usually registered there.',
  sos_unknown: () => 'Some states publish no status for their filings; it is a fact about the registry, not the business.',
  entity_type: () => 'The entity type decides which filings and owners to expect.',
  name: () => 'The submitted name should match the name the business is registered under.',
  submitted_name: () => 'The submitted name should match the name the business is registered under.',
  submitted_name_dba: () => 'A name held as another business’s DBA may belong to a parent or a different entity.',
  name_entity_type: () => 'A name’s suffix (LLC, Inc.) should agree with the registered entity type.',
  dba_owner_filing: () => 'A DBA is owned by a registered business; its filing confirms who that is.',
  trade_names: () => 'Other names the business trades under, for reading the rest of the record.',
  address_verification: () => 'The submitted office should be an address the business is known at.',
  address_deliverability: () => 'Mail must reach the office for notices to be served.',
  address_property_type: () => 'A residential office is common for a small business; for a larger one it is worth a look.',
  address_registered_agent: () => 'An office at a registered agent’s address is common, and says nothing on its own.',
  address_cmra: () => 'A mail-receiving agency address can hide where a business actually operates.',
  tin: () => 'The IRS match ties the name to the tax ID the business submitted.',
  tin_issued: () => 'Whether the IRS has issued the TIN at all.',
  person_verification: () => 'The submitted people should be named on the business’s filings.',
  watchlist: () => 'A true sanctions match stops onboarding; matches on someone else are dismissed.',
  politically_exposed_persons: () => 'A politically exposed person behind the business raises the bar for due diligence.',
  adverse_media: () => 'Reporting on the business or its people can surface fraud or litigation the filings don’t.',
  liens: () => 'Open liens are debts secured against the business’s assets.',
  litigations: () => 'Lawsuits against the business can signal disputes or unpaid obligations.',
  bankruptcies: () => 'A bankruptcy filing changes who controls the business’s assets.',
  website_status: () => 'A live site is evidence the business operates.',
  website_url_discovery: () => 'A website, submitted or found, is evidence the business operates where it says.',
  website_url_domain_ownership: () => 'Whether the business owns the domain it presents as its own.',
  web_business_name_verification: () => 'The site naming the business ties it to the record.',
  web_address_verification: () => 'The site’s address should agree with the submitted office.',
  web_person_verification: () => 'People named on the site should agree with the submitted people.',
  web_phone_number_verification: () => 'The site’s phone should agree with what was submitted.',
  web_email_address_verification: () => 'The site’s email should agree with what was submitted.',
  profile_discovery: () => 'Third-party profiles are independent evidence the business operates.',
  profile_status: () => 'Whether those profiles are still online.',
  industry: () => 'The industry decides which licences and restrictions apply.',
  business_connections: () => 'Businesses sharing owners or addresses can reveal a parent, a network or a prior account.'
}

/** Why an insight matters here; none where the context has nothing to add. */
export const whyOf = (insightId: string, record: BusinessRecord): string | undefined =>
  WHY[insightId.split(':')[0]]?.(record)
