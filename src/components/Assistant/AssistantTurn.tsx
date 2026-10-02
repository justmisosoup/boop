import { memo, type ReactNode } from 'react'
import { Copy, RotateCcw, ThumbsDown, ThumbsUp } from 'lucide-react'

import { ActionButton, Avatar, ChatMessage, ChatMessageActions, ChatSourceChip, ChatThinking, Text } from '@/core'

import type { BusinessRecord, Derived } from '../../lib/deriveResults'
import type { GroupId } from '../../lib/groups'
import type { IdentityScore } from '../../lib/identityScore'
import type { RecommendationAnswer } from '../../lib/review'
import type { BriefCard, ReportBrief } from '../../lib/reportBrief'
import { formatTime } from '../../lib/reportLabels'
import type { AnalysisVersion } from '../../lib/useAnalysis'
import { CURRENT_USER } from '../../lib/user'
import { ScoreRing } from '../DeterminationCard'
import { MiddeskMark } from '../MiddeskMark'
import { Para } from '../ReportBody'
import { AnswerSources, AssistantAnswer } from './AssistantAnswer'
import { evidenceByCard } from './evidence'
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
export const Meta = ({ who, at, align }: { who: ReactNode; at: string; align: 'start' | 'end' }) => (
  <span className={['flex items-center gap-1.5', align === 'end' ? 'justify-end' : ''].join(' ')}>
    {who}
    <span className="text-caption text-[var(--core-color-text-muted)]">{formatTime(at)}</span>
  </span>
)

export const AssistantWho = () => (
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

/** What the analyst's answer says: the status's own word. */
const ANSWERED: Record<RecommendationAnswer['choice'], string> = { approve: 'Approved', reject: 'Rejected' }

/**
 * The analyst's answer to the recommendation, as their turn in the
 * conversation: what they chose, the score it was given against, their note,
 * when, and Undo to back out of it — which puts the status back and the
 * recommendation card over the chat bar.
 */
export const DecisionTurn = ({
  choice,
  recommended,
  label,
  note,
  score,
  by,
  at,
  onUndo
}: {
  choice: RecommendationAnswer['choice']
  /** The answer is the call the assessment recommended. */
  recommended: boolean
  /** The recommendation's word, for the ring. */
  label: string
  note?: string
  score: IdentityScore
  by: string
  at: string
  onUndo: () => void
}) => (
  <ReviewerTurn by={by} at={at} onUndo={onUndo}>
    <span className="flex items-center gap-2">
      <ScoreRing score={score} size="xs" label={label} />
      <span>
        <span className="font-medium">{ANSWERED[choice]}</span> the business
        {recommended && <span className="text-text-secondary"> · as recommended</span>}
      </span>
    </span>
    {note && <span className="mt-1 block whitespace-pre-wrap text-text-secondary">{note}</span>}
  </ReviewerTurn>
)

/**
 * The reviewer removing the recommendation, as their turn in the
 * conversation, with Undo — which puts the card back over the chat bar.
 */
export const DismissedTurn = ({ by, at, onUndo }: { by?: string; at?: string; onUndo: () => void }) => (
  <ReviewerTurn by={by} at={at} onUndo={onUndo}>
    <span className="text-text-secondary">Dismissed the recommendation</span>
  </ReviewerTurn>
)

/** Something the reviewer did, as their turn: who and when, what, and Undo. */
const ReviewerTurn = ({
  by,
  at,
  onUndo,
  children
}: {
  by?: string
  /** ISO timestamp; absent for a record kept before times were. */
  at?: string
  onUndo: () => void
  children: ReactNode
}) => (
  <div className="flex flex-col gap-1">
    {by && at && (
      <Meta
        align="end"
        at={at}
        who={
          <span className="flex items-center gap-1.5 text-caption text-[var(--core-color-text-secondary)]">
            <Avatar name={by} size="sm" />
            {by}
          </span>
        }
      />
    )}
    <ChatMessage role="user">{children}</ChatMessage>
    <span className="flex justify-end">
      <ActionButton variant="quiet" size="compact" onClick={onUndo}>
        Undo
      </ActionButton>
    </span>
  </div>
)

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

/**
 * The cards a line rests on, as citation chips — one per report card, in the
 * report's order (`evidenceByCard`). Following a chip lands on that card.
 */
export const CardCitations = ({
  cites,
  results,
  groupFor,
  onSelect
}: {
  cites?: ReadonlyArray<string>
  results: Derived[]
  groupFor: (insightId: string) => GroupId
  onSelect?: (cardId: string, insightIds: string[]) => void
}) => {
  const { sources } = evidenceByCard(cites, results, groupFor, onSelect)
  if (sources.length === 0) return null
  return (
    <>
      {sources.map((src) => (
        <ChatSourceChip key={src.id} sources={[src]} />
      ))}
    </>
  )
}

/**
 * An assessment's cards as one citation: the first card's glyph and name,
 * "+N" for the rest, the way a citation with several sources reads. The
 * citations' own chip, so it previews on hover as they do — which cards, and
 * how many insights — and clicking it shows them: the report narrowed to
 * those cards, and again, the whole report.
 */
export const RollupCitation = ({
  cites,
  results,
  groupFor,
  shown,
  onSelect
}: {
  cites?: ReadonlyArray<string>
  results: Derived[]
  groupFor: (insightId: string) => GroupId
  /** The report is narrowed to these cards now. */
  shown: boolean
  onSelect: () => void
}) => {
  const { sources, missing } = evidenceByCard(cites, results, groupFor)
  if (sources.length === 0) return null
  const [first] = sources
  const names = sources.map((x) => x.label)
  const insights = (cites?.length ?? 0) - missing
  return (
    <ChatSourceChip
      sources={[
        {
          id: `rollup-${first.id}`,
          label: sources.length > 1 ? `${first.label} +${sources.length - 1}` : first.label,
          title: names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0],
          annotation: `${sources.length} card${sources.length === 1 ? '' : 's'} · ${insights} insight${insights === 1 ? '' : 's'}`,
          snippet: shown ? 'Click to show the full report again.' : 'Click to show only these cards in the report.',
          icon: first.icon,
          onSelect
        }
      ]}
    />
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
  groupFor,
  focus,
  onFocusAssessment,
  onJumpToCard,
  onJumpToGroup
}: {
  brief: ReportBrief
  /** When the report was written. */
  at: string
  results: Derived[]
  record: BusinessRecord
  groupFor: (insightId: string) => GroupId
  /** The assessment the report is narrowed to, if any. */
  focus?: { id: string } | null
  /** Narrow the report to this assessment's cards — or widen it, when it already is. */
  onFocusAssessment?: (card: BriefCard) => void
  onJumpToCard?: (anchor: string) => void
  /** A citation chip: scrolls the report to its card. Nothing opens. */
  onJumpToGroup?: (cardId: string, insightIds: string[]) => void
}) {
  const d = brief.determination
  const text = [
    brief.lede ?? '',
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
        {/* The lede first: the report's own one-sentence answer, before the
            cards it rests on. */}
        {brief.lede && (
          <Para inline className="text-sm leading-5 text-foreground" results={results} record={record}>
            {brief.lede}
          </Para>
        )}
        {brief.cards.map((c) => {
          const focused = focus?.id === c.id
          // Narrow the report to this assessment; a title with nothing to
          // narrow to scrolls to its card instead.
          const select = () => (onFocusAssessment ? onFocusAssessment(c) : onJumpToCard?.(c.anchor))
          return (
            <div
              key={c.id}
              aria-current={focused || undefined}
              className="flex flex-col gap-1"
            >
              {onFocusAssessment || onJumpToCard ? (
                <button
                  type="button"
                  onClick={select}
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
              {/* The cards it rests on, as one citation: clicking it shows them. */}
              {onFocusAssessment && c.cards.length > 0 && (
                <span className="flex pt-0.5">
                  <RollupCitation
                    cites={c.cites}
                    results={results}
                    groupFor={groupFor}
                    shown={focused}
                    onSelect={() => onFocusAssessment(c)}
                  />
                </span>
              )}
            </div>
          )
        })}
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
