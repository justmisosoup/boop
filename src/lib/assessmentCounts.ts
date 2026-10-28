import { missingInputs } from './assessmentContext'
import { businessScopeOf, resultsIn } from './assessments'
import { categoriesOf, deriveResults, type BusinessRecord } from './deriveResults'
import { makeGroupFor } from './groups'
import { outcomeOf, type Outcome } from './insightOutcome'
import { cardFor, REPORT_CARDS } from './reportCards'
import { heldReportFor } from './heldReports'

/** How a business's assessments stand, by status — not passed, passed,
 *  context, can't assess yet — as its page's Assessments panel counts them. */
export type AssessmentStatus = 'failure' | 'success' | 'unknown' | 'pending'
export type AssessmentCounts = Record<AssessmentStatus, number> & {
  /** Each assessment, by the report's name, and how it came out — in the report's order. */
  items: Array<{ cardId: string; label: string; status: AssessmentStatus }>
}

const RANK: Record<Outcome, number> = { fail: 0, review: 1, pass: 2, neutral: 3 }

/**
 * Each assessment the business has, read as its panel reads it: its worst
 * insight's outcome — failed and for review one mark against — or, where an
 * input it needs is missing, can't assess yet. None run, none.
 */
export const assessmentCountsOf = (record: BusinessRecord): AssessmentCounts | undefined => {
  const scope = businessScopeOf(record)
  if (!scope) return undefined
  // Full Business KYB reads as its page does: the report's own snapshot, the
  // record as the report saw it; otherwise the live record.
  const snapshot = scope.full ? heldReportFor(record.name)?.snapshot : undefined
  const read = snapshot?.record ?? record
  const results = snapshot?.results ?? resultsIn(scope, deriveResults(record))
  const groupFor = makeGroupFor(categoriesOf(read))
  const worst = new Map<string, Outcome>()
  for (const r of results) {
    if (r.notReported) continue
    const card = cardFor(r.insightId, groupFor)
    const o = outcomeOf(r, read)
    const was = worst.get(card)
    if (!was || RANK[o] < RANK[was]) worst.set(card, o)
  }
  const inScope = scope.insights ? new Set(scope.insights.map((k) => cardFor(k, groupFor))) : undefined
  const counts: AssessmentCounts = { failure: 0, success: 0, unknown: 0, pending: 0, items: [] }
  for (const { id, label } of REPORT_CARDS) {
    if (inScope && !inScope.has(id)) continue
    const o = worst.get(id)
    const status: AssessmentStatus | undefined = missingInputs(id, read).length
      ? 'pending'
      : !o
        ? undefined
        : o === 'fail' || o === 'review'
          ? 'failure'
          : o === 'pass'
            ? 'success'
            : 'unknown'
    if (!status) continue
    counts[status] += 1
    counts.items.push({ cardId: id, label, status })
  }
  return counts
}
