import { useEffect, useRef, useState } from 'react'

import { Heading, MutedText, Surface, Text } from '@/core'

import type { BandId, IdentityScore, ScoreBand } from '../lib/identityScore'
import { formatStamp as stamp } from '../lib/reportLabels'
import { cn } from '../utils/twUtils'
import { CardLabel } from './CardLabel'

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
  score: { value: number; band: ScoreBand; weighted?: number } | null
  /** `xs` (36px) on a row, `sm` (64px) in a rail, `lg` (96px) at the head of
   *  the report. */
  size?: 'xs' | 'sm' | 'lg'
  className?: string
}) => {
  const name = score
    ? `Identity score ${score.value} out of 100 — ${score.band.label}${
        score.weighted !== undefined && score.weighted > score.value ? `, capped from ${score.weighted}` : ''
      }`
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
          {/* What the arithmetic said before a finding capped it: a ghost arc
              in the strong border, under the band's arc, from the cap to the
              weighted score. A 49 that was a 78 shows the 29 points a single
              fact cut, which is what the number's honesty rests on. */}
          {score && score.weighted !== undefined && score.weighted > score.value && (
            <circle
              cx="48"
              cy="48"
              r="42"
              strokeWidth="6"
              strokeLinecap="butt"
              stroke="var(--core-color-border-strong)"
              strokeDasharray={RING}
              strokeDashoffset={RING * (1 - score.weighted / 100)}
              transform="rotate(-90 48 48)"
            />
          )}
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
 * The card's width, in px, under which it takes the stacked layout.
 *
 * The first thing to give is the header row beside the ring: the label and
 * the status control on one line need about 266px ("Needs Review" is the
 * widest word), and the column they sit in is the card less 32 of padding,
 * the 96px ring and the 20px gap. Under 420 the control rides the card's
 * edge, so that is where the ring goes up top. */
const NARROW_AT = 420

/** A review status as the dashboard prints it. */
const STATUS_WORD: Record<string, string> = { approved: 'Approved', in_review: 'Needs Review', rejected: 'Rejected' }


/** A reviewer's change of status: from what, to what, by whom, when, and why. */
export type DeterminationChange = { from: string; to: string; by: string; at: string; note?: string }

/**
 * The determination, at the head of the report.
 *
 * Three things, in two states. The status control reads the assessment's
 * determination until a reviewer changes it, so it is the word; under it the
 * reason the assessment gave and, as a byline, when it was determined and the
 * context it was determined in; at the far edge the score. When a reviewer
 * has changed the status, their note and their byline take the place of the
 * assessment's — same shape, different author — and the assessment's own
 * lines are kept behind a disclosure as the original determination, so what
 * was generated can still be read.
 *
 * It opens the report and stays in the body at every width. The follow-ups
 * are not here; they live in the transcript.
 */
export const DeterminationCard = ({
  score,
  running = false,
  status,
  reason,
  determinedAt,
  context,
  change,
  stacked = false,
  className
}: {
  /** The identity score, or null until a report exists. */
  score: IdentityScore | null
  /** A run is being written: the band is on its way, not absent. */
  running?: boolean
  /** The status control — the determination's word, and the way to change it. */
  status?: React.ReactNode
  /** Why the number is what it is, in one sentence — see `scoreLine`. */
  reason?: string
  /** When the assessment determined it, as `reportStamp` prints it. */
  determinedAt?: string
  /** What was considered — the Context roll-up. */
  context?: React.ReactNode
  /** A reviewer's change, when the status no longer matches the determination. */
  change?: DeterminationChange
  /** A narrow column: the ring over the words rather than beside them. */
  stacked?: boolean
  className?: string
}) => {
  /* Below this the ring beside the words leaves the words too little measure,
     so the card takes the rail's layout wherever it is. Measured, not a
     breakpoint: the card's width depends on the chat column, not the viewport. */
  const box = useRef<HTMLDivElement>(null)
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setNarrow(entry.contentRect.width < NARROW_AT))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const layout = stacked || narrow

  /* The assessment's own lines: its reason, then when and in what context.
     The card's body when nothing has changed; the disclosure's body when
     something has. The date stands alone — the pill above it already says
     what was determined. */
  const byline = (determinedAt || context) && (
    <span className={cn('flex items-center', layout ? 'mt-3 flex-nowrap gap-2' : 'mt-2 flex-wrap gap-3')}>
      {context}
      {determinedAt && <MutedText className="whitespace-nowrap text-caption">{determinedAt}</MutedText>}
    </span>
  )
  const determination = (
    <>
      {reason && <Text>{reason}</Text>}
      {byline}
    </>
  )

  /* The analyst's change, under the status it produced: their note, then
     who and when and what it was before. It adds to the decision; it does
     not replace the assessment's reason or its context. */
  const analystNote = change ? (
    <div className="-mx-[var(--core-spacing-md)] mt-4 border-t border-[var(--core-color-border-divider)] px-[var(--core-spacing-md)] pt-4">
      {change.note && <Text size="sm">{change.note}</Text>}
      <MutedText className={cn('block text-caption', change.note && 'mt-1')}>
        Changed by {change.by} · {stamp(change.at)} · was {STATUS_WORD[change.from] ?? change.from}
      </MutedText>
    </div>
  ) : null

  return (
    <div ref={box} className={className}>
      <Surface variant="card" padding="md">
        {/* The score at the far left, standing for the whole card; beside it
            the card's own header — its name at the left, the decision (the
            status control) in the top-right corner on the same line — and under
            that the explanation, then the context and date. The reviewer's
            status does not change what the assessment measured, so the ring
            reads the same in both states. */}
        {layout ? (
          /* The label with the status control at the far edge of its line;
             under them the ring, centred, over the reason and its byline. */
          <div className="flex flex-col items-stretch gap-4">
            <div className="flex items-center justify-between gap-4">
              <CardLabel as="h4">Determination</CardLabel>
              {score && status && <div className="flex shrink-0 items-center">{status}</div>}
            </div>
            <div>
              {/* The ring centred as the card's one mark; the prose under it
                  stays left-aligned, as prose on the rest of the report does. */}
              <div className="flex justify-center">
                <ScoreRing score={score} size="lg" />
              </div>
              {reason && <Text className="mt-4">{reason}</Text>}
              {byline}
            </div>
            {analystNote}
          </div>
        ) : (
          <div className="flex items-center gap-5">
            <ScoreRing score={score} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-4">
                <CardLabel as="h4">Determination</CardLabel>
                {score && status ? (
                  <div className="flex shrink-0 items-center gap-3">{status}</div>
                ) : score ? (
                  <Heading level={3}>{score.band.label}</Heading>
                ) : (
                  <Heading level={3} className={cn('text-muted-foreground', running && 'shimmer-text')}>
                    {running ? 'Assessing' : 'Not assessed'}
                  </Heading>
                )}
              </div>
              <div className="mt-2">{determination}</div>
              {/* After the assessment's own lines, ruled off: the analyst's note
                  adds to the decision, it does not stand in for the reason. */}
              {analystNote}
            </div>
          </div>
        )}
      </Surface>
    </div>
  )
}
