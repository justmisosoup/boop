/*
 * Ported verbatim from the dashboard: `app/src/containers/Timeline/ChangeRow.tsx`
 * (rebuilt in `c4379d1cd`). Every class string is the app's own — this half of
 * the tab is already Tailwind over `--core-*`, so it crosses without
 * re-expression. Change it upstream and re-copy (PARITY.md).
 *
 * Only the imports differ:
 *   - the domain moved to `src/lib/timeline`
 */

import { type EntityState, EntityStateBadge } from '@/core'
import { ArrowRight, Check, Dot, Minus, Plus } from 'lucide-react'

import { KIND_LABEL } from '../../lib/timeline/constants'
import type { Change, ChangeAction } from '../../lib/timeline/types'
import { cn } from '../../utils/twUtils'

const NEUTRAL_GLYPH = 'border border-border bg-card text-muted-foreground'

const GLYPH: Record<ChangeAction, { icon: typeof Plus; className: string }> = {
  added: {
    icon: Plus,
    className:
      'bg-[var(--core-color-status-success-bg)] text-[var(--core-color-status-success-fg)]'
  },
  removed: {
    icon: Minus,
    className:
      'bg-[var(--core-color-status-warning-bg)] text-[var(--core-color-status-warning-fg)]'
  },
  created: { icon: Check, className: NEUTRAL_GLYPH },
  changed: { icon: ArrowRight, className: NEUTRAL_GLYPH },
  noted: { icon: Dot, className: NEUTRAL_GLYPH }
}

const ACTION_LABEL: Record<ChangeAction, string> = {
  added: 'added',
  removed: 'removed',
  created: 'created',
  changed: 'changed',
  noted: ''
}

const changeLabel = (change: Change): string => {
  if (change.kind === 'other') return change.value
  return `${KIND_LABEL[change.kind].singular} ${ACTION_LABEL[change.action]}`.trim()
}

const INACTIVE_WORDS = [
  'inactive',
  'suspended',
  'revoked',
  'dissolved',
  'forfeited',
  'delinquent',
  'cancelled',
  'canceled',
  'terminated',
  'expired',
  'withdrawn'
]

const toEntityState = (status: string): EntityState => {
  const lower = status.toLowerCase()
  if (lower.includes('active') && !lower.includes('inactive')) return 'active'
  if (INACTIVE_WORDS.some(word => lower.includes(word))) return 'inactive'
  return 'unknown'
}

const Value = ({ change }: { change: Change }) => {
  if (change.action === 'changed' && change.from && change.to) {
    return (
      <span className='inline-flex items-center gap-2'>
        <EntityStateBadge state={toEntityState(change.from)}>
          {change.from}
        </EntityStateBadge>
        <span className='text-muted-foreground text-xs'>to</span>
        <EntityStateBadge state={toEntityState(change.to)}>
          {change.to}
        </EntityStateBadge>
      </span>
    )
  }
  if (change.action === 'created') {
    const agency = change.source.stateName
      ? `Secretary of State · ${change.source.stateName}`
      : 'Secretary of State'
    return <span className='text-muted-foreground'>{agency}</span>
  }
  if (change.kind === 'other') {
    return <span className='text-muted-foreground'>{change.eventType}</span>
  }
  return (
    <>
      <span className='font-semibold text-foreground'>{change.value}</span>
      {change.detail && (
        <span className='text-muted-foreground'> · {change.detail}</span>
      )}
    </>
  )
}

export const ChangeRow = ({ change }: { change: Change }) => {
  const glyph = GLYPH[change.action]
  const Icon = glyph.icon
  return (
    <div className='flex min-h-[var(--tl-row-h,32px)] items-center gap-2.5'>
      <span
        aria-hidden='true'
        className={cn(
          'grid size-[18px] shrink-0 place-items-center rounded-full',
          glyph.className
        )}
      >
        <Icon className='size-3' strokeWidth={2.5} />
      </span>
      <span className='w-[var(--tl-label-w,144px)] shrink-0 text-body text-foreground'>
        {changeLabel(change)}
      </span>
      <span
        className='min-w-0 truncate text-body'
        title={
          change.detail ? `${change.value} · ${change.detail}` : change.value
        }
      >
        <Value change={change} />
      </span>
    </div>
  )
}
