/**
 * Normalised reading of a review task's value.
 *
 * The API's `subLabel` vocabulary grew per check and is inconsistent to read down
 * a list: "No Hits", "None Found", "No Liens" and "No results" all mean the same
 * thing; "Submitted Active" and "Domestic Active" say which registration they
 * mean only if you already know the key; "High frequency" is a band whose
 * thresholds are invisible.
 *
 * This normalises the reading WITHOUT tidying the source. The raw value stays
 * verbatim in the evidence panel under "What ran" — plans/01-catalog.md requires
 * the source vocabulary to survive, and it does, one level down.
 *
 * Two rules held here:
 *   - No judgement enters. "High frequency" becomes "Shared with 101+ businesses",
 *     a checkable fact, not "busy address" or "high risk".
 *   - Nothing is invented. Where a band maps to documented thresholds (doc 02:
 *     1-20 / 21-100 / 101+) those are stated; where they are not documented the
 *     phrasing stays at the level the source supports.
 */
const VALUES: Record<string, Record<string, string>> = {
  name: {
    Verified: 'Matches a registration on file',
    'Similar Match': 'Close match to a registration on file'
  },
  address_verification: { Verified: 'Matches a registration on file' },
  person_verification: {
    Verified: 'Matches an officer on a registration',
    Unverified: 'No officer record to match against'
  },
  address_deliverability: { Deliverable: 'Deliverable' },
  address_property_type: { Commercial: 'Commercial', Residential: 'Residential' },
  address_registered_agent: { 'Registered Agent': "A registered agent's address" },
  location_frequency: {
    'Low frequency': 'Shared with 1–20 businesses',
    'Moderate frequency': 'Shared with 21–100 businesses',
    'High frequency': 'Shared with 101+ businesses'
  },
  sos_active: { Active: 'Active in at least one state' },
  sos_inactive: {
    Inactive: 'Inactive in every state searched',
    'Partially Inactive': 'Inactive in some states, active in others'
  },
  sos_domestic: {
    'Domestic Active': 'Active in the formation state',
    'Domestic Inactive': 'Inactive in the formation state'
  },
  sos_match: {
    'Submitted Active': 'Active in the submitted address state',
    'Submitted Inactive': 'Inactive in the submitted address state',
    'Submitted Not Registered': 'Not registered in the submitted address state'
  },
  sos_not_found: { 'Not Registered': 'No registration found in any state searched' },
  sos_domestic_sub_status: { 'Good Standing': 'In good standing' },
  watchlist: { 'No Hits': 'Screened — no hits', Hits: 'Screened — hits returned' },
  adverse_media: {
    'No results': 'Screened — no hits',
    'Low risk': 'Screened — hits returned, scored low by the provider'
  },
  bankruptcies: { 'None Found': 'Searched — no filings found' },
  litigations: { 'None Found': 'Searched — no cases found' },
  liens: { 'No Liens': 'Searched — no liens found', 'Liens Found': 'Searched — liens found' },
  business_connections: {
    Found: 'Related businesses found',
    'Not Found': 'Searched — no related businesses found'
  },
  website_status: { Online: 'Reachable' },
  profile_status: { Online: 'Reachable' },
  website_url_discovery: { Submitted: 'Supplied by the customer' },
  profile_discovery: { Submitted: 'Supplied by the customer' },
  website_url_domain_ownership: { 'High Confidence': 'Registrant corroborates the business — high confidence' },
  web_business_name_verification: {
    Verified: 'Matches the name on the website',
    Mismatch: 'Does not match the name on the website',
    'Similar Match': 'Close match to the name on the website'
  },
  web_address_verification: {
    Verified: 'Matches the address on the website',
    Mismatch: 'Does not match the address on the website'
  },
  web_person_verification: {
    Verified: 'Appears on the website',
    Mismatch: 'Does not appear on the website'
  },
  tin: { Found: 'Matches a name associated with the business' }
}

/** Falls back to the source value unchanged — never invents a reading. */
export const normaliseValue = (key: string, subLabel: string): string =>
  VALUES[key]?.[subLabel] ?? subLabel
