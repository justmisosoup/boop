/*
 * Ported verbatim from the dashboard:
 * `app/src/containers/Timeline/filters.ts`. Change it upstream and re-copy.
 */

import { KIND_ORDER } from './constants'
import { changeDay } from './format'
import { kindsOf } from './group'
import type { Change, FilingUpdate, Kind } from './types'

export type Show = 'all' | 'added' | 'removed'

export type TimelineFilters = {
  from: string | null
  to: string | null
  kinds: Kind[]
  show: Show
}

export const EMPTY_FILTERS: TimelineFilters = {
  from: null,
  to: null,
  kinds: [],
  show: 'all'
}

export const isFilterActive = (filters: TimelineFilters): boolean =>
  filters.from !== null ||
  filters.to !== null ||
  filters.kinds.length > 0 ||
  filters.show !== 'all'

export const hidesChanges = (filters: TimelineFilters): boolean =>
  filters.kinds.length > 0 || filters.show !== 'all'

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

const changeMatches = (change: Change, filters: TimelineFilters): boolean => {
  if (filters.kinds.length && !filters.kinds.includes(change.kind)) return false
  if (filters.show === 'added' && change.action !== 'added') return false
  if (filters.show === 'removed' && change.action !== 'removed') return false
  if (filters.from || filters.to) {
    const day = changeDay(change.occurredAt, change.hasTime)
    if (filters.from && day < filters.from) return false
    if (filters.to && day > filters.to) return false
  }
  return true
}

export const applyFilters = (
  updates: FilingUpdate[],
  filters: TimelineFilters
): FilingUpdate[] => {
  if (!isFilterActive(filters)) return updates
  return updates.flatMap(update => {
    const changes = update.changes.filter(change =>
      changeMatches(change, filters)
    )
    return changes.length
      ? [{ ...update, changes, kinds: kindsOf(changes) }]
      : []
  })
}

const isKind = (value: string): value is Kind =>
  (KIND_ORDER as string[]).includes(value)

export const parseFilters = (search: string): TimelineFilters => {
  const params = new URLSearchParams(search)
  const from = params.get('from')
  const to = params.get('to')
  const show = params.get('show')
  return {
    from: from && ISO_DAY.test(from) ? from : null,
    to: to && ISO_DAY.test(to) ? to : null,
    kinds: (params.get('kinds') ?? '').split(',').filter(isKind),
    show: show === 'added' || show === 'removed' ? show : 'all'
  }
}

export type FilterParams = Record<
  'from' | 'to' | 'kinds' | 'show',
  string | null
>

/** The filters as query values; `null` clears that key. */
export const filterParams = (filters: TimelineFilters): FilterParams => ({
  from: filters.from,
  to: filters.to,
  kinds: filters.kinds.length ? filters.kinds.join(',') : null,
  show: filters.show === 'all' ? null : filters.show
})

export const serializeFilters = (filters: TimelineFilters): string => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filterParams(filters)))
    if (value) params.set(key, value)
  return params.toString()
}
