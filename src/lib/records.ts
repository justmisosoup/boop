import rawRecords from '../data/records.json'
import { deriveResults, type BusinessRecord } from './deriveResults'
import agentStore from '../../analysis/agent.json'
import { withCityRegistrations, withLicenses } from './cityRegistrations'
import { heldReportFor } from './heldReports'
import {
  areasOf,
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

/** Every ingested record. Nothing is synthesised — this is what `pull` wrote. */
export const ALL: BusinessRecord[] = (rawRecords as BusinessRecord[]).map((raw) => {
  return withLicenses(withCityRegistrations(raw))
})

const BY_ID = new Map(ALL.map((r) => [r.id, r]))

export const byId = (id?: string) => (id ? BY_ID.get(id) : undefined)

/**
 * What the list says about a business's assessment: its score, and how the
 * insights the report rests on read.
 *
 * Scored exactly as the record view scores it: against the report's own
 * snapshot record, its rows re-derived with today's rules. Reading the rows the
 * snapshot stored instead let the list and the ring disagree whenever a reading
 * rule changed after a report was written. A business with no stored report
 * has nothing to say here and returns null; the list shows that as absence.
 */
export type Assessed = {
  /** When it ran. */
  at: string
  score: IdentityScore
  counts: { positive: number; negative: number; neutral: number }
}

const ASSESSED = new Map<string, Assessed | null>()

/** The business's report, scored, for the list. Memoised: a report never
 *  changes once written, so its score does not either. */
export const assessmentOf = (r: BusinessRecord): Assessed | null => {
  if (ASSESSED.has(r.id)) return ASSESSED.get(r.id) ?? null

  const held = heldReportFor(r.name)
  let out: Assessed | null = null
  if (held?.report) {
    const record = held.snapshot?.record ?? r
    const results = deriveResults(record)
    const areas = areasOf(
      held.report.sections,
      held.policy.map((p) => ({ ...p, weight: TIER_OF.get(p.id) }))
    )
    const score = identityScore(record, results, areas)
    if (score)
      out = {
        at: held.at ?? '',
        score,
        counts: polarityCounts(record, results, score.components.flatMap((c) => c.insightIds))
      }
  }
  ASSESSED.set(r.id, out)
  return out
}
