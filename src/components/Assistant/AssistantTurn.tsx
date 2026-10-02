import { memo, type ReactNode } from 'react'
import { Copy, RotateCcw, ThumbsDown, ThumbsUp } from 'lucide-react'

import { ActionButton, Avatar, ChatMessage, ChatMessageActions, ChatThinking, Surface, Text } from '@/core'

import type { BusinessRecord, Derived } from '../../lib/deriveResults'
import type { GroupId } from '../../lib/groups'
import { createLocalStore } from '../../lib/localStore'
import type { ReportBrief } from '../../lib/reportBrief'
import { acceptRecommendation, acceptedRecommendation, undoAcceptance, useReview } from '../../lib/review'
import { formatTime } from '../../lib/reportLabels'
import type { AnalysisVersion } from '../../lib/useAnalysis'
import { CURRENT_USER } from '../../lib/user'
import { ScoreRing } from '../DeterminationCard'
import { MiddeskMark } from '../MiddeskMark'
import { Para } from '../ReportBody'
import { AnswerSources, AssistantAnswer } from './AssistantAnswer'
import { formatDuration, stepsFor } from './steps'

/**
 * Who said it, and when — the caption over every turn.
 *
 * Kha's assistant names both sides: the reader's initial, name and time over
 * their bubble; the Middesk mark, "Assistant" and time over the answer. A
 * conversation between a person and a product is two voices, and a bubble on
 * one side and flat text on the other was not enough to keep them apart once
 * the answers grew long.
 */
const Meta = ({ who, at, align }: { who: ReactNode; at: string; align: 'start' | 'end' }) => (
  <span className={['flex items-center gap-1.5', align === 'end' ? 'justify-end' : ''].join(' ')}>
    {who}
    <span className="text-caption text-[var(--core-color-text-muted)]">{formatTime(at)}</span>
  </span>
)

const AssistantWho = () => (
  <span className="flex items-center gap-1.5 text-caption text-[var(--core-color-text-secondary)]">
    <MiddeskMark className="h-[7px] w-3" />
    Assistant
  </span>
)

/** The reader's turn: what they typed, with the skills it was sent with. */
export const UserTurn = ({
  typed,
  skills,
  at
}: {
  typed: string
  skills: string[]
  at: string
}) => {
  if (!typed && skills.length === 0) return null
  return (
    <div className="flex flex-col gap-1">
      <Meta
        align="end"
        at={at}
        who={
          <span className="flex items-center gap-1.5 text-caption text-[var(--core-color-text-secondary)]">
            <Avatar name={CURRENT_USER} size="sm" />
            {CURRENT_USER}
          </span>
        }
      />
      <ChatMessage
        role="user"
        chips={skills.map((name) => ({ id: `skill-${name}`, label: name }))}
      >
        {typed || undefined}
      </ChatMessage>
    </div>
  )
}

/** The answer, with its working and its evidence. Memoised: a log of settled
 *  turns must not re-render because the composer took a keystroke. */
export const AnswerTurn = memo(function AnswerTurn({
  version,
  results,
  record,
  groupFor,
  isLast,
  rated,
  onRate,
  onRetry,
  onJumpToGroup
}: {
  version: AnalysisVersion
  results: Derived[]
  record: BusinessRecord
  groupFor: (insightId: string) => GroupId
  /** Retry replays the LAST ask — offered only there, since replaying an
   *  older one would answer past everything after it. */
  isLast: boolean
  rated?: 'up' | 'down'
  onRate: (id: string, rating: 'up' | 'down') => void
  onRetry: () => void
  onJumpToGroup?: (groupId: string, insightIds: string[]) => void
}) {
  const text = version.result.sections
    .filter((s) => s.id !== 'recommendation')
    .flatMap((s) => s.body.map((b) => b.text))
    .join('\n\n')

  return (
    <ChatMessage
      role="assistant"
      header={<Meta align="start" at={version.at} who={<AssistantWho />} />}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <AnswerSources
            used={version.result.used}
            results={results}
            groupFor={groupFor}
            onJumpToGroup={onJumpToGroup}
          />
          <ChatMessageActions
            actions={[
              {
                id: 'copy',
                icon: <Copy size={12} strokeWidth={1.75} />,
                label: 'Copy answer',
                onClick: () => void navigator.clipboard?.writeText(text)
              },
              {
                id: 'up',
                icon: <ThumbsUp size={12} strokeWidth={1.75} />,
                label: 'Helpful answer',
                active: rated === 'up',
                onClick: () => onRate(version.id, 'up')
              },
              {
                id: 'down',
                icon: <ThumbsDown size={12} strokeWidth={1.75} />,
                label: 'Unhelpful answer',
                active: rated === 'down',
                onClick: () => onRate(version.id, 'down')
              },
              ...(isLast
                ? [
                    {
                      id: 'retry',
                      icon: <RotateCcw size={12} strokeWidth={1.75} />,
                      label: 'Retry answer',
                      onClick: onRetry
                    }
                  ]
                : [])
            ]}
          />
        </div>
      }
    >
      <div className="flex flex-col gap-2">
        <ChatThinking
          label={`Finished in ${formatDuration(version.durationMs)}`}
          duration={version.durationMs}
          steps={stepsFor('done', version.insightCount, version.durationMs)}
        />
        <AssistantAnswer
          result={version.result}
          results={results}
          record={record}
          groupFor={groupFor}
          onJumpToGroup={onJumpToGroup}
        />
      </div>
    </ChatMessage>
  )
})

/** Reports whose recommendation the reader has put away, in this browser. */
const dismissed = createLocalStore<boolean>('prototype.recommendation.dismissed.v1')

/**
 * The recommendation — the determination card, in little — floating over the
 * chat bar.
 *
 * The assessment's call, why, and the score in its band's colour at the far
 * edge, as the determination card set it. It sits on the composer rather than
 * in the conversation, so the call stays in view however far the conversation
 * has scrolled. Raised, because it floats.
 *
 * The reviewer answers it: Accept records the call as their decision, the way
 * the header's status control records any change, and the card shrinks to
 * the line that says so, with Undo. Dismiss puts it away — a pill to bring it
 * back, remembered for this report — and changes nothing.
 */
export const RecommendationCard = ({
  determination: d,
  businessId,
  reportId,
  results,
  record
}: {
  determination: NonNullable<ReportBrief['determination']>
  businessId: string
  reportId: string
  results: Derived[]
  record: BusinessRecord
}) => {
  const review = useReview(businessId, d.status)
  const hidden = Boolean(dismissed.useAll()[reportId])
  const accepted = acceptedRecommendation(review, d.status)

  if (hidden)
    return (
      <ActionButton variant="secondary" size="compact" onClick={() => dismissed.remove(reportId)}>
        Show recommendation
      </ActionButton>
    )

  if (accepted)
    return (
      <Surface variant="raised" padding="none" className="flex items-center gap-3 px-3 py-2" aria-label="Recommendation">
        <ScoreRing score={d.score} size="xs" />
        <span className="min-w-0 flex-1 text-sm leading-5 text-foreground">
          {d.label}
          <span className="text-text-secondary">
            {' · accepted by '}
            {review.change?.by === CURRENT_USER ? 'you' : review.change?.by}
          </span>
        </span>
        <ActionButton variant="quiet" size="compact" onClick={() => undoAcceptance(businessId)}>
          Undo
        </ActionButton>
      </Surface>
    )

  return (
    <Surface variant="raised" padding="none" className="flex items-center gap-3 px-3 py-3" aria-label="Recommendation">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium leading-5 text-foreground">{d.label}</span>
        {d.reason && (
          <Para inline className="text-sm leading-5 text-text-secondary" results={results} record={record}>
            {d.reason}
          </Para>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <ActionButton
            variant="primary"
            size="compact"
            onClick={() => acceptRecommendation(businessId, d.status, review.status)}
          >
            Accept
          </ActionButton>
          <ActionButton variant="quiet" size="compact" onClick={() => dismissed.set(reportId, true)}>
            Dismiss
          </ActionButton>
        </div>
      </div>
      <ScoreRing score={d.score} size="sm" />
    </Surface>
  )
}

/**
 * The report, as the conversation's first message.
 *
 * Not an answer: nothing was asked and nothing was generated. It is what the
 * page already says — each card's title and sentence, in the report's order;
 * the determination floats over the chat bar (`RecommendationCard`) — so it carries no thinking steps, no ratings and no
 * retry. Each title follows to its card on the report, the way a citation
 * chip follows to its evidence.
 */
export const BriefTurn = memo(function BriefTurn({
  brief,
  at,
  results,
  record,
  onJumpToCard
}: {
  brief: ReportBrief
  /** When the report was written. */
  at: string
  results: Derived[]
  record: BusinessRecord
  onJumpToCard?: (anchor: string) => void
}) {
  const d = brief.determination
  const text = [
    d ? `${d.label} · ${d.value}${d.reason ? `\n${d.reason}` : ''}` : '',
    ...brief.cards.map((c) => [c.title, c.sentence].filter(Boolean).join('\n'))
  ]
    .filter(Boolean)
    .join('\n\n')

  return (
    <ChatMessage
      role="assistant"
      header={<Meta align="start" at={at} who={<AssistantWho />} />}
      footer={
        <ChatMessageActions
          actions={[
            {
              id: 'copy',
              icon: <Copy size={12} strokeWidth={1.75} />,
              label: 'Copy summary',
              onClick: () => void navigator.clipboard?.writeText(text)
            }
          ]}
        />
      }
    >
      <div className="flex flex-col gap-3">
        {brief.cards.map((c) => (
          <div key={c.anchor} className="flex flex-col gap-0.5">
            {onJumpToCard ? (
              <button
                type="button"
                onClick={() => onJumpToCard(c.anchor)}
                className="w-fit text-left text-sm font-medium leading-5 text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {c.title}
              </button>
            ) : (
              <span className="text-sm font-medium leading-5 text-foreground">{c.title}</span>
            )}
            {c.sentence && (
              <Para inline className="text-sm leading-5 text-text-secondary" results={results} record={record}>
                {c.sentence}
              </Para>
            )}
          </div>
        ))}
      </div>
    </ChatMessage>
  )
})

/** The answer being written: the steps, live, and nothing else yet. */
export const PendingTurn = ({ startedAt, insightCount }: { startedAt: string; insightCount: number }) => (
  <ChatMessage role="assistant" busy header={<Meta align="start" at={startedAt} who={<AssistantWho />} />}>
    <ChatThinking active label="Working…" steps={stepsFor('working', insightCount, 0)} />
  </ChatMessage>
)

/** The answer that did not land. Kha's words, and the way back: Retry. */
export const ErrorTurn = ({
  message,
  at,
  insightCount,
  onRetry
}: {
  message: string
  at: string
  insightCount: number
  onRetry: () => void
}) => (
  <ChatMessage
    role="assistant"
    header={<Meta align="start" at={at} who={<AssistantWho />} />}
    footer={
      <ChatMessageActions
        actions={[
          {
            id: 'retry',
            icon: <RotateCcw size={12} strokeWidth={1.75} />,
            label: 'Retry answer',
            onClick: onRetry
          }
        ]}
      />
    }
  >
    <div className="flex flex-col gap-2">
      <ChatThinking label="Couldn’t finish" steps={stepsFor('failed', insightCount, 0)} />
      <Text tone="danger">{message}</Text>
    </div>
  </ChatMessage>
)
