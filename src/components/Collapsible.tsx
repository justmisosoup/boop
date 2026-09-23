import type { ReactNode } from 'react'

import { cn } from '../utils/twUtils'

/**
 * The house disclosure: a region that opens and closes by height.
 *
 * The mechanism is `AppShellNavCollapsible`'s (`app/src/core/AppShell.tsx`),
 * copied rather than imported because the nav version is exported for the nav
 * and `src/core` is read-only here: a grid whose one row goes 0fr ↔ 1fr, so the
 * reveal animates without measuring anything, with a small lift on the content
 * so it settles rather than pops. Children stay mounted; closed is height 0,
 * clipped, and out of the accessibility tree and tab order (`aria-hidden` +
 * `inert`), so reopening is cheap and a closed region cannot be tabbed into.
 *
 * `ChatThinking` in core says it keeps its own copy of this "until a second
 * generic consumer exists". This is that consumer, twice over — an insight's
 * evidence and a source's payload — which makes it a candidate to go upstream
 * as a public `Collapsible`. Until it does, it lives here.
 */
export const Collapsible = ({
  open,
  id,
  className,
  children
}: {
  open: boolean
  /** Named by the trigger's `aria-controls`. */
  id?: string
  className?: string
  children: ReactNode
}) => (
  <div
    id={id}
    role="region"
    aria-hidden={!open || undefined}
    // React 19 knows `inert` as a boolean attribute.
    inert={!open}
    data-state={open ? 'open' : 'closed'}
    className={cn(
      'grid overflow-hidden transition-[grid-template-rows,opacity] duration-standard ease-emphasized motion-reduce:transition-none',
      open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
      className
    )}
  >
    <div
      className={cn(
        'min-h-0 transition-transform duration-standard ease-emphasized motion-reduce:transition-none',
        open ? 'translate-y-0' : '-translate-y-2'
      )}
    >
      {children}
    </div>
  </div>
)
