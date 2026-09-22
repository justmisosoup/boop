import type { ReactNode } from 'react'

import { ChatLog, ChatMarker, ChatMessage, Text } from '@/core'

import type { BusinessRecord, Derived } from '../lib/deriveResults'
import type { AnalysisVersion } from '../lib/useAnalysis'
import { cn } from '../utils/twUtils'
import { AnalysisSources } from './AnalysisSources'
import { AnswerBody } from './ReportBody'

/**
 * What was asked, and what came back.
 *
 * The conversation used to be stacked inside the report — a typed question's
 * answer appended to the same column as the assessment, so the standing
 * artefact and the ad-hoc question were one object. They are two: the report is
 * what the business was assessed as, the questions are what a reviewer wanted
 * to know about it. Here they have their own column, and the report keeps its.
 *
 * The answers render through the report's own `ReportBody` (as `AnswerBody`),
 * so a question is argued in exactly the grammar the report is — same prose,
 * same citations, same evidence rows — and the two cannot drift.
 */
export const AnalysisChat = ({
  turns,
  marker,
  waiting,
  waitingTyped,
  waitingSkills,
  error,
  results,
  record,
  categories,
  negatives,
  onJumpToGroup,
  onJumpToSource,
  scroll = true,
  className
}: {
  /** The questions asked of the selected report, oldest first. */
  turns: AnalysisVersion[]
  /** Which report these belong to, at the head of the thread. */
  marker?: ReactNode
  /** A question is in flight, so its turn is on screen before the answer is. */
  waiting: boolean
  waitingTyped: string
  waitingSkills: string[]
  error: string | null
  results: Derived[]
  record?: BusinessRecord
  categories: Map<string, string>
  negatives?: ReadonlySet<string>
  onJumpToGroup: (groupId: string, insightIds: string[]) => void
  onJumpToSource?: (cardId: string) => void
  /**
   * The log brings its own scroller.
   *
   * Off below `wide`, where there is no column: the turns render flat, inside
   * the report's scroller, which is where the conversation has always been at
   * that width.
   */
  scroll?: boolean
  className?: string
}) => {
  /**
   * What the reader typed, and what they sent it with.
   *
   * Never `version.prompt` — that is the COMPOSED instruction, the workflow
   * brief and every assessment's text, and printing it would put three thousand
   * words in a bubble. A turn with neither typed text nor a workflow shows no
   * user message at all rather than an empty one.
   */
  const asked = (typed: string, skills: string[], key: string) =>
    typed || skills.length > 0 ? (
      <ChatMessage
        key={key}
        role="user"
        chips={skills.map((name) => ({ id: `${key}-${name}`, label: name }))}
      >
        {typed || undefined}
      </ChatMessage>
    ) : null

  const body = (
    <>
      {marker && <ChatMarker>{marker}</ChatMarker>}

      {turns.map((v) => (
        <div key={v.id} className="space-y-3">
          {asked(v.typed ?? '', v.skills ?? [], v.id)}
          <AnswerBody
            result={v.result}
            results={results}
            record={record}
            negatives={negatives}
            onJumpToSource={onJumpToSource}
          />
          <AnalysisSources
            used={v.result.used}
            results={results}
            categories={categories}
            onSelect={onJumpToGroup}
          />
        </div>
      ))}

      {waiting && (
        <div className="space-y-3">
          {asked(waitingTyped, waitingSkills, 'pending')}
          {/* `pending` shimmers, `busy` keeps the live region from announcing
              every word as it lands. */}
          <ChatMessage role="assistant" pending busy>
            Working…
          </ChatMessage>
        </div>
      )}

      {/* At the foot, above the composer: the message says to send it again,
          and sending it again happens twelve pixels below. */}
      {error && <Text tone="danger">{error}</Text>}
    </>
  )

  if (!scroll)
    return <div className={cn('space-y-6', className)}>{body}</div>

  return (
    <ChatLog
      label="Analysis conversation"
      className={className}
      viewportClassName="panel-scroll space-y-6 px-5 pb-4 pt-6"
    >
      {body}
    </ChatLog>
  )
}
