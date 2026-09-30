import { ChevronRight } from 'lucide-react'

import { MutedText, Text } from '@/core'

import type { BusinessRecord, Derived } from '../../lib/deriveResults'
import type { ReviewCard } from '../../lib/needsReview'
import { WHY } from '../ReportBody'
import { cn } from '../../utils/twUtils'
import { CardLabel } from '../CardLabel'
import { InsightRow } from '../InsightRow'
import { ROW_HAIRLINE } from '../InsightStack'
import { StateMark } from '../StateMark'

/**
 * What needs the reviewer's attention — the second half of the determination.
 *
 * The reason sentence above it says "confirm before approving"; this is what
 * to confirm: the record's own flags and the assessment's open questions, row
 * by row, under the report card they sit on, named as that card's header
 * reads and in the report's order, with a way straight to it. One card with
 * the call, not a second card beside it: the list and the sentence are one
 * thought.
 *
 * A flagged insight is the same row it is on its card, evidence and all, so a
 * reader can open it here. An open question is the assessment's own sentence,
 * with why it is open and what would answer it. Nothing here is a step to
 * take, and nothing is coloured: only the score carries a verdict.
 */
export const AttentionBand = ({
  cards,
  record,
  negatives,
  onJump,
  onJumpToSource,
  className
}: {
  cards: ReviewCard[]
  record: BusinessRecord
  negatives?: ReadonlySet<string>
  /** Follows a card's name to the card. */
  onJump: (card: ReviewCard) => void
  onJumpToSource?: (cardId: string) => void
  className?: string
}) => {
  const total = cards.reduce((n, c) => n + c.items.length, 0)

  return (
    <div
      className={cn('border-t border-[var(--core-color-border-divider)]', className)}
      role="region"
      aria-label="What needs your attention"
    >
      {/* The heading alone. The rows under it carry their own counts, and a
          total over them said the same thing a third time. */}
      <div className="px-4 py-3">
        <CardLabel as="h4">{total === 0 ? 'Nothing needs your attention' : 'What needs your attention'}</CardLabel>
      </div>

      {cards.map((c) => (
        <div key={c.key}>
          {/* The card's name alone, as its header reads below — not the
              assessment it belongs to. It is the row's own way down the page. */}
          <button
            type="button"
            onClick={() => onJump(c)}
            className={cn(
              'flex w-full items-center gap-3 border-t border-[var(--core-color-border-divider)] px-4 py-2.5 text-left transition-colors duration-fast hover:bg-[var(--core-color-list-item-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none'
            )}
          >
            <Text size="sm" className="min-w-0 flex-1 truncate font-semibold leading-5">
              {c.title}
            </Text>
            <MutedText className="shrink-0 text-caption tabular-nums">{c.items.length}</MutedText>
            <ChevronRight
              aria-hidden="true"
              size={14}
              strokeWidth={2}
              className="shrink-0 text-[var(--core-color-text-secondary)]"
            />
          </button>

          {c.items.map((item, i) =>
              item.kind === 'flag' ? (
                <div key={item.result.insightId} className={cn(i > 0 && ROW_HAIRLINE)}>
                  <InsightRow
                    result={item.result as Derived}
                    record={record}
                    negative={negatives?.has(item.result.insightId)}
                    onJumpToSource={onJumpToSource}
                  />
                </div>
              ) : (
                <div key={item.gap.id} className={cn('grid grid-cols-[16px_1fr] gap-x-3 px-4 py-3', i > 0 && ROW_HAIRLINE)}>
                  <StateMark state="no_result" className="mt-1.5 text-muted-foreground" />
                  <span className="min-w-0">
                    <Text size="sm" className="leading-5">
                      {item.gap.point}
                    </Text>
                    <MutedText className="block text-caption">
                      {[WHY[item.gap.why], item.gap.wouldAnswer].filter(Boolean).join('. ')}
                    </MutedText>
                  </span>
                </div>
              )
            )}
        </div>
      ))}
    </div>
  )
}
