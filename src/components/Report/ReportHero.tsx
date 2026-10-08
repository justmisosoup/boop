import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'

import { ArrowLeft, Check, Minus, Sparkles, TriangleAlert, X } from 'lucide-react'

import { ActionButton, Hint, HintContent, HintTrigger, IconActionButton, PageHeading, Surface, Text } from '@/core'

import { displayName } from '../../lib/businessNames'
import type { BusinessRecord } from '../../lib/deriveResults'
import type { ReportBrief } from '../../lib/reportBrief'
import { cn } from '../../utils/twUtils'
import { CardHeader } from '../CardHeader'
import { ScoreRing } from '../DeterminationCard'

export const ReportHero = ({
  record,
  status,
  assignee,
  assessment,
  summary,
  compact = false
}: {
  record: BusinessRecord
  status?: ReactNode
  assignee?: ReactNode
  assessment?: NonNullable<ReportBrief['determination']>
  /** What the score's hint says, pinned. */
  summary?: string
  compact?: boolean
}) => {
  const navigate = useNavigate()
  const backLink = (
    <Hint asChild content="Back to businesses" side="bottom">
      <IconActionButton variant="quiet" size="compact" aria-label="Back to businesses" onClick={() => navigate('/businesses')}>
        <ArrowLeft size={16} aria-hidden="true" />
      </IconActionButton>
    </Hint>
  )
  const score = assessment && (
    <Hint>
      <HintTrigger className="shrink-0 rounded-pill" aria-label={`Assessment score ${assessment.value} out of 100. Show summary`}>
        <ScoreRing score={assessment.score} size={compact ? 'xs' : 'sm'} label={assessment.label} />
      </HintTrigger>
      <HintContent side="bottom" align="start">
        {summary ?? assessment.reason ?? assessment.label}
      </HintContent>
    </Hint>
  )
  return (
    <section aria-label="Report" data-assessment-layout={compact ? 'compact' : 'expanded'} className={cn('flex min-w-0 flex-col', compact ? 'gap-2' : 'gap-4')}>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="relative flex min-w-0 max-w-full items-center gap-3">
          {compact && <div className="absolute -left-10 top-1/2 hidden -translate-y-1/2 wide:block">{backLink}</div>}
          {compact && score}
          <PageHeading level={2} size="lg" weight="normal" className={cn(
            'min-w-0 break-words font-arizona font-light',
            compact ? 'text-body-lg leading-6' : 'text-3xl leading-10 tracking-[-0.02em]'
          )}>
            {displayName(record.name)}
          </PageHeading>
        </div>
        {(assignee || status) && <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">
          {assignee}
          {/* The call sits beside the score in the card; pinned, with the card
              scrolled away, the header carries it. */}
          {(compact || !assessment) && status}
        </div>}
      </div>
      {/* Below `wide` the back arrow has no gutter to sit in; it gets a row. */}
      {compact && (
        <div className="flex items-center gap-2 wide:hidden">{backLink}</div>
      )}
    </section>
  )
}

/**
 * The score, and under it the steps to review — the report's follow-ups,
 * each a row that takes the report to the card the step rests on. The left
 * column's card.
 */
export const ScoreCard = ({
  assessment,
  blurb,
  onShowSummary,
  summaryGenerated = false,
  insights = [],
  overall,
  status,
  onSelectInsight,
  className
}: {
  assessment: NonNullable<ReportBrief['determination']>
  /** The business in a sentence or two, under the ring. */
  blurb?: string
  /** The Assistant, opened on its summary of the report. */
  onShowSummary: () => void
  /** The Assistant has written the full assessment: the button shows it again. */
  summaryGenerated?: boolean
  /** Every insight on the report, grouped by the card it is about. */
  insights?: Array<{ id: string; statement: string; outcome: 'pass' | 'review' | 'fail' | 'neutral'; group: string }>
  /** The status control, beside the score. */
  status?: ReactNode
  /** Every insight on the report, as the spark under the score reads them. */
  overall?: OutcomeTally
  /** An insight, chosen: the report goes to its card. */
  onSelectInsight?: (id: string) => void
  className?: string
}) => {
  return (
    <Surface variant="card" padding="none" className={cn('flex flex-col overflow-hidden', className)}>
      <div className="flex flex-col items-start gap-3 px-4 py-4">
        {/* The score as a number, the call it backs beside it, and how the
            report's insights read under both. */}
        <div className="flex w-full items-center justify-between gap-3">
          <span className="text-3xl font-semibold leading-none tabular-nums text-text-primary" aria-label={`Assessment score ${assessment.value} out of 100`}>
            {assessment.value}
          </span>
          {status}
        </div>
        {overall && <OutcomeSpark tally={overall} />}
        {blurb && <Text className="break-words leading-6">{blurb}</Text>}
        {/* The full assessment is the Assistant's; this is the way to it. */}
        <ActionButton variant="secondary" size="compact" className="w-full" onClick={onShowSummary} leadingIcon={<Sparkles size={14} aria-hidden="true" />}>
          {summaryGenerated ? 'Show assessment' : 'Generate assessment'}
        </ActionButton>
      </div>
      {insights.length > 0 && (
        <>
          <CardHeader title="Insights" className="border-t" />
          {/* Every insight, grouped by the card it is about, edge to edge as
              the cards' tables read: a small-caps header per group with its
              count, then its insights as rows ruled apart. Choosing one takes
              the report to that card. */}
          <div className="flex flex-col">
            {[...new Set(insights.map((i) => i.group))].map((g) => {
              const inGroup = insights.filter((i) => i.group === g)
              return (
                <section key={g} aria-label={g} className="flex flex-col border-t border-[var(--core-color-border-divider)] first:border-t-0">
                  <div className="flex items-baseline justify-between gap-2 border-b border-[var(--core-color-border-divider)] px-4 py-2 text-caption font-medium uppercase tracking-wide text-text-secondary">
                    <span className="min-w-0">{g}</span>
                    <span className="shrink-0 tabular-nums">{inGroup.length}</span>
                  </div>
                  {inGroup.map((i) => (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => onSelectInsight?.(i.id)}
                      className="flex w-full items-start gap-2.5 bg-[image:var(--insight-rule-x)] bg-[length:100%_1px] bg-[position:left_bottom] bg-no-repeat px-4 py-2 text-left transition-colors duration-fast last:bg-none hover:bg-[var(--core-color-state-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--core-color-focus-ring)] motion-reduce:transition-none"
                    >
                      {/* The chips' marks: passed, needs review, failed, context. */}
                      <span className={cn('mt-1 flex', i.outcome === 'fail' ? 'text-[var(--core-color-status-danger-fg)]' : i.outcome === 'review' ? 'text-[var(--core-color-status-warning-fg)]' : i.outcome === 'pass' ? 'text-[var(--core-color-status-success-fg)]' : 'text-text-secondary')}>
                        {i.outcome === 'fail' ? <X {...CHIP_ICON} /> : i.outcome === 'review' ? <TriangleAlert {...CHIP_ICON} /> : i.outcome === 'pass' ? <Check {...CHIP_ICON} /> : <Minus {...CHIP_ICON} />}
                      </span>
                      {/* Dense: a step under the body, a step over the group's caption. */}
                      <span className={cn('min-w-0 flex-1 text-dense leading-5', i.outcome === 'neutral' ? 'text-text-secondary' : 'text-foreground')}>{i.statement}</span>
                    </button>
                  ))}
                </section>
              )
            })}
          </div>
        </>
      )}
    </Surface>
  )
}

/** The report's chip icon: the size, stroke and spacing the status chips use. */
const CHIP_ICON = { 'aria-hidden': true, size: 12, strokeWidth: 2, className: 'shrink-0' } as const

export type OutcomeTally = { good: number; review: number; bad: number; neutral: number }

/**
 * How a set of insights read, as one thin bar: passed, needs review, failed,
 * context — each its share, in that order. Under each assessment and under
 * the score, so the whole and its parts read the same way.
 */
export const OutcomeSpark = ({ tally, className }: { tally: OutcomeTally; className?: string }) => {
  const parts = (
    [
      [tally.good, 'bg-[var(--core-color-status-success-fg)]'],
      [tally.review, 'bg-[var(--core-color-status-warning-fg)]'],
      [tally.bad, 'bg-[var(--core-color-status-danger-fg)]'],
      [tally.neutral, 'bg-[var(--core-color-border-strong)]']
    ] as const
  ).filter(([n]) => n > 0)
  if (parts.length === 0) return null
  return (
    <span
      role="img"
      aria-label={`${tally.good} passed, ${tally.review} need review, ${tally.bad} failed, ${tally.neutral} context`}
      className={cn('flex h-1 w-full gap-px overflow-hidden rounded-pill', className)}
    >
      {parts.map(([n, cls], i) => (
        <span key={i} className={cn('h-full', cls)} style={{ flexGrow: n, flexBasis: 0 }} />
      ))}
    </span>
  )
}
