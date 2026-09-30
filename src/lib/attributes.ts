/**
 * The attributes behind an insight result.
 *
 * An insight is a collection of attributes interpreted into a statement
 * (concept/model.md). Evidence therefore has to show the attributes themselves —
 * the addresses, registrations, people and formation fields the insight was
 * built from — not a restatement of the insight.
 *
 * Every row carries where it came from, so an analyst can get from the synthesis
 * to the insight, from the insight to its attributes, and from an attribute to
 * the source that supplied it.
 */
import { nameEntityTypeOf, trueEntityType, type BusinessRecord, type SourceRef } from './deriveResults'
import type { GroupId } from './groups'
import { entityFormLabel } from './normalise'
import { dbaOfAnotherOf, dbaOwnerOf, isBusinessName, nameStandingOf, ownDbas, submittedNameOf, type Dba } from './businessNames'
import { convertedFormationOf, formationConfirmed, formationFilingOf, NOT_PROVIDED, registrationState, sameName, subStatusLabel } from './registrationStatus'
import { judgeHit } from './watchlist'
import { domesticFilingOf, formationCardFilingOf } from './linkedFormation'
import { stateLabel, stateName } from './states'
import { sourceLabel as sourceLabelOf, readableUrl } from './sourceLabels'

/** Cents as the filing states them. Whole dollars: a lien is never filed for
 *  $4,500.37 and the cents column is noise beside a case number. */
export const money = (cents: number) =>
  `$${Math.round(cents / 100).toLocaleString('en-US')}`

/**
 * Corroborated, not merely claimed.
 *
 * `sources` is everything that carries a value except the customer — it
 * excludes `submitted` by contract — so a submitted value with one is a value a
 * source of record agrees with, and a submitted value with none is the
 * customer's word alone. The Attributes tab says the same thing in words, where
 * it prints "No source" beside it.
 *
 * `registrations` counts too: a name-match row carries the filings that list
 * the name instead of a source string, and a name on a state filing is as
 * corroborated as a value gets.
 *
 * `refs` deliberately does not. A submitted person whose only source object is
 * an adverse-media screening hit would read as verified, while the report
 * beside it says we could not match them at all.
 *
 * Structural rather than typed to `AttributeRow`, because the identity card
 * asks the same question of an address off the record.
 */
export const corroborated = (a: {
  sources?: string[]
  source?: string
  registrations?: unknown[] | null
}) =>
  (a.sources?.length ?? 0) > 0 || Boolean(a.source) || (a.registrations?.length ?? 0) > 0

export type AttributeRow = {
  label: string
  value: string
  /**
   * Which attribute group this row belongs to.
   *
   * Set by whatever produced the row, NOT inherited from the insight that
   * happened to ask for it. A website check needs the submitted address to
   * compare against, but that address is an address — it is not a fact about
   * the web presence, and grouping by the asking insight filed it under one.
   */
  group?: GroupId
  /** Display source. Blank where the label already says it (a "Submitted name"
   *  row does not need "Submitted by the customer" beside it). */
  source: string
  /** Every source, always populated — the Attributes tab shows these in full.
   *  Excludes "submitted": that is carried by `submitted` and shown with the
   *  value, because it says who supplied it rather than where it was found. */
  sources?: string[]
  /** The customer gave us this value. */
  submitted?: boolean
  /** Sourced from the domestic filing rather than every registration. */
  domesticOnly?: boolean
  /** Trace this value to the filings that list it. */
  matchOn?: 'address' | 'officer'
  /** The bare value to match on, without the facts appended for display. */
  matchValue?: string
  /** Registry sources, rendered as the core citation chip rather than as text. */
  registrations?: BusinessRecord['registrations']
  /** Makes the row's source chip a link out to the page it came from. */
  href?: string
  /** The record's own source objects for this value, metadata intact. Lets a
   *  consumer say what role the value played for one particular source. */
  refs?: SourceRef[]
  /** A qualifier that belongs beside the value rather than inside it — the
   *  classifier's confidence, say. Rendered hard right. */
  trailing?: string
  /** An identifier for the value, in its own column — industry codes, where
   *  one category can carry four of them and they must line up to be read. */
  lead?: string
  /** A reading OF the value, set immediately after it — how old a filing date
   *  is. Distinct from `trailing`, which is a fact about the row and sits at
   *  the right edge: an age read against the sources column instead of against
   *  the date it qualifies. */
  qualifier?: string
  /**
   * Derived facts about the value, shown only where an insight is expanded.
   *
   * A property type and a count of businesses at an address are our reading of
   * it, not something a source handed us — no filing states "COMMERCIAL · 21
   * businesses at this location". The Attributes tab answers what the sources
   * supplied, so it shows the address; the judgement of that address belongs
   * to the insight that makes it.
   */
  evidenceNote?: string
  /**
   * Further fields of the same record, one per line under the value — a lien's
   * "Status: Closed", then "Filing date: 2021-09-09" — each its own field in
   * the source's words, never joined into one string. They stay in the one cell
   * so it is plain which record they belong to.
   */
  fields?: Array<{ label?: string; value: string; icon?: 'verified' }>
  /**
   * A record's metadata, as one muted line under its title: its status, its ID
   * with the kind of ID, and when it was filed — "Open · Case 2003TW000393 ·
   * Nov 17, 2003". The line a reader scans a list of records by.
   */
  meta?: string[]
  /** Readings of ours, one per line, shown only as evidence (see `evidenceNote`). */
  evidenceFields?: Array<{ label?: string; value: string }>
  /**
   * Shown only when an insight is expanded, never as an attribute of its own.
   *
   * The individual articles behind an adverse-media match are the evidence FOR
   * that insight — they are not facts about the business the way an address or
   * a filing is, and listing fourteen of them in the Attributes tab buried the
   * four names they belong to.
   */
  detail?: boolean
  /**
   * Evidence for one check, never an attribute of its own.
   *
   * The Attributes tab is built from every check's evidence, so a row invented
   * to answer one question turns up in it as a fact about the business. "Filing
   * state: New York (NY)" is how a match check shows its two halves; as an
   * attribute it is the formation state under a second name. Unlike `detail`,
   * these rows stand on their own inside the insight rather than folding into
   * the row above.
   */
  evidenceOnly?: boolean
  /**
   * Several distinct pages behind one row, each addressable on its own.
   *
   * `sources` plus a single `href` cannot express this: nine adverse-media
   * articles share one chip, and pointing all nine at the first article's URL
   * is worse than not linking them at all.
   */
  links?: Array<{ label: string; title?: string; url?: string; note?: string; agency?: string }>
  /** Replaces the chip's generic "Source" byline — reachability, a date, a note. */
  sourceNote?: string
  /**
   * Take the whole row of the grid.
   *
   * For the row a check is ABOUT, set over the rows that answer it: the
   * submitted address across the top, the filing's state and status side by
   * side beneath. Left to the grid's own packing, the address shared its row
   * with the filing state and the status hung alone underneath.
   */
  /** `full` spans the grid; `half` keeps a cell in the column even with links. */
  span?: 'full' | 'half'
  /** Headline for the chip's preview. Without it the URL is shown, which is the
   *  same string as the link beneath it. */
  sourceTitle?: string
  /** A third-party profile's page, shown as a link on its Sources card. */
  pageUrl?: string
  /** A third-party profile's site — `instagram` — for its mark beside the label. */
  profileType?: string
  /** The business name each source on this row carries, by source label —
   *  the SEC or EPA record's entity, which has no place to be titled by. */
  sourceNames?: Record<string, string>
}

const REGISTRY = 'State registration'
const USPS = 'USPS'

/**
 * Every source an attribute came from, deduplicated.
 *
 * A value is often both submitted and corroborated — a name the customer gave
 * that also appears on a registration has two sources, and showing one of them
 * loses the fact that they agree. The same source repeating once per filing (a
 * 50-state business lists "registration" fifty times) collapses to one.
 */
/** Where the value was FOUND. Whether the customer submitted it is a separate
 *  fact, carried on the row and shown beside the value. */
/**
 * A screening is not a source.
 *
 * `adverse_media_screening_result` on a person means that screen ran against
 * them — it is an OUTPUT of a check, not where the person's name came from.
 * Rendering it as provenance credited the screen with data it only consumed,
 * and put "Adverse media" in the Sources tab as though the record held
 * attributes it had supplied. Where a name actually came from is the filing
 * beside it: Form 5500, a registration, a tax permit.
 *
 * Still read elsewhere to know WHO was screened — just never as a source.
 */
const SCREENING_RESULTS = new Set([
  'watchlist_result',
  'politically_exposed_person_result',
  'adverse_media_screening_result'
])

const provenanceList = (item: { submitted?: boolean; sources?: string[] }): string[] => [
  ...new Set(
    (item.sources ?? []).filter((x) => !SCREENING_RESULTS.has(x)).map(readSource)
  )
]

const provenance = (item: { submitted?: boolean; sources?: string[] }): string =>
  provenanceList(item).join(', ')

/** Source names as the API returns them, read normalised. Unknown sources fall
 *  through unchanged rather than being guessed at. */
const SOURCE_LABELS: Record<string, string> = {
  registration: 'State registration',
  adverse_media_screening_result: 'Adverse media screening',
  watchlist_screening_result: 'Watchlist screening',
  submitted: 'Submitted by the customer',
  city_registration: 'City registration',
  website: 'Website',
  profile: 'Third-party profile',
  tin: 'IRS TIN record'
}

const readSource = (raw: string) => SOURCE_LABELS[raw] ?? raw.replace(/_/g, ' ')

/** Stamps every row a producer emits with the group it belongs to. */
const inGroup = (group: GroupId, rows: AttributeRow[]): AttributeRow[] =>
  rows.map((r) => ({ group, ...r }))

/**
 * One address, one row — built in a single place.
 *
 * The band branch used to format its own string without the property type, so
 * the same address appeared twice: once as "… · 1001 businesses at this
 * location · COMMERCIAL" and once without the last part. Dedup keys on the
 * rendered value, so two spellings of one fact are two rows.
 */
/**
 * The derived fact an insight is actually asking about.
 *
 * Attached to every address regardless, "21 businesses at this location ·
 * COMMERCIAL" turned up under "Related businesses share officers, agents or
 * addresses" — a check about shared officers, answered with a property type.
 * An insight shows the reading it is making and nothing else.
 */
type AddressNote = 'property' | 'cmra' | 'proximity' | 'deliverability'

/**
 * Miles between two geocoded addresses, or nothing if either is not geocoded.
 *
 * Haversine on the API's own latitude/longitude. Two addresses can read as
 * unrelated strings and sit in the same building, or share a city name and be
 * forty miles apart; the distance is the only form of the question a reader can
 * act on.
 */
export const milesBetween = (
  a: BusinessRecord['addresses'][number],
  b: BusinessRecord['addresses'][number]
) => {
  if (
    typeof a.latitude !== 'number' ||
    typeof a.longitude !== 'number' ||
    typeof b.latitude !== 'number' ||
    typeof b.longitude !== 'number'
  )
    return undefined

  const rad = (deg: number) => (deg * Math.PI) / 180
  const dLat = rad(b.latitude - a.latitude)
  const dLon = rad(b.longitude - a.longitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2
  return 3958.8 * 2 * Math.asin(Math.sqrt(h))
}

/**
 * The boundary an address is read against.
 *
 * A fifth of a mile is roughly a city block: far enough that two addresses are
 * not the same premises, close enough that a suite number or a re-geocode
 * explains it. Beyond it, the distance is a fact about the business.
 */
export const PROXIMITY_MILES = 0.2

const proximityNote = (
  a: BusinessRecord['addresses'][number],
  submitted: BusinessRecord['addresses'][number] | undefined
) => {
  if (!submitted) return 'No submitted address to measure against'
  if (a === submitted) return 'The submitted address'
  const miles = milesBetween(a, submitted)
  if (miles === undefined) return 'Not geocoded — distance cannot be measured'
  // Under a tenth of a mile is the same block, and "0.04 mi" reads as precision
  // the geocode does not have.
  if (miles < 0.1) return 'Same location as the submitted address'
  return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi from the submitted address`
}

const addressRow = (
  a: BusinessRecord['addresses'][number],
  note?: AddressNote,
  submitted?: BusinessRecord['addresses'][number]
): AttributeRow => {
  // Our reading of the address, not the address. Appended to the value it made
  // every row in the Attributes tab a judgement the sources never stated —
  // "COMMERCIAL" appears in no filing's payload.
  const facts = [
    // No state means the address never parsed — another reading of it, not
    // part of it. The address is what the source gave us.
    a.state ? null : 'non-US, unstructured',
    note === 'property' ? (sentence(a.propertyType) ?? 'Property type not established') : null,
    note === 'cmra' ? 'Commercial mail receiving agency' : null,
    note === 'proximity' ? proximityNote(a, submitted) : null,
    note === 'deliverability'
      ? a.deliverable === true
        ? 'Deliverable'
        : a.deliverable === false
          ? 'Not deliverable'
          : 'Deliverability not established'
      : null
  ].filter((x): x is string => Boolean(x))

  return {
    group: 'address',
    label:
      a.isRegisteredAgent || a.labels.includes('registered_agent')
        ? 'Registered agent address'
        : 'Address',
    value: a.fullAddress,
    // Each reading its own line, never joined.
    evidenceFields: facts.length > 0 ? facts.map((value) => ({ value })) : undefined,
    source: a.submitted ? '' : provenance(a),
    sources: provenanceList(a),
    submitted: a.submitted,
    refs: a.sourceRefs,
    matchOn: 'address',
    matchValue: a.fullAddress
  }
}

const addressRows = (
  record: BusinessRecord,
  { submittedOnly = false, note }: { submittedOnly?: boolean; note?: AddressNote } = {}
): AttributeRow[] => {
  const submitted = record.addresses.filter((a) => a.submitted)
  // Fall back to everything only when nothing is flagged — never silently show
  // 80 discovered addresses for a check about the one that was submitted.
  const scope = submittedOnly && submitted.length > 0 ? submitted : record.addresses

  return dedupeAddresses(scope).map((a) => addressRow(a, note))
}

/**
 * One row per address, however many times the record carries it.
 *
 * The API lists an address once per role it was submitted in, so FISHMONGER
 * DON's Taylor Street shop arrived twice, identical down to the ZIP+4, and
 * every check about the submitted office showed it twice. Merged on the
 * normalised string: a source either entry carries, the merged one carries.
 */
const dedupeAddresses = (
  addresses: BusinessRecord['addresses']
): BusinessRecord['addresses'] => {
  const seen = new Map<string, BusinessRecord['addresses'][number]>()
  for (const a of addresses) {
    const key = norm(a.fullAddress)
    const prior = seen.get(key)
    seen.set(
      key,
      prior
        ? {
            ...prior,
            submitted: prior.submitted || a.submitted,
            labels: [...new Set([...(prior.labels ?? []), ...(a.labels ?? [])])],
            sources: [...new Set([...(prior.sources ?? []), ...(a.sources ?? [])])],
            sourceRefs: [...(prior.sourceRefs ?? []), ...(a.sourceRefs ?? [])],
            locationCount: prior.locationCount ?? a.locationCount,
            propertyType: prior.propertyType ?? a.propertyType,
            deliverable: prior.deliverable ?? a.deliverable
          }
        : a
    )
  }
  return [...seen.values()]
}

/** Best case first: what is wrong with the entity is what the eye stops on. */
export const FOREIGN_STATUS_ORDER = ['active', 'inactive', 'unknown']

/**
 * One casing for every value a filing states.
 *
 * The API returns `ACTIVE`, `GOOD_STANDING` and `dissolved` in the same record,
 * and rendered raw the Foreign filings group read as three different sources
 * rather than one field with three values.
 */
const sentence = (value: string | null | undefined) =>
  value ? value.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase()) : value

/**
 * A date as it is read aloud: June 13, 2022.
 *
 * `2022-06-13` is the API's storage format, not a reading format — beside a
 * name and an address it was the one value on the card that had to be decoded.
 *
 * Split by hand rather than through `new Date(iso)`: an ISO date with no time
 * parses as UTC midnight, and west of Greenwich that prints as the day before.
 */
/** A lien's kind as a label. The API's `type` names the filing, not a tax. */
const LIEN_KIND: Record<string, string> = { ucc: 'UCC lien', state: 'State lien', federal: 'Federal lien' }

/** "Nov 17, 2003" — a record's date in a line of its metadata. */
export const shortDate = (iso: string | null | undefined) => {
  if (!iso) return undefined
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Industry codes as the dashboard prints them (`formatCodes`,
 * `app/src/components/Industry/utils.tsx`): consecutive codes become a range —
 * "7371-7373, 7379".
 */
const formatCodes = (codes: ReadonlyArray<string>) => {
  const out: string[] = []
  let start = -1
  codes.forEach((code, i) => {
    const runs = Number(code) + 1 === Number(codes[i + 1])
    if (runs) {
      if (start < 0) start = i
      return
    }
    out.push(start >= 0 ? `${codes[start]}-${code}` : code)
    start = -1
  })
  return out.join(', ')
}

/** A source's status, as it states it; "unknown" states nothing and is left out. */
const statusWord = (status: string | null | undefined) =>
  status && !/^unknown$/i.test(status) ? (sentence(status) ?? status) : undefined

export const longDate = (iso: string | null | undefined) => {
  if (!iso) return iso ?? undefined
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}

/**
 * How long the filing has stood: years and months, never days.
 *
 * A qualification filed last quarter and one standing since 2018 are different
 * claims about the business, and a column of ISO dates leaves the reader doing
 * the arithmetic to see it. It said "4 years old" for anything from four years
 * to four years and eleven months — which is the difference between a company
 * that has just cleared a threshold and one about to clear the next.
 *
 * Counted on the calendar rather than by dividing elapsed milliseconds: an
 * average month is 30.44 days and no month is, so the approximation drifted a
 * whole month either way on a date near the turn.
 *
 * Days are deliberately dropped. Nothing in a KYB decision turns on them, and
 * "4 years, 3 months and 12 days" reads as precision about a filing date that
 * is itself only as good as the registry's.
 *
 * Parenthesised, because it sits immediately after the date it qualifies and
 * is a reading of that date rather than another value beside it.
 */
export const filingAge = (date: string | null | undefined) => {
  if (!date) return undefined
  const filed = new Date(date)
  if (Number.isNaN(filed.getTime())) return undefined

  const now = new Date()
  let months =
    (now.getFullYear() - filed.getFullYear()) * 12 + (now.getMonth() - filed.getMonth())
  // The day of the month has not come round yet, so the last month is not up.
  if (now.getDate() < filed.getDate()) months -= 1
  if (months < 0) return undefined

  const years = Math.floor(months / 12)
  const rest = months % 12
  const say = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`

  if (months < 1) return '(this month)'
  if (years === 0) return `(${say(rest, 'month')} old)`
  if (rest === 0) return `(${say(years, 'year')} old)`
  return `(${say(years, 'year')}, ${say(rest, 'month')} old)`
}

/** One row per filing, named. Used where a check is about specific filings. */
const registrationRowsFor = (filings: BusinessRecord['registrations']): AttributeRow[] => {
  if (filings.length === 0)
    return [{ label: 'Registrations', value: 'None on the record', source: REGISTRY }]

  // One row per distinct VALUE, with every filing that states it beside it.
  //
  // Grouped by filing instead, "Entity type: CORPORATION" appeared five times
  // and "Jurisdiction: FOREIGN" four — the same fact restated per state, with
  // the reader left to notice they agreed. Merged, agreement is the default
  // reading and disagreement is what stands out: two Status rows means the
  // filings disagree, and the chips say which said what.
  // Grouped by field, not by filing. Read down a filing at a time, "Status"
  // appeared between two file numbers and the reader had to reassemble the
  // vocabulary themselves; read down a field, Active / Inactive / Unknown sit
  // together as the list they are, each naming the filings that hold it.
  //
  // Name is not here — Names carries it, and four qualifications restating the
  // legal name says only that they describe the same entity.
  /*
   * One row per distinct value, every filing that states it behind it. The
   * chip names those filings ("SOS · AL +2", its list the states), so the value
   * carries no "(3 filings: AL, AZ, CA)" of its own — that restated the chip.
   */
  const byLabel = (
    label: string,
    value: (r: BusinessRecord['registrations'][number]) => string | null | undefined,
    qualifier?: (r: BusinessRecord['registrations'][number]) => string | undefined
  ): AttributeRow[] => {
    const groups = new Map<string, BusinessRecord['registrations']>()
    for (const r of filings) {
      const v = value(r)
      if (!v) continue
      groups.set(v, [...(groups.get(v) ?? []), r])
    }
    return [...groups.entries()].map(([v, list]) => {
      return {
        label,
        value: v,
        source: '',
        qualifier: qualifier?.(list[0]),
        matchValue: `${label}:${v}`,
        registrations: list
      }
    })
  }

  return [
    // Active before inactive before unknown: the reading order is best case
    // first, so what is wrong with the entity is what the eye stops on.
    ...byLabel('Status', (r) => sentence(r.status)).sort(
      (a, b) =>
        FOREIGN_STATUS_ORDER.indexOf(a.value.toLowerCase()) -
        FOREIGN_STATUS_ORDER.indexOf(b.value.toLowerCase())
    ),
    // Each of the registry's three fields only where the filing states it. A
    // filling for the missing ones ("Not published by the state") claimed to
    // know why a value was absent, which the record does not say — except in
    // Delaware and New Jersey, whose Status row already says so.
    ...byLabel('Sub status', (r) => subStatusLabel(r)),
    ...byLabel('Status details', (r) => registrationState(r).statusDetails),
    // No file numbers. A file number identifies the filing, not the business —
    // four of them here said only that four filings exist, which the chips
    // beside every other row already say. Each one stays on its own filing's
    // card in Sources, under Filing details, where it is the identifier for
    // the record being read rather than a fact about the company.
    ...byLabel(
      'Registration date',
      (r) => longDate(r.registrationDate),
      (r) => filingAge(r.registrationDate)
    )
  ]
}

/**
 * The domestic filing, in full.
 *
 * The `formation` object is not a separate source — it restates three fields the
 * domestic registration already carries (`entity_type`, `formation_state`,
 * `formation_date`), so formation and "the Delaware filing" are one object shown
 * twice. Read from the filing itself, everything it states belongs here: its
 * standing, its file number, the agent it names.
 */
/**
 * The entity type as a short word — `LLC`, `PLLC`, `Corporation` — or nothing
 * when the record has no formation or the filing says Unknown. The filing
 * shouts every type in capitals; an initialism stays that way, a word does
 * not.
 */
export const entityTypeCode = (record: BusinessRecord): string | undefined => {
  if (!record.formation) return undefined
  const domestic = formationFilingOf(record)
  const raw = trueEntityType(record) ?? domestic?.entityType ?? record.formation.entityType
  if (!raw || raw.toUpperCase() === 'UNKNOWN') return undefined
  // Five letters or fewer is an initialism (LLC, PLLC, LP, INC); longer is a word.
  return raw.length <= 5 ? raw.toUpperCase() : raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
}

const formationRows = (record: BusinessRecord): AttributeRow[] => {
  if (!record.formation)
    return [{ group: 'formation', label: 'Formation', value: 'No formation record', source: REGISTRY }]

  const domestic = formationFilingOf(record)

  const field = (
    label: string,
    value: string | null | undefined,
    qualifier?: string,
    extra?: Partial<AttributeRow>
  ): AttributeRow[] =>
    value
      ? [
          {
            group: 'formation' as const,
            label,
            value,
            qualifier,
            source: REGISTRY,
            domesticOnly: true,
            ...extra
          }
        ]
      : []

  return [
    // Spelled out. `PLLC` is the thing this whole record turns on and it is
    // four letters — see `entityFormLabel`.
    ...field(
      'Entity type',
      entityFormLabel(trueEntityType(record) ?? domestic?.entityType ?? record.formation.entityType),
      undefined,
      // Every filing declaring the same form, not the domestic one alone.
      corroboration(record, 'entityType', domestic?.entityType)
    ),
    // Only what a domestic filing confirms. A formation read off a foreign
    // filing's stated home state is not stated as the formation.
    ...(formationConfirmed(record)
      ? [
          ...field('Formation state', stateLabel(record.formation.state)),
          // The same date the domestic filing carries as its registration date;
          // they dedup to one row rather than stating it twice.
          ...field('Formation date', longDate(record.formation.date), filingAge(record.formation.date))
        ]
      : [...field('Formation state', 'Not confirmed', 'no domestic filing on record')]),
    // The registry's three fields, each only when the filing states it. A
    // Delaware or New Jersey Unknown is the state not publishing, and says so.
    ...field(
      'Status',
      domestic && registrationState(domestic).silent
        ? 'Not provided by state'
        : domestic && registrationState(domestic).status
    ),
    ...field('Sub status', domestic && subStatusLabel(domestic)),
    ...field('Status details', domestic && registrationState(domestic).statusDetails),
    ...field('File number', domestic?.fileNumber)
    // No registered agent: an agent is a person, and People lists every one of
    // them with the filings that name them.
  ]
}

/**
 * The domestic filing's identity, for the head of the report.
 *
 * What the Secretary of State says this business IS: the name it is registered
 * under, its form, where and when it was formed, and whether the filing is live
 * and in standing. Nothing that merely identifies the
 * filing — no file number — that is the Attributes tab's. This is the short
 * list a reviewer reads before the report starts arguing, in place of the
 * paragraph that used to describe the business in prose.
 *
 * The name leads, and it is the filing's own spelling: the registry's casing is
 * the identifying fact, and the submitted spelling is what the Names group is
 * for. The filing's status, sub status and status details follow, each only
 * when the filing states it; a Delaware or New Jersey status, never published,
 * says so rather than reading as missing.
 *
 * Six facts after the name, so they pair: the card is read as one lead fact
 * over three rows of two.
 */
export const formationIdentityRows = (record: BusinessRecord): AttributeRow[] => {
  const domestic = formationFilingOf(record)
  const names = nameRows(record).filter((r) => r.label !== 'DBA')
  const registered = names.find((r) => r.domesticOnly) ?? names[0]

  const row = (label: string, value: string | null | undefined, extra?: Partial<AttributeRow>): AttributeRow[] =>
    value
      ? [{ group: 'formation' as const, label, value, source: REGISTRY, domesticOnly: true, ...extra }]
      : []

  const FIELDS = new Set(['Entity type', 'Formation state', 'Formation date', 'Status', 'Sub status', 'Status details'])
  const formation = formationRows(record)
    .filter((r) => FIELDS.has(r.label))

  /* The sub status is a field of the filing, stated here whatever it is: a
     state that publishes none says so as the value, beside the status and
     status details, rather than as an insight row of its own under the card. */
  const subStatus = formation.some((r) => r.label === 'Sub status')
    ? []
    : domestic
      ? row('Sub status', NOT_PROVIDED)
      : []

  return [
    ...row('Legal name', domestic?.name ?? registered?.value, corroboration(record, 'name', domestic?.name ?? registered?.value)),
    ...formation,
    ...subStatus
    // No officers or registered agent: the filing's people are its Sources
    // card's to list, and the Attributes panel's.
  ]
    .map(nameTheFiling(record))
    .map(withSourceNames(record))
}

/**
 * The Formation card's rows for a business that converted out of the state it
 * was formed in (`convertedFormationOf`): the domestic filing it stands on now,
 * read off that filing, not the formation's. Labelled as the formation fields,
 * as every formation card is; the subtext says it was formed elsewhere first.
 */
export const currentDomesticRows = (
  record: BusinessRecord,
  filing: BusinessRecord['registrations'][number],
  /** A former filing: its date is stated alone. The record carries no end date
   *  for a converted filing, so how long it was active is not something it says. */
  former?: boolean
): AttributeRow[] => {
  const st = registrationState(filing)
  const age = former ? undefined : filingAge(filing.registrationDate)
  // Status and status details are the registry's two fields, stated apart as on
  // every formation card: "Inactive", then "Converted out" under its own label.
  const status = st.silent ? NOT_PROVIDED : st.status
  const row = (label: string, value: string | null | undefined, extra?: Partial<AttributeRow>): AttributeRow[] =>
    value ? [{ group: 'formation' as const, label, value, source: '', registrations: [filing], ...extra }] : []
  return [
    ...row('Legal name', filing.name, corroboration(record, 'name', filing.name)),
    ...row('Entity type', entityFormLabel(trueEntityType(record) ?? filing.entityType ?? record.formation?.entityType), corroboration(record, 'entityType', filing.entityType)),
    ...row('Formation state', stateLabel(filing.state)),
    ...row('Formation date', longDate(filing.registrationDate), { qualifier: age }),
    ...row('Status', status),
    // Stated whatever it is, as on the formation card; a former filing only
    // where the state gave one.
    ...row('Sub status', st.subStatus ?? (former ? undefined : NOT_PROVIDED)),
    ...row('Status details', st.statusDetails)
  ].map(withSourceNames(record))
}

/**
 * What the IRS holds: the number, and the name it is held against.
 *
 * The number alone was half the record. The IRS match is a match of two things
 * — a TIN and a business name — and "the IRS has a record for the submitted TIN
 * and business name combination" is the insight it feeds; showing only the last
 * four digits left the other half of that sentence with nothing behind it.
 *
 * Both are printed in full. The number was masked to its last four, which is
 * the habit from consumer PII — but this is an EIN on a business the reviewer
 * is deciding about, it is the value the customer submitted, and a reviewer
 * checking it against a filing or a letter needs the whole thing. The name is
 * in full for the same reason: comparing it against the legal name above takes
 * every character of both.
 */
const tinRows = (record: BusinessRecord): AttributeRow[] => {
  const tin = record.tin as { tin?: string; name?: string; mismatch?: boolean } | null

  return [
    {
      group: 'tin' as const,
      label: 'TIN',
      value: tin?.tin ?? 'Not held',
      source: 'IRS TIN record',
      // The customer gave us the number; the IRS holding a record against it is
      // what makes it verified. The identity card has said so from the start —
      // this row did not, so the same fact carried a mark in one place on the
      // page and not in the other.
      submitted: Boolean(tin?.tin) || undefined
    },
    ...(tin?.name
      ? [
          {
            group: 'tin' as const,
            label: 'IRS name',
            value: tin.name,
            source: 'IRS TIN record',
            // Said only when it is news. Two identical names side by side make
            // the point without a label on it; a name the IRS holds that is NOT
            // the one on the application is the finding.
            qualifier: tin.mismatch ? '(not the submitted name)' : undefined
          }
        ]
      : [])
  ]
}

/** Brand names the API returns lowercase. Title-casing blindly gives "Bbb". */
const PROFILE_NAMES: Record<string, string> = {
  bbb: 'BBB',
  linkedin: 'LinkedIn',
  trustpilot: 'Trustpilot',
  facebook: 'Facebook',
  google: 'Google',
  yelp: 'Yelp',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  x: 'X'
}

/**
 * Where a contact detail actually came from.
 *
 * A `website` source whose id is the WEBSITE RECORD'S OWN id is not a finding —
 * it is the container the value arrived in. `support@middesk.com` is submitted
 * and carries exactly that self-reference, so calling it a website source
 * claimed the crawl had corroborated an address the customer gave us. Dropping
 * it leaves the row saying only what is true: submitted, found nowhere else.
 *
 * A profile source is named for the profile it is — Facebook, not "Profile".
 */
const contactSources = (refs: SourceRef[] | undefined, websiteId?: string | null): string[] => {
  const named = (refs ?? [])
    .filter((r) => !(r.type === 'website' && websiteId && r.id === websiteId))
    .map((r) => {
      const type = (r.metadata as { type?: string })?.type
      return r.type === 'profile' && type ? profileName(type) : readSource(r.type)
    })
  return [...new Set(named)]
}

const profileUrl = (refs: SourceRef[] | undefined) =>
  (refs ?? [])
    .map((r) => (r.type === 'profile' ? (r.metadata as { url?: string })?.url : undefined))
    .find(Boolean)

export const profileName = (type: string) =>
  PROFILE_NAMES[type.toLowerCase()] ?? `${type.charAt(0).toUpperCase()}${type.slice(1)}`


/**
 * A profile's page details, from its own metadata, as the dashboard reads them
 * (`app/src/containers/BusinessHome/DiveCards/ThirdPartyProfilesCard.tsx`):
 * the flags it raises, its BBB and star ratings, followers and the other page
 * counts, and when it was last active. One field per line; nothing the page
 * does not state.
 */
const profileFields = (p: NonNullable<BusinessRecord['profiles']>[number]): Array<{ label?: string; value: string; icon?: 'verified' }> => {
  const m = (p.metadata ?? {}) as Record<string, unknown>
  const type = (p.type ?? '').toLowerCase()
  const num = (v: unknown) => (typeof v === 'number' && v > 0 ? v : undefined)
  const count = (v: unknown, word: string) => (num(v) !== undefined ? { value: `${(v as number).toLocaleString()} ${word}` } : undefined)
  const flag = (on: boolean, value: string) => (on ? { value } : undefined)
  const lastLabel: Record<string, string> = { google: 'Last review', yelp: 'Last review', linkedin: 'Last post', instagram: 'Last post', facebook: 'Last post' }
  const price = typeof m.price_range === 'string' && /^\$+$/.test(m.price_range) ? m.price_range : undefined
  return [
    // The flags the dashboard raises under the profile's name.
    // With the platform's verified mark beside it.
    type === 'instagram' && m.is_business_account === true ? { value: 'Verified business', icon: 'verified' as const } : undefined,
    flag(type === 'instagram' && m.is_private === true, 'Private'),
    flag(type === 'google' && m.status === 'temporarily_closed', 'Temporary closure'),
    flag(type === 'google' && m.status === 'permanently_closed', 'Permanent closure'),
    flag(type === 'yelp' && m.is_claimed === true, 'Business claimed'),
    flag(type === 'yelp' && m.is_closed === true, 'Closed'),
    type === 'bbb' && typeof m.bbb_rating === 'string' ? { label: 'BBB rating', value: m.bbb_rating } : undefined,
    typeof p.rating === 'number' && (p.ratingCount ?? 0) > 0
      ? { value: `${p.rating} from ${p.ratingCount} review${p.ratingCount === 1 ? '' : 's'}` }
      : undefined,
    // Counts that belong together share a line: "107,811 followers · 97
    // following", then "163 posts · Last post: Sep 19, 2026".
    line(count(m.followers ?? p.followers, 'followers'), count(m.following, 'following')),
    typeof m.company_size === 'string' ? { label: 'Company size', value: m.company_size } : undefined,
    count(m.likes, 'likes'),
    price ? { label: 'Price range', value: price } : undefined,
    line(
      count(m.posts_count, 'posts'),
      lastLabel[type] && typeof m.last_post === 'string'
        ? { value: `${lastLabel[type]}: ${shortDate(m.last_post) ?? m.last_post}` }
        : undefined
    )
  ].filter((x): x is { label?: string; value: string; icon?: 'verified' } => Boolean(x))
}

/** Two short facts on one line, "·" between; either alone when the other is absent. */
const line = (...parts: Array<{ label?: string; value: string } | undefined>) => {
  const shown = parts.filter((x): x is { label?: string; value: string } => Boolean(x))
  return shown.length ? { value: shown.map((x) => (x.label ? `${x.label}: ${x.value}` : x.value)).join(' · ') } : undefined
}

const REGISTRATION_SOURCES = new Set([REGISTRY, 'registration'])

/** The source key a person carries once a given screen has run against them. */
const SCREEN_SOURCE: Record<string, string> = {
  watchlist: 'watchlist_result',
  politically_exposed_persons: 'politically_exposed_person_result',
  adverse_media: 'adverse_media_screening_result'
}

/**
 * Every name on the record, consolidated by identity.
 *
 * "MIDDESKINC" on a tax permit is Middesk Inc with the space dropped, so it
 * folds into that row as another source for it rather than standing as a name
 * of its own. A genuinely different name — a former name, an unrelated entity
 * on a filing — has a different identity and keeps its own row.
 *
 * The submitted spelling is the one shown: it is what the customer will
 * recognise, and the variants are punctuation.
 */
const nameRows = (record: BusinessRecord): AttributeRow[] => {
  const groups = new Map<string, Array<(typeof record.names)[number]>>()
  for (const n of record.names ?? []) {
    const key = `${n.type}:${nameKey(n.name)}`
    groups.set(key, [...(groups.get(key) ?? []), n])
  }

  return [...groups.entries()].map(([key, group]) => {
    const submitted = group.find((n) => n.submitted)
    const primary = submitted ?? group[0]
    // "Legal name" is a claim a filing makes. A name the customer gave that no
    // source carries is just the business's name, and is labelled as that.
    const confirmed = group.some((n) => (n.sources ?? []).length > 0)
    // Every filing under this name, where the record says which (see
    // `corroboration`) — not the domestic filing alone.
    const filed = record.registrations.filter((r) => nameKey(r.name ?? '') === nameKey(primary.name))
    const sources = [...new Set(group.flatMap((n) => provenanceList(n)))]

    return {
      group: 'name' as const,
      label:
        primary.type === 'dba'
          ? 'DBA'
          : submitted
            ? confirmed
              ? 'Legal name'
              : 'Business name'
            : 'Name on file',
      matchValue: key,
      value: primary.name,
      // No source on a submitted name: the label already says where it came
      // from, and printing the registry alongside it read as a contradiction.
      source: '',
      sources: filed.length > 0 ? sources.filter((x) => !REGISTRATION_SOURCES.has(x)) : sources,
      submitted: group.some((n) => n.submitted),
      refs: group.flatMap((n) => n.sourceRefs ?? []),
      ...(filed.length > 0 ? { registrations: filed } : {}),
      domesticOnly: group.some((n) => (n.sources ?? []).some((x) => REGISTRATION_SOURCES.has(x)))
    }
  })
}


/** Registries write addresses and names in their own casing and punctuation. */
const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** A registered agent is a role on a filing, not an officer title. */
export const AGENT = /registered agent/i

/**
 * A role as a label. Registries shout ("DIRECTOR") or not ("Director"); an
 * all-caps role is read in words, anything else is left as the source wrote it.
 * "Other" and no role at all say nothing, and read as "Officer".
 */
/**
 * One name per role, whatever the filing called it.
 *
 * Fifty filings write one CEO as "CEO", "Chief Executive", "Chief Executive
 * Officer" and "CEO CHIEF EXECUTIVE OFFICER"; Arizona's "Governor" and
 * "GoverningPerson" are one thing, and "Officer Director" is a director. Read
 * out together they are spellings, not roles.
 */
export const canonicalRole = (role: string | null | undefined): string => {
  const r = (role ?? '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!r || r === 'other') return 'Officer'
  if (/\bceo\b|chief executive/.test(r)) return 'Chief executive officer'
  if (/\bcfo\b|chief financial/.test(r)) return 'Chief financial officer'
  if (/\bcoo\b|chief operating/.test(r)) return 'Chief operating officer'
  if (/\bcto\b|chief technology/.test(r)) return 'Chief technology officer'
  if (/governing ?person|\bgovernor\b/.test(r)) return 'Governor'
  if (/\bdirector\b/.test(r)) return 'Director'
  if (/\bpresident\b/.test(r)) return /vice/.test(r) ? 'Vice president' : 'President'
  if (/\bsecretary\b/.test(r)) return 'Secretary'
  if (/\btreasurer\b/.test(r)) return 'Treasurer'
  if (/managing member/.test(r)) return 'Managing member'
  if (/\bmember\b/.test(r)) return 'Member'
  if (/\bmanager\b/.test(r)) return 'Manager'
  if (/\bowner\b/.test(r)) return 'Owner'
  if (/registered agent|\bagent\b/.test(r)) return 'Registered agent'
  if (/\bofficer\b/.test(r)) return 'Officer'
  return roleLabel(role)
}

export const roleLabel = (role: string | null | undefined) => {
  const r = (role ?? '').trim()
  if (!r || /^other$/i.test(r)) return 'Officer'
  return r === r.toUpperCase() ? r.toLowerCase().replace(/^./, (c) => c.toUpperCase()) : r
}

/** A name as a filing writes it, read in words: "CHRISTOPHER LOCHTE" is
 *  Christopher Lochte, as the dashboard's SOS card reads it. A name the filing
 *  already writes in mixed case is left exactly as written. */
export const filedName = (n: string) =>
  n === n.toUpperCase() ? n.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : n

/** Identity of a name across spellings: "MIDDESK, INC." and "Middesk Inc" are
 *  the same name, and a registry dropping the space is not a second name. */
export const nameKey = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, '')

/**
 * Whether the website states this name: its business-name check matched the
 * submitted name, and this is that name. Every row that shows the business
 * name or a DBA of it cites the website too — Firebird Yarns' DBA read as the
 * city register's alone when its site says it as well. A similar match is a
 * different name, and does not count.
 */
export const websiteStatesName = (record: BusinessRecord, value: string | null | undefined): boolean =>
  Boolean(value) &&
  nameKey(record.name) === nameKey(value ?? '') &&
  /^verified$/i.test(record.reviewTasks.find((t) => t.key === 'web_business_name_verification')?.subLabel ?? '')

/** A row's sources with the website added where it states the name. */
const withWebsite = (record: BusinessRecord, value: string | null | undefined, sources: string[] = []): string[] =>
  websiteStatesName(record, value) && !sources.includes('Website') ? [...sources, 'Website'] : sources

/** The filings that actually list this value. Empty when none do — in which case
 *  the record does not say which filing it came from, and nothing is claimed. */
const filingsListing = (record: BusinessRecord, value: string, field: 'addresses' | 'officers') => {
  const target = norm(value)
  if (!target) return []
  return record.registrations.filter((r) => {
    if ((r[field] ?? []).some((entry) => norm(entry) === target)) return true
    // A registered agent is named on the filing but never in its `officers[]`,
    // which is why TELOS LEGAL CORP. could not be traced to any filing at all
    // and showed no source. It is a person on the record like any other.
    return field === 'officers' && Boolean(r.registeredAgent) && norm(r.registeredAgent ?? '') === target
  })
}

/**
 * Every source that states this value, not only the filing the row is read off.
 *
 * An address or an officer has always cited each filing and permit that lists
 * it. The legal name, the entity type and the registered agent cited the
 * domestic filing alone, so CHECKR, INC. read as one Delaware filing's say-so
 * when all 21 of its filings are under that name, declare a corporation, and
 * most name the same agent. The filings are matched on the field they state;
 * the name's and the agent's other carriers — a city registration, a tax
 * permit, a Form 5500 — come from the record's own source list. Entity type is
 * stated by filings and nothing else.
 *
 * Empty when nothing states it, so the row keeps whatever it cited before.
 */
const corroboration = (
  record: BusinessRecord,
  field: 'name' | 'entityType' | 'registeredAgent',
  value: string | null | undefined
): Partial<AttributeRow> => {
  const target = nameKey(value ?? '')
  if (!target) return {}
  const registrations = record.registrations.filter((r) => nameKey(r[field] ?? '') === target)
  const carriers =
    field === 'name'
      ? (record.names ?? []).filter((n) => nameKey(n.name) === target)
      : field === 'registeredAgent'
        ? record.people.filter((p) => nameKey(p.name) === target)
        : []
  // The website states the name too, when its business-name check matched
  // the submitted name and that is the name in question.
  const siteStatesIt = field === 'name' && websiteStatesName(record, value)
  const sources = [
    ...new Set([...carriers.flatMap((c) => provenanceList(c)), ...(siteStatesIt ? ['Website'] : [])])
  ].filter((x) => !REGISTRATION_SOURCES.has(x))
  if (registrations.length === 0 && sources.length === 0) return {}
  return {
    ...(registrations.length > 0 ? { registrations } : {}),
    sources,
    source: '',
    refs: carriers.flatMap((c) => c.sourceRefs ?? []).filter((x) => x.type !== 'registration')
  }
}

const nameTheFiling = (record: BusinessRecord) => (row: AttributeRow): AttributeRow => {
  if (row.registrations) return row

  const textual = row.sources ?? (row.source ? [row.source] : [])
  const fromRegistry = textual.some((x) => REGISTRATION_SOURCES.has(x))
  if (!fromRegistry || record.registrations.length === 0) return row

  // The formation filing itself (`formationFilingOf`), not every filing in the
  // formation state: Andytown holds a California domestic filing and a
  // California foreign one, and its formation facts cited both, as "SOS · CA +1"
  // over one filing counted twice.
  const formationFiling = formationFilingOf(record)
  const domestic = formationFiling ? [formationFiling] : []

  // Only name the filing where the record actually says which one. Formation
  // facts come from the domestic filing, so that is nameable. An officer or an
  // address carries `sources: ['registration']` and nothing more — attributing
  // it to all five filings would claim provenance the API never gave, which is
  // the same invention as naming a source that was never stated.
  // An address or an officer can be traced to the filings that list it — the
  // registration objects carry their own `addresses[]` and `officers[]`.
  const listed =
    row.matchOn && row.matchValue
      ? filingsListing(record, row.matchValue, row.matchOn === 'address' ? 'addresses' : 'officers')
      : []

  const named = listed.length > 0 ? listed : row.domesticOnly ? domestic : []

  // Unresolvable: the record says "registration" and the filings do not list
  // the value, so we cannot name one. A registered agent is the usual case —
  // the API carries it as a person but never on a registration's `officers[]`.
  //
  // Say how many filings cite it rather than leaving a bare "Registration",
  // which reads as a source and is not one. The count is in the data; which
  // filings they are is not, and guessing would be the invention this whole
  // pass exists to prevent.
  // Unresolvable to one filing — a registered agent is the usual case, cited by
  // `registration` but never listed on a registration's `officers[]`.
  //
  // Claim nothing. Naming all the filings put TELOS LEGAL CORP under a New
  // Jersey filing whose own payload reads "Officers: None published" — the
  // record contradicting itself one screen apart. A value with no attributable
  // filing shows no registry source, which is the truth: we know it came from
  // registry data and not which filing, and there is no honest way to render
  // "one of these five".
  const attributed = named

  if (attributed.length === 0)
    return { ...row, sources: textual.filter((x) => !REGISTRATION_SOURCES.has(x)), source: '' }

  return {
    ...row,
    sources: textual.filter((x) => !REGISTRATION_SOURCES.has(x)),
    source: '',
    registrations: attributed
  }
}

const CONNECTIONS = 'Middesk connections'

/**
 * The businesses connected to this one, each as one node.
 *
 * A connection is a business, so it renders as one: the name, and under it the
 * provider's confidence and how many people and addresses the two share —
 * "100% · 6 shared people · 12 shared addresses". Not the people and
 * addresses themselves: listed one per line, a connection ran past forty lines,
 * and a shared address shown as an address reads as one more place this
 * business is, which is not what it is.
 */
const connectionRows = (record: BusinessRecord): AttributeRow[] => {
  const connections = record.connections ?? []
  if (connections.length === 0) return []

  const count = (n: number, one: string, many: string) => (n > 0 ? `${n} ${n === 1 ? one : many}` : undefined)

  return connections.map((c) => ({
    group: 'connections' as const,
    label: 'Business name',
    value: c.name,
    matchValue: c.name,
    meta: [
      typeof c.confidence === 'number' ? `${Math.round(c.confidence * 100)}%` : undefined,
      count((c.people ?? []).length, 'shared person', 'shared people'),
      count((c.addresses ?? []).length, 'shared address', 'shared addresses')
    ].filter((x): x is string => Boolean(x)),
    source: CONNECTIONS,
    sources: [CONNECTIONS]
  }))
}

const attributesForKey = (rawKey: string, record: BusinessRecord): AttributeRow[] => {
  // An id can carry a qualifier after its key (`license:npi-…`); the evidence
  // is read by the key.
  const [key] = rawKey.split(':')
  // Once per distinct address, however many roles it was submitted in — see
  // `dedupeAddresses`. Every address branch below reads this, not the record.
  const addresses = dedupeAddresses(record.addresses)

  const submittedNames = (record.names ?? []).filter((n) => n.submitted && n.type !== 'dba')
  const submittedPeople = record.people.filter((p) => p.submitted)
  const officers = record.people.filter((p) => (p.sources ?? []).includes('registration'))

  // A name is a name wherever it is cited, so it groups with the other names
  // rather than under whichever check asked for it.
  const nameRow: AttributeRow = submittedNames.length
    ? {
        group: 'name',
        // "Legal name" is a filing's word. A submitted name no source carries
        // is the business's name, and says so.
        label: submittedNames.some((n) => (n.sources ?? []).length > 0) ? 'Legal name' : 'Business name',
        matchValue: `legal:${nameKey(submittedNames.map((n) => n.name).join(', '))}`,
        value: submittedNames.map((n) => n.name).join(', '),
        source: '',
        sources: withWebsite(record, submittedNames[0]?.name, [...new Set(submittedNames.flatMap((n) => provenanceList(n)))]),
        // The record's own source objects, not just their types. Without them a
        // per-jurisdiction source could not be resolved to a jurisdiction, and
        // the row landed in an unscoped "Tax permit" card beside the three real
        // ones it belongs to.
        refs: submittedNames.flatMap((n) => n.sourceRefs ?? []),
        submitted: true
      }
    : {
        group: 'name',
        label: 'Business name',
        matchValue: `legal:${nameKey(record.name)}`,
        value: record.name,
        source: '',
        sources: withWebsite(record, record.name),
        submitted: true
      }

  /**
   * One row per role, labelled BY the role: "Member", "Director" — the title is
   * the label, not a suffix on the name ("Christopher S Lochte — MEMBER"). A
   * registered agent is its own row whatever else the person is. With no title
   * the label is "Officer".
   */
  const peopleRow = (people: typeof record.people, _context: string): AttributeRow[] =>
    people.flatMap((p) => {
      const base = {
        group: 'people' as const,
        source: p.submitted ? '' : provenance(p),
        sources: provenanceList(p),
        submitted: p.submitted,
        refs: p.sourceRefs,
        matchOn: 'officer' as const,
        matchValue: p.name,
        value: p.name
      }
      const agent = p.titles.some((t) => AGENT.test(t))
      // The filing names this exact name only as its agent; its officers are
      // listed under their own names (`officersOnFilings`). Maverick Games'
      // filing names "Christopher S Lochte" as agent and "CHRISTOPHER LOCHTE"
      // as Member — the Member title does not belong to the agent's spelling.
      const onlyAgentOnFilings =
        agent &&
        record.registrations.some((r) => norm(r.registeredAgent ?? '') === norm(p.name)) &&
        !record.registrations.some((r) => (r.officerRoles ?? []).some((o) => norm(o.name) === norm(p.name)))
      const others = onlyAgentOnFilings ? [] : p.titles.filter((t) => !AGENT.test(t))
      // One row per title, as each filing states it — never several titles run
      // together under "Officer". No title at all reads as "Officer".
      return [
        ...(agent ? [{ ...base, label: 'Registered agent' }] : []),
        ...(others.length > 0
          ? others.map((t) => ({ ...base, label: roleLabel(t) }))
          : agent
            ? []
            : [{ ...base, label: 'Officer' }])
      ]
    })

  // --- Names ---------------------------------------------------------------
  // No registration rows here, or under addresses, DBAs or people. The
  // active/unknown/inactive breakdown is one fact about the filings, and
  // attaching it to every check that happens to read a filing repeated it in
  // four groups. It belongs to Secretary of State filings and nowhere else.
  // The whole identity of the entity in one place: every name it is known by,
  // then what it legally is.
  /**
   * The submitted name, against the state filings that carry it — and nothing
   * else.
   *
   * The row's full provenance read `SOS · DE +5`, where five of the six were a
   * tax permit, a lien and a Form 5500. Those attest the name, but the check is
   * a match against STATE REGISTRATIONS, and a lien agreeing is a different
   * claim from a Secretary of State agreeing.
   */
  if (key === 'name') {
    const legal = (record.names ?? []).filter((n) => n.type !== 'dba' && n.submitted)
    const names = legal.length > 0 ? legal.map((n) => n.name) : [record.name]

    return names.map((name) => {
      const filings = record.registrations.filter((r) => nameKey(r.name ?? '') === nameKey(name))
      /*
       * The legal name is the filing's, not the application's.
       *
       * FISHMONGER DON was submitted; the California filing reads FISHMONGER
       * DON LLC, and the check calls that a similar match. Showing the
       * submitted spelling as the legal name put the customer's version where
       * the registry's belongs. Where no filing carries the submitted spelling
       * but the domestic filing carries a name, that name is the legal name
       * and the submission sits under it, labelled as what it is.
       */
      const domestic =
        formationFilingOf(record) ??
        record.registrations[0]
      const onFile = filings[0]?.name ?? domestic?.name
      const differs = Boolean(onFile) && nameKey(onFile as string) !== nameKey(name)
      return {
        group: 'name' as const,
        label: onFile ? 'Legal name' : 'Business name',
        value: differs ? (onFile as string) : name,
        matchValue: `legal:${nameKey(name)}`,
        source: '',
        sources: withWebsite(record, differs ? onFile : name),
        // The chip says the customer supplied THIS value. When the value shown
        // is the filing's, they did not — the line under it carries what they
        // submitted instead.
        submitted: !differs,
        registrations: filings.length > 0 ? filings : differs && domestic ? [domestic] : undefined,
        // An empty chip column would read as "not rendered yet". A match check
        // with nothing matched has to say so.
        trailing: differs
          ? `Submitted: ${name}`
          : filings.length === 0
            ? 'No state registration carries this name'
            : undefined
      }
    })
  }

  /*
   * The submitted name and what else the names establish — see `nameStandingOf`
   * and `nameInsights`. Each insight shows only the names its one fact rests
   * on. Evidence only: the Attributes tab already lists these names from the
   * checks and the city register that produced them.
   */
  if (key === 'submitted_name' || key === 'trade_names' || key === 'submitted_name_dba' || key === 'dba_owner_filing') {
    const n = nameStandingOf(record)
    const submittedRow: AttributeRow = {
      group: 'name',
      label: 'Submitted business name',
      value: n.submitted,
      source: '',
      sources: withWebsite(record, n.submitted),
      submitted: true,
      evidenceOnly: true,
      matchValue: `submitted:${nameKey(n.submitted)}`
    }
    const dbaRow = (d: Dba): AttributeRow => ({
      group: 'name',
      label: 'Doing business as',
      value: d.name,
      source: d.city ? 'City registration' : d.source,
      sources: withWebsite(record, d.name, [d.city ? 'City registration' : d.source]),
      refs: (d.refIds ?? []).map((id) => ({ id, type: 'city_registration', metadata: { city: d.city, status: d.open ? 'Active' : 'Inactive' } })),
      trailing: [d.owner ? `Owner: ${d.owner}` : '', d.since ? `since ${d.since.slice(0, 4)}` : ''].filter(Boolean).join(' · ') || undefined,
      evidenceOnly: true,
      matchValue: `dba:${nameKey(d.name)}:${nameKey(d.owner ?? '')}`
    })

    /* A DBA of another business entity: the registration that lists the name
       under its owner — San Francisco's, naming Mixboard Inc. That record is
       the evidence. The owner's own state filing is not: Mixboard's Delaware
       filing says nothing of the DBA, and shown here it read as though it did.
       Where it is on a linked record, `linked_domestic` says so. */
    const listedRow = (d: Dba): AttributeRow => ({
      ...dbaRow(d),
      label: d.city ? `${d.city} registration` : d.source,
      trailing: [d.owner ? `DBA of ${d.owner}` : '', d.since ? `since ${d.since.slice(0, 4)}` : ''].filter(Boolean).join(' · ') || undefined
    })
    const dbaOfBusinessRows = (d: Dba) => (d.owner && isBusinessName(d.owner) ? [listedRow(d)] : [dbaRow(d)])

    if (key === 'trade_names') return ownDbas(n, record).map(dbaRow)
    if (key === 'submitted_name_dba') {
      const d = dbaOfAnotherOf(n)
      return d ? dbaOfBusinessRows(d) : []
    }
    if (key === 'dba_owner_filing') {
      const o = dbaOwnerOf(record, n)
      if (!o) return []
      return o.filing
        ? [
            {
              group: 'name',
              label: `${o.owner}'s legal name`,
              value: o.filing.name ?? '',
              source: '',
              registrations: [o.filing],
              evidenceOnly: true,
              matchValue: `owner-filing:${o.filing.state}:${o.filing.fileNumber ?? ''}`
            }
          ]
        : [{ group: 'name', label: `${o.owner}'s legal name`, value: 'No state filing on record', source: '', evidenceOnly: true }]
    }
    return [
      submittedRow,
      ...n.legal.map((r) => ({
        group: 'name' as const,
        label: 'Legal name',
        value: r.name ?? n.submitted,
        source: '',
        registrations: [r],
        evidenceOnly: true,
        matchValue: `legal-filing:${r.state}:${r.fileNumber ?? ''}`
      })),
      // The DBA the name is, where it is one and not also a legal name, and
      // the business it belongs to.
      ...(n.matchedDba && n.category !== 'MATCHES_LEGAL_NAME' ? dbaOfBusinessRows(n.matchedDba) : [])
    ]
  }

  /*
   * The registration a converted business left (`convertedFormationOf`), as
   * the filing itself states it: Andytown's California domestic LLC, marked
   * converted out.
   */
  // The two things compared: the suffix on the submitted name, and the type
  // the filing records.
  if (key === 'name_entity_type') {
    const m = nameEntityTypeOf(record)
    if (!m) return []
    // The filing the Formation card leads with: Andytown's Delaware one, not
    // the California filing it converted out of.
    const filing = formationCardFilingOf(record)
    return [
      {
        group: 'name',
        label: 'Submitted business name',
        value: (record.names ?? []).find((n) => n.submitted)?.name ?? record.name,
        trailing: `Suffix: ${m.suffix}`,
        source: '',
        sources: withWebsite(record, (record.names ?? []).find((n) => n.submitted)?.name ?? record.name),
        submitted: true,
        evidenceOnly: true
      },
      {
        group: 'formation',
        label: 'Entity type',
        value: entityFormLabel(trueEntityType(record) ?? filing?.entityType ?? record.formation?.entityType) ?? m.filed,
        source: '',
        registrations: filing ? [filing] : undefined,
        ...corroboration(record, 'entityType', filing?.entityType),
        evidenceOnly: true
      }
    ]
  }

  if (key === 'former_formation') {
    const c = convertedFormationOf(record)
    return c ? currentDomesticRows(record, c.formed, true).map((r) => ({ ...r, evidenceOnly: true })) : []
  }

  /*
   * The domestic filing on a linked record (`domesticFilingOf`): the filing,
   * and what ties the two records — the name this one also goes by, and the
   * addresses and people they share.
   */
  if (key === 'linked_domestic') {
    const link = domesticFilingOf(record)?.linked
    if (!link) return []
    return [
      {
        group: 'registration',
        label: 'Related business',
        value: link.filing.name ?? '',
        source: '',
        registrations: [link.filing],
        trailing: `Domestic filing${link.filing.fileNumber ? ` #${link.filing.fileNumber}` : ''} · on a linked record`,
        evidenceOnly: true,
        matchValue: `linked-filing:${link.filing.state}:${link.filing.fileNumber ?? ''}`
      },
      { group: 'name', label: 'Also goes by', value: link.name, source: '', evidenceOnly: true },
      ...link.addresses.map((a) => ({ group: 'address' as const, label: 'Shared address', value: a, source: '', evidenceOnly: true })),
      ...link.people.map((p) => ({ group: 'people' as const, label: 'Shared person', value: p, source: '', evidenceOnly: true }))
    ]
  }

  if (key === 'dba_name') {
    const dba = (record.names ?? []).filter((n) => n.type === 'dba' && n.submitted)
    return [
      ...(dba.length
        ? dba.map((n) => ({
            label: 'DBA',
            value: n.name,
            source: '',
            sources: withWebsite(record, n.name, provenanceList(n)),
            submitted: n.submitted,
            domesticOnly: (n.sources ?? []).some((x) => REGISTRATION_SOURCES.has(x))
          }))
        : [{ label: 'DBA', value: 'None submitted', source: '' }])
    ]
  }

  // --- Addresses -----------------------------------------------------------
  // Every address check is about the SUBMITTED address. PricewaterhouseCoopers
  // has 81 addresses and one submitted; showing all of them buried the subject.
  // Only the addresses the insight is about — the ones beyond the boundary.
  // Every address with its distance would have listed the submitted address
  // against itself and eight that are fine.
  if (key === 'address_proximity') {
    const submitted = addresses.find((a) => a.submitted)
    if (!submitted)
      return [{ group: 'address', label: 'Address', value: 'None submitted', source: '' }]
    const measured = addresses.filter(
      (a) => a !== submitted && milesBetween(a, submitted) !== undefined
    )
    const far = measured.filter((a) => (milesBetween(a, submitted) as number) > PROXIMITY_MILES)
    // The ones beyond the boundary where there are any; otherwise every
    // distance, so "all within 0.2 mi" is shown rather than asserted.
    return inGroup(
      'address',
      (far.length > 0 ? far : measured).map((a) => addressRow(a, 'proximity', submitted))
    )
  }

  // The submitted address alone. `nameTheFiling` resolves the registrations
  // that list it, so the chip beside it IS the verification — the filings that
  // carry this address are what the check matched against.
  if (key === 'address_verification')
    return inGroup('address', addressRows(record, { submittedOnly: true }))

  // The address the check is actually about, and what USPS said of it. The
  // statement alone says an address is deliverable without saying which, and
  // the record holds ten.
  if (key === 'address_deliverability') {
    // Every submitted address: the customer may give more than one office.
    const submitted = addresses.filter((a) => a.submitted)
    if (submitted.length === 0)
      return [{ group: 'address', label: 'Address', value: 'None submitted', source: '' }]
    // Deliverability is USPS's answer, not the registry's — the address may be
    // on a filing, but no filing says it can be posted to.
    return submitted.map((a) => {
      const row = addressRow(a, 'deliverability')
      return { ...row, source: USPS, sources: [...new Set([...(row.sources ?? []), USPS])] }
    })
  }

  // The submitted addresses and their property types — the addresses the
  // check is about. It used to list every address on the record with a type,
  // the registered agent's included, under a statement about the submitted one.
  if (key === 'address_property_type') {
    // Only the addresses that ARE what the statement says. "Submitted office
    // address is a commercial property" evidenced by a residential one states
    // the opposite of the check.
    const said = record.reviewTasks.find((t) => t.key === key)?.subLabel?.toLowerCase()
    const submitted = addresses.filter(
      (a) => a.submitted && a.propertyType && (!said || a.propertyType.toLowerCase() === said)
    )
    if (submitted.length === 0)
      return [{ group: 'address', label: 'Address', value: 'None submitted', source: '' }]
    return inGroup('address', submitted.map((a) => addressRow(a, 'property')))
  }

  // Only the ones that ARE mail drops. A CMRA row against an address that is
  // not one states the opposite of the check.
  if (key === 'address_cmra')
    return inGroup('address', addresses.filter((a) => a.cmra).map((a) => addressRow(a, 'cmra')))

  // Only an address that IS one. The check asks who the registered agent of
  // record is; falling through to the `address_` catch-all answered it with
  // the submitted office, which is the one address that is not the answer.
  if (key === 'address_registered_agent')
    return inGroup(
      'address',
      addresses
        .filter((a) => a.isRegisteredAgent || a.labels.includes('registered_agent'))
        .map((a) => addressRow(a))
    )

  if (key.startsWith('address_')) return inGroup('address', addressRows(record, { submittedOnly: true }))

  // --- Registrations -------------------------------------------------------
  //
  // Each check is about particular filings, so it evidences those and not the
  // whole registry picture. Every sos_* insight used to return all five
  // registrations plus the formation fields, so "Inactive in some states" and
  // "Good-standing sub-status not published" were backed by identical rows and
  // neither one showed you the filing it was talking about.
  if (key.startsWith('sos_') || key.startsWith('registrations') || key === 'submitted_registrations_match') {
    // The formation filing itself, not every filing in the formation state:
    // Andytown's California foreign filing is foreign, not its home filing.
    const formationFiling = formationFilingOf(record)
    const domestic = formationFiling ? [formationFiling] : []
    const byStatus = (status: string) =>
      record.registrations.filter((r) => (r.status || 'unknown').toLowerCase() === status)
    // The submitted office: submitted, and not the registered agent's address.
    const officeAddresses = addresses.filter(
      (a) => a.submitted && !a.isRegisteredAgent && !a.labels.includes('registered_agent')
    )
    const matchSaid = record.reviewTasks.find((t) => t.key === 'sos_match')?.subLabel ?? ''

    const filings =
      key === 'sos_active'
        ? byStatus('active')
        : key === 'sos_inactive'
          ? byStatus('inactive')
          : key === 'sos_unknown'
            ? byStatus('unknown')
            : key === 'sos_match'
              ? // The filings in the OFFICE address's state — the registered
                // agent's address is submitted too, but it is not the office,
                // and Checkr's Utah agent pulled two Utah filings, one inactive,
                // under a statement about California. Where the check says
                // Active, only the active filings there evidence it.
                record.registrations.filter(
                  (r) =>
                    officeAddresses.some((a) => a.state === r.state) &&
                    (!/active/i.test(matchSaid) || /^active$/i.test(r.status ?? ''))
                )
              : record.registrations

    // The domestic checks evidence the formation filing, and the formation rows
    // already are that filing read out — routing them through the foreign-filing
    // shape would have shown Delaware under a heading saying foreign.
    const noDomestic = [
      { group: 'formation' as const, label: 'Domestic registration', value: 'None on the record', source: '' }
    ]

    // The standing check is about one field, so it shows that field: the state
    // whose registry was asked, and what it answered. The entity type, the
    // formation date and the file number are the same five rows every other
    // formation check shows and none of them bear on standing.
    //
    // The absent value is the finding, so the row is emitted empty rather than
    // dropped — `formationRows` omits a field the filing does not state, which
    // left the one check about a missing value with no sign of what was
    // missing. It says why it is empty in words: an em dash is a value nobody
    // can read, and it left the reader to infer the reason from the statement
    // above. This cell is now the only place the reason is stated — the gap's
    // own prose no longer carries it, see AnalysisPanel's `SectionBody`.
    if (key === 'sos_domestic_sub_status') {
      if (domestic.length === 0) return noDomestic
      const rows = formationRows(record)

      return [
        ...rows.filter((r) => r.label === 'Formation state'),
        ...(rows.filter((r) => r.label === 'Sub status').length
          ? rows.filter((r) => r.label === 'Sub status')
          : [
              {
                group: 'formation' as const,
                label: 'Sub status',
                value: NOT_PROVIDED,
                source: REGISTRY,
                evidenceOnly: true,
                domesticOnly: true
              }
            ])
      ]
    }

    if (key === 'sos_domestic') return domestic.length > 0 ? formationRows(record) : noDomestic

    // A status check is answered by the status and, where the state publishes
    // one, the sub-status that says why. A file number and a registration date
    // identify the filing; they do not bear on whether it is inactive.
    const STATUS_KEYS = new Set(['sos_active', 'sos_inactive', 'sos_unknown', 'sos_match'])

    // A status check counts EVERY filing, the domestic one included — "1 of 1
    // filings are active" is about that one filing, and dropping it left a
    // company with a single domestic registration evidencing its status check
    // with nothing at all. Its rows are evidence only; the Attributes tab reads
    // the foreign filings from the plain registration rows below.
    const rowsFor = (list: BusinessRecord['registrations']) =>
      list.length ? registrationRowsFor(list) : []

    // The match is between two things, so it evidences both: the address the
    // customer gave us, and the filing in that address's state. Neither alone
    // is the finding — "Active" says nothing about which state, and the address
    // says nothing about what was found there.
    if (key === 'sos_match')
      return [
        // What the registry answered — the filing state and its status, side
        // by side — then the submitted addresses it was asked about, each on
        // its own row.
        ...inGroup(
          'registration',
          filings.flatMap((r) => [
            {
              label: 'Filing state',
              value: stateLabel(r.state) ?? 'Unknown',
              source: '',
              evidenceOnly: true,
              matchValue: `Filing state:${r.state ?? ''}`,
              registrations: [r]
            },
            ...(r.status
              ? [
                  {
                    label: 'Status',
                    value: sentence(r.status) as string,
                    source: '',
                    evidenceOnly: true,
                    matchValue: `Status:${r.status}`,
                    registrations: [r]
                  }
                ]
              : [])
          ])
        ),
        ...inGroup('address', addressRows(record, { submittedOnly: true }))
          // The office addresses the check asked about, not the agent's.
          .filter((r) => officeAddresses.some((a) => nameKey(a.fullAddress) === nameKey(r.matchValue ?? r.value)))
          .map((r) => ({ ...r, span: 'full' as const }))
      ]

    if (STATUS_KEYS.has(key)) {
      // Which kind of filing each status is on: the Formation card answers
      // what the foreign registrations are, and "Status" alone did not say.
      const kind = (label: string, which: 'Domestic' | 'Foreign') => `${which} filing ${label.toLowerCase()}`
      // By each filing's own jurisdiction. The formation filing stays out of the
      // Attributes tab, where the formation rows already state its status.
      const isDomestic = (r: BusinessRecord['registrations'][number]) => /domestic/i.test(r.jurisdiction ?? '')
      // Evidence only: the Attributes tab lists the foreign filings once, from
      // the plain registration rows, and relabelled copies of the same statuses
      // put "Foreign filing status: Active" beside "Status: Active".
      const statusRows = (list: BusinessRecord['registrations'], which: 'Domestic' | 'Foreign') =>
        rowsFor(list)
          .filter((r) => r.label === 'Status' || r.label === 'Sub status')
          .map((r) => ({ ...r, label: kind(r.label, which), evidenceOnly: true }))
      const rows = [
        ...statusRows(filings.filter((r) => !isDomestic(r)), 'Foreign'),
        ...statusRows(filings.filter((r) => isDomestic(r)), 'Domestic')
      ]

      return inGroup('registration', rows.length > 0 ? rows : rowsFor(filings))
    }

    // The foreign filings, by each filing's own jurisdiction: the Attributes
    // tab's group is "Foreign registrations", and a second domestic filing
    // (Checkr's Utah one) is the Formation card's to show, in its filing rows.
    const foreignOnly = filings.filter((r) => /foreign/i.test(r.jurisdiction ?? ''))
    return inGroup('registration', foreignOnly.length ? registrationRowsFor(foreignOnly) : [])
  }

  /**
   * One row per entity type stated, with the filings stating it.
   *
   * Agreement collapses to a single row with five sources; disagreement shows
   * as two rows, and which filing said what is the whole finding. Filings that
   * state nothing get their own row rather than being absent — silence from a
   * state is not the same as a state that was never asked.
   */
  if (key === 'entity_type_agreement' || key === 'entity_type_foreign') {
    const scope =
      key === 'entity_type_foreign'
        ? record.registrations.filter((r) => r.state !== record.formation?.state)
        : record.registrations

    const byType = new Map<string, BusinessRecord['registrations']>()
    for (const r of scope) {
      const type = r.entityType
        ? entityFormLabel(r.entityType.toUpperCase())
        : 'Not stated on the filing'
      byType.set(type, [...(byType.get(type) ?? []), r])
    }

    return [...byType.entries()].map(([type, filings]) => ({
      group: 'formation' as const,
      label: 'Entity type',
      value: type,
      matchValue: `Entity type:${type}`,
      source: '',
      registrations: filings
    }))
  }

  // Its own field, nothing else. "Entity type confirmed against a registration"
  // was evidenced by the formation state and date as well, neither of which the
  // statement mentions.
  if (key === 'entity_type')
    return inGroup('name', formationRows(record).filter((r) => r.label === 'Entity type'))

  if (key === 'formation_state')
    return inGroup('name', formationRows(record).filter((r) => r.label === 'Formation state'))

  // --- People --------------------------------------------------------------
  if (key === 'person_verification') {
    // Only the people the customer submitted, once each. The insight is
    // whether THEY matched a filing, so its evidence is each of them and the
    // filings that name them — not every officer, agent and Form 5500 name on
    // the record, which is the People attribute's roll. The roles the filings
    // give them are the reading of the match, under the name, deduplicated
    // across the spellings the filings use: seven rows for one CEO said the
    // same thing seven times.
    return submittedPeople.map((p) => {
      // The filings spell one role several ways — "Ceo", "Chief executive",
      // "Chief executive officer", "Ceo chief executive officer" — and read
      // out together they are noise, not roles. A title whose words are all
      // inside another title's is that title; the bare "Officer" says nothing
      // a named role does not.
      const roles = [...new Set(p.titles.map(canonicalRole).filter(Boolean))].filter(
        (t, _, all) => all.length === 1 || t !== 'Officer'
      )
      return {
        group: 'people' as const,
        label: 'Person',
        value: p.name,
        source: '',
        sources: provenanceList(p),
        submitted: true,
        refs: p.sourceRefs,
        matchOn: 'officer' as const,
        matchValue: p.name,
        evidenceNote: roles.length > 0 ? roles.join(' · ') : 'No role on the filings'
      }
    })
  }

  // --- Screening -----------------------------------------------------------
  // What was screened, not what it was screened against. The list of every
  // watchlist a provider covers is the same on every record and says nothing
  // about this business; who was put through it does.
  //
  // Which list matched only exists once something matches, and the record does
  // not carry it — so on a hit the provider's own message is shown rather than
  // a list picked from the coverage constant.
  if (key === 'watchlist' || key === 'politically_exposed_persons' || key === 'adverse_media') {
    // Screening does not stop at the people the customer named. Anyone found on
    // the record goes through it too, and the record says who: a person carries
    // the screen's own result key among their sources. Listing only submitted
    // people understated the coverage — Middesk's Form 5500 turns up a person
    // the customer never mentioned, and adverse media screened them.
    const screenedBy = SCREEN_SOURCE[key]
    const screened = record.people.filter(
      (p) => p.submitted || (p.sources ?? []).includes(screenedBy)
    )

    // The entity is screened under every name it is known by, not only the one
    // the customer typed. Deduped across spellings so a registry variant does
    // not read as a second entity going through the screen.
    // Submitted spelling wins the collapse — the customer's own rendering of
    // the name is the one they will recognise, not the registry's compaction.
    const entityNames = [
      ...(record.names ?? [])
        .filter((n) => n.type !== 'dba')
        .sort((a, b) => Number(b.submitted) - Number(a.submitted))
        .reduce((seen, n) => (seen.has(nameKey(n.name)) ? seen : seen.set(nameKey(n.name), n)), new Map<string, (typeof record.names)[number]>())
        .values()
    ]
    const names = entityNames.length > 0 ? entityNames : [{ name: record.name, submitted: true, sources: [] }]


    /**
     * What was SEARCHED, not where the name came from.
     *
     * A clean screen is only meaningful if you can see its scope. The record
     * carries the lists and the agency behind each one, and a hit carries the
     * agency page it sits on — so a match can be opened rather than taken on
     * trust, and "no hits" can be scoped rather than believed.
     */
    /**
     * The articles a given name pulled in.
     *
     * A person carries the screening result's id among their sources, so the
     * match is attributable: these articles came up for THIS name. Listed
     * separately they were a pile of headlines with no indication of whose name
     * produced them — and "Crime Stoppers: Kyle Mack Murder" reads very
     * differently as an anonymous hit than as a false positive on a director's
     * name.
     */
    const refIds = (item: { sourceRefs?: SourceRef[] } | { sources?: string[] }, type: string) =>
      (('sourceRefs' in item ? item.sourceRefs : undefined) ?? [])
        .filter((r) => r.type === type)
        .map((r) => r.id)

    /** Every screen works the same way: the result's id is on the name that
     *  matched it, so a hit can be shown against that name and linked to the
     *  list or article it sits on. */
    type Match = {
      label: string
      title?: string
      url?: string
      /** A watchlist result's verdict — false when it only collides with a name. */
      valid?: boolean
      note?: string
      risks?: Array<{ name: string; confidence: string | null }>
      /** The agency keeping a watchlist, apart from the list itself. */
      agency?: string
    }

    const matchesFor = (item: { sourceRefs?: SourceRef[] } | { sources?: string[] }): Match[] => {
      if (key === 'adverse_media') {
        const ids = refIds(item, 'adverse_media_screening_result')
        return (record.adverseMedia?.results ?? [])
          .filter((r) => ids.includes(r.id))
          .flatMap((r) => r.items)
          .map((a) => ({
            label: a.sourceName ?? 'Adverse media',
            title: a.title ?? undefined,
            url: a.url ?? undefined,
            risks: a.risks
          }))
      }

      if (key === 'watchlist') {
        const ids = refIds(item, 'watchlist_result')
        return (record.watchlist?.lists ?? []).flatMap((l) =>
          (l.results ?? [])
            .filter((r) => ids.includes(r.id))
            // The list it is on, linked to the agency's own page for it.
            .map((r) => {
              const v = judgeHit(record, r)
              return {
                // The list, as the chip's text; the agency that keeps it is its
                // own field, in the chip's preview — not joined to the list.
                label: l.abbr ?? l.title ?? 'Watchlist',
                agency: l.agencyAbbr ?? undefined,
                title: r.entityName ?? undefined,
                url: r.url ?? undefined,
                // Said on the hit itself: a returned name is not a match until it
                // names someone on the record — see watchlist.ts.
                note: v.valid ? `matches ${v.matchedTo}` : `not a match — ${v.reason}`,
                valid: v.valid
              }
            })
        )
      }

      const ids = refIds(item, 'politically_exposed_person_result')
      return (record.pep?.results ?? [])
        .filter((r) => ids.includes(r.id))
        .map((r) => ({ label: r.name ?? 'PEP match', url: r.url ?? undefined }))
    }

    const searched: AttributeRow[] =
      key === 'watchlist'
        ? []
        : key === 'adverse_media'
          ? [] // Adverse media hangs off the name it matched, not on its own.
          : key === 'politically_exposed_persons'
            ? (record.pep?.results ?? []).map((r) => ({
                label: 'Match',
                value: r.name ?? 'Unnamed',
                href: r.url ?? undefined,
                source: 'PEP provider',
                sources: ['PEP provider']
              }))
            : []

    const built = [...names, ...screened].flatMap((item) => {
        const articles = matchesFor(item)
        // Per name, not per check: one director can come back clean while
        // another pulls in four articles, and a single outcome across the whole
        // screen hid exactly that.
        const found = articles.length > 0

        const row: AttributeRow = {
          // Evidence for the screening insight, not an attribute of the
          // business. The names are already in Name and People; repeating them
          // under Watchlist, PEP and Adverse media added three groups that held
          // nothing the record did not already say, and what the screen
          // RETURNED is the insight, not a fact about the company.
          detail: true,
          // Which screen this is. All three checks used the one word
          // "Screened", so a section citing watchlist, adverse media and PEP
          // produced four rows with the same label and a reader could not tell
          // what any of them had been run against.
          label:
            key === 'watchlist'
              ? 'Watchlist and sanctions'
              : key === 'adverse_media'
                ? 'Adverse media'
                : key === 'politically_exposed_persons'
                  ? 'Politically exposed persons'
                  : 'Screened',
          value: `${item.name}${
            found
              ? articles.every((a) => a.valid === false)
                ? ` — returned ${[...new Set(articles.map((a) => a.title).filter(Boolean))].join(', ')}, not a match`
                : ''
              : ''
          }`,
          source: '',
          // On a hit, the list or article it matched. On a clean name, nothing:
          // "no hits" already says every list came back empty, and naming all
          // fourteen under each name repeated the same thing three times over
          // without changing what a reader does next.
          sources: [],
          // Each article addressable on its own, with the risks the provider
          // attached to it. Flattened into detail rows underneath, four names
          // became twenty lines and the names they belonged to were lost in
          // them — the thing the reader is scanning for.
          links: found
            ? articles.map((a) => ({
                label: a.label,
                title: a.title,
                url: a.url,
                note:
                  a.note ??
                  (a.risks?.length ? [...new Set(a.risks.map((r) => r.name.replace(/_/g, ' ')))].join(', ') : undefined),
                agency: a.agency
              }))
            : undefined,
          // What the media is, under the name: how many items, the tags the
          // provider put on them (its labels, no confidence words), and whether
          // any headline names the business. The articles themselves are the
          // chip; this is what a reader gets without opening nineteen of them.
          fields:
            key === 'adverse_media' && found
              ? [
                  {
                    value: [
                      `${articles.length} ${articles.length === 1 ? 'item' : 'items'}`,
                      ...new Set(articles.flatMap((a) => (a.risks ?? []).map((r) => r.name.replace(/_/g, ' '))))
                    ].join(' · ')
                  },
                  ...(articles.some((a) => nameKey(a.title ?? '').includes(nameKey(record.name)))
                    ? []
                    : [{ value: 'None names the business' }])
                ]
              : undefined,
          // No Submitted chip on a screening row. Whether the customer gave us
          // the name is a fact about the name, and it lives on the name's own
          // attribute; here the only question is what the screen ran against
          // and what it returned.
          submitted: false
        }

      /* A screen that returned only close matches, none of them valid — the
         row under "No valid watchlist hits". Each screened name is its own entry, not a
         line folded into the one above: the name screened, what the list
         returned for it, and that it is a close match and not a valid one. */
      const invalidOnly = found && articles.every((a) => a.valid === false)
      if (invalidOnly)
        return [
          {
            name: item.name,
            found,
            row: {
              ...row,
              detail: undefined,
              evidenceOnly: true,
              label: item.name,
              value: [...new Set(articles.map((a) => a.title).filter(Boolean))].join(', '),
              trailing: 'Close match, not a valid match',
              span: 'half' as const
            }
          }
        ]
      // Adverse media: each name its own cell, two to a row — what the screen
      // returned for one person beside what it returned for the next, rather
      // than the second name folded under the first as a detail line.
      if (key === 'adverse_media' && found)
        return [{ name: item.name, found, row: { ...row, detail: undefined, span: 'half' as const } }]
      return [{ name: item.name, found, row }]
    })

    /*
     * Only the names that came back. A name screened clean is only what was
     * checked — listed under "No hits" it read as though something was found
     * for it. A name that did come back keeps its own row, with the articles
     * and the provider's rating: the one result a reader has to act on.
     */
    return [...built.filter((b) => b.found).map((b) => b.row), ...searched]
  }

  /**
   * Court records, lien filings and bankruptcy petitions.
   *
   * These used to return the business name and nothing else, because the pull
   * dropped the documents themselves — so "10 related litigations" was the
   * whole of what the record held and there was nothing for a reader to read.
   * Each row is now one document, carrying the source that issued it: the court
   * that heard the case, the state office the lien is filed with. That is what
   * puts them in the Sources tab beside the registries.
   *
   * The rows state what the filing says and stop there. Whether a foreclosure
   * naming the business among fifteen defendants bears on the account is the
   * assessment's call, not a label here.
   */
  if (key === 'litigations') {
    const cases = record.litigations ?? []
    // None found: nothing to open. The business name and person were only
    // what was searched, and read as though something came back.
    if (cases.length === 0) return []

    return cases.map((c) => {
      // The court is the source. Without it nine Georgia cases and one in
      // Queens read as one undifferentiated pile of litigation.
      const court = c.court ?? (c.courtState ? `${c.courtState} courts` : 'Court record')
      const source = `Court record · ${court}`
      // Money actually awarded, where a docket entry carries an amount. Most
      // carry none, and a judgment line with no sum is a filing rather than a
      // debt.
      const awarded = c.judgments.reduce((n, j) => n + (j.amountCents ?? 0), 0)

      const caseType = c.caseType && c.caseType.toUpperCase() !== 'UNKNOWN' ? c.caseType : undefined
      const caseNo = c.caseNumber ? `Case ${c.caseNumber}` : undefined
      const party = c.partyType && c.partyType !== 'UNKNOWN' ? (sentence(c.partyType) ?? c.partyType) : undefined

      return {
        group: 'litigation' as const,
        // What kind of case; the court that heard it is the source chip. The
        // court's own "UNKNOWN" is not a case type.
        label: caseType ?? 'Case',
        // Who is involved is the title; the case's status, number, parties, the
        // business's role and the filing date are its metadata line. One
        // record, one full row.
        value: c.caseName ?? 'Unnamed case',
        span: 'full' as const,
        meta: [
          statusWord(c.caseStatus),
          caseNo,
          c.parties.length > 0 ? `${c.parties.length} ${c.parties.length === 1 ? 'party' : 'parties'}` : undefined,
          party,
          shortDate(c.filingDate)
        ].filter((x): x is string => Boolean(x)),
        fields: awarded > 0 ? [{ label: 'Awarded', value: money(awarded) }] : undefined,
        source,
        sources: [source]
      }
    })
  }

  if (key === 'liens') {
    const filings = record.liens ?? []
    if (filings.length === 0) return []

    return filings.map((l) => {
      // The filing office, per state: a UCC-1 in Idaho and one in New Jersey
      // are held by different offices and searched separately.
      const source = `Lien · ${l.state ? stateName(l.state) : 'Unknown state'}`
      const amount = l.liabilityCents ?? l.loanPrincipalCents

      return {
        group: 'liens' as const,
        label: LIEN_KIND[(l.type ?? '').toLowerCase()] ?? 'Lien',
        // The secured party is the readable identity of a lien — "THREE NOTCH'D
        // BREWING COMPANY LLC" says more than a file number does.
        value: l.securedParties.map((p) => p.name).join(', ') || 'Secured party not stated',
        // Who is involved is the title; the lien's status, file number and filing
        // date are its metadata line. One record, one full row.
        span: 'full' as const,
        meta: [
          statusWord(l.status),
          // The label already says what kind of lien; the ID is its file number.
          l.fileNumber ? `File ${l.fileNumber}` : undefined,
          shortDate(l.filingDate)
        ].filter((x): x is string => Boolean(x)),
        evidenceFields: [
          ...(l.collateral ? [{ label: 'Collateral', value: l.collateral }] : []),
          ...(amount ? [{ label: 'Amount', value: money(amount) }] : []),
          ...(l.lapseDate ? [{ label: 'Lapse date', value: l.lapseDate }] : [])
        ],
        // The filing office's own page for this lien.
        href: l.url ?? undefined,
        source,
        sources: [source]
      }
    })
  }

  if (key === 'bankruptcies') {
    const filings = record.bankruptcies ?? []
    if (filings.length === 0) return []

    return filings.map((b) => {
      const court = b.court ?? (b.courtState ? `${b.courtState} courts` : 'Bankruptcy court')
      const source = `Bankruptcy court · ${court}`
      return {
        group: 'bankruptcy' as const,
        label: b.chapter ? `Chapter ${b.chapter}` : 'Petition',
        // The court is who is involved; status, case number and filing date are
        // the metadata line.
        value: court,
        span: 'full' as const,
        meta: [statusWord(b.status), b.caseNumber ? `Case ${b.caseNumber}` : undefined, shortDate(b.filingDate)].filter(
          (x): x is string => Boolean(x)
        ),
        source,
        sources: [source]
      }
    })
  }

  // --- Web and profiles ----------------------------------------------------
  // Web litigation is litigation found on the web, not the website: the record
  // holds none, so it has nothing to show. The website branch below caught it
  // by prefix and filed "Website: None on the record" under Litigation.
  if (key === 'web_litigation') return []

  if (key.startsWith('web') || key === 'website_status' || key === 'website_url_discovery' || key === 'website_url_domain_ownership') {
    const w = record.website
    if (!w?.url) return [{ label: 'Website', value: 'None on the record', source: '' }]

    /**
     * Only what answers THIS check.
     *
     * Every web_* and website_* insight returned the whole crawl — url, title,
     * platform, domain, registrar, both emails and all eight pages — so
     * "Website is reachable" and "Domain registrant corroborates the business"
     * were backed by identical evidence and neither showed the field it rests
     * on. Twenty rows that answer nothing is worse than three that do.
     */
    const site = (label: string, value: string | null | undefined, href?: string): AttributeRow[] =>
      value
        ? [
            {
              group: 'website' as const,
              label,
              value,
              href: href ?? w.url ?? undefined,
              source: 'Website',
              sources: ['Website']
            }
          ]
        : []

    const url = {
      group: 'website' as const,
      label: 'Website',
      value: w.url,
      href: w.url,
      source: 'Website',
      sources: ['Website'],
      submitted: w.submitted,
      // Whose site it is is part of what a website check shows.
      trailing: w.submitted ? undefined : 'Found by Middesk, not submitted'
    }

    // Reachability: the URL and what the site calls itself. The individual page
    // URLs the crawl walked are the same domain with a path on the end — they
    // restate the URL above them rather than adding to it.
    if (key === 'website_status') return [url, ...site('Title', w.title)]

    // Who owns the domain. The registrar, the WHOIS dates and the registry's
    // own domain id are plumbing — they say who sold the name and when the
    // record was minted, which is not a fact about this business.
    if (key === 'website_url_domain_ownership') return [...site('Domain', w.domain)]

    // Where the URL came from.
    if (key === 'website_url_discovery') return [url]

    // What the site says the business is called, against the name on file.
    if (key === 'web_business_name_verification') return [url, ...site('Title', w.title)]

    // The contact details the crawl lifted, each with its own provenance.
    if (key === 'web_email_address_verification')
      return [
        url,
        ...(w.emails ?? []).map((e) => ({
          group: 'website' as const,
          label: 'Email address',
          value: e.email,
          source: '',
          sources: contactSources(e.sourceRefs, w.id),
          submitted: e.submitted,
          href: profileUrl(e.sourceRefs),
          refs: e.sourceRefs
        }))
      ]

    if (key === 'web_phone_number_verification')
      return [
        url,
        ...(w.phones ?? []).map((n) => ({
          group: 'website' as const,
          label: 'Phone number',
          value: n.phone,
          source: '',
          sources: contactSources(n.sourceRefs, w.id),
          submitted: n.submitted,
          href: profileUrl(n.sourceRefs),
          refs: n.sourceRefs
        }))
      ]

    return [
      url,
      ...(key === 'web_address_verification' ? inGroup('address', addressRows(record, { submittedOnly: true })) : []),
      /* The submitted people, and — where the check verified one and there is
         only one it can be — the website as the source that names them, so
         the row does not read as the filing check's. The record does not say
         which person the site named, so with several none is marked: Andytown's
         registered-agent company read "Named on the website". No page is
         claimed either. */
      ...(key === 'web_person_verification'
        ? peopleRow(submittedPeople, 'Submitted person').map((p) =>
            submittedPeople.length === 1 && /^verified$/i.test(record.reviewTasks.find((t) => t.key === key)?.subLabel ?? '')
              ? { ...p, source: 'Website', sources: ['Website'], refs: undefined, trailing: 'Named on the website' }
              : p
          )
        : [])
    ]
  }

  if (key.startsWith('profile')) {
    // One page, one row. The API returns two records for the same Google
    // listing with different ids, and both rendered — the reader counted seven
    // profiles where the business has six.
    const all = [
      ...new Map(
        (record.profiles ?? []).map((p) => [p.url ?? p.type ?? '', p] as const)
      ).values()
    ]

    // Each check its own subset, and discovery by its own outcome: "Third
    // party profiles submitted" is the ones the customer named, "found" is the
    // ones Middesk found. Filtering "found" to the submitted ones showed
    // Userleap's Trustpilot page as "None supplied by the customer".
    const submittedOnly = /^submitted$/i.test(record.reviewTasks.find((t) => t.key === 'profile_discovery')?.subLabel ?? '')
    const profiles =
      key === 'profile_discovery'
        ? all.filter((p) => (submittedOnly ? p.submitted : true))
        : key === 'profile_status'
          ? all.filter((p) => p.status)
          : all

    return [
      ...(profiles.length
        ? profiles.map((p) => ({
            // The site alone: the group is already Third-party profiles.
            label: p.type ? profileName(p.type) : 'Profile',
            // The page's own name for the business. The link itself is the
            // Sources card's to show (`pageUrl`); here the one chip says where
            // the profiles are kept.
            value: p.name ?? record.name,
            pageUrl: p.url ?? undefined,
            profileType: p.type ?? undefined,
            source: '',
            sources: ['Third-party profiles'],
            // The customer named this page. The record has said so all along —
            // `profile_discovery` filters on exactly this flag — but the row
            // dropped it, so the one profile the customer gave us read like the
            // five we went and found.
            submitted: p.submitted || undefined,
            // Who the profile is for. We do not hold the page's own <title>,
            // and the subject is the useful headline anyway — the host is
            // already the byline and the URL is the line beneath.
            sourceTitle: record.name,
            sourceNote: p.status
              ? `${p.status.charAt(0).toUpperCase()}${p.status.slice(1)}`
              : 'Status not stated',
            // What the page says, as the dashboard's Third-party profiles card
            // reads it (`ThirdPartyProfilesCard`): its flags, its ratings, its
            // page details and its latest activity — each on its own line.
            fields: profileFields(p)
          }))
        : [
            {
              label: 'Profiles',
              value:
                key === 'profile_discovery'
                  ? 'None supplied by the customer'
                  : 'None on the record',
              source: ''
            }
          ])
    ]
  }

  // --- Industry ------------------------------------------------------------
  // Only `industry`. Risky-keyword screening is a different check against
  // different data, and attaching the classification list to it as well showed
  // the same six rows under two insights.
  if (key === 'industry') {
    const industry = record.industry ?? []
    if (industry.length === 0)
      return [{ label: 'Industry classification', value: 'None on the record', source: '' }]

    /**
     * One source, four rows.
     *
     * NAICS, SIC and MCC are code schemes for the same classification, not
     * separate sources — the API returns all three inside one category, which
     * is why SIC never appeared while `classification_system` was being read as
     * the scheme. As separate source cards they implied three bodies of
     * evidence where there is one.
     *
     * The code is the classification: "Custom Computer Programming Services"
     * without 541511 is the half a reviewer cannot look up or match a policy
     * against.
     */
    // One row per classification: the scheme as the label, the category as the
    // value, its code(s) in `lead` and the classifier's confidence in
    // `trailing`. `IndustryTable` draws them as the dashboard's
    // IndustryClassificationCard does — a row per scheme, each code, category
    // and confidence lined up across it.
    const confidence = (score?: number | null) =>
      typeof score === 'number' ? `${Math.round(score * 100)}%` : undefined
    const SCHEMES = [
      ['NAICS', 'naicsCodes'],
      ['SIC', 'sicCodes'],
      ['MCC', 'mccCodes']
    ] as const

    const row = (label: string, name: string, code: string | undefined, score?: number | null): AttributeRow => ({
      label,
      value: name,
      lead: code,
      trailing: confidence(score),
      // No source chip: the classification is Middesk's reading of the business,
      // not a record anyone holds, so it cites none and has no Sources card.
      source: '',
      sources: []
    })

    // In the record's order within a scheme, as the dashboard lists them.
    const rows: AttributeRow[] = SCHEMES.flatMap(([scheme, field]) =>
      industry
        .filter((c) => c.name && (c[field] ?? []).length > 0)
        .map((c) => row(scheme, c.name as string, formatCodes(c[field] ?? []), c.score))
    )

    // No row for the Prohibited scheme. "High-Risk Businesses" at 0.95 is not
    // a classification of what the business does; it is Middesk's curated
    // risk rule over the classifications above — a judgment the brief puts
    // out of scope. The NAICS, MCC and SIC rows are the data; the customer
    // reads them against their own list.
    return rows
  }

  // --- Connections ---------------------------------------------------------
  // The counts and the shared-attribute breakdown are not on the record; only
  // the aggregate outcome is. Until that source is known, the evidence is the
  // attributes a connection could be matched on, and nothing implied beyond it.
  /*
   * The connected businesses, one node each.
   *
   * It used to return the officers and the first three addresses, so "2
   * connections found" was evidenced by three addresses and an officer, none of
   * which is a connection. The names come from `list_connections`, which the
   * review task does not carry; a record without them shows nothing rather
   * than something adjacent.
   */
  if (key === 'business_connections') return connectionRows(record)

  // --- Licences ------------------------------------------------------------
  //
  // `license:<id>`, and the two match checks derived beside it. The sentence
  // says a licence record is on file; the holder, the profession, the state
  // licence number and when the registry was last updated are what a reviewer
  // writes down, so they are cards rather than a parenthesis in the prose.
  if (key.startsWith('license')) {
    const id = rawKey.slice(rawKey.indexOf(':') + 1)
    const rows = licenseRows(record).filter((r) => r.refs?.some((ref) => ref.id === id))
    if (rows.length === 0) return []

    const only = (...labels: string[]) => rows.filter((r) => labels.includes(r.label))

    // The match checks evidence the match: the licence's side and the record's
    // side, together, so the reader can see what was compared.
    if (key === 'license_person_match')
      return [...only('Licence holder'), ...peopleRow(record.people.filter((p) => p.submitted), 'Person')]
    if (key === 'license_address_match')
      return [
        ...only('Practice address'),
        ...inGroup('address', addressRows(record, { submittedOnly: true }))
      ]

    return rows
  }

  // --- TIN -----------------------------------------------------------------
  // The submitted name first, then what the IRS holds against it. The match is
  // a match of two things, and it is read in the order the sentence states it:
  // this is the name the customer gave us, this is the number they gave us, and
  // this is the name the IRS has on that number. The legal name used to come
  // last, which put the thing being compared after both of its comparands.
  if (key === 'tin') return [nameRow, ...tinRows(record)]

  /*
   * Nothing, rather than the business name.
   *
   * This used to fall back to `nameRow`, so every check with no mapping was
   * evidenced by the legal name: `risky_keywords`, `operating_as_claimed`,
   * `complaint_themes` and the four person-level searches all produced
   * `Legal name: KAIROS PHYSICAL THERAPY PLLC`. In one section that was four
   * identical cards in a row, none of which answered the sentence above them.
   * A check with no attribute behind it has nothing to show.
   */
  return []
}

/**
 * Professional licences, from the registry that holds them.
 *
 * Not produced by an insight, because no review task reaches a licence. A
 * professional entity's members must be licensed in the profession it
 * practises — the entity form says so — and until the catalog has a check for
 * it, the registry record is the evidence, carried here so it is readable in
 * both tabs and citable as a source like any other.
 */
export const licenseRows = (record: BusinessRecord): AttributeRow[] => {
  const rows: AttributeRow[] = []

  for (const l of record.licenses ?? []) {
    const refs = [{ id: l.id, type: 'npi_registry', metadata: { url: l.sourceUrl ?? '' } }]
    const base = {
      group: 'licenses' as GroupId,
      source: l.registry,
      sources: [l.registry],
      refs,
      href: l.sourceUrl ?? undefined
    }

    // The holder and the credential are two fields of the licence.
    rows.push({ ...base, label: 'Licence holder', value: l.holder, matchValue: l.holder })
    if (l.credential) rows.push({ ...base, label: 'Credential', value: l.credential, matchValue: `credential:${l.credential}` })
    rows.push({ ...base, label: 'Profession',
      value: l.taxonomyCode ? `${l.profession} (${l.taxonomyCode})` : l.profession })
    if (l.licenseState && l.licenseNumber)
      rows.push({ ...base, label: 'State licence',
        value: `${l.licenseState} ${l.licenseNumber}`, matchValue: l.licenseNumber })
    rows.push({ ...base, label: `${l.registry} number`, value: l.number, matchValue: l.number })
    rows.push({ ...base, label: 'Licence status', value: l.status })
    if (l.enumeratedAt) rows.push({ ...base, label: 'Enumerated', value: l.enumeratedAt })
    if (l.lastUpdated) rows.push({ ...base, label: 'Registry last updated', value: l.lastUpdated })
    if (l.address) rows.push({ ...base, label: 'Practice address', value: l.address, matchValue: l.address })
    if (l.phone) rows.push({ ...base, label: 'Practice phone', value: l.phone, matchValue: l.phone })
  }

  return rows
}

/**
 * A city registration, read out of the city's own register.
 *
 * Middesk names a city registration only as the source of a name or an
 * address. The register itself says whose business it is, what it trades as,
 * its account and when it opened — Firebird Yarns is account 1089962, owned by
 * Kathryn Bernard, doing business as Firebird Yarns since July 9, 2018. One
 * business account can hold several locations and several DBAs over time
 * (Sprig's account 1080965 traded as Mixboard, Userleap, then Sprig), so the
 * rows are per account, each DBA its own row. Every row cites the Middesk
 * city_registration reference it stands behind, so the Sources tab files it
 * under the city registration and the Formation card reads it as that source.
 */
export const cityRegistrationRows = (record: BusinessRecord): AttributeRow[] => {
  const regs = record.cityRegistrations ?? []
  if (regs.length === 0) return []
  const byAccount = new Map<string, typeof regs>()
  for (const r of regs) {
    const k = r.accountNumber ?? r.locationId ?? r.address
    byAccount.set(k, [...(byAccount.get(k) ?? []), r])
  }
  const rows: AttributeRow[] = []
  for (const [account, list] of byAccount) {
    const first = list[0]
    const openHere = list.filter((r) => !r.locationEnd && !r.businessEnd)
    const open = openHere.length > 0
    const refs = [...new Set(list.map((r) => r.refId).filter((x): x is string => Boolean(x)))].map((id) => ({
      id,
      type: 'city_registration',
      metadata: { city: first.city, state: first.state, status: open ? 'Active' : 'Inactive' }
    }))
    const base = {
      source: 'City registration',
      sources: ['City registration'],
      refs,
      href: first.sourceUrl ?? undefined
    }
    rows.push({
      ...base,
      group: 'licenses' as GroupId,
      label: 'City business registration',
      value: `${first.city} · account ${account}`,
      matchValue: `city:${account}`
    })
    if (first.owner)
      rows.push({ ...base, group: 'people' as GroupId, label: 'Owner', value: first.owner, matchValue: first.owner })
    // One row per trade name, however the register punctuated it ("Sprig Technologies Inc" / "Inc.").
    const dbas = new Map<string, string>()
    for (const d of list.map((r) => r.dba).filter((d): d is string => Boolean(d)))
      if (!dbas.has(nameKey(d))) dbas.set(nameKey(d), d)
    for (const dba of dbas.values())
      rows.push({
        ...base,
        group: 'name' as GroupId,
        label: 'Doing business as',
        value: dba,
        sources: withWebsite(record, dba, base.sources),
        // The submitted name, when the register carries it: the same key as the
        // name row, so one name is one row carrying both sources.
        matchValue: sameName(dba, submittedNameOf(record)) ? `legal:${nameKey(submittedNameOf(record))}` : dba
      })
    if (first.businessStart)
      rows.push({
        ...base,
        group: 'licenses' as GroupId,
        label: 'Registered with the city',
        value: longDate(first.businessStart) ?? first.businessStart,
        qualifier: filingAge(first.businessStart) ?? undefined,
        matchValue: `city:${account}:start`
      })
    rows.push({
      ...base,
      group: 'licenses' as GroupId,
      label: 'City registration status',
      value: open
        ? list.length > 1
          ? `Open · ${openHere.length} of ${list.length} locations open`
          : 'Open'
        : `Closed${first.businessEnd ? ` ${longDate(first.businessEnd)}` : ''}`,
      matchValue: `city:${account}:status`
    })
  }
  return rows
}

/**
 * A value that says nothing was found — "None on the record", "Not held". It
 * is the absence a statement already states, not evidence for it and not an
 * attribute of the business, so neither an insight's evidence nor the
 * Attributes tab shows it.
 */
const PLACEHOLDER = /^(none on the record|none submitted|none supplied by the customer|none found|no hits|not held|no formation record)$/i
export const isPlaceholder = (value: string | null | undefined) => PLACEHOLDER.test((value ?? '').trim())

/**
 * The business name each of a row's sources carries: the record's name whose
 * own source list includes that source. For a source with no place — an SEC or
 * EPA record — this is what its entry is titled by. Nothing is inferred: a
 * source no name on the record cites gets no entry.
 */
export const withSourceNames = (record: BusinessRecord) => (row: AttributeRow): AttributeRow => {
  const names: Record<string, string> = {}
  for (const n of record.names ?? [])
    for (const ref of n.sourceRefs ?? []) {
      const label = sourceLabelOf(ref.type)
      if (!names[label]) names[label] = n.name
    }
  // The website is named by its address: "meroxa.com" over "Website".
  if (record.website?.url) names.Website = readableUrl(record.website.url)
  return Object.keys(names).length ? { ...row, sourceNames: names } : row
}

export const attributesFor = (rawKey: string, record: BusinessRecord): AttributeRow[] =>
  attributesForKey(rawKey, record).map(nameTheFiling(record)).map(withSourceNames(record))
