import { FileText, MessageSquare } from 'lucide-react'

import { FloatingPanelRow, MutedText } from '@/core'

import { formatTime } from '../../lib/reportLabels'
import type { Thread } from '../../lib/useAnalysis'
import { CURRENT_USER } from '../../lib/user'

/** The conversations other than the assessment's, newest first. */
export const pastConversations = (threads: Thread[], assessmentId?: string): Thread[] =>
  [...threads].filter((t) => t.id !== assessmentId).reverse()

/** A conversation's name: its first question, the skill it ran, or "Conversation". */
export const conversationTitle = (t: Thread) => t.questions[0]?.typed || t.questions[0]?.skills?.[0] || 'Conversation'

/** The assessment's conversation, as the history lists it. */
export type AssessmentEntry = { id: string; label: string; date: string; selected: boolean; onOpen: () => void }

/**
 * Every conversation on this report — what History's "Show all" opens.
 *
 * Kha's history view: one row per conversation, named by its first question,
 * with who asked and how many turns, and when. Only conversations with
 * something in them are listed — a conversation just started has nothing to
 * name it by, and it is on screen already.
 *
 * The assessment leads it, always: the conversation the record opened on,
 * with the report summarised and the recommendation — the way back to it from
 * any new conversation. It is not listed again among the rest. The empty
 * state is only for when there is nothing at all: under an assessment that
 * holds questions, "nothing has been asked yet" would be false.
 */
export const Conversations = ({
  threads,
  activeId,
  assessment,
  onOpen
}: {
  threads: Thread[]
  activeId: string
  /** The assessment's conversation: its id, the report's name and date, and
   *  whether it is the one on screen. */
  assessment?: AssessmentEntry
  onOpen: (id: string) => void
}) => {
  const rest = pastConversations(threads, assessment?.id)
  const asked = assessment ? (threads.find((t) => t.id === assessment.id)?.questions.length ?? 0) : 0

  if (!assessment && rest.length === 0)
    return (
      <div className="flex flex-col gap-3 px-2 py-3">
        <MutedText className="px-2 text-caption">On this report</MutedText>
        <MutedText className="px-2 text-sm">Nothing has been asked yet.</MutedText>
        <MutedText className="px-2 text-caption">
          Conversations stay with the report. This prototype keeps them in the report’s file.
        </MutedText>
      </div>
    )

  return (
    <div className="flex flex-col gap-3 px-2 py-3">
      {assessment && (
        <FloatingPanelRow
          icon={<FileText aria-hidden="true" size={16} strokeWidth={1.5} />}
          title="Assessment"
          gist={`${assessment.label}${asked > 0 ? ` · ${asked} question${asked === 1 ? '' : 's'}` : ''}`}
          meta={assessment.date}
          selected={assessment.selected}
          onClick={assessment.onOpen}
        />
      )}

      {rest.length > 0 && (
        <>
          <MutedText className="px-2 text-caption">On this report</MutedText>
          <div className="flex flex-col">
            {rest.map((t) => {
              const first = t.questions[0]
              // A user turn and an answer per question.
              const messages = t.questions.length * 2
              return (
                <FloatingPanelRow
                  key={t.id}
                  icon={<MessageSquare aria-hidden="true" size={16} strokeWidth={1.5} />}
                  title={conversationTitle(t)}
                  gist={`${CURRENT_USER} · ${messages} message${messages === 1 ? '' : 's'}`}
                  meta={first ? formatTime(first.at) : undefined}
                  selected={t.id === activeId}
                  onClick={() => onOpen(t.id)}
                />
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
