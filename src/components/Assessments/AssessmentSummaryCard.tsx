import { MetaChip, Skeleton, Surface } from '@/core'

import { headlineOf } from '../../lib/assessmentChecks'
import type { AssessmentRead } from '../../lib/assessments'
import dayjs from '../../lib/dayjs'
import { DeterminationChip } from '../DeterminationChip'
import { ScoreHead } from '../Report/AssessmentPanel'
import { assessmentTransitionName } from './AssessmentCard'

type Props = {
  read: AssessmentRead
  onOpen: () => void
}

/**
 * One assessment as a summary card: what it is, the call in a sentence, and
 * the score cards' head (call, counts, bar). An exploration beside the score
 * card (`AssessmentCard`); the whole card opens the assessment, as that one does.
 */
export const AssessmentSummaryCard = ({ read, onOpen }: Props) => {
  const headline = headlineOf(read)
  return (
    <Surface
      variant="card"
      padding="none"
      className="relative flex h-full flex-col gap-5 p-6 shadow-elevation-card transition-[border-color,box-shadow] duration-fast hover:border-[var(--core-color-border-strong)] hover:shadow-elevation-raised motion-reduce:transition-none"
      style={{ viewTransitionName: assessmentTransitionName(read.assessment.id) }}
    >
      {/* Name and summary held close: one block. */}
      <div className="flex flex-col gap-1">
        {/* The name in graphite (`text-primary`), the summary under it in karl
            (`text-secondary`). The name opens the card: its button stretches
            over it (::after). */}
        <button
          className="min-w-0 truncate text-left text-dense text-text-primary after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-card focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-[var(--core-color-focus-ring)]"
          onClick={onOpen}
          type="button"
        >
          {read.assessment.name}
        </button>
        {headline ? (
          <p className="m-0 line-clamp-2 text-dense leading-5 text-text-secondary">{headline}</p>
        ) : (
          <div role="status" aria-label="Writing summary" className="flex min-h-10 flex-col justify-center gap-2">
            <Skeleton className="w-full" />
            <Skeleton className="w-2/3" />
          </div>
        )}
      </div>
      {/* Under the summary, the score cards' own head: the counts, the call at
          the right, the bar. */}
      {/* Pinned to the foot, so cards in a row stay level whatever their
          summary's length. */}
      <div className="mt-auto flex flex-col gap-2">
        <ScoreHead
          tally={read.tally}
          trailing={read.ordering ? <MetaChip size="compact">Ordering</MetaChip> : <DeterminationChip band={read.score?.band ?? null} />}
        />
        {/* Under the bar, the date it was run, light grey. */}
        {read.runAt && (
          <time className="text-caption text-[var(--core-color-control-placeholder)]" dateTime={read.runAt}>
            {dayjs(read.runAt).format('MMM D, YYYY')}
          </time>
        )}
      </div>
    </Surface>
  )
}
