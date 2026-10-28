import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { cn } from '@/utils/twUtils'

/** How far from the pointer the card sits, so the pointer never covers it. */
const OFFSET = 14
/** How close to the window's edge the card may come before it flips. */
const MARGIN = 10

/**
 * A tooltip that follows the pointer: the white popover the report's tiles use
 * (FilingStrip's state tooltip), anchored to the cursor rather than to the
 * element — so it opens where the reader is looking and moves with them. It
 * flips to the pointer's other side near the window's edge, and goes the
 * moment the pointer leaves, so a list stays free to move through. Focused
 * from the keyboard, it opens beside the element instead.
 */
export const PointerTip = ({
  content,
  children,
  className,
  label
}: {
  content: ReactNode
  children: ReactNode
  /** The trigger's own layout. */
  className?: string
  /** What the trigger is, to a screen reader. */
  label?: string
}) => {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null)
  const card = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  // Placed after it renders, once its size is known: right of and below the
  // pointer, flipped where that would leave the window.
  useLayoutEffect(() => {
    if (!at || !card.current) return setPos(null)
    const { width, height } = card.current.getBoundingClientRect()
    const left = at.x + OFFSET + width > window.innerWidth - MARGIN ? at.x - OFFSET - width : at.x + OFFSET
    const top = at.y + OFFSET + height > window.innerHeight - MARGIN ? Math.max(MARGIN, at.y - OFFSET - height) : at.y + OFFSET
    setPos({ left: Math.max(MARGIN, left), top })
  }, [at])

  return (
    <>
      <span
        aria-label={label}
        className={className}
        onBlur={() => setAt(null)}
        onFocus={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          setAt({ x: r.right, y: r.top })
        }}
        onPointerLeave={() => setAt(null)}
        onPointerMove={(e) => setAt({ x: e.clientX, y: e.clientY })}
        role={label ? 'img' : undefined}
        tabIndex={0}
      >
        {children}
      </span>
      {at &&
        createPortal(
          <div
            className={cn(
              'core-theme pointer-events-none fixed z-popover max-w-72 rounded-popover border border-border bg-popover px-3 py-2 text-caption text-popover-foreground shadow-elevation-popover',
              // Measured before it shows: no flash at the corner.
              !pos && 'invisible'
            )}
            ref={card}
            role="tooltip"
            style={pos ?? { left: 0, top: 0 }}
          >
            {content}
          </div>,
          document.body
        )}
    </>
  )
}
