import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'

import { ArrowLeft, ArrowRight } from 'lucide-react'

import { ActionButton, Hint, HintContent, HintTrigger, IconActionButton, PageHeading, Text } from '@/core'

import { displayName } from '../../lib/businessNames'
import type { BusinessRecord } from '../../lib/deriveResults'
import type { ReportBrief } from '../../lib/reportBrief'
import { cn } from '../../utils/twUtils'
import { ScoreRing } from '../DeterminationCard'

export const ReportHero = ({
  record,
  status,
  assignee,
  assessment,
  summary,
  resolved = [],
  compact = false,
  onReviewSteps
}: {
  record: BusinessRecord
  status?: ReactNode
  assignee?: ReactNode
  assessment?: NonNullable<ReportBrief['determination']>
  summary?: string
  resolved?: number[]
  compact?: boolean
  onReviewSteps?: () => void
}) => {
  const navigate = useNavigate()
  const steps = assessment?.steps.filter((_, index) => !resolved.includes(index + 1)) ?? []
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
  const stepAction = steps.length > 0 && (
    <ActionButton
      variant="secondary"
      size="compact"
      className="shrink-0"
      aria-label={`Review ${steps.length} ${steps.length === 1 ? 'step' : 'steps'} in Assistant`}
      onClick={onReviewSteps}
    >
      Review {steps.length} {steps.length === 1 ? 'step' : 'steps'}
      <ArrowRight size={14} aria-hidden="true" />
    </ActionButton>
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
          {status}
        </div>}
      </div>
      {assessment && !compact && (
        <div className="flex min-w-0 items-start gap-4">
          {score}
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            {summary && <Text tone="secondary" className="break-words leading-5">{summary}</Text>}
            {stepAction && <div className="flex">{stepAction}</div>}
          </div>
        </div>
      )}
      {(compact || !assessment) && (compact || steps.length > 0) && (
        <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-2', !stepAction && 'wide:hidden')}>
          <div className="flex items-center gap-2">
            {compact && <div className="wide:hidden">{backLink}</div>}
            {stepAction}
          </div>
        </div>
      )}
    </section>
  )
}
