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
  prompt: string
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
 * The standing report's shape. The assessment is not one prose blob: it is the
 * same six sections every time, so two businesses can be read against each other
 * and a reader knows where to look. `answer` is the exception — a follow-up
 * question is answered on its own terms, not forced through six headings.
 *
 * `description` is the lede, not a peer: it renders without a heading, above
 * everything, and it does not judge — it says what the business is so the four
 * assessments beneath it have something to be about. `recommendation` is where
 * the judging happens, and where the headline is stated.
 */
export type AssessmentSectionId =
  | 'description'
  | 'identity'
  | 'ownership'
  | 'activity'
  | 'compliance'
  | 'recommendation'
  | 'answer'

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
 * Stage one: the assessments, written before any verdict exists.
 *
 * This is a separate file on disk, and the endpoint will not serve a
 * recommendation until it is there. That is what makes "assessments, then
 * recommendation" a fact about the run rather than a claim in a progress list —
 * the two cannot be written in the other order, and the UI renders the
 * assessments while the recommendation is still outstanding, so a reader sees
 * the sequence happen.
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
  /** One sentence answering the question asked. */
  headline: string
  recommendation: AssessmentSection
  /**
   * What to follow up with, **ordered by what needs doing first** — not grouped
   * into things to do and things to order. An analyst working down the list
   * should be able to stop at any point and know that everything above the line
   * mattered more than everything below it.
   *
   * The one part of the report that is a list rather than prose, because it is
   * genuinely a list: discrete items, done independently, in an order.
   */
  followUps: Array<{
    text: string
    /** Insight ids this follow-up answers for. */
    cites?: string[]
    /** Gap ids this step closes. Validated against the assessments. */
    closes?: string[]
  }>
}

/** The two stages merged by the endpoint. What the UI renders. */
export type AnalysisResult = AnalysisDraft &
  Omit<AnalysisVerdict, 'recommendation'> & {
    /** Rendered in canonical order, not the order written. */
    sections: AssessmentSection[]
  }
