import type React from 'react'
import { Outlet } from 'react-router'

import { AppShellLayout, AppShellMain, AppShellRoot } from '@/core'
import { AppChromeSidebar } from './components/AppChrome/AppChromeSidebar'
import { COLLAPSED_WIDTH, EXPANDED_WIDTH } from './components/AppChrome/constants'
import { SidebarProvider, useSidebar } from './contexts/SidebarContext'
import { useBreakpoint } from './hooks/useBreakpoint'

/**
 * The frame every page renders inside: the global nav rail on the left, the
 * page on the right.
 *
 * The rail is `position: fixed`, so it is out of flow and the page has to
 * leave it room itself. `--nav-w` is that room. It tracks the PINNED width,
 * not the live one: an unpinned rail expands on hover and overlays the page,
 * and reflowing a whole report under the cursor is worse than the overlap.
 * The record view is laid out with its own `fixed` rails against the window
 * (`RecordPage`), so it reads `--nav-w` directly rather than inheriting a
 * margin — which is why this is a variable and not just a padding here.
 */
const ShellFrame = () => {
  const { isPinned } = useSidebar()
  const { isMobile } = useBreakpoint()
  // On mobile the rail is an off-canvas drawer over the page — it reserves
  // nothing.
  const navWidth = isMobile
    ? '0px'
    : isPinned
      ? EXPANDED_WIDTH
      : COLLAPSED_WIDTH

  return (
    <AppShellRoot
      style={{ '--nav-w': navWidth } as React.CSSProperties}
      themeMode='light'
    >
      <AppShellLayout>
        <AppChromeSidebar />
        <AppShellMain style={{ marginLeft: 'var(--nav-w)' }}>
          <Outlet />
        </AppShellMain>
      </AppShellLayout>
    </AppShellRoot>
  )
}

export const Shell = () => (
  <SidebarProvider>
    <ShellFrame />
  </SidebarProvider>
)
