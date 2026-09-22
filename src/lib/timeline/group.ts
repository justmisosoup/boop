/*
 * Ported verbatim from the dashboard: `app/src/containers/Timeline/group.ts`
 * (rebuilt in `c4379d1cd`). This file is a clone — change it upstream and
 * re-copy, the way `src/core` is handled (PARITY.md).
 *
 * Only the imports differ, and only where the prototype has no equivalent:
 *   - `TimelineEvent` lives beside the domain rather than in a global `types`
 */

import dayjs from '../dayjs'

import { KIND_ORDER } from './constants'
import { changeDate, changeDay } from './format'
import { parseEvent } from './parse'
import type { Change, FilingUpdate, Kind, TimelineEvent } from './types'

const minuteKey = (change: Change): string =>
  change.hasTime ? dayjs(change.occurredAt).format('HH:mm') : 'no-time'

const updateKey = (change: Change): string =>
  [
    changeDay(change.occurredAt, change.hasTime),
    minuteKey(change),
    change.source.state ?? 'no-state',
    change.source.fileNumber ?? 'no-filing'
  ].join('|')

const byNewest = (a: Change, b: Change): number => {
  const dayA = changeDay(a.occurredAt, a.hasTime)
  const dayB = changeDay(b.occurredAt, b.hasTime)
  if (dayA !== dayB) return dayA < dayB ? 1 : -1
  if (a.hasTime !== b.hasTime) return a.hasTime ? -1 : 1
  return a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : 0
}

export const kindsOf = (changes: Change[]): Kind[] => {
  const present = new Set(changes.map(change => change.kind))
  return KIND_ORDER.filter(kind => present.has(kind))
}

export const groupUpdates = (events: TimelineEvent[]): FilingUpdate[] => {
  const changes = events
    .map(parseEvent)
    .filter((change): change is Change => change !== null)
    .sort(byNewest)

  const updates = new Map<string, FilingUpdate>()
  for (const change of changes) {
    const key = updateKey(change)
    const existing = updates.get(key)
    if (existing) {
      existing.changes.push(change)
      continue
    }
    updates.set(key, {
      id: key,
      occurredAt: change.occurredAt,
      date: changeDate(change.occurredAt, change.hasTime),
      hasTime: change.hasTime,
      source: change.source,
      changes: [change],
      kinds: []
    })
  }

  return [...updates.values()].map(update => ({
    ...update,
    kinds: kindsOf(update.changes)
  }))
}

export const countChanges = (updates: FilingUpdate[]): number =>
  updates.reduce((sum, update) => sum + update.changes.length, 0)

export const yearsOf = (updates: FilingUpdate[]): number[] =>
  [...new Set(updates.map(update => update.date.getFullYear()))].sort()
