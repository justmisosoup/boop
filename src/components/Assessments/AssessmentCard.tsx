import type { ReactNode } from 'react'

import { LayoutGrid, List, MoreHorizontal } from 'lucide-react'

import {
  ActionButton,
  DateTime,
  IconActionButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  MetaChip,
  SegmentedControl,
  SegmentedControlItem,
  Skeleton,
  Surface,
  Text
} from '@/core'
import { cn } from '@/utils/twUtils'

import type { AssessmentRead } from '../../lib/assessments'
import { DeterminationChip } from '../DeterminationChip'
import { InsightCounts } from '../InsightCounts'
import { countsOf, OutcomeSpark } from '../Report/ReportHero'
import { ScoreHead } from '../Report/AssessmentPanel'
import { CardHeader } from '../CardHeader'

/** The name both ends of the card's move share — see `ScoreCard`. */
export const assessmentTransitionName = (id: string) => `assessment-${id}`

export type AssessmentLayout = 'list' | 'grid'

type Props = {
  read: AssessmentRead
  /** A summary is being written. */
  running: boolean
  onOpen: () => void
  onGenerate: () => void
  onOrderAgain?: () => void
}

/** The score as the report's card reads it: name, number and call, bar — the
 *  number and bar across the block's full width, anything trailing beside the name. */
const ScoreBlock = ({ read, trailing }: { read: AssessmentRead; trailing?: ReactNode }) => (
  <div className="flex w-full flex-col gap-3">
    {/* The call first, where the eye lands; then the score and its bar. What
        was assessed sits under them, with its summary. */}
    <div className="flex min-w-0 items-center justify-between gap-2">
      {read.ordering ? <MetaChip size="compact">Ordering</MetaChip> : <DeterminationChip band={read.score?.band ?? null} />}
      {trailing && <div className="-my-1 -mr-2 shrink-0">{trailing}</div>}
    </div>
    <div className="flex w-full items-center justify-between gap-3">
      <span
        className="text-3xl font-semibold leading-none tabular-nums text-text-primary"
        aria-label={read.score ? `Assessment score ${read.score.value} out of 100` : 'Not scored yet'}
      >
        {read.score?.value ?? '—'}
      </span>
      <InsightCounts counts={countsOf(read.tally)} labels={false} />
    </div>
    <OutcomeSpark tally={read.tally} />
  </div>
)

/** What it found, and when that was written. Regenerating is in the ⋯ menu. */
/** The ghost holds the summary's full height — two lines in a card, three in
 *  a row — and the line under it is always there, so nothing shifts as the
 *  summary lands. A short summary keeps "Generated" right under it; cards in a
 *  row stay level by stretching, with the button pinned at the foot. */
const RESERVE = { 2: 'min-h-10', 3: 'min-h-[3.75rem]' } as const

const SummaryBlock = ({ read, running, lines }: Props & { lines: 2 | 3 }) => (
  <div className="flex min-w-0 flex-1 flex-col gap-1">
    {read.summary ? (
      // Secondary, under the score: the number leads, the summary supports it.
      // A touch smaller than body (13px, asked for): it supports the score.
      <Text className={cn('text-dense leading-5', lines === 2 ? 'line-clamp-2' : 'line-clamp-3')} tone="secondary">
        {read.summary.text}
      </Text>
    ) : (
      // A ghost of the summary until it is written: it fills in on its own once
      // the assessment's orders finish and the summary lands.
      <div
        role="status"
        aria-label={read.ordering ? 'Waiting for its orders to finish' : 'Writing summary'}
        className={cn('flex flex-col justify-center gap-2', RESERVE[lines])}
      >
        <Skeleton className="w-full" />
        <Skeleton className="w-11/12" />
        {lines === 3 && <Skeleton className="w-2/3" />}
      </div>
    )}
    <Text size="sm" tone="secondary" className="min-h-5">
      {read.summary?.at ? (
        <>
          Generated <DateTime relative>{read.summary.at}</DateTime>
        </>
      ) : (
        <span aria-hidden="true">&nbsp;</span>
      )}
    </Text>
  </div>
)

const openLabel = (_read: AssessmentRead) => 'View assessment'

const MoreMenu = ({ read, onGenerate, onOrderAgain }: Props) => (
  <Menu>
    <MenuTrigger asChild>
      <IconActionButton aria-label={`Actions for ${read.assessment.name}`} variant="quiet">
        <MoreHorizontal aria-hidden="true" />
      </IconActionButton>
    </MenuTrigger>
    <MenuContent align="end" themeMode="light">
      <MenuItem onSelect={onGenerate}>{read.summary ? 'Regenerate summary' : 'Generate summary'}</MenuItem>
      {onOrderAgain && <MenuItem onSelect={onOrderAgain}>Run again</MenuItem>}
    </MenuContent>
  </Menu>
)

/**
 * One assessment as a row of the list: score, summary and actions across.
 * The rows share one bordered box, ruled apart.
 */
export const AssessmentRow = (props: Props) => (
  <li
    className="flex flex-col gap-4 p-4 md:flex-row md:items-start md:gap-6 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-[var(--core-color-border-divider)]"
    style={{ viewTransitionName: assessmentTransitionName(props.read.assessment.id) }}
  >
    <div className="flex shrink-0 flex-col gap-3 md:w-60">
      <ScoreBlock read={props.read} />
      <h3 className="m-0 min-w-0 truncate text-base font-semibold">{props.read.assessment.name}</h3>
    </div>
    <SummaryBlock {...props} lines={3} />
    <div className="flex shrink-0 items-center gap-1">
      <ActionButton variant="secondary" onClick={props.onOpen}>
        {openLabel(props.read)}
      </ActionButton>
      <MoreMenu {...props} />
    </div>
  </li>
)

/**
 * One assessment as a card of the grid, read top to bottom as the report's own
 * score card reads it. None of the report's data — opening it is for that.
 */
export const AssessmentCard = (props: Props) => {
  const { read } = props
  return (
    <Surface
      variant="card"
      padding="none"
      // The whole card opens the assessment: the title's button stretches over
      // it (::after); the ⋯ sits above that layer.
      className="relative flex h-full flex-col overflow-hidden shadow-elevation-card transition-[border-color,box-shadow] duration-fast hover:border-[var(--core-color-border-strong)] hover:shadow-elevation-raised motion-reduce:transition-none"
      style={{ viewTransitionName: assessmentTransitionName(read.assessment.id) }}
    >
      {/* The report cards' own head: the serif title over a hairline, the
          assessment's call and its menu at the right. */}
      <CardHeader
        title={
          <button
            className="min-w-0 truncate text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-card focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-[var(--core-color-focus-ring)]"
            onClick={props.onOpen}
            type="button"
          >
            {read.assessment.name}
          </button>
        }
        trailing={
          <span className="relative z-[1] -my-1 -mr-2 flex items-center gap-1">
            {read.ordering ? <MetaChip size="compact">Ordering</MetaChip> : <DeterminationChip band={read.score?.band ?? null} />}
            <MoreMenu {...props} />
          </span>
        }
      />
      {/* The drill-in's own score: the number, how the insights read, the
          bar; then what it found. */}
      <div className="flex flex-1 flex-col gap-4 p-4">
        <ScoreHead score={read.score?.value ?? null} tally={read.tally} />
        <SummaryBlock {...props} lines={2} />
      </div>
    </Surface>
  )
}

/** List or grid, as the report's cards switch their own displays. */
export const AssessmentLayoutToggle = ({
  value,
  onChange
}: {
  value: AssessmentLayout
  onChange: (layout: AssessmentLayout) => void
}) => (
  <SegmentedControl size="sm" value={value} onValueChange={(v) => onChange(v as AssessmentLayout)} aria-label="Assessments display">
    <SegmentedControlItem value="list" aria-label="List" className="!px-2" icon={<List aria-hidden="true" size={14} strokeWidth={1.75} />} />
    <SegmentedControlItem
      value="grid"
      aria-label="Grid"
      className="!px-2"
      icon={<LayoutGrid aria-hidden="true" size={14} strokeWidth={1.75} />}
    />
  </SegmentedControl>
)
