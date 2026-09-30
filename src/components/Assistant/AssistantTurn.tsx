import { memo, type ReactNode } from 'react'
import { Copy, RotateCcw, ThumbsDown, ThumbsUp } from 'lucide-react'

import { Avatar, ChatMessage, ChatMessageActions, ChatThinking, Text } from '@/core'

import type { BusinessRecord, Derived } from '../../lib/deriveResults'
import type { GroupId } from '../../lib/groups'
import { formatTime } from '../../lib/reportLabels'
import type { AnalysisVersion } from '../../lib/useAnalysis'
import { CURRENT_USER } from '../../lib/user'
import { MiddeskMark } from '../MiddeskMark'
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
