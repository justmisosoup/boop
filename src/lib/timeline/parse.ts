/*
 * Ported verbatim from the dashboard: `app/src/containers/Timeline/parse.ts`
 * (rebuilt in `c4379d1cd`). This file is a clone — change it upstream and
 * re-copy, the way `src/core` is handled (PARITY.md).
 *
 * Only the imports differ, and only where the prototype has no equivalent:
 *   - `getFullStateNameFromAbbreviation` is `stateName` here
 *   - `TimelineEvent` lives beside the domain rather than in a global `types`
 */

import { stateName as fullStateName } from '../states'
import { displayCase, humanizeEventType } from './format'
import type { TimelineEvent } from './types'
import type { Change, ChangeAction, Jurisdiction, Kind, Source } from './types'

type SourceMetadata = {
  state?: string
  file_number?: string
  jurisdiction?: Jurisdiction
}

type WireSource = { id?: string; type?: string; metadata?: SourceMetadata }

type WireObject = {
  id?: string
  object?: string
  name?: string
  type?: string
  status?: string
  state?: string
  file_number?: string
  jurisdiction?: Jurisdiction
  full_address?: string
  titles?: Array<{ title?: string }>
  sources?: WireSource[]
}

type Wire = {
  object?: WireObject
  previous_attributes?: { status?: string }
}

const KIND_BY_NOUN: Record<string, Kind> = {
  person: 'officer',
  name: 'name',
  address: 'address'
}

export const kindOf = (eventType: string): Kind => {
  if (eventType === 'registration.created') return 'registration'
  if (eventType === 'registration.updated') return 'standing'
  return KIND_BY_NOUN[eventType.split('.')[0]] ?? 'other'
}

const actionOf = (eventType: string, kind: Kind): ChangeAction => {
  if (kind === 'registration') return 'created'
  if (kind === 'standing') return 'changed'
  if (kind === 'other') return 'noted'
  return eventType.endsWith('.deleted') ? 'removed' : 'added'
}

const sourceOf = (object: WireObject | undefined, kind: Kind): Source => {
  const isRegistration = kind === 'registration' || kind === 'standing'
  const filing =
    object?.sources?.find(source => source.type === 'registration') ??
    object?.sources?.[0]
  const meta: SourceMetadata | undefined = isRegistration
    ? object
    : filing?.metadata
  const state = meta?.state
  return {
    state,
    stateName: state ? fullStateName(state) : undefined,
    fileNumber: meta?.file_number,
    jurisdiction: meta?.jurisdiction,
    registrationId: isRegistration
      ? object?.id
      : filing?.type === 'registration'
        ? filing.id
        : undefined
  }
}

const statusLabel = (status: string): string =>
  status.charAt(0).toUpperCase() +
  status.slice(1).toLowerCase().replace(/_/g, ' ')

const NAME_TYPE_LABEL: Record<string, string> = {
  dba: 'DBA',
  legal: 'Legal name',
  trade: 'Trade name'
}

export const parseEvent = (event: TimelineEvent): Change | null => {
  const wire = event.data as Wire
  const object = wire.object
  const kind = kindOf(event.type)
  const action = actionOf(event.type, kind)
  const base = {
    id: event.id,
    eventType: event.type,
    kind,
    action,
    occurredAt: event.occurred_at,
    hasTime: kind !== 'registration',
    source: sourceOf(object, kind)
  }

  switch (kind) {
    case 'standing': {
      const from = wire.previous_attributes?.status
      const to = object?.status
      if (!from || !to || from === to) return null
      return {
        ...base,
        value: statusLabel(from),
        from: statusLabel(from),
        to: statusLabel(to)
      }
    }
    case 'registration':
      return { ...base, value: 'Registration created' }
    case 'officer': {
      const titles = (object?.titles ?? [])
        .map(t => t.title)
        .filter((t): t is string => Boolean(t))
        .map(displayCase)
      return {
        ...base,
        value: displayCase(object?.name ?? 'Unnamed officer'),
        detail: titles.length ? titles.join(', ') : undefined
      }
    }
    case 'address':
      return { ...base, value: displayCase(object?.full_address ?? 'Address') }
    case 'name':
      return {
        ...base,
        value: displayCase(object?.name ?? 'Name'),
        detail: object?.type
          ? (NAME_TYPE_LABEL[object.type] ?? displayCase(object.type))
          : undefined
      }
    default:
      return { ...base, value: humanizeEventType(event.type) }
  }
}
