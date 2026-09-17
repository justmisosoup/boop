import React from 'react'

import * as SwitchPrimitive from '@radix-ui/react-switch'

import { cn } from '@/utils/twUtils'

// Shares the choice-control anatomy with Checkbox/Radio (`ChoiceControl.tsx`):
// the same `.core-choice-*` classes drive label/disabled styling, so Toggle
// reads as a sibling control. `items-start` keeps the control aligned to the
// label's first line when a description wraps.
const toggleRootClass = [
  'core-choice-root inline-flex cursor-pointer items-start gap-2 text-sm leading-5 text-foreground'
]

// A box exactly one label line-height tall, centering the track on the label's
// first line (matches `choiceControlBoxClass` in ChoiceControl).
const toggleControlBoxClass =
  'inline-flex h-[var(--core-spacing-lg)] shrink-0 items-center'

// Track geometry (20×36) lives here; colors, the thumb size/translate, focus
// ring, and state transitions live in the scoped `.core-switch-*` CSS.
const switchControlClass = [
  'core-switch-control inline-flex h-5 w-9 shrink-0 items-center rounded-full outline-hidden'
]

const useToggleIds = () => {
  const id = React.useId()

  return { labelId: `${id}-label`, descriptionId: `${id}-description` }
}

export type ToggleProps = Omit<
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>,
  'asChild' | 'className'
> & {
  children?: React.ReactNode
  className?: string
  /**
   * Optional helper text rendered beneath the label. When set, the text is
   * wired as the control's accessible description (the accessible name stays
   * the label alone).
   */
  description?: React.ReactNode
  isInvalid?: boolean
}

/**
 * On/off switch for immediate settings (it applies on change). Built on Radix
 * `Switch` (role="switch", Space/Enter, focus-visible), token-themed for light
 * and dark. For form selections that are submitted use `Checkbox`; for choosing
 * one of several options use `RadioGroup`/`RadioItem`.
 */
export const Toggle = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  ToggleProps
>(({ children, className, description, isInvalid = false, ...props }, ref) => {
  const { descriptionId, labelId } = useToggleIds()

  return (
    <label
      className={cn(toggleRootClass, className)}
      data-disabled={props.disabled || undefined}
      data-invalid={isInvalid || undefined}
    >
      <span className={toggleControlBoxClass}>
        <SwitchPrimitive.Root
          ref={ref}
          aria-describedby={description ? descriptionId : undefined}
          aria-invalid={isInvalid || undefined}
          aria-labelledby={description ? labelId : undefined}
          className={cn(switchControlClass)}
          {...props}
        >
          <SwitchPrimitive.Thumb className='core-switch-thumb' />
        </SwitchPrimitive.Root>
      </span>
      {description ? (
        <span className='grid gap-0.5'>
          <span className='core-choice-label' id={labelId}>
            {children}
          </span>
          <span
            className='text-xs leading-5 text-[var(--core-color-control-helper-text)]'
            id={descriptionId}
          >
            {description}
          </span>
        </span>
      ) : children ? (
        <span className='core-choice-label'>{children}</span>
      ) : null}
    </label>
  )
})

Toggle.displayName = 'Toggle'
