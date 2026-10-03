import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { ArrowUpRight, X } from 'lucide-react'

import { ActionButton } from '@/core'

import { capturedLabel, type SourceScreenshot } from '../lib/sourceScreenshots'

/**
 * The full-size viewer behind a source's capture.
 *
 * Product-level, not core: `@/core` renders the thumbnail because that is part
 * of the citation, but what happens at full size — how tall, how it scrolls,
 * what sits under it — is the consuming screen's decision, and the HoverCard
 * contract forbids core from owning a dialog reachable only from a hover body.
 *
 * Held in context rather than passed down because both tabs cite sources and
 * neither owns the other; threading an `onOpenScreenshot` through every row
 * would put the viewer's identity in six signatures that do not care about it.
 */

type ViewerContext = { open: (shot: SourceScreenshot) => void }

const Context = createContext<ViewerContext | null>(null)

export const useScreenshotViewer = (): ViewerContext => {
  const ctx = useContext(Context)
  if (!ctx) throw new Error('useScreenshotViewer must be used within ScreenshotViewerProvider')
  return ctx
}

/** The live page's host, for its chip: "zendesk.com". */
const hostOf = (href: string) => {
  try {
    return new URL(href).host.replace(/^www\./, '')
  } catch {
    return href
  }
}

const ScreenshotDialog = ({ shot, onClose }: { shot: SourceScreenshot; onClose: () => void }) => {
  const closeRef = useRef<HTMLButtonElement>(null)
  // The element that opened the dialog — focus goes back to it on close, or the
  // reader lands at the top of the document having lost their place in the tab.
  const openerRef = useRef<Element | null>(null)

  useEffect(() => {
    openerRef.current = document.activeElement
    closeRef.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)

    // The page behind must not scroll under the dialog.
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      ;(openerRef.current as HTMLElement | null)?.focus?.()
    }
  }, [onClose])

  return createPortal(
    <div
      aria-label={shot.alt}
      aria-modal="true"
      // A dark fog over the report — midnight, from the tooltip's surface
      // token, blurred — so the white capture and the bar over it stand out.
      // Inline, because `core-theme` paints the canvas colour on whatever
      // carries it, and that is what made a mostly white page read as a white
      // screen.
      className="core-theme fixed inset-0 z-overlay flex flex-col items-center overflow-y-auto overscroll-contain p-6 backdrop-blur-sm"
      style={{ backgroundColor: 'color-mix(in srgb, var(--core-color-overlay-tooltip-bg) 82%, transparent)' }}
      role="dialog"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[1100px]"
        // The backdrop closes; the capture itself does not, or a reader
        // scrolling a tall page dismisses it by touching the thing they opened.
        onClick={(e) => e.stopPropagation()}
      >
        {/* A solid bar, pinned while the capture scrolls under it: a page
            capture is mostly white, and a small inverse X above it scrolled
            away with the first screenful and left nothing to close with. */}
        <div className="sticky top-0 z-10 mb-3 flex items-center justify-between gap-4 rounded-card border border-solid border-border bg-card px-3 py-2 shadow-elevation-raised">
          {/* The company and the kind of page, the live page as a chip, and
              when it was captured under them. */}
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-medium text-foreground">
                {shot.site ? `${shot.site} · ${shot.page ?? 'Page'}` : shot.alt}
              </span>
              {shot.href && (
                <a
                  href={shot.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-0.5 rounded-pill bg-[var(--core-color-chip-bg)] px-1.5 py-px text-caption leading-4 text-[var(--core-color-text-secondary)] transition-colors duration-fast hover:bg-[var(--core-color-chip-hover-bg)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                >
                  {hostOf(shot.href)}
                  <ArrowUpRight aria-hidden="true" size={12} strokeWidth={1.75} />
                </a>
              )}
            </span>
            {capturedLabel(shot.capturedAt) && (
              <span className="text-caption text-text-secondary">{capturedLabel(shot.capturedAt)}</span>
            )}
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="hidden text-caption text-text-secondary sm:inline">Esc</span>
            <ActionButton ref={closeRef} variant="primary" size="compact" leadingIcon={<X size={14} strokeWidth={2} />} onClick={onClose}>
              Close
            </ActionButton>
          </span>
        </div>
        <img alt={shot.alt} className="w-full rounded-control bg-card" src={shot.src} />
      </div>
    </div>,
    document.body
  )
}

export const ScreenshotViewerProvider = ({ children }: { children: React.ReactNode }) => {
  const [shot, setShot] = useState<SourceScreenshot | null>(null)
  const open = useCallback((next: SourceScreenshot) => setShot(next), [])
  const close = useCallback(() => setShot(null), [])

  return (
    <Context.Provider value={{ open }}>
      {children}
      {shot && <ScreenshotDialog shot={shot} onClose={close} />}
    </Context.Provider>
  )
}
