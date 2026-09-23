import { Heading, Surface } from '@/core'

import type { BandId, IdentityScore, ScoreBand } from '../lib/identityScore'
import { cn } from '../utils/twUtils'

/**
 * The band's colour.
 *
 * The arc takes it. The band label does NOT: it is the rail's heading, and a
 * heading set in a status colour reads as an alarm rather than as the name of
 * what you are looking at. Graphite, at H3, with the arc beside it already
 * carrying the colour — one coloured object, not two saying the same thing.
 *
 * Nothing else on the report is coloured at all. A score IS a verdict, which is
 * the one thing on this page colour can honestly say; the values it is computed
 * from are not verdicts, which is why their marks had their colour removed.
 */
const BAND_INK: Record<BandId, string> = {
  established: 'text-[var(--core-color-status-success-fg)]',
  conditions: 'text-[var(--core-color-status-warning-fg)]',
  not_established: 'text-[var(--core-color-status-danger-fg)]'
}

/** 2πr at r=42, as a constant rather than a computation on every render. */
const RING = 263.894

/**
 * The score as an arc.
 *
 * Hand-rolled, like `StateMark`: there is no gauge in `@/core` and core is a
 * read-only clone, so the arc follows the same conventions — a viewBox, the
 * stroke in `currentColor`, and the colour set by the span that wraps it.
 *
 * `butt` caps, not round: a round cap draws a visible dot at zero, so a score
 * of nothing would still look like a score of something.
 *
 * No animation. A standing report is a snapshot and the value never changes
 * after mount, so a sweep could only ever fire on first paint — and a ring that
 * counts up to 89 dramatises a number whose whole problem is that it is
 * inferred rather than measured.
 *
 * `score` null draws the track alone: the rail is on the page before the run
 * that fills it has finished, and an empty ring says "not yet" where a zero
 * would say "nothing".
 */
export const ScoreRing = ({
  score,
  size = 'sm',
  className
}: {
  score: { value: number; band: ScoreBand } | null
  /** `xs` (36px) on a row, `sm` (64px) in a rail, `lg` (96px) at the head of
   *  the report. */
  size?: 'xs' | 'sm' | 'lg'
  className?: string
}) => {
  const name = score
    ? `Identity score ${score.value} out of 100 — ${score.band.label}`
    : 'Identity score not yet computed'

  return (
    <div
      className={cn(
        'relative shrink-0',
        size === 'lg' ? 'size-24' : size === 'sm' ? 'size-16' : 'size-9',
        className
      )}
    >
      <span className={cn('block', score && BAND_INK[score.band.id])}>
        <svg viewBox="0 0 96 96" className="size-full" fill="none" role="img" aria-label={name}>
          <title>{name}</title>
          {/* An explicit token, not `currentColor` — the track must not inherit
              the band's colour from the span above it. */}
          <circle cx="48" cy="48" r="42" strokeWidth="6" stroke="var(--core-color-border-default)" />
          {score && (
            <circle
              cx="48"
              cy="48"
              r="42"
              strokeWidth="6"
              strokeLinecap="butt"
              stroke="currentColor"
              strokeDasharray={RING}
              strokeDashoffset={RING * (1 - score.value / 100)}
              transform="rotate(-90 48 48)"
            />
          )}
        </svg>
      </span>
      {/* Centred by layout rather than by SVG `<text>`, which takes neither
          `tabular-nums` nor the page's own font metrics. `aria-hidden` because
          the ring's label already says the number. */}
      {score && (
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-0 flex items-center justify-center font-semibold leading-none tabular-nums text-text-primary',
            size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-lg' : 'text-xs'
          )}
        >
          {score.value}
        </span>
      )}
    </div>
  )
}

/**
 * The call, at the head of the report.
 *
 * The ring and the band it names, with what the run was processed with under
 * them. It opens the report — the name and the paragraph about the business
 * that used to open it are gone, so the first thing on the page is the
 * decision — and it stays in the body at every width. A rail beside the
 * report used to carry it too, with the assessments as a pinned list; the same
 * fact in two places, one of them pinned, read as the page insisting, and the
 * report is one column now.
 *
 * The follow-ups are not here. They are out of the report for now and live in
 * the transcript.
 */
export const DeterminationCard = ({
  score,
  running = false,
  caption,
  trailing,
  className
}: {
  /** The identity score, or null until a report exists. */
  score: IdentityScore | null
  /** A run is being written: the band is on its way, not absent. */
  running?: boolean
  /** Which report this is the call of — its name, when it ran, whether it is
   *  the latest. Under the band, before what it was processed with. */
  caption?: React.ReactNode
  /** What the run was processed with — the sources roll-up. */
  trailing?: React.ReactNode
  className?: string
}) => (
  <Surface variant="card" padding="md" className={className}>
    {/* The call reads first, the number last: band, then which report and what
        it was processed with, with the ring at the card's far edge where a
        figure sits on every other row of this page. */}
    <div className="flex items-center gap-5">
      <div className="min-w-0 flex-1">
        {score ? (
          <Heading level={2}>{score.band.label}</Heading>
        ) : (
          <Heading level={2} className={cn('text-muted-foreground', running && 'shimmer-text')}>
            {running ? 'Assessing' : 'Not assessed'}
          </Heading>
        )}
        {caption && <div className="mt-1">{caption}</div>}
        {/* On its own line under the band, where it qualifies the run rather
            than the word. */}
        {trailing && <div className="mt-2">{trailing}</div>}
      </div>
      <ScoreRing score={score} size="lg" />
    </div>
  </Surface>
)
