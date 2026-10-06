import { ActionButton, ChatMessage, Text } from '@/core'

import type { Derived } from '../../lib/deriveResults'
import type { GroupId } from '../../lib/groups'
import type { ReportBrief } from '../../lib/reportBrief'
import { CardCitations } from './AssistantTurn'

export const AssessmentSteps = ({
  recommendation,
  resolved = [],
  results,
  groupFor,
  onJumpToGroup,
  onReview,
  reviewable = true
}: {
  recommendation: NonNullable<ReportBrief['determination']>
  resolved?: number[]
  results: Derived[]
  groupFor: (insightId: string) => GroupId
  onJumpToGroup: (cardId: string, insightIds: string[]) => void
  onReview: (index?: number) => void
  reviewable?: boolean
}) => {
  const steps = recommendation.steps.flatMap((step, index) => resolved.includes(index + 1) ? [] : [{ ...step, index }])

  return (
    <section aria-label="Assessment next steps" className="flex flex-col gap-3 pt-3">
      {steps.length > 0 ? (
        <>
          <Text className="font-medium">Next steps</Text>
          <ol aria-label="Requested assessment steps" className="flex flex-col gap-4">
            {steps.map((step) => (
              <li key={step.index}>
                <ChatMessage role="assistant" header={<Text size="sm" tone="secondary">Step {step.index + 1}</Text>}>
                  <div className="flex flex-col gap-2">
                    <Text>{step.instruction}</Text>
                    {step.why && <Text size="sm" tone="secondary">{step.why}</Text>}
                    <span className="flex flex-wrap gap-1">
                      <CardCitations cites={step.cites} results={results} groupFor={groupFor} onSelect={onJumpToGroup} />
                    </span>
                    {reviewable && <div>
                      <ActionButton variant="secondary" size="compact" onClick={() => onReview(step.index)}>
                        Review step {step.index + 1}
                      </ActionButton>
                    </div>}
                  </div>
                </ChatMessage>
              </li>
            ))}
          </ol>
        </>
      ) : reviewable ? (
        <ActionButton variant="secondary" size="compact" className="self-start" onClick={() => onReview()}>
          Review recommendation
        </ActionButton>
      ) : null}
    </section>
  )
}
