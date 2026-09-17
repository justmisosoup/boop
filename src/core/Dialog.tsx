import React, { useEffect, useId, useRef } from 'react'

import { X } from 'lucide-react'

import { cn } from '@/utils/twUtils'

import { IconActionButton } from './Action'
import { Heading } from './Surface'
import { useCoreThemeFallback } from './useCoreThemeFallback'

export type DialogSize = 'sm' | 'md' | 'lg'

const DIALOG_TRANSITION_MS = 220
const DIALOG_TRANSITION_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const afterInitialPaint = (callback: () => void) => {
  if (typeof window === 'undefined' || !window.requestAnimationFrame) {
    const timeout = globalThis.setTimeout(callback, 0)
    return () => globalThis.clearTimeout(timeout)
  }

  let secondFrame = 0
  const firstFrame = window.requestAnimationFrame(() => {
    secondFrame = window.requestAnimationFrame(callback)
  })

  return () => {
    window.cancelAnimationFrame(firstFrame)
    if (secondFrame) window.cancelAnimationFrame(secondFrame)
  }
}

export type DialogOverlayProps = React.HTMLAttributes<HTMLDivElement>

export const DialogOverlay = React.forwardRef<
  HTMLDivElement,
  DialogOverlayProps
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'fixed inset-0 z-[1100] flex items-center justify-center bg-[var(--core-color-overlay-backdrop)] p-6',
      className
    )}
    {...props}
  />
))

DialogOverlay.displayName = 'DialogOverlay'

export type DialogPanelProps = React.HTMLAttributes<HTMLDivElement> & {
  size?: DialogSize
}

const dialogSizeClasses: Record<DialogSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl'
}

const focusableSelector = [
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
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

export const DialogPanel = React.forwardRef<HTMLDivElement, DialogPanelProps>(
  ({ className, size = 'md', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex max-h-[calc(100dvh-3rem)] w-full flex-col overflow-hidden rounded-card border border-border bg-[var(--core-color-surface-modal)] text-foreground shadow-elevation-modal',
        dialogSizeClasses[size],
        className
      )}
      {...props}
    />
  )
)

DialogPanel.displayName = 'DialogPanel'

// `title` is omitted from the HTML attributes because `React.HTMLAttributes`
// types it as the string tooltip attribute, which collides with our richer
// `React.ReactNode` title prop.
export type DialogHeaderProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'title'
> & {
  title: React.ReactNode
  onClose?: () => void
  closeLabel?: string
}

export const DialogHeader = React.forwardRef<HTMLDivElement, DialogHeaderProps>(
  (
    { children, className, closeLabel = 'Close', onClose, title, ...props },
    ref
  ) => (
    <div
      ref={ref}
      className={cn(
        'flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4',
        className
      )}
      {...props}
    >
      <div className='grid gap-1'>
        <Heading className='text-lg leading-7' level={2}>
          {title}
        </Heading>
        {children}
      </div>
      {onClose && (
        <IconActionButton
          aria-label={closeLabel}
          variant='quiet'
          onClick={onClose}
        >
          <X size={16} strokeWidth={1.75} />
        </IconActionButton>
      )}
    </div>
  )
)

DialogHeader.displayName = 'DialogHeader'

export type DialogBodyProps = React.HTMLAttributes<HTMLDivElement>

export const DialogBody = React.forwardRef<HTMLDivElement, DialogBodyProps>(
  ({ children, className, ...props }, ref) =>
    children == null ? (
      <></>
    ) : (
      <div
        ref={ref}
        className={cn(
          'relative min-h-0 space-y-4 overflow-y-auto px-5 py-5',
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
)

DialogBody.displayName = 'DialogBody'

export type DialogFooterProps = React.HTMLAttributes<HTMLDivElement>

export const DialogFooter = React.forwardRef<HTMLDivElement, DialogFooterProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex shrink-0 justify-end gap-2 border-t border-border px-5 py-4',
        className
      )}
      {...props}
    />
  )
)

DialogFooter.displayName = 'DialogFooter'

export type DialogProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'title'
> & {
  title: React.ReactNode
  onClose?: () => void
  closeOnEscape?: boolean
  closeOnOverlayClick?: boolean
  isOpen?: boolean
  onEntered?: () => void
  onExited?: () => void
  size?: DialogSize
  footer?: React.ReactNode
  description?: React.ReactNode
  showHeader?: boolean
  instantEnter?: boolean
}

export const Dialog = ({
  children,
  className,
  closeOnEscape = true,
  closeOnOverlayClick = true,
  description,
  footer,
  instantEnter = false,
  isOpen = true,
  onClose,
  onEntered,
  onExited,
  showHeader = true,
  size = 'md',
  style: panelStyleProp,
  title,
  ...props
}: DialogProps) => {
  const panelRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null)
  const onEnteredRef = useRef(onEntered)
  const onExitedRef = useRef(onExited)
  const instantEnterNotifiedRef = useRef(false)
  const [isVisible, setIsVisible] = React.useState(isOpen)
  const [shouldRender, setShouldRender] = React.useState(isOpen)
  // The Dialog depends on `--core-*` tokens that only resolve inside a
  // `.core-theme` scope. `AppShellRoot` supplies it, but legacy/production
  // routes don't — so fall back to scoping the overlay when no themed ancestor
  // exists (and defer to the ancestor when one does).
  const [overlayRef, applyFallback] = useCoreThemeFallback<HTMLDivElement>()
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    onEnteredRef.current = onEntered
    onExitedRef.current = onExited
  }, [onEntered, onExited])

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true)
      if (instantEnter) {
        setIsVisible(true)
        if (!instantEnterNotifiedRef.current) {
          instantEnterNotifiedRef.current = true
          onEnteredRef.current?.()
        }
        return undefined
      }

      let enterTimeout: ReturnType<typeof globalThis.setTimeout> | undefined
      const cancelPaint = afterInitialPaint(() => {
        setIsVisible(true)
        enterTimeout = globalThis.setTimeout(
          () => onEnteredRef.current?.(),
          prefersReducedMotion() ? 0 : DIALOG_TRANSITION_MS
        )
      })

      return () => {
        cancelPaint()
        if (enterTimeout) globalThis.clearTimeout(enterTimeout)
      }
    }

    if (!shouldRender) return undefined

    instantEnterNotifiedRef.current = false
    setIsVisible(false)

    const timeout = globalThis.setTimeout(
      () => {
        setShouldRender(false)
        onExitedRef.current?.()
      },
      prefersReducedMotion() ? 0 : DIALOG_TRANSITION_MS
    )

    return () => globalThis.clearTimeout(timeout)
  }, [instantEnter, isOpen, shouldRender])

  useEffect(() => {
    if (!onClose || !shouldRender || !closeOnEscape) return undefined

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return

      // Let a popover/menu/tooltip layered inside the dialog consume Escape
      // first (Radix portals those into a popper wrapper). Closing the inner
      // overlay shouldn't also close the dialog.
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
  }, [closeOnEscape, onClose, shouldRender])

  useEffect(() => {
    if (!shouldRender) return undefined

    const previousOverflow = document.body.style.overflow
    previouslyFocusedElementRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null

    document.body.style.overflow = 'hidden'

    const [firstFocusable] = getFocusableElements(panelRef.current)
    const focusTarget = firstFocusable ?? panelRef.current
    focusTarget?.focus({ preventScroll: true })

    return () => {
      document.body.style.overflow = previousOverflow
      previouslyFocusedElementRef.current?.focus()
    }
  }, [shouldRender])

  const handlePanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return

    const focusableElements = getFocusableElements(panelRef.current)

    if (focusableElements.length === 0) {
      event.preventDefault()
      panelRef.current?.focus()
      return
    }

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]
    const activeElement = document.activeElement

    if (event.shiftKey && activeElement === panelRef.current) {
      event.preventDefault()
      lastElement.focus()
      return
    }

    if (!event.shiftKey && activeElement === panelRef.current) {
      event.preventDefault()
      firstElement.focus()
      return
    }

    if (event.shiftKey && activeElement === firstElement) {
      event.preventDefault()
      lastElement.focus()
      return
    }

    if (!event.shiftKey && activeElement === lastElement) {
      event.preventDefault()
      firstElement.focus()
    }
  }

  if (!shouldRender) return null

  const transitionDisabled = prefersReducedMotion()
  const instantEnterActive = instantEnter && isOpen
  const overlayStyle: React.CSSProperties = {
    opacity: isVisible ? 1 : 0,
    transition:
      transitionDisabled || instantEnterActive
        ? undefined
        : `opacity ${DIALOG_TRANSITION_MS}ms ${DIALOG_TRANSITION_EASING}`,
    willChange: transitionDisabled || instantEnterActive ? undefined : 'opacity'
  }
  const panelStyle: React.CSSProperties = {
    opacity: isVisible ? 1 : 0,
    transform: isVisible
      ? 'translate3d(0, 0, 0) scale(1)'
      : 'translate3d(0, 10px, 0) scale(0.97)',
    transition:
      transitionDisabled || instantEnterActive
        ? undefined
        : [
            `opacity ${DIALOG_TRANSITION_MS}ms ${DIALOG_TRANSITION_EASING}`,
            `transform ${DIALOG_TRANSITION_MS}ms ${DIALOG_TRANSITION_EASING}`
          ].join(', '),
    willChange:
      transitionDisabled || instantEnterActive
        ? undefined
        : 'opacity, transform',
    ...panelStyleProp
  }

  return (
    <DialogOverlay
      ref={overlayRef}
      className={cn(applyFallback && 'core-theme')}
      style={overlayStyle}
      onClick={closeOnOverlayClick ? onClose : undefined}
    >
      <DialogPanel
        ref={panelRef}
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal='true'
        className={className}
        role='dialog'
        size={size}
        style={panelStyle}
        tabIndex={-1}
        onKeyDown={handlePanelKeyDown}
        onClick={event => event.stopPropagation()}
        {...props}
      >
        {showHeader ? (
          <DialogHeader
            title={<span id={titleId}>{title}</span>}
            onClose={onClose}
          >
            {description && <div id={descriptionId}>{description}</div>}
          </DialogHeader>
        ) : (
          <>
            <div id={titleId} className='sr-only'>
              {title}
            </div>
            {description && (
              <div id={descriptionId} className='sr-only'>
                {description}
              </div>
            )}
          </>
        )}
        <DialogBody>{children}</DialogBody>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogPanel>
    </DialogOverlay>
  )
}

Dialog.displayName = 'Dialog'
