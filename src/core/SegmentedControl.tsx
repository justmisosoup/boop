import React from 'react'

import * as ToggleGroup from '@radix-ui/react-toggle-group'
import { type VariantProps, cva } from 'class-variance-authority'

import { cn } from '@/utils/twUtils'

/**
 * A single-select segmented control — a connected row of segments where exactly
 * one is always active. Built on Radix `ToggleGroup` (`type="single"`) for
 * roving focus, arrow-key navigation, and proper grouping semantics; styled on
 * the `--core-*` foundation tokens.
 *
 * Unlike a raw toggle group it is **non-deselectable**: re-pressing the active
 * segment is a no-op (a filter/view switcher always keeps one choice). Use it
 * for status filters, saved views, density toggles, and similar "pick one of a
 * few" controls. Pair with lucide icons via the item `icon` prop.
 */
export type SegmentedControlSize = 'sm' | 'md'

// A fully-rounded "pill" track + pill segments (cf. iOS/macOS segmented
// controls). A thin sunken well shows around the raised active tile (the
// 4px inter-segment `gap` carries most of the segmented read, so the edge
// padding can stay tight). Outer heights sit on the shared control scale —
// sm = 32px (compact) and md = 36px (standard) — so the control lines up with
// `Input`/`ActionButton`/`SearchInput` in a filter toolbar.
const trackVariants = cva(
  'inline-flex w-fit items-center gap-1 rounded-pill bg-[var(--core-color-surface-sunken)]',
  {
    variants: {
      size: { sm: 'p-0.5', md: 'p-0.5' }
    },
    defaultVariants: { size: 'md' }
  }
)

const itemVariants = cva(
  [
    'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-pill font-medium',
    // `!` beats the app's unlayered `button { padding: 0; color: inherit }`
    // reset, which otherwise clobbers padding + text colour on a <button> and
    // leaves the control cramped with no active/inactive colour contrast.
    '!text-muted-foreground transition-[background-color,box-shadow,color] duration-150 hover:!text-foreground',
    // Active segment: a raised white pill — fill + soft lift + weight — so it
    // reads clearly against the sunken track without a heavy border.
    'data-[state=on]:bg-[var(--core-color-surface-card)] data-[state=on]:font-semibold data-[state=on]:!text-foreground data-[state=on]:shadow-elevation-control',
    'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--core-color-focus-ring)]',
    'disabled:pointer-events-none disabled:opacity-50'
  ],
  {
    variants: {
      size: { sm: 'h-7 !px-3.5 text-xs', md: 'h-8 !px-5 text-sm' }
    },
    defaultVariants: { size: 'md' }
  }
)

const SegmentedControlSizeContext =
  React.createContext<SegmentedControlSize>('md')

export type SegmentedControlProps = {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
  className?: string
  children?: React.ReactNode
  'aria-label'?: string
  'aria-labelledby'?: string
} & VariantProps<typeof trackVariants>

export const SegmentedControl = React.forwardRef<
  React.ElementRef<typeof ToggleGroup.Root>,
  SegmentedControlProps
>(({ className, onValueChange, size = 'md', ...props }, ref) => (
  <SegmentedControlSizeContext.Provider value={size ?? 'md'}>
    <ToggleGroup.Root
      ref={ref}
      className={cn(trackVariants({ size }), className)}
      type='single'
      // Keep one segment always selected: Radix emits '' when the active item
      // is re-pressed, so swallow the empty value instead of clearing.
      onValueChange={value => {
        if (value) onValueChange?.(value)
      }}
      {...props}
    />
  </SegmentedControlSizeContext.Provider>
))

SegmentedControl.displayName = 'SegmentedControl'

export type SegmentedControlItemProps = React.ComponentPropsWithoutRef<
  typeof ToggleGroup.Item
> & {
  /** Optional leading lucide icon (size it yourself, e.g. `<Check size={14} />`). */
  icon?: React.ReactNode
}

export const SegmentedControlItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroup.Item>,
  SegmentedControlItemProps
>(({ children, className, icon, ...props }, ref) => {
  const size = React.useContext(SegmentedControlSizeContext)

  return (
    <ToggleGroup.Item
      ref={ref}
      className={cn(itemVariants({ size }), className)}
      {...props}
    >
      {icon}
      {children}
    </ToggleGroup.Item>
  )
})

SegmentedControlItem.displayName = 'SegmentedControlItem'
