import React from 'react'

import * as PopoverPrimitive from '@radix-ui/react-popover'

import { cn } from '@/utils/twUtils'

import { type CoreThemeMode, useCoreThemeMode } from './CoreTheme'

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger
export const PopoverAnchor = PopoverPrimitive.Anchor

export type PopoverContentProps = React.ComponentPropsWithoutRef<
  typeof PopoverPrimitive.Content
> & {
  /**
   * Portaled content can't inherit a scoped `.core-theme[data-theme]` ancestor,
   * so the content self-scopes `.core-theme` and resolves the mode from the
   * nearest core-theme context (override with `themeMode` for isolated cases).
   */
  themeMode?: CoreThemeMode
}

export const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  PopoverContentProps
>(
  (
    { align = 'start', className, sideOffset = 6, themeMode, ...props },
    ref
  ) => {
    const inheritedThemeMode = useCoreThemeMode()
    const resolvedThemeMode = themeMode ?? inheritedThemeMode

    return (
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          ref={ref}
          align={align}
          className={cn(
            // z-index sits above Dialog/Drawer overlays (z-1100) so a Combobox
            // opened inside a dialog isn't occluded by the dialog body.
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
      </PopoverPrimitive.Portal>
    )
  }
)

PopoverContent.displayName = 'PopoverContent'
