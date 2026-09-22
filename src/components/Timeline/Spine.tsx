/*
 * Ported verbatim from the dashboard: `app/src/containers/Timeline/Spine.tsx`
 * (rebuilt in `c4379d1cd`). Every class string is the app's own — this half of
 * the tab is already Tailwind over `--core-*`, so it crosses without
 * re-expression. Change it upstream and re-copy (PARITY.md).
 *
 * Only the imports differ:
 *   - the domain moved to `src/lib/timeline`
 *   - `businessId` is threaded to the source chip
 */

import { ActionButton } from '@/core'

import { LIST_WINDOW } from '../../lib/timeline/constants'
import { countChanges } from '../../lib/timeline/group'
import type { FilingUpdate } from '../../lib/timeline/types'
import { UpdateEntry } from './UpdateEntry'

type Props = {
  businessId?: string
  updates: FilingUpdate[]
  shown: number
  onShowMore: () => void
  highlightedIds: Set<string> | null
  hoveredIds: Set<string> | null
  onHover?: (id: string | null) => void
  hidesChanges: boolean
}

export const Spine = ({
  businessId,
  updates,
  shown,
  onShowMore,
  highlightedIds,
  hoveredIds,
  onHover,
  hidesChanges
}: Props) => {
  const visible = updates.slice(0, shown)
  const hasMore = updates.length > shown
  const totalChanges = countChanges(updates)
  const shownChanges = countChanges(visible)

  return (
    <div className='py-2 pr-2'>
      <ol className='m-0 flex list-none flex-col p-0'>
        {visible.map((update, index) => (
          <UpdateEntry
            key={update.id}
            businessId={businessId}
            hidesChanges={hidesChanges}
            highlighted={highlightedIds?.has(update.id) ?? false}
            hovered={hoveredIds?.has(update.id) ?? false}
            onHover={onHover}
            next={
              hasMore || index < visible.length - 1
                ? updates[index + 1]
                : undefined
            }
            update={update}
          />
        ))}
      </ol>
      {hasMore && (
        <div className='ml-[var(--tl-rail-w,40px)] flex items-center justify-between gap-3 border-border border-t py-3 pr-2'>
          <span className='text-dense text-muted-foreground tabular-nums'>
            Showing {shownChanges} of {totalChanges} changes
          </span>
          <ActionButton onClick={onShowMore} size='compact' variant='secondary'>
            Show {Math.min(LIST_WINDOW, updates.length - shown)} more filings
          </ActionButton>
        </div>
      )}
    </div>
  )
}
