import rawRecords from '../data/records.json'
import licenseStore from '../data/licenses.json'
import { deriveResults, trueEntityType, type BusinessRecord } from './deriveResults'
import agentStore from '../../analysis/agent.json'
import { newestReportFor } from './heldReports'
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
export const ALL: BusinessRecord[] = (rawRecords as BusinessRecord[]).map((r) => {
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
  score: IdentityScore
  counts: { positive: number; negative: number; neutral: number }
}

const ASSESSED = new Map<string, Assessed | null>()

export const assessmentOf = (r: BusinessRecord): Assessed | null => {
  if (ASSESSED.has(r.id)) return ASSESSED.get(r.id) ?? null

  const held = newestReportFor(r.name)
  let out: Assessed | null = null
  if (held?.report) {
    const record = held.snapshot?.record ?? r
    const results = held.snapshot?.results ?? deriveResults(r)
    const areas = areasOf(
      held.report.sections,
      held.policy.map((p) => ({ ...p, weight: TIER_OF.get(p.id) }))
    )
    const score = identityScore(record, results, areas)
    if (score)
      out = {
        score,
        counts: polarityCounts(
          record,
          results,
          score.components.flatMap((c) => c.insightIds)
        )
      }
  }
  ASSESSED.set(r.id, out)
  return out
}
