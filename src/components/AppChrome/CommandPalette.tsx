import type React from 'react'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

import {
  ArrowLeft,
  CircleCheckBig,
  CornerDownLeft,
  Search,
  Sparkles
} from 'lucide-react'

import { Highlight, Kbd, Skeleton } from '@/core'
import { cn } from '@/utils/twUtils'

export type CommandItem = {
  id: string
  label: string
  /** Section the item belongs to; rendered in GROUP_ORDER below. */
  group: string
  /** Leading glyph. Rows align their text past a fixed icon column. */
  icon?: React.ReactNode
  /** Extra match text (synonyms) that doesn't show in the label. */
  keywords?: string
  /** Short trailing hint (e.g. a path or "Action"). */
  hint?: string
  /** Keep the palette open after selecting (e.g. the "Ask AI" entry). */
  keepOpen?: boolean
  onSelect: () => void
  // --- Rich result rows (used by live business search) ---
  /** Secondary line under the label (e.g. an EIN). */
  description?: string
  /** Right-aligned node (e.g. a relative date "2 months ago"). Wins over `hint`. */
  trailing?: React.ReactNode
  /** Emphasize this substring in the label (search-match highlighting). */
  matchQuery?: string
  /** Already filtered by the server — skip the client-side `matches` filter. */
  serverFiltered?: boolean
  /** Run this item on ⌘↵ from anywhere, and show a ⌘↵ chord (e.g. "See all"). */
  primaryAction?: boolean
}

export type CommandPaletteProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  commands: CommandItem[]
  /** Optional hook for a real AI call; the answer UI is mocked for now. */
  onAsk?: (query: string) => void
  /** Fires on every keystroke (raw) so a parent can drive async search. */
  onQueryChange?: (query: string) => void
  /** Show a loading placeholder in the Businesses section while results fetch. */
  loading?: boolean
  themeMode?: 'light' | 'dark'
}

// Sections render in this order; unknown groups fall to the end. Mirrors the
// sidebar IA: recents, then live businesses, top-level destinations, the grouped
// areas, then actions/AI. Businesses lead (what you typed); Agents trail.
const GROUP_ORDER = [
  'Recent',
  'Businesses',
  'Go to',
  'Tax registrations',
  'Automation',
  'Settings',
  'Actions',
  'Agents'
]

// Match the DS Dialog's enter/exit motion (src/core/Dialog.tsx) so every modal
// in the chrome opens + closes the same way.
const REVEAL_MS = 220
const REVEAL_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

// Fade only the scroll edges that actually hide content, so rows dissolve under
// the input/footer when there's more to scroll while the resting first/last rows
// stay crisp. Decoupled from padding, so the list keeps a tight inset.
const SCROLL_FADE_PX = 14
const buildScrollMask = (
  fadeTop: boolean,
  fadeBottom: boolean
): React.CSSProperties | undefined => {
  if (!fadeTop && !fadeBottom) return undefined
  const mask = `linear-gradient(to bottom, ${fadeTop ? 'transparent' : '#000'} 0, #000 ${SCROLL_FADE_PX}px, #000 calc(100% - ${SCROLL_FADE_PX}px), ${fadeBottom ? 'transparent' : '#000'} 100%)`
  return { maskImage: mask, WebkitMaskImage: mask }
}

const matches = (item: CommandItem, q: string) =>
  !q || `${item.label} ${item.keywords ?? ''}`.toLowerCase().includes(q)

const mockAnswer = (q: string) =>
  `Based on “${q}”, I checked your live data: 3 businesses match and 1 has an open verification exception. I can run a verification, open a result, or summarize the exceptions — pick a next step below.`

/**
 * Keyboard-first ⌘K command palette with an AI-omni answer surface. In list
 * mode it searches businesses (live), jumps, and runs actions; selecting "Ask
 * Middesk AI" flips it into an answer state (mocked) with suggested next steps.
 * Self-contained overlay (renders inside the core-theme scope); listbox/option
 * roles, arrow/enter/escape, click-outside, and DS-matched enter/exit motion.
 */
export const CommandPalette = ({
  commands,
  loading = false,
  onAsk,
  onOpenChange,
  onQueryChange,
  open,
  themeMode
}: CommandPaletteProps) => {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [askQuery, setAskQuery] = useState<string | null>(null)
  const [thinking, setThinking] = useState(false)
  // Two-phase visibility so the palette animates out before it unmounts.
  const [shouldRender, setShouldRender] = useState(open)
  const [isVisible, setIsVisible] = useState(false)
  // Which scroll edges currently hide content (drives the edge fade).
  const [scrollEdges, setScrollEdges] = useState({ bottom: false, top: false })
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = useId()

  const inAnswer = askQuery !== null
  const trimmedQuery = query.trim()

  const ordered = useMemo(() => {
    const q = trimmedQuery.toLowerCase()
    const matched = commands.filter(
      item => item.serverFiltered || matches(item, q)
    )
    const grouped = GROUP_ORDER.flatMap(group =>
      matched.filter(item => item.group === group)
    )
    const rest = matched.filter(item => !GROUP_ORDER.includes(item.group))
    const ask: CommandItem[] =
      q && onAsk !== undefined
        ? [
            {
              id: '__ask',
              group: 'Ask',
              label: `Ask Middesk AI: “${trimmedQuery}”`,
              keepOpen: true,
              onSelect: () => {
                setActive(0)
                setAskQuery(trimmedQuery)
                onAsk?.(trimmedQuery)
              }
            }
          ]
        : []
    return [...ask, ...grouped, ...rest]
  }, [commands, onAsk, trimmedQuery])

  // A loading placeholder stands in for the Businesses section until the
  // debounced search resolves — but only when there are no business rows yet
  // (so refetches on an existing query don't flash skeletons).
  const showBusinessSkeleton =
    loading &&
    trimmedQuery.length > 0 &&
    !ordered.some(item => item.group === 'Businesses')

  // Suggested next steps in answer mode (agents + business results).
  const suggestions = useMemo(
    () =>
      commands
        .filter(item => item.group === 'Agents' || item.group === 'Businesses')
        .slice(0, 4),
    [commands]
  )

  const navItems = inAnswer ? suggestions : ordered
  const hasPrimaryAction = !inAnswer && ordered.some(item => item.primaryAction)

  // Track which scroll edges hide content so we only fade an edge with more to
  // reveal — the resting first/last rows stay crisp.
  const syncScrollEdges = useCallback(() => {
    const el = listRef.current
    if (!el) return
    const top = el.scrollTop > 1
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 1
    setScrollEdges(prev =>
      prev.top === top && prev.bottom === bottom ? prev : { bottom, top }
    )
  }, [])

  // Re-check the fade when the visible content or open state changes.
  useEffect(() => {
    syncScrollEdges()
  }, [syncScrollEdges, navItems.length, shouldRender, showBusinessSkeleton])

  // Mount → paint → reveal on open; reveal-out → unmount on close. Mirrors the
  // DS Dialog so the palette shares the chrome's modal motion.
  useEffect(() => {
    if (open) {
      setShouldRender(true)
      // Double-rAF reveals after the first paint so the transition actually
      // plays; the timer is a fallback so the reveal still fires if rAF is
      // throttled (e.g. a background tab) — otherwise the panel could stick
      // at opacity 0.
      let secondFrame = 0
      const firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => setIsVisible(true))
      })
      const fallback = setTimeout(() => setIsVisible(true), 80)
      return () => {
        cancelAnimationFrame(firstFrame)
        if (secondFrame) cancelAnimationFrame(secondFrame)
        clearTimeout(fallback)
      }
    }
    if (!shouldRender) return
    setIsVisible(false)
    const timer = setTimeout(
      () => setShouldRender(false),
      prefersReducedMotion() ? 0 : REVEAL_MS
    )
    return () => clearTimeout(timer)
  }, [open, shouldRender])

  // Reset on open; restore focus to the opener on close.
  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    setQuery('')
    setActive(0)
    setAskQuery(null)
    onQueryChange?.('')
    return () => previouslyFocused?.focus?.()
  }, [open, onQueryChange])

  // Focus the input once the panel is actually mounted — synchronously, so it
  // works whether opened by ⌘K or by clicking the rail search trigger (the
  // open-effect could run before the panel mounts under the two-phase render).
  useEffect(() => {
    if (shouldRender) inputRef.current?.focus({ preventScroll: true })
  }, [shouldRender])

  // Mock the "thinking" beat when entering an answer.
  useEffect(() => {
    if (askQuery === null) return
    setThinking(true)
    const timer = setTimeout(() => setThinking(false), 700)
    return () => clearTimeout(timer)
  }, [askQuery])

  // Keep the active index in range as the visible list changes.
  useEffect(() => {
    setActive(current => Math.min(current, Math.max(0, navItems.length - 1)))
  }, [navItems.length])

  if (!shouldRender) return null

  const run = (index: number) => {
    const item = navItems[index]
    if (!item) return
    item.onSelect()
    if (!item.keepOpen) onOpenChange(false)
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive(i => (navItems.length ? (i + 1) % navItems.length : 0))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive(i =>
        navItems.length ? (i - 1 + navItems.length) % navItems.length : 0
      )
    } else if (event.key === 'Enter') {
      event.preventDefault()
      // ⌘↵ / Ctrl+↵ runs the primary action (e.g. "See all results") from
      // anywhere; plain ↵ runs the highlighted row.
      if (event.metaKey || event.ctrlKey) {
        const primaryIndex = navItems.findIndex(item => item.primaryAction)
        if (primaryIndex >= 0) run(primaryIndex)
      } else {
        run(active)
      }
    } else if (event.key === 'Tab') {
      // Trap focus inside the input-driven palette.
      event.preventDefault()
      inputRef.current?.focus()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      if (inAnswer) setAskQuery(null)
      else onOpenChange(false)
    }
  }

  const handleQueryChange = (value: string) => {
    setQuery(value)
    setActive(0)
    onQueryChange?.(value)
    if (inAnswer) setAskQuery(null)
  }

  // A fixed-width icon column keeps every row's text on one left edge; section
  // headers carry a matching spacer so their label aligns with the row labels.
  const renderRow = (item: CommandItem, index: number) => (
    <li key={item.id}>
      <button
        aria-selected={index === active}
        className={cn(
          'flex min-h-9 w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
          index === active
            ? 'bg-[var(--core-color-state-hover-bg)] text-foreground'
            : 'text-foreground'
        )}
        id={`${listId}-opt-${index}`}
        role='option'
        type='button'
        onClick={() => run(index)}
        onMouseMove={() => setActive(index)}
      >
        {item.icon ? (
          <span className='flex w-4 shrink-0 items-center justify-center text-muted-foreground'>
            {item.icon}
          </span>
        ) : (
          <span aria-hidden='true' className='w-4 shrink-0' />
        )}
        <span className='flex min-w-0 flex-1 flex-col'>
          <span className='truncate leading-tight'>
            {item.matchQuery ? (
              <Highlight query={item.matchQuery} text={item.label} />
            ) : (
              item.label
            )}
          </span>
          {item.description && (
            <span className='truncate text-xs leading-tight text-muted-foreground'>
              {item.description}
            </span>
          )}
        </span>
        {item.primaryAction ? (
          <span className='flex shrink-0 items-center gap-1'>
            <Kbd>⌘</Kbd>
            <Kbd>↵</Kbd>
          </span>
        ) : item.trailing !== undefined ? (
          item.trailing && (
            <span className='shrink-0 whitespace-nowrap text-xs text-muted-foreground'>
              {item.trailing}
            </span>
          )
        ) : (
          item.hint && (
            <span className='shrink-0 whitespace-nowrap text-xs text-muted-foreground'>
              {item.hint}
            </span>
          )
        )}
      </button>
    </li>
  )

  // List-mode sections, derived from `ordered` so headers track keyboard order.
  let flatIndex = -1
  const sections: {
    group: string
    items: { item: CommandItem; index: number }[]
  }[] = []
  for (const item of ordered) {
    flatIndex += 1
    const last = sections[sections.length - 1]
    if (last && last.group === item.group) {
      last.items.push({ item, index: flatIndex })
    } else {
      sections.push({ group: item.group, items: [{ item, index: flatIndex }] })
    }
  }

  const activeId = navItems[active] ? `${listId}-opt-${active}` : undefined

  const reduced = prefersReducedMotion()
  const overlayStyle: React.CSSProperties = {
    opacity: isVisible ? 1 : 0,
    transition: reduced ? undefined : `opacity ${REVEAL_MS}ms ${REVEAL_EASING}`
  }
  const panelStyle: React.CSSProperties = {
    opacity: isVisible ? 1 : 0,
    transform: isVisible
      ? 'translate3d(0, 0, 0) scale(1)'
      : 'translate3d(0, 10px, 0) scale(0.97)',
    transition: reduced
      ? undefined
      : `opacity ${REVEAL_MS}ms ${REVEAL_EASING}, transform ${REVEAL_MS}ms ${REVEAL_EASING}`,
    willChange: reduced ? undefined : 'opacity, transform'
  }

  // Headers align with the row icon column (left edge).
  const headerClass =
    'm-0 px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.5px] text-muted-foreground'

  return (
    <div
      className='core-theme fixed inset-0 z-[1100] flex items-start justify-center px-4 pt-[12vh]'
      data-theme={themeMode === 'dark' ? 'dark' : undefined}
    >
      <button
        aria-label='Close command palette'
        className='fixed inset-0 cursor-default bg-black/30'
        style={overlayStyle}
        onClick={() => onOpenChange(false)}
        tabIndex={-1}
        type='button'
      />
      <div
        aria-label='Command palette'
        aria-modal='true'
        className='relative z-[1] flex max-h-[60vh] w-[600px] max-w-full flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-elevation-modal'
        role='dialog'
        style={panelStyle}
        onKeyDown={onKeyDown}
      >
        <div className='flex items-center gap-2.5 border-b border-border px-3.5'>
          {inAnswer ? (
            <Sparkles
              aria-hidden='true'
              className='shrink-0 text-[var(--core-color-text-link)]'
              size={16}
              strokeWidth={1.5}
            />
          ) : (
            <Search
              aria-hidden='true'
              className='shrink-0 text-muted-foreground'
              size={16}
              strokeWidth={1.5}
            />
          )}
          <input
            ref={inputRef}
            // Stable accessible name — the placeholder changes with mode and
            // vanishes on input, so it can't be the combobox's only name.
            aria-label={
              onAsk
                ? 'Search businesses, jump to a page, or ask AI'
                : 'Search businesses or jump to a page'
            }
            aria-activedescendant={activeId}
            aria-controls={listId}
            aria-expanded
            // `outline-none`, not the app's v4 spelling: that utility does not
            // exist in Tailwind v3, which this project is on, so it compiles to
            // nothing and the field keeps the browser's own ring.
            className='h-12 w-full border-0 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground'
            placeholder={
              onAsk
                ? 'Search, jump to, or ask…'
                : 'Search businesses or jump to…'
            }
            role='combobox'
            value={query}
            onChange={event => handleQueryChange(event.target.value)}
          />
        </div>

        <div aria-live='polite' className='sr-only' role='status'>
          {trimmedQuery && !inAnswer
            ? `${ordered.length} result${ordered.length === 1 ? '' : 's'}`
            : ''}
        </div>

        {inAnswer ? (
          <div className='min-h-0 flex-1 overflow-y-auto scrollbar-none p-2'>
            <button
              className='mb-1 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground'
              type='button'
              onClick={() => setAskQuery(null)}
            >
              <ArrowLeft aria-hidden='true' size={12} strokeWidth={1.75} />
              Back to results
            </button>
            <div aria-live='polite' className='px-2 pb-2'>
              <p className='m-0 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.5px] text-muted-foreground'>
                <Sparkles aria-hidden='true' size={12} strokeWidth={1.75} />
                Middesk AI
              </p>
              {thinking ? (
                <p className='m-0 mt-2 flex items-center gap-2 text-sm text-muted-foreground'>
                  <span className='size-1.5 rounded-full bg-current motion-safe:animate-pulse' />
                  Thinking…
                </p>
              ) : (
                <p className='m-0 mt-2 text-sm leading-6 text-foreground'>
                  {mockAnswer(askQuery)}
                </p>
              )}
            </div>
            {!thinking && (
              <>
                <p className='m-0 px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.5px] text-muted-foreground'>
                  Suggested next steps
                </p>
                <ul className='m-0 grid list-none gap-0.5 p-0'>
                  {suggestions.map((item, index) => renderRow(item, index))}
                </ul>
              </>
            )}
          </div>
        ) : (
          <ul
            ref={listRef}
            aria-busy={loading}
            aria-label='Results'
            className='min-h-0 flex-1 list-none overflow-y-auto scrollbar-none px-1.5 py-1'
            id={listId}
            role='listbox'
            style={buildScrollMask(scrollEdges.top, scrollEdges.bottom)}
            onScroll={syncScrollEdges}
          >
            {showBusinessSkeleton && (
              <li className='pt-0'>
                <p className={headerClass}>Businesses</p>
                <ul className='m-0 grid list-none gap-0.5 p-0'>
                  {[0, 1, 2].map(row => (
                    // Mirrors a real result row (icon + name + date) at the same
                    // height, so results fill in place with minimal shift.
                    <li
                      key={row}
                      aria-hidden='true'
                      className='flex min-h-9 items-center gap-2.5 px-2 py-1.5'
                    >
                      <span className='flex w-4 shrink-0 items-center justify-center text-muted-foreground opacity-40'>
                        <CircleCheckBig
                          aria-hidden='true'
                          size={16}
                          strokeWidth={1.5}
                        />
                      </span>
                      <span className='min-w-0 flex-1'>
                        <Skeleton
                          style={{ height: 10, width: `${[54, 42, 62][row]}%` }}
                        />
                      </span>
                      <Skeleton
                        className='shrink-0'
                        style={{ height: 10, width: 52 }}
                      />
                    </li>
                  ))}
                </ul>
              </li>
            )}
            {ordered.length === 0 && !showBusinessSkeleton && (
              <li className='px-2 py-6 text-center text-sm text-muted-foreground'>
                No results for “{trimmedQuery}”
              </li>
            )}
            {sections.map(section => (
              <li key={section.group} className='pt-2 first:pt-0'>
                <p className={headerClass}>{section.group}</p>
                <ul className='m-0 grid list-none gap-0.5 p-0'>
                  {section.items.map(({ index, item }) =>
                    renderRow(item, index)
                  )}
                </ul>
              </li>
            ))}
          </ul>
        )}

        <div className='flex items-center gap-3 border-t border-border px-3 py-2 text-[11px] text-muted-foreground'>
          <span className='flex items-center gap-1'>
            <Kbd>
              <CornerDownLeft aria-hidden='true' size={11} strokeWidth={1.75} />
            </Kbd>
            open
          </span>
          {hasPrimaryAction && (
            <span className='flex items-center gap-1'>
              <Kbd>⌘</Kbd>
              <Kbd>↵</Kbd>
              see all
            </span>
          )}
          <span className='flex items-center gap-1'>
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            navigate
          </span>
          <span className='flex items-center gap-1'>
            <Kbd>esc</Kbd>
            {inAnswer ? 'to results' : 'close'}
          </span>
        </div>
      </div>
    </div>
  )
}
