import type React from 'react'
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from 'react'

import { cn } from '@/utils/twUtils'

import { ChevronDown } from 'lucide-react'

import { Skeleton } from './FeedbackState'
import type { Density } from './internal/density'
import { DensityProvider, useDensity } from './internal/density'
import { PanelRowContent, panelRowShell } from './internal/panelRow'
import { useEdgeResize } from './internal/useEdgeResize'
import { useCoreThemeFallback } from './useCoreThemeFallback'

export type FloatingPanelState = 'pill' | 'window' | 'expanded'
export type FloatingPanelCorner = 'bottom-right' | 'bottom-left'
export type FloatingPanelPresentation = 'floating' | 'docked'
/** Which edge a docked rail occupies. Same vocabulary as `DrawerSide`. */
export type FloatingPanelSide = 'left' | 'right'

// Exit transitions run at duration-standard (200ms); keep the element visible
// slightly past that so the fade-out always completes before `invisible`.
const EXIT_MS = 240

// Pointer must travel this far before a header press becomes a drag, so plain
// clicks on the header (title menu, buttons) never accidentally move the panel.
const DRAG_THRESHOLD_PX = 4

// Corner inset — the panel and pill float 24px off the viewport edges.
// Exported so consumers that reserve space around the window (the Explorer
// camera dodge) derive from the primitive instead of hand-syncing.
export const FLOATING_PANEL_INSET_PX = 24
const INSET_PX = FLOATING_PANEL_INSET_PX

/** The corner-anchored window's width per density. The Tailwind scanner needs
 *  static class literals, so `windowSizeClasses` below carries the same
 *  numbers — keep the two in step (pinned by test). */
export const FLOATING_PANEL_WINDOW_WIDTH: Record<Density, number> = {
  standard: 440,
  compact: 336
}

// Docked rail width bounds, used when `resizable` leaves them unset.
const RAIL_MIN_WIDTH = 320
const RAIL_MAX_WIDTH = 560
const RAIL_DEFAULT_WIDTH = 400

type DragHandleProps = Pick<
  React.HTMLAttributes<HTMLElement>,
  'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel'
>

type FloatingPanelContextValue = {
  draggable: boolean
  dragHandleProps: DragHandleProps
  isDragging: boolean
}

const FloatingPanelContext = createContext<FloatingPanelContextValue | null>(
  null
)

const useFloatingPanelContext = (caller: string) => {
  const context = useContext(FloatingPanelContext)

  if (!context) {
    throw new Error(`${caller} must be rendered inside <FloatingPanel>`)
  }

  return context
}

/**
 * Keeps an element visible through its exit transition before hiding it.
 * Presence is synchronous in the opening direction (`open || tail`) — the
 * element must lose `invisible` in the same commit that opens it, or the
 * focus move that follows lands on a still-hidden element and silently fails.
 */
const usePresence = (open: boolean, ms: number) => {
  const [tail, setTail] = useState(open)

  useEffect(() => {
    if (open) {
      setTail(true)
      return undefined
    }

    const timer = setTimeout(() => setTail(false), ms)
    return () => clearTimeout(timer)
  }, [open, ms])

  return open || tail
}

export type FloatingPanelResizeOptions = {
  /** Narrowest the rail can get (default 320). */
  minWidth?: number
  /** Widest the rail can get (default 560). Feed a viewport-derived value to
   * keep the rail from swallowing a small screen. */
  maxWidth?: number
  /** Initial width, read once on mount — restore a persisted width here. */
  defaultWidth?: number
  /** Double-click reset target (defaults to `defaultWidth`). */
  resetWidth?: number
  /** Commit callback — fires once per completed gesture, never per frame. */
  onResizeEnd?: (width: number) => void
  /** Accessible name for the resize separator. */
  label?: string
}

export type FloatingPanelProps = {
  /** Which of the three anchored states the panel is in (controlled). */
  state: FloatingPanelState
  onStateChange: (state: FloatingPanelState) => void
  /** Which bottom corner the panel is anchored to (controlled). */
  corner: FloatingPanelCorner
  /** Optional when `draggable` is off — there is no way to change corners. */
  onCornerChange?: (corner: FloatingPanelCorner) => void
  /** Accessible name for the non-modal dialog. */
  label: string
  /** Content of the minimized launcher pill. */
  launcher: React.ReactNode
  /** Accessible name for the launcher (defaults to `label`). */
  launcherLabel?: string
  /** Focused when the panel opens from the pill; defaults to the panel itself. */
  initialFocusRef?: React.RefObject<HTMLElement | null>
  /**
   * Header drag-to-snap between corners (default true). Consumers that pin
   * the panel to one corner pass `false` — the corner API stays available so
   * other surfaces can offer movement without rebuilding it.
   */
  draggable?: boolean
  /**
   * How the open panel sits on the page (default 'floating').
   * 'floating' — the corner-anchored window that overlays the page.
   * 'docked' — a full-height in-flow rail (see `side`) that the page
   * makes room for, like the nav rail: hairline inner border, no shadow, no
   * corner drag, no Escape-to-minimize, and no focus move on open (page
   * furniture must not steal focus). The `pill` state still renders the
   * floating launcher — the rail collapses its width and releases the space,
   * so minimize behaves the same in both presentations and the panel's
   * children stay mounted throughout.
   *
   * The primitive does not decide *when* to dock: a consumer that offers this
   * on small screens should fall back to 'floating' itself (below `md` the
   * floating panel is already a bottom sheet).
   */
  presentation?: FloatingPanelPresentation
  /**
   * Which edge a docked rail occupies (default 'right'). Mirrors the border,
   * the resize handle, and the collapse direction. Same vocabulary as
   * `Drawer`'s `side`. Ignored while `presentation` is 'floating' — a
   * corner-anchored window uses `corner` instead.
   *
   * The rail's position in the page comes from where the consumer renders it
   * in its flex row; this prop only makes the panel's own chrome agree with
   * that placement.
   */
  side?: FloatingPanelSide
  /**
   * Makes the docked rail user-resizable from its inner edge (pointer drag,
   * Left/Right arrows ±16px, Shift ±64px, Home/End to min/max, double-click to
   * reset). Ignored while `presentation` is 'floating' — a corner-anchored
   * window is sized by its state, not by the user.
   */
  resizable?: FloatingPanelResizeOptions
  /**
   * Visual density (default 'standard' — byte-identical to the pre-density
   * panel). 'compact' narrows the window (336px, shorter clamp) and tightens
   * the chrome, and is INHERITED: every density-aware part inside — header
   * parts, chat primitives, portaled pickers — follows without its own prop.
   * The pill, the expanded bounds, and the corner insets are density-invariant.
   */
  density?: Density
  children: React.ReactNode
  className?: string
}

const cornerClasses: Record<FloatingPanelCorner, string> = {
  'bottom-right': 'right-6',
  'bottom-left': 'left-6'
}

// Keep in step with FLOATING_PANEL_WINDOW_WIDTH — static literals only.
const windowSizeClasses: Record<Density, string> = {
  standard: 'w-[440px] h-[clamp(520px,72dvh,720px)]',
  compact: 'w-[336px] h-[clamp(480px,64dvh,640px)]'
}

const panelSizeClasses = (state: FloatingPanelState, density: Density) =>
  state === 'expanded'
    ? // % (not vw/dvh) for the expanded bounds: the host is `fixed`, so its
      // containing block is the viewport — UNLESS a consumer anchors the
      // panel to a region with a transformed wrapper (the Explorer canvas
      // does exactly that). Percentages honor whichever containing block is
      // in play; viewport units would size past a smaller region.
      'w-[min(880px,calc(100%-48px))] h-[calc(100%-48px)]'
    : windowSizeClasses[density]

/**
 * Corner-anchored, non-modal floating window — the surface for persistent
 * companion UI (the agent dock) that must never fight the page for space.
 *
 * One anchored object with three states: a launcher `pill`, a fixed-size
 * `window`, and a corner-anchored `expanded` overlay. Non-modal by contract:
 * no backdrop, no scroll lock, no focus trap — Tab walks out into the page
 * (WAI-ARIA non-modal dialog semantics, `aria-modal="false"`). Escape
 * minimizes to the pill only while focus is inside the panel; minimizing
 * returns focus to the pill. The window keeps its children mounted across
 * pill/window transitions so panel content (scroll position, in-flight
 * streams) survives minimize.
 *
 * The header (`FloatingPanelHeader`) is a drag handle: drag past the viewport
 * midline to snap the panel to the other bottom corner, with a ghost slot
 * previewing the target while dragging. Corners are slots, not free positions
 * — the panel can never be dropped somewhere it could be lost off-screen.
 * Below the `md` breakpoint the window becomes a full-width bottom sheet and
 * dragging is disabled.
 *
 * `presentation='docked'` swaps the overlay for an in-flow rail that the page
 * makes room for — same children, same states, no overlap. The panel element
 * holds the same position in the tree in both presentations, so switching
 * between them never remounts the content.
 */
export const FloatingPanel = ({
  children,
  className,
  corner,
  density = 'standard',
  draggable = true,
  initialFocusRef,
  label,
  launcher,
  launcherLabel,
  onCornerChange,
  onStateChange,
  presentation = 'floating',
  resizable,
  side = 'right',
  state
}: FloatingPanelProps) => {
  const open = state !== 'pill'
  const docked = presentation === 'docked'
  const [hostRef, applyFallback] = useCoreThemeFallback<HTMLDivElement>()
  const panelRef = useRef<HTMLElement>(null)
  const resizeTargetRef = useRef<HTMLElement | null>(null)
  const pillRef = useRef<HTMLButtonElement>(null)
  const panelPresent = usePresence(open, EXIT_MS)
  const pillPresent = usePresence(!open, EXIT_MS)

  const resize = useEdgeResize({
    // The handle rides the rail's INNER edge — the one facing the page. A
    // right-anchored rail resizes from its left, and vice versa.
    edge: side === 'right' ? 'left' : 'right',
    minWidth: resizable?.minWidth ?? RAIL_MIN_WIDTH,
    maxWidth: resizable?.maxWidth ?? RAIL_MAX_WIDTH,
    defaultWidth: resizable?.defaultWidth ?? RAIL_DEFAULT_WIDTH,
    resetWidth: resizable?.resetWidth,
    targetRef: resizeTargetRef,
    onResizeEnd: resizable?.onResizeEnd
  })

  // One stable merged ref — an inline `ref={node => …}` re-attaches (null then
  // node) every render, which would re-run the theme-fallback ancestor check on
  // each resize commit.
  const setPanelRef = useCallback((node: HTMLElement | null) => {
    panelRef.current = node
    resizeTargetRef.current = node
  }, [])

  // The rail animates open/closed by collapsing its width; clip the content
  // only while that runs, so the resize handle's outer hit area stays live at
  // rest and the content doesn't reflow through the collapse.
  const [railMoving, setRailMoving] = useState(false)
  const prevOpenRef = useRef(open)
  useEffect(() => {
    if (prevOpenRef.current === open) return
    prevOpenRef.current = open

    setRailMoving(true)
    const timer = setTimeout(() => setRailMoving(false), EXIT_MS)

    return () => clearTimeout(timer)
  }, [open])

  // Move focus on state *transitions* only — never on mount, so restoring a
  // persisted open panel on page load doesn't steal focus from the page. A
  // docked rail is ambient page furniture: it never pulls focus on open,
  // though minimizing still hands focus to the launcher that replaces it.
  const prevStateRef = useRef(state)
  useEffect(() => {
    const prev = prevStateRef.current
    prevStateRef.current = state

    if (prev === state) return

    if (state === 'pill') {
      pillRef.current?.focus()
    } else if (prev === 'pill' && !docked) {
      const target = initialFocusRef?.current ?? panelRef.current
      target?.focus()
    }
  }, [state, initialFocusRef, docked])

  // Escape minimizes — attached to the panel, so it only fires while focus is
  // inside (non-modal dialogs get no Escape for free, and a global listener
  // would steal Escape from the rest of the page). Poppers layered inside
  // consume Escape first (same guard as Dialog/Drawer). A docked rail never
  // listens: Escape belongs to the page around page furniture.
  const handlePanelKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (docked || event.key !== 'Escape') return

    const target = event.target

    if (
      target instanceof Element &&
      target.closest('[data-radix-popper-content-wrapper]')
    ) {
      return
    }

    event.stopPropagation()
    onStateChange('pill')
  }

  // Header drag → snap to the nearest bottom corner on release.
  const [drag, setDrag] = useState<{
    dx: number
    dy: number
    prospective: FloatingPanelCorner
  } | null>(null)
  const dragOriginRef = useRef<{
    x: number
    y: number
    rect: DOMRect
    started: boolean
  } | null>(null)

  const endDrag = () => {
    const active = dragOriginRef.current?.started ? drag : null
    dragOriginRef.current = null
    setDrag(null)

    if (active && active.prospective !== corner) {
      onCornerChange?.(active.prospective)
    }
  }

  const dragHandleProps: DragHandleProps = {
    onPointerDown: event => {
      // A docked rail has no corners to snap to — it's part of the layout.
      if (!draggable || docked || event.button !== 0 || state === 'expanded') {
        return
      }
      // The bottom sheet (below md) is not draggable.
      if (
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(max-width: 767px)').matches
      ) {
        return
      }
      // Presses on interactive children are clicks, not drags.
      if (
        event.target instanceof Element &&
        event.target.closest('button, a, input, select, [role="menuitem"]')
      ) {
        return
      }

      const rect = panelRef.current?.getBoundingClientRect()
      if (!rect) return

      event.currentTarget.setPointerCapture(event.pointerId)
      dragOriginRef.current = {
        x: event.clientX,
        y: event.clientY,
        rect,
        started: false
      }
    },
    onPointerMove: event => {
      const origin = dragOriginRef.current
      if (!origin) return

      const dx = event.clientX - origin.x
      const dy = event.clientY - origin.y

      if (!origin.started && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) {
        return
      }
      origin.started = true

      // Clamp so the panel always stays fully inside the viewport insets.
      const clampedDx = Math.min(
        Math.max(dx, INSET_PX - origin.rect.left),
        window.innerWidth - INSET_PX - origin.rect.right
      )
      const clampedDy = Math.min(
        Math.max(dy, INSET_PX - origin.rect.top),
        window.innerHeight - INSET_PX - origin.rect.bottom
      )

      setDrag({
        dx: clampedDx,
        dy: clampedDy,
        prospective:
          event.clientX < window.innerWidth / 2 ? 'bottom-left' : 'bottom-right'
      })
    },
    onPointerUp: endDrag,
    onPointerCancel: endDrag
  }

  const isDragging = Boolean(drag && dragOriginRef.current?.started)
  const showGhost = isDragging && drag && drag.prospective !== corner
  const railWidth = resizable ? resize.width : RAIL_DEFAULT_WIDTH

  return (
    <FloatingPanelContext.Provider
      value={{ draggable: draggable && !docked, dragHandleProps, isDragging }}
    >
      {/* The panel and the launcher host are siblings, and the panel keeps this
          tree position in both presentations — so pinning swaps its chrome
          without remounting the content (scroll position, in-flight streams).
          Floating, it is viewport-fixed; docked, it is an in-flow flex column
          in whatever row the consumer renders it into. */}
      <aside
        ref={setPanelRef}
        aria-hidden={!open}
        aria-label={label}
        aria-modal={docked ? undefined : false}
        className={cn(
          'flex flex-col',
          'bg-[var(--core-color-surface-raised)] text-foreground outline-none',
          docked
            ? [
                // In-flow rail: `self-start` + a viewport height keep it from
                // stretching to the document's height, and `sticky` is what
                // holds it in place while the page scrolls underneath (the
                // document is the scroller, so a plain in-flow column would
                // scroll away). `z-nav` puts it on the same rung as the nav
                // rail — it is chrome now — so its resize handle stays above
                // the page's own sticky headers.
                'sticky top-0 z-nav h-[100dvh] max-w-full shrink-0 self-start',
                // The hairline goes with the rail: a collapsed one must leave
                // nothing behind, not a 1px line down the edge of the page.
                // It rides the rail's INNER edge, so it swaps with `side`.
                open &&
                  (side === 'right'
                    ? 'border-l border-border'
                    : 'border-r border-border'),
                'transition-[width] duration-standard ease-emphasized motion-reduce:transition-none',
                // Clip while the width animates, and whenever the rail is
                // collapsed — a zero-width box with visible overflow would
                // spill its content across the page. At rest and open, overflow
                // stays visible so the resize handle's outer hit area is live.
                (railMoving || !open) && 'overflow-hidden',
                resize.isResizing && 'transition-none'
              ]
            : [
                'fixed bottom-6 z-floating isolate overflow-hidden',
                'rounded-modal border border-border shadow-elevation-raised',
                'transition-[opacity,transform,width,height] duration-standard ease-emphasized motion-reduce:transition-none',
                'max-md:inset-x-0 max-md:bottom-0 max-md:h-[85dvh] max-md:w-full max-md:max-w-full max-md:rounded-b-none',
                panelSizeClasses(state, density),
                cornerClasses[corner],
                'max-h-[calc(100dvh-48px)] max-w-[calc(100vw-48px)] max-md:max-h-[100dvh]',
                open
                  ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
                  : 'pointer-events-none translate-y-2 scale-95 opacity-0',
                !panelPresent && 'invisible',
                isDragging && 'transition-none'
              ],
          applyFallback && 'core-theme',
          className
        )}
        data-corner={docked ? undefined : corner}
        data-density={density}
        data-presentation={presentation}
        data-resizing={resize.isResizing ? '' : undefined}
        data-state={state}
        inert={!open}
        role={docked ? 'complementary' : 'dialog'}
        style={
          docked
            ? { width: open ? railWidth : 0 }
            : {
                transform: drag
                  ? `translate(${drag.dx}px, ${drag.dy}px)`
                  : undefined,
                transformOrigin:
                  corner === 'bottom-right' ? 'bottom right' : 'bottom left'
              }
        }
        tabIndex={docked ? undefined : -1}
        onKeyDown={handlePanelKeyDown}
      >
        {/* Width-locked while the rail collapses, so the content rides the
            slide instead of reflowing through it; fluid at rest so it follows
            a resize drag. */}
        <div
          className={cn(
            'flex h-full min-h-0 flex-col',
            // A left rail collapses toward its RIGHT edge, so its width-locked
            // content must hang off that edge or it slides the wrong way.
            //
            // ONLY while it is width-locked. An auto cross-axis margin
            // suppresses `align-items: stretch`, so leaving this on at rest
            // made the column shrink-wrap its content and sit off the rail's
            // right edge — the panel's own padding measured from the wrong
            // place and the content stopped filling the width it was given.
            docked && side === 'left' && railMoving && 'ml-auto'
          )}
          style={docked && railMoving ? { width: railWidth } : undefined}
        >
          <DensityProvider value={density}>{children}</DensityProvider>
        </div>
        {docked && resizable && (
          // The window-splitter handle: an 8px hit area straddling the inner
          // hairline, with a 2px center line that surfaces on hover and holds
          // while dragging.
          <div
            ref={resize.handleRef}
            aria-label={resizable.label ?? 'Resize panel'}
            className={cn(
              'absolute inset-y-0 z-10 w-2 cursor-col-resize touch-none select-none outline-none',
              // the handle straddles the rail's INNER hairline, whichever side
              // that is
              side === 'right' ? '-left-1' : '-right-1',
              'before:absolute before:inset-y-0 before:left-1/2 before:w-0.5 before:-translate-x-1/2',
              'before:transition-colors before:duration-fast before:ease-standard motion-reduce:before:transition-none',
              'hover:before:bg-[var(--core-color-border-strong)]',
              'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
              resize.isResizing && 'before:bg-[var(--core-color-focus-ring)]'
            )}
            {...resize.handleProps}
          />
        )}
      </aside>

      {/* Viewport-fixed launcher host; pointer-events-none so the page behind
          stays fully interactive — the pill re-enables its own events.
          `isolate` makes it a self-contained stacking context: the subtree
          collapses to this one `z-floating` rung against the app, so nothing
          inside ever competes on the global z-scale. Portaled poppers
          (menus/tooltips) mount on document.body, outside this context, so they
          still stack above via the token ladder (z-popover > z-floating). */}
      <div
        ref={hostRef}
        className={cn(
          'pointer-events-none fixed inset-0 z-floating isolate',
          applyFallback && 'core-theme'
        )}
      >
        {showGhost && drag && (
          <div
            aria-hidden='true'
            className={cn(
              'absolute bottom-6 rounded-modal',
              'border-2 border-dashed border-[var(--core-color-border-strong)]',
              'bg-[var(--core-color-surface-subtle)] opacity-60',
              panelSizeClasses(state, density),
              cornerClasses[drag.prospective]
            )}
          />
        )}

        <button
          ref={pillRef}
          aria-expanded={open}
          aria-haspopup='dialog'
          aria-label={launcherLabel ?? label}
          className={cn(
            'absolute bottom-6 inline-flex h-10 items-center gap-2 px-4',
            'rounded-pill border border-border bg-[var(--core-color-surface-raised)] text-foreground',
            'cursor-pointer shadow-elevation-raised',
            'transition-[opacity,transform,background-color] duration-standard ease-emphasized motion-reduce:transition-none',
            'hover:bg-[var(--core-color-state-hover-bg)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            cornerClasses[corner],
            open
              ? 'pointer-events-none translate-y-2 scale-95 opacity-0'
              : 'pointer-events-auto translate-y-0 scale-100 opacity-100',
            !pillPresent && 'invisible'
          )}
          data-corner={corner}
          type='button'
          onClick={() => onStateChange('window')}
        >
          {launcher}
        </button>
      </div>
    </FloatingPanelContext.Provider>
  )
}

FloatingPanel.displayName = 'FloatingPanel'

export type FloatingPanelHeaderProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Density override; inherits from the surrounding `FloatingPanel`. */
  density?: Density
}

// Compact `pl-3 gap-1` is derived, not arbitrary: the panel list's row grid
// (8px list padding + density-invariant row anatomy) puts glyph centres at
// x=28 and titles at x=48; a 32px leading icon button centred on 28 needs
// pl-3, and the title lands on 48 with a 4px gap after it.
const HEADER_CHROME: Record<Density, string> = {
  standard: 'h-12 gap-1.5 pl-4 pr-2',
  compact: 'h-10 gap-1 pl-3 pr-1.5'
}

/**
 * Panel header row — fixed height (48px, compact 40px), hairline divider, and
 * the drag handle for corner snapping. Interactive children (buttons, menus)
 * stay clickable; only dragging the header background moves the panel.
 */
export const FloatingPanelHeader = ({
  children,
  className,
  density: densityProp,
  ...props
}: FloatingPanelHeaderProps) => {
  const { draggable, dragHandleProps, isDragging } = useFloatingPanelContext(
    'FloatingPanelHeader'
  )
  const density = useDensity(densityProp)

  return (
    <div
      className={cn(
        'flex shrink-0 items-center border-b border-border',
        HEADER_CHROME[density],
        'touch-none select-none',
        draggable && (isDragging ? 'cursor-grabbing' : 'cursor-grab'),
        className
      )}
      {...props}
      {...dragHandleProps}
    >
      {children}
    </div>
  )
}

FloatingPanelHeader.displayName = 'FloatingPanelHeader'

export type FloatingPanelTitleProps = {
  /** The caption line under the title. */
  caption?: React.ReactNode
  /**
   * Announce caption changes. Use it when the caption tracks live state (a
   * selection count, a streaming scope) rather than a static subtitle.
   *
   * The caption is a SIBLING of the title, never inside it — so a title that
   * is also a menu trigger keeps a stable accessible name, and a live region
   * never ends up nested in a button.
   */
  captionLive?: boolean
  className?: string
  /** The title line. Pass a `FloatingPanelTitleSwitcher` to make it a menu. */
  children: React.ReactNode
}

/**
 * Panel header title block — one or two lines, truncating, in the header's
 * leading slot. Replaces the hand-rolled `flex min-w-0 flex-col` stack every
 * dock grew independently.
 */
export const FloatingPanelTitle = ({
  caption,
  captionLive,
  children,
  className
}: FloatingPanelTitleProps) => (
  <span className={cn('flex min-w-0 flex-col', className)}>
    {/* The title LINE is its own row, not a bare column child. A column flex
        stretches its children to the column's width — which is set by
        whichever line is longer — so a title that is also a button took its
        width from the caption below and drew a hover background running well
        past its own text. Inside a row the button sizes to its content, and
        `min-w-0` still lets it shrink and truncate when the header is tight. */}
    <span className='flex min-w-0 items-center'>{children}</span>
    {caption != null && (
      <span
        aria-live={captionLive ? 'polite' : undefined}
        className='min-w-0 truncate text-caption leading-tight text-[var(--core-color-text-muted)]'
      >
        {caption}
      </span>
    )}
  </span>
)

FloatingPanelTitle.displayName = 'FloatingPanelTitle'

export type FloatingPanelTitleSwitcherProps =
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    /** Leading glyph, rendered `aria-hidden` — decorative only. */
    glyph?: React.ReactNode
    /** Density override; inherits from the surrounding `FloatingPanel`. */
    density?: Density
  }

// 13px, not 12 — the header title anchors the hierarchy over a 12px body.
const SWITCHER_TYPE: Record<Density, string> = {
  standard: 'text-sm',
  compact: 'text-dense'
}

/**
 * A panel title that opens a switcher (thread / run / graph). Renders a quiet
 * button with a trailing chevron; wire it to a `Menu`, `Popover`, or
 * `ListPicker` trigger with `asChild`, or to a plain `onClick`.
 *
 * Same idea as `PageBreadcrumbSwitcher`, at panel scale. Being a real
 * `<button>` matters here beyond semantics: the panel header doubles as the
 * drag handle, and its pointer guard treats `button` targets as clicks rather
 * than drags — a `<div>` trigger would be swallowed by the drag.
 */
export const FloatingPanelTitleSwitcher = forwardRef<
  HTMLButtonElement,
  FloatingPanelTitleSwitcherProps
>(
  (
    {
      children,
      className,
      density: densityProp,
      glyph,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const density = useDensity(densityProp)

    return (
      <button
        ref={ref}
        className={cn(
          '-mx-1.5 flex min-w-0 items-center gap-1.5 rounded-control px-1.5 py-0.5',
          'text-left font-medium leading-tight text-foreground',
          SWITCHER_TYPE[density],
          'hover:bg-[var(--core-color-state-hover-bg)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className
        )}
        type={type}
        {...props}
      >
        {glyph != null && (
          <span
            aria-hidden='true'
            className='flex shrink-0 items-center justify-center'
          >
            {glyph}
          </span>
        )}
        <span className='min-w-0 truncate'>{children}</span>
        <ChevronDown
          aria-hidden='true'
          className='shrink-0 text-[var(--core-color-text-muted)]'
          size={density === 'compact' ? 12 : 14}
          strokeWidth={1.75}
        />
      </button>
    )
  }
)

FloatingPanelTitleSwitcher.displayName = 'FloatingPanelTitleSwitcher'

export type FloatingPanelRowProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'title'
> & {
  /** Leading glyph — icon, status dot, avatar. Decorative. */
  icon?: React.ReactNode
  /** First line. */
  title: React.ReactNode
  /** Second line. Omit for a single-line row. */
  gist?: React.ReactNode
  /** Trailing metadata — a relative time, a count. */
  meta?: React.ReactNode
  /** The committed row: paints as current and sets `aria-current`. */
  selected?: boolean
  /** Density override; inherits from the surrounding `FloatingPanel`. */
  density?: Density
}

/**
 * A row in a panel's list — the shape `FloatingPanelRowsSkeleton` has always
 * drawn a placeholder for. Glyph, title, gist, trailing meta.
 *
 * `selected` is `aria-current`, not `aria-selected`: these rows are
 * navigation within a list, not options in a listbox. A row inside a picker's
 * popover is `ListPicker`'s job — same anatomy, different semantics.
 */
export const FloatingPanelRow = forwardRef<
  HTMLButtonElement,
  FloatingPanelRowProps
>(
  (
    {
      className,
      density: densityProp,
      gist,
      icon,
      meta,
      selected,
      title,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const density = useDensity(densityProp)

    return (
      <button
        ref={ref}
        aria-current={selected ? 'true' : undefined}
        className={cn(
          panelRowShell(gist != null, density),
          'hover:bg-[var(--core-color-state-hover-bg)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
          // `state-selected-bg`, not `surface-subtle`. They are the same value
          // in light (#ecf0f4), which is why this looked right — but in dark
          // `surface-subtle` (#173a44) is DARKER than the raised panel it sits
          // on (#1a3d46), so the selected row measured 1.03:1 against its own
          // background and simply vanished. The semantic token is built to
          // separate in both modes.
          selected && 'bg-[var(--core-color-state-selected-bg)]',
          className
        )}
        type={type}
        {...props}
      >
        <PanelRowContent
          density={density}
          gist={gist}
          icon={icon}
          meta={meta}
          title={title}
        />
      </button>
    )
  }
)

FloatingPanelRow.displayName = 'FloatingPanelRow'

export type FloatingPanelBodyProps = React.HTMLAttributes<HTMLDivElement>

/** Panel content region — fills the space between header and footer. */
export const FloatingPanelBody = ({
  children,
  className,
  ...props
}: FloatingPanelBodyProps) => (
  <div
    className={cn(
      'flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain',
      className
    )}
    {...props}
  >
    {children}
  </div>
)

FloatingPanelBody.displayName = 'FloatingPanelBody'

export type FloatingPanelRowsSkeletonProps = {
  /** How many placeholder rows to render (default 4). */
  rows?: number
  /** Density override; inherits from the surrounding `FloatingPanel`. */
  density?: Density
  className?: string
}

/**
 * Body-filling placeholder rows for a floating panel — glyph, two text lines,
 * trailing meta. This is the loading state for `FloatingPanelRow`, and the
 * two share `panelRowShell` so they can't drift into different boxes.
 * Consumers render it inside `FloatingPanelBody` while content loads, so every
 * panel waits with the same calm shimmer instead of an empty flash.
 */
export const FloatingPanelRowsSkeleton = ({
  className,
  density: densityProp,
  rows = 4
}: FloatingPanelRowsSkeletonProps) => {
  const density = useDensity(densityProp)

  return (
    <div aria-hidden='true' className={cn('flex flex-col p-2', className)}>
      {Array.from({ length: rows }, (_, index) => (
        <div className={panelRowShell(true, density)} key={index}>
          <div className='flex h-5 w-5 shrink-0 items-center justify-center'>
            <Skeleton className='h-3.5 w-3.5 rounded-full' />
          </div>
          <div className='flex min-w-0 flex-1 flex-col gap-1.5'>
            <Skeleton className='h-3 w-2/5 rounded' />
            <Skeleton className='h-2.5 w-3/5 rounded' />
          </div>
          <Skeleton className='h-2.5 w-10 shrink-0 rounded' />
        </div>
      ))}
    </div>
  )
}

FloatingPanelRowsSkeleton.displayName = 'FloatingPanelRowsSkeleton'

export type FloatingPanelFooterProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Density override; inherits from the surrounding `FloatingPanel`. */
  density?: Density
}

const FOOTER_CHROME: Record<Density, string> = {
  standard: 'h-12 px-3',
  compact: 'h-10 px-2.5'
}

/** Panel footer row — fixed height with a hairline divider above. */
export const FloatingPanelFooter = ({
  children,
  className,
  density: densityProp,
  ...props
}: FloatingPanelFooterProps) => {
  const density = useDensity(densityProp)

  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-2 border-t border-border',
        FOOTER_CHROME[density],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

FloatingPanelFooter.displayName = 'FloatingPanelFooter'
