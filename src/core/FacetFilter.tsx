import React from 'react'

import { ChevronDown } from 'lucide-react'

import { cn } from '@/utils/twUtils'

import { ActionButton, type ActionSize } from './Action'
import { CountBubble } from './Badge'
import { Checkbox } from './ChoiceControl'
import type { CoreThemeMode } from './CoreTheme'
import { Popover, PopoverContent, PopoverTrigger } from './Popover'

export type FacetFilterOption = {
  label: string
  value: string
}

/**
 * A multi-select filter facet: a trigger button that opens a `Popover` of
 * checkboxes over `options`, with the active count shown as a `CountBubble`.
 * Controlled via `value`/`onChange` (a `string[]` of selected values), like
 * `Combobox`.
 *
 * - The popover is **content-sized** (`w-auto` between a min and a capped max)
 *   so option labels are never sheared off — it grows to fit the longest label
 *   instead of clipping it in a fixed-width box.
 * - An in-popover search box appears once the list is long enough to need it
 *   (`searchable`, auto-on past `searchThreshold`).
 * - A clear-all footer shows while anything is selected.
 *
 * Reach for `FacetFilter` for toolbar/table filters (event type, status, owner,
 * …). For free-form single/multi *selection* in a form, use `Combobox`.
 */
export type FacetFilterProps = {
  /** Trigger text, e.g. `"Event type"`. */
  label: string
  options: FacetFilterOption[]
  /** Selected values (controlled). */
  value: string[]
  onChange: (next: string[]) => void
  /** Show the in-popover search box. Defaults to true past `searchThreshold`. */
  searchable?: boolean
  /** Option count above which search auto-enables when `searchable` is unset. */
  searchThreshold?: number
  searchPlaceholder?: string
  /** Render option labels in monospace (for code-like identifiers). */
  monospace?: boolean
  /** Popover edge to align to the trigger. */
  align?: 'start' | 'end'
  /** Trigger size; matches the action/control scale (compact = 32px). */
  size?: ActionSize
  disabled?: boolean
  clearLabel?: string
  emptyMessage?: string
  /** Class for the trigger button. */
  className?: string
  /** Class for the popover content. */
  contentClassName?: string
  themeMode?: CoreThemeMode
  'aria-label'?: string
}

export const FacetFilter = ({
  label,
  options,
  value,
  onChange,
  searchable,
  searchThreshold = 8,
  searchPlaceholder = 'Filter…',
  monospace = false,
  align = 'start',
  size = 'compact',
  disabled = false,
  clearLabel = 'Clear',
  emptyMessage = 'No options',
  className,
  contentClassName,
  themeMode,
  'aria-label': ariaLabel
}: FacetFilterProps) => {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const listId = React.useId()

  const selected = React.useMemo(() => new Set(value), [value])
  const showSearch = searchable ?? options.length > searchThreshold

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()

    if (!q) return options

    return options.filter(
      option =>
        option.label.toLowerCase().includes(q) ||
        option.value.toLowerCase().includes(q)
    )
  }, [options, query])

  const toggle = (optionValue: string) =>
    onChange(
      selected.has(optionValue)
        ? value.filter(v => v !== optionValue)
        : [...value, optionValue]
    )

  if (options.length === 0) return null

  return (
    <Popover
      open={open}
      onOpenChange={next => {
        setOpen(next)
        // Reset the search so reopening always starts from the full list.
        if (!next) setQuery('')
      }}
    >
      <PopoverTrigger asChild>
        <ActionButton
          // `w-fit` so the trigger always hugs its label/count rather than
          // stretching to fill a grid/flex cell it's dropped into.
          aria-label={ariaLabel}
          className={cn('w-fit', className)}
          disabled={disabled}
          size={size}
          trailingIcon={<ChevronDown aria-hidden='true' />}
          variant='secondary'
        >
          {label}
          {value.length > 0 && <CountBubble>{value.length}</CountBubble>}
        </ActionButton>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        // Grow to fit the longest label between a sensible min and a capped
        // max (so a runaway label wraps rather than blowing out the toolbar);
        // `overflow-hidden` lives on PopoverContent.
        className={cn(
          'flex max-h-[22rem] w-auto min-w-[12rem] max-w-[min(24rem,90vw)] flex-col p-0',
          contentClassName
        )}
        themeMode={themeMode}
      >
        {showSearch && (
          <div className='border-border border-b p-2'>
            {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
            <input
              aria-controls={listId}
              aria-label={searchPlaceholder}
              autoFocus
              className='w-full appearance-none border-0 bg-transparent px-1 py-1 text-foreground text-sm leading-5 placeholder:text-[var(--core-color-control-placeholder)] focus-visible:outline-hidden'
              onChange={event => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              value={query}
            />
          </div>
        )}
        {/* A flex column so each option is its own full-width row — the
            `Checkbox` root is `inline-flex`, so without this short labels would
            flow two-per-row once the popover is wide. */}
        <div
          className='flex min-h-0 flex-1 flex-col overflow-y-auto p-1'
          id={listId}
        >
          {filtered.length === 0 ? (
            <div className='px-2 py-6 text-center text-muted-foreground text-sm'>
              {emptyMessage}
            </div>
          ) : (
            filtered.map(option => (
              <Checkbox
                key={option.value}
                checked={selected.has(option.value)}
                className='items-center rounded-control px-2 py-1.5 hover:bg-[var(--core-color-state-hover-bg)]'
                onCheckedChange={() => toggle(option.value)}
              >
                <span
                  className={cn('break-all', monospace && 'font-mono text-xs')}
                >
                  {option.label}
                </span>
              </Checkbox>
            ))
          )}
        </div>
        {value.length > 0 && (
          <div className='border-border border-t p-1'>
            <button
              className='flex w-full items-center justify-center rounded-control px-2 py-1.5 text-muted-foreground text-sm transition-colors hover:bg-[var(--core-color-state-hover-bg)] hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--core-color-focus-ring)]'
              onClick={() => onChange([])}
              type='button'
            >
              {clearLabel}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

FacetFilter.displayName = 'FacetFilter'
