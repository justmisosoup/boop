import React from 'react'

import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/utils/twUtils'

export type FieldProps = React.HTMLAttributes<HTMLDivElement> & {
  isDisabled?: boolean
  isInvalid?: boolean
}

export const Field = React.forwardRef<HTMLDivElement, FieldProps>(
  ({ className, isDisabled = false, isInvalid = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('grid content-start gap-1.5', className)}
      data-disabled={isDisabled || undefined}
      data-invalid={isInvalid || undefined}
      {...props}
    />
  )
)

Field.displayName = 'Field'

export const FieldLabel = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      'text-[13px] font-semibold leading-5 text-foreground',
      'data-[disabled=true]:text-[var(--core-color-control-disabled-fg)]',
      className
    )}
    {...props}
  />
))

FieldLabel.displayName = 'FieldLabel'

export const FieldDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn(
      'm-0 text-xs leading-5 text-[var(--core-color-control-helper-text)]',
      className
    )}
    {...props}
  />
))

FieldDescription.displayName = 'FieldDescription'

export const FieldError = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn(
      'm-0 text-xs leading-5 text-[var(--core-color-control-error-fg)]',
      className
    )}
    {...props}
  />
))

FieldError.displayName = 'FieldError'

export const inputVariants = cva(
  [
    'core-input flex w-full appearance-none border border-solid shadow-none',
    'bg-[var(--core-color-control-bg)] text-[var(--core-color-control-fg)]',
    'transition-colors',
    'placeholder:text-[var(--core-color-control-placeholder)]',
    'hover:border-[var(--core-color-control-border-hover)]',
    'focus-visible:border-[var(--core-color-control-border-focus)]',
    'focus-visible:outline-hidden',
    'disabled:cursor-not-allowed',
    'disabled:border-[var(--core-color-control-border)]',
    'disabled:bg-[var(--core-color-control-disabled-bg)]',
    'disabled:text-[var(--core-color-control-disabled-fg)]',
    'aria-[invalid=true]:border-[var(--core-color-control-error-border)]',
    'aria-[invalid=true]:bg-[var(--core-color-control-bg)]'
  ],
  {
    variants: {
      size: {
        compact:
          'min-h-8 rounded-control px-3 py-1.5 text-sm leading-5',
        standard:
          'min-h-10 rounded-control px-3 py-2 text-sm leading-5'
      }
    },
    defaultVariants: {
      size: 'standard'
    }
  }
)

export type InputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'size'
> &
  VariantProps<typeof inputVariants>

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, size = 'standard', ...props }, ref) => (
    <input
      ref={ref}
      className={cn(inputVariants({ size }), className)}
      {...props}
    />
  )
)

Input.displayName = 'Input'

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> &
  VariantProps<typeof inputVariants>

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, size = 'standard', ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(inputVariants({ size }), 'min-h-24 resize-y', className)}
      {...props}
    />
  )
)

Textarea.displayName = 'Textarea'
