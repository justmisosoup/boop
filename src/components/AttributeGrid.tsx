import { CircleCheck } from 'lucide-react'

import { MutedText, Surface, Text } from '@/core'

import { cn } from '../utils/twUtils'

export type AttributeCell = {
  /** Stable identity, where the label and value are not unique on their own. */
  key?: string
  /** Absent where the value names itself — a business, rather than a field. */
  label?: string
  value: string
  /** A qualifier under the value: what the value answers, where it came from. */
  note?: string
  /**
   * The customer gave us this value and a source of record confirmed it.
   *
   * Only both. A value we merely hold is the ordinary case and is marked by
   * nothing — a page where most things carry a tick says less than a page
   * where two do.
   */
  verified?: boolean
  /** Makes the cell a button. Without it the cell is a plain block. */
  onSelect?: () => void
}

/**
 * Attributes in a card, two to a row.
 *
 * The card is a hard square in graphite, and the rules between its cells are
 * dashed and cross at the corners — `.attribute-cell` in `theme.css` paints
 * them, because no border style draws a 4px dash against a 4px gap.
 *
 * The grid is a pixel taller and wider than the card it sits in (`-mb-px
 * -mr-px`), so the last row's and last column's rules hang outside and the
 * card's `overflow-hidden` clips them. Only the interior rules show, and no
 * `:last-child` rule is needed to say so.
 *
 * One attribute runs the full width; the split starts at two. An odd last one
 * runs the full width too — the alternative is a blank half-cell, and a blank
 * cell in a card of facts reads as a fact we are missing rather than as a row
 * that ran out.
 */
export const AttributeGrid = ({
  items,
  className
}: {
  items: AttributeCell[]
  className?: string
}) => {
  if (items.length === 0) return null

  return (
    <Surface
      variant="default"
      padding="none"
      className={cn('overflow-hidden rounded-none border-text-primary', className)}
    >
      <div className={cn('-mb-px -mr-px grid', items.length > 1 && 'sm:grid-cols-2')}>
        {items.map((item, i) => {
          const body = (
            <>
              {item.label && (
                <span className="flex items-center gap-1">
                  <Text tone="secondary" size="sm" className="leading-snug">
                    {item.label}
                  </Text>
                  {item.verified && (
                    <CircleCheck
                      role="img"
                      aria-label="Submitted and verified"
                      className="size-3.5 shrink-0 text-[var(--core-color-text-success)]"
                    />
                  )}
                </span>
              )}
              <span className={cn('block text-sm leading-snug', item.label && 'mt-0.5')}>
                {item.value}
              </span>
              {item.note && (
                <MutedText className="mt-0.5 block text-caption leading-snug">
                  {item.note}
                </MutedText>
              )}
            </>
          )
          const key = item.key ?? `${item.label ?? ''}-${item.value}-${i}`

          const wide = items.length % 2 === 1 && i === items.length - 1 && 'sm:col-span-2'

          return item.onSelect ? (
            <button
              key={key}
              type="button"
              onClick={item.onSelect}
              className={cn(
                'attribute-cell p-4 text-left transition-colors hover:bg-[var(--core-color-state-hover-bg)]',
                wide
              )}
            >
              {body}
            </button>
          ) : (
            <div key={key} className={cn('attribute-cell p-4', wide)}>
              {body}
            </div>
          )
        })}
      </div>
    </Surface>
  )
}
