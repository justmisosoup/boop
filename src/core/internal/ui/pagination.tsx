/**
 * shadcn/ui pagination primitive (Radix/Tailwind substrate).
 *
 * Owned by the shadcn copy layer — see ./README.md. Product code must NOT
 * import this directly; consume the Middesk wrapper `ListPagination` from
 * `@/core` instead. Styling resolves against the `--core-*` tokens defined
 * under the `.core-theme` selector in `src/core/theme.css`, so any consumer
 * must render inside a `.core-theme` ancestor.
 */
import type * as React from 'react'

import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'

import { cn } from '@/utils/twUtils'

const baseLink =
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50'

/** Shared class recipe (shadcn's buttonVariants analogue) for pagination links. */
export function paginationLinkVariants({
  isActive = false,
  size = 'icon'
}: {
  isActive?: boolean
  size?: 'icon' | 'default'
} = {}) {
  return cn(
    baseLink,
    isActive
      ? 'border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground'
      : 'hover:bg-accent hover:text-accent-foreground',
    size === 'icon' ? 'h-9 w-9' : 'h-9 px-3'
  )
}

export const Pagination = ({
  className,
  ...props
}: React.ComponentProps<'nav'>) => (
  <nav
    aria-label='pagination'
    className={cn('mx-auto flex w-full justify-center', className)}
    {...props}
  />
)

export const PaginationContent = ({
  className,
  ...props
}: React.ComponentProps<'ul'>) => (
  <ul
    className={cn('m-0 flex flex-row items-center gap-1 p-0', className)}
    {...props}
  />
)

export const PaginationItem = ({
  className,
  ...props
}: React.ComponentProps<'li'>) => (
  <li className={cn('list-none', className)} {...props} />
)

type PaginationLinkProps = {
  isActive?: boolean
  size?: 'icon' | 'default'
} & React.ComponentProps<'a'>

export const PaginationLink = ({
  className,
  isActive,
  size = 'icon',
  ...props
}: PaginationLinkProps) => (
  <a
    aria-current={isActive ? 'page' : undefined}
    className={cn(paginationLinkVariants({ isActive, size }), className)}
    {...props}
  />
)

export const PaginationPrevious = ({
  className,
  ...props
}: PaginationLinkProps) => (
  <PaginationLink
    aria-label='Go to previous page'
    size='default'
    className={cn('gap-1 pl-2.5', className)}
    {...props}
  >
    <ChevronLeft className='h-4 w-4' />
    <span>Previous</span>
  </PaginationLink>
)

export const PaginationNext = ({
  className,
  ...props
}: PaginationLinkProps) => (
  <PaginationLink
    aria-label='Go to next page'
    size='default'
    className={cn('gap-1 pr-2.5', className)}
    {...props}
  >
    <span>Next</span>
    <ChevronRight className='h-4 w-4' />
  </PaginationLink>
)

export const PaginationEllipsis = ({
  className,
  ...props
}: React.ComponentProps<'span'>) => (
  <span
    aria-hidden
    className={cn('flex h-9 w-9 items-center justify-center', className)}
    {...props}
  >
    <MoreHorizontal className='h-4 w-4' />
    <span className='sr-only'>More pages</span>
  </span>
)
