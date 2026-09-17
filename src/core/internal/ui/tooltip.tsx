/**
 * shadcn/ui tooltip primitive (Radix substrate).
 *
 * Owned by the shadcn copy layer — see ./README.md. Product code must NOT
 * import this directly; consume the Middesk wrappers `Hint`, `HintProvider`,
 * and `HelpIcon` from `@/core` instead. Styling resolves against the
 * `--core-*` tokens defined under the `.core-theme` selector in
 * `src/core/theme.css`, so any consumer must render inside a `.core-theme`
 * ancestor (the `HintContent` wrapper scopes its own portaled content).
 */
import * as React from 'react'

import * as TooltipPrimitive from '@radix-ui/react-tooltip'

import { cn } from '@/utils/twUtils'

export const TooltipProvider = TooltipPrimitive.Provider
export const Tooltip = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger
export const TooltipArrow = TooltipPrimitive.Arrow

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, collisionPadding = 8, sideOffset = 8, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      avoidCollisions
      collisionPadding={collisionPadding}
      sideOffset={sideOffset}
      className={cn(
        'z-50 animate-fade-in rounded-popover',
        'bg-[var(--core-color-overlay-tooltip-bg)] text-[var(--core-color-overlay-tooltip-text)]',
        'shadow-elevation-popover',
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))

TooltipContent.displayName = TooltipPrimitive.Content.displayName
