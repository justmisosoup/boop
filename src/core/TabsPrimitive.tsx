import React from 'react'

import * as RadixTabs from '@radix-ui/react-tabs'
import { cva, type VariantProps } from 'class-variance-authority'
import { Check, ChevronDown } from 'lucide-react'

import { cn } from '@/utils/twUtils'

import { useTabsOverflow } from './internal/useTabsOverflow'
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from './Menu'

/**
 * Shadcn/Radix-backed Tabs primitive, built on the `--core-color-tab-*`
 * foundation tokens so it is theme-aware in light and dark. This is the
 * design-system replacement for the legacy styled-components `Tabs`; it is
 * exported from its own module path while the legacy `Tab`/`Tabs` remain on
 * the `@/core` barrel for the existing app.
 *
 * The active underline is drawn with an inset box-shadow (not a border or
 * negative margin) so it survives the app's unlayered `button { padding: 0 }`
 * reset that otherwise clobbers layered Tailwind utilities on <button>.
 *
 * Overflow is built in: triggers that don't fit the list's width collapse (in
 * order, from the right) into a "More" menu that sits inline after the last
 * visible tab. Triggers marked `overflow='fixed'` live in that menu
 * permanently (below a separator when auto-collapsed tabs are present), which
 * also keeps the More trigger visible at full width. Tab order never changes —
 * when the active tab is in the menu, the More trigger carries the active
 * styling and the menu marks the selected item. Collapsed triggers stay in the
 * DOM
 * (`display: none`) so Radix's roving focus and ARIA wiring remain valid; the
 * menu button inside `role=tablist` is a pragmatic ARIA deviation, coherent
 * because hidden tabs leave the accessibility tree. `TabsList` children must
 * be flat `TabsTrigger` elements (arrays from `.map` and conditionals are
 * fine; fragments are not flattened).
 */

type TabsValueContextValue = {
  value: string | undefined
  setValue: (value: string) => void
}

const TabsValueContext = React.createContext<TabsValueContextValue | null>(null)

export type TabsProps = React.ComponentPropsWithoutRef<typeof RadixTabs.Root>

/**
 * Controllable wrapper over the Radix root: mirrors the current value into a
 * local context so `TabsList` can drive the overflow menu (Radix's own value
 * context is not public). Behavior-identical for controlled and uncontrolled
 * usage.
 */
export const Tabs = React.forwardRef<
  React.ElementRef<typeof RadixTabs.Root>,
  TabsProps
>(({ defaultValue, onValueChange, value, ...props }, ref) => {
  const isControlled = value !== undefined
  const [internalValue, setInternalValue] = React.useState(defaultValue)
  const currentValue = isControlled ? value : internalValue

  const setValue = React.useCallback(
    (next: string) => {
      if (!isControlled) setInternalValue(next)
      onValueChange?.(next)
    },
    [isControlled, onValueChange]
  )

  const context = React.useMemo(
    () => ({ value: currentValue, setValue }),
    [currentValue, setValue]
  )

  return (
    <TabsValueContext.Provider value={context}>
      <RadixTabs.Root
        ref={ref}
        value={currentValue}
        onValueChange={setValue}
        {...props}
      />
    </TabsValueContext.Provider>
  )
})

Tabs.displayName = 'Tabs'

const tabsListVariants = cva('flex items-center', {
  variants: {
    variant: {
      underline: 'gap-6 border-b border-[var(--core-color-tab-track)]'
    },
    align: {
      start: 'justify-start',
      stretch: 'w-full justify-stretch'
    }
  },
  defaultVariants: {
    variant: 'underline',
    align: 'start'
  }
})

export type TabsListProps = React.ComponentPropsWithoutRef<
  typeof RadixTabs.List
> &
  VariantProps<typeof tabsListVariants> & {
    /** Label for the overflow menu trigger. */
    moreLabel?: string
  }

export const TabsList = React.forwardRef<
  React.ElementRef<typeof RadixTabs.List>,
  TabsListProps
>(
  (
    { align, children, className, moreLabel = 'More', variant, ...props },
    forwardedRef
  ) => {
    const context = React.useContext(TabsValueContext)
    const listRef = React.useRef<HTMLDivElement | null>(null)
    const moreRef = React.useRef<HTMLButtonElement | null>(null)

    const composedRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        listRef.current = node
        if (typeof forwardedRef === 'function') forwardedRef(node)
        else if (forwardedRef) forwardedRef.current = node
      },
      [forwardedRef]
    )

    const items = React.Children.toArray(children).filter(
      React.isValidElement
    ) as React.ReactElement<{
      value?: string
      disabled?: boolean
      children?: React.ReactNode
      overflow?: 'fixed'
    }>[]

    // Without the value context (a TabsList under a raw Radix root) the menu
    // cannot activate tabs, so overflow degrades to the plain clipping row —
    // including overflow='fixed' triggers, which must never be unreachable.
    const overflowDisabled = context === null

    // Auto tabs collapse by measurement; 'fixed' tabs live in the More menu
    // permanently and never take bar space.
    const autoItems = items.filter(item => item.props.overflow !== 'fixed')
    const fixedItems = overflowDisabled
      ? []
      : items.filter(item => item.props.overflow === 'fixed')

    const visibleCount = useTabsOverflow({
      listRef,
      moreRef,
      values: autoItems.map(item => item.props.value),
      disabled: overflowDisabled,
      reserveMore: fixedItems.length > 0,
      deps: [children]
    })

    const overflowed = autoItems.slice(visibleCount)
    const menuItems = [...overflowed, ...fixedItems]
    const isActiveHidden = menuItems.some(
      item => item.props.value === context?.value
    )

    const hideAsOverflowed = (item: (typeof items)[number]) =>
      React.cloneElement(item, {
        'data-core-tabs-overflow-hidden': ''
      } as React.HTMLAttributes<HTMLElement>)

    const renderMenuItem = (item: (typeof items)[number]) => {
      const isSelected = item.props.value === context?.value

      return (
        <MenuItem
          disabled={item.props.disabled}
          data-core-tabs-menu-active={isSelected ? '' : undefined}
          key={item.key ?? item.props.value}
          onSelect={() => {
            if (item.props.value != null) context?.setValue(item.props.value)
          }}
        >
          <span className='flex w-full items-center gap-2'>
            {item.props.children}
            {isSelected && (
              <Check
                aria-hidden='true'
                className='ml-auto shrink-0'
                size={14}
                strokeWidth={1.75}
              />
            )}
          </span>
        </MenuItem>
      )
    }

    return (
      <RadixTabs.List
        ref={composedRef}
        className={cn(tabsListVariants({ align, variant }), className)}
        {...props}
      >
        {overflowDisabled
          ? items
          : autoItems.map((item, index) =>
              index < visibleCount ? item : hideAsOverflowed(item)
            )}
        {/* Ordering contract with useTabsOverflow: fixed-in-More triggers
            render after every auto trigger so measurement sees the auto set
            first. They stay in the DOM as real (hidden) triggers to keep the
            Radix value/panel/ARIA wiring intact. */}
        {fixedItems.map(hideAsOverflowed)}
        {!overflowDisabled && (
          <Menu>
            <MenuTrigger asChild>
              {/* Mirrors the TabsTrigger classes below (keep in sync): Radix
                  MenuTrigger owns data-state (open/closed), so the active and
                  hover underline states are applied explicitly rather than via
                  the data-[state=active] variants. Sits inline after the last
                  visible tab (the list's own gap spaces it). Always in the DOM
                  (hidden when the menu would be empty) so its width is
                  measurable before the first collapse. */}
              <button
                ref={moreRef}
                className={cn(
                  'group relative inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap text-sm font-medium',
                  '!text-[var(--core-color-tab-fg-active)] transition-[color,box-shadow]',
                  'focus-visible:rounded-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--core-color-focus-ring)]',
                  'data-[core-tabs-overflow-hidden]:hidden',
                  isActiveHidden
                    ? 'font-semibold shadow-[inset_0_-2px_0_0_var(--core-color-tab-indicator)]'
                    : 'hover:shadow-[inset_0_-2px_0_0_var(--core-color-tab-hover-indicator)] data-[state=open]:shadow-[inset_0_-2px_0_0_var(--core-color-tab-hover-indicator)]'
                )}
                data-core-tabs-more-active={isActiveHidden ? '' : undefined}
                data-core-tabs-overflow-hidden={
                  menuItems.length === 0 ? '' : undefined
                }
                type='button'
              >
                {moreLabel}
                <ChevronDown
                  aria-hidden='true'
                  className='shrink-0 opacity-60'
                  size={14}
                  strokeWidth={1.75}
                />
              </button>
            </MenuTrigger>
            <MenuContent align='end'>
              {/* Plain items with a trailing check on the selection (the
                  EnvironmentSwitcher pattern) — no radio indicator. */}
              {overflowed.map(renderMenuItem)}
              {overflowed.length > 0 && fixedItems.length > 0 && (
                <MenuSeparator />
              )}
              {fixedItems.map(renderMenuItem)}
            </MenuContent>
          </Menu>
        )}
      </RadixTabs.List>
    )
  }
)

TabsList.displayName = 'TabsList'

const tabsTriggerVariants = cva(
  [
    // group enables the active count to react to the parent trigger state.
    // All tabs use the full (selected) text color so none read as inactive; the
    // active tab adds weight + a solid underline, and inactive tabs preview a
    // muted underline that animates in on hover. `!` text beats the app's
    // unlayered global `button { color: inherit }` reset.
    'group relative inline-flex h-9 items-center gap-2 whitespace-nowrap text-sm font-medium',
    '!text-[var(--core-color-tab-fg-active)] transition-[color,box-shadow]',
    'data-[state=inactive]:hover:shadow-[inset_0_-2px_0_0_var(--core-color-tab-hover-indicator)]',
    'focus-visible:rounded-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--core-color-focus-ring)]',
    'disabled:pointer-events-none disabled:opacity-50',
    'data-[state=active]:font-semibold',
    'data-[state=active]:shadow-[inset_0_-2px_0_0_var(--core-color-tab-indicator)]',
    // Overflowed triggers stay in the DOM (display: none) so Radix's roving
    // focus and the TabsList measurement can still see them; the More menu is
    // how users reach them.
    'data-[core-tabs-overflow-hidden]:hidden'
  ],
  {
    variants: {
      variant: { underline: '' }
    },
    defaultVariants: {
      variant: 'underline'
    }
  }
)

export type TabsTriggerProps = React.ComponentPropsWithoutRef<
  typeof RadixTabs.Trigger
> &
  VariantProps<typeof tabsTriggerVariants> & {
    /**
     * 'fixed' files this tab into the list's More menu permanently — it never
     * renders in the bar. Omit for the default: the tab sits in the bar and
     * collapses into More only when the list runs out of width. Use 'fixed'
     * for secondary views that shouldn't take bar space; auto-collapsed tabs
     * stack above them in the menu. Read by the parent TabsList (never
     * reaches the DOM).
     */
    overflow?: 'fixed'
  }

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof RadixTabs.Trigger>,
  TabsTriggerProps
>(({ className, overflow: _overflow, variant, ...props }, ref) => (
  <RadixTabs.Trigger
    ref={ref}
    className={cn(tabsTriggerVariants({ variant }), className)}
    {...props}
  />
))

TabsTrigger.displayName = 'TabsTrigger'

export type TabsCountProps = React.HTMLAttributes<HTMLSpanElement>

/**
 * Optional count/meta badge for a TabsTrigger. Reads the parent trigger's
 * active state via group-data so it inverts on the active tab.
 */
export const TabsCount = React.forwardRef<HTMLSpanElement, TabsCountProps>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium leading-5',
        'bg-[var(--core-color-state-selected-bg)] text-[var(--core-color-text-secondary)]',
        'group-data-[state=active]:bg-[var(--core-color-action-primary-bg)] group-data-[state=active]:text-[var(--core-color-text-on-action)]',
        className
      )}
      {...props}
    />
  )
)

TabsCount.displayName = 'TabsCount'

export type TabsContentProps = React.ComponentPropsWithoutRef<
  typeof RadixTabs.Content
>

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof RadixTabs.Content>,
  TabsContentProps
>(({ className, ...props }, ref) => (
  <RadixTabs.Content
    ref={ref}
    className={cn(
      // Default gap below the tab row so content doesn't sit flush against
      // the underline (matches the shadcn Tabs default); override via className.
      'mt-2 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--core-color-focus-ring)]',
      className
    )}
    {...props}
  />
))

TabsContent.displayName = 'TabsContent'
