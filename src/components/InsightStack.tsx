import { Children, useEffect, useId, useState, type ReactNode } from 'react'

import { ChevronDown } from 'lucide-react'

import { Surface } from '@/core'

import { cn } from '../utils/twUtils'
import { CardHeader } from './CardHeader'
import { Collapsible } from './Collapsible'

/**
 * The hairline between two rows in a card.
 *
 * The dashboard's insights panel (`app/src/containers/BusinessHome/Insights/
 * InsightsPanel.tsx`) does not border its rows. It paints a pseudo-element a
 * pixel tall, inset 16px from either edge, in the divider token — so the line
 * stops where the row's own padding starts, and never meets the card's frame.
 * Written once here and taken verbatim.
 */
export const ROW_HAIRLINE = cn(
  'relative before:pointer-events-none before:absolute before:inset-x-4',
  'before:top-0 before:border-t before:border-[var(--core-color-border-divider)]',
  'before:content-[""]'
)

/**
 * A report card's insight rows, behind "Show insights".
 *
 * The card's finding — its prose, its grid — is the answer; the rows are the
 * working, one click away rather than always open. Closed by default. `open`
 * forces it open when a citation or the attention list leads to one of its
 * rows, so the row it names is there to land on; the reader can close it
 * again after. The Insights tab does not use this: it is the list of every
 * row, and hiding them there hides the tab.
 */
export const InsightsDisclosure = ({ rows, open: forced }: { rows: ReactNode[]; open?: boolean }) => {
  const [open, setOpen] = useState(false)
  const id = useId()
  useEffect(() => {
    if (forced) setOpen(true)
  }, [forced])
  if (rows.length === 0) return null
  // The button stays where it is; the insights open under it.
  return (
    <>
      {/* A dropdown row, as the screening card's names are: the label and
          count, the chevron at the far right. */}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 border-t border-[var(--core-color-border-divider)] px-4 py-3 text-left text-sm text-text-primary hover:bg-[var(--core-color-list-item-hover-bg)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span>
          {/* The chevron says open or closed; the label only names what is behind it. */}
          Insights
          <span className="ml-1.5 tabular-nums text-text-secondary">{rows.length}</span>
        </span>
        <ChevronDown
          aria-hidden="true"
          size={14}
          strokeWidth={2}
          className={cn('shrink-0 text-text-secondary transition-transform', open && 'rotate-180')}
        />
      </button>
      <Collapsible open={open} id={id}>
        <div className="border-t border-[var(--core-color-border-divider)]">
          {rows.map((row, i) => (
            <div key={(row as { key?: string | null }).key ?? i} className={cn(i > 0 && ROW_HAIRLINE)}>
              {row}
            </div>
          ))}
        </div>
      </Collapsible>
    </>
  )
}

/**
 * A stack of insight rows in one card.
 *
 * The shell is the dashboard's: the card surface, the card radius, the default
 * border, and the rows divided by the inset hairline rather than by a rule of
 * their own. It replaces the three copies of one hand-built frame — a square
 * graphite box with each row's bottom border and the last one bled off — that
 * the report sections, the Insights tab and the attribute grid each carried.
 *
 * Named on the card, when it is named: `title` and `trailing` are the card's
 * header row (`CardHeader`), and `intro` is a band of prose under it — the
 * sentences an assessment writes about what it could not find, before the
 * rows of what it did. The intro sits directly under the header, unruled — it
 * is the header's own sentence — and rules itself off from the rows; with no
 * intro the header does. The first row never draws a line of its own; only
 * rows after the first do.
 *
 * Renders nothing when there is nothing under the header: a frame around a
 * name is a frame.
 */
export const InsightStack = ({
  id,
  title,
  trailing,
  intro,
  body,
  children,
  disclose,
  open,
  className
}: {
  /** The rows behind "Show insights" (`InsightsDisclosure`) — the report's cards. */
  disclose?: boolean
  /** With `disclose`: open it, because something led to one of its rows. */
  open?: boolean
  /** An anchor, for a jump from the Needs review card. */
  id?: string
  title?: ReactNode
  trailing?: ReactNode
  intro?: ReactNode
  /** The card's finding, drawn: between its sentence and its insights — the
   *  compliance screens' grid. It rules itself off. */
  body?: ReactNode
  children?: ReactNode
  className?: string
}) => {
  const rows = Children.toArray(children).filter(Boolean)
  if (rows.length === 0 && !intro && !body) return null

  return (
    <Surface id={id} variant="card" padding="none" className={cn('overflow-hidden', id && 'scroll-mt-6', className)}>
      {/* The summary reads as the header's own sentence, so no rule between them. */}
      {title && <CardHeader title={title} trailing={trailing} className={intro ? 'border-b-0 pb-1' : undefined} />}
      {intro && (
        <div
          className={cn(
            'px-4 pb-3',
            title ? 'pt-0' : 'pt-3',
            rows.length > 0 && !disclose && 'border-b border-[var(--core-color-border-divider)]'
          )}
        >
          {intro}
        </div>
      )}
      {body}
      {disclose ? (
        <InsightsDisclosure rows={rows} open={open} />
      ) : (
        rows.map((row, i) => (
          <div key={(row as { key?: string | null }).key ?? i} className={cn(i > 0 && ROW_HAIRLINE)}>
            {row}
          </div>
        ))
      )}
    </Surface>
  )
}
