/**
 * ListPicker — pick one rich record out of a set, from any trigger.
 *
 * ## Consumers
 * Two, which is what earned this the `@/core` export (`src/core/README.md`
 * wants proven demand, not anticipated reuse): the Explorer dock's thread
 * switcher (`Explorer/chat/GraphSwitcher`) and the business header's assignee
 * picker (`BusinessHome/BusinessStatusBar/AssigneeDropdown`). The API held for
 * the second consumer with one addition — the selected row's trailing check,
 * which this file had always documented but never drawn.
 *
 * `Operator/.../RunAgentMenu` is deliberately NOT a consumer: it is a COMMAND
 * menu (`role='menu'`, running an agent), not a value picker (`aria-selected`,
 * `selectedId`), and it wants a tree guide-rail this API cannot express.
 *
 * The fourth selection surface, and the one the other three couldn't be:
 * `Menu` is for commands (Radix typeahead fights a nested text input, so it
 * can never hold a search box); `Combobox` is a form field with a fixed
 * field-shaped trigger and label-only rows; `FacetFilter` is a toolbar
 * multi-select of checkboxes. This is "switch to one of these records" — a
 * thread, a run, a saved view — with the panel list-row anatomy, an optional
 * search field, and a footer of standing commands.
 *
 * ## Why Popover and not Menu
 * Radix `DropdownMenu` typeahead swallows keystrokes meant for a search input
 * — the workbench states the rule outright ("do not use Menu as the base for
 * searchable filters"). `PopoverContent` also bakes `z-[1200]`, which clears
 * the `z-floating: 1050` a `FloatingPanel` host sits on; `MenuContent` bakes
 * `z-50` and needs an explicit override at every call site.
 *
 * ## The focus host
 * Search is conditional (off at small counts), so the ARIA pattern has to be
 * too. With a search field this is a W3C combobox-with-listbox: the input
 * owns focus and `aria-activedescendant`. Without one, the listbox itself
 * takes `tabIndex={0}` and the same active-descendant machinery. Either way
 * DOM focus never enters a row.
 *
 * ## Actions live INSIDE the listbox
 * `aria-activedescendant` must name a descendant of the element it belongs
 * to, so footer actions are `role='option'` within the same listbox rather
 * than buttons beside it. That is what lets ArrowDown walk off the last
 * record onto "New graph" without breaking the IDREF.
 */
import type React from 'react'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

import { Check } from 'lucide-react'

import { cn } from '@/utils/twUtils'

// Relative sibling imports, not the `@/core` barrel: `index.ts` exports this
// file, so importing the barrel from here is a cycle (Biome `noImportCycles`).
import type { CoreThemeMode } from './CoreTheme'
import { Highlight } from './Highlight'
import { Popover, PopoverContent, PopoverTrigger } from './Popover'
// The row anatomy `FloatingPanelRow` and `FloatingPanelRowsSkeleton` share, and
// the density axis those rows obey. A picker option has to match the panel list
// row exactly, and duplicating the anatomy is the thing that would drift.
import { useDensity, type Density } from './internal/density'
import {
  PanelRowContent,
  panelRowLeading,
  panelRowShell,
  type PanelRowLeading
} from './internal/panelRow'

/** Count above which the search field appears on its own. Matches
 *  `FacetFilter`'s threshold so the two feel like one system. */
const DEFAULT_SEARCH_THRESHOLD = 8

/** Characters of `body` kept either side of a match in the snippet. */
const SNIPPET_PAD = 32

export type ListPickerItem = {
  /** Stable identity — handed back by `onSelect`, compared to `selectedId`,
   *  and (whitespace-collapsed) minted into the row's DOM id. */
  id: string
  /** First line. Truncates; highlighted against the live query. */
  label: string
  /** Second line. Truncates; highlighted. Replaced by a match snippet when
   *  the query hit `body` and nothing the row already shows. */
  description?: string
  /** Leading glyph. Decorative — never the only carrier of meaning. */
  icon?: React.ReactNode
  /** Trailing metadata: a relative time, a count. Never truncates. */
  meta?: React.ReactNode
  /** Extra needles matched against but never rendered (ids, aliases). */
  keywords?: string[]
  /** Long text matched against — a transcript, a document. On a body-only hit
   *  the second line becomes a windowed snippet around the match. */
  body?: string
  /** Nesting depth for tree-shaped lists (clamped 0–3). */
  depth?: number
  /** Items sharing a `group` render under one header, in first-seen order. */
  group?: string
  /** Visible but not selectable; skipped by the keyboard walk. */
  disabled?: boolean
}

/** A standing command pinned below the list. Never filtered. */
export type ListPickerAction = {
  id: string
  label: string
  icon?: React.ReactNode
  onSelect: () => void
  disabled?: boolean
  /** Keep the picker open after running. Default: closes. */
  keepOpen?: boolean
}

/**
 * Deliberately narrow for a first release. Controlled open, a `renderItem`
 * escape hatch, `closeOnSelect`, and trigger-width sizing were all designed
 * and then cut before shipping: nothing in the tree needed them, and this
 * primitive has one live consumer. Every one is additive to bring back the
 * day something asks. (`src/core/README.md`: proven demand, not anticipated
 * reuse.)
 */
export type ListPickerProps = {
  /** The trigger, rendered through Radix `asChild`: one element that forwards
   *  a ref and spreads props. Receives `aria-expanded` and
   *  `aria-haspopup='listbox'`. */
  children: React.ReactNode
  items: ListPickerItem[]
  /** Fired with the chosen row; the picker then closes. */
  onSelect: (item: ListPickerItem) => void
  /** The committed row — takes `aria-selected` and the trailing check. */
  selectedId?: string
  /** Standing commands in the footer, inside the same keyboard walk. */
  actions?: ListPickerAction[]
  /** Accessible name for the listbox. Required. */
  label: string

  /** Start open. Uncontrolled — the picker owns its open state. */
  defaultOpen?: boolean
  /** Lock page scroll while open. Default `false`. */
  modal?: boolean

  /** Force the search field on/off. Defaults to on past `searchThreshold`. */
  searchable?: boolean
  /** Item count above which search auto-enables. Default `8`. */
  searchThreshold?: number
  searchPlaceholder?: string
  onQueryChange?: (query: string) => void
  /** Replace the built-in matcher (case-insensitive substring over
   *  `label` + `description` + `keywords` + `body`). */
  filter?: (item: ListPickerItem, query: string) => boolean

  /** Shown when nothing is listed. Receives the trimmed query — `''` when the
   *  list is simply empty — so one prop covers both states. */
  emptyMessage?: React.ReactNode | ((query: string) => React.ReactNode)

  align?: 'start' | 'center' | 'end'
  /** Sizing of every row's leading column. `identity` widens it for an
   *  `Avatar` and centres it against a two-line row — reach for it whenever the
   *  glyph is a person. Applies to the footer commands too, so their labels
   *  stay on the same left edge as the rows above. */
  leading?: PanelRowLeading
  contentClassName?: string
  /** Density override; inherits from a surrounding `FloatingPanel` — context
   *  crosses the popover portal, so the Explorer dock's compact reaches these
   *  rows with no prop. */
  density?: Density
  /** Portaled content can't inherit a scoped `.core-theme[data-theme]`
   *  ancestor. Usually unnecessary — `PopoverContent` resolves the mode from
   *  the nearest `CoreThemeProvider`, which wraps the authenticated app — so
   *  pass it only where one isn't in scope, or to pin a mode (the workbench
   *  drives its dark preview this way). */
  themeMode?: CoreThemeMode
}

/** Collapse whitespace so a consumer id with spaces still yields ONE valid
 *  DOM token — an `aria-activedescendant` that names two tokens resolves to
 *  nothing, and the row silently stops being announced. */
const optionDomId = (listId: string, itemId: string) =>
  `${listId}-${itemId.replace(/\s+/g, '_')}`

const haystack = (item: ListPickerItem) =>
  [item.label, item.description, item.keywords?.join(' '), item.body]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

const defaultFilter = (item: ListPickerItem, query: string) =>
  haystack(item).includes(query.toLowerCase())

/**
 * A window of `body` around the first match — what makes "the subtitle
 * becomes the matching line" fall out of the primitive instead of forcing
 * every consumer to control the query and rebuild its items per keystroke.
 * Exported for its test, deliberately not from the barrel.
 */
export const matchSnippet = (
  body: string,
  query: string
): string | undefined => {
  const needle = query.trim().toLowerCase()
  if (!needle) return undefined
  const flat = body.replace(/\s+/g, ' ').trim()
  const at = flat.toLowerCase().indexOf(needle)
  if (at === -1) return undefined

  const matchEnd = at + needle.length
  const rawStart = Math.max(0, at - SNIPPET_PAD)
  const rawEnd = Math.min(flat.length, matchEnd + SNIPPET_PAD)

  // Trim to word boundaries so the window never opens or closes mid-word —
  // then clamp back so it can never cross INTO the match. Unbroken runs (a
  // URL, a long id) push the nearest space past the match, and without the
  // clamp the snippet would scroll right off the term it exists to show.
  const wordStart =
    rawStart === 0 ? 0 : flat.indexOf(' ', rawStart) + 1 || rawStart
  const start = Math.min(wordStart, at)
  const wordEnd =
    rawEnd === flat.length ? flat.length : flat.lastIndexOf(' ', rawEnd)
  const end = Math.max(wordEnd, matchEnd)

  return `${start > 0 ? '…' : ''}${flat.slice(start, end)}${
    end < flat.length ? '…' : ''
  }`
}

/** One entry in the flat keyboard walk — a record or a footer action. */
type Walkable =
  | { kind: 'item'; item: ListPickerItem }
  | { kind: 'action'; action: ListPickerAction }

const isEnabled = (entry: Walkable) =>
  entry.kind === 'item' ? !entry.item.disabled : !entry.action.disabled

export const ListPicker = ({
  actions,
  align = 'start',
  children,
  contentClassName,
  defaultOpen,
  density: densityProp,
  emptyMessage = query =>
    query ? `No matches for “${query}”` : 'Nothing here yet',
  filter,
  items,
  label,
  leading = 'glyph',
  modal = false,
  onQueryChange,
  onSelect,
  searchable,
  searchPlaceholder = 'Search…',
  searchThreshold = DEFAULT_SEARCH_THRESHOLD,
  selectedId,
  themeMode
}: ListPickerProps) => {
  const density = useDensity(densityProp)
  const [open, setOpen] = useState(defaultOpen ?? false)

  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const listId = useId()
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  /** The inner scroller — the listbox itself doesn't scroll (the pinned
   *  actions footer would scroll away with the options). */
  const scrollerRef = useRef<HTMLDivElement>(null)

  const showSearch = searchable ?? items.length > searchThreshold
  const trimmed = query.trim()

  /** Whichever element owns focus and the key bindings in this configuration. */
  const focusHost = () => (showSearch ? searchRef.current : listRef.current)

  const filtered = useMemo(() => {
    if (!trimmed) return items
    const match = filter ?? defaultFilter
    return items.filter(item => match(item, trimmed))
  }, [items, trimmed, filter])

  // The flat walk: records first, then actions. Actions are never filtered —
  // "New graph" must stay reachable from a query that matches nothing.
  const walk = useMemo<Walkable[]>(
    () => [
      ...filtered.map(item => ({ kind: 'item' as const, item })),
      ...(actions ?? []).map(action => ({ kind: 'action' as const, action }))
    ],
    [filtered, actions]
  )

  // A filter change invalidates the highlight — land on the first thing the
  // user can actually choose.
  const firstEnabled = walk.findIndex(isEnabled)
  useEffect(() => {
    setActiveIndex(current =>
      walk[current] && isEnabled(walk[current])
        ? current
        : firstEnabled === -1
          ? 0
          : firstEnabled
    )
    // `walk` identity changes with the filter, which is exactly the trigger
  }, [walk, firstEnabled])

  // Reset the query when the picker closes, so reopening shows everything.
  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  // Opening lands the highlight on the row you are ALREADY on, so Enter is a
  // no-op and the arrows move relative to your position — not to the top of a
  // list you didn't choose. Declared after the reset effect so it wins on the
  // opening frame; `openedRef` keeps it out of the way of later re-filtering.
  const openedRef = useRef(false)
  useEffect(() => {
    if (!open) {
      openedRef.current = false
      return
    }
    if (openedRef.current) return
    openedRef.current = true
    const atSelected = walk.findIndex(
      entry => entry.kind === 'item' && entry.item.id === selectedId
    )
    setActiveIndex(
      atSelected === -1 ? (firstEnabled === -1 ? 0 : firstEnabled) : atSelected
    )
  }, [open, walk, selectedId, firstEnabled])

  // Keep the active row in view. Scans `data-option-index` rather than using
  // a CSS selector: ids are consumer strings and `CSS.escape` isn't universal.
  //
  // Deferred a frame, and measured as a delta between the row and the scroller
  // rather than with `scrollIntoView`. On the opening frame the popover has not
  // been positioned yet and is mid-`popover-in` (a `translate3d`), and
  // `scrollIntoView` there is a no-op — which left the committed row, and its
  // check, below the fold on any list long enough to scroll. Both rects sit
  // inside the same transformed subtree, so their difference cancels it out.
  useEffect(() => {
    if (!open) return

    const align = () => {
      const scroller = scrollerRef.current
      const rows = listRef.current?.querySelectorAll<HTMLElement>(
        '[data-option-index]'
      )
      if (!scroller || !rows) return

      rows.forEach(row => {
        if (Number(row.dataset.optionIndex) !== activeIndex) return

        const rowBox = row.getBoundingClientRect()
        const viewBox = scroller.getBoundingClientRect()

        // `block: 'nearest'` — only move when the row is actually outside.
        if (rowBox.top < viewBox.top) {
          scroller.scrollTop -= viewBox.top - rowBox.top
        } else if (rowBox.bottom > viewBox.bottom) {
          scroller.scrollTop += rowBox.bottom - viewBox.bottom
        }
      })
    }

    // jsdom has no layout, and a hidden tab never runs the frame — both degrade
    // to "no auto-scroll", never to a crash.
    if (typeof requestAnimationFrame !== 'function') return
    const frame = requestAnimationFrame(align)

    return () => cancelAnimationFrame(frame)
  }, [activeIndex, open])

  const commit = useCallback(
    (entry: Walkable) => {
      if (!isEnabled(entry)) return
      if (entry.kind === 'action') {
        entry.action.onSelect()
        if (!entry.action.keepOpen) setOpen(false)
        return
      }
      onSelect(entry.item)
      setOpen(false)
    },
    [onSelect]
  )

  /** Step to the next enabled entry, wrapping. */
  const step = useCallback(
    (delta: number) => {
      if (walk.length === 0) return
      let next = activeIndex
      for (let hops = 0; hops < walk.length; hops += 1) {
        next = (next + delta + walk.length) % walk.length
        if (isEnabled(walk[next])) {
          setActiveIndex(next)
          return
        }
      }
    },
    [walk, activeIndex]
  )

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      step(1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      step(-1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      const first = walk.findIndex(isEnabled)
      if (first !== -1) setActiveIndex(first)
    } else if (event.key === 'End') {
      event.preventDefault()
      for (let index = walk.length - 1; index >= 0; index -= 1) {
        if (isEnabled(walk[index])) {
          setActiveIndex(index)
          return
        }
      }
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const entry = walk[activeIndex]
      if (entry) commit(entry)
    } else if (event.key === 'Tab') {
      setOpen(false)
    }
    // Escape belongs to Radix's DismissableLayer. FloatingPanel's own Escape
    // handler already defers to `[data-radix-popper-content-wrapper]`, so a
    // picker inside a dock closes without minimizing the dock.
  }

  const activeEntry = walk[activeIndex]
  const activeDomId = activeEntry
    ? optionDomId(
        listId,
        activeEntry.kind === 'item'
          ? activeEntry.item.id
          : activeEntry.action.id
      )
    : undefined

  // Group headers, in first-seen order — same rule as Combobox.
  const groups = useMemo(() => {
    const order: string[] = []
    const byGroup = new Map<string, ListPickerItem[]>()
    filtered.forEach(item => {
      const key = item.group ?? ''
      if (!byGroup.has(key)) {
        byGroup.set(key, [])
        order.push(key)
      }
      byGroup.get(key)?.push(item)
    })
    return order.map(key => ({ group: key, items: byGroup.get(key) ?? [] }))
  }, [filtered])

  const empty =
    typeof emptyMessage === 'function' ? emptyMessage(trimmed) : emptyMessage

  let renderIndex = -1

  return (
    <Popover modal={modal} open={open} onOpenChange={setOpen}>
      {/* Radix sets aria-haspopup='dialog' BEFORE spreading trigger props, so
          ours wins — this is a listbox, not a dialog. */}
      <PopoverTrigger aria-haspopup='listbox' asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className={cn(
          'flex max-h-[min(24rem,var(--radix-popover-content-available-height))] flex-col p-0',
          'w-[min(20rem,var(--radix-popover-content-available-width))]',
          contentClassName
        )}
        themeMode={themeMode}
        // Take focus deliberately instead of relying on "the first tabbable
        // happens to be right" — which is false in the no-search path.
        onOpenAutoFocus={event => {
          event.preventDefault()
          focusHost()?.focus()
        }}
      >
        {showSearch && (
          <div className='shrink-0 border-b border-border p-2'>
            <input
              ref={searchRef}
              aria-activedescendant={activeDomId}
              aria-autocomplete='list'
              aria-controls={listId}
              aria-expanded={open}
              aria-label={searchPlaceholder}
              className='w-full appearance-none border-0 bg-transparent px-1 py-1 text-sm leading-5 text-foreground placeholder:text-[var(--core-color-control-placeholder)] focus-visible:outline-hidden'
              placeholder={searchPlaceholder}
              role='combobox'
              value={query}
              onChange={event => {
                setQuery(event.target.value)
                onQueryChange?.(event.target.value)
              }}
              onKeyDown={handleKeyDown}
            />
          </div>
        )}
        {/* The listbox is the ARIA container but NOT the scroller. Actions
            have to live inside it for `aria-activedescendant` to resolve, and
            if the listbox itself scrolled they would scroll away with the
            options — the footer would slide up through the last row instead
            of staying put. So: listbox = plain flex column, options in an
            inner scroller, actions pinned beneath it. */}
        <div
          ref={listRef}
          // Without a search field the listbox IS the focus host, so it takes
          // the tab stop and the key bindings.
          aria-activedescendant={showSearch ? undefined : activeDomId}
          aria-label={label}
          className='flex min-h-0 flex-1 flex-col focus-visible:outline-hidden'
          id={listId}
          role='listbox'
          tabIndex={showSearch ? undefined : 0}
          onKeyDown={showSearch ? undefined : handleKeyDown}
        >
          <div
            ref={scrollerRef}
            className='min-h-0 flex-1 overflow-y-auto overscroll-contain p-1'
          >
            {filtered.length === 0 ? (
              <div className='px-2 py-6 text-center text-sm text-muted-foreground'>
                {empty}
              </div>
            ) : (
              groups.map(({ group, items: groupItems }) => (
                <div
                  aria-label={group || undefined}
                  key={group || '__ungrouped__'}
                  role='group'
                >
                  {group && (
                    <div className='px-2.5 pb-1 pt-2 text-caption font-medium text-[var(--core-color-text-muted)]'>
                      {group}
                    </div>
                  )}
                  {groupItems.map(item => {
                    renderIndex += 1
                    return (
                      <Option
                        key={item.id}
                        active={renderIndex === activeIndex}
                        density={density}
                        domId={optionDomId(listId, item.id)}
                        index={renderIndex}
                        item={item}
                        leading={leading}
                        query={trimmed}
                        selected={item.id === selectedId}
                        onActivate={setActiveIndex}
                        onCommit={() => commit({ kind: 'item', item })}
                      />
                    )
                  })}
                </div>
              ))
            )}
          </div>

          {actions && actions.length > 0 && (
            <div
              aria-label='Actions'
              className='shrink-0 border-t border-border p-1'
              role='group'
            >
              {actions.map(action => {
                renderIndex += 1
                const index = renderIndex
                return (
                  <div
                    key={action.id}
                    aria-disabled={action.disabled || undefined}
                    aria-selected={false}
                    className={cn(
                      panelRowShell(false, density),
                      'cursor-pointer',
                      density === 'compact' ? 'text-dense' : 'text-sm',
                      index === activeIndex &&
                        'bg-[var(--core-color-state-hover-bg)]',
                      action.disabled && 'pointer-events-none opacity-50'
                    )}
                    data-option-index={index}
                    id={optionDomId(listId, action.id)}
                    role='option'
                    onClick={() => commit({ kind: 'action', action })}
                    // mousedown must not blur the search input
                    onMouseDown={event => event.preventDefault()}
                    onMouseMove={() => setActiveIndex(index)}
                  >
                    {action.icon != null && (
                      <span
                        aria-hidden='true'
                        className={panelRowLeading(leading)}
                      >
                        {action.icon}
                      </span>
                    )}
                    <span className='min-w-0 flex-1 truncate font-medium'>
                      {action.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

ListPicker.displayName = 'ListPicker'

const Option = ({
  active,
  density,
  domId,
  index,
  item,
  leading,
  onActivate,
  onCommit,
  query,
  selected
}: {
  active: boolean
  density: Density
  domId: string
  index: number
  item: ListPickerItem
  leading: PanelRowLeading
  onActivate: (index: number) => void
  onCommit: () => void
  query: string
  selected: boolean
}) => {
  // A body-only hit swaps the second line for the matching passage — the row
  // then answers "why did this match?" instead of repeating its subtitle.
  const shown = `${item.label} ${item.description ?? ''}`.toLowerCase()
  const snippet =
    query && item.body && !shown.includes(query.toLowerCase())
      ? matchSnippet(item.body, query)
      : undefined
  const gistText = snippet ?? item.description

  return (
    <div
      aria-disabled={item.disabled || undefined}
      aria-selected={selected}
      className={cn(
        panelRowShell(gistText != null, density),
        'cursor-pointer',
        // Selected first, active second: tailwind-merge keeps the last of a
        // conflicting pair, so the keyboard highlight still reads on the row
        // you're already on. The check below is what marks selection
        // persistently — in scoped dark these two tokens are the SAME value,
        // so a background alone cannot distinguish committed from highlighted.
        selected && 'bg-[var(--core-color-state-selected-bg)]',
        active && 'bg-[var(--core-color-state-hover-bg)]',
        item.disabled && 'pointer-events-none opacity-50'
      )}
      data-option-index={index}
      id={domId}
      role='option'
      style={
        item.depth
          ? { paddingLeft: `${Math.min(item.depth, 3) * 16 + 10}px` }
          : undefined
      }
      onClick={onCommit}
      // preventDefault so a click never blurs the search input — otherwise the
      // popover's focus host changes underneath the selection
      onMouseDown={event => event.preventDefault()}
      // mousemove, not mouseenter: a list scrolling under a stationary cursor
      // must not yank the highlight away from the keyboard's position
      onMouseMove={() => onActivate(index)}
    >
      <PanelRowContent
        density={density}
        gist={
          gistText != null ? (
            <Highlight query={query} text={gistText} />
          ) : undefined
        }
        icon={item.icon}
        leading={leading}
        meta={item.meta}
        title={<Highlight query={query} text={item.label} />}
      />
      {selected && (
        <Check
          // `aria-selected` on the row already announces this; the glyph is the
          // visual half of the same fact. Aligned like `meta` so the two agree
          // on a two-line row.
          aria-hidden='true'
          className={cn(
            'size-4 shrink-0 text-foreground',
            gistText != null && 'self-start pt-px'
          )}
        />
      )}
    </div>
  )
}
