import { useCallback, useEffect, useRef, useState } from 'react'

import { cn } from '../utils/twUtils'

/** The floor. Narrower and the composer's token row, the workflow picker and a
 *  line of an answer stop sharing a column comfortably. */
export const CHAT_MIN = 400

/** Half the window. Past that the chat is no longer beside the report, it is
 *  the page — and the report is the thing being read. */
export const chatMax = () => Math.round(window.innerWidth / 2)

/**
 * The seam between the report and the chat, as a handle.
 *
 * `@/core` has a resize engine (`internal/useEdgeResize`, behind `Drawer` and
 * `FloatingPanel`), but it is not exported from the barrel and core is a
 * read-only clone — reaching into an unexported internal would be a file that
 * breaks silently on the next re-clone. This is the small version of the same
 * thing: the pointer for dragging, arrow keys for the reader who cannot, and a
 * double-click to put it back.
 *
 * The width it reports is the column's, measured from the RIGHT edge of the
 * window, because that is the edge the column is docked to.
 */
export const ColumnResizer = ({
  width,
  onResize,
  onReset,
  className
}: {
  /** The column's current width, for the keyboard step and the ARIA value. */
  width: number
  onResize: (width: number) => void
  /** Double-click, or Home: back to whatever the breakpoint says. */
  onReset: () => void
  className?: string
}) => {
  const [dragging, setDragging] = useState(false)
  const frame = useRef(0)

  const clamp = useCallback((n: number) => Math.max(CHAT_MIN, Math.min(chatMax(), n)), [])

  useEffect(() => {
    if (!dragging) return

    const move = (e: PointerEvent) => {
      // One write per frame: a pointermove fires far faster than the layout it
      // is driving, and the column is three fixed regions wide.
      cancelAnimationFrame(frame.current)
      frame.current = requestAnimationFrame(() => onResize(clamp(window.innerWidth - e.clientX)))
    }
    const up = () => setDragging(false)

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    // While dragging, the cursor belongs to the seam wherever it goes, and a
    // drag across prose must not select it.
    const previous = document.body.style.cursor
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    return () => {
      cancelAnimationFrame(frame.current)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      document.body.style.cursor = previous
      document.body.style.userSelect = ''
    }
  }, [dragging, clamp, onResize])

  return (
    <div
      role="separator"
      aria-label="Resize the conversation"
      aria-orientation="vertical"
      aria-valuenow={width}
      aria-valuemin={CHAT_MIN}
      tabIndex={0}
      onPointerDown={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDoubleClick={onReset}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 64 : 16
        if (e.key === 'ArrowLeft') onResize(clamp(width + step))
        else if (e.key === 'ArrowRight') onResize(clamp(width - step))
        else if (e.key === 'Home') onReset()
        else return
        e.preventDefault()
      }}
      className={cn(
        // A 8px target over a 1px seam: the hairline is the card's border, and
        // the handle is the room around it a pointer can actually find.
        'absolute inset-y-0 -left-1 z-10 w-2 cursor-col-resize touch-none',
        'transition-colors duration-fast motion-reduce:transition-none',
        'hover:bg-[var(--core-color-border-strong)]',
        'focus-visible:outline-none focus-visible:bg-[var(--core-color-focus-ring)]',
        dragging && 'bg-[var(--core-color-border-strong)]',
        className
      )}
    />
  )
}
