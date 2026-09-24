import type { BandId } from './identityScore'
import { createLocalStore } from './localStore'
import { CURRENT_USER } from './user'

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
  { id: 'u-sara', name: CURRENT_USER, email: 'smenefee@middesk.com' },
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

/** What is kept: a status only once someone has set one, with the change that set it. */
type Stored = { assigneeId?: string; status?: ReviewStatus; change?: StatusChange }

export type Review = { assigneeId?: string; status: ReviewStatus; change?: StatusChange }

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
  return { assigneeId: stored?.assigneeId, status: stored?.status ?? fallback, change: stored?.change }
}

export const assignReview = (businessId: string, assigneeId: string) =>
  store.set(businessId, { ...(store.get(businessId) ?? {}), assigneeId })

export const setReviewStatus = (businessId: string, status: ReviewStatus, from: ReviewStatus, note?: string) =>
  store.set(businessId, {
    ...(store.get(businessId) ?? {}),
    status,
    change: { from, to: status, by: CURRENT_USER, at: new Date().toISOString(), note: note?.trim() || undefined }
  })
