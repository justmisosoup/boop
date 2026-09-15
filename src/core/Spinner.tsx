import React from 'react'

import { cva, type VariantProps } from 'class-variance-authority'
import { LoaderCircle } from 'lucide-react'

import { cn } from '@/utils/twUtils'

export type SpinnerSize = 'sm' | 'md' | 'lg'
export type SpinnerTone = 'current' | 'muted'

// Size + tone live on the glyph. Sizes map to the type scale rather than px
// literals (sm 12 / md 16 / lg 28). The underlying tokens are picked for visual
// size, not name parity: md → --core-font-size-lg (16px), deliberately skipping
// the 14px step, which sits too close to sm. `current` inherits `currentColor`
// so the spinner composes inside buttons, banners, and dark mode for free;
// `muted` recedes to secondary text. For an intent colour (success, danger, …)
// pass `className` with the token.
const spinnerGlyph = cva(
  // `motion-safe:` so reduced-motion users get a still glyph instead of a
  // spin — the role=status label still announces "Loading". (Inside .core-theme
  // the global reduced-motion rule also neutralises it; motion-safe keeps it
  // correct when rendered outside a theme boundary too.)
  'core-spinner-glyph shrink-0 motion-safe:animate-spin',
  {
    variants: {
      size: {
        sm: 'h-[var(--core-font-size-sm)] w-[var(--core-font-size-sm)]',
        md: 'h-[var(--core-font-size-lg)] w-[var(--core-font-size-lg)]',
        lg: 'h-[var(--core-font-size-xl)] w-[var(--core-font-size-xl)]'
      },
      tone: {
        current: '',
        muted: 'text-[var(--core-color-text-secondary)]'
      }
    },
    defaultVariants: {
      size: 'md',
      tone: 'current'
    }
  }
)

export type SpinnerProps = Omit<
  React.HTMLAttributes<HTMLSpanElement>,
  'children'
> &
  VariantProps<typeof spinnerGlyph> & {
    /**
     * Accessible name read by screen readers (the spinning glyph itself conveys
     * nothing). Defaults to "Loading". Pass `false` for a decorative spinner
     * with no status semantics — use it when the surrounding area already owns
     * the live region (e.g. many rows in one loading list, or a container with
     * its own aria-busy / role=status), so you don't emit N competing "Loading"
     * announcements.
     */
    label?: string | false
    size?: SpinnerSize
    tone?: SpinnerTone
  }

/**
 * Indeterminate activity indicator for short blocking actions and section
 * refreshes. Indeterminate by design — reach for `Skeleton` / `LoadingRegion`
 * for first-paint content shape, and `ActionButton`'s `isLoading` for buttons.
 *
 * `aria-busy` belongs on the content region being loaded (the panel/table),
 * not on the spinner — toggle it true→false around the fetch, as `DataTable`
 * and `LoadingRegion` do.
 */
export const Spinner = React.forwardRef<HTMLSpanElement, SpinnerProps>(
  (
    { className, label = 'Loading', size = 'md', tone = 'current', ...props },
    ref
  ) => {
    // A decorative spinner (label={false}) carries no status semantics — use it
    // when the surrounding region already owns the live announcement, so a list
    // of spinners doesn't fire N competing "Loading" updates. The status props
    // sit before {...props} so a consumer can still override them.
    const status =
      label === false
        ? {}
        : { role: 'status' as const, 'aria-live': 'polite' as const }

    return (
      <span
        ref={ref}
        className={cn('core-spinner inline-flex', className)}
        {...status}
        {...props}
      >
        <LoaderCircle
          aria-hidden='true'
          className={spinnerGlyph({ size, tone })}
          strokeWidth={2.5}
        />
        {label === false ? null : <span className='sr-only'>{label}</span>}
      </span>
    )
  }
)

Spinner.displayName = 'Spinner'
