import React from 'react'

import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { ChevronUp } from 'lucide-react'

import { cn } from '@/utils/twUtils'

import { CoreThemeProvider, type CoreThemeMode } from './CoreTheme'
import { Hint } from './Hint'

export type AppShellThemeMode = CoreThemeMode

export type AppShellRootProps = React.HTMLAttributes<HTMLDivElement> & {
  themeMode?: AppShellThemeMode
}

export const AppShellRoot = React.forwardRef<HTMLDivElement, AppShellRootProps>(
  ({ className, themeMode = 'light', ...props }, ref) => (
    <CoreThemeProvider themeMode={themeMode}>
      <div
        ref={ref}
        className={cn(
          'core-theme min-h-screen bg-background text-foreground',
          className
        )}
        data-theme={themeMode === 'dark' ? 'dark' : undefined}
        {...props}
      />
    </CoreThemeProvider>
  )
)

AppShellRoot.displayName = 'AppShellRoot'

export type AppShellLayoutProps = React.HTMLAttributes<HTMLDivElement>

export const AppShellLayout = React.forwardRef<
  HTMLDivElement,
  AppShellLayoutProps
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex min-h-screen', className)} {...props} />
))

AppShellLayout.displayName = 'AppShellLayout'

export type AppShellSidebarProps = React.HTMLAttributes<HTMLElement> & {
  isExpanded?: boolean
  isPinned?: boolean
  position?: 'fixed' | 'contained'
}

export const AppShellSidebar = React.forwardRef<
  HTMLElement,
  AppShellSidebarProps
>(
  (
    { className, isExpanded, isPinned = true, position = 'fixed', ...props },
    ref
  ) => {
    const expanded = isExpanded ?? isPinned

    return (
      <aside
        ref={ref}
        className={cn(
          // 300ms to match Layout's content-margin transition exactly, so the
          // rail and the page edge move as one (no trailing-edge lag).
          'z-[1000] flex shrink-0 flex-col overflow-x-hidden overflow-y-auto scrollbar-none border-r border-[var(--core-color-nav-border)] bg-[var(--core-color-nav-bg)] transition-[width,box-shadow] duration-300 ease-emphasized motion-reduce:transition-none',
          position === 'fixed' ? 'fixed left-0 top-0 h-screen' : 'h-full',
          // Collapsed = 49px to match the legacy COLLAPSED_WIDTH the content
          // margin uses; the 1px right border then leaves a 48px content box, so
          // the centered pills/icons land on the true visual midline.
          expanded ? 'w-[224px]' : 'w-[49px]',
          expanded && !isPinned && 'shadow-elevation-card',
          className
        )}
        data-expanded={expanded || undefined}
        data-pinned={isPinned || undefined}
        {...props}
      />
    )
  }
)

AppShellSidebar.displayName = 'AppShellSidebar'

export type AppShellSidebarHeaderProps = React.HTMLAttributes<HTMLDivElement>

export const AppShellSidebarHeader = React.forwardRef<
  HTMLDivElement,
  AppShellSidebarHeaderProps
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      // Match the topbar height so the brand/mark centers to the topbar's
      // vertical midline (rail header and topbar share one baseline).
      'flex h-[58px] items-center justify-between px-2',
      className
    )}
    {...props}
  />
))

AppShellSidebarHeader.displayName = 'AppShellSidebarHeader'

export type AppShellBrandMarkProps = React.HTMLAttributes<HTMLDivElement>

export const AppShellBrandMark = React.forwardRef<
  HTMLDivElement,
  AppShellBrandMarkProps
>(({ children, className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex shrink-0 items-center text-foreground', className)}
    {...props}
  >
    {children ?? (
      <svg
        aria-hidden='true'
        className='h-[14px] w-[23px]'
        fill='none'
        viewBox='0 0 24 16'
      >
        <path
          d='M1 15V1l7.3 7.3L12 4.6l3.7 3.7L23 1v14'
          stroke='currentColor'
          strokeLinecap='round'
          strokeLinejoin='round'
          strokeWidth='2'
        />
      </svg>
    )}
  </div>
))

AppShellBrandMark.displayName = 'AppShellBrandMark'

export type AppShellNavProps = React.HTMLAttributes<HTMLElement>

export const AppShellNav = React.forwardRef<HTMLElement, AppShellNavProps>(
  ({ className, ...props }, ref) => (
    <nav
      ref={ref}
      className={cn(
        'flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto scrollbar-none px-2 pb-4 pt-2',
        className
      )}
      {...props}
    />
  )
)

AppShellNav.displayName = 'AppShellNav'

export type AppShellNavSectionProps = React.HTMLAttributes<HTMLDivElement>

export const AppShellNavSection = React.forwardRef<
  HTMLDivElement,
  AppShellNavSectionProps
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('mb-1.5', className)} {...props} />
))

AppShellNavSection.displayName = 'AppShellNavSection'

export type AppShellNavSectionLabelProps =
  React.HTMLAttributes<HTMLParagraphElement>

export const AppShellNavSectionLabel = React.forwardRef<
  HTMLParagraphElement,
  AppShellNavSectionLabelProps
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn(
      // Quiet caps label, no divider line — separation comes from spacing, not a
      // rule (modern/compact). pl-8 aligns the label with the sub-item text.
      'm-0 pb-1 pl-8 pr-2 pt-2 text-left text-[11px] font-medium uppercase tracking-[0.6px] text-muted-foreground',
      className
    )}
    {...props}
  />
))

AppShellNavSectionLabel.displayName = 'AppShellNavSectionLabel'

// Shared selected/hover grammar so parent rows and sub-rows read identically.
// Selected = a soft filled pill + accent-tinted icon + semibold label (the
// modern "filled active" pattern, not a bar or a heavy band); hover is a
// lighter fill. Both adapt to light/dark via the nav-item tokens.
const NAV_ITEM_ACTIVE =
  'bg-[var(--core-color-nav-item-active-bg)] font-semibold text-[var(--core-color-nav-item-active-text)] hover:bg-[var(--core-color-nav-item-active-bg)]'
const NAV_ITEM_INACTIVE =
  'bg-transparent hover:bg-[var(--core-color-nav-item-hover-bg)]'

// Padding uses Tailwind's important modifier (!px / !pl) on purpose: the app
// ships an unlayered global `button { padding: 0 }` reset that otherwise beats
// these layered utilities on <button> rows (group buttons, env toggles),
// breaking the shared text rail. `!` keeps every row — <a>, <button>, <div> —
// on the same 40px rail (8px nav gutter + 8px row pad + 16px icon + 8px gap).
const navItemVariants = cva(
  [
    // `whitespace-nowrap` keeps labels on one line so they don't wrap → reflow
    // while the rail width animates open/closed. Width is set per-state by the
    // components (full-width centered pill when collapsed; hug when expanded).
    'relative min-h-8 whitespace-nowrap rounded-lg !px-2 py-2 text-left text-caption leading-none',
    'text-[var(--core-color-nav-item-text)] transition-colors'
  ],
  {
    variants: {
      active: { true: NAV_ITEM_ACTIVE, false: NAV_ITEM_INACTIVE }
    },
    defaultVariants: {
      active: false
    }
  }
)

// Asymmetric sub-row highlight: hugs the label on the LEFT (ml-6 indents the
// pill to the parent text rail — 24px margin + 8px px-2 lands the label on the
// same 32px rail as parent labels) but bleeds to the FULL nav width on the
// RIGHT. No w-fit, so the grid container stretches the pill to the rail edge;
// the selected/hover fill runs left-aligned-to-label, full-bleed right.
const subNavItemVariants = cva(
  [
    // `whitespace-nowrap` keeps the label one line (no wrap → reflow on animate).
    'relative ml-6 min-h-7 whitespace-nowrap rounded-lg py-1.5 !px-2 text-left text-caption leading-none transition-colors',
    'text-[var(--core-color-nav-item-text)]'
  ],
  {
    variants: {
      active: { true: NAV_ITEM_ACTIVE, false: NAV_ITEM_INACTIVE }
    },
    defaultVariants: {
      active: false
    }
  }
)

export type AppShellNavItemProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof navItemVariants> & {
    asChild?: boolean
    active?: boolean
    collapsed?: boolean
    icon?: React.ReactNode
    /** Label shown as a right-side tooltip when `collapsed` (icon-only rail). */
    tooltip?: React.ReactNode
    /** Theme mode for the portaled tooltip (can't inherit scoped theme). */
    tooltipThemeMode?: 'light' | 'dark'
  }

export const AppShellNavItem = React.forwardRef<
  HTMLDivElement,
  AppShellNavItemProps
>(
  (
    {
      active = false,
      asChild = false,
      children,
      className,
      collapsed = false,
      icon,
      tooltip,
      tooltipThemeMode,
      ...props
    },
    ref
  ) => {
    const classes = cn(
      navItemVariants({ active }),
      'flex items-center justify-start gap-2',
      // Full-width pill in both states. Rows are a uniform 32px (py-2 in the
      // base), so the collapsed keycap is a 32px square with equal padding and
      // there's no vertical reflow on collapse/expand; expanded spans the rail
      // so the active background balances the search field above it.
      'w-full',
      className
    )

    const element = asChild ? (
      <Slot
        ref={ref}
        aria-current={active ? 'page' : undefined}
        className={classes}
        data-active={active || undefined}
        data-collapsed={collapsed || undefined}
        {...props}
      >
        {children}
      </Slot>
    ) : (
      <div
        ref={ref}
        aria-current={active ? 'page' : undefined}
        className={classes}
        data-active={active || undefined}
        data-collapsed={collapsed || undefined}
        {...props}
      >
        {icon && (
          <span className='grid size-4 shrink-0 place-items-center'>
            {icon}
          </span>
        )}
        <span
          className={cn(
            'min-w-0 truncate transition-opacity duration-standard ease-standard motion-reduce:transition-none',
            collapsed ? 'opacity-0' : 'opacity-100'
          )}
        >
          {children}
        </span>
      </div>
    )

    // Collapsed rail is icon-only; surface the label as a right-side tooltip on
    // hover/focus so the nav stays usable. `asChild` keeps HintTrigger from
    // applying its inline-reset styles to the row.
    if (collapsed && tooltip) {
      return (
        <Hint
          asChild
          content={tooltip}
          side='right'
          size='compact'
          themeMode={tooltipThemeMode}
        >
          {element}
        </Hint>
      )
    }

    return element
  }
)

AppShellNavItem.displayName = 'AppShellNavItem'

export type AppShellNavGroupButtonProps =
  React.ButtonHTMLAttributes<HTMLButtonElement> &
    VariantProps<typeof navItemVariants> & {
      active?: boolean
      collapsed?: boolean
      icon?: React.ReactNode
      trailingIcon?: React.ReactNode
      /** Label shown as a right-side tooltip when `collapsed`. */
      tooltip?: React.ReactNode
      /** Theme mode for the portaled tooltip (can't inherit scoped theme). */
      tooltipThemeMode?: 'light' | 'dark'
    }

export const AppShellNavGroupButton = React.forwardRef<
  HTMLButtonElement,
  AppShellNavGroupButtonProps
>(
  (
    {
      active = false,
      children,
      className,
      collapsed = false,
      icon,
      tooltip,
      tooltipThemeMode,
      trailingIcon,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const button = (
      <button
        ref={ref}
        className={cn(
          navItemVariants({ active }),
          'flex items-center justify-start gap-2 border-0 text-left',
          // Full-width in both states; uniform 32px rows → a 32px square keycap
          // when collapsed (no reflow). Expanded pins the chevron right
          // (ml-auto) so the row balances the search field.
          'w-full',
          className
        )}
        data-active={active || undefined}
        data-collapsed={collapsed || undefined}
        type={type}
        {...props}
      >
        {icon && (
          <span className='grid size-4 shrink-0 place-items-center'>
            {icon}
          </span>
        )}
        <span
          className={cn(
            'min-w-0 truncate transition-opacity duration-standard ease-standard motion-reduce:transition-none',
            collapsed ? 'opacity-0' : 'opacity-100'
          )}
        >
          {children}
        </span>
        {trailingIcon && (
          <span
            className={cn(
              'ml-auto grid size-4 shrink-0 place-items-center transition-opacity duration-standard ease-standard motion-reduce:transition-none',
              collapsed ? 'opacity-0' : 'opacity-100'
            )}
          >
            {trailingIcon}
          </span>
        )}
      </button>
    )

    if (collapsed && tooltip) {
      return (
        <Hint
          asChild
          content={tooltip}
          side='right'
          size='compact'
          themeMode={tooltipThemeMode}
        >
          {button}
        </Hint>
      )
    }

    return button
  }
)

AppShellNavGroupButton.displayName = 'AppShellNavGroupButton'

export type AppShellSubNavItemProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof subNavItemVariants> & {
    asChild?: boolean
    active?: boolean
  }

export const AppShellSubNavItem = React.forwardRef<
  HTMLDivElement,
  AppShellSubNavItemProps
>(({ active = false, asChild = false, className, ...props }, ref) => {
  const Component = asChild ? Slot : 'div'

  return (
    <Component
      ref={ref}
      aria-current={active ? 'page' : undefined}
      className={cn(
        subNavItemVariants({ active }),
        'flex items-center justify-start text-left',
        className
      )}
      data-active={active || undefined}
      {...props}
    />
  )
})

AppShellSubNavItem.displayName = 'AppShellSubNavItem'

export type AppShellNavCollapsibleProps =
  React.HTMLAttributes<HTMLDivElement> & {
    open?: boolean
  }

// Animated disclosure for nav groups. Uses the grid-template-rows 0fr↔1fr
// height trick (plus a small content lift) so sub-nav reveals smoothly instead
// of popping — a calm reveal. Children stay mounted; closed state is height 0
// + clipped, so it's cheap to re-open.
export const AppShellNavCollapsible = React.forwardRef<
  HTMLDivElement,
  AppShellNavCollapsibleProps
>(({ children, className, open = false, ...props }, ref) => (
  <div
    ref={ref}
    // Closed content stays mounted (cheap re-open) but leaves the a11y tree and
    // tab order via aria-hidden + inert, so hidden links aren't focusable.
    aria-hidden={!open || undefined}
    className={cn(
      'grid overflow-hidden transition-[grid-template-rows,opacity] duration-standard ease-emphasized motion-reduce:transition-none',
      open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
      className
    )}
    data-state={open ? 'open' : 'closed'}
    inert={!open}
    {...props}
  >
    <div
      className={cn(
        'min-h-0 transition-transform duration-standard ease-emphasized motion-reduce:transition-none',
        open ? 'translate-y-0' : '-translate-y-2'
      )}
    >
      {children}
    </div>
  </div>
))

AppShellNavCollapsible.displayName = 'AppShellNavCollapsible'

export type AppShellNavGroupProps = {
  /** Visible group label; also the collapsed-rail tooltip. */
  label: React.ReactNode
  icon?: React.ReactNode
  active?: boolean
  collapsed?: boolean
  /** Controlled open state of the disclosure. */
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * When `collapsed` the disclosure can't open in place, so clicking the button
   * runs this instead (e.g. expand/pin the rail). No-op if omitted.
   */
  onCollapsedActivate?: () => void
  /** Theme mode for the portaled collapsed-rail tooltip. */
  tooltipThemeMode?: 'light' | 'dark'
  className?: string
  children: React.ReactNode
}

// A nav group = disclosure button + animated region, wired with the WAI-ARIA
// disclosure contract (aria-expanded/aria-controls, Esc-to-close + focus
// return, chevron reflecting state) so consumers don't re-hand-roll it.
export const AppShellNavGroup = ({
  active = false,
  children,
  className,
  collapsed = false,
  icon,
  label,
  onCollapsedActivate,
  onOpenChange,
  open,
  tooltipThemeMode
}: AppShellNavGroupProps) => {
  const regionId = `appshell-navgroup-${React.useId()}`
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const isOpen = open && !collapsed

  const handleClick = () => {
    if (collapsed) {
      onCollapsedActivate?.()
      return
    }

    onOpenChange(!open)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && isOpen) {
      event.stopPropagation()
      onOpenChange(false)
      buttonRef.current?.focus()
    }
  }

  return (
    <div className={className} onKeyDown={handleKeyDown}>
      <AppShellNavGroupButton
        ref={buttonRef}
        active={active}
        // Collapsed buttons hide their text label, so give them a name.
        aria-label={collapsed && typeof label === 'string' ? label : undefined}
        aria-controls={collapsed ? undefined : regionId}
        aria-expanded={collapsed ? undefined : open}
        collapsed={collapsed}
        icon={icon}
        tooltip={collapsed ? label : undefined}
        tooltipThemeMode={tooltipThemeMode}
        trailingIcon={
          <ChevronUp
            aria-hidden='true'
            className={cn(
              'size-4 transition-transform duration-standard ease-emphasized motion-reduce:transition-none',
              !open && 'rotate-180'
            )}
            strokeWidth={1.5}
          />
        }
        onClick={handleClick}
      >
        {label}
      </AppShellNavGroupButton>
      <AppShellNavCollapsible id={regionId} open={isOpen}>
        {children}
      </AppShellNavCollapsible>
    </div>
  )
}

AppShellNavGroup.displayName = 'AppShellNavGroup'

export type AppShellMainProps = React.HTMLAttributes<HTMLDivElement>

export const AppShellMain = React.forwardRef<HTMLDivElement, AppShellMainProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('min-w-0 flex-1', className)} {...props} />
  )
)

AppShellMain.displayName = 'AppShellMain'

export type AppShellTopbarProps = React.HTMLAttributes<HTMLElement>

export const AppShellTopbar = React.forwardRef<
  HTMLElement,
  AppShellTopbarProps
>(({ className, ...props }, ref) => (
  <header ref={ref} className={cn('sticky top-0 z-40', className)} {...props} />
))

AppShellTopbar.displayName = 'AppShellTopbar'

export type AppShellTopbarContentProps = React.HTMLAttributes<HTMLDivElement>

export const AppShellTopbarContent = React.forwardRef<
  HTMLDivElement,
  AppShellTopbarContentProps
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex h-[58px] w-full flex-none items-center bg-background px-6 py-0',
      className
    )}
    {...props}
  />
))

AppShellTopbarContent.displayName = 'AppShellTopbarContent'

export type AppShellSearchTriggerProps =
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    active?: boolean
  }

export const AppShellSearchTrigger = React.forwardRef<
  HTMLButtonElement,
  AppShellSearchTriggerProps
>(({ active = false, className, type = 'button', ...props }, ref) => (
  <button
    ref={ref}
    aria-expanded={active || undefined}
    className={cn(
      'min-w-64 rounded-[var(--core-radius-action-standard)] border border-border bg-background px-3 py-2 text-left text-sm text-muted-foreground',
      'transition-colors hover:bg-[var(--core-color-state-hover-bg)]',
      'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
      active && 'bg-[var(--core-color-state-hover-bg)] text-foreground',
      className
    )}
    data-state={active ? 'open' : 'closed'}
    type={type}
    {...props}
  />
))

AppShellSearchTrigger.displayName = 'AppShellSearchTrigger'

export type AppShellSearchRootProps = React.HTMLAttributes<HTMLDivElement>

export const AppShellSearchRoot = React.forwardRef<
  HTMLDivElement,
  AppShellSearchRootProps
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('relative', className)} {...props} />
))

AppShellSearchRoot.displayName = 'AppShellSearchRoot'

export type AppShellSearchPanelProps = React.HTMLAttributes<HTMLDivElement>

export const AppShellSearchPanel = React.forwardRef<
  HTMLDivElement,
  AppShellSearchPanelProps
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'absolute left-0 top-[calc(100%+6px)] z-50 w-[360px] overflow-hidden rounded-[var(--core-radius-popover)] border border-border bg-popover text-popover-foreground shadow-elevation-popover',
      className
    )}
    {...props}
  />
))

AppShellSearchPanel.displayName = 'AppShellSearchPanel'

export type AppShellSearchResultProps =
  React.ButtonHTMLAttributes<HTMLButtonElement>

export const AppShellSearchResult = React.forwardRef<
  HTMLButtonElement,
  AppShellSearchResultProps
>(({ className, type = 'button', ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--core-color-state-hover-bg)] focus-visible:bg-[var(--core-color-state-hover-bg)] focus-visible:outline-hidden',
      className
    )}
    type={type}
    {...props}
  />
))

AppShellSearchResult.displayName = 'AppShellSearchResult'
