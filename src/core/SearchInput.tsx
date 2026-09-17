import React from 'react'

import { Search, X } from 'lucide-react'

import { cn } from '@/utils/twUtils'

import { Input, type InputProps } from './Field'
import { Spinner } from './Spinner'

/**
 * A search field: the token-driven `Input` with a leading magnifier and a
 * trailing clear (×) that appears once there's a value. This is the new-gen
 * replacement for the legacy styled-components `Search` — use it for table /
 * list / toolbar search.
 *
 * Controlled: `value` + `onChange` (fires on every keystroke). Consumers that
 * apply on submit rather than live (e.g. a search that hits the network) can
 * keep their own draft and use `onSearch`, which fires on Enter with the
 * trimmed value. `onClear` defaults to `onChange('')`.
 *
 * `loading` swaps the magnifier for a decorative spinner while a search is in
 * flight — same slot, no layout shift. It's presentation only: keep `aria-busy`
 * and any result announcements on the region showing the results.
 *
 * Defaults to a pill so it sits naturally beside a `SegmentedControl` /
 * `FacetFilter` in a filter toolbar; `className` targets the wrapper, so pass
 * width/margin there (e.g. `className="w-56"`).
 */
export type SearchInputProps = Omit<
  InputProps,
  'value' | 'onChange' | 'type' | 'size'
> & {
  value: string
  onChange: (value: string) => void
  /** Fired on Enter with the trimmed value (apply-on-submit consumers). */
  onSearch?: (value: string) => void
  /** Fired when the clear control is pressed; defaults to `onChange('')`. */
  onClear?: () => void
  /** Accessible label for the clear control. */
  clearLabel?: string
  /** Swap the magnifier for a spinner while results are being fetched. */
  loading?: boolean
  size?: InputProps['size']
  /** Layout classes for the wrapper (width, margin); the field is `w-full`. */
  className?: string
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      className,
      clearLabel = 'Clear search',
      disabled,
      loading = false,
      onChange,
      onClear,
      onKeyDown,
      onSearch,
      placeholder = 'Search',
      size = 'compact',
      value,
      ...props
    },
    ref
  ) => {
    const showClear = !!value && !disabled
    const clear = () => (onClear ? onClear() : onChange(''))

    // The DS Input's compact size has a 32px min-height but renders ~34px once
    // border + padding + line-height are counted. Pin compact to an exact 32px
    // (trimming the vertical padding to keep the text centered) so the field
    // lines up with `ActionButton`/`SegmentedControl` in a filter toolbar.
    const sizeClass = size === 'compact' ? 'h-8 py-1' : ''

    return (
      <div className={cn('relative w-full', className)}>
        {loading ? (
          // Decorative: the results region owns the live/busy semantics.
          <Spinner
            className='-translate-y-1/2 pointer-events-none absolute top-1/2 left-2.5'
            label={false}
            size='md'
            tone='muted'
          />
        ) : (
          <Search
            aria-hidden='true'
            className='-translate-y-1/2 pointer-events-none absolute top-1/2 left-2.5 size-4 text-muted-foreground'
          />
        )}
        <Input
          ref={ref}
          // `type=search` for semantics/mobile keyboards, but suppress the
          // native cancel widget so the only clear affordance is our styled one.
          className={cn(
            'rounded-pill pr-8 pl-8 [&::-webkit-search-cancel-button]:appearance-none',
            sizeClass
          )}
          disabled={disabled}
          placeholder={placeholder}
          size={size}
          type='search'
          value={value}
          onChange={event => onChange(event.target.value)}
          // A consumer onKeyDown runs first and can preventDefault to suppress onSearch.
          // Enter mid-IME-composition confirms the conversion, not the search.
          onKeyDown={event => {
            onKeyDown?.(event)
            if (event.defaultPrevented || event.nativeEvent.isComposing) return
            if (event.key === 'Enter') onSearch?.(value.trim())
          }}
          {...props}
        />
        {showClear && (
          <button
            aria-label={clearLabel}
            className='-translate-y-1/2 absolute top-1/2 right-2 flex size-5 items-center justify-center rounded-pill text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--core-color-focus-ring)]'
            onClick={clear}
            type='button'
          >
            <X aria-hidden='true' className='size-3.5' />
          </button>
        )}
      </div>
    )
  }
)

SearchInput.displayName = 'SearchInput'
