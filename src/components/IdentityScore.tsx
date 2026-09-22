import { useMemo } from 'react'

import { Heading, MutedText, Surface, Text } from '@/core'

import type { BusinessRecord, Derived } from '../lib/deriveResults'
import {
  BANDS,
  identityScore,
  type BandId,
  type IdentityScore,
  type ScoreArea,
  type ScoreBand,
  type ScoreComponent
} from '../lib/identityScore'
import { cn } from '../utils/twUtils'
import { AttributeCells, type AttributeCell } from './AttributeGrid'
import { CardLabel } from './CardLabel'

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

const BAND_DOT: Record<BandId, string> = {
  established: 'bg-[var(--core-color-status-success-fg)]',
  conditions: 'bg-[var(--core-color-status-warning-fg)]',
  not_established: 'bg-[var(--core-color-status-danger-fg)]'
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

/** One assessment, as a cell: what it scored, what it is worth, and why. */
const componentCell = (
  c: ScoreComponent,
  onSelect?: (component: ScoreComponent) => void
): AttributeCell => ({
  key: c.id,
  label: c.label,
  values: [
    {
      value: c.subScore === null ? 'Not evaluated' : `${c.subScore} / 100`,
      qualifier: c.subScore === null ? undefined : `(${c.appliedWeight}% of the score)`,
      note:
        c.subScore === null
          ? `Nothing to read — ${c.missing.join(', ')}`
          : [...c.reasons, ...c.missing.map((m) => `not counted: ${m}`)].join(' · ')
    }
  ],
  // No submitted/verified mark. An assessment's score is not an attribute, and
  // a tick beside "Identity" would claim a source of record attested our own
  // arithmetic.
  onSelect: onSelect ? () => onSelect(c) : undefined
})

/**
 * How well the identity stands up, under the actions it justifies.
 *
 * The ring is the claim, the breakdown is the argument, and they are one card
 * because the number is invented and must never travel without its working. See
 * `src/lib/identityScore.ts` for what is being asserted and what is not.
 */
/**
 * How the business performed against what it was assessed by, in one line.
 *
 * It read "5 of 5 assessments made", which counted the work rather than
 * reporting it — a reader looking at five cells already knows there are five,
 * and none of them learns anything from being told they exist. This names which
 * assessments came back clear and which one is holding the number down, so the
 * line is a reading of the card under it rather than a tally of it.
 *
 * Nothing is invented: `CLEAR` is the same 90 the top band starts at, and the
 * names are the assessments' own.
 */
const summarise = (score: IdentityScore): string | null => {
  const read = score.components.filter((c) => c.subScore !== null)
  if (read.length === 0) return null
  if (score.findings === 0) return `All ${read.length} assessments came back clear.`

  return `${read.length} assessments read; ${score.findings} finding${
    score.findings === 1 ? '' : 's'
  } to resolve, marked below.`
}

export const IdentityScoreCard = ({
  record,
  results,
  areas,
  trailing
}: {
  record: BusinessRecord
  results: Derived[]
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

  const summary = summarise(score)
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
    <section className="mt-10">
      <CardLabel className="mb-2">Assessment score</CardLabel>
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
                below in the component it belongs to — saying it again in
                arithmetic, above the band, put the reader in the machinery
                before they had read the reasons. `score.ceilings` still carries
                it for anyone auditing the number. */}

            {/* What the card below it says, said once — see `summarise`. Body
                size and graphite, not the caption grey: it is the sentence a
                reviewer reads off this card, and it was set smaller and lighter
                than the legend under it. */}
            {summary && <Text className="mt-1 block">{summary}</Text>}

            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {BANDS.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center gap-1.5 text-caption leading-snug text-muted-foreground"
                >
                  <span aria-hidden="true" className={cn('size-2 rounded-full', BAND_DOT[b.id])} />
                  {b.range} {b.label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* No "What this rests on" label. The cells under the ring are the
            only thing below it, so a label saying they are what it rests on was
            naming the obvious in the card's own voice. */}
        <AttributeCells
          className="-mb-px"
          items={score.components.map((c) => componentCell(c, jump))}
        />
      </Surface>
    </section>
  )
}
