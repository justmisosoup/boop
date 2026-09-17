import React from 'react'

// Same feel as FloatingPanel's drag: presses shorter than this are clicks
// (and a double-click reset must not jitter the width first).
const DRAG_THRESHOLD_PX = 4
const RESIZE_STEP = 16
const RESIZE_STEP_LARGE = 64

export type UseEdgeResizeOptions = {
  /**
   * Which edge of the target carries the handle — `'left'` for a
   * right-anchored panel, `'right'` for a left-anchored one. Arrow keys are
   * APG-literal by visual direction: ArrowLeft always moves the separator
   * left (LTR-only, like the rest of the app).
   */
  edge: 'left' | 'right'
  minWidth: number
  maxWidth: number
  /**
   * Controlled restore width. The live width follows this value when external
   * constraints change, so the rendered panel and its owner cannot disagree.
   */
  defaultWidth: number
  /**
   * Double-click reset target (read once on mount, then clamped against the
   * current bounds). Defaults to the initial `defaultWidth`. Pass a canonical value when the restore point
   * (`defaultWidth`, e.g. a persisted width) differs from the reset target.
   */
  resetWidth?: number
  /** Element whose `style.width` is mutated directly during a drag. */
  targetRef: React.RefObject<HTMLElement | null>
  /**
   * Commit callback — once per completed interaction (pointer release, each
   * keyboard step, double-click reset), only when the clamped width actually
   * changed. Never fires per-frame.
   */
  onResizeEnd?: (width: number) => void
}

/**
 * Pointer + keyboard edge-resize for a fixed-width panel (the ARIA
 * window-splitter pattern). During a pointer drag the target's width and the
 * handle's `aria-valuenow` are mutated directly — no setState per move, so a
 * panel beside an expensive sibling (a canvas) never re-renders React at
 * pointer speed; one commit lands on release. `width` is the committed value
 * and the render source of truth.
 *
 * Consumed by `Drawer` (`resizable`); core-internal, not exported from
 * `@/core`.
 */
export const useEdgeResize = ({
  edge,
  minWidth,
  maxWidth,
  defaultWidth,
  resetWidth,
  targetRef,
  onResizeEnd
}: UseEdgeResizeOptions): {
  /** Width to render the target at (committed; tracks the live value mid-drag). */
  width: number
  isResizing: boolean
  handleRef: React.RefObject<HTMLDivElement | null>
  handleProps: React.HTMLAttributes<HTMLDivElement>
} => {
  const clamp = (w: number) =>
    Math.min(maxWidth, Math.max(minWidth, Math.round(w)))

  const [committedWidth, setCommittedWidth] = React.useState(() =>
    clamp(defaultWidth)
  )
  // Capture the semantic reset target once so a consumer feeding the committed
  // width back through `defaultWidth` cannot make reset drift. `commit` clamps
  // it against the current bounds when the user invokes it.
  const [resetTarget] = React.useState(() => resetWidth ?? defaultWidth)
  const [isResizing, setIsResizing] = React.useState(false)
  const handleRef = React.useRef<HTMLDivElement | null>(null)
  // Drag origin measures from the committed width, not getBoundingClientRect —
  // no layout read per gesture, and the math holds in jsdom.
  const originRef = React.useRef<{
    x: number
    startWidth: number
    started: boolean
  } | null>(null)
  const committedRef = React.useRef(committedWidth)
  const liveRef = React.useRef(committedWidth)
  const bodyPrevRef = React.useRef<{
    cursor: string
    userSelect: string
  } | null>(null)

  // Live width lands on the DOM directly; React state only changes on commit.
  const applyLive = (w: number) => {
    liveRef.current = w
    const target = targetRef.current
    if (target) target.style.width = `${w}px`
    handleRef.current?.setAttribute('aria-valuenow', String(w))
  }

  // Bounds can change with the viewport. Follow the consumer's newly clamped
  // restore width without treating that environmental change as a user resize
  // (and therefore without firing onResizeEnd or overwriting persistence).
  React.useEffect(() => {
    const next = Math.min(
      maxWidth,
      Math.max(minWidth, Math.round(defaultWidth))
    )
    committedRef.current = next
    liveRef.current = next
    setCommittedWidth(next)
  }, [defaultWidth, maxWidth, minWidth])

  const commit = (w: number) => {
    const next = clamp(w)
    applyLive(next)
    if (next === committedRef.current) return
    committedRef.current = next
    setCommittedWidth(next)
    onResizeEnd?.(next)
  }

  const restoreBodyStyles = () => {
    const prev = bodyPrevRef.current
    if (!prev) return
    bodyPrevRef.current = null
    document.body.style.cursor = prev.cursor
    document.body.style.userSelect = prev.userSelect
  }

  const endDrag = () => {
    const origin = originRef.current
    originRef.current = null
    if (!origin?.started) return
    setIsResizing(false)
    restoreBodyStyles()
    commit(liveRef.current)
  }

  // A drag interrupted by unmount must not leave the resize cursor /
  // suppressed text selection on <body>.
  React.useEffect(() => {
    return () => {
      const prev = bodyPrevRef.current
      if (!prev) return
      bodyPrevRef.current = null
      document.body.style.cursor = prev.cursor
      document.body.style.userSelect = prev.userSelect
    }
  }, [])

  // A re-render mid-drag (the isResizing flip, or any parent render) must not
  // write the stale committed width back over the live-mutated DOM — while a
  // drag is active, the render value tracks the live one.
  const width = isResizing ? liveRef.current : committedWidth

  const handleProps: React.HTMLAttributes<HTMLDivElement> = {
    role: 'separator',
    tabIndex: 0,
    'aria-orientation': 'vertical',
    'aria-valuemin': minWidth,
    'aria-valuemax': maxWidth,
    'aria-valuenow': width,
    onPointerDown: event => {
      if (event.button !== 0) return
      event.currentTarget.setPointerCapture(event.pointerId)
      originRef.current = {
        x: event.clientX,
        startWidth: committedRef.current,
        started: false
      }
    },
    onPointerMove: event => {
      const origin = originRef.current
      if (!origin) return
      const dx = event.clientX - origin.x
      if (!origin.started) {
        if (Math.abs(dx) < DRAG_THRESHOLD_PX) return
        origin.started = true
        setIsResizing(true)
        bodyPrevRef.current = {
          cursor: document.body.style.cursor,
          userSelect: document.body.style.userSelect
        }
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
      }
      // Handle on the left edge: dragging left (negative dx) widens the panel.
      applyLive(
        clamp(edge === 'left' ? origin.startWidth - dx : origin.startWidth + dx)
      )
    },
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onKeyDown: event => {
      // ArrowLeft moves the separator left (wider for a right-anchored panel).
      const direction = edge === 'left' ? 1 : -1
      const step = event.shiftKey ? RESIZE_STEP_LARGE : RESIZE_STEP
      let next: number | null = null
      if (event.key === 'ArrowLeft')
        next = committedRef.current + direction * step
      else if (event.key === 'ArrowRight')
        next = committedRef.current - direction * step
      else if (event.key === 'Home') next = minWidth
      else if (event.key === 'End') next = maxWidth
      if (next === null) return
      event.preventDefault()
      // Consumed keys must not reach page-level listeners (e.g. the Explorer's
      // window-scoped ←/→ history travel).
      event.stopPropagation()
      commit(next)
    },
    onDoubleClick: () => commit(resetTarget)
  }

  return { width, isResizing, handleRef, handleProps }
}
