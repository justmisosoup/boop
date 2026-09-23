import { useMemo } from 'react'

import { Heading, Surface } from '@/core'

import type { BusinessRecord, Derived } from '../lib/deriveResults'
import {
  identityScore,
  type BandId,
  type ScoreArea,
  type ScoreBand,
  type ScoreComponent
} from '../lib/identityScore'
import type { AnalysisResult } from '../types'
import { cn } from '../utils/twUtils'
import { AttributeCells, type AttributeCell } from './AttributeGrid'
import { CardLabel } from './CardLabel'
import { FollowUps } from './FollowUps'
import { InsightCounts } from './InsightCounts'
import { RecommendationChip } from './RecommendationChip'

/**
 * The band's colour.
 *
 * The arc and the legend dots take it. The band label does NOT, any more: it is
 * the card's heading, and a heading set in a status colour reads as an alarm
 * rather than as the name of what you are looking at. Graphite, at H3, with the
 * arc beside it already carrying the colour — one coloured object per card, not
 * two saying the same thing.
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
 */
export const ScoreRing = ({ value, band }: { value: number; band: ScoreBand }) => {
  const name = `Identity score ${value} out of 100 — ${band.label}`

  return (
    <div className="relative size-24 shrink-0">
      <span className={cn('block', BAND_INK[band.id])}>
        <svg viewBox="0 0 96 96" className="size-24" fill="none" role="img" aria-label={name}>
          <title>{name}</title>
          {/* An explicit token, not `currentColor` — the track must not inherit
              the band's colour from the span above it. */}
          <circle cx="48" cy="48" r="42" strokeWidth="6" stroke="var(--core-color-border-default)" />
          <circle
            cx="48"
            cy="48"
            r="42"
            strokeWidth="6"
            strokeLinecap="butt"
            stroke="currentColor"
            strokeDasharray={RING}
            strokeDashoffset={RING * (1 - value / 100)}
            transform="rotate(-90 48 48)"
          />
        </svg>
      </span>
      {/* Centred by layout rather than by SVG `<text>`, which takes neither
          `tabular-nums` nor the page's own font metrics. `aria-hidden` because
          the ring's label already says the number. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center text-[28px] font-semibold leading-none tabular-nums text-text-primary"
      >
        {value}
      </span>
    </div>
  )
}

/**
 * One assessment, as a cell: its name, and the band it came back in.
 *
 * It used to print the sub-score, its weight and three counts. That was the
 * arithmetic, and the arithmetic is still in `identityScore.ts` for anyone
 * auditing the number — but a reviewer reading the card wants to know which
 * stages are clear and which are not, and a word says that where a row of
 * numbers made them work it out. The chip is the same one the businesses
 * list uses for the whole report, so a band reads the same at both zooms.
 */
const componentCell = (
  c: ScoreComponent,
  onSelect?: (component: ScoreComponent) => void
): AttributeCell => ({
  key: c.id,
  label: c.label,
  // H4: the cell names a section of the report, not a field of the record —
  // set as a field name it read as a caption on the chip under it.
  labelNode: <Heading level={4}>{c.label}</Heading>,
  values: [
    {
      value: <RecommendationChip band={c.band} />,
      // What the band rests on: the insights this assessment cited, split the
      // way the score read them, as the three glyphs the businesses list has
      // already taught. Glyphs alone — the words three times over crowded a
      // cell whose subject is the chip. The tier is not printed either; it
      // still weights the ring (see `WEIGHT`), but under every cell it
      // labelled the card's own machinery.
      note: <InsightCounts counts={c.counts} labels={false} />
    }
  ],
  onSelect: onSelect ? () => onSelect(c) : undefined
})

/**
 * How well the identity stands up, under the actions it justifies.
 *
 * The ring is the claim, the breakdown is the argument, and they are one card
 * because the number is invented and must never travel without its working. See
 * `src/lib/identityScore.ts` for what is being asserted and what is not.
 */
export const IdentityScoreCard = ({
  record,
  results,
  areas,
  followUps = [],
  trailing
}: {
  record: BusinessRecord
  results: Derived[]
  /**
   * What a reviewer does before the account opens, ranked.
   *
   * On the card rather than above it: the band is the call and these are its
   * conditions, and separated by a card edge they read as two things. They
   * replace the summary line and the band legend, which described the card to
   * a reader who was looking at it.
   */
  followUps?: NonNullable<AnalysisResult['followUps']>
  /** The assessments this report was laid out in, and what each one cited. The
   *  cells are these; see `scoreArea`. */
  areas?: ScoreArea[]
  /**
   * What the run was processed with, in the card's top corner.
   *
   * It sat on the first section's heading rule, level with the word "Approve",
   * where it read as a qualifier on the decision. This card is the run's own
   * arithmetic — the one block on the page that is entirely the assessment's
   * account of itself — so what the assessment was made with belongs in its
   * corner.
   */
  trailing?: React.ReactNode
}) => {
  const score = useMemo(() => identityScore(record, results, areas), [record, results, areas])

  if (!score) return null

  /**
   * A cell opens the assessment it scored, where it is.
   *
   * It used to send the reader to the Insights tab, at the category the first
   * of its insights happened to be filed under — out of the report, into a
   * reference list, to find rows the cell had just summarised. The cell is an
   * assessment now, and the assessment is on this page: the click scrolls to
   * its heading. `scrollIntoView` rather than a computed offset, so the
   * clearance stays with the section (`scroll-mt-6`), the way the contents rail
   * does it.
   */
  const jump = (c: ScoreComponent) =>
    document
      .getElementById(`section-${c.id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    /* The contents rail's `recommendation` entry locks here. The section it
       used to point at lost its heading when the card took over saying the
       call, so the anchor moved to the thing that says it. */
    <section id="section-recommendation" className="mt-10 scroll-mt-6">
      <CardLabel className="mb-2">Recommendation</CardLabel>
      <Surface
        variant="default"
        padding="none"
        className="overflow-hidden rounded-none border-text-primary"
      >
        {/* Solid, not the dashed attribute rule. The dash is this report's line
            for a value; what it divides here is the card's head from the
            assessments under it, which is a division of the card itself. */}
        <div className="flex items-start gap-5 border-b border-text-primary p-4">
          <ScoreRing value={score.value} band={score.band} />

          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-4">
              <Heading level={3}>{score.band.label}</Heading>
              {trailing && <span className="ml-auto shrink-0">{trailing}</span>}
            </div>

            {/* No "held at 89 from 91". The ceiling that capped the score is
                the finding it was capped for, and that finding is written out
                in the assessment it belongs to — saying it again in arithmetic,
                above the band, put the reader in the machinery before they had
                read the reasons. `score.ceilings` still carries it for anyone
                auditing the number. */}

            {/* The conditions, under the call they condition. Nothing else: no
                sentence summarising the cells below, no legend spelling out the
                bands — the cells say which stages are clear, and the band is
                the legend's one entry that matters. */}
            {followUps.length > 0 && <FollowUps items={followUps} className="mt-2" />}
          </div>
        </div>

        {/* No "What this rests on" label. The cells under the ring are the
            only thing below it, so a label saying they are what it rests on was
            naming the obvious in the card's own voice. */}
        <AttributeCells
          // Solid dividers: these cells are assessments, not attributes — see
          // `.cells-solid` in theme.css.
          className="cells-solid -mb-px"
          items={score.components.map((c) => componentCell(c, jump))}
        />
      </Surface>
    </section>
  )
}
