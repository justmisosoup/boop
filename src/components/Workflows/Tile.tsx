import type React from 'react'

import { Check, type LucideIcon } from 'lucide-react'

import { cn } from '@/utils/twUtils'

export const Tile = ({
  title,
  subtitle,
  icon: Icon,
  checked,
  disabled,
  onToggle,
  ...rest
}: {
  title: string
  subtitle: string
  icon?: LucideIcon
  checked: boolean
  disabled: boolean
  onToggle: () => void
}) => (
  <button
    aria-checked={checked}
    className={cn(
      'flex h-full w-full flex-col items-start gap-1 rounded-card border bg-card p-4 text-left',
      'transition-[border-color] duration-fast',
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--core-color-focus-ring)]',
      checked
        ? 'border-[var(--core-color-action-primary-bg)] [box-shadow:inset_0_0_0_1px_var(--core-color-action-primary-bg)]'
        : 'border-border hover:border-[var(--core-color-border-bold)]',
      disabled && 'cursor-not-allowed opacity-50 hover:border-border'
    )}
    disabled={disabled}
    onClick={onToggle}
    role='checkbox'
    type='button'
    {...rest}
  >
    <span className='flex w-full items-start justify-between gap-3'>
      <span className='flex items-center gap-2'>
        {Icon && (
          <Icon
            aria-hidden='true'
            className='size-4 shrink-0 text-muted-foreground'
          />
        )}
        <span className='font-semibold text-foreground text-sm'>{title}</span>
      </span>
      {/* The slot is always there, so checking a tile never reflows its title. */}
      <span className='grid size-4 shrink-0 place-items-center text-[var(--core-color-action-primary-bg)]'>
        {checked && <Check aria-hidden='true' className='size-4' />}
      </span>
    </span>
    <span className='line-clamp-2 text-muted-foreground text-xs'>
      {subtitle}
    </span>
  </button>
)

export const TileGrid = ({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}) => (
  <div
    aria-label={label}
    className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'
    role='group'
  >
    {children}
  </div>
)
