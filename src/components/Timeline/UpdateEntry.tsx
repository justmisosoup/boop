/*
 * Ported verbatim from the dashboard: `app/src/containers/Timeline/UpdateEntry.tsx`
 * (rebuilt in `c4379d1cd`). Every class string is the app's own — this half of
 * the tab is already Tailwind over `--core-*`, so it crosses without
 * re-expression. Change it upstream and re-copy (PARITY.md).
 *
 * Only the imports differ:
 *   - the domain moved to `src/lib/timeline`
 *   - `businessId` is threaded to the source chip
 */

import { useState } from 'react'

import { ActionButton } from '@/core'
import { Activity, FileText, Landmark, MapPin, Type, User } from 'lucide-react'

import {
  COVERAGE_DOCS_URL,
  COVERAGE_START_YEAR,
  KIND_COLOR_VAR,
  KIND_LABEL
} from '../../lib/timeline/constants'
import { foldChanges } from '../../lib/timeline/fold'
import {
  formatUpdateDate,
  formatUpdateTime,
  type GapTier,
  gapText,
  gapTier,
  intervalDays,
  intervalLabel
} from '../../lib/timeline/format'
import type { FilingUpdate, Kind } from '../../lib/timeline/types'
import { cn } from '../../utils/twUtils'
import { ChangeRow } from './ChangeRow'
import { SourceChip } from './SourceChip'

const KIND_ICON: Record<Kind, typeof User> = {
  officer: User,
  name: Type,
  address: MapPin,
  registration: Landmark,
  standing: Activity,
  other: FileText
}

const COLUMNS = 'grid grid-cols-[var(--tl-rail-w,40px)_minmax(0,1fr)]'

const GAP_PAD: Record<GapTier, string> = {
  short: 'calc(var(--tl-gap-pad,16px) - var(--tl-gap-step,8px) / 2)',
  medium: 'var(--tl-gap-pad,16px)',
  long: 'calc(var(--tl-gap-pad,16px) + var(--tl-gap-step,8px) / 2)'
}

export const updateDomId = (id: string): string =>
  `timeline-update-${id.replace(/[^a-zA-Z0-9_-]/g, '_')}`

const Node = ({ kinds }: { kinds: Kind[] }) => {
  const single = kinds.length === 1 ? kinds[0] : null
  const Icon = single ? KIND_ICON[single] : FileText
  const color = single
    ? KIND_COLOR_VAR[single]
    : 'var(--core-color-action-quiet-fg)'
  return (
    <span
      aria-hidden='true'
      className='relative z-[1] grid size-[var(--tl-node,24px)] shrink-0 place-items-center rounded-full border'
      style={{
        background: single
          ? `color-mix(in srgb, ${color} var(--tl-node-tint, 14%), var(--core-color-surface-card))`
          : 'var(--core-color-surface-subtle)',
        borderColor: single
          ? `color-mix(in srgb, ${color} 40%, var(--core-color-surface-card))`
          : 'var(--core-color-border-default)',
        color
      }}
    >
      <Icon className='size-3.5' strokeWidth={1.75} />
    </span>
  )
}

const Gap = ({
  update,
  next,
  hidesChanges
}: {
  update: FilingUpdate
  next: FilingUpdate
  hidesChanges: boolean
}) => {
  const days = intervalDays(update.date, next.date)
  const interval = intervalLabel(update.date, next.date)
  const crossesCoverage =
    update.date.getFullYear() >= COVERAGE_START_YEAR &&
    next.date.getFullYear() < COVERAGE_START_YEAR
  return (
    <div className={COLUMNS}>
      <div className='relative'>
        <span
          aria-hidden='true'
          className='absolute left-1/2 w-0 -translate-x-1/2 border-[var(--core-color-border-strong)] border-l border-dashed'
          style={{
            top: 'var(--tl-gap-inset,8px)',
            bottom: 'var(--tl-gap-inset,8px)'
          }}
        />
      </div>
      <div
        className='flex flex-wrap items-center gap-x-2.5 pr-2 text-dense text-muted-foreground'
        style={{ paddingBlock: GAP_PAD[gapTier(days)] }}
      >
        {crossesCoverage ? (
          <>
            <span>
              {interval} apart · only initial filings are available before{' '}
              {COVERAGE_START_YEAR}
            </span>
            <a
              className='rounded-xxs text-muted-foreground underline-offset-4 transition-colors duration-fast hover:text-foreground hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring'
              href={COVERAGE_DOCS_URL}
              rel='noreferrer noopener'
              target='_blank'
            >
              Learn more
            </a>
            <span
              aria-hidden='true'
              className='flex-1 border-[var(--core-color-border-strong)] border-t border-dashed'
            />
          </>
        ) : (
          <span>{gapText(interval, hidesChanges)}</span>
        )}
      </div>
    </div>
  )
}

type Props = {
  businessId?: string
  update: FilingUpdate
  /** The update that follows this one down the list. */
  next?: FilingUpdate
  hidesChanges: boolean
  highlighted?: boolean
  /** Hovered here or via its stem in the overview. */
  hovered?: boolean
  onHover?: (id: string | null) => void
}

export const UpdateEntry = ({
  businessId,
  update,
  next,
  hidesChanges,
  highlighted = false,
  hovered = false,
  onHover
}: Props) => {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const groups = foldChanges(update.changes)

  return (
    <li className='flex flex-col' id={updateDomId(update.id)}>
      <div
        className={cn(
          COLUMNS,
          '-mx-1 -my-2 group rounded-card px-1 py-2 transition-colors duration-slow',
          hovered && 'bg-[var(--core-color-state-hover-bg)]',
          highlighted && 'bg-[var(--core-color-state-selected-bg)]'
        )}
        onMouseEnter={() => onHover?.(update.id)}
        onMouseLeave={() => onHover?.(null)}
      >
        <div className='relative flex justify-center'>
          <span
            aria-hidden='true'
            className='absolute bottom-0 left-1/2 w-px -translate-x-1/2 bg-border'
            style={{ top: 'calc(var(--tl-node,24px) / 2)' }}
          />
          <Node kinds={update.kinds} />
        </div>
        <div className='min-w-0 pr-2'>
          <div className='flex min-h-[var(--tl-header-h,24px)] flex-wrap items-center gap-x-1.5 gap-y-1 text-dense text-muted-foreground tabular-nums'>
            <time dateTime={update.occurredAt}>
              {formatUpdateDate(update.date)}
            </time>
            {update.hasTime && (
              <span className='inline-flex items-center gap-x-1.5 opacity-0 transition-opacity duration-fast group-focus-within:opacity-100 group-hover:opacity-100 motion-reduce:transition-none'>
                <span aria-hidden='true'>·</span>
                <span>{formatUpdateTime(update.date)}</span>
              </span>
            )}
            <span className='ml-auto'>
              <SourceChip businessId={businessId} source={update.source} />
            </span>
          </div>
          <div className='flex flex-col'>
            {groups.map(group => {
              const isOpen = expanded.has(group.key)
              const rows = isOpen
                ? [...group.visible, ...group.hidden]
                : group.visible
              const noun =
                group.hidden.length === 1
                  ? KIND_LABEL[group.kind].singular
                  : KIND_LABEL[group.kind].plural
              return (
                <div key={group.key} className='flex flex-col'>
                  {rows.map(change => (
                    <ChangeRow key={change.id} change={change} />
                  ))}
                  {group.hidden.length > 0 && !isOpen && (
                    <div className='flex min-h-[var(--tl-row-h,32px)] items-center pl-[calc(18px+10px+var(--tl-label-w,144px)+10px)]'>
                      <ActionButton
                        className='-ml-3'
                        onClick={() =>
                          setExpanded(current =>
                            new Set(current).add(group.key)
                          )
                        }
                        size='compact'
                        variant='quiet'
                      >
                        Show {group.hidden.length} more {noun.toLowerCase()}{' '}
                        {group.action}
                      </ActionButton>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      {next && <Gap hidesChanges={hidesChanges} next={next} update={update} />}
    </li>
  )
}
