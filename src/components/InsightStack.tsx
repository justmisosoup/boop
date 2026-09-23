import { Children, type ReactNode } from 'react'

import { Surface } from '@/core'

import { cn } from '../utils/twUtils'
import { CardHeader } from './CardHeader'

/**
 * The hairline between two rows in a card.
 *
 * The dashboard's insights panel (`app/src/containers/BusinessHome/Insights/
 * InsightsPanel.tsx`) does not border its rows. It paints a pseudo-element a
 * pixel tall, inset 16px from either edge, in the divider token — so the line
 * stops where the row's own padding starts, and never meets the card's frame.
 * Written once here and taken verbatim.
 */
export const ROW_HAIRLINE = cn(
  'relative before:pointer-events-none before:absolute before:inset-x-4',
  'before:top-0 before:border-t before:border-[var(--core-color-border-divider)]',
  'before:content-[""]'
)

/**
 * A stack of insight rows in one card.
 *
 * The shell is the dashboard's: the card surface, the card radius, the default
 * border, and the rows divided by the inset hairline rather than by a rule of
 * their own. It replaces the three copies of one hand-built frame — a square
 * graphite box with each row's bottom border and the last one bled off — that
 * the report sections, the Insights tab and the attribute grid each carried.
 *
 * Named on the card, when it is named: `title` and `trailing` are the card's
 * header row (`CardHeader`), and `intro` is a band of prose under it — the
 * sentences an assessment writes about what it could not find, before the
 * rows of what it did. Header and intro rule themselves off with a hairline,
 * so the first row never draws one of its own; only rows after the first do.
 *
 * Renders nothing when there is nothing under the header: a frame around a
 * name is a frame.
 */
export const InsightStack = ({
  title,
  trailing,
  intro,
  children,
  className
}: {
  title?: ReactNode
  trailing?: ReactNode
  intro?: ReactNode
  children?: ReactNode
  className?: string
}) => {
  const rows = Children.toArray(children).filter(Boolean)
  if (rows.length === 0 && !intro) return null

  return (
    <Surface variant="card" padding="none" className={cn('overflow-hidden', className)}>
      {title && <CardHeader title={title} trailing={trailing} />}
      {intro && (
        <div
          className={cn(
            'px-4 py-3',
            rows.length > 0 && 'border-b border-[var(--core-color-border-divider)]'
          )}
        >
          {intro}
        </div>
      )}
      {rows.map((row, i) => (
        <div key={(row as { key?: string | null }).key ?? i} className={cn(i > 0 && ROW_HAIRLINE)}>
          {row}
        </div>
      ))}
    </Surface>
  )
}
