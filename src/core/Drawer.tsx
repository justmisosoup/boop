import type React from 'react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

import { X } from 'lucide-react'

import { cn } from '@/utils/twUtils'

import { IconActionButton } from './Action'
import { useEdgeResize } from './internal/useEdgeResize'
import { Heading } from './Surface'
import { useCoreThemeFallback } from './useCoreThemeFallback'

export type DrawerSide = 'right' | 'left'
export type DrawerSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'
export type DrawerPresentation = 'overlay' | 'docked'

export type DrawerResizeOptions = {
  /** Lower width clamp, px (default 280). */
  minWidth?: number
  /**
   * Upper width clamp, px (default 720). Pass a computed number for
   * viewport-relative caps; the panel is additionally CSS-capped at 100% of
   * its container so a persisted width can never overflow a small window.
   */
  maxWidth?: number
  /**
   * Starting width, px (default 400) — read once on mount (uncontrolled),
   * clamped into [minWidth, maxWidth]. Restore a persisted width here.
   */
  defaultWidth?: number
  /**
   * Double-click reset target, px (read once on mount). Defaults to
   * `defaultWidth`. Set this when the restore point differs from the reset
   * target — e.g. `defaultWidth` restores a persisted width, `resetWidth` is
   * the canonical default to snap back to.
   */
  resetWidth?: number
  /**
   * Commit callback — fires once per completed interaction (pointer release,
   * each keyboard step, double-click reset) with the clamped px width, and
   * only when the width actually changed. Persist here and hang layout work
   * (e.g. a canvas camera refit) off it; it never fires per-frame.
   */
  onResizeEnd?: (width: number) => void
  /** Accessible name for the resize handle (default 'Resize panel'). */
  label?: string
}

// One constant slide duration for both directions. Toggling transition-duration
// at the same instant as the transform can drop the exit transition in some
// browsers (reads as a "flash" instead of a slide), so only the transform
// toggles. Keep the unmount slightly past the slide so the full slide-out shows.
// Mirrors the `duration-500` class on the panel/overlay below.
const EXIT_MS = 540
// The docked rail's collapse rides `duration-standard` (200ms); unmount lands
// just past it so the full slide-out shows.
const DOCKED_EXIT_MS = 240

// Mirrors Dialog's focus helpers. Kept local to avoid coupling to Dialog's
// internals; fold both into a shared overlay hook when we extract that machinery.
const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ')

const getFocusableElements = (root: HTMLElement | null) => {
  if (!root) return []

  return Array.from(
    root.querySelectorAll<HTMLElement>(focusableSelector)
  ).filter(
    element =>
      !element.hasAttribute('disabled') &&
      element.getAttribute('aria-hidden') !== 'true'
  )
}

const sizeMaxWidth: Record<DrawerSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-full'
}

export type DrawerProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'title'
> & {
  isOpen: boolean
  /**
   * Required for the overlay presentation (Escape/backdrop/close-button
   * dismissal). Optional for `presentation='docked'` — an always-open rail
   * has no dismissal; the close button only renders when this is provided.
   */
  onClose?: () => void
  /**
   * Required for the overlay presentation — it names the dialog. Optional
   * for `presentation='docked'`: omit it to render a chromeless rail (no
   * header row, unpadded body) and name the landmark via `aria-label`.
   */
  title?: React.ReactNode
  description?: React.ReactNode
  footer?: React.ReactNode
  side?: DrawerSide
  size?: DrawerSize
  /**
   * Overlay: max-width — a px number or any CSS length string (e.g. `640` or
   * `'65%'`); overrides `size`. Docked: the rail's fixed width (default 400).
   * Ignored while `resizable` is set — the user owns the width there.
   */
  width?: number | string
  /**
   * How the drawer sits on the page (default 'overlay').
   * 'overlay' — the existing floating panel: fixed host, slide transition,
   * optional backdrop; `modal` decides focus-trap/scroll-lock.
   * 'docked' — an in-flow inspector rail that participates in the parent's
   * (flex) layout and pushes content, like an IDE side panel: hairline inner
   * border, no shadow/backdrop/focus-trap/scroll-lock/Escape-close, and the
   * page stays fully interactive. It mounts settled (no slide on route load)
   * and animates open/close by collapsing its width (reduced-motion: instant).
   * `modal`, `overlayClassName`, and `dismissible` are ignored.
   */
  presentation?: DrawerPresentation
  /**
   * Makes the panel user-resizable from its inner edge (pointer drag,
   * Left/Right arrows ±16px, Shift ±64px, Home/End to min/max, double-click
   * to reset). When set it owns the panel's width — `size` and `width` are
   * superseded. Works in both presentations.
   */
  resizable?: DrawerResizeOptions
  /**
   * Modal (default) traps focus, locks body scroll, and dims the page. `false`
   * makes a non-modal side panel — no overlay, no scroll-lock, no focus-trap —
   * so the page behind stays interactive (the logs detail-panel pattern).
   */
  modal?: boolean
  /**
   * Extra classes for the modal backdrop (e.g. `bg-transparent` to keep the
   * modal focus-trap + scroll-lock without dimming the page). Ignored when
   * `modal` is false — a non-modal panel renders no backdrop.
   */
  overlayClassName?: string
  /** Extra classes for the scrollable body region (both presentations). */
  bodyClassName?: string
  showCloseButton?: boolean
  /** Allow Escape / backdrop click to close (default true). */
  dismissible?: boolean
  closeLabel?: string
}

/**
 * Edge-anchored overlay panel — the sibling of `Dialog`, sharing its focus-trap,
 * scroll-lock, focus-restore and `.core-theme` fallback, with a slide
 * transition. Replaces the legacy styled-components `Drawer`.
 *
 * Mount is caller-controlled via `isOpen`; the panel manages its own
 * mount/enter/exit so both directions animate (no need to early-return null).
 */
export const Drawer = ({
  bodyClassName,
  children,
  className,
  closeLabel = 'Close',
  description,
  dismissible = true,
  footer,
  isOpen,
  modal = true,
  onClose,
  overlayClassName,
  presentation = 'overlay',
  resizable,
  showCloseButton = true,
  side = 'right',
  size = 'md',
  style,
  title,
  width,
  ...props
}: DrawerProps) => {
  const docked = presentation === 'docked'
  // Docked rails never trap/lock — the page around them stays interactive.
  const isModal = !docked && modal

  const [mounted, setMounted] = useState(isOpen)
  // A docked rail mounts SETTLED (page furniture at rest — no slide-in on route
  // load); it animates only when the user opens/closes it. The overlay always
  // enters with its slide (it opens in response to an action).
  const [entered, setEntered] = useState(docked ? isOpen : false)
  // While the docked collapse/expand runs, the inner column is width-locked so
  // content rides the slide instead of reflowing; at rest it's fluid (follows
  // a resize drag).
  const [animating, setAnimating] = useState(false)
  const firstRunRef = useRef(true)
  const panelRef = useRef<HTMLDivElement>(null)
  const resizeTargetRef = useRef<HTMLElement | null>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)
  const [overlayRef, applyFallback] = useCoreThemeFallback<HTMLElement>()
  const titleId = useId()
  const descriptionId = useId()

  const resize = useEdgeResize({
    // The handle sits on the panel's inner edge.
    edge: side === 'right' ? 'left' : 'right',
    minWidth: resizable?.minWidth ?? 280,
    maxWidth: resizable?.maxWidth ?? 720,
    defaultWidth: resizable?.defaultWidth ?? 400,
    resetWidth: resizable?.resetWidth,
    targetRef: resizeTargetRef,
    onResizeEnd: resizable?.onResizeEnd
  })

  // Stable merged refs — an inline `ref={node => …}` re-attaches (null then node)
  // on every render, which would re-run `useCoreThemeFallback`'s ancestor check
  // on the docked aside each time (every hover/resize commit).
  const setDockedRef = useCallback(
    (node: HTMLElement | null) => {
      resizeTargetRef.current = node
      overlayRef(node)
    },
    [overlayRef]
  )
  const setOverlayPanelRef = useCallback((node: HTMLDivElement | null) => {
    panelRef.current = node
    resizeTargetRef.current = node
  }, [])

  // Mount → slide in on the next frames; on close, slide out then unmount after
  // the exit transition so both directions animate. The overlay slides on
  // translate-x; the docked rail collapses its width (the sanctioned
  // user-initiated rail collapse — see pitfalls §3) with the content riding out.
  useEffect(() => {
    // A docked rail that mounts already-open is furniture at rest — it must not
    // run the collapse/expand machinery on the first paint, only on a real
    // open/close the user triggers later.
    const initialRun = firstRunRef.current
    firstRunRef.current = false

    if (isOpen) {
      setMounted(true)
      // Flip to the entered (on-screen) state on the next frame so the browser
      // paints the off-screen start first and the slide-in transitions. A short
      // timeout backs up rAF if it's starved, so the panel can't get stuck
      // off-screen (rAF doesn't fire in backgrounded tabs).
      const raf = requestAnimationFrame(() =>
        requestAnimationFrame(() => setEntered(true))
      )
      const fallback = setTimeout(() => setEntered(true), 80)
      let settle: ReturnType<typeof setTimeout> | undefined
      if (docked && !initialRun) {
        setAnimating(true)
        settle = setTimeout(() => setAnimating(false), DOCKED_EXIT_MS)
      }

      return () => {
        cancelAnimationFrame(raf)
        clearTimeout(fallback)
        if (settle) clearTimeout(settle)
      }
    }

    setEntered(false)
    const timer = setTimeout(
      () => setMounted(false),
      docked ? DOCKED_EXIT_MS : EXIT_MS
    )

    return () => clearTimeout(timer)
  }, [docked, isOpen])

  // Escape closes. Let a popover/menu layered inside consume Escape first (Radix
  // portals into a popper wrapper) — same rule as Dialog. Docked rails never
  // listen — Escape belongs to the page around them.
  useEffect(() => {
    if (docked || !mounted || !dismissible || !onClose) return undefined

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return

      const target = event.target

      if (
        target instanceof Element &&
        target.closest('[data-radix-popper-content-wrapper]')
      ) {
        return
      }

      onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [docked, mounted, dismissible, onClose])

  // Move focus into the panel on open; restore it on close. Body scroll is only
  // locked in modal mode (a non-modal panel leaves the page scrollable). A
  // docked rail is ambient page furniture — it must not steal focus on mount
  // (it typically mounts with the route).
  useEffect(() => {
    if (docked || !mounted) return undefined

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null

    let previousOverflow = ''

    if (isModal) {
      previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }

    const [firstFocusable] = getFocusableElements(panelRef.current)
    ;(firstFocusable ?? panelRef.current)?.focus()

    return () => {
      if (isModal) document.body.style.overflow = previousOverflow
      previouslyFocusedRef.current?.focus()
    }
  }, [docked, mounted, isModal])

  // Focus trap — modal only. A non-modal panel lets Tab flow back to the page.
  const handlePanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isModal || event.key !== 'Tab') return

    const focusable = getFocusableElements(panelRef.current)

    if (focusable.length === 0) {
      event.preventDefault()
      panelRef.current?.focus()
      return
    }

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement

    if (event.shiftKey && (active === first || active === panelRef.current)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  if (!mounted) return null

  // Docked without a title is a chromeless rail: no header row, unpadded body
  // (the consumer owns padding and any sticky bars), named via `aria-label`.
  const hasHeader = !docked || title != null || description != null
  const showClose = showCloseButton && onClose != null

  const headerContent = hasHeader ? (
    <div className='flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4'>
      <div className='grid min-w-0 gap-1'>
        {title != null && (
          <Heading className='text-lg leading-7' level={2}>
            <span id={titleId}>{title}</span>
          </Heading>
        )}
        {description && (
          <div className='text-sm text-muted-foreground' id={descriptionId}>
            {description}
          </div>
        )}
      </div>
      {showClose && (
        <IconActionButton
          aria-label={closeLabel}
          variant='quiet'
          onClick={onClose}
        >
          <X size={16} strokeWidth={1.75} />
        </IconActionButton>
      )}
    </div>
  ) : null

  const bodyContent = (
    <div
      className={cn(
        'flex-1 overflow-y-auto',
        hasHeader && 'px-5 py-5',
        bodyClassName
      )}
    >
      {children}
    </div>
  )

  const footerContent = footer ? (
    <div className='flex shrink-0 justify-end gap-2 border-t border-border px-5 py-4'>
      {footer}
    </div>
  ) : null

  // The window-splitter handle: an 8px hit area straddling the inner hairline,
  // with a 2px center line that surfaces on hover and holds while dragging.
  const resizeHandle = resizable ? (
    <div
      ref={resize.handleRef}
      aria-label={resizable.label ?? 'Resize panel'}
      className={cn(
        'absolute inset-y-0 z-10 w-2 cursor-col-resize touch-none select-none outline-none',
        side === 'right' ? '-left-1' : '-right-1',
        'before:absolute before:inset-y-0 before:left-1/2 before:w-0.5 before:-translate-x-1/2',
        'before:transition-colors before:duration-fast before:ease-standard motion-reduce:before:transition-none',
        'hover:before:bg-[var(--core-color-border-strong)]',
        'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        resize.isResizing && 'before:bg-[var(--core-color-focus-ring)]'
      )}
      {...resize.handleProps}
    />
  ) : null

  if (docked) {
    const resolvedWidth = resizable ? resize.width : (width ?? 400)
    const inMotion = animating || !entered
    return (
      // In-flow inspector rail: a complementary landmark that participates in
      // the parent's flex layout — flush hairline chrome, no overlay machinery.
      // Open/close collapses the width (the sanctioned user-initiated rail
      // collapse) while the width-locked inner column rides the slide; overflow
      // clips only during the motion so the resize handle's outer hit area
      // stays live at rest.
      <aside
        {...props}
        ref={setDockedRef}
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={title != null ? titleId : undefined}
        className={cn(
          'relative flex h-full shrink-0 flex-col bg-[var(--core-color-surface-default)] text-foreground',
          side === 'right'
            ? 'border-l border-border'
            : 'border-r border-border',
          'transition-[width] duration-standard ease-emphasized motion-reduce:transition-none',
          resizable && 'max-w-full',
          inMotion && 'overflow-hidden',
          resize.isResizing && 'transition-none',
          applyFallback && 'core-theme',
          className
        )}
        data-resizing={resize.isResizing ? '' : undefined}
        role='complementary'
        style={{ ...style, width: entered ? resolvedWidth : 0 }}
      >
        <div
          className={cn(
            'flex h-full min-h-0 flex-col',
            side === 'left' && 'ml-auto'
          )}
          style={inMotion ? { width: resolvedWidth } : undefined}
        >
          {headerContent}
          {bodyContent}
          {footerContent}
        </div>
        {resizeHandle}
      </aside>
    )
  }

  const closedTransform =
    side === 'right' ? 'translate-x-full' : '-translate-x-full'

  return (
    // Full-screen positioning + theme-fallback host. `pointer-events-none` so a
    // non-modal panel never blocks the page behind it; children re-enable.
    <div
      ref={overlayRef}
      className={cn(
        'pointer-events-none fixed inset-0 z-[1100]',
        applyFallback && 'core-theme'
      )}
    >
      {isModal && (
        <div
          aria-hidden='true'
          className={cn(
            'pointer-events-auto fixed inset-0 bg-[var(--core-color-overlay-backdrop)]',
            'transition-opacity duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none',
            entered ? 'opacity-100' : 'opacity-0',
            overlayClassName
          )}
          onClick={dismissible ? onClose : undefined}
        />
      )}
      <div
        ref={setOverlayPanelRef}
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={title != null ? titleId : undefined}
        aria-modal={isModal || undefined}
        className={cn(
          'pointer-events-auto fixed inset-y-0 flex h-full w-full flex-col',
          'bg-[var(--core-color-surface-modal)] text-foreground shadow-elevation-drawer',
          'transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none',
          side === 'right'
            ? 'right-0 rounded-l-drawer border-l border-border'
            : 'left-0 rounded-r-drawer border-r border-border',
          entered ? 'translate-x-0' : closedTransform,
          // A user-resized width supersedes the size scale; `max-w-full` keeps
          // a persisted width from overflowing a smaller window.
          resizable ? 'max-w-full' : width ? undefined : sizeMaxWidth[size],
          resize.isResizing && 'transition-none',
          className
        )}
        data-resizing={resize.isResizing ? '' : undefined}
        role='dialog'
        style={{
          ...style,
          ...(resizable
            ? { width: resize.width }
            : width
              ? { maxWidth: width }
              : {})
        }}
        tabIndex={-1}
        onKeyDown={handlePanelKeyDown}
        {...props}
      >
        {headerContent}
        {bodyContent}
        {footerContent}
        {resizeHandle}
      </div>
    </div>
  )
}

Drawer.displayName = 'Drawer'
