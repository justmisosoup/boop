/**
 * Runs a real Middesk record against the insight catalog.
 *
 * Every review task carries a `subLabel` (the fact it found) and a `status` of
 * success / warning / failure (a judgement on that fact). **The status is
 * dropped here and never reaches the UI** — it is an assessment made before
 * assessments existed (catalog/decompositions.md).
 *
 * One check can yield MORE than one insight: address frequency yields one per
 * band, so `derive` returns a list.
 */
import catalog from '../data/catalog.json'
import { STATUS_NOT_PUBLISHED, stateName } from './states'
import { addressFrequencyInsights, statementFor } from './statements'

const CATALOG_SUBJECTS = (
  catalog as {
    subjects: Array<{
      subject: string
      checks: string[]
      signals?: string[]
      order_packages?: string[]
    }>
  }
).subjects
const CHECK_NAME = (catalog as { nameOf: Record<string, string> }).nameOf
const CHECK_PACKAGES = (catalog as { packagesOf: Record<string, string> }).packagesOf

/**
 * What has to be ordered for a check to run at all.
 *
 * Carried as evidence on every insight, answered or blank. For a blank one it
 * is the only actionable thing on the row — "order this" is what closes it. For
 * an answered one it says what the answer cost, which is the part the API
 * response does not carry.
 *
 * A signal needs no Order; the sheet says so in the same field, so the
 * distinction is kept rather than flattened into a package list.
 */
const producedBy = (insightId: string): string | undefined => {
  const packages = CHECK_PACKAGES[insightId.split(':')[0]]
  if (!packages) return undefined
  return /no Order required/i.test(packages)
    ? 'Produced by a signal — POST /v1/signals, no Order required'
    : `Requires Order package: ${packages}`
}
import type { InsightResult, NoResultReason } from '../types'

export type ReviewTask = {
  key: string
  subLabel: string
  message?: string | null
  category?: string | null
}

/**
 * A source as the API returns it. `metadata` is where the useful part lives —
 * which state a permit is in, which plan year a filing covers, and the `labels`
 * that say what role an address played for THAT source (mailing, physical,
 * registered agent).
 */
export type SourceRef = { id: string; type: string; metadata: Record<string, unknown> }

/**
 * The entity type the filings actually carry.
 *
 * The provider's `entity_type` is a bucket, not the entity's form: its taxonomy
 * has no value for a professional entity, so `KAIROS PHYSICAL THERAPY PLLC` is
 * returned as `LLC`. The legal name on the registration is the entity's own
 * name, and where it carries a professional suffix that IS the form — the
 * platform's coarser label does not overrule it.
 *
 * This is not cosmetic. A PLLC is a licensed professional practice organised as
 * an LLC, and its membership is restricted by statute to licensed practitioners
 * of the profession — so a policy keyed on entity type must see `PLLC` to ask
 * for licensure with the beneficial ownership certification. Reported as `LLC`,
 * a professional practice is routed as an ordinary company and never asked.
 */
const NAME_SUFFIXES: Array<[RegExp, string]> = [
  [/\bP\.?L\.?L\.?C\.?$/i, 'PLLC'],
  [/\bP\.?L\.?L\.?P\.?$/i, 'PLLP'],
  [/\bP\.?C\.?$/i, 'PC']
]

export const trueEntityType = (record: BusinessRecord): string | null => {
  const names = [
    ...record.registrations.map((r) => r.name),
    ...record.names.filter((n) => n.type === 'legal').map((n) => n.name),
    record.name
  ].filter(Boolean)

  for (const name of names) {
    const trimmed = name.trim().replace(/[.,]+$/, '')
    for (const [pattern, form] of NAME_SUFFIXES) if (pattern.test(trimmed)) return form
  }
  return record.formation?.entityType ?? null
}

export type BusinessRecord = {
  id: string
  name: string
  status: string
  /** When the business was ordered. `scripts/pull-records.ts` writes it. */
  createdAt?: string | null
  names: Array<{
    name: string
    type: string
    submitted?: boolean
    sources?: string[]
    sourceRefs?: SourceRef[]
  }>
  formation: { date: string; entityType: string; state: string } | null
  /**
   * Professional licences held by the people behind the business.
   *
   * A professional entity's members must be licensed in the profession it
   * practises, and no check in the catalog reaches that. The NPI registry is
   * the public source for healthcare providers; a state board is the
   * equivalent elsewhere.
   */
  licenses?: Array<{
    id: string
    registry: string
    number: string
    holder: string
    credential?: string | null
    profession: string
    taxonomyCode?: string | null
    licenseState?: string | null
    licenseNumber?: string | null
    status: string
    enumeratedAt?: string | null
    lastUpdated?: string | null
    address?: string | null
    phone?: string | null
    sourceUrl?: string | null
  }>
  addresses: Array<{
    fullAddress: string
    state: string | null
    labels: string[]
    locationCount?: number | null
    cmra?: boolean
    isRegisteredAgent?: boolean
    propertyType?: string | null
    latitude?: number | null
    longitude?: number | null
    deliverable?: boolean | null
    submitted?: boolean
    sources?: string[]
    sourceRefs?: SourceRef[]
  }>
  people: Array<{
    name: string
    titles: string[]
    submitted?: boolean
    sources?: string[]
    sourceRefs?: SourceRef[]
  }>
  registrations: Array<{
    name: string
    state: string
    entityType?: string | null
    registeredAgent?: string | null
    status: string
    subStatus?: string | null
    statusDetails?: string | null
    jurisdiction?: string | null
    fileNumber?: string | null
    registrationDate?: string | null
    sourceUrl?: string | null
    /** What this filing lists, for attributing an address or officer to it. */
    addresses?: string[]
    officers?: string[]
  }>
  tin: unknown
  /**
   * The businesses connected to this one, strongest first.
   *
   * From `list_connections`, which names what the `business_connections`
   * review task only counts as Found. The pull does not fetch it, so it is on
   * a report's snapshot where a session looked it up, and absent elsewhere.
   */
  connections?: Array<{
    id: string
    name: string
    confidence?: number | null
    /** Set when the connected entity is itself a business in this account. */
    connectedBusinessId?: string | null
    people?: string[]
    addresses?: Array<{ fullAddress: string; labels?: string[]; sources?: string[] }>
    businesses?: string[]
  }>
  website?: {
    id?: string | null
    url: string | null
    submitted?: boolean
    status: string | null
    httpStatusCode?: number | null
    title?: string | null
    platform?: string | null
    category?: string | null
    parked?: boolean
    comingSoon?: boolean
    businessNameMatch?: boolean
    domain: string | null
    domainId?: string | null
    domainCreated: string | null
    domainExpires?: string | null
    registrar?: string | null
    pages?: Array<{ url: string | null; category: string | null }>
    emails?: Array<{
      email: string
      submitted?: boolean
      sources?: string[]
      sourceRefs?: SourceRef[]
    }>
    phones?: Array<{
      phone: string
      submitted?: boolean
      sources?: string[]
      sourceRefs?: SourceRef[]
    }>
  } | null
  profiles?: Array<{
    url: string | null
    type: string | null
    status: string | null
    submitted?: boolean
    rating?: number | null
    ratingCount?: number | null
    followers?: number | null
    categories?: string[]
  }>
  industry?: Array<{
    system: string | null
    name: string | null
    naicsCodes?: string[]
    sicCodes?: string[]
    mccCodes?: string[]
    sector?: string | null
    score?: number | null
    highRisk?: boolean
  }>
  watchlist?: {
    hitCount: number
    lists: Array<{
      agency: string | null
      agencyAbbr: string | null
      organization: string | null
      title: string | null
      abbr: string | null
      hits: number
      results?: Array<{
        id: string
        entityName: string | null
        aliases?: string[]
        url: string | null
      }>
    }>
  } | null
  pep?: { results: Array<{ id: string; name: string | null; url: string | null }> } | null
  adverseMedia?: {
    results: Array<{
      id: string
      matchScore?: number | null
      items: Array<{
        sourceName: string | null
        title: string | null
        url: string | null
        risks?: Array<{ name: string; confidence: string | null }>
        sentiment?: string | null
      }>
    }>
  } | null
  /**
   * Court records, lien filings and bankruptcy petitions, in full.
   *
   * Each carries the source that issued it — the court, the state filing office
   * — because these are documents held by named institutions, not screening
   * outputs. That is what lets them stand as sources beside the registries
   * rather than as an unsourced count on a review task.
   */
  litigations?: Litigation[]
  liens?: Lien[]
  bankruptcies?: Bankruptcy[]
  reviewTasks: ReviewTask[]
}

export type Litigation = {
  id: string
  caseName: string | null
  caseNumber: string | null
  caseStatus: string | null
  caseType: string | null
  filingDate: string | null
  court: string | null
  courtState: string | null
  /** Which side the business is on, where the court states it. */
  partyType: string | null
  parties: Array<{ name: string; role: string | null }>
  judgments: Array<{ text: string | null; date: string | null; amountCents: number | null }>
}

export type Lien = {
  id: string
  type: string | null
  fileNumber: string | null
  state: string | null
  status: string | null
  filingDate: string | null
  lapseDate: string | null
  collateral: string | null
  liabilityCents: number | null
  loanPrincipalCents: number | null
  /** The filing office's own page for this lien. */
  url: string | null
  debtors: Array<{ name: string; type: string | null }>
  securedParties: Array<{ name: string; type: string | null }>
}

export type Bankruptcy = {
  id: string
  caseNumber: string | null
  chapter: string | null
  status: string | null
  filingDate: string | null
  court: string | null
  courtState: string | null
}

/** DBA filings are not supported in these states (source doc 01). */
const DBA_UNSUPPORTED = new Set([
  'IN', 'MD', 'SC', 'UT', 'AL', 'AR', 'CO', 'DE', 'IA', 'MT', 'NC', 'NJ', 'NM', 'VA', 'WA'
])

/** Composites. Not insights — a grade over facts that are themselves insights. */
const COMPOSITES = new Set(['address_risk', 'web_presence_quality'])

export type Derived = InsightResult & {
  reasonUndetermined?: boolean
  /** The catalog defines this check and the record did not report it. */
  notReported?: boolean
}

const derive = (task: ReviewTask, record: BusinessRecord): Derived[] => {
  if (COMPOSITES.has(task.key)) return []

  const base = {
    insightId: task.key,
    statement: statementFor(task.key, task.subLabel, record, task.message),
    group: ''
  }

  // One insight per frequency band, each carrying its own addresses.
  if (task.key === 'location_frequency') {
    const groups = addressFrequencyInsights(record)
    if (groups.length === 0)
      return [{ ...base, state: 'no_result', because: task.message ?? undefined }]

    return groups.map((g) => ({
      insightId: `${task.key}:${g.band}`,
      statement: g.statement,
      group: '',
      state: 'result' as const,
      evidence: g.addresses.map(
        (a) => `${a.fullAddress} — ${a.locationCount} businesses at this location`
      )
    }))
  }

  // "Not Provided by State" — the state does not publish it.
  if (task.subLabel === 'Not Provided by State') {
    return [
      {
        ...base,
        state: 'no_result',
        reason: 'not_published' as NoResultReason,
        because: task.message ?? undefined,
        evidence: [`Registration state: ${record.formation?.state ?? 'unknown'}`]
      }
    ]
  }

  /*
   * A filing with no status, in a state that publishes none.
   *
   * Delaware and New Jersey publish no entity status at all — every filing
   * there is Unknown, with no status details — so an Unknown in those states
   * is the registry's habit, not a finding about the business. It reads the
   * way an unpublished sub status does: not published, neutral, unflagged.
   * Each filing is judged by its OWN state: the domestic check by the
   * formation state, the roll-up only when every Unknown filing is in one of
   * the silent states. An Unknown anywhere else is still a question.
   */
  if ((task.key === 'sos_domestic' || task.key === 'sos_unknown') && /Unknown/i.test(task.subLabel)) {
    const noStatus = record.registrations.filter((r) => !r.status || /unknown/i.test(r.status))
    const silentStates = [...new Set(noStatus.map((r) => r.state))]
    const silent =
      task.key === 'sos_domestic'
        ? STATUS_NOT_PUBLISHED.has(record.formation?.state ?? '')
        : noStatus.length > 0 && silentStates.every((st) => STATUS_NOT_PUBLISHED.has(st))
    if (silent) {
      const where = task.key === 'sos_domestic' ? [record.formation?.state ?? ''] : silentStates
      const names = where.map((st) => stateName(st))
      return [
        {
          ...base,
          state: 'no_result',
          reason: 'not_published' as NoResultReason,
          because: `${names.length < 3 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`} ${names.length === 1 ? 'does' : 'do'} not publish filing status.`,
          evidence: where.map((st) => `Registration state: ${st}`)
        }
      ]
    }
  }

  // Unknown: ran against real material and reached no conclusion.
  if (/Unknown/i.test(task.subLabel)) {
    return [
      {
        ...base,
        state: 'unknown',
        because: task.message ?? undefined,
        evidence: [`Source value: ${task.subLabel}`]
      }
    ]
  }

  if (task.subLabel === 'Unverified') {
    const submittedPeople = record.people.filter((p) => p.submitted)
    const unregistered = !record.formation && record.registrations.length === 0

    // Officers come from state registrations, and only from there. A person
    // sourced from screening is not an officer record.
    if (task.key === 'person_verification') {
      const officers = record.people.filter((p) => (p.sources ?? []).includes('registration'))
      if (submittedPeople.length === 0)
        return [{ ...base, state: 'no_result', because: task.message ?? undefined }]
      if (officers.length === 0)
        return [
          {
            ...base,
            state: 'no_result',
            because: task.message ?? undefined,
            evidence: [`Submitted: ${submittedPeople.map((p) => p.name).join(', ')}`]
          }
        ]
      return [
        {
          ...base,
          state: 'result',
          because: task.message ?? undefined,
          evidence: [
            `Submitted: ${submittedPeople.map((p) => p.name).join(', ')}`,
            `Officers on state registrations: ${officers.map((p) => p.name).join(', ')}`
          ]
        }
      ]
    }

    if (task.key === 'dba_name') {
      const submittedDba = record.names.filter((n) => n.type === 'dba' && n.submitted)
      const state = record.formation?.state ?? ''
      if (submittedDba.length === 0)
        return [{ ...base, state: 'no_result', because: task.message ?? undefined }]
      if (DBA_UNSUPPORTED.has(state))
        return [
          {
            ...base,
            state: 'no_result',
            reason: 'not_published' as NoResultReason,
            because: task.message ?? undefined,
            evidence: [`Formation state: ${state}`]
          }
        ]
      return [
        {
          ...base,
          state: 'result',
          because: task.message ?? undefined,
          evidence: [`Submitted DBA: ${submittedDba.map((n) => n.name).join(', ')}`]
        }
      ]
    }

    if (unregistered)
      return [
        {
          ...base,
          state: 'no_result',
          reason: 'not_required' as NoResultReason,
          because: task.message ?? undefined,
          evidence: ['No formation record', 'Registrations on file: 0']
        }
      ]

    return [
      {
        ...base,
        state: 'result',
        because: task.message ?? undefined,
        evidence: [`Registrations on file: ${record.registrations.length}`]
      }
    ]
  }

  return [
    {
      ...base,
      state: 'result',
      because: task.message ?? undefined,
      evidence: [`Source value: ${task.subLabel}`]
    }
  ]
}

/**
 * Checks the record does not carry, read off data it does.
 *
 * The API geocodes every address and runs no check on the coordinates, so how
 * far a found address sits from the submitted one is in the payload and in no
 * review task. Kept separate from `derive` so it is obvious which insights are
 * the provider's and which are ours.
 */
/**
 * Nothing. Kept as a seam rather than deleted.
 *
 * This used to add three insights the prototype composed itself —
 * `entity_type_foreign`, `entity_type_agreement` and `address_proximity`. They
 * were hand-rolled: no review task or signal produces them, so they are our
 * reading dressed as the product's. The insights are now the product's own
 * review tasks and signals, and anything we invent beside them is an assessment
 * wearing an insight's clothes.
 */
/**
 * The professional licences, and what they line up with.
 *
 * What is derived here is exactly what the registry supports and no more: that
 * an NPI record exists, that its holder's name matches the submitted person,
 * and that its practice address matches the submitted office.
 *
 * It does NOT establish that the person is a member, owner or practitioner OF
 * this entity. The New York filing names no natural person, so nothing on the
 * record ties the two together — a name and an address in common is a strong
 * lead, not a relationship. Each match row says so in its own evidence, so a
 * session reading these cannot quietly promote a lead into a fact.
 *
 * Without this the licence reached the Attributes and Sources tabs and nothing
 * else — `useAnalysis` builds the assessment request out of `insights` alone,
 * so a run could not see it and wrote "search the NPI registry" about a record
 * that already held the answer.
 */
const licenseInsights = (record: BusinessRecord): Derived[] => {
  const licenses = record.licenses ?? []
  if (licenses.length === 0) return []

  const submittedPeople = record.people.filter((p) => p.submitted)
  const submittedAddresses = record.addresses.filter((a) => a.submitted)

  /** Words, upper case, punctuation dropped. */
  const words = (s: string) => s.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)
  /**
   * The street line and the ZIP5. A floor or suite is the same address, so the
   * designator AND the number after it both go — keeping the number left
   * "801 MADISON AVE FL 3" as "801 MADISON AVE 3", which matched nothing.
   */
  const place = (s: string) => {
    const w = words(s.split(',')[0] ?? '')
    const street: string[] = []
    for (let i = 0; i < w.length; i++) {
      if (/^(FL|FLOOR|STE|SUITE|APT|UNIT|RM|ROOM|NO)$/.test(w[i])) {
        i++ // and the number it labels
        continue
      }
      street.push(w[i])
    }
    return { street: street.join(' '), zip: (s.match(/\b(\d{5})(?:-\d{4})?\b/) ?? [])[1] }
  }

  return licenses.flatMap((l): Derived[] => {
    const holder = words(l.holder)
    // Every word of the submitted name appears in the holder's: "JOSHUA GEE"
    // is "JOSHUA Y GEE" with the middle initial left off, which is a match.
    // The reverse is not true, so the direction matters.
    const person = submittedPeople.find((p) => {
      const sub = words(p.name)
      return sub.length > 1 && sub.every((t) => holder.includes(t))
    })

    const lic = place(l.address ?? '')
    const office = l.address
      ? submittedAddresses.find((a) => {
          const sub = place(a.fullAddress)
          return Boolean(sub.street) && sub.street === lic.street && Boolean(sub.zip) && sub.zip === lic.zip
        })
      : undefined

    const held = [
      l.profession,
      l.taxonomyCode ? `taxonomy ${l.taxonomyCode}` : undefined,
      l.licenseState && l.licenseNumber
        ? `${l.licenseState} licence ${l.licenseNumber}`
        : undefined,
      `status ${l.status}`,
      l.lastUpdated ? `registry updated ${l.lastUpdated}` : undefined,
      l.sourceUrl ?? undefined
    ].filter(Boolean) as string[]

    const rows: Derived[] = [
      {
        insightId: `license:${l.id}`,
        statement: `${l.registry} holds a ${l.profession} licence for ${l.holder}${l.credential ? `, ${l.credential}` : ''}, status ${l.status}`,
        group: '',
        state: 'result',
        evidence: held
      }
    ]

    if (person) {
      rows.push({
        insightId: `license_person_match:${l.id}`,
        statement: `An ${l.registry} record was found whose holder name matches the submitted person`,
        group: '',
        state: 'result',
        because: `Submitted ${person.name}; ${l.registry} holds ${l.number} under ${l.holder}`,
        evidence: [
          `Submitted person: ${person.name}`,
          `Licence holder: ${l.holder}${l.credential ? `, ${l.credential}` : ''}`,
          `${l.registry} ${l.number}`,
          'Name match only. No filing on this record names a natural person, so this does not establish that the licence holder is a member, owner or the practising clinician of this entity.'
        ]
      })
    }

    if (office) {
      rows.push({
        insightId: `license_address_match:${l.id}`,
        statement: `The ${l.registry} record's practice address matches the submitted office address`,
        group: '',
        state: 'result',
        because: `${l.registry} lists ${l.address}; the submitted office is ${office.fullAddress}`,
        evidence: [
          `Submitted office: ${office.fullAddress}`,
          `Licence practice address: ${l.address}`,
          l.phone ? `Practice phone: ${l.phone}` : '',
          'Shared address only. It does not establish a relationship between the licence holder and this entity.'
        ].filter(Boolean)
      })
    }

    return rows
  })
}

const derived = (record: BusinessRecord): Derived[] => licenseInsights(record)


/**
 * Every check the catalog defines, including the ones this record did not report.
 *
 * A business is evaluated against the whole insight set. Leaving out the checks
 * that returned nothing makes a short list indistinguishable from a thin
 * business — the reader cannot tell whether that is the company or the order.
 *
 * The state is `unknown`, NOT a no-result with a reason. Why a check is absent
 * is unrecoverable from the response: not ordered, not held, not applicable, and
 * ordered-and-found-nothing all look identical. `formation_state` is absent for
 * a business whose formation state is plainly on the record, so "not ordered"
 * would be a guess stated as a fact. `catalog/coverage.yaml` reaches the same
 * conclusion: where the reason cannot be recovered, the honest result is unknown
 * rather than a no-result with a reason invented for it.
 *
 * The order packages are carried as context — what would produce this check —
 * not as a claim about why it is missing.
 */
const notReported = (ran: Set<string>): Derived[] =>
  CATALOG_SUBJECTS.flatMap((subject) =>
    subject.checks
      .filter((id) => !ran.has(id))
      .map((id) => ({
        insightId: id,
        // Say which check this is. A row reading only "no result" is unreadable
        // — within a group every one of them looked identical.
        statement: `${CHECK_NAME[id] ?? id.replace(/_/g, ' ')} — no result on this record`,
        group: '',
        state: 'unknown' as const,
        notReported: true
      }))
  )

/**
 * The signals, as insights.
 *
 * Half the catalog, and none of them fetched: `pull-records.ts` reads
 * `/v1/businesses`, and signals are their own endpoint. So every one is listed
 * and none has a result — worth showing rather than hiding, because most need no
 * Order at all and are the cheapest evidence available.
 *
 * They restate the review tasks they came from, which is recorded rather than
 * resolved — both are kept.
 */
const signalRows = (): Derived[] =>
  CATALOG_SUBJECTS.flatMap((subject) =>
    (subject.signals ?? []).map((text, i) => ({
      insightId: `signal:${subject.subject}:${i}`,
      statement: text,
      group: '',
      state: 'unknown' as const,
      notReported: true,
      evidence: ['Signal — POST /v1/signals, no Order required. Not fetched by this prototype.']
    }))
  )

export const deriveResults = (record: BusinessRecord): Derived[] => {
  const ran = record.reviewTasks.flatMap((t) => derive(t, record))
  const ranKeys = new Set(ran.map((r) => r.insightId.split(':')[0]))
  return [...ran, ...derived(record), ...notReported(ranKeys), ...signalRows()].map((d) => {
    const origin = producedBy(d.insightId)
    return origin ? { ...d, evidence: [...(d.evidence ?? []), origin] } : d
  })
}

/** The category Middesk assigns each check, keyed by task key. */
export const categoriesOf = (record: BusinessRecord): Map<string, string> =>
  new Map<string, string>([
    ...record.reviewTasks
      .filter((t) => t.category)
      .map((t) => [t.key, t.category as string] as [string, string]),
  ])

export const droppedComposites = (record: BusinessRecord): string[] =>
  record.reviewTasks.filter((t) => COMPOSITES.has(t.key)).map((t) => `${t.key} (${t.subLabel})`)
