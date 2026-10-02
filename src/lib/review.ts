import type { BandId } from './identityScore'
import { createLocalStore } from './localStore'
import { CURRENT_USER, CURRENT_USER_EMAIL } from './user'

/**
 * Who owns a business's review, and where it stands.
 *
 * The dashboard keeps these on the business (`assignee_id`, `status`) and
 * changes them over the API. There is no API here, so they live in the browser
 * — see `localStore` — keyed by business id, and every business starts the way
 * a new one does in the dashboard: unassigned, in review.
 */
export type ReviewStatus = 'approved' | 'in_review' | 'rejected'

/** `REVIEW_STATUSES` in the dashboard's constants, in its order. */
export const REVIEW_STATUSES: readonly ReviewStatus[] = ['approved', 'in_review', 'rejected']

export type TeamMember = { id: string; name: string; email: string }

/**
 * The team, standing in for `/v1/users`. The signed-in user first; the others
 * exist so the picker is a picker.
 */
export const TEAM: readonly TeamMember[] = [
  { id: 'u-alex', name: CURRENT_USER, email: CURRENT_USER_EMAIL },
  { id: 'u-priya', name: 'Priya Raman', email: 'praman@middesk.com' },
  { id: 'u-marcus', name: 'Marcus Lee', email: 'mlee@middesk.com' }
]

export const CURRENT_USER_ID = TEAM[0].id

/** A status change, as the assessment cites it: from what, to what, by whom, when, and why. */
export type StatusChange = {
  from: ReviewStatus
  to: ReviewStatus
  by: string
  /** ISO timestamp. */
  at: string
  note?: string
}

/** What is kept: a status only once someone has set one, with the change that set it.
 *  `prior` is what an accepted recommendation replaced, so Undo can put it back. */
type Stored = {
  assigneeId?: string
  status?: ReviewStatus
  change?: StatusChange
  /** Information requested from the applicant, as the recommendation drafted it. */
  requested?: InformationRequest
  /** The analyst's answer to the recommendation. */
  answer?: RecommendationAnswer
  prior?: Omit<Stored, 'prior'>
}

/**
 * The analyst's answer to the recommendation, in the status's own words —
 * approve or reject the business — with their own note attached, who, when.
 */
export type RecommendationAnswer = {
  choice: 'approve' | 'reject'
  note?: string
  by: string
  /** ISO timestamp. */
  at: string
}

/** What was asked of the applicant: the items, the message, who and when. */
export type InformationRequest = { items: string[]; message: string; by: string; at: string }

export type Review = {
  assigneeId?: string
  status: ReviewStatus
  change?: StatusChange
  requested?: InformationRequest
  answer?: RecommendationAnswer
}

const store = createLocalStore<Stored>('prototype.review.v1')

/**
 * The status the assessment's determination implies, before anyone has set
 * one: an Approve reads as approved, a Reject as rejected, a Needs review as
 * in review. A reviewer's own pick, once made, replaces it.
 */
export const statusForBand = (band: BandId | undefined): ReviewStatus =>
  band === 'established' ? 'approved' : band === 'not_established' ? 'rejected' : 'in_review'

export const useReview = (businessId: string, fallback: ReviewStatus = 'in_review'): Review => {
  const all = store.useAll()
  const stored = all[businessId]
  return {
    assigneeId: stored?.assigneeId,
    status: stored?.status ?? fallback,
    change: stored?.change,
    requested: stored?.requested,
    answer: stored?.answer
  }
}

/** A business's review outside React — what a question about the whole list reads. */
export const reviewOf = (businessId: string, fallback: ReviewStatus = 'in_review'): Review => {
  const stored = store.get(businessId)
  return {
    assigneeId: stored?.assigneeId,
    status: stored?.status ?? fallback,
    change: stored?.change,
    requested: stored?.requested,
    answer: stored?.answer
  }
}

export const assignReview = (businessId: string, assigneeId: string) =>
  store.set(businessId, { ...(store.get(businessId) ?? {}), assigneeId })

export const setReviewStatus = (businessId: string, status: ReviewStatus, from: ReviewStatus, note?: string) =>
  store.set(businessId, {
    ...(store.get(businessId) ?? {}),
    status,
    change: { from, to: status, by: CURRENT_USER, at: new Date().toISOString(), note: note?.trim() || undefined }
  })

/** The note an accepted recommendation is recorded with. */
const ACCEPTED_NOTE = 'Accepted the recommendation'

/**
 * The reviewer takes the assessment's recommendation as their decision.
 *
 * Recorded the way any status change is — who, when, from what — with what it
 * replaced kept beside it, so it can be undone exactly.
 */
export const acceptRecommendation = (businessId: string, status: ReviewStatus, from: ReviewStatus) => {
  const current = store.get(businessId) ?? {}
  const { prior: _drop, ...prior } = current
  void _drop
  store.set(businessId, {
    ...prior,
    status,
    change: { from, to: status, by: CURRENT_USER, at: new Date().toISOString(), note: ACCEPTED_NOTE },
    prior
  })
}

/**
 * The analyst answers the recommendation — Approve or Reject — with an
 * optional note. Sets the status the way any change does, with what it
 * replaced kept beside it, so Undo puts it back exactly. An answer that is
 * the recommended call is recorded as the recommendation accepted.
 */
export const answerRecommendation = (
  businessId: string,
  answer: Pick<RecommendationAnswer, 'choice' | 'note'>,
  from: ReviewStatus,
  recommended: boolean
) => {
  const current = store.get(businessId) ?? {}
  const { prior: _drop, ...prior } = current
  void _drop
  const at = new Date().toISOString()
  const note = answer.note?.trim() || undefined
  const status: ReviewStatus = answer.choice === 'approve' ? 'approved' : 'rejected'
  store.set(businessId, {
    ...prior,
    status,
    change: { from, to: status, by: CURRENT_USER, at, note: recommended ? ACCEPTED_NOTE : note },
    answer: { choice: answer.choice, note, by: CURRENT_USER, at },
    prior
  })
}

/** Undo the analyst's answer. */
export const undoAnswer = (businessId: string) => restorePrior(businessId)

/** Put back what the recommendation's answer replaced. The assignee stays as it is now. */
const restorePrior = (businessId: string) => {
  const current = store.get(businessId)
  if (!current?.prior) return
  const { assigneeId } = current
  const restored: Stored = { ...current.prior, ...(assigneeId ? { assigneeId } : {}) }
  // Nothing set before it: no entry, as there was none.
  if (Object.values(restored).every((v) => v === undefined)) store.remove(businessId)
  else store.set(businessId, restored)
}

/** Whether the status on a review is an accepted recommendation of this status. */
export const acceptedRecommendation = (review: Review, status: ReviewStatus) =>
  review.status === status && review.change?.note === ACCEPTED_NOTE && review.change.to === status

/** Undo an accepted recommendation. */
export const undoAcceptance = (businessId: string) => restorePrior(businessId)

/**
 * The reviewer asks the applicant for what the record is short of — the
 * recommendation's steps, as the message they sent. The status is left as it
 * is: the review is still open while the information is outstanding.
 */
export const requestInformation = (businessId: string, items: string[], message: string) => {
  const current = store.get(businessId) ?? {}
  const { prior: _drop, ...prior } = current
  void _drop
  store.set(businessId, {
    ...prior,
    requested: { items, message, by: CURRENT_USER, at: new Date().toISOString() },
    prior
  })
}

/** Undo a recorded request. */
export const undoRequest = (businessId: string) => restorePrior(businessId)

/** Whether information has been requested on this review. */
export const informationRequested = (review: Review) => Boolean(review.requested)
