import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { ArrowUp, X } from 'lucide-react'

import { ActionButton, IconActionButton, Skeleton } from '@/core'
import { cn } from '@/utils/twUtils'

import { MiddeskMark } from '../MiddeskMark'

/**
 * What the bubble leads with: the Assistant's latest word to the reader. A
 * reply that came in, an answer still being written, or something waiting on
 * them — the assessments to review. Absent, the business summed up.
 */
export type BubbleNotice = {
  kind: 'reply' | 'working' | 'review'
  title: string
  /** Under the title: the reply's opening, or what is waiting and why. */
  text?: string
  /** A line over the text, quieter: the question a reply answers. */
  context?: string
  actionLabel?: string
  onAction?: () => void
}

/**
 * The Assistant's session on this business, opened for the reader: it floats
 * beside the Assistant's bubble at the foot of the rail, as a new chat would.
 * It leads with the latest thing the Assistant has for the reader (`notice`),
 * else the business summed up; the box under it is the Assistant's own, so a
 * question typed here is carried on in the Assistant (`onAsk`), which opens
 * on it. Put away with its ×, until there is something new.
 */
export const SummaryBubble = ({
  summary,
  writing,
  decided,
  notice,
  onAsk,
  onDismiss
}: {
  summary?: string
  /** The summary is being written. */
  writing?: boolean
  /** Who decided and when, once someone has. */
  decided?: string
  notice?: BubbleNotice
  /** The question typed, or empty to open the Assistant as it is. */
  onAsk: (question: string) => void
  onDismiss: () => void
}) => {
  const [question, setQuestion] = useState('')
  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    onAsk(question)
    setQuestion('')
  }
  // Enter sends, as in the Assistant; Shift+Enter breaks the line.
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) submit(e)
  }
  return (
    <section
      aria-label="Middesk Assistant"
      aria-live="polite"
      className="flex flex-col overflow-hidden rounded-card border border-border bg-card shadow-elevation-raised"
    >
      {/* The session's head, as the Assistant's own. */}
      <div className="flex items-center gap-2 border-b border-solid border-[var(--core-color-border-divider)] px-3 py-2">
        <MiddeskMark className="h-[8px] w-[14px]" />
        <span className="min-w-0 flex-1 text-dense font-semibold leading-5 text-text-primary">Middesk Assistant</span>
        <IconActionButton aria-label="Dismiss" onClick={onDismiss} size="compact" variant="quiet">
          <X aria-hidden="true" size={14} strokeWidth={1.75} />
        </IconActionButton>
      </div>
      <div className="flex flex-col gap-3 p-3">
        {notice ? (
          // The latest thing for the reader: a reply, an answer on its way, or
          // what is waiting on them.
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5">
              {/* A dot says it is new or waiting — the one live thing here. */}
              <span
                aria-hidden="true"
                className={cn(
                  'size-2 shrink-0 rounded-full',
                  notice.kind === 'review' ? 'bg-[var(--core-color-status-danger-fg)]' : 'bg-[var(--core-color-action-primary-bg)]',
                  notice.kind === 'working' && 'animate-pulse motion-reduce:animate-none'
                )}
              />
              <span className="font-arizona text-base font-light leading-5 text-text-primary">{notice.title}</span>
            </span>
            {notice.context && <p className="m-0 truncate text-dense leading-5 text-text-secondary">{notice.context}</p>}
            {notice.kind === 'working' ? (
              <div className="flex flex-col gap-2 py-1" role="status" aria-label="Writing an answer">
                <Skeleton className="w-full" />
                <Skeleton className="w-9/12" />
              </div>
            ) : (
              notice.text && <p className="m-0 line-clamp-4 break-words text-dense leading-5 text-text-primary">{notice.text}</p>
            )}
            {notice.actionLabel && notice.onAction && (
              <ActionButton className="mt-1 self-start" onClick={notice.onAction} size="compact" variant="secondary">
                {notice.actionLabel}
              </ActionButton>
            )}
          </div>
        ) : (
          // Nothing new: its first message, the business summed up.
          <div className="flex flex-col gap-1">
            <span className="font-arizona text-base font-light leading-5 text-text-primary">Summary</span>
            {summary ? (
              <p className="m-0 break-words text-dense leading-5 text-text-primary">{summary}</p>
            ) : writing ? (
              <div className="flex flex-col gap-2 py-1" role="status" aria-label="Writing summary">
                <Skeleton className="w-full" />
                <Skeleton className="w-11/12" />
              </div>
            ) : null}
            {decided && <p className="m-0 text-dense leading-5 text-text-secondary">{decided}</p>}
          </div>
        )}
        {/* The Assistant's box: what is typed here carries on in it. */}
        <form
          className={cn(
            'flex items-end gap-2 rounded-control border border-solid border-border bg-card px-3 py-2',
            'focus-within:ring-2 focus-within:ring-ring'
          )}
          onSubmit={submit}
        >
          <textarea
            aria-label="Ask about this business"
            className="max-h-24 min-h-5 flex-1 resize-none border-0 bg-transparent p-0 text-dense leading-5 text-text-primary outline-none placeholder:text-text-secondary"
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={onKey}
            placeholder="Ask about this business…"
            rows={1}
            value={question}
          />
          <button
            aria-label="Send"
            className={cn(
              'flex size-6 shrink-0 items-center justify-center rounded-full transition-colors duration-[var(--core-duration-fast)] motion-reduce:transition-none',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              question.trim()
                ? 'bg-[var(--core-color-action-primary-bg)] text-[var(--core-color-action-primary-fg)]'
                : 'bg-[var(--core-color-surface-subtle)] text-text-secondary'
            )}
            type="submit"
          >
            <ArrowUp aria-hidden="true" size={14} strokeWidth={1.75} />
          </button>
        </form>
      </div>
    </section>
  )
}
