import type { BandId } from './identityScore'
import { createLocalStore } from './localStore'
import { formatStamp } from './reportLabels'
import { CURRENT_USER } from './user'

/**
 * The reviewer's determination on a report.
 *
 * The assessment reaches a determination; the reviewer confirms it or
 * overrides it — a Review they approve after reading the file, an Approve
 * they reject for a reason no check reaches. One word for both, because they
 * are the same thing with a different author. Recorded against the REPORT,
 * not the business: a later run is a later file, and a determination on it is
 * a new one.
 */
export type DecisionOutcome = 'approve' | 'decline' | 'rfi'

export type Decision = {
  outcome: DecisionOutcome
  /** One of `REASON_CODES[outcome]`. */
  reason: string
  note: string
  by: string
  /** ISO timestamp. */
  at: string
}

/** As a status, for the list. */
export const OUTCOME_LABEL: Record<DecisionOutcome, string> = {
  approve: 'Approved',
  decline: 'Rejected',
  rfi: 'Info requested'
}

/** The verb, for the button that records it — the band's own words. */
export const OUTCOME_VERB: Record<DecisionOutcome, string> = {
  approve: 'Approve',
  decline: 'Reject',
  rfi: 'Request info'
}

/** As the card's heading, when the reviewer's determination replaces the assessment's. */
export const OUTCOME_HEADING: Record<DecisionOutcome, string> = {
  approve: 'Approve',
  decline: 'Reject',
  rfi: 'Info requested'
}

/** The assessment's band as an outcome a reviewer can confirm. Review is not
 *  one: it asks the reviewer to decide, so there is nothing to confirm. */
export const bandOutcome = (band: BandId): DecisionOutcome | null =>
  band === 'established' ? 'approve' : band === 'not_established' ? 'decline' : null

/** The reason code a confirmation carries. */
export const CONFIRMED = 'Assessment determination confirmed'

export const decisionStamp = (iso: string) => formatStamp(iso)

export const OUTCOME_TONE: Record<DecisionOutcome, 'success' | 'danger' | 'warning'> = {
  approve: 'success',
  decline: 'danger',
  rfi: 'warning'
}

/**
 * Reason codes, one list per outcome. A compliance file wants a code it can
 * report on, not free text alone; the note carries the rest.
 */
export const REASON_CODES: Record<DecisionOutcome, string[]> = {
  approve: ['Identity established', 'Flagged insights resolved on review', 'Policy exception approved'],
  decline: [
    'Registration inactive or dissolved',
    'TIN does not match the name',
    'Sanctions or watchlist match',
    'Identity not established',
    'Prohibited line of business'
  ],
  rfi: [
    'Certificate of Good Standing',
    'Ownership documentation',
    'Proof of business address',
    'Line of business or licence'
  ]
}

const store = createLocalStore<Decision>('prototype.decisions.v1')

export const useDecisions = store.useAll

export const useDecision = (reportId?: string | null): Decision | null => {
  const all = useDecisions()
  return reportId ? all[reportId] ?? null : null
}

export const recordDecision = (reportId: string, input: Pick<Decision, 'outcome' | 'reason' | 'note'>) =>
  store.set(reportId, { ...input, by: CURRENT_USER, at: new Date().toISOString() })

export const withdrawDecision = (reportId: string) => store.remove(reportId)

/** The list's status word for a report: its decision, or that nobody has made one. */
export const decisionStatus = (decision: Decision | null | undefined) =>
  decision ? OUTCOME_LABEL[decision.outcome] : 'Unreviewed'
