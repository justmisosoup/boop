export type ResultState = 'result' | 'unknown' | 'no_result'

export type NoResultReason =
  | 'not_published'
  | 'not_required'
  | 'not_held_or_unreachable'
  | 'should_exist_not_found'

export type InsightResult = {
  insightId: string
  statement: string
  group: string
  state: ResultState
  /** Present only on a no result. */
  reason?: NoResultReason
  /** Present only on a result, in the insight's own terms. */
  value?: string
  /** Plain-language sentence shown under a no result. Never a code. */
  because?: string
  evidence?: string[]
}

// ---------------------------------------------------------------------------
// The analysis contract.
//
// Shared by the dev-server endpoint and the UI so the shape cannot drift between
// what is written to disk and what is rendered. The analysis is produced by the
// Claude Code session, not an API call — see scripts/analyse-endpoint.ts.
// ---------------------------------------------------------------------------

export type AnalysisRequest = {
  id: string
  requestedAt: string
  businessId: string
  business: {
    name: string
    entityType?: string | null
    state?: string | null
    formed?: string | null
  }
  /**
   * `report` is the standing KYB read, produced without anyone asking — the
   * first thing on the screen. `question` is a follow-up the user typed.
   */
  kind: 'report' | 'question'
  /**
   * The workflow's own brief, the context it is read against, and anything the
   * user typed. NOT the assessments — those are `assessments` below, one item
   * each, so they can be worked at the same time rather than read out of one
   * flattened string.
   */
  prompt: string
  /**
   * Every assessment this run is composed of, in the order the customer composed
   * them. One work unit each: they are independent, they are worked concurrently,
   * and each writes its own file.
   *
   * This is also the manifest the run is judged complete against. Without it the
   * endpoint cannot tell "still working" from "never wrote it", and a
   * recommendation could be served against a report missing a section nobody
   * noticed was absent.
   *
   * Empty for a `question`, which is answered as one `answer` section.
   */
  assessments: Array<{ id: string; name: string; instructions: string }>
  /**
   * EVERY insight on the record. The session picks from these — it cannot pick
   * what it was not given.
   */
  insights: Array<{
    /** insightId verbatim, including the `location_frequency:high` fan-out. */
    id: string
    statement: string
    state: ResultState
    reason?: NoResultReason
    because?: string
    evidence?: string[]
  }>
  /**
   * Ids the user added by hand. The session must use these even if it would not
   * have picked them, and must say what they contribute — including that they
   * do not change the answer, which is a legitimate finding.
   */
  pinned?: string[]
  /**
   * Documents the user attached — a formation certificate, a bank letter, a
   * lease. Written to `analysis/attachments/<requestId>/` by the endpoint; the
   * session reads them off disk and may use them as evidence alongside the
   * insights. They are NOT insights: anything they establish is stated as coming
   * from the document.
   */
  attachments?: Array<{ name: string; type: string; size: number; path: string }>
  history?: Array<{ prompt: string; result: AnalysisResult }>
}

export type CouldNotConfirmReason =
  | 'not_published' // the source does not publish it
  | 'not_held_or_unreachable' // we do not hold it
  | 'not_required' // does not apply to this kind of business
  | 'no_insight_covers_it' // nothing in the catalog speaks to it

/**
 * A section id is the id of the assessment that wrote it.
 *
 * It used to be a closed union of six standing ids, which meant the report could
 * only ever contain what was compiled into it — an assessment the customer wrote
 * had nowhere to land, and `Licensing and regulatory fit` rendered nowhere. The
 * report's shape is now the workflow's: whatever the customer composed, in the
 * order they composed it.
 *
 * Two ids are reserved and never belong to an assessment:
 *
 * - `recommendation` — stage two, the only part that judges, written after every
 *   assessment has landed.
 * - `answer` — a typed follow-up, answered on its own terms rather than forced
 *   through the workflow's headings.
 */
export type AssessmentSectionId = string

/** Ids the runner owns. An assessment may not claim one. */
export const RESERVED_SECTION_IDS = ['recommendation', 'answer'] as const

export type AssessmentSection = {
  id: AssessmentSectionId
  /**
   * What the record establishes in this section — including established
   * ABSENCES.
   *
   * "We searched and found no DBA filing" belongs here: we confirmed an absence.
   * It is not a gap in our data, and filing it under `gaps` would render the one
   * thing counting against the business as missing information.
   *
   * Nothing here is marked, coloured or ranked, not even a finding that counts
   * against the business. State what the record shows, never whether the
   * business is good or bad — the same rule the insight rows follow. What to do
   * about it belongs in the recommendation, which is the only part of the report
   * meant to read as actionable.
   */
  body: Array<{
    text: string
    /**
     * Public sources behind this paragraph — pages on the open web, not the
     * record. Rendered as a "Public sources" chip that opens the links.
     *
     * Permitted **only in the lede**. The whole product rests on never
     * presenting something we did not observe as something we did, so outside
     * knowledge has to arrive with somewhere a reader can go and check it: no
     * links, no claim. It may never look like a finding or stand in for one.
     */
    sources?: Array<{ title: string; url: string }>
    /** Insight ids behind this paragraph, cited at its end. */
    cites?: string[]
  }>
  /**
   * Genuinely open questions in this section — nothing established either way.
   * Scoped to the section rather than pooled at the end, so a gap sits beside
   * the finding it undercuts.
   */
  gaps?: Array<{
    /** Slug, unique within the report. Follow-ups close gaps by this id. */
    id: string
    point: string
    why: CouldNotConfirmReason
    /** Required when `why` is `no_insight_covers_it` — name the check that would. */
    wouldAnswer?: string
    cites?: string[]
    /**
     * Why this gap needs no follow-up, when it genuinely does not.
     *
     * Every gap must be closed by a follow-up or carry this — if a check was
     * run at all, the policy probably requires it, so leaving one unaccounted
     * for is an omission rather than a decision. Saying "this adds nothing the
     * website already carries" is a decision; saying nothing is not.
     */
    noAction?: string
  }>
}

/**
 * One assessment, on its own, as it is written to disk.
 *
 * One file per assessment — `result-<id>.assessments/<assessmentId>.json` — so
 * that several can be written at the same time. They used to share a single file
 * rewritten whole on each append, which meant two writers clobbered each other
 * and a reader could catch it mid-write.
 */
export type AssessmentFile = {
  by: 'claude-code-session'
  assessmentId: string
  /** The assessment's name at the time it ran, used as the section heading. */
  name: string
  /** Insight ids this assessment rests on. Unioned across all of them. */
  used: string[]
  section: AssessmentSection
}

/**
 * Stage one: every assessment, merged.
 *
 * Assembled by the endpoint from the per-assessment files rather than written as
 * one thing. The endpoint will not serve a recommendation until every assessment
 * on the request's manifest has landed — that is what makes "assessments, then
 * recommendation" a fact about the run rather than a claim in a progress list.
 * The UI renders them as they arrive, so a reader watches the argument land
 * before the conclusion.
 *
 * It never contains a `recommendation` section. That is stage two.
 */
export type AnalysisDraft = {
  by: 'claude-code-session'
  /** Insight ids the assessments rest on. The verdict may not reach past these. */
  used: string[]
  sections: AssessmentSection[]
}

/**
 * Stage two: the verdict, written against the assessments already on disk.
 *
 * Its citations are checked to be a subset of the assessments' — a conclusion
 * resting on something none of the assessments discussed is incoherent, and is
 * rejected rather than rendered.
 */
export type AnalysisVerdict = {
  /**
   * One sentence answering the question asked.
   *
   * It renders on a typed question, where it is the answer. On a standing
   * report it does not: the follow-ups under `Recommendations` are what a
   * reviewer acts on, and a sentence saying "onboard subject to conditions"
   * above them only named what the list already is. Still written, still
   * validated — it is what records which of the three decisions was reached.
   */
  headline: string
  /**
   * Carried with an empty `body`. The section renders the follow-ups and
   * nothing else: the assessments above hold the evidence and the reader has
   * just read them, so a paragraph here said everything twice in the one place
   * meant to be acted on.
   */
  recommendation: AssessmentSection
  /**
   * What to follow up with, **ordered by what needs doing first** — not grouped
   * into things to do and things to order. An analyst working down the list
   * should be able to stop at any point and know that everything above the line
   * mattered more than everything below it.
   *
   * The whole of the recommendation section, and genuinely a list: discrete
   * actions, done independently, in an order. Each is one thing a reviewer does
   * before the account opens, with only the facts that justify it behind the
   * instruction. If nobody could act on it tomorrow it is not one — a connected
   * business that is plainly a neighbour belongs in the assessment that found
   * it. Two things produce a step: something the record leaves open, and
   * something a registry does not publish.
   */
  followUps: Array<{
    text: string
    /** Insight ids this follow-up answers for. */
    cites?: string[]
    /** Gap ids this step closes. Validated against the assessments. */
    closes?: string[]
    /**
     * Named things the step acts on — the entities to run it against.
     *
     * A follow-up that says "establish who is behind the connected businesses"
     * is not actionable until it names them. These come from a source the
     * assessments do not carry (the connections endpoint names what the review
     * task only counts), so they ride on the step rather than being cited.
     */
    entities?: Array<{ name: string; note?: string }>
  }>
}

/** The two stages merged by the endpoint. What the UI renders. */
export type AnalysisResult = AnalysisDraft &
  Omit<AnalysisVerdict, 'recommendation'> & {
    /** Rendered in canonical order, not the order written. */
    sections: AssessmentSection[]
  }
