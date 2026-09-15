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
import {
  addressFrequencyInsights,
  addressProximity,
  entityTypeAgreement,
  statementFor
} from './statements'
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

export type BusinessRecord = {
  id: string
  name: string
  status: string
  names: Array<{
    name: string
    type: string
    submitted?: boolean
    sources?: string[]
    sourceRefs?: SourceRef[]
  }>
  formation: { date: string; entityType: string; state: string } | null
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
    jurisdiction?: string | null
    fileNumber?: string | null
    registrationDate?: string | null
    sourceUrl?: string | null
    /** What this filing lists, for attributing an address or officer to it. */
    addresses?: string[]
    officers?: string[]
  }>
  tin: unknown
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
  reviewTasks: ReviewTask[]
}

/** DBA filings are not supported in these states (source doc 01). */
const DBA_UNSUPPORTED = new Set([
  'IN', 'MD', 'SC', 'UT', 'AL', 'AR', 'CO', 'DE', 'IA', 'MT', 'NC', 'NJ', 'NM', 'VA', 'WA'
])

/** Composites. Not insights — a grade over facts that are themselves insights. */
const COMPOSITES = new Set(['address_risk', 'web_presence_quality'])

export type Derived = InsightResult & { reasonUndetermined?: boolean }

const derive = (task: ReviewTask, record: BusinessRecord): Derived[] => {
  if (COMPOSITES.has(task.key)) return []

  const base = {
    insightId: task.key,
    statement: statementFor(task.key, task.subLabel, record),
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
const derived = (record: BusinessRecord): Derived[] => {
  const rows: Derived[] = []

  // Against every filing, and against the foreign ones alone. The provider
  // checks only the domestic registration, and a qualification that disagrees
  // with the formation record is a finding no review task reports.
  // Domestic, foreign, all — narrowest first. The provider's own check covers
  // the domestic filing, so these widen from it rather than restating it.
  for (const [id, scope] of [
    ['entity_type_foreign', 'foreign'],
    ['entity_type_agreement', 'all']
  ] as const) {
    const agreement = entityTypeAgreement(record, scope)
    if (agreement)
      rows.push({ insightId: id, statement: agreement.statement, group: '', state: 'result' })
  }

  const proximity = addressProximity(record)
  if (!proximity) return rows

  return [
    ...rows,
    {
      insightId: 'address_proximity',
      statement: proximity.statement,
      group: '',
      // A result either way. The check ran and the distances are the finding —
      // "every address is within the boundary" is something we established, not
      // something we failed to.
      state: 'result'
    }
  ]
}

/** The categories of the checks we derive ourselves, since no task names them. */
const DERIVED_CATEGORY: Record<string, string> = {
  address_proximity: 'address',
  entity_type_agreement: 'formation',
  entity_type_foreign: 'formation'
}

export const deriveResults = (record: BusinessRecord): Derived[] => [
  ...record.reviewTasks.flatMap((t) => derive(t, record)),
  ...derived(record)
]

/** The category Middesk assigns each check, keyed by task key. */
export const categoriesOf = (record: BusinessRecord): Map<string, string> =>
  new Map<string, string>([
    ...record.reviewTasks
      .filter((t) => t.category)
      .map((t) => [t.key, t.category as string] as [string, string]),
    ...Object.entries(DERIVED_CATEGORY)
  ])

export const droppedComposites = (record: BusinessRecord): string[] =>
  record.reviewTasks.filter((t) => COMPOSITES.has(t.key)).map((t) => `${t.key} (${t.subLabel})`)
