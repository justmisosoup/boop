import React from 'react'

import { cva } from 'class-variance-authority'
import { X } from 'lucide-react'

import { cn } from '@/utils/twUtils'

/**
 * `Tag` is the interactive sibling of `Badge`. A `Badge`/`MetaChip` is a
 * **static** status/metadata label and must never look actionable; a `Tag` is a
 * compact label that can carry an affordance — today, a remove control — and is
 * the primitive for multi-select tokens (e.g. the `Combobox` selections) and
 * filter pills. Keep status semantics on `Badge`; reach for `Tag` the moment the
 * label needs to be removed/acted on.
 *
 * Tones: `default` is a crisp white pill with dark text (the resting tag);
 * `subtle` is the soft gray fill; `info`/`success`/`warning`/`danger` borrow the
 * shared status palette for the rare colored tag.
 */
export type TagTone =
  | 'default'
  | 'subtle'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'

export type TagSize = 'compact' | 'standard'

const tagVariants = cva(
  [
    'core-tag inline-flex max-w-full items-center gap-1 whitespace-nowrap',
    'rounded-pill border border-solid font-medium leading-none',
    'bg-[var(--core-tag-bg)] text-[var(--core-tag-fg)] border-[var(--core-tag-border)]'
  ],
  {
    variants: {
      size: {
        compact: 'text-caption py-0.5',
        standard: 'text-dense py-1'
      },
      removable: {
        true: '',
        false: ''
      }
    },
    compoundVariants: [
      { size: 'compact', removable: false, class: 'px-2' },
      { size: 'compact', removable: true, class: 'pl-2 pr-1' },
      { size: 'standard', removable: false, class: 'px-2.5' },
      { size: 'standard', removable: true, class: 'pl-2.5 pr-1.5' }
    ],
    defaultVariants: { size: 'compact', removable: false }
  }
)

// Each tone maps to a (bg, fg, border) triple of `--core-color-*` tokens. The
// `default` white pill uses surface/text/border tokens; the rest use the status
// palette. Consumed via the `--core-tag-*` indirection the contract allowlists.
const TAG_TONE_TOKENS: Record<TagTone, [string, string, string]> = {
  default: ['surface-default', 'text-primary', 'border-default'],
  subtle: ['status-neutral-bg', 'status-neutral-fg', 'status-neutral-border'],
  info: ['status-info-bg', 'status-info-fg', 'status-info-border'],
  success: ['status-success-bg', 'status-success-fg', 'status-success-border'],
  warning: ['status-warning-bg', 'status-warning-fg', 'status-warning-border'],
  danger: ['status-danger-bg', 'status-danger-fg', 'status-danger-border']
}

const tagStyle = (tone: TagTone) => {
  const [bg, fg, border] = TAG_TONE_TOKENS[tone]

  return {
    '--core-tag-bg': `var(--core-color-${bg})`,
    '--core-tag-fg': `var(--core-color-${fg})`,
    '--core-tag-border': `var(--core-color-${border})`
  } as React.CSSProperties
}

export type TagProps = Omit<
  React.HTMLAttributes<HTMLSpanElement>,
  'children'
> & {
  children: React.ReactNode
  tone?: TagTone
  size?: TagSize
  /** Optional leading visual (e.g. a lucide icon); decorative. */
  icon?: React.ReactNode
  /** When set, renders a trailing remove (×) button. */
  onRemove?: () => void
  /** Accessible label for the remove button (e.g. `Remove order.updated`). */
  removeLabel?: string
  disabled?: boolean
}

export const Tag = React.forwardRef<HTMLSpanElement, TagProps>(
  (
    {
      children,
      className,
      disabled = false,
      icon,
      onRemove,
      removeLabel = 'Remove',
      size = 'compact',
      style,
      tone = 'default',
      ...props
    },
    ref
  ) => (
    <span
      ref={ref}
      className={cn(tagVariants({ removable: !!onRemove, size }), className)}
      style={{ ...tagStyle(tone), ...style }}
      {...props}
    >
      {icon && (
        <span aria-hidden='true' className='flex shrink-0 items-center'>
          {icon}
        </span>
      )}
      <span className='min-w-0 truncate'>{children}</span>
      {onRemove && (
        <button
          aria-label={removeLabel}
          className={cn(
            'flex shrink-0 items-center justify-center rounded-pill text-inherit opacity-70 transition-opacity',
            size === 'compact' ? 'size-3.5' : 'size-4',
            disabled
              ? 'pointer-events-none opacity-40'
              : 'hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-hidden'
          )}
          disabled={disabled}
          onClick={onRemove}
          type='button'
        >
          <X
            aria-hidden='true'
            className={size === 'compact' ? 'size-3' : 'size-3.5'}
          />
        </button>
      )}
    </span>
  )
)

Tag.displayName = 'Tag'
