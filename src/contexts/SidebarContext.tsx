import type React from 'react'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from 'react'

/**
 * Collapse/hover/pin state for the global nav rail, ported from the app
 * (`app/src/contexts/SidebarContext.tsx`). The app reads the key from a shared
 * `constants/storageKeys`; the prototype has no such module, so the key is
 * inlined here — it is the same string, so a pinned rail in the app and in the
 * prototype don't fight over different entries.
 */
const SIDENAV_PINNED_KEY = 'middesk:sidenav-pinned'

interface SidebarContextType {
  isExpanded: boolean
  isPinned: boolean
  setIsExpanded: (expanded: boolean) => void
  setIsPinned: (pinned: boolean) => void
  handleMouseEnter: () => void
  handleMouseLeave: () => void
  handlePinToggle: () => void
  /** Mobile-only: the off-canvas nav drawer. */
  isMobileOpen: boolean
  openMobileNav: () => void
  closeMobileNav: () => void
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

export const useSidebar = () => {
  const context = useContext(SidebarContext)

  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }

  return context
}

interface SidebarProviderProps {
  children: ReactNode
}

const getInitialPinned = (): boolean => {
  if (typeof window === 'undefined') return true

  try {
    const saved = localStorage.getItem(SIDENAV_PINNED_KEY)

    if (saved !== null) {
      return JSON.parse(saved)
    }
  } catch {
    // Ignore storage/parse errors and fall back to the default.
  }

  return true
}

export const SidebarProvider: React.FC<SidebarProviderProps> = ({
  children
}) => {
  const [isPinned, setIsPinned] = useState(getInitialPinned)
  const [isExpanded, setIsExpanded] = useState(isPinned)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const openMobileNav = useCallback(() => setIsMobileOpen(true), [])
  const closeMobileNav = useCallback(() => setIsMobileOpen(false), [])

  const handleMouseEnter = useCallback(() => {
    if (!isPinned) {
      setIsExpanded(true)
    }
  }, [isPinned])

  const handleMouseLeave = useCallback(() => {
    if (!isPinned) {
      setIsExpanded(false)
    }
  }, [isPinned])

  const handlePinToggle = useCallback(() => {
    const newPinned = !isPinned

    setIsPinned(newPinned)
    setIsExpanded(newPinned)

    try {
      localStorage.setItem(SIDENAV_PINNED_KEY, JSON.stringify(newPinned))
    } catch {
      // Non-fatal: the pin is a convenience, not a source of truth.
    }
  }, [isPinned])

  const value = useMemo(
    () => ({
      isExpanded,
      isPinned,
      setIsExpanded,
      setIsPinned,
      handleMouseEnter,
      handleMouseLeave,
      handlePinToggle,
      isMobileOpen,
      openMobileNav,
      closeMobileNav
    }),
    [
      isExpanded,
      isPinned,
      handleMouseEnter,
      handleMouseLeave,
      handlePinToggle,
      isMobileOpen,
      openMobileNav,
      closeMobileNav
    ]
  )

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  )
}
