import type { ReactNode } from 'react'

import { CountBubble, MutedText, Surface, Text } from '@/core'

import { cn } from '../utils/twUtils'
import { CardHeader } from './CardHeader'
import { CardLabel } from './CardLabel'

export type ListItem = {
  id: string
  label: ReactNode
  /** Under the label, in the caption grey. */
  sublabel?: ReactNode
  /** At the row's right edge: a ring, a count, a chip. */
  trailing?: ReactNode
}

export type ListSection = {
  key: string
  /** A band over the rows, for a column split into bands (the Sources tab). */
  label?: string
  items: ListItem[]
}

/**
 * The list column of a master-detail layout.
 *
 * What a tab lists: its reports, its insight groupings, its attribute
 * groupings, its sources. One shape for all four — a titled head with a count
 * and an optional action, an optional filter band, then rows — so the eye
 * learns it once. The selected row is the filled row, the way a chosen row
 * reads anywhere else in the dashboard, and the pane beside the column shows
 * what it names.
 *
 * Modelled on a file browser's list: title, count, filter under it, rows with
 * a name and a caption, the chosen one highlighted. Pinned at `desk` so it
 * stays while the pane scrolls; in the flow above the pane where there is no
 * room beside it.
 */
export const ListColumn = ({
  title,
  count,
  trailing,
  filter,
  sections,
  selectedId,
  onSelect,
  empty,
  className
}: {
  title: ReactNode
  count?: number
  /** The head's action — run another, add one. */
  trailing?: ReactNode
  /** A band under the head: a segmented filter, a search. */
  filter?: ReactNode
  sections: ListSection[]
  selectedId?: string | null
  onSelect: (id: string) => void
  /** What the column says when it has no rows. */
  empty: string
  className?: string
}) => {
  const total = sections.reduce((n, s) => n + s.items.length, 0)

  return (
    <Surface variant="card" padding="none" className={cn('overflow-hidden', className)}>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            {title}
            {count !== undefined && <CountBubble>{count}</CountBubble>}
          </span>
        }
        trailing={trailing}
      />
      {filter && (
        <div className="border-b border-[var(--core-color-border-divider)] px-3 py-2">{filter}</div>
      )}

      {total === 0 ? (
        <Text size="sm" tone="secondary" className="px-4 py-3">
          {empty}
        </Text>
      ) : (
        sections.map((section) => (
          <div key={section.key}>
            {section.label && (
              <div className="border-b border-[var(--core-color-border-divider)] bg-[var(--core-color-surface-inset)] px-4 py-2">
                <CardLabel as="h4" className="font-semibold">
                  {section.label}
                </CardLabel>
              </div>
            )}
            {section.items.map((item) => {
              const open = item.id === selectedId
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item.id)}
                  aria-current={open ? 'true' : undefined}
                  className={cn(
                    'flex w-full items-center gap-3 border-b border-[var(--core-color-border-divider)] px-4 py-3 text-left',
                    'transition-colors duration-fast motion-reduce:transition-none',
                    'hover:bg-[var(--core-color-list-item-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                    open && 'bg-[var(--core-color-state-selected-bg)]'
                  )}
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className={cn('min-w-0 truncate text-sm leading-5', open && 'font-semibold')}>
                      {item.label}
                    </span>
                    {item.sublabel && (
                      <span className="flex flex-wrap items-center gap-2">
                        <MutedText className="text-caption">{item.sublabel}</MutedText>
                      </span>
                    )}
                  </span>
                  {item.trailing && <span className="flex shrink-0 items-center">{item.trailing}</span>}
                </button>
              )
            })}
          </div>
        ))
      )}
    </Surface>
  )
}

/** A count at a row's right edge: how many of something the row holds. */
export const RowCount = ({ children }: { children: ReactNode }) => (
  <span className="text-caption tabular-nums text-text-secondary">{children}</span>
)
