import React from 'react'

import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import {
  Link as RouterLink,
  type LinkProps as RouterLinkProps
} from 'react-router'

import { cn } from '@/utils/twUtils'

export type ActionVariant = 'primary' | 'secondary' | 'quiet' | 'destructive'
export type ActionSize = 'compact' | 'standard'

const actionVariants = cva(
  [
    'core-action inline-flex appearance-none items-center justify-center',
    'whitespace-nowrap border border-solid font-medium leading-none',
    'no-underline transition-colors',
    'focus-visible:outline-hidden',
    'disabled:cursor-not-allowed disabled:opacity-60',
    'aria-disabled:cursor-not-allowed aria-disabled:opacity-60'
  ],
  {
    variants: {
      variant: {
        primary: 'core-action-primary',
        secondary: 'core-action-secondary',
        quiet: 'core-action-quiet',
        destructive: 'core-action-destructive'
      },
      size: {
        compact: 'core-action-compact',
        standard: 'core-action-standard'
      }
    },
    defaultVariants: {
      variant: 'primary',
      size: 'compact'
    }
  }
)

const iconActionVariants = cva('core-icon-action', {
  variants: {
    size: {
      compact: 'core-icon-action-compact',
      standard: 'core-icon-action-standard'
    }
  },
  defaultVariants: {
    size: 'compact'
  }
})

const Spinner = ({ className }: { className?: string }) => (
  <span
    aria-hidden='true'
    className={cn(
      'core-action-spinner inline-block rounded-full',
      'border border-current border-r-transparent',
      // The ring was static — `.core-action-spinner` only sets its size. Spin
      // it (motion-safe so reduced-motion users get a still ring + aria-busy).
      'motion-safe:animate-spin',
      className
    )}
  />
)

export type ActionButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof actionVariants> & {
    asChild?: boolean
    variant?: ActionVariant
    size?: ActionSize
    isLoading?: boolean
    leadingIcon?: React.ReactNode
    trailingIcon?: React.ReactNode
    /**
     * Set when a `quiet` action sits on a surface with its own hover state (e.g.
     * a clickable table row), where its hover tint would otherwise be invisible.
     * Swaps in a stronger hover background.
     */
    onInteractiveSurface?: boolean
  }

export const ActionButton = React.forwardRef<
  HTMLButtonElement,
  ActionButtonProps
>(
  (
    {
      asChild = false,
      children,
      className,
      disabled,
      isLoading = false,
      leadingIcon,
      onInteractiveSurface = false,
      size = 'compact',
      trailingIcon,
      type = 'button',
      variant = 'primary',
      ...props
    },
    ref
  ) => {
    const Component = asChild ? Slot : 'button'

    return (
      <Component
        ref={ref}
        aria-busy={isLoading || undefined}
        className={cn(
          actionVariants({ variant, size }),
          onInteractiveSurface && 'core-action-on-surface',
          className
        )}
        disabled={!asChild ? disabled || isLoading : undefined}
        type={!asChild ? type : undefined}
        {...props}
      >
        {isLoading ? <Spinner /> : leadingIcon}
        {children}
        {trailingIcon}
      </Component>
    )
  }
)

ActionButton.displayName = 'ActionButton'

export type IconActionButtonProps = Omit<ActionButtonProps, 'children'> & {
  'aria-label': string
  children: React.ReactNode
}

export const IconActionButton = React.forwardRef<
  HTMLButtonElement,
  IconActionButtonProps
>(
  (
    {
      children,
      className,
      disabled,
      isLoading = false,
      size = 'compact',
      type = 'button',
      variant = 'secondary',
      ...props
    },
    ref
  ) => (
    <ActionButton
      ref={ref}
      className={cn(iconActionVariants({ size }), className)}
      disabled={disabled || isLoading}
      isLoading={isLoading}
      size={size}
      type={type}
      variant={variant}
      {...props}
    >
      {isLoading ? null : children}
    </ActionButton>
  )
)

IconActionButton.displayName = 'IconActionButton'

type ActionLinkSharedProps = Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  'href'
> &
  VariantProps<typeof actionVariants> & {
    variant?: ActionVariant
    size?: ActionSize
    leadingIcon?: React.ReactNode
    trailingIcon?: React.ReactNode
  }

export type ActionLinkProps = ActionLinkSharedProps &
  (
    | { href: string; to?: never }
    | { href?: never; to: RouterLinkProps['to'] }
  )

export const ActionLink = ({
  children,
  className,
  href,
  leadingIcon,
  size = 'compact',
  to,
  trailingIcon,
  variant = 'secondary',
  ...props
}: ActionLinkProps) => {
  const classes = cn(actionVariants({ variant, size }), className)

  if (to) {
    return (
      <RouterLink className={classes} to={to} {...props}>
        {leadingIcon}
        {children}
        {trailingIcon}
      </RouterLink>
    )
  }

  return (
    <a className={classes} href={href} {...props}>
      {leadingIcon}
      {children}
      {trailingIcon}
    </a>
  )
}
