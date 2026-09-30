import { ChevronRight } from 'lucide-react'

import { MutedText, Surface, Text } from '@/core'

import type { ReviewCard } from '../lib/needsReview'
import { cn } from '../utils/twUtils'
import { CardHeader } from './CardHeader'
import { ROW_HAIRLINE } from './InsightStack'
import { StateMark } from './StateMark'

/**
 * Where the attention is due, at the head of the report.
 *
 * One row per report card that has something to review, named exactly as
 * that card's header reads below and in the same order, so the reader lands
 * in the same places top to bottom. The mark is the one a flagged row
 * carries in its card — the same vocabulary, one level up. Absent when the
 * assessment surfaced nothing: the determination already says so.
 */
export const NeedsReviewCard = ({
  cards,
  onJump,
  className
}: {
  cards: ReviewCard[]
  onJump: (card: ReviewCard) => void
  className?: string
}) => {
  if (cards.length === 0) return null
  return (
    <Surface variant="card" padding="none" className={cn('overflow-hidden', className)} role="region" aria-label="Needs review">
      <CardHeader
        title="Needs review"
        trailing={<MutedText className="text-caption tabular-nums">{cards.length}</MutedText>}
      />
      {cards.map((c, i) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onJump(c)}
          className={cn(
            'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-fast hover:bg-[var(--core-color-list-item-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none',
            i > 0 && ROW_HAIRLINE
          )}
        >
          <StateMark state="result" className="mt-1 text-[var(--core-color-status-danger-fg)]" />
          <span className="min-w-0 flex-1">
            {/* The card's name alone: being listed is what says it needs a look. */}
            <Text size="sm" className="block font-semibold leading-5">
              {c.title}
            </Text>
          </span>
          <ChevronRight aria-hidden="true" size={14} strokeWidth={2} className="mt-1 shrink-0 text-[var(--core-color-text-secondary)]" />
        </button>
      ))}
    </Surface>
  )
}
