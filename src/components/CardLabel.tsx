import type { ReactNode } from 'react'

import { cn } from '../utils/twUtils'

/**
 * What a card, or a band inside one, calls itself.
 *
 * Two ranks of label on this page, and they differ by weight alone: the band
 * (`PanelGroup`, semibold) and this one, the label on a card. Both are 12px
 * uppercase muted at the same letterspacing, so a reader can tell which
 * contains which without reading either.
 *
 * It replaces `Heading level={4}` inside the source cards, which was 14px
 * semibold — heavier than the values under it, so a group name read as the
 * first and most important value rather than as the name of the group. The
 * element is still an `<h4>` when asked, so the document outline is unchanged;
 * only its weight in the design is.
 */
export const CardLabel = ({
  as = 'div',
  className,
  children
}: {
  as?: 'div' | 'h4'
  className?: string
  children: ReactNode
}) => {
  const Tag = as

  return (
    <Tag
      className={cn(
        'm-0 block text-caption uppercase tracking-[0.08em] text-muted-foreground',
        className
      )}
    >
      {children}
    </Tag>
  )
}

/** The same label as a full-width row inside a card: level with the cells it
 *  heads, and ruled off from what came before it. */
export const CardLabelRow = ({
  as,
  children
}: {
  as?: 'div' | 'h4'
  children: ReactNode
}) => (
  <div className="attribute-row px-4 py-3">
    <CardLabel as={as}>{children}</CardLabel>
  </div>
)
