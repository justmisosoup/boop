import type React from 'react'
import { useEffect, useRef, useState } from 'react'

import { Check, ChevronsUpDown, Moon, Pin, Search, Sun, X } from 'lucide-react'

import { Link } from 'react-router'

import {
  AppShellBrandMark,
  AppShellNav,
  AppShellNavGroup,
  AppShellNavItem,
  AppShellNavSectionLabel,
  AppShellSidebar,
  AppShellSidebarHeader,
  AppShellSubNavItem,
  Avatar,
  Hint,
  IconActionButton,
  Kbd,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger
} from '@/core'
import { useSidebar } from '@/contexts/SidebarContext'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { cn } from '@/utils/twUtils'

import { MiddeskMark } from '../MiddeskMark'
import { MiddeskWordmark } from '../MiddeskWordmark'

export type AppNavLink = {
  id: string
  label: string
  href: string
  icon?: React.ReactNode
  /**
   * Match the route exactly instead of by prefix. Used for base routes that
   * have deeper siblings (e.g. an entity "Home" that shouldn't stay active on
   * its own /export or /information_requests children).
   */
  exact?: boolean
}

export type AppNavSection = {
  id: string
  /** A quiet section label inside a group (e.g. "General", "Developer"). */
  sectionLabel: string
}

export type AppNavGroupConfig = {
  id: string
  label: string
  icon?: React.ReactNode
  items: (AppNavLink | AppNavSection)[]
}

const isSection = (entry: AppNavLink | AppNavSection): entry is AppNavSection =>
  'sectionLabel' in entry

export type AppAccount = {
  name: string
  email: string
  image?: string
}

export type AppSidebarProps = {
  /** Top-level destinations (the primary jobs). */
  primary: AppNavLink[]
  /** Collapsible groups (settings, developer tools, …). */
  groups: AppNavGroupConfig[]
  /** Current route, for active-state matching. */
  activeHref?: string
  account: AppAccount
  /** Theme mode for portaled menus/tooltips (they can't inherit scoped theme). */
  themeMode?: 'light' | 'dark'
  /** When provided, the account menu exposes a Light/Dark appearance control. */
  onThemeChange?: (mode: 'light' | 'dark') => void
  /** Account-menu actions. Items are inert (preview) when omitted. */
  onProfileSettings?: () => void
  onSignOut?: () => void
  /** Opens the ⌘K command palette. When provided, a search field sits in the
   * rail (full field expanded, icon when collapsed) — the reference pattern. */
  onOpenSearch?: () => void
}

// Compare a nav href against the current route. Strips any query/hash from the
// href so links that carry params (e.g. ?hide_completed=true) still match, and
// honors `exact` for base routes that have deeper siblings.
const pathIsActive = (href: string, activeHref?: string, exact?: boolean) => {
  if (!activeHref) return false
  const path = href.split(/[?#]/)[0]
  return exact
    ? activeHref === path
    : activeHref === path || activeHref.startsWith(`${path}/`)
}

const groupIsActive = (group: AppNavGroupConfig, activeHref?: string) =>
  group.items.some(
    item => !isSection(item) && pathIsActive(item.href, activeHref, item.exact)
  )

const AccountMenu = ({
  account,
  collapsed,
  onProfileSettings,
  onSignOut,
  onThemeChange,
  themeMode
}: {
  account: AppAccount
  collapsed: boolean
  onProfileSettings?: () => void
  onSignOut?: () => void
  onThemeChange?: (mode: 'light' | 'dark') => void
  themeMode?: 'light' | 'dark'
}) => (
  <Menu modal={false}>
    <MenuTrigger asChild>
      <button
        aria-label='Account menu'
        className='flex w-full items-center gap-2 rounded-lg p-1 text-left transition-colors hover:bg-[var(--core-color-nav-item-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
        title={collapsed ? account.name?.trim() || account.email : undefined}
        type='button'
      >
        <Avatar
          aria-hidden='true'
          className='shrink-0'
          name={account.name?.trim() || account.email}
          size='sm'
          src={account.image}
        />
        <span
          className={cn(
            'grid min-w-0 flex-1 transition-opacity duration-standard ease-standard motion-reduce:transition-none',
            collapsed ? 'opacity-0' : 'opacity-100'
          )}
        >
          <span className='truncate text-caption font-medium text-foreground'>
            {account.name?.trim() || account.email}
          </span>
          {account.name?.trim() && (
            <span className='truncate text-[length:var(--core-font-size-xs)] text-muted-foreground'>
              {account.email}
            </span>
          )}
        </span>
        <ChevronsUpDown
          aria-hidden='true'
          className={cn(
            'shrink-0 text-muted-foreground transition-opacity duration-standard ease-standard motion-reduce:transition-none',
            collapsed ? 'opacity-0' : 'opacity-100'
          )}
          size={14}
          strokeWidth={1.5}
        />
      </button>
    </MenuTrigger>
    <MenuContent
      align='start'
      className='z-[1001]'
      side='top'
      themeMode={themeMode}
    >
      <MenuItem onSelect={onProfileSettings}>Profile settings</MenuItem>
      {onThemeChange && (
        <>
          <MenuSeparator />
          <MenuLabel>Appearance</MenuLabel>
          <MenuItem onSelect={() => onThemeChange('light')}>
            <span className='flex w-full items-center gap-2'>
              <Sun aria-hidden='true' size={14} strokeWidth={1.75} />
              Light
              {themeMode !== 'dark' && (
                <Check className='ml-auto' size={14} strokeWidth={1.75} />
              )}
            </span>
          </MenuItem>
          <MenuItem onSelect={() => onThemeChange('dark')}>
            <span className='flex w-full items-center gap-2'>
              <Moon aria-hidden='true' size={14} strokeWidth={1.75} />
              Dark
              {themeMode === 'dark' && (
                <Check className='ml-auto' size={14} strokeWidth={1.75} />
              )}
            </span>
          </MenuItem>
        </>
      )}
      <MenuSeparator />
      <MenuItem tone='destructive' onSelect={onSignOut}>
        Sign out
      </MenuItem>
    </MenuContent>
  </Menu>
)

/**
 * The app's primary chrome rail, built ground-up on the @/core AppShell
 * primitives. Calm surface (quiet groups, account anchored at the bottom);
 * data-driven so the real role/feature gating just feeds it `primary` +
 * `groups`. Collapse/hover come from the shared `useSidebar` model.
 *
 * Ported from `app/src/components/AppChrome/AppSidebar.tsx`, with two changes.
 *
 * The brand lockup: the app imports its SVG barrel, the prototype uses its own
 * `MiddeskMark` / `MiddeskWordmark` copies of the same two assets.
 *
 * And `focus-visible:outline-none` where the app writes `outline-hidden` —
 * that is a Tailwind v4 utility and this project is on v3, where it compiles to
 * nothing and the browser paints its own ring on top of core's. Same rule, and
 * the same reason, as the note in `AnalysisDock`.
 */
export const AppSidebar = ({
  account,
  activeHref,
  groups,
  onOpenSearch,
  onProfileSettings,
  onSignOut,
  onThemeChange,
  primary,
  themeMode
}: AppSidebarProps) => {
  const {
    closeMobileNav,
    handleMouseEnter,
    handleMouseLeave,
    handlePinToggle,
    isExpanded,
    isMobileOpen,
    isPinned
  } = useSidebar()
  const { isMobile } = useBreakpoint()
  // On mobile the rail is an off-canvas drawer that always shows full content;
  // the desktop collapse/hover model only applies from `sm` up.
  const collapsed = !isMobile && !isExpanded
  const closeRef = useRef<HTMLButtonElement>(null)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      groups.map(group => [group.id, groupIsActive(group, activeHref)])
    )
  )

  // Keep the group holding the active route open as the route changes (e.g.
  // navigating into Settings opens Settings) without collapsing groups the user
  // opened manually. The initial state above handles first paint.
  const activeGroupId = groups.find(group =>
    groupIsActive(group, activeHref)
  )?.id
  useEffect(() => {
    if (!activeGroupId) return
    setOpenGroups(state =>
      state[activeGroupId] ? state : { ...state, [activeGroupId]: true }
    )
  }, [activeGroupId])

  // Close the mobile drawer whenever the route changes (a destination was
  // chosen). Navigation flows through activeHref, so this also covers taps.
  useEffect(() => {
    if (isMobile) closeMobileNav()
  }, [activeHref, isMobile, closeMobileNav])

  // When the drawer opens, move focus into it and wire Escape-to-close.
  useEffect(() => {
    if (!isMobile || !isMobileOpen) return
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMobileNav()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isMobile, isMobileOpen, closeMobileNav])

  return (
    <>
      {isMobile && (
        <button
          aria-hidden='true'
          className={cn(
            'fixed inset-0 z-[1000] bg-black/40 transition-opacity duration-standard ease-standard motion-reduce:transition-none',
            isMobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
          )}
          tabIndex={-1}
          type='button'
          onClick={closeMobileNav}
        />
      )}
      <AppShellSidebar
        aria-hidden={(isMobile && !isMobileOpen) || undefined}
        aria-label='Primary'
        className={
          isMobile
            ? cn(
                'z-[1001] shadow-elevation-modal transition-transform duration-slow ease-emphasized motion-reduce:transition-none',
                isMobileOpen ? 'translate-x-0' : '-translate-x-full'
              )
            : undefined
        }
        inert={isMobile && !isMobileOpen}
        isExpanded={isMobile ? true : isExpanded}
        isPinned={isMobile ? true : isPinned}
        position='fixed'
        onMouseEnter={isMobile ? undefined : handleMouseEnter}
        onMouseLeave={isMobile ? undefined : handleMouseLeave}
      >
        <AppShellSidebarHeader className='justify-between'>
          {/* Brand is always mounted at a fixed left position. The mark never
              moves on collapse/expand — only the wordmark fades — so there's no
              horizontal bounce. Mark + wordmark sizing matches the legacy
              lockup (25×14 mark, 16px wordmark, 10px gap). */}
          <Link
            aria-label='Middesk'
            className='flex h-8 items-center gap-2.5 text-foreground no-underline [&_path]:fill-current'
            to='/'
          >
            <AppShellBrandMark className='shrink-0'>
              <MiddeskMark className='h-[14px] w-[25px]' />
            </AppShellBrandMark>
            <span
              className={cn(
                'flex h-4 shrink-0 items-center overflow-hidden transition-opacity duration-standard ease-standard motion-reduce:transition-none',
                collapsed ? 'opacity-0' : 'opacity-100'
              )}
            >
              <MiddeskWordmark className='h-4 w-auto' />
            </span>
          </Link>
          {!collapsed &&
            (isMobile ? (
              <IconActionButton
                ref={closeRef}
                aria-label='Close navigation'
                className='size-8 border-0 bg-transparent text-[var(--core-color-nav-item-muted)] hover:bg-[var(--core-color-nav-item-hover-bg)] hover:text-foreground'
                title='Close navigation'
                variant='quiet'
                onClick={closeMobileNav}
              >
                <X aria-hidden='true' size={16} strokeWidth={1.5} />
              </IconActionButton>
            ) : (
              <IconActionButton
                aria-label={isPinned ? 'Unpin sidebar' : 'Pin sidebar'}
                className='size-8 border-0 bg-transparent text-[var(--core-color-nav-item-muted)] hover:bg-[var(--core-color-nav-item-hover-bg)] hover:text-foreground'
                title={isPinned ? 'Unpin sidebar' : 'Pin sidebar'}
                variant='quiet'
                onClick={handlePinToggle}
              >
                <Pin
                  aria-hidden='true'
                  fill={isPinned ? 'currentColor' : 'none'}
                  size={16}
                  strokeWidth={1.5}
                />
              </IconActionButton>
            ))}
        </AppShellSidebarHeader>

        {onOpenSearch &&
          (() => {
            // One button in both states: the search icon stays fixed at the
            // left while the border/bg color-fade and the label + ⌘K opacity-fade
            // — so it morphs with the rail instead of swapping pill↔icon.
            // pl-[7px] (= 8px − 1px border) lands the icon on the same 16px
            // rail-center as the nav icons in both states; pr-2 holds the ⌘K.
            const trigger = (
              <button
                aria-label='Search or jump to'
                className={cn(
                  'flex h-8 w-full items-center gap-2 rounded-lg border pl-[7px] pr-2 text-caption transition-[background-color,border-color,color] duration-standard ease-standard motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  collapsed
                    ? 'border-transparent text-[var(--core-color-nav-item-muted)] hover:bg-[var(--core-color-nav-item-hover-bg)] hover:text-foreground'
                    : 'border-border bg-background text-muted-foreground hover:bg-[var(--core-color-state-hover-bg)]'
                )}
                type='button'
                onClick={onOpenSearch}
              >
                <Search
                  aria-hidden='true'
                  className='shrink-0'
                  size={16}
                  strokeWidth={1.5}
                />
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-left transition-opacity duration-standard ease-standard motion-reduce:transition-none',
                    collapsed ? 'opacity-0' : 'opacity-100'
                  )}
                >
                  Search…
                </span>
                <Kbd
                  className={cn(
                    'shrink-0 transition-opacity duration-standard ease-standard motion-reduce:transition-none',
                    collapsed ? 'opacity-0' : 'opacity-100'
                  )}
                >
                  ⌘K
                </Kbd>
              </button>
            )

            return (
              <div className='px-2 pb-1'>
                {collapsed ? (
                  <Hint
                    asChild
                    content='Search'
                    side='right'
                    size='compact'
                    themeMode={themeMode}
                  >
                    {trigger}
                  </Hint>
                ) : (
                  trigger
                )}
              </div>
            )
          })()}

        <AppShellNav aria-label='Primary navigation'>
          {primary.map(item => (
            <AppShellNavItem
              key={item.id}
              active={pathIsActive(item.href, activeHref, item.exact)}
              asChild
              collapsed={collapsed}
              tooltip={item.label}
              tooltipThemeMode={themeMode}
            >
              <Link
                to={item.href}
                aria-label={collapsed ? item.label : undefined}
              >
                {item.icon && (
                  <span className='grid size-4 shrink-0 place-items-center'>
                    {item.icon}
                  </span>
                )}
                <span
                  className={cn(
                    'min-w-0 truncate transition-opacity duration-standard ease-standard motion-reduce:transition-none',
                    collapsed ? 'opacity-0' : 'opacity-100'
                  )}
                >
                  {item.label}
                </span>
              </Link>
            </AppShellNavItem>
          ))}

          {groups.map(group => (
            <AppShellNavGroup
              key={group.id}
              active={groupIsActive(group, activeHref)}
              collapsed={collapsed}
              icon={group.icon}
              label={group.label}
              open={openGroups[group.id] ?? false}
              tooltipThemeMode={themeMode}
              onCollapsedActivate={handlePinToggle}
              onOpenChange={open =>
                setOpenGroups(state => ({ ...state, [group.id]: open }))
              }
            >
              <div className='mt-1 grid gap-0.5'>
                {group.items.map(entry =>
                  isSection(entry) ? (
                    <AppShellNavSectionLabel
                      key={entry.id}
                      className='mt-2 first:mt-0'
                    >
                      {entry.sectionLabel}
                    </AppShellNavSectionLabel>
                  ) : (
                    <AppShellSubNavItem
                      key={entry.id}
                      active={pathIsActive(entry.href, activeHref, entry.exact)}
                      asChild
                    >
                      <Link to={entry.href}>{entry.label}</Link>
                    </AppShellSubNavItem>
                  )
                )}
              </div>
            </AppShellNavGroup>
          ))}
        </AppShellNav>

        <div className='mt-auto border-t border-[var(--core-color-border-divider)] p-2'>
          <AccountMenu
            account={account}
            collapsed={collapsed}
            themeMode={themeMode}
            onProfileSettings={onProfileSettings}
            onSignOut={onSignOut}
            onThemeChange={onThemeChange}
          />
        </div>
      </AppShellSidebar>
    </>
  )
}
