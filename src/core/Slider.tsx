import React from 'react'

import * as SliderPrimitive from '@radix-ui/react-slider'

import { cn } from '@/utils/twUtils'

// Track + range + thumb geometry lives here; colors, focus ring, and disabled
// states live in the scoped `.core-slider-*` CSS (theme.css), matching the
// pattern used by Toggle/Switch (`.core-switch-*`).
const sliderRootClass =
  'core-slider-root relative flex h-5 w-full touch-none select-none items-center'

export type SliderProps = Omit<
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>,
  'asChild' | 'className' | 'value' | 'defaultValue' | 'onValueChange'
> & {
  /** Controlled single value. */
  value?: number
  /** Uncontrolled initial value. */
  defaultValue?: number
  onValueChange?: (value: number) => void
  className?: string
  'aria-label'?: string
  'aria-labelledby'?: string
}

/**
 * Single-thumb slider for choosing one value on a continuous range — a
 * confidence threshold, a weight, a percentage. Built on Radix `Slider`
 * (role="slider", arrow/Home/End keys, `aria-valuemin/max/now`), token-themed
 * for light and dark. Pass an accessible name via `aria-label`/`aria-labelledby`,
 * or pair with a visible label + numeric `Input` (see `ThresholdControl`).
 *
 * The public API is deliberately single-value; the Radix substrate stays
 * range-capable internally so a future two-thumb band control can extend it.
 */
export const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(
  (
    {
      value,
      defaultValue,
      onValueChange,
      className,
      min = 0,
      max = 100,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      ...props
    },
    ref
  ) => (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(sliderRootClass, className)}
      min={min}
      max={max}
      value={value != null ? [value] : undefined}
      defaultValue={defaultValue != null ? [defaultValue] : undefined}
      onValueChange={next => {
        const first = next[0]
        if (first != null) onValueChange?.(first)
      }}
      {...props}
    >
      <SliderPrimitive.Track className='core-slider-track'>
        <SliderPrimitive.Range className='core-slider-range' />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className='core-slider-thumb'
      />
    </SliderPrimitive.Root>
  )
)

Slider.displayName = 'Slider'
