import summaryStore from '../../analysis/assessments.json'
import { ORDER_CATALOG } from './customOrders/catalog'
import { deriveResults, type BusinessRecord, type Derived } from './deriveResults'
import { heldReportFor } from './heldReports'
import { identityScore, polarityCounts, type IdentityScore } from './identityScore'
import { outcomeOf } from './insightOutcome'
import { orderedFor } from './orderedWorkflows'
import { assessmentOf } from './records'

/**
 * A business's Assessments: one per custom order it was ordered with.
 *
 * Each reads only its own insights — its own score, its own split of negative,
 * neutral and positive, its own written summary. A business ordered before
 * custom orders existed (every record pulled so far) was ordered with every
 * insight, so it has one: "Full Business KYB", which reads exactly as the report
 * always has. It is not a combined view of other assessments.
 */
export type Assessment = {
  id: string
  name: string
  /** Catalog insight keys; absent on "Full Business KYB", which reads everything. */
  insights?: string[]
  customOrderId?: string
  orderedAt?: string
  /** Absent while its orders are still running. */
  completedAt?: string
  full: boolean
}

export const FULL_REPORT = 'full-report'

export const assessmentsOf = (record: Pick<BusinessRecord, 'id' | 'name'>): Assessment[] => {
  const ordered = orderedFor(record.id)?.assessments ?? []
  // Its report from before custom orders stays one of its assessments, beside
  // any ordered since.
  const full: Assessment[] =
    ordered.length === 0 || heldReportFor(record.name) ? [{ id: FULL_REPORT, name: 'Full Business KYB', full: true }] : []
  return [...full, ...ordered.map((a) => ({
    id: a.id,
    name: a.name,
    insights: a.insights,
    customOrderId: a.customOrderId,
    orderedAt: a.orderedAt,
    completedAt: a.completedAt,
    full: false
  }))]
}

export const assessmentById = (record: Pick<BusinessRecord, 'id' | 'name'>, id: string | undefined) =>
  id ? assessmentsOf(record).find((a) => a.id === id) : undefined

/** The insight keys an assessment is scoped to; undefined reads everything. */
export const scopeOf = (a: Assessment | undefined): ReadonlySet<string> | undefined =>
  a?.insights ? new Set(a.insights) : undefined

/** The results an assessment reads: its keys, by the part of the id before `:`. */
export const resultsIn = (a: Assessment | undefined, results: Derived[]): Derived[] => {
  const scope = scopeOf(a)
  return scope ? results.filter((r) => scope.has(r.insightId.split(':')[0])) : results
}

/** Insight group labels, for a summary's brief. */
export const groupLabelsOf = (a: Assessment) =>
  ORDER_CATALOG.insight_groups
    .filter((g) => g.insight_keys.some((k) => a.insights?.includes(k)))
    .map((g) => g.label)

type Paragraph = { text: string; cites?: string[] }
type KeptSummary = { at: string; section: { id: string; body: Paragraph[] } }
const SUMMARIES = summaryStore as Record<string, Record<string, KeptSummary>>

export type AssessmentRead = {
  assessment: Assessment
  score: IdentityScore | null
  counts: { positive: number; negative: number; neutral: number }
  /** Its insights as the report's score card reads them: the bar under the score. */
  tally: { good: number; review: number; bad: number; neutral: number }
  /** The written summary and when; absent until one is generated. */
  summary?: { text: string; at: string; body: Paragraph[] }
  /** Its orders are still running. */
  ordering: boolean
}

/**
 * One assessment, read: its score over its own insights, applying only the
 * ceilings those insights raise, and its counts. "Full Business KYB" reads the held
 * report's score, so its card says what the report always said.
 */
const tallyOf = (record: BusinessRecord, results: Derived[]) => {
  const read = results.filter((r) => !r.notReported).map((r) => outcomeOf(r, record))
  return {
    good: read.filter((o) => o === 'pass').length,
    review: read.filter((o) => o === 'review').length,
    bad: read.filter((o) => o === 'fail').length,
    neutral: read.filter((o) => o === 'neutral').length
  }
}

export const readAssessment = (record: BusinessRecord, a: Assessment, live = deriveResults(record)): AssessmentRead => {
  if (a.full) {
    const held = heldReportFor(record.name)
    const listed = assessmentOf(record)
    // The bar the report's own card draws: its snapshot, read as it reads it.
    const snap = held?.snapshot
    return {
      assessment: a,
      score: listed?.score ?? null,
      counts: listed?.counts ?? { positive: 0, negative: 0, neutral: 0 },
      tally: tallyOf(snap?.record ?? record, snap?.results ?? live),
      summary: held?.report?.headline
        ? { text: held.report.headline, at: held.at ?? '', body: [{ text: held.report.headline }] }
        : undefined,
      ordering: false
    }
  }
  const shown = resultsIn(a, live).filter((r) => !r.notReported)
  const ids = shown.map((r) => r.insightId)
  const kept = SUMMARIES[record.id]?.[a.id]
  return {
    assessment: a,
    score: ids.length ? identityScore(record, live, [{ id: a.id, name: a.name, insightIds: ids }], scopeOf(a)) : null,
    counts: polarityCounts(record, live, ids),
    tally: tallyOf(record, shown),
    summary: kept ? { text: kept.section.body[0]?.text ?? '', at: kept.at, body: kept.section.body } : undefined,
    ordering: !a.completedAt
  }
}

/** Every assessment of a business, read; most severe first. */
export const readAssessments = (record: BusinessRecord): AssessmentRead[] => {
  const live = deriveResults(record)
  return assessmentsOf(record)
    .map((a) => readAssessment(record, a, live))
    .sort((x, y) => (x.score?.value ?? 101) - (y.score?.value ?? 101))
}
