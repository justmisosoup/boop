/**
 * THE PANEL LIST-ROW ANATOMY — glyph · title · gist · trailing meta.
 *
 * One grammar, two semantics. A row in a panel BODY is a `<button>`
 * (`FloatingPanelRow`); the same row inside a picker's popover is a
 * `role='option'` (`ListPicker`). They must look identical and they must not
 * be drawn twice, so the visual content lives here and each surface supplies
 * its own interactive shell.
 *
 * `FloatingPanelRowsSkeleton` mirrors these exact boxes — it is the loading
 * state for this row, and the two are only honest together.
 *
 * Internal: product code composes `FloatingPanelRow` or `ListPicker`, never
 * this.
 */
import type React from 'react'

import { cn } from '@/utils/twUtils'

import type { Density } from './density'

/** What the leading column holds, which sets its width and alignment. */
export type PanelRowLeading = 'glyph' | 'identity'

export type PanelRowContentProps = {
  /** Density is vertical-only here: `compact` tightens `py` and drops the
   *  title to 13px, but the horizontal anatomy (px, gap, icon box) is
   *  density-invariant — the header's 28/48px column grid and the picker's
   *  depth-indent math are derived from it. */
  density?: Density
  /** Sizing for the leading column. See `panelRowLeading`. */
  leading?: PanelRowLeading
  /** Leading glyph — an icon, a status dot, an avatar. Decorative: it sits in
   *  an `aria-hidden` box, so it must never carry the row's only meaning. */
  icon?: React.ReactNode
  /** First line. Truncates. */
  title: React.ReactNode
  /** Second line. Truncates. Its absence switches the row to single-line
   *  alignment rather than leaving a hanging gap. */
  gist?: React.ReactNode
  /** Trailing metadata — a relative time, a count, a check. Never truncates;
   *  the text column shrinks around it. */
  meta?: React.ReactNode
}

/**
 * The fixed leading column. Every row reserves it whether or not it has a
 * glyph, so titles down the list share one left edge.
 *
 * `glyph` (the default) is the 20px box a 14–16px icon or status dot sits in.
 * `identity` widens it to 24px and centres it on the row, for an `Avatar`:
 *
 *   - 24px is the size `Avatar size='sm'` renders, and the size every other
 *     person row in the app uses. Squeezing one into the 20px glyph box reads
 *     as a dot beside a 37px two-line block rather than as the person.
 *   - centred, because the shell top-aligns a two-line row so the title and a
 *     relative-time `meta` line up. An avatar isn't metadata about the first
 *     line — it labels the whole person — so hanging it off the title leaves it
 *     ~9px above the block's optical centre.
 *
 * Don't mix the two modes within one list: the titles would sit 4px apart.
 * Exported so a surface rendering its own leading box (the picker's footer
 * commands) stays in step with the rows above it.
 */
export const panelRowLeading = (leading: PanelRowLeading = 'glyph') =>
  cn(
    'flex shrink-0 items-center justify-center',
    leading === 'identity' ? 'h-6 w-6 self-center' : 'h-5 w-5'
  )

/** 13px, not 12 — row titles are the hierarchy anchor over a 12px body. */
const TITLE_TYPE: Record<Density, string> = {
  standard: 'text-sm',
  compact: 'text-dense'
}

export const PanelRowContent = ({
  density = 'standard',
  gist,
  icon,
  leading = 'glyph',
  meta,
  title
}: PanelRowContentProps) => (
  <>
    {icon != null && (
      <span aria-hidden='true' className={panelRowLeading(leading)}>
        {icon}
      </span>
    )}
    <span className='flex min-w-0 flex-1 flex-col'>
      <span
        className={cn(
          'min-w-0 truncate font-medium leading-tight',
          TITLE_TYPE[density]
        )}
      >
        {title}
      </span>
      {gist != null && (
        <span className='mt-0.5 min-w-0 truncate text-caption leading-tight text-[var(--core-color-text-secondary)]'>
          {gist}
        </span>
      )}
    </span>
    {meta != null && (
      <span
        className={cn(
          // tabular figures so a column of relative times never jitters as
          // it re-renders ("2m" → "11m" must not shift the row)
          'shrink-0 text-caption tabular-nums',
          // `text-secondary`, not `text-muted`. Muted on a popover surface
          // measures 4.49:1 in dark — under AA for text this size (it passes
          // at 5.63:1 in light, so it only fails on one side). The meta is
          // information, not decoration: a thread's age is why you pick it.
          // Hierarchy still reads, carried by the title's weight and this
          // column's position rather than by a third grey.
          'text-[var(--core-color-text-secondary)]',
          gist != null && 'self-start pt-px'
        )}
      >
        {meta}
      </span>
    )}
  </>
)

const SHELL_PAD: Record<Density, string> = {
  standard: 'py-2',
  compact: 'py-1.5'
}

/** Layout for the row's own shell — shared so the button and the option can
 *  never drift apart. A two-line row aligns to the top; a one-line row
 *  centres. */
export const panelRowShell = (
  hasGist: boolean,
  density: Density = 'standard'
) =>
  cn(
    'flex w-full gap-2.5 rounded-control px-2.5 text-left',
    SHELL_PAD[density],
    hasGist ? 'items-start' : 'items-center'
  )
