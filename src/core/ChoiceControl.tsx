import React from 'react'

import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import { Check, Minus } from 'lucide-react'

import { cn } from '@/utils/twUtils'

// `items-start` (not `items-center`) so a control with a multi-line
// description stays aligned to the first line. The single-line case is kept
// centered by `choiceControlBoxClass` below.
const choiceRootClass = [
  'core-choice-root inline-flex cursor-pointer items-start gap-2 text-sm leading-5 text-foreground'
]

// Wraps the control in a box exactly as tall as the label's line-height
// (`--core-spacing-lg`) and centers the control within it. This optically
// centers the control on the label's FIRST line — robust to font metrics and
// to descriptions that wrap, without per-control margin hacks (which the
// scoped `.core-*-control` rules would override anyway).
const choiceControlBoxClass =
  'inline-flex h-[var(--core-spacing-lg)] shrink-0 items-center'

const checkboxControlClass = [
  'core-checkbox-control flex size-4 shrink-0 items-center justify-center',
  'rounded-control outline-hidden transition-colors'
]

const radioControlClass = [
  'core-radio-control flex size-4 shrink-0 items-center justify-center',
  'rounded-pill outline-hidden transition-colors'
]

type RadioGroupContextValue = {
  isDisabled: boolean
  isInvalid: boolean
}

const RadioGroupContext = React.createContext<RadioGroupContextValue>({
  isDisabled: false,
  isInvalid: false
})

const useChoiceIds = () => {
  const id = React.useId()

  return { labelId: `${id}-label`, descriptionId: `${id}-description` }
}

type ChoiceTextProps = {
  children?: React.ReactNode
  description?: React.ReactNode
  descriptionId: string
  labelId: string
}

/**
 * Renders the label and, when present, the helper text beneath it. When a
 * description is shown the label/description get stable ids so the control can
 * reference them via `aria-labelledby`/`aria-describedby` — keeping the
 * accessible name the label alone while announcing the description separately.
 */
const ChoiceText = ({
  children,
  description,
  descriptionId,
  labelId
}: ChoiceTextProps) => {
  if (!description) {
    return children ? (
      <span className='core-choice-label'>{children}</span>
    ) : null
  }

  return (
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
  )
}

export type CheckboxProps = Omit<
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>,
  'asChild' | 'checked' | 'className'
> & {
  checked?: boolean
  children?: React.ReactNode
  className?: string
  /**
   * Optional helper text rendered beneath the label. When set, the control
   * stays aligned to the label's first line and the text is wired as the
   * control's accessible description (the accessible name stays the label).
   */
  description?: React.ReactNode
  indeterminate?: boolean
  isInvalid?: boolean
}

export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(
  (
    {
      children,
      className,
      checked,
      description,
      indeterminate = false,
      isInvalid = false,
      ...props
    },
    ref
  ) => {
    const { descriptionId, labelId } = useChoiceIds()

    return (
      <label
        className={cn(choiceRootClass, className)}
        data-disabled={props.disabled || undefined}
        data-invalid={isInvalid || undefined}
      >
        <span className={choiceControlBoxClass}>
          <CheckboxPrimitive.Root
            ref={ref}
            aria-describedby={description ? descriptionId : undefined}
            aria-invalid={isInvalid || undefined}
            aria-labelledby={description ? labelId : undefined}
            checked={indeterminate ? 'indeterminate' : checked}
            className={cn(checkboxControlClass)}
            {...props}
          >
            <CheckboxPrimitive.Indicator asChild forceMount>
              <span aria-hidden='true' className='core-checkbox-indicator'>
                <Check className='core-checkbox-check size-3' />
                <Minus className='core-checkbox-minus size-3' />
              </span>
            </CheckboxPrimitive.Indicator>
          </CheckboxPrimitive.Root>
        </span>
        <ChoiceText
          description={description}
          descriptionId={descriptionId}
          labelId={labelId}
        >
          {children}
        </ChoiceText>
      </label>
    )
  }
)

Checkbox.displayName = 'Checkbox'

export type RadioGroupProps = Omit<
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>,
  'className'
> & {
  className?: string
  isInvalid?: boolean
}

export const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  RadioGroupProps
>(({ className, disabled = false, isInvalid = false, ...props }, ref) => (
  <RadioGroupContext.Provider value={{ isDisabled: disabled, isInvalid }}>
    <RadioGroupPrimitive.Root
      ref={ref}
      aria-invalid={isInvalid || undefined}
      className={cn('core-radio-group grid gap-2', className)}
      data-invalid={isInvalid || undefined}
      disabled={disabled}
      {...props}
    />
  </RadioGroupContext.Provider>
))

RadioGroup.displayName = 'RadioGroup'

export type RadioItemProps = Omit<
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>,
  'asChild' | 'className'
> & {
  children?: React.ReactNode
  className?: string
  /**
   * Optional helper text rendered beneath the label. When set, the radio
   * top-aligns with the label and the text is wired as the control's
   * accessible description (the accessible name stays the label alone).
   */
  description?: React.ReactNode
  isInvalid?: boolean
}

export const RadioItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  RadioItemProps
>(function RadioItem(
  {
    children,
    className,
    description,
    disabled,
    isInvalid = false,
    ...props
  },
  ref
) {
  const groupContext = React.useContext(RadioGroupContext)
  const resolvedIsDisabled = disabled || groupContext.isDisabled
  const resolvedIsInvalid = isInvalid || groupContext.isInvalid
  const { descriptionId, labelId } = useChoiceIds()

  return (
    <label
      className={cn(choiceRootClass, className)}
      data-disabled={resolvedIsDisabled || undefined}
      data-invalid={resolvedIsInvalid || undefined}
    >
      <span className={choiceControlBoxClass}>
        <RadioGroupPrimitive.Item
          ref={ref}
          aria-describedby={description ? descriptionId : undefined}
          aria-invalid={resolvedIsInvalid || undefined}
          aria-labelledby={description ? labelId : undefined}
          className={cn(radioControlClass)}
          disabled={resolvedIsDisabled}
          {...props}
        >
          <RadioGroupPrimitive.Indicator asChild forceMount>
            <span aria-hidden='true' className='core-radio-indicator'>
              <span className='core-radio-dot' />
            </span>
          </RadioGroupPrimitive.Indicator>
        </RadioGroupPrimitive.Item>
      </span>
      <ChoiceText
        description={description}
        descriptionId={descriptionId}
        labelId={labelId}
      >
        {children}
      </ChoiceText>
    </label>
  )
})

RadioItem.displayName = 'RadioItem'
