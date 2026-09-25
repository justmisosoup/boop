import rawRecords from '../data/records.json'
import licenseStore from '../data/licenses.json'
import { deriveResults, trueEntityType, type BusinessRecord } from './deriveResults'
import agentStore from '../../analysis/agent.json'
import { withCityRegistrations } from './cityRegistrations'
import { newestReportFor } from './heldReports'
import {
  areasOf,
  type ScoreArea,
  identityScore,
  polarityCounts,
  type AssessmentWeight,
  type IdentityScore
} from './identityScore'

/** The assessments' tiers, from the bundled agent — the list has no hook. */
const TIER_OF = new Map(
  ((agentStore as { skills?: Array<{ id: string; weight?: AssessmentWeight }> }).skills ?? []).map(
    (x) => [x.id, x.weight]
  )
)

/**
 * The records the prototype runs on, and the few things both the list and the
 * record view need to say about them.
 *
 * This lived at the top of `App.tsx` when there was one screen. Now that
 * `/businesses` and `/businesses/:id` both read it, it sits here so the list
 * and the record it opens are looking at the same 25 rows.
 */

/**
 * Licences, merged onto the records they belong to.
 *
 * `records.json` is rewritten wholesale by `bun run pull`, so anything found
 * by hand and written there is lost on the next pull. The store is keyed by
 * business NAME rather than id, because re-ordering the same company mints a
 * new business id every time and an id-keyed store would come back empty for
 * the business it was written for.
 */
const LICENSES = (licenseStore as { licenses: Record<string, unknown[]> }).licenses
const licenseKey = (name: string) => name.toLowerCase().replace(/\s+/g, ' ').trim()

/** Every ingested record. Nothing is synthesised — this is what `pull` wrote. */
export const ALL: BusinessRecord[] = (rawRecords as BusinessRecord[]).map((raw) => {
  const r = withCityRegistrations(raw)
  const found = LICENSES[licenseKey(r.name)]
  return found ? { ...r, licenses: found as BusinessRecord['licenses'] } : r
})

const BY_ID = new Map(ALL.map((r) => [r.id, r]))

export const byId = (id?: string) => (id ? BY_ID.get(id) : undefined)

// The form the filings carry, not the provider's bucket — see trueEntityType.
export const describe = (r: BusinessRecord) =>
  r.formation
    ? `${trueEntityType(r) ?? r.formation.entityType} · ${r.formation.state} · formed ${r.formation.date}`
    : 'No formation record'

/**
 * What the list says about a business's assessment: its score, and how the
 * insights the report rests on read.
 *
 * Scored against the report's OWN snapshot, the way the record view scores it
 * — so the number in the list is the number in the ring, not a re-read of the
 * live record that the report never saw. A business with no stored report has
 * nothing to say here and returns null; the list shows that as absence.
 */
export type Assessed = {
  /** The report this reading is of, so a decision can be looked up by it. */
  reportId: string
  /** When it ran. Empty for a report kept before this was recorded. */
  at: string
  score: IdentityScore
  /** The areas it was scored in, with the questions each left open. */
  areas: ScoreArea[]
  counts: { positive: number; negative: number; neutral: number }
}

const ASSESSED_REPORT = new Map<string, Assessed | null>()

/**
 * Score one report, against its own snapshot.
 *
 * The arithmetic the record view runs for the report it has open, made
 * callable for any report — the Reports tab scores every run a business has
 * had, and the list scores the newest. Memoised by report id: a report never
 * changes once written, so its score does not either.
 */
export const assessReport = (
  report: {
    id: string
    at?: string
    sections: Parameters<typeof areasOf>[0]
    policy: Array<{ id: string; name: string }>
    snapshot?: { record: BusinessRecord; results: ReturnType<typeof deriveResults> } | null
  },
  fallback: BusinessRecord
): Assessed | null => {
  if (ASSESSED_REPORT.has(report.id)) return ASSESSED_REPORT.get(report.id) ?? null

  const record = report.snapshot?.record ?? fallback
  const results = report.snapshot?.results ?? deriveResults(fallback)
  const areas = areasOf(
    report.sections,
    report.policy.map((p) => ({ ...p, weight: TIER_OF.get(p.id) }))
  )
  const score = identityScore(record, results, areas)
  const out: Assessed | null = score
    ? {
        reportId: report.id,
        at: report.at ?? '',
        score,
        areas,
        counts: polarityCounts(record, results, score.components.flatMap((c) => c.insightIds))
      }
    : null
  ASSESSED_REPORT.set(report.id, out)
  return out
}

const ASSESSED = new Map<string, Assessed | null>()

/** The newest report's reading, for the list. */
export const assessmentOf = (r: BusinessRecord): Assessed | null => {
  if (ASSESSED.has(r.id)) return ASSESSED.get(r.id) ?? null

  const held = newestReportFor(r.name)
  const out = held?.report
    ? assessReport(
        {
          id: held.id,
          at: held.at,
          sections: held.report.sections,
          policy: held.policy,
          snapshot: held.snapshot
        },
        r
      )
    : null
  ASSESSED.set(r.id, out)
  return out
}
