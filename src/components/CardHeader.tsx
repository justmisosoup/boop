import type { ReactNode } from 'react'

import { Heading } from '@/core'

import { cn } from '../utils/twUtils'

/**
 * What a card is, on the card.
 *
 * The name on the left, the one tag that identifies it on the right — the
 * filing a grid was read from, the band an assessment came back in — and a
 * hairline under both. It is the head of the dashboard's insights card
 * (`InsightsPanel` → `InsightSummary`): the card says what it is inside its own
 * frame, at row padding, so it reads as the card's own name rather than as a
 * caption floating above a box. The label that used to sit above the card,
 * and the footnote that used to sit under it, are both this row.
 *
 * H4: the report's card-title size, one step under the assessment headings the
 * rail lists, and the element the outline had when the label was an `h4`.
 */
export const CardHeader = ({
  title,
  trailing,
  className
}: {
  title: ReactNode
  /** The identifying tag: a source chip, a band chip. Nothing is fine. */
  trailing?: ReactNode
  className?: string
}) => (
  <div
    className={cn(
      'flex items-center justify-between gap-3 border-b border-[var(--core-color-border-divider)] px-4 py-3',
      className
    )}
  >
    <Heading level={4} className="min-w-0">
      {title}
    </Heading>
    {trailing && <span className="flex shrink-0 items-center">{trailing}</span>}
  </div>
)
