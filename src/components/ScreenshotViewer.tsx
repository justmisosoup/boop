import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { X } from 'lucide-react'

import type { SourceScreenshot } from '../lib/sourceScreenshots'

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
      className="core-theme fixed inset-0 z-overlay flex flex-col items-center overflow-y-auto overscroll-contain p-6"
      role="dialog"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[1100px]"
        // The backdrop closes; the capture itself does not, or a reader
        // scrolling a tall page dismisses it by touching the thing they opened.
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between gap-4">
          <span className="text-caption text-white">{shot.alt}</span>
          <button
            aria-label="Close"
            className="rounded-control p-1 text-white hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            ref={closeRef}
            type="button"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>
        <img alt={shot.alt} className="w-full rounded-control bg-white" src={shot.src} />
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
