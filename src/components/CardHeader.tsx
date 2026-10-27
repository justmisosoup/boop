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
 * rail lists, and the element the outline had when the label was an `h4`. Set
 * in the serif middesk.com sets its headers in, at its one weight (Light, see
 * theme.css), a step up in size so the light face reads: the card's name is
 * the report's serif voice, and the body under it stays Suisse.
 */
export const CardHeader = ({
  title,
  trailing,
  below,
  className
}: {
  title: ReactNode
  /** The identifying tag: a source chip, a band chip. Nothing is fine. */
  trailing?: ReactNode
  /** The card's controls — a filter — under the title rather than beside it;
   *  `trailing` then sits at the right of the same row. */
  below?: ReactNode
  className?: string
}) => (
  <div
    className={cn(
      'flex flex-col gap-2 border-b border-[var(--core-color-border-divider)] px-4 py-3',
      className
    )}
  >
    <div className="flex items-center justify-between gap-3">
      <Heading level={4} className="min-w-0 font-arizona text-base font-light">
        {title}
      </Heading>
      {/* With controls under the title, the tag joins them, at their right. */}
      {trailing && !below && <span className="flex shrink-0 items-center">{trailing}</span>}
    </div>
    {below && (
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {below}
        {trailing && <span className="ml-auto flex shrink-0 items-center">{trailing}</span>}
      </div>
    )}
  </div>
)
