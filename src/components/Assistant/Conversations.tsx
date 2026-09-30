import { MessageSquare } from 'lucide-react'

import { FloatingPanelRow, MutedText } from '@/core'

import { formatTime } from '../../lib/reportLabels'
import type { Thread } from '../../lib/useAnalysis'
import { CURRENT_USER } from '../../lib/user'

/**
 * The conversations on this report.
 *
 * Kha's history view: one row per conversation, named by its first question,
 * with who asked and how many turns, and when. Only conversations with
 * something in them are listed — a conversation just started has nothing to
 * name it by, and it is on screen already.
 */
export const Conversations = ({
  threads,
  activeId,
  onOpen
}: {
  threads: Thread[]
  activeId: string
  onOpen: (id: string) => void
}) => (
  <div className="flex flex-col gap-3 px-2 py-3">
    <MutedText className="px-2 text-caption">On this report</MutedText>

    {threads.length === 0 ? (
      <MutedText className="px-2 text-sm">Nothing has been asked yet.</MutedText>
    ) : (
      <div className="flex flex-col">
        {[...threads].reverse().map((t) => {
          const first = t.questions[0]
          // A user turn and an answer per question.
          const messages = t.questions.length * 2
          return (
            <FloatingPanelRow
              key={t.id}
              icon={<MessageSquare aria-hidden="true" size={16} strokeWidth={1.5} />}
              title={first?.typed || first?.skills?.[0] || 'Conversation'}
              gist={`${CURRENT_USER} · ${messages} message${messages === 1 ? '' : 's'}`}
              meta={first ? formatTime(first.at) : undefined}
              selected={t.id === activeId}
              onClick={() => onOpen(t.id)}
            />
          )
        })}
      </div>
    )}

    <MutedText className="px-2 text-caption">
      Conversations stay with the report. This prototype keeps them in the report’s file.
    </MutedText>
  </div>
)
