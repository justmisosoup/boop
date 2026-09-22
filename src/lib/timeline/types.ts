/*
 * Ported verbatim from the dashboard: `app/src/containers/Timeline/types.ts`
 * (rebuilt in `c4379d1cd`). This file is a clone — change it upstream and
 * re-copy, the way `src/core` is handled (PARITY.md).
 *
 * Only the imports differ, and only where the prototype has no equivalent:
 *   - `TimelineEvent`/`TimelineResponse` are appended here; the app keeps them in its global `types.ts`
 */

export type Kind =
  | 'officer'
  | 'name'
  | 'address'
  | 'registration'
  | 'standing'
  | 'other'

export type ChangeAction = 'added' | 'removed' | 'created' | 'changed' | 'noted'

export type Jurisdiction = 'DOMESTIC' | 'FOREIGN' | 'UNKNOWN'

export type Source = {
  state?: string
  stateName?: string
  fileNumber?: string
  jurisdiction?: Jurisdiction
  /** Id of the registration the filing belongs to. */
  registrationId?: string
}

export type Change = {
  id: string
  eventType: string
  kind: Kind
  action: ChangeAction
  value: string
  detail?: string
  from?: string
  to?: string
  occurredAt: string
  hasTime: boolean
  source: Source
}

export type FilingUpdate = {
  id: string
  occurredAt: string
  date: Date
  hasTime: boolean
  source: Source
  changes: Change[]
  kinds: Kind[]
}

/**
 * One event as `GET /v1/businesses/:id/timeline` returns it.
 *
 * `app/src/types.ts:2133`. `data` is untyped on the wire; `parse.ts` narrows it
 * locally, which is where every assumption about its shape lives.
 */
export type TimelineEvent = {
  id: string
  type: string
  created_at: string
  occurred_at: string
  data: Record<string, unknown>
}

export type TimelineResponse = {
  data: TimelineEvent[]
  total_count: number
  has_more: boolean
}
