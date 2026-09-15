import React from 'react'

import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/utils/twUtils'

export type SurfaceVariant = 'default' | 'card' | 'raised' | 'subtle' | 'inset'
export type SurfacePadding = 'none' | 'sm' | 'md' | 'lg'

const surfaceVariants = cva('border border-solid border-border text-foreground', {
  variants: {
    variant: {
      default: 'rounded-card bg-surface-default',
      card: 'rounded-card bg-card',
      raised: 'core-surface-raised rounded-card bg-surface-raised',
      subtle: 'rounded-card bg-surface-subtle',
      inset: 'rounded-card bg-surface-inset'
    },
    padding: {
      none: 'p-0',
      sm: 'p-[var(--core-spacing-sm)]',
      md: 'p-[var(--core-spacing-md)]',
      lg: 'p-[var(--core-spacing-xl)]'
    }
  },
  defaultVariants: {
    variant: 'card',
    padding: 'md'
  }
})

export type SurfaceProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof surfaceVariants> & {
    asChild?: boolean
    variant?: SurfaceVariant
    padding?: SurfacePadding
  }

export const Surface = React.forwardRef<HTMLDivElement, SurfaceProps>(
  (
    {
      asChild = false,
      className,
      padding = 'md',
      variant = 'card',
      ...props
    },
    ref
  ) => {
    const Component = asChild ? Slot : 'div'

    return (
      <Component
        ref={ref}
        className={cn(surfaceVariants({ variant, padding }), className)}
        {...props}
      />
    )
  }
)

Surface.displayName = 'Surface'

export type SectionProps = React.HTMLAttributes<HTMLElement> & {
  title?: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
}

export const Section = ({
  actions,
  children,
  className,
  description,
  title,
  ...props
}: SectionProps) => (
  <section
    className={cn('grid gap-[var(--core-spacing-md)]', className)}
    {...props}
  >
    {(title || description || actions) && (
      <div className='grid gap-[var(--core-spacing-xs)]'>
        {title && (
          <div className='flex items-center justify-between gap-[var(--core-spacing-sm)]'>
            <Heading level={2}>{title}</Heading>
            {actions}
          </div>
        )}
        {description && <Text tone='secondary'>{description}</Text>}
      </div>
    )}
    {children}
  </section>
)

export type TextTone = 'primary' | 'secondary' | 'muted' | 'danger' | 'success'
export type TextSize = 'xs' | 'sm' | 'md' | 'lg'

const textVariants = cva('m-0 font-suisse', {
  variants: {
    tone: {
      primary: 'text-foreground',
      secondary: 'text-text-secondary',
      muted: 'text-muted-foreground',
      danger: 'text-[var(--core-color-text-danger)]',
      success: 'text-[var(--core-color-text-success)]'
    },
    size: {
      // Semantic type roles mapped in tailwind.config.js (fontSize) — never
      // consume `--core-font-size-*` via arbitrary `text-[var()]` values:
      // Tailwind parses a bare var() as a *color* and silently drops the size.
      xs: 'text-xs leading-4',
      sm: 'text-caption',
      md: 'text-body',
      lg: 'text-body-lg'
    }
  },
  defaultVariants: {
    tone: 'primary',
    size: 'md'
  }
})

export type TextProps = React.HTMLAttributes<HTMLParagraphElement> &
  VariantProps<typeof textVariants> & {
    tone?: TextTone
    size?: TextSize
  }

export const Text = React.forwardRef<HTMLParagraphElement, TextProps>(
  ({ className, size = 'md', tone = 'primary', ...props }, ref) => (
    <p
      ref={ref}
      className={cn(textVariants({ tone, size }), className)}
      {...props}
    />
  )
)

Text.displayName = 'Text'

export const MutedText = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <Text ref={ref} className={className} size='sm' tone='muted' {...props} />
))

MutedText.displayName = 'MutedText'

export type HeadingLevel = 1 | 2 | 3 | 4
export type HeadingProps = React.HTMLAttributes<HTMLHeadingElement> & {
  level?: HeadingLevel
}

const headingClasses: Record<HeadingLevel, string> = {
  1: 'text-3xl font-semibold leading-10 tracking-[-0.02em]',
  2: 'text-2xl font-semibold leading-8 tracking-[-0.015em]',
  3: 'text-lg font-semibold leading-7 tracking-[-0.01em]',
  4: 'text-sm font-semibold leading-5'
}

export const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ className, level = 2, ...props }, ref) => {
    const Component = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4'

    return (
      <Component
        ref={ref}
        className={cn(
          'm-0 font-suisse text-foreground',
          headingClasses[level],
          className
        )}
        {...props}
      />
    )
  }
)

Heading.displayName = 'Heading'

export const LabelText = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      'block text-[13px] font-semibold leading-5 text-foreground',
      className
    )}
    {...props}
  />
))

LabelText.displayName = 'LabelText'

export const HelperText = React.forwardRef<
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

HelperText.displayName = 'HelperText'

export const ErrorText = React.forwardRef<
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

ErrorText.displayName = 'ErrorText'

export const CodeText = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement>
>(({ className, ...props }, ref) => (
  <code
    ref={ref}
    className={cn(
      'rounded-md border border-border bg-surface-inset px-1.5 py-0.5',
      'font-mono text-xs leading-5 text-foreground',
      className
    )}
    {...props}
  />
))

CodeText.displayName = 'CodeText'
