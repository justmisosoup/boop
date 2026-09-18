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
import { trueEntityType, type BusinessRecord, type SourceRef } from './deriveResults'
import type { GroupId } from './groups'
import { stateName } from './states'
import { frequencyBand } from './statements'

/** Cents as the filing states them. Whole dollars: a lien is never filed for
 *  $4,500.37 and the cents column is noise beside a case number. */
const money = (cents: number) =>
  `$${Math.round(cents / 100).toLocaleString('en-US')}`

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
   * Shown only when an insight is expanded, never as an attribute of its own.
   *
   * The individual articles behind an adverse-media match are the evidence FOR
   * that insight — they are not facts about the business the way an address or
   * a filing is, and listing fourteen of them in the Attributes tab buried the
   * four names they belong to.
   */
  detail?: boolean
  /**
   * Several distinct pages behind one row, each addressable on its own.
   *
   * `sources` plus a single `href` cannot express this: nine adverse-media
   * articles share one chip, and pointing all nine at the first article's URL
   * is worse than not linking them at all.
   */
  links?: Array<{ label: string; title?: string; url?: string; note?: string }>
  /** Replaces the chip's generic "Source" byline — reachability, a date, a note. */
  sourceNote?: string
  /** Headline for the chip's preview. Without it the URL is shown, which is the
   *  same string as the link beneath it. */
  sourceTitle?: string
}

const REGISTRY = 'State registration'
const SUBMITTED = 'Submitted by the customer'
const USPS = 'USPS'

/**
 * Provenance comes from the API or it is not shown.
 *
 * An earlier version of this file hard-coded a source per row — every address
 * was "State registration", every person likewise. That was invention: the API
 * marks each person and address with `submitted` and a `sources` array, and a
 * submitted person carrying an adverse-media source was being rendered as found
 * on state filings. Where the record supplies no provenance, this now says so
 * rather than filling it in.
 */
const NOT_STATED = 'Source not stated'

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
type AddressNote = 'frequency' | 'property' | 'cmra' | 'proximity' | 'deliverability'

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
    note === 'frequency' && typeof a.locationCount === 'number'
      ? `${a.locationCount} ${a.locationCount === 1 ? 'business' : 'businesses'} at this location`
      : null,
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
  ].filter(Boolean)

  return {
    group: 'address',
    label:
      a.isRegisteredAgent || a.labels.includes('registered_agent')
        ? 'Registered agent address'
        : 'Address',
    value: a.fullAddress,
    evidenceNote: facts.length > 0 ? facts.join(' · ') : undefined,
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

  return scope.map((a) => addressRow(a, note))
}

/**
 * Registrations grouped BY STATUS, one row each.
 *
 * A business can hold dozens — PricewaterhouseCoopers has 86 — and rolling them
 * into a single row hides the thing that matters: which are active, which could
 * not be resolved, and which are inactive. Each group gets its own row and its
 * own chip, so `SOS · DE +79` collapses the active filings without burying the
 * one that came back unknown.
 */
const STATUS_ORDER = ['active', 'unknown', 'inactive']

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
 * How long the filing has stood, in the coarsest unit still true.
 *
 * A qualification filed last quarter and one standing since 2018 are different
 * claims about the business, and a column of ISO dates leaves the reader doing
 * the arithmetic to see it.
 */
const filingAge = (date: string | null | undefined) => {
  if (!date) return undefined
  const filed = new Date(date)
  if (Number.isNaN(filed.getTime())) return undefined
  const months = Math.floor((Date.now() - filed.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
  if (months < 1) return 'this month'
  if (months < 24) return `${months} month${months === 1 ? '' : 's'} old`
  return `${Math.floor(months / 12)} years old`
}

/** One row per filing, named. Used where a check is about specific filings. */
const registrationRowsFor = (
  filings: BusinessRecord['registrations'],
  record: BusinessRecord
): AttributeRow[] => {
  if (filings.length === 0)
    return [{ label: 'Registrations', value: 'None on the record', source: REGISTRY }]

  // One row per distinct VALUE, with every filing that states it beside it.
  //
  // Grouped by filing instead, "Entity type: CORPORATION" appeared five times
  // and "Jurisdiction: FOREIGN" four — the same fact restated per state, with
  // the reader left to notice they agreed. Merged, agreement is the default
  // reading and disagreement is what stands out: two Status rows means the
  // filings disagree, and the chips say which said what.
  const field = (
    label: string,
    value: string | null | undefined,
    r: BusinessRecord['registrations'][number],
    qualifier?: string
  ): AttributeRow[] =>
    value
      ? [
          {
            label,
            value,
            source: '',
            qualifier,
            matchValue: `${label}:${value}`,
            registrations: [r]
          }
        ]
      : []

  // Grouped by field, not by filing. Read down a filing at a time, "Status"
  // appeared between two file numbers and the reader had to reassemble the
  // vocabulary themselves; read down a field, Active / Inactive / Unknown sit
  // together as the list they are, each naming the filings that hold it.
  //
  // Name is not here — Names carries it, and four qualifications restating the
  // legal name says only that they describe the same entity.
  const byLabel = (
    label: string,
    value: (r: BusinessRecord['registrations'][number]) => string | null | undefined,
    qualifier?: (r: BusinessRecord['registrations'][number]) => string | undefined
  ) => filings.flatMap((r) => field(label, value(r), r, qualifier?.(r)))

  return [
    // Active before inactive before unknown: the reading order is best case
    // first, so what is wrong with the entity is what the eye stops on.
    ...byLabel('Status', (r) => sentence(r.status)).sort(
      (a, b) =>
        FOREIGN_STATUS_ORDER.indexOf(a.value.toLowerCase()) -
        FOREIGN_STATUS_ORDER.indexOf(b.value.toLowerCase())
    ),
    // A missing sub status is a fact about the STATE, not a gap in the check.
    // Emitted only where the filing states one, New Jersey and Idaho simply had
    // no row and read as unexamined — the two states that do not publish
    // standing look identical to two we never looked at.
    ...byLabel('Sub status', (r) => sentence(r.subStatus) ?? 'Not published by the state'),
    // No file numbers. A file number identifies the filing, not the business —
    // four of them here said only that four filings exist, which the chips
    // beside every other row already say. Each one stays on its own filing's
    // card in Sources, under Filing details, where it is the identifier for
    // the record being read rather than a fact about the company.
    ...byLabel(
      'Registration date',
      (r) => r.registrationDate,
      (r) => filingAge(r.registrationDate)
    )
  ]
}

const registrationRows = (record: BusinessRecord): AttributeRow[] => {
  if (record.registrations.length === 0)
    return [{ label: 'Registrations', value: 'None on the record', source: REGISTRY }]

  const byStatus = new Map<string, BusinessRecord['registrations']>()
  for (const r of record.registrations) {
    const status = (r.status || 'unknown').toLowerCase()
    byStatus.set(status, [...(byStatus.get(status) ?? []), r])
  }

  const ordered = [
    ...STATUS_ORDER.filter((s) => byStatus.has(s)),
    ...[...byStatus.keys()].filter((s) => !STATUS_ORDER.includes(s))
  ]

  // Every group reads the same way: status, count, chip. A group of one is not
  // a special case — naming the single filing there made the rows inconsistent
  // with each other, and the name is in the chip's popover anyway.
  return ordered.map((status) => {
    const group = byStatus.get(status) as BusinessRecord['registrations']

    return {
      label: `${status.charAt(0).toUpperCase()}${status.slice(1)} registrations (${group.length})`,
      value: '',
      source: '',
      registrations: group
    }
  })
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
const formationRows = (record: BusinessRecord): AttributeRow[] => {
  if (!record.formation)
    return [{ group: 'formation', label: 'Formation', value: 'No formation record', source: REGISTRY }]

  const domestic = record.registrations.find((r) => r.state === record.formation?.state)

  const field = (
    label: string,
    value: string | null | undefined,
    qualifier?: string
  ): AttributeRow[] =>
    value
      ? [
          {
            group: 'formation' as const,
            label,
            value,
            qualifier,
            source: REGISTRY,
            domesticOnly: true
          }
        ]
      : []

  return [
    ...field('Entity type', trueEntityType(record) ?? domestic?.entityType ?? record.formation.entityType),
    ...field('Formation state', record.formation.state),
    // The same date the domestic filing carries as its registration date; they
    // dedup to one row rather than stating it twice.
    ...field('Formation date', record.formation.date, filingAge(record.formation.date)),
    ...field('Status', sentence(domestic?.status)),
    ...field('Sub status', sentence(domestic?.subStatus)),
    ...field('File number', domestic?.fileNumber)
    // No registered agent: an agent is a person, and People lists every one of
    // them with the filings that name them.
  ]
}

/** `submitted` separates who the customer gave us from who we found on filings.
 *  Collapsing the two makes a found entity look like a submitted person — which
 *  is exactly the error this split exists to prevent. */
const peopleRows = (record: BusinessRecord): AttributeRow[] => {
  if (!record.people.length) return [{ label: 'People', value: 'None on the record', source: REGISTRY }]

  return record.people.map((p) => ({
    label: 'Person',
    value: p.titles.length ? `${p.name} — ${p.titles.join(', ')}` : `${p.name} — no title published`,
    source: provenance(p)
  }))
}

/** Real TIN on a real record: show only the last four. */
const tinRow = (record: BusinessRecord): AttributeRow => {
  const tin = record.tin as { tin?: string } | null
  return {
    group: 'other' as const,
    label: 'TIN',
    value: tin?.tin ? `••••• ${tin.tin.slice(-4)}` : 'Not held',
    source: 'IRS TIN record'
  }
}

/** Brand names the API returns lowercase. Title-casing blindly gives "Bbb". */
const PROFILE_NAMES: Record<string, string> = {
  bbb: 'BBB',
  linkedin: 'LinkedIn',
  trustpilot: 'Trustpilot',
  facebook: 'Facebook',
  google: 'Google',
  yelp: 'Yelp'
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
const contactSources = (
  refs: SourceRef[] | undefined,
  item: { sources?: string[] },
  websiteId?: string | null
): string[] => {
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

    return {
      group: 'name' as const,
      label: primary.type === 'dba' ? 'DBA' : submitted ? 'Legal name' : 'Name on file',
      matchValue: key,
      value: primary.name,
      // No source on a submitted name: the label already says where it came
      // from, and printing the registry alongside it read as a contradiction.
      source: '',
      sources: [...new Set(group.flatMap((n) => provenanceList(n)))],
      submitted: group.some((n) => n.submitted),
      refs: group.flatMap((n) => n.sourceRefs ?? []),
      domesticOnly: group.some((n) => (n.sources ?? []).some((x) => REGISTRATION_SOURCES.has(x)))
    }
  })
}


/** Registries write addresses and names in their own casing and punctuation. */
const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** Identity of a name across spellings: "MIDDESK, INC." and "Middesk Inc" are
 *  the same name, and a registry dropping the space is not a second name. */
export const nameKey = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, '')

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

const nameTheFiling = (record: BusinessRecord) => (row: AttributeRow): AttributeRow => {
  if (row.registrations) return row

  const textual = row.sources ?? (row.source ? [row.source] : [])
  const fromRegistry = textual.some((x) => REGISTRATION_SOURCES.has(x))
  if (!fromRegistry || record.registrations.length === 0) return row

  const domestic = record.registrations.filter((r) => r.state === record.formation?.state)

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

const attributesForKey = (rawKey: string, record: BusinessRecord): AttributeRow[] => {
  // A check can yield several insights, each with an id of `key:qualifier`
  // (address frequency yields one per band). The qualifier scopes the evidence.
  const [key, qualifier] = rawKey.split(':')

  const submittedNames = (record.names ?? []).filter((n) => n.submitted && n.type !== 'dba')
  const submittedPeople = record.people.filter((p) => p.submitted)
  const officers = record.people.filter((p) => (p.sources ?? []).includes('registration'))

  // A name is a name wherever it is cited, so it groups with the other names
  // rather than under whichever check asked for it.
  const nameRow: AttributeRow = submittedNames.length
    ? {
        group: 'name',
        label: 'Legal name',
        matchValue: `legal:${nameKey(submittedNames.map((n) => n.name).join(', '))}`,
        value: submittedNames.map((n) => n.name).join(', '),
        source: '',
        sources: [...new Set(submittedNames.flatMap((n) => provenanceList(n)))],
        // The record's own source objects, not just their types. Without them a
        // per-jurisdiction source could not be resolved to a jurisdiction, and
        // the row landed in an unscoped "Tax permit" card beside the three real
        // ones it belongs to.
        refs: submittedNames.flatMap((n) => n.sourceRefs ?? []),
        submitted: true
      }
    : {
        group: 'name',
        label: 'Legal name',
        matchValue: `legal:${nameKey(record.name)}`,
        value: record.name,
        source: '',
        sources: [],
        submitted: true
      }

  /** A registered agent is a role, not an officer. The label carries it, so the
   *  title is not repeated in the value. */
  const isAgent = (titles: string[]) => titles.some((t) => /registered agent/i.test(t))

  const peopleRow = (people: typeof record.people, label: string): AttributeRow[] =>
    people.length
      ? people.map((p) => ({
          group: 'people' as const,
          label: isAgent(p.titles) ? 'Registered agent' : label,
          value: isAgent(p.titles)
            ? p.name
            : p.titles.length
              ? `${p.name} — ${p.titles.join(', ')}`
              : p.name,
          source: p.submitted ? '' : provenance(p),
          sources: provenanceList(p),
          submitted: p.submitted,
          refs: p.sourceRefs,
          matchOn: 'officer' as const,
          matchValue: p.name
        }))
      : []

  // --- Address frequency: the addresses in this band only ------------------
  if (key === 'location_frequency' && qualifier) {
    return record.addresses
      .filter((a) => typeof a.locationCount === 'number' && frequencyBand(a.locationCount) === qualifier)
      .map((a) => addressRow(a, 'frequency'))
  }

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
      return {
        group: 'name' as const,
        label: 'Legal name',
        value: name,
        matchValue: `legal:${nameKey(name)}`,
        source: '',
        sources: [],
        submitted: true,
        registrations: filings.length > 0 ? filings : undefined,
        // An empty chip column would read as "not rendered yet". A match check
        // with nothing matched has to say so.
        trailing: filings.length === 0 ? 'No state registration carries this name' : undefined
      }
    })
  }

  if (key === 'dba_name') {
    const dba = (record.names ?? []).filter((n) => n.type === 'dba' && n.submitted)
    return [
      ...(dba.length
        ? dba.map((n) => ({
            label: 'DBA',
            value: n.name,
            source: '',
            sources: provenanceList(n),
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
    const submitted = record.addresses.find((a) => a.submitted)
    if (!submitted)
      return [{ group: 'address', label: 'Address', value: 'None submitted', source: '' }]
    const measured = record.addresses.filter(
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
    const submitted = record.addresses.find((a) => a.submitted)
    if (!submitted)
      return [{ group: 'address', label: 'Address', value: 'None submitted', source: '' }]
    const row = addressRow(submitted, 'deliverability')
    // Deliverability is USPS's answer, not the registry's — the address may be
    // on a filing, but no filing says it can be posted to.
    return [{ ...row, source: USPS, sources: [...new Set([...(row.sources ?? []), USPS])] }]
  }

  // Which addresses are commercial and which residential — the check is about
  // the property type, so it reads out every address that has one rather than
  // the submitted address alone.
  if (key === 'address_property_type')
    return inGroup(
      'address',
      record.addresses.filter((a) => a.propertyType).map((a) => addressRow(a, 'property'))
    )

  // Only the ones that ARE mail drops. A CMRA row against an address that is
  // not one states the opposite of the check.
  if (key === 'address_cmra')
    return inGroup('address', record.addresses.filter((a) => a.cmra).map((a) => addressRow(a, 'cmra')))

  if (key.startsWith('address_')) return inGroup('address', addressRows(record, { submittedOnly: true }))

  // The banded form is handled above, one insight per band. This is the
  // unbanded fallback — every address that carries a count.
  if (key === 'location_frequency')
    return record.addresses
      .filter((a) => typeof a.locationCount === 'number')
      .map((a) => addressRow(a, 'frequency'))

  // --- Registrations -------------------------------------------------------
  //
  // Each check is about particular filings, so it evidences those and not the
  // whole registry picture. Every sos_* insight used to return all five
  // registrations plus the formation fields, so "Inactive in some states" and
  // "Good-standing sub-status not published" were backed by identical rows and
  // neither one showed you the filing it was talking about.
  if (key.startsWith('sos_') || key.startsWith('registrations') || key === 'submitted_registrations_match') {
    const domestic = record.registrations.filter((r) => r.state === record.formation?.state)
    const byStatus = (status: string) =>
      record.registrations.filter((r) => (r.status || 'unknown').toLowerCase() === status)

    const filings =
      key === 'sos_active'
        ? byStatus('active')
        : key === 'sos_inactive'
          ? byStatus('inactive')
          : key === 'sos_unknown'
            ? byStatus('unknown')
            : key === 'sos_match'
              ? record.registrations.filter((r) =>
                  record.addresses.some((a) => a.submitted && a.state === r.state)
                )
              : record.registrations

    // The domestic checks evidence the formation filing, and the formation rows
    // already are that filing read out — routing them through the foreign-filing
    // shape would have shown Delaware under a heading saying foreign.
    if (key === 'sos_domestic' || key === 'sos_domestic_sub_status')
      return domestic.length > 0
        ? formationRows(record)
        : [{ group: 'formation', label: 'Domestic registration', value: 'None on the record', source: '' }]

    // A status check is answered by the status and, where the state publishes
    // one, the sub-status that says why. A file number and a registration date
    // identify the filing; they do not bear on whether it is inactive.
    const STATUS_KEYS = new Set(['sos_active', 'sos_inactive', 'sos_unknown', 'sos_match'])
    const rows = registrationRowsFor(filings.filter((r) => !domestic.includes(r)), record)

    return inGroup(
      'registration',
      STATUS_KEYS.has(key)
        ? rows.filter((r) => r.label === 'Status' || r.label === 'Sub status')
        : rows
    )
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
      const type = r.entityType ? r.entityType.toUpperCase() : 'Not stated on the filing'
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
    const people = [...submittedPeople, ...officers]

    // Agents named on a filing but absent from `people[]` — Delaware's is only
    // ever stated on the registration itself, so it was missing from the People
    // group entirely while agents who happen to also be in `people[]` appeared.
    const agentsOnFilings: AttributeRow[] = record.registrations
      .filter(
        (r) =>
          r.registeredAgent &&
          !people.some((p) => norm(p.name) === norm(r.registeredAgent ?? ''))
      )
      .map((r) => ({
        group: 'people' as const,
        label: 'Registered agent',
        value: r.registeredAgent as string,
        source: '',
        matchValue: r.registeredAgent as string,
        registrations: [r]
      }))

    // Everyone on the record, not just the submitted people and the officers on
    // filings. Richard Tatum appears only through Middesk's Form 5500 — a
    // person the customer never named and no registration lists — and he was
    // missing from People entirely while being screened for adverse media.
    const others = record.people.filter(
      (p) => !people.some((q) => norm(q.name) === norm(p.name))
    )

    return [
      ...peopleRow(submittedPeople, 'Person'),
      ...(officers.length
        ? peopleRow(officers, 'Officer')
        : [{ label: 'Officers on state registrations', value: 'None published', source: '' }]),
      ...peopleRow(others, 'Person on file'),
      ...agentsOnFilings
    ]
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
    const task = record.reviewTasks.find((t) => t.key === key)

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
    const sub = task?.subLabel ?? ''
    // A sub-label can be a SCORE rather than an outcome — adverse media returns
    // "Low risk" alongside a message saying nothing was found. The message is
    // the outcome, so a denial in either place means no hit.
    const said = `${sub} ${task?.message ?? ''}`
    const hit = !/\bno\b|\bnone\b|not found/i.test(said)

    // The outcome follows each name — but only when there is nothing to find.
    // "No hits" is true of every name screened; a hit is true of one of them,
    // and the record never says which, so on a hit the names stay plain and the
    // provider's message carries the finding.
    const outcome = hit ? '' : key === 'adverse_media' ? ' — none found' : ' — no hits'

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
      risks?: Array<{ name: string; confidence: string | null }>
    }

    /**
     * The provider's own confidence, highest across the articles a name pulled
     * in. "Organized crime" at low confidence on a name collision is not the
     * same claim as the same flag at high confidence, and the risk names alone
     * read identically.
     */
    const RISK_ORDER = ['low', 'moderate', 'high']
    const riskLevel = (matches: Match[]) => {
      const levels = matches
        .flatMap((m) => m.risks ?? [])
        .map((r) => (r.confidence ?? '').toLowerCase())
        .filter((c) => RISK_ORDER.includes(c))
      if (levels.length === 0) return undefined
      const top = levels.sort((a, b) => RISK_ORDER.indexOf(b) - RISK_ORDER.indexOf(a))[0]
      return `${top.charAt(0).toUpperCase()}${top.slice(1)} risk`
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
            .map((r) => ({
              label: [l.agencyAbbr, l.abbr].filter(Boolean).join(' · ') || (l.title ?? 'Watchlist'),
              url: r.url ?? undefined
            }))
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

    return [
      // Submitted and found are not alternatives. A person the customer named
      // who also turns up on three registrations is both, and showing only the
      // first loses the corroboration — same treatment as an address.
      ...[...names, ...screened].flatMap((item) => {
        const articles = matchesFor(item)
        // Per name, not per check: one director can come back clean while
        // another pulls in four articles, and a single outcome across the whole
        // screen hid exactly that.
        const found = articles.length > 0

        const row = {
          // Evidence for the screening insight, not an attribute of the
          // business. The names are already in Name and People; repeating them
          // under Watchlist, PEP and Adverse media added three groups that held
          // nothing the record did not already say, and what the screen
          // RETURNED is the insight, not a fact about the company.
          detail: true,
          label: 'Screened',
          value: `${item.name}${found ? '' : outcome}`,
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
                note: a.risks?.length
                  ? [...new Set(a.risks.map((r) => r.name.replace(/_/g, ' ')))].join(', ')
                  : undefined
              }))
            : undefined,
          // No Submitted chip on a screening row. Whether the customer gave us
          // the name is a fact about the name, and it lives on the name's own
          // attribute; here the only question is what the screen ran against
          // and what it returned.
          submitted: false,
          // No count — the chip already reads "Www.wafb.com +8". What the count
          // cannot say is how the provider rated what it found.
          trailing: found ? riskLevel(articles) : undefined
        }

        return [row]
      }),
      ...searched
    ]
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
    if (cases.length === 0) return [nameRow, ...peopleRow(submittedPeople, 'Person')]

    return cases.map((c) => {
      // The court is the source. Without it nine Georgia cases and one in
      // Queens read as one undifferentiated pile of litigation.
      const court = c.court ?? (c.courtState ? `${c.courtState} courts` : 'Court record')
      const source = `Court record · ${court}`
      // Money actually awarded, where a docket entry carries an amount. Most
      // carry none, and a judgment line with no sum is a filing rather than a
      // debt.
      const awarded = c.judgments.reduce((n, j) => n + (j.amountCents ?? 0), 0)

      return {
        group: 'litigation' as const,
        // The court's own "UNKNOWN" is not a case type; printed as the label it
        // read as the finding, eight rows deep.
        label: c.caseType && c.caseType.toUpperCase() !== 'UNKNOWN' ? c.caseType : 'Case',
        // The side the business is on, beside the case rather than buried in a
        // party list fifteen names long.
        lead: c.caseNumber ?? undefined,
        value: c.caseName ?? 'Unnamed case',
        qualifier: [c.caseStatus, c.filingDate].filter(Boolean).join(' · ') || undefined,
        evidenceNote: [
          c.partyType && c.partyType !== 'UNKNOWN' ? `Business is ${c.partyType.toLowerCase()}` : undefined,
          c.parties.length > 1 ? `${c.parties.length} parties` : undefined,
          awarded > 0 ? `${money(awarded)} awarded` : undefined
        ]
          .filter(Boolean)
          .join(' · ') || undefined,
        source,
        sources: [source]
      }
    })
  }

  if (key === 'liens') {
    const filings = record.liens ?? []
    if (filings.length === 0) return [nameRow, ...peopleRow(submittedPeople, 'Person')]

    return filings.map((l) => {
      // The filing office, per state: a UCC-1 in Idaho and one in New Jersey
      // are held by different offices and searched separately.
      const source = `Lien · ${l.state ? stateName(l.state) : 'Unknown state'}`
      const amount = l.liabilityCents ?? l.loanPrincipalCents

      return {
        group: 'liens' as const,
        label: l.type ? l.type.toUpperCase() : 'Lien',
        lead: l.fileNumber ?? undefined,
        // The secured party is the readable identity of a lien — "THREE NOTCH'D
        // BREWING COMPANY LLC" says more than a file number does.
        value: l.securedParties.map((p) => p.name).join(', ') || 'Secured party not stated',
        qualifier: [l.status, l.filingDate].filter(Boolean).join(' · ') || undefined,
        evidenceNote: [
          l.collateral ?? undefined,
          amount ? money(amount) : undefined,
          l.lapseDate ? `lapses ${l.lapseDate}` : undefined
        ]
          .filter(Boolean)
          .join(' · ') || undefined,
        // The filing office's own page for this lien.
        href: l.url ?? undefined,
        source,
        sources: [source]
      }
    })
  }

  if (key === 'bankruptcies') {
    const filings = record.bankruptcies ?? []
    if (filings.length === 0) return [nameRow, ...peopleRow(submittedPeople, 'Person')]

    return filings.map((b) => {
      const court = b.court ?? (b.courtState ? `${b.courtState} courts` : 'Bankruptcy court')
      const source = `Bankruptcy court · ${court}`
      return {
        group: 'bankruptcy' as const,
        label: b.chapter ? `Chapter ${b.chapter}` : 'Petition',
        lead: b.caseNumber ?? undefined,
        value: [b.status, b.filingDate].filter(Boolean).join(' · ') || 'Filed',
        source,
        sources: [source]
      }
    })
  }

  // --- Web and profiles ----------------------------------------------------
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
      submitted: w.submitted
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
          sources: contactSources(e.sourceRefs, e, w.id),
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
          sources: contactSources(n.sourceRefs, n, w.id),
          submitted: n.submitted,
          href: profileUrl(n.sourceRefs),
          refs: n.sourceRefs
        }))
      ]

    return [
      url,
      ...(key === 'web_address_verification' ? inGroup('address', addressRows(record, { submittedOnly: true })) : []),
      ...(key === 'web_person_verification' ? peopleRow(submittedPeople, 'Person') : [])
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

    // Each check its own subset. Both returned every profile, so "supplied by
    // the customer" listed five the customer never mentioned — the record says
    // exactly one profile was submitted.
    const profiles =
      key === 'profile_discovery'
        ? all.filter((p) => p.submitted)
        : key === 'profile_status'
          ? all.filter((p) => p.status)
          : all

    return [
      ...(profiles.length
        ? profiles.map((p) => ({
            label: p.type ? `${profileName(p.type)} profile` : 'Profile',
            // The full URL, because the value column is where a reader reads
            // rather than hovers. Reachability stays metadata on the chip.
            value: p.url ?? '',
            href: p.url ?? undefined,
            source: 'Third-party profile',
            sources: [p.type ? profileName(p.type) : 'Third-party profile'],
            // Who the profile is for. We do not hold the page's own <title>,
            // and the subject is the useful headline anyway — the host is
            // already the byline and the URL is the line beneath.
            sourceTitle: record.name,
            sourceNote: p.status
              ? `${p.status.charAt(0).toUpperCase()}${p.status.slice(1)}`
              : 'Status not stated',
            // What the profile actually says about the business. Reachability
            // alone told a reviewer the page loads; the rating is the reason
            // they opened it. A rating with no reviews behind it (BBB's 0 from
            // 0) is not a score, so it reads as the absence it is.
            trailing:
              typeof p.rating === 'number' && (p.ratingCount ?? 0) > 0
                ? `${p.rating} from ${p.ratingCount} review${p.ratingCount === 1 ? '' : 's'}`
                : typeof p.followers === 'number'
                  ? `${p.followers.toLocaleString()} followers`
                  : (p.ratingCount ?? 0) === 0 && typeof p.rating === 'number'
                    ? 'No reviews'
                    : undefined
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
    // One row per code, code first. Joined into a line per scheme they were
    // unreadable and unsearchable — a reviewer looking up 541511 or matching a
    // policy against an MCC needs the code to start the line, not to sit in
    // brackets three clauses into a paragraph.
    const rows: AttributeRow[] = []
    // The classifier's own confidence in the category, kept beside the code it
    // qualifies. A 0.6 match and a 0.95 match are different claims and read
    // identically without it.
    const confidence = (score?: number | null) =>
      typeof score === 'number' ? `${Math.round(score * 100)}%` : undefined

    // One row per CATEGORY, its codes together. A category maps to several SIC
    // codes, so a row per code repeated the same category name four times and
    // read as four classifications where there is one.
    const note = (system: string, name: string, codes: string[], score?: number | null) => {
      if (codes.length === 0) return
      rows.push({
        label: system,
        lead: codes.join(', '),
        value: name,
        trailing: confidence(score),
        source: 'Industry classification',
        sources: ['Industry classification']
      })
    }

    for (const c of industry) {
      if (!c.name) continue
      note('NAICS', c.name, c.naicsCodes ?? [], c.score)
      note('SIC', c.name, c.sicCodes ?? [], c.score)
      note('MCC', c.name, c.mccCodes ?? [], c.score)
      // A prohibited-industry label carries no code — the label IS the finding.
      if (!(c.naicsCodes ?? []).length && !(c.sicCodes ?? []).length && !(c.mccCodes ?? []).length)
        rows.push({
          label: c.system ?? 'Classification',
          value: c.name,
          trailing: confidence(c.score),
          source: 'Industry classification',
          sources: ['Industry classification']
        })
    }

    const order = ['NAICS', 'SIC', 'MCC']
    const rank = (k: string) => (order.indexOf(k) === -1 ? order.length : order.indexOf(k))

    return rows.sort((a, b) => rank(a.label) - rank(b.label))
  }

  // --- Connections ---------------------------------------------------------
  // The counts and the shared-attribute breakdown are not on the record; only
  // the aggregate outcome is. Until that source is known, the evidence is the
  // attributes a connection could be matched on, and nothing implied beyond it.
  if (key === 'business_connections')
    return [
      ...peopleRow(officers, 'Officer'),
      ...inGroup('address', addressRows(record)).slice(0, 3)
    ]

  // --- TIN -----------------------------------------------------------------
  if (key === 'tin') return [tinRow(record), nameRow]

  return [nameRow]
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

    rows.push({ ...base, label: 'Licence holder',
      value: l.credential ? `${l.holder}, ${l.credential}` : l.holder, matchValue: l.holder })
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

export const attributesFor = (rawKey: string, record: BusinessRecord): AttributeRow[] =>
  attributesForKey(rawKey, record).map(nameTheFiling(record))
