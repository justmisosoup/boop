import React from 'react'

import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cva, type VariantProps } from 'class-variance-authority'
import { CircleHelp, Info } from 'lucide-react'

import { cn } from '@/utils/twUtils'

import {
  TooltipArrow,
  TooltipContent,
  TooltipProvider
} from './internal/ui/tooltip'

/**
 * Radix default is 700ms; dashboards lean dense and explanatory, so hints
 * answer faster. Override per-instance via `delayDuration` or for a whole
 * region via `HintProvider`.
 */
const DEFAULT_HINT_DELAY = 300

/**
 * Radix Tooltip.Root throws without a Provider ancestor, but per-instance
 * providers defeat skip-delay grouping. This context lets `Hint` detect an
 * app/region-level `HintProvider` and only fall back to a local provider
 * when none exists.
 */
const HintProviderContext = React.createContext(false)

export type HintProviderProps = React.ComponentPropsWithoutRef<
  typeof TooltipPrimitive.Provider
>

/**
 * Optional region-level provider. Mount once around a route or layout so
 * moving between adjacent hints skips the open delay (Radix grouping).
 * `Hint` works standalone without it.
 */
export const HintProvider = ({
  delayDuration = DEFAULT_HINT_DELAY,
  skipDelayDuration = 300,
  ...props
}: HintProviderProps) => (
  <HintProviderContext.Provider value>
    <TooltipProvider
      delayDuration={delayDuration}
      skipDelayDuration={skipDelayDuration}
      {...props}
    />
  </HintProviderContext.Provider>
)

export type HintTriggerProps = React.ComponentPropsWithoutRef<
  typeof TooltipPrimitive.Trigger
> & {
  /**
   * Dashed-underline affordance signalling "this text reveals a definition
   * on hover." Use it whenever prose or metadata text is a hint trigger —
   * without it, readers have no way to know the text is hoverable.
   */
  underline?: boolean
}

/**
 * Tooltip trigger. Renders a reset, inline button by default; pass `asChild`
 * to make an existing interactive element (e.g. ActionButton) the trigger
 * instead of nesting buttons.
 */
export const HintTrigger = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Trigger>,
  HintTriggerProps
>(
  (
    {
      asChild = false,
      className,
      type = 'button',
      underline = false,
      ...props
    },
    ref
  ) => (
    <TooltipPrimitive.Trigger
      ref={ref}
      asChild={asChild}
      type={asChild ? undefined : type}
      className={cn(
        !asChild && [
          // `w-fit` keeps the invisible trigger button shrink-wrapped to its
          // content — grid/flex parents would otherwise stretch it, anchoring
          // the tooltip to empty space instead of the visible trigger.
          'w-fit max-w-full cursor-default rounded-xxs border-0 bg-transparent p-0 text-left',
          '[color:inherit] [font:inherit] [letter-spacing:inherit] [text-transform:inherit]',
          'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--core-color-focus-ring)] focus-visible:ring-offset-1'
        ],
        underline &&
          'underline decoration-dashed decoration-1 underline-offset-4',
        className
      )}
      {...props}
    />
  )
)

HintTrigger.displayName = 'HintTrigger'

// Tooltips are the topmost transient layer: they sit above Dialog/Drawer
// overlays (z-1100) and match Popover (z-1200) so a Hint inside a drawer or
// dialog is never occluded — overrides the internal tooltip's default z-50.
const hintContentVariants = cva(['core-theme core-hint-content z-[1200]'], {
  variants: {
    size: {
      compact: 'text-xs leading-4',
      standard: 'text-sm leading-5'
    }
  },
  defaultVariants: {
    size: 'standard'
  }
})

const hintScrollViewportVariants = cva(['core-hint-scroll-viewport'], {
  variants: {
    size: {
      compact: 'px-2.5 py-1.5',
      standard: 'px-3 py-2'
    }
  },
  defaultVariants: {
    size: 'standard'
  }
})

export type HintSide = 'top' | 'right' | 'bottom' | 'left'
export type HintAlign = 'start' | 'center' | 'end'

export type HintContentProps = React.ComponentPropsWithoutRef<
  typeof TooltipPrimitive.Content
> &
  VariantProps<typeof hintContentVariants> & {
    /** Whether to render the pointer arrow. */
    arrow?: boolean
    /** Max width of the overlay in px. */
    maxWidth?: number
    /**
     * Portaled content cannot inherit a scoped `.core-theme[data-theme]` root.
     * Pass `themeMode` when rendering a hint inside an explicit dark/light specimen.
     */
    themeMode?: 'light' | 'dark'
  }

export const HintContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  HintContentProps
>(
  (
    {
      arrow = true,
      children,
      className,
      maxWidth = 320,
      size = 'standard',
      style,
      themeMode,
      ...props
    },
    ref
  ) => {
    const { maxHeight, ...contentStyle } = style ?? {}

    return (
      <TooltipContent
        ref={ref}
        className={cn(hintContentVariants({ size }), className)}
        data-size={size}
        data-theme={themeMode}
        style={{
          maxWidth,
          ...contentStyle
        }}
        {...props}
      >
        <div
          className={cn(
            hintScrollViewportVariants({ size }),
            'overflow-y-auto overscroll-contain'
          )}
          style={{
            maxHeight:
              maxHeight ?? 'var(--radix-tooltip-content-available-height)'
          }}
        >
          {children}
        </div>
        {arrow && (
          <TooltipArrow
            aria-hidden='true'
            className='fill-[var(--core-color-overlay-tooltip-bg)]'
          />
        )}
      </TooltipContent>
    )
  }
)

HintContent.displayName = 'HintContent'

export type HintProps = React.ComponentPropsWithoutRef<
  typeof TooltipPrimitive.Root
> &
  Pick<
    HintContentProps,
    'align' | 'arrow' | 'maxWidth' | 'side' | 'size' | 'themeMode'
  > & {
    /**
     * Tooltip body for the simple API: `<Hint content='…'>trigger</Hint>`.
     * Omit it to compose `HintTrigger`/`HintContent` manually as children.
     */
    content?: React.ReactNode
    /** Forwarded to `HintTrigger` in the simple API. */
    asChild?: boolean
    /** Forwarded to `HintTrigger` in the simple API: dashed hover affordance. */
    underline?: boolean
  }

/**
 * Text-first hover/focus hint. Content must not contain interactive elements
 * (links, buttons) — tooltips dismiss on hover-out and their content is
 * unreachable by keyboard. Reach for a popover pattern instead when content
 * needs interaction.
 */
export const Hint = ({
  align,
  arrow,
  asChild = false,
  children,
  content,
  maxWidth,
  side,
  size,
  themeMode,
  underline,
  ...rootProps
}: HintProps) => {
  const hasProvider = React.useContext(HintProviderContext)

  const root = (
    <TooltipPrimitive.Root {...rootProps}>
      {content === undefined ? (
        children
      ) : (
        <>
          <HintTrigger asChild={asChild} underline={underline}>
            {children}
          </HintTrigger>
          <HintContent
            align={align}
            arrow={arrow}
            maxWidth={maxWidth}
            side={side}
            size={size}
            themeMode={themeMode}
          >
            {content}
          </HintContent>
        </>
      )}
    </TooltipPrimitive.Root>
  )

  if (hasProvider) {
    return root
  }

  return (
    <TooltipProvider delayDuration={DEFAULT_HINT_DELAY}>{root}</TooltipProvider>
  )
}

const helpIconVariants = cva(
  [
    'inline-flex shrink-0 cursor-help items-center justify-center rounded-full border-0 bg-transparent p-0 align-middle',
    'text-[var(--core-color-text-secondary)] transition-colors',
    'hover:text-[var(--core-color-text-primary)]',
    'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--core-color-focus-ring)] focus-visible:ring-offset-1'
  ],
  {
    variants: {
      size: {
        compact: '[&_svg]:size-3.5',
        standard: '[&_svg]:size-4'
      }
    },
    defaultVariants: {
      size: 'standard'
    }
  }
)

export type HelpIconProps = Pick<
  HintContentProps,
  'align' | 'maxWidth' | 'side' | 'themeMode'
> &
  VariantProps<typeof helpIconVariants> & {
    /** Explanatory hint body. Text-first; no interactive content. */
    content: React.ReactNode
    /** Glyph inside the trigger. */
    glyph?: 'question' | 'info'
    /** Accessible name for the icon-only trigger. */
    label?: string
    className?: string
  }

/**
 * Icon-only "what is this?" trigger for field labels, table headers, and
 * stat titles. Unlike the legacy `TooltipIcon`, it is a named, keyboard
 * focusable button and deliberately does not navigate — pair it with a
 * visible `ActionLink` when a hint needs a "learn more" destination.
 */
export const HelpIcon = ({
  align,
  className,
  content,
  glyph = 'question',
  label = 'More information',
  maxWidth,
  side,
  size = 'standard',
  themeMode
}: HelpIconProps) => {
  const Glyph = glyph === 'info' ? Info : CircleHelp

  return (
    <Hint>
      <HintTrigger asChild>
        <button
          aria-label={label}
          className={cn(helpIconVariants({ size }), className)}
          type='button'
        >
          <Glyph aria-hidden='true' />
        </button>
      </HintTrigger>
      <HintContent
        align={align}
        maxWidth={maxWidth}
        side={side}
        themeMode={themeMode}
      >
        {content}
      </HintContent>
    </Hint>
  )
}
