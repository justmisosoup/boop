import React from 'react'

import { Check, ChevronsUpDown } from 'lucide-react'

import { cn } from '@/utils/twUtils'

import type { CoreThemeMode } from './CoreTheme'
import { inputVariants } from './Field'
import { Popover, PopoverContent, PopoverTrigger } from './Popover'
import { Tag } from './Tag'

export type ComboboxOption = {
  label: string
  value: string
  /** Optional namespace; options sharing a group render under a group header. */
  group?: string
}

export type ComboboxProps = {
  options: ComboboxOption[]
  /** Selected values. Always an array, even in single-select mode (length ≤ 1). */
  value: string[]
  onChange: (value: string[]) => void
  /**
   * Multi-select (default). When `false`, selecting an option replaces the
   * value and closes the popover, and the trigger shows the single selection
   * instead of removable tags.
   */
  multiple?: boolean
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  id?: string
  isInvalid?: boolean
  disabled?: boolean
  /** Class for the trigger button. */
  className?: string
  /** Class for the popover content. */
  contentClassName?: string
  themeMode?: CoreThemeMode
  'aria-label'?: string
  'aria-labelledby'?: string
}

type OptionGroup = { group: string; options: ComboboxOption[] }

// Group options by `group`, preserving first-seen order of both groups and the
// options within them (ungrouped options collect under '').
const groupOptions = (options: ComboboxOption[]): OptionGroup[] => {
  const groups: OptionGroup[] = []
  const byGroup = new Map<string, ComboboxOption[]>()

  for (const option of options) {
    const key = option.group ?? ''
    let bucket = byGroup.get(key)

    if (!bucket) {
      bucket = []
      byGroup.set(key, bucket)
      groups.push({ group: key, options: bucket })
    }

    bucket.push(option)
  }

  return groups
}

/**
 * Searchable, optionally namespace-grouped combobox built on `Popover`.
 * Controlled via `value`/`onChange`.
 *
 * - Multi-select (default): selecting keeps the popover open and each selection
 *   renders below the trigger as a removable tag.
 * - Single-select (`multiple={false}`): selecting replaces the value and closes.
 */
export const Combobox = ({
  options,
  value,
  onChange,
  multiple = true,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyMessage = 'No matches.',
  id,
  isInvalid = false,
  disabled = false,
  className,
  contentClassName,
  themeMode,
  ...aria
}: ComboboxProps) => {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [activeIndex, setActiveIndex] = React.useState(0)
  const listId = React.useId()

  const selected = React.useMemo(() => new Set(value), [value])
  const labelFor = React.useCallback(
    (optionValue: string) =>
      options.find(option => option.value === optionValue)?.label ??
      optionValue,
    [options]
  )

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()

    if (!q) return options

    return options.filter(
      option =>
        option.label.toLowerCase().includes(q) ||
        option.value.toLowerCase().includes(q)
    )
  }, [options, query])

  const grouped = React.useMemo(() => groupOptions(filtered), [filtered])
  // Render order (grouped), used to map keyboard `activeIndex` to an option.
  const flatOptions = React.useMemo(
    () => grouped.flatMap(group => group.options),
    [grouped]
  )

  // Reset the highlight whenever the filtered set changes.
  React.useEffect(() => setActiveIndex(0), [query])

  const toggle = (optionValue: string) => {
    if (!multiple) {
      onChange([optionValue])
      setQuery('')
      setOpen(false)
      return
    }

    onChange(
      selected.has(optionValue)
        ? value.filter(v => v !== optionValue)
        : [...value, optionValue]
    )
  }

  const remove = (optionValue: string) => {
    onChange(value.filter(v => v !== optionValue))
  }

  const handleSearchKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex(index => Math.min(index + 1, flatOptions.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex(index => Math.max(index - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const option = flatOptions[activeIndex]
      if (option) toggle(option.value)
    }
    // Escape (close popover) is owned by the Radix Popover layer.
  }

  // The trigger shows the single selection (single-select) or the placeholder;
  // in multi-select the selections render as removable tags below the trigger.
  const renderSummary = () => {
    if (!multiple && value.length > 0) {
      return <span className='truncate'>{labelFor(value[0])}</span>
    }

    return (
      <span className='truncate text-[var(--core-color-control-placeholder)]'>
        {placeholder}
      </span>
    )
  }

  const activeValue = flatOptions[activeIndex]?.value
  let renderIndex = -1

  return (
    <div className='grid gap-2'>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            aria-expanded={open}
            aria-haspopup='listbox'
            aria-invalid={isInvalid || undefined}
            className={cn(
              inputVariants({ size: 'standard' }),
              // `core-input-trigger` restores the input chrome (border, padding,
              // background, colour) that the global `button` reset strips from
              // this <button>, so it reads as a field like the inputs beside it.
              'core-input-trigger items-center justify-between gap-2 text-left',
              className
            )}
            disabled={disabled}
            id={id}
            type='button'
            {...aria}
          >
            {renderSummary()}
            <ChevronsUpDown
              aria-hidden='true'
              className='size-4 shrink-0 opacity-60'
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align='start'
          // Cap to the space available on whichever side Radix opens, and let
          // the option list scroll inside it. Because the content always fits,
          // Radix never hits an overflow and so never re-flips the popover when
          // the surrounding layout shifts (e.g. selecting an option grows a
          // centered dialog, nudging the trigger) — which otherwise makes the
          // menu jump from above the trigger to below it. See Radix popover
          // discussions #1256 / #2413.
          className={cn(
            'flex max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] flex-col p-0',
            contentClassName
          )}
          themeMode={themeMode}
        >
          <div className='border-b border-border p-2'>
            {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
            <input
              aria-activedescendant={
                activeValue ? `${listId}-${activeValue}` : undefined
              }
              aria-controls={listId}
              aria-expanded={open}
              autoFocus
              className='w-full appearance-none border-0 bg-transparent px-1 py-1 text-sm leading-5 text-foreground placeholder:text-[var(--core-color-control-placeholder)] focus-visible:outline-hidden'
              onChange={event => setQuery(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={searchPlaceholder}
              role='combobox'
              value={query}
            />
          </div>
          <div
            aria-multiselectable={multiple || undefined}
            className='min-h-0 flex-1 overflow-y-auto p-1'
            id={listId}
            role='listbox'
          >
            {flatOptions.length === 0 ? (
              <div className='px-2 py-6 text-center text-sm text-muted-foreground'>
                {emptyMessage}
              </div>
            ) : (
              grouped.map(({ group, options: groupOpts }) => (
                <div
                  aria-label={group || undefined}
                  key={group || '__ungrouped__'}
                  role='group'
                >
                  {group && (
                    <div className='px-2 pb-1 pt-2 text-xs font-semibold text-muted-foreground'>
                      {group}
                    </div>
                  )}
                  {groupOpts.map(option => {
                    renderIndex += 1
                    const optionIndex = renderIndex
                    const isSelected = selected.has(option.value)

                    return (
                      <div
                        aria-selected={isSelected}
                        className={cn(
                          'flex cursor-pointer items-center gap-2 rounded-control px-2 py-1.5 text-sm text-foreground',
                          optionIndex === activeIndex &&
                            'bg-[var(--core-color-state-hover-bg)]'
                        )}
                        id={`${listId}-${option.value}`}
                        key={option.value}
                        onClick={() => toggle(option.value)}
                        onMouseEnter={() => setActiveIndex(optionIndex)}
                        role='option'
                      >
                        {multiple && (
                          <span
                            className={cn(
                              'flex size-4 shrink-0 items-center justify-center rounded-control border border-border transition-colors',
                              isSelected && 'border-foreground bg-foreground'
                            )}
                          >
                            {isSelected && (
                              <Check className='size-3 text-background' />
                            )}
                          </span>
                        )}
                        <span className='truncate'>{option.label}</span>
                        {!multiple && isSelected && (
                          <Check className='ml-auto size-4 shrink-0 text-foreground' />
                        )}
                      </div>
                    )
                  })}
                </div>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
      {multiple && value.length > 0 && (
        <div className='flex flex-wrap gap-1.5'>
          {value.map(optionValue => (
            <Tag
              disabled={disabled}
              key={optionValue}
              onRemove={() => remove(optionValue)}
              removeLabel={`Remove ${labelFor(optionValue)}`}
            >
              {labelFor(optionValue)}
            </Tag>
          ))}
        </div>
      )}
    </div>
  )
}

Combobox.displayName = 'Combobox'
