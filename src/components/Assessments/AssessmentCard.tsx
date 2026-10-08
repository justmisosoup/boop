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
import { OutcomeSpark } from '../Report/ReportHero'

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
    <div className="flex min-w-0 items-center justify-between gap-2">
      <h3 className="m-0 min-w-0 truncate text-base font-semibold">{read.assessment.name}</h3>
      {trailing && <div className="-my-1 -mr-2 shrink-0">{trailing}</div>}
    </div>
    <div className="flex w-full items-center justify-between gap-3">
      <span
        className="text-3xl font-semibold leading-none tabular-nums text-text-primary"
        aria-label={read.score ? `Assessment score ${read.score.value} out of 100` : 'Not scored yet'}
      >
        {read.score?.value ?? '—'}
      </span>
      {read.ordering ? <MetaChip size="compact">Ordering</MetaChip> : <DeterminationChip band={read.score?.band ?? null} />}
    </div>
    <OutcomeSpark tally={read.tally} />
  </div>
)

/** What it found, and when that was written. Regenerating is in the ⋯ menu. */
/** The ghost holds the summary's full height — two lines in a card, three in
 *  a row — and the line under it is always there, so nothing shifts as the
 *  summary lands. A short summary keeps "Generated" right under it; cards in a
 *  row stay level by stretching, with the button pinned at the foot. */
const RESERVE = { 2: 'min-h-12', 3: 'min-h-[4.5rem]' } as const

const SummaryBlock = ({ read, running, lines }: Props & { lines: 2 | 3 }) => (
  <div className="flex min-w-0 flex-1 flex-col gap-1">
    {read.summary ? (
      <Text className={cn('leading-6', lines === 2 ? 'line-clamp-2' : 'line-clamp-3')}>
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
    <div className="shrink-0 md:w-60">
      <ScoreBlock read={props.read} />
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
export const AssessmentCard = (props: Props) => (
  <Surface
    variant="card"
    padding="none"
    className="flex h-full flex-col gap-4 p-4 transition-colors duration-fast hover:border-[var(--core-color-border-strong)] motion-reduce:transition-none"
    style={{ viewTransitionName: assessmentTransitionName(props.read.assessment.id) }}
  >
    <ScoreBlock read={props.read} trailing={<MoreMenu {...props} />} />
    <SummaryBlock {...props} lines={2} />
    <ActionButton variant="secondary" className="mt-auto w-full" onClick={props.onOpen}>
      {openLabel(props.read)}
    </ActionButton>
  </Surface>
)

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
