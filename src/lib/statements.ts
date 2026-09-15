/**
 * The insight statement — what was FOUND.
 *
 * An insight is a collection of attributes interpreted into a statement about a
 * business identity (concept/model.md). So the statement carries the finding:
 * it is not a neutral check name with the answer parked on a second line, and
 * it is not an assertion of a positive outcome that the value then contradicts.
 * Both of those were earlier versions of this file, and both read wrong.
 *
 * Nothing here judges. "Shared with 21–100 businesses" is a finding;
 * "high-risk address" would be an assessment.
 */
import { PROXIMITY_MILES, milesBetween, nameKey } from './attributes'
import type { BusinessRecord } from './deriveResults'

/** Documented bands, source doc 02. */
export const frequencyBand = (n: number) => (n <= 20 ? 'low' : n <= 100 ? 'moderate' : 'high')

/** The band in the terms an analyst can check, rather than the word "high". */
const BAND_RANGE: Record<string, string> = {
  low: '1–20',
  moderate: '21–100',
  high: '101 or more'
}

/**
 * Address frequency is one insight PER BAND, not one sentence listing them all.
 * Three addresses at 21, 2 and 2 produce two insights, each with its own
 * addresses underneath it.
 */
export const addressFrequencyInsights = (record: BusinessRecord) => {
  const counted = record.addresses.filter((a) => typeof a.locationCount === 'number')
  if (counted.length === 0) return []

  const byBand = new Map<string, typeof counted>()
  for (const a of counted) {
    const b = frequencyBand(a.locationCount as number)
    byBand.set(b, [...(byBand.get(b) ?? []), a])
  }

  return ['high', 'moderate', 'low']
    .filter((b) => byBand.has(b))
    .map((band) => {
      const addresses = byBand.get(band) as typeof counted
      const n = addresses.length
      return {
        band,
        statement: `${n} ${n === 1 ? 'address' : 'addresses'} shared with ${BAND_RANGE[band]} businesses`,
        addresses
      }
    })
}

/**
 * House style, applied to every statement:
 *
 *   1. Subject first, no leading "The" — "Address is deliverable", not "The
 *      submitted address is deliverable". Down a list of thirty, the articles are
 *      noise.
 *   2. Present tense, no trailing full stop.
 *   3. A finding, never a judgement — "Address shared with 21–100 businesses",
 *      never "high-risk address".
 *   4. Matches read "<what> match for <subject>" / "No <what> match for
 *      <subject>", so the positive and negative forms of one check are visibly
 *      the same check.
 */
/**
 * Distance from the submitted address, as an insight of its own.
 *
 * No review task carries it — the API gives coordinates and nothing that reads
 * them. Two addresses can look unrelated as strings and share a building, or
 * share a city and be two thousand miles apart.
 */
export const addressProximity = (record: BusinessRecord) => {
  const submitted = record.addresses.find((a) => a.submitted)
  if (!submitted || typeof submitted.latitude !== 'number') return null

  const others = record.addresses.filter((a) => a !== submitted)
  const measurable = others.filter((a) => milesBetween(a, submitted) !== undefined)
  if (measurable.length === 0) return null

  const far = measurable.filter((a) => (milesBetween(a, submitted) as number) > PROXIMITY_MILES)
  const n = far.length

  return {
    far: n,
    statement:
      n === 0
        ? `Every address found is within ${PROXIMITY_MILES} mi of the submitted address`
        : `${n} ${n === 1 ? 'address' : 'addresses'} found ${n === 1 ? 'is' : 'are'} over ${PROXIMITY_MILES} mi from the submitted address`
  }
}

/**
 * Whether every filing agrees on what the entity legally is.
 *
 * The provider checks the entity type against the DOMESTIC registration only.
 * Four more filings state one, and a foreign qualification disagreeing with the
 * formation record is a real finding that no review task reports.
 */
export const entityTypeAgreement = (record: BusinessRecord, scope: 'all' | 'foreign') => {
  const filings =
    scope === 'foreign'
      ? record.registrations.filter((r) => r.state !== record.formation?.state)
      : record.registrations
  const total = filings.length
  if (total === 0) return null

  const noun = scope === 'foreign' ? 'foreign registration' : 'registration'
  const plural = `${total} ${noun}${total === 1 ? '' : 's'}`

  const stated = filings.filter((r) => r.entityType)
  if (stated.length === 0)
    return { agreed: false, statement: `No ${noun} states an entity type` }

  const distinct = new Set(stated.map((r) => (r.entityType as string).toUpperCase()))
  if (distinct.size > 1)
    return {
      agreed: false,
      statement: `Entity type differs across the ${plural} — ${distinct.size} values stated`
    }

  return {
    agreed: true,
    statement:
      stated.length === total
        ? `Entity type classified against ${scope === 'all' ? 'all ' : ''}${plural}`
        : `Entity type classified against ${stated.length} of the ${plural}`
  }
}

/** Every statement is a sentence, including the ones built from a raw key. */
const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

const BY_VALUE: Record<string, Record<string, string>> = {
  // The subject is the name the customer gave us, and what it was matched
  // against is the registrations. "State registration match for business name"
  // named neither side plainly.
  name: {
    Verified: 'Submitted business name matches state registrations',
    'Similar Match': 'Submitted business name closely matches state registrations',
    Unverified: 'Submitted business name does not match any state registration'
  },
  address_verification: {
    Verified: 'State registration match for submitted address',
    'Similar Match': 'Close state registration match for submitted address',
    'Approximate Match': 'Approximate state registration match for submitted address',
    Unverified: 'No state registration match for submitted address'
  },
  // The deliverability check runs against the submitted address alone, so the
  // statement names it. "Address is deliverable" read as a claim about every
  // address on the record, ten of which were never posted to.
  address_deliverability: {
    Deliverable: 'Submitted address is deliverable',
    Undeliverable: 'Submitted address is undeliverable',
    Vacant: 'Submitted address is vacant'
  },
  address_property_type: {
    Commercial: 'Address is a commercial property',
    Residential: 'Address is a residential property'
  },
  address_registered_agent: {
    'Registered Agent': "Address belongs to a registered-agent firm"
  },
  address_cmra: {
    CMRA: 'Address is a commercial mail receiving agency'
  },
  sos_active: { Active: 'Active registration in at least one state' },
  sos_inactive: {
    Inactive: 'Inactive in every state searched',
    'Partially Inactive': 'Inactive in some states, active in others'
  },
  sos_domestic: {
    'Domestic Active': 'Registration active in the formation state',
    'Domestic Inactive': 'Registration inactive in the formation state'
  },
  sos_match: {
    'Submitted Active': 'Registration status active in the submitted address state',
    'Submitted Inactive': 'Registration status inactive in the submitted address state',
    // Not a status: there is no filing to have one.
    'Submitted Not Registered': 'No registration in the submitted address state'
  },
  sos_not_found: { 'Not Registered': 'No registration found in any state searched' },
  sos_domestic_sub_status: { 'Good Standing': 'Registration in good standing' },
  registrations_status: { Active: 'Active registration in at least one state' },
  registrations_not_found: { 'Not Registered': 'No registration found in any state searched' },
  submitted_registrations_match: {
    Found: 'Registration found in the submitted address state',
    'Not Found': 'No registration found in the submitted address state'
  },
  watchlist: {
    'No Hits': 'Watchlist screening returned no hits',
    Hits: 'Watchlist screening returned hits'
  },
  adverse_media: {
    'No results': 'Adverse media screening returned no hits',
    // "Low risk" is the provider's SCORE, not a finding. The record's own
    // message for it is "No adverse media was found" — reading the score as a
    // hit invented adverse media this business does not have.
    'Low risk': 'Adverse media screening returned no hits, scored low risk',
    'Medium risk': 'Adverse media screening returned hits, scored medium risk',
    'High risk': 'Adverse media screening returned hits, scored high risk'
  },
  politically_exposed_persons: {
    'No hits': 'PEP screening returned no hits',
    'Direct hits': 'PEP screening returned direct hits'
  },
  bankruptcies: { 'None Found': 'No bankruptcy filings found' },
  litigations: { 'None Found': 'No litigation records found', Found: 'Litigation records found' },
  liens: {
    'No Liens': 'No liens found',
    'Liens Found': 'Liens found',
    'Open Liens Found': 'Open liens found'
  },
  business_connections: {
    Found: 'Related businesses share officers, agents or addresses',
    'Not Found': 'No related businesses found'
  },
  website_status: { Online: 'Website is reachable', Offline: 'Website is not reachable' },
  profile_status: {
    Online: 'Third-party profile is reachable',
    Offline: 'Third-party profile is not reachable'
  },
  website_url_discovery: {
    Submitted: 'Website supplied by the customer',
    Found: 'Website located',
    'Not Found': 'No website located'
  },
  profile_discovery: {
    Submitted: 'Third-party profile supplied by the customer',
    Found: 'Third-party profile located',
    'Not Found': 'No third-party profile located'
  },
  website_url_domain_ownership: {
    'High Confidence': 'Domain registrant corroborates the business — high confidence',
    'Medium Confidence': 'Domain registrant corroborates the business — medium confidence',
    'Low Confidence': 'Domain registrant corroborates the business — low confidence'
  },
  web_business_name_verification: {
    Verified: 'Website match for business name',
    'Similar Match': 'Close website match for business name',
    Mismatch: 'No website match for business name'
  },
  web_address_verification: {
    Verified: 'Website match for submitted address',
    Mismatch: 'No website match for submitted address'
  },
  web_person_verification: {
    Verified: 'Website match for submitted person',
    Mismatch: 'No website match for submitted person',
    // Not the same as a mismatch: the site does not name them in a form the
    // check can read, so nothing was established either way.
    Unverified: 'Website match for submitted person could not be determined'
  },
  web_email_address_verification: {
    Verified: 'Website match for submitted email address',
    Mismatch: 'No website match for submitted email address'
  },
  web_phone_number_verification: {
    Verified: 'Website match for submitted phone number',
    Mismatch: 'No website match for submitted phone number'
  },
  // The entity type is a formation fact, and the domestic filing is the record
  // that constitutes it. "A registration" left open which of five, four of
  // which only qualify the entity to transact elsewhere.
  entity_type: {
    Verified: 'Entity type classified against domestic registration',
    Unverified: 'Entity type not classified against domestic registration'
  },
  formation_state: { Found: 'Formation state identified' },
  industry: { 'No Hits': 'No prohibited or high-risk industry identified' },
  risky_keywords: {
    None: 'No risky keywords found',
    'Needs Review': 'Risky keywords found'
  },
  tin: { Found: 'TIN match for a name associated with the business' }
}

/** Findings that need the record to state properly. */
export const statementFor = (
  key: string,
  subLabel: string,
  record: BusinessRecord
): string => {
  // Statements stay generic: the submitted values themselves live in the
  // evidence, not inlined into the sentence.
  //
  // One insight, singular or plural. With several DBAs submitted the statement
  // carries the counts; with one it reads in the singular.
  if (key === 'dba_name') {
    const submitted = (record.names ?? []).filter((n) => n.type === 'dba' && n.submitted)
    if (submitted.length === 0) return 'No DBA name submitted'

    // Per-name match signal: a submitted name that resolved to a filing carries
    // sources; one that did not comes back with an empty array. Only one record
    // in the sample has a DBA at all, so this reading is not yet confirmed
    // against a matched case — see decisions/009.
    const matched = submitted.filter((n) => (n.sources ?? []).length > 0).length

    if (submitted.length === 1)
      return matched === 1 || subLabel === 'Verified'
        ? 'DBA filing match found for submitted DBA name'
        : 'DBA filing match not found for submitted DBA name'

    // Reconcile the per-name signal against the task's own verdict. If they
    // disagree — the task says a match exists but no name carries a source —
    // the count is unreliable, so state the outcome without one rather than
    // print a number that contradicts the source. No matched example exists in
    // the account to confirm the signal against (decisions/009).
    const taskSaysMatch = subLabel === 'Verified'
    if (matched === 0)
      return taskSaysMatch
        ? `DBA filing matches found for submitted DBA names`
        : `DBA filing matches not found for ${submitted.length} submitted DBA names`
    if (matched === submitted.length)
      return `DBA filing matches found for all ${submitted.length} submitted DBA names`
    return `DBA filing matches found for ${matched} out of ${submitted.length} submitted DBA names`
  }

  // A count, not a verdict on one address. "Address is a commercial property"
  // named no address and the record holds ten — and whether the COMMERCIAL ones
  // are the addresses the customer gave us or ones we found elsewhere is the
  // part an analyst reads for.
  if (key === 'address_property_type') {
    const typed = record.addresses.filter((a) => a.propertyType)
    if (typed.length === 0) return 'No property type established for any address'

    const commercial = typed.filter((a) => /commercial/i.test(a.propertyType as string))
    const of = `${typed.length} ${typed.length === 1 ? 'address' : 'addresses'}`

    if (commercial.length === 0) return `No commercial properties among ${of}`
    if (commercial.length === typed.length)
      return typed.length === 1
        ? 'Address is a commercial property'
        : `All ${of} are commercial properties`
    return `${commercial.length} of ${of} are commercial properties`
  }

  if (key === 'person_verification') {
    const submitted = record.people.filter((p) => p.submitted)
    const officers = record.people.filter((p) => (p.sources ?? []).includes('registration'))
    if (submitted.length === 0) return 'No person submitted'
    if (officers.length === 0) return 'No officers published on state registrations to match against'
    if (subLabel === 'Verified') return 'Officer match for submitted person on state registrations'
    return 'No officer match for submitted person on state registrations'
  }

  // Industry classification is a real catalog insight (source doc 05): NAICS and
  // MCC codes plus a prohibited-industry label. The record carries the
  // categories, so the statement says what it was classified as rather than
  // reporting the screening outcome alone.
  if (key === 'industry') {
    const categories = record.industry ?? []
    const prohibited = categories.find((c) => c.system === 'Prohibited')
    const clean = !prohibited || /non-prohibited/i.test(prohibited.name ?? '')

    // The classification itself is evidence, not the finding — the NAICS and MCC
    // categories are in the evidence panel.
    if (categories.length === 0) return 'No industry classification on the record'
    return clean ? 'No prohibited industry identified' : 'Prohibited industry identified'
  }

  /**
   * The submitted name, against the filings that carry it — with the number.
   *
   * "Matches state registrations" is true of one filing and of five, and which
   * it is changes what the match is worth. Counted the same way the evidence is
   * built, so the sentence and the rows underneath cannot disagree.
   */
  if (key === 'name') {
    const submitted = (record.names ?? []).filter((n) => n.type !== 'dba' && n.submitted)
    const names = submitted.length > 0 ? submitted.map((n) => n.name) : [record.name]
    const matched = record.registrations.filter((r) =>
      names.some((name) => nameKey(r.name ?? '') === nameKey(name))
    ).length

    if (matched === 0) return 'Submitted business name does not match any state registration'
    const of = `${matched} state registration${matched === 1 ? '' : 's'}`
    return /similar|approximate/i.test(subLabel)
      ? `Submitted business name closely matches ${of}`
      : `Submitted business name matches ${of}`
  }

  /**
   * Registration status, as the count of states holding it.
   *
   * The three read against each other or not at all. "Inactive in some states,
   * active in others" and "Active registration in at least one state" describe
   * the same five filings in two vocabularies, neither carrying a number, so an
   * analyst had to open both and count — and "some" covers one state and four
   * equally well.
   */
  if (key === 'sos_active' || key === 'sos_inactive' || key === 'sos_unknown') {
    const status = key.slice('sos_'.length)
    const states = new Set(
      record.registrations
        .filter((r) => (r.status || 'unknown').toLowerCase() === status)
        .map((r) => r.state)
    )
    // Zero falls through to the catalog: the provider raised the check, and
    // "inactive in 0 states" is not what it is saying.
    // "Registration status", not "Registration": the registration is not
    // unknown — its standing is. The distinction matters most on the unknown
    // case, where the bare noun reads as though the filing itself is in doubt.
    if (states.size > 0)
      return `Registration status ${status} in ${states.size} ${states.size === 1 ? 'state' : 'states'}`
  }

  if (key === 'sos_domestic_sub_status' && subLabel === 'Not Provided by State')
    return 'Good-standing sub-status not published by the state'

  if (/Unknown/i.test(subLabel)) {
    const known: Record<string, string> = {
      sos_domestic: 'Registration status unknown in formation state',
      sos_unknown: 'Status of some registrations could not be resolved',
      sos_match: 'Registration status unknown in the submitted address state',
      profile_status: 'Third-party profile reachability could not be determined',
      website_status: 'Website reachability could not be determined'
    }
    return known[key] ?? sentence(`${key.replace(/_/g, ' ')} could not be resolved`)
  }

  const mapped = BY_VALUE[key]?.[subLabel]
  if (mapped) return mapped

  // Not yet in the catalog. Say that, rather than dressing the raw key and
  // sub-label up as a finding.
  return sentence(`${key.replace(/_/g, ' ')} returned “${subLabel}” — not yet mapped to an insight`)
}
