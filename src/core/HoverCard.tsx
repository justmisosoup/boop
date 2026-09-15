import React from 'react'

import * as HoverCardPrimitive from '@radix-ui/react-hover-card'

import { cn } from '@/utils/twUtils'

import { type CoreThemeMode, useCoreThemeMode } from './CoreTheme'

/**
 * Dashboards lean dense; a record preview should answer almost as fast as the
 * eye lands, but not so fast it fires while the pointer merely passes through.
 */
const DEFAULT_OPEN_DELAY = 220
const DEFAULT_CLOSE_DELAY = 120

/**
 * `HoverCard` — a rich, hoverable preview of the content behind a link.
 *
 * Opens on pointer hover and keyboard focus of its trigger, stays open while
 * the pointer travels onto the card (so its body can scroll), and dismisses on
 * `Esc` or pointer-out. Unlike `Hint`/`Tooltip` it may hold structured,
 * multi-line, scrolling content — but like them it is a sighted-pointer
 * affordance: its body is not announced to screen readers and never appears on
 * touch. Use it only for an *optional* preview whose information is also
 * reachable another way (the trigger should be a real link to the full record).
 * For short text-only explanations reach for `Hint` instead.
 */
export const HoverCard = ({
  openDelay = DEFAULT_OPEN_DELAY,
  closeDelay = DEFAULT_CLOSE_DELAY,
  ...props
}: React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Root>) => (
  <HoverCardPrimitive.Root
    closeDelay={closeDelay}
    openDelay={openDelay}
    {...props}
  />
)

export const HoverCardTrigger = HoverCardPrimitive.Trigger

export type HoverCardContentProps = React.ComponentPropsWithoutRef<
  typeof HoverCardPrimitive.Content
> & {
  /**
   * Portaled content can't inherit a scoped `.core-theme[data-theme]` ancestor,
   * so the content self-scopes `.core-theme` and resolves the mode from the
   * nearest core-theme context (override with `themeMode` for isolated cases).
   */
  themeMode?: CoreThemeMode
}

export const HoverCardContent = React.forwardRef<
  React.ElementRef<typeof HoverCardPrimitive.Content>,
  HoverCardContentProps
>(
  (
    { align = 'start', className, sideOffset = 6, themeMode, ...props },
    ref
  ) => {
    const inheritedThemeMode = useCoreThemeMode()
    const resolvedThemeMode = themeMode ?? inheritedThemeMode

    return (
      <HoverCardPrimitive.Portal>
        <HoverCardPrimitive.Content
          ref={ref}
          align={align}
          className={cn(
            // Match Popover: sits above Dialog/Drawer overlays (z-1100) so a
            // preview opened over a dialog-hosted table isn't occluded.
            'core-theme z-[1200] overflow-hidden rounded-popover border border-border',
            'bg-popover text-popover-foreground shadow-elevation-popover',
            'data-[state=open]:animate-popover-in',
            'data-[state=closed]:animate-popover-out',
            className
          )}
          data-theme={resolvedThemeMode === 'dark' ? 'dark' : undefined}
          sideOffset={sideOffset}
          {...props}
        />
      </HoverCardPrimitive.Portal>
    )
  }
)

HoverCardContent.displayName = 'HoverCardContent'
