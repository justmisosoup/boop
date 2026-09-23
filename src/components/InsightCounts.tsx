import { Circle, CircleCheck, CircleX, type LucideIcon } from 'lucide-react'

import { cn } from '../utils/twUtils'

/**
 * How a report's insights read, as three counts.
 *
 * Ported from the app's `TaskList` + `InsightStat`
 * (`app/src/containers/Businesses/BusinessList/`): a 16px glyph at 2.5 stroke
 * and a label as plain text, no chip, so the row stays quiet next to the
 * Status chip; a fixed three-track grid so the sub-columns line up down the
 * table whatever each count's digits; a zero count fades to the recede grey so
 * the eye skips it. The app's tracks are Success / Warning / Failure off the
 * review task's own status. This prototype does not carry that status — its
 * reading of an insight is the score's, `polarityOf` in `identityScore.ts` —
 * so the tracks are Positive / Negative / Neutral, the same three words the
 * score card's cells count in.
 *
 * Re-expressed in `--core-*` tokens rather than the app's styled-components
 * over `INTENT_COLOR` (prototype.md §4). The glyph takes the status foreground
 * token; the label takes the primary text token.
 */
type Kind = 'positive' | 'negative' | 'neutral'

const META: Record<Kind, { icon: LucideIcon; word: string; glyph: string }> = {
  positive: {
    icon: CircleCheck,
    word: 'Positive',
    glyph: 'text-[var(--core-color-status-success-fg)]'
  },
  negative: {
    icon: CircleX,
    word: 'Negative',
    glyph: 'text-[var(--core-color-status-danger-fg)]'
  },
  // Neutral is a reading that counts neither way, so its glyph is the
  // secondary text grey rather than a status colour — a fourth status tone
  // would rank it against the two beside it.
  neutral: { icon: Circle, word: 'Neutral', glyph: 'text-text-secondary' }
}

const ORDER: Kind[] = ['positive', 'negative', 'neutral']

const Stat = ({ kind, count, labels }: { kind: Kind; count: number; labels: boolean }) => {
  const { icon: Icon, word, glyph } = META[kind]
  const muted = count === 0
  return (
    <span
      className={cn(
        'inline-flex items-center gap-[5px] whitespace-nowrap align-middle text-caption leading-4',
        muted ? 'text-text-disabled' : 'text-foreground'
      )}
      // The word travels with the glyph either way: printed beside it in the
      // list, or read out by assistive tech where the glyph stands alone.
      aria-label={`${count} ${word.toLowerCase()}`}
    >
      <Icon
        aria-hidden="true"
        size={16}
        strokeWidth={2.5}
        className={cn('block shrink-0', muted ? 'text-text-disabled' : glyph)}
      />
      <span aria-hidden="true">
        <span className="tabular-nums">{count}</span>
        {labels && <> {word}</>}
      </span>
    </span>
  )
}

export const InsightCounts = ({
  counts,
  labels = true
}: {
  counts: Record<Kind, number>
  /**
   * Whether each count carries its word.
   *
   * On in the list, where the three tracks are the column's whole content and
   * a bare glyph would have to be learnt. Off on the score card, where the
   * counts sit under an assessment's chip: the glyph is the same one the list
   * has just taught, and the word beside it three times over crowded a cell
   * whose subject is the chip above.
   */
  labels?: boolean
}) =>
  labels ? (
    <div className="grid grid-cols-[repeat(3,86px)] items-center gap-x-2">
      {ORDER.map((kind) => (
        <div key={kind} className="flex min-w-0 items-center">
          <Stat kind={kind} count={counts[kind]} labels />
        </div>
      ))}
    </div>
  ) : (
    <span className="inline-flex items-center gap-3">
      {ORDER.map((kind) => (
        <Stat key={kind} kind={kind} count={counts[kind]} labels={false} />
      ))}
    </span>
  )
