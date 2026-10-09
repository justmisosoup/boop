import summaryStore from '../../analysis/assessments.json'
import { addedKeys } from './assessmentRuns'
import { ORDER_CATALOG } from './customOrders/catalog'
import { deriveResults, type BusinessRecord, type Derived } from './deriveResults'
import { heldReportFor } from './heldReports'
import { BANDS, identityScore, polarityCounts, type IdentityScore } from './identityScore'
import { outcomeOf } from './insightOutcome'
import { orderedFor, stillOrdering } from './orderedWorkflows'
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
    // Its own insights, and any a next step it ran added (`assessmentRuns`).
    insights: a.insights ? [...new Set([...a.insights, ...addedKeys(record.id, a.id)])] : a.insights,
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
type KeptSummary = { at: string; section: { id: string; body: Paragraph[] }; steps?: Array<{ id: string; why: string }> }
const SUMMARIES = summaryStore as Record<string, Record<string, KeptSummary>>

export type AssessmentRead = {
  assessment: Assessment
  score: IdentityScore | null
  counts: { positive: number; negative: number; neutral: number }
  /** Its insights as the report's score card reads them: the bar under the score. */
  tally: { good: number; review: number; bad: number; neutral: number }
  /** The written summary and when; absent until one is generated. */
  /** `stepWhys`: the session's wording of each next step's why, by step id. */
  summary?: { text: string; at: string; body: Paragraph[]; stepWhys?: Record<string, string> }
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

/** What a failed outcome and one needing review cost an assessment scored on
 *  its outcomes alone: one open finding in a one-insight assessment lands it in
 *  Needs review, two failures in Reject. */
const FAIL_COST = 30
const REVIEW_COST = 15

/**
 * An assessment scored on what it saw, and nothing else.
 *
 * The identity score reads polarity, and some checks have none — a lien on
 * record is neither for nor against the identity, so a Liens assessment gave
 * it nothing to count and came back unscored beside a bar that read red. An
 * assessment is a question asked of its own insights, so where polarity has
 * nothing to say it is answered from their outcomes: 100, less for each
 * failure and each one needing review, banded as every score is.
 */
const outcomeScore = (tally: AssessmentRead['tally']): IdentityScore | null => {
  const total = tally.good + tally.review + tally.bad + tally.neutral
  if (total === 0) return null
  const value = Math.max(0, Math.min(100, 100 - FAIL_COST * tally.bad - REVIEW_COST * tally.review))
  const band = [...BANDS].reverse().find((b) => value >= b.from) ?? BANDS[0]
  return { value, weighted: value, band, components: [], ceilings: [], coverage: 100, findings: tally.bad + tally.review }
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
      // The report's summary of the business; its headline — the call — where it has none.
      summary: (held?.report?.summary ?? held?.report?.headline)
        ? {
            text: (held?.report?.summary ?? held?.report?.headline)!,
            at: held?.at ?? '',
            body: [{ text: (held?.report?.summary ?? held?.report?.headline)! }]
          }
        : undefined,
      ordering: false
    }
  }
  const shown = resultsIn(a, live).filter((r) => !r.notReported)
  const ids = shown.map((r) => r.insightId)
  const kept = SUMMARIES[record.id]?.[a.id]
  const tally = tallyOf(record, shown)
  return {
    assessment: a,
    // The identity score where it can read the insights; where it can't, the
    // assessment's own outcomes — never unscored when it saw something.
    score:
      (ids.length ? identityScore(record, live, [{ id: a.id, name: a.name, insightIds: ids }], scopeOf(a)) : null) ??
      outcomeScore(tally),
    counts: polarityCounts(record, live, ids),
    tally,
    summary: kept
      ? {
          text: kept.section.body[0]?.text ?? '',
          at: kept.at,
          body: kept.section.body,
          stepWhys: kept.steps ? Object.fromEntries(kept.steps.map((x) => [x.id, x.why])) : undefined
        }
      : undefined,
    ordering: a.orderedAt ? stillOrdering({ orderedAt: a.orderedAt, completedAt: a.completedAt }) : false
  }
}

/** Every assessment of a business, read; most severe first. */
export const readAssessments = (record: BusinessRecord): AssessmentRead[] => {
  const live = deriveResults(record)
  return assessmentsOf(record)
    .map((a) => readAssessment(record, a, live))
    .sort((x, y) => (x.score?.value ?? 101) - (y.score?.value ?? 101))
}
