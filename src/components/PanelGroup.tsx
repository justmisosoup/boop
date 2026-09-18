import { useEffect, useState, type ReactNode } from 'react'

import { MutedText } from '@/core'

import { cn } from '../utils/twUtils'

/**
 * A named run of rows in the reference panel, which can be put away.
 *
 * The panel holds 155 insights, ~40 attributes and every source behind them,
 * and it holds them in a 392px column beside the report. Fully expanded that is
 * several screens of scroll per tab with no structure to skip by — the reader
 * has to go past "People" to reach "Tax ID" whether or not they care about
 * either. The group headings were already there; they were just labels on an
 * unbroken list rather than something you could act on.
 *
 * Closed, a group is one 32px line that still answers the useful question —
 * what is in here, and how much of it. That is the same trade every reference
 * panel of this kind makes (Intercom's conversation attributes, Mixpanel's
 * event details): the count on the header is what stops a closed group from
 * hiding the fact that it has anything in it.
 *
 * Open/closed is deliberately NOT lifted to a store. It is a reading position,
 * not a preference — restoring yesterday's open groups against a different
 * business would be restoring the wrong thing.
 */
export const PanelGroup = ({
  id,
  label,
  count,
  defaultOpen = false,
  openWhen = false,
  children
}: {
  /** Also the scroll target, so a citation can still jump to a group. */
  id?: string
  label: string
  /** How many rows are inside. Shown whether or not the group is open. */
  count?: number
  defaultOpen?: boolean
  /**
   * Opens the group, and keeps it open until the reader closes it themselves.
   *
   * Something outside needs this group's rows visible — following a citation
   * out of the report is the case that matters. Without it the jump lands on a
   * closed heading and the evidence it was standing for is behind a chevron,
   * which is worse than not offering the jump.
   */
  openWhen?: boolean
  children: ReactNode
}) => {
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    if (openWhen) setOpen(true)
  }, [openWhen])

  return (
    <section id={id} className="scroll-mt-6">
      {/* The heading IS the control — the whole line is the hit target, not just
          a chevron at one end of it. */}
      <h3 className="m-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={cn(
            'flex w-full items-center gap-2 rounded py-1.5 text-left',
            'text-caption font-semibold uppercase tracking-wide text-muted-foreground',
            'transition-colors hover:text-foreground'
          )}
        >
          <svg
            viewBox="0 0 12 12"
            aria-hidden="true"
            className={cn('h-3 w-3 shrink-0 transition-transform', open ? 'rotate-90' : '')}
            fill="none"
          >
            <path
              d="M4.5 3 7.5 6 4.5 9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {count !== undefined && (
            <MutedText className="shrink-0 text-caption tabular-nums">{count}</MutedText>
          )}
        </button>
      </h3>

      {open && <div className="pb-2 pt-1">{children}</div>}
    </section>
  )
}
