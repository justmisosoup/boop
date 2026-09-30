import { ArrowUpRight, MessageSquare } from 'lucide-react'

import { STARTERS } from './starters'

/**
 * A conversation that has not started.
 *
 * Kha's empty state: the invitation, what the assistant is for, and three
 * questions a reader can send with one click. The rows are the same width as
 * the composer below them, so the first thing to do and the place to do it
 * line up.
 */
export const AssistantEmpty = ({ onAsk }: { onAsk: (prompt: string) => void }) => (
  <div className="flex flex-col gap-6 px-4 pb-4 pt-8">
    <div className="flex flex-col gap-3">
      <span
        aria-hidden="true"
        className="flex size-8 items-center justify-center rounded-control text-[var(--core-color-text-secondary)]"
      >
        <MessageSquare size={24} strokeWidth={1.5} />
      </span>
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-normal leading-8 tracking-[-0.015em] text-foreground">
          Review this business
        </h2>
        <p className="text-sm text-[var(--core-color-text-secondary)]">
          Summary, findings, and supporting evidence.
        </p>
      </div>
    </div>

    <div className="flex flex-col gap-2" role="group" aria-label="Suggested questions">
      {STARTERS.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onAsk(s.label)}
          className={[
            'flex items-center justify-between gap-3 rounded-card border border-border px-3 py-3 text-left text-sm text-foreground',
            'bg-[var(--core-color-surface-raised)] transition-colors duration-fast',
            'hover:border-[var(--core-color-border-strong)] hover:bg-[var(--core-color-state-hover-bg)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          ].join(' ')}
        >
          <span>{s.label}</span>
          <ArrowUpRight
            aria-hidden="true"
            className="shrink-0 text-[var(--core-color-text-muted)]"
            size={14}
            strokeWidth={1.75}
          />
        </button>
      ))}
    </div>
  </div>
)
