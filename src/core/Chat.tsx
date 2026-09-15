import type React from 'react'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

import {
  ArrowDown,
  ArrowUp,
  FileText,
  Image,
  Plus,
  Square,
  X
} from 'lucide-react'

import { cn } from '@/utils/twUtils'

import type { Density } from './internal/density'
import { useDensity } from './internal/density'
import { HoverCard, HoverCardContent, HoverCardTrigger } from './HoverCard'
import { ShimmerText } from './internal/shimmer'
import { Spinner } from './Spinner'

// ---------------------------------------------------------------------------
// Chat — the conversation primitives for agent chat surfaces.
// ---------------------------------------------------------------------------
//
// A small, composable family in the shadcn spirit (compare its MessageScroller
// / Message / Marker kit): the pieces ship behavior — scroll anchoring, the
// slash combobox, streaming affordances, the chip keyboard model — and stay
// agnostic about transport, markdown, and product nouns. Compose them inside
// any container (the agent dock's FloatingPanel is the intended first route
// consumer, but nothing here depends on it):
//
//   <ChatLog>
//     <ChatMarker>Run started</ChatMarker>
//     <ChatMessage role='user' chips={[biz]}>Verify this business</ChatMessage>
//     <ChatMessage role='assistant' pending />
//     <ChatMessage role='assistant'>Verified against SOS records.</ChatMessage>
//   </ChatLog>
//   <ChatComposer value={v} onChange={setV} onSubmit={send}
//     chips={chips} onRemoveChip={remove}
//     slashGroups={groups} onSlashSelect={addChip}
//     isStreaming={busy} onStop={stop} />
//
// Design decisions (researched against current practice):
// - User turns are compact tinted bubbles; assistant turns are FULL-WIDTH and
//   flat — chat-as-tool, not chat-as-SMS, and it matches the dock's flat card
//   chrome.
// - Context travels as CHIPS in the composer frame (the Cursor/Copilot
//   context-pill pattern), inserted via the `/` menu or the + button — not as
//   inline tokens inside the text (a contenteditable liability this primitive
//   deliberately avoids; an inline-token composer can layer on later).
// - The `/` menu is a W3C-combobox-style popup: DOM focus never leaves the
//   textarea; ↑/↓ move `aria-activedescendant`, Enter inserts, Esc closes and
//   restores typing. It renders inside the composer's positioning context (no
//   portal), so it never fights panel z-order and scrolls with its surface.
// - 8px rhythm throughout: 16px between turns, 24px line-height on 14px text,
//   8px inner gaps. Motion is motion-safe; `role='log'` announces new turns
//   to screen readers politely.
// - DENSITY: every sizing component takes `density?: 'standard' | 'compact'`.
//   'standard' (the default) is byte-identical to the pre-density family;
//   'compact' is the 12px `text-caption` ramp for crowded canvases, inherited
//   from a surrounding `FloatingPanel density='compact'` (the explicit prop
//   wins). Interactive targets never drop below 24px — compact travels
//   through type and whitespace, not hit areas — so `ChatChip` and
//   `ChatMessageActions`, already at that floor, are density-invariant.
//
// Readiness: prototype — API settling on the workbench specimen; adopt for
// new agent-chat surfaces and expect additive growth. Built here: log,
// message (+ action bar), marker, chip, composer (with the slash menu),
// suggestions, and attachment. Sibling modules extend the family: inline
// source citations + the message-level Sources roll-up (ChatSources.tsx) and
// the "Thought for 45s" steps disclosure (ChatThinking.tsx) — both compose
// into a message's children/footer with no message API involved. Still
// future: an inline-token composer (context inside the text, not just
// chips), day/section grouping, nested thinking substeps, and a
// markdown-driven citation pipeline.

// ---------------------------------------------------------------------------
// Shared data shapes

/** A unit of attached context — a business, an agent, a document, … */
export type ChatChipData = {
  id: string
  label: string
  /** Lucide glyph sized by the consumer (12–14px reads best). */
  icon?: React.ReactNode
  /**
   * Pop in on mount (motion-safe). Opt-in per chip: live context that ARRIVES
   * (a canvas selection streaming in) reads as arrival; static chips render
   * in place.
   */
  animateIn?: boolean
  /** Shown in a hover/focus card on the chip's label. */
  detail?: React.ReactNode
}

export type ChatSlashItem = {
  id: string
  label: string
  icon?: React.ReactNode
  /** Right-aligned muted hint, e.g. an id or a category word. */
  hint?: string
  /** Second line under the label; truncates rather than wraps. */
  description?: string
  /** Extra strings the filter should match beyond the label. */
  keywords?: string[]
  /**
   * Never filtered out — for consumer-computed rows that must always be
   * reachable (a `Create "query"…` affordance built from the live query via
   * `onSlashQueryChange`).
   */
  pinned?: boolean
  /**
   * Visible but inert — a teaching/empty-state row. Rendered muted with
   * `aria-disabled`, excluded from arrow-walking and Enter (so Enter falls
   * through to send instead of consuming the typed text on a no-op).
   */
  disabled?: boolean
}

export type ChatSlashGroup = {
  label: string
  items: ChatSlashItem[]
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// ---------------------------------------------------------------------------
// ChatChip — one attached-context token.

export type ChatChipProps = {
  chip: ChatChipData
  /** Omit for a read-only chip (e.g. echoed inside a sent message). */
  onRemove?: () => void
  className?: string
}

export const ChatChip = ({ chip, onRemove, className }: ChatChipProps) => (
  <span
    className={cn(
      'inline-flex h-6 max-w-full items-center gap-1 rounded-control border border-border',
      'bg-[var(--core-color-surface-raised)] pl-1.5 text-xs text-foreground',
      // Opt-in entrance: chips are keyed by id, so a newly-attached chip is a
      // fresh element and the animation plays once (motion-safe; reduced
      // motion renders in place).
      chip.animateIn && 'motion-safe:animate-popover-in',
      onRemove ? 'pr-0.5' : 'pr-1.5',
      className
    )}
  >
    {chip.icon && (
      <span
        aria-hidden='true'
        className='shrink-0 text-[var(--core-color-text-secondary)]'
      >
        {chip.icon}
      </span>
    )}
    {chip.detail ? (
      <HoverCard openDelay={300}>
        <HoverCardTrigger asChild>
          <span
            className='truncate decoration-dotted underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none'
            tabIndex={0}
          >
            {chip.label}
          </span>
        </HoverCardTrigger>
        <HoverCardContent className='w-72 p-3 text-sm' side='top'>
          {chip.detail}
        </HoverCardContent>
      </HoverCard>
    ) : (
      <span className='truncate'>{chip.label}</span>
    )}
    {onRemove && (
      <button
        aria-label={`Remove ${chip.label}`}
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-[calc(var(--core-radius-control)-2px)]',
          'text-[var(--core-color-text-muted)] hover:bg-[var(--core-color-state-hover-bg)] hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
        )}
        type='button'
        onClick={onRemove}
      >
        <X aria-hidden='true' size={12} strokeWidth={2} />
      </button>
    )}
  </span>
)

// ---------------------------------------------------------------------------
// ChatMarker — a labeled hairline between turns (dates, run boundaries,
// context changes). Quiet by design: caption text between two rules.

export type ChatMarkerProps = {
  children: React.ReactNode
  /** Density override; inherits from the surrounding `FloatingPanel`. */
  density?: Density
  className?: string
}

const MARKER_PAD: Record<Density, string> = {
  standard: 'py-1',
  compact: 'py-0.5'
}

export const ChatMarker = ({
  children,
  className,
  density: densityProp
}: ChatMarkerProps) => {
  const density = useDensity(densityProp)

  return (
    <div
      className={cn('flex items-center gap-2', MARKER_PAD[density], className)}
    >
      <span aria-hidden='true' className='flex-1 border-t border-border' />
      <span className='whitespace-nowrap text-caption text-[var(--core-color-text-muted)]'>
        {children}
      </span>
      <span aria-hidden='true' className='flex-1 border-t border-border' />
    </div>
  )
}

// ---------------------------------------------------------------------------
// ChatMessage — one turn.

export type ChatMessageProps = {
  role: 'user' | 'assistant'
  children?: React.ReactNode
  /**
   * Streaming placeholder: renders a motion-safe shimmer line ("Thinking…"
   * by default, or the children) instead of body content.
   */
  pending?: boolean
  /**
   * Marks a turn still being written (`aria-busy`). Inside a `role='log'`
   * live region this keeps screen readers from announcing every appended
   * word — the finished turn announces once when busy clears.
   */
  busy?: boolean
  /** Context the user attached, echoed above their text as read-only chips. */
  chips?: ChatChipData[]
  /** Caption row above the body — sender name, timestamp. */
  header?: React.ReactNode
  /** Row below the body — action bars (copy, retry) slot in here later. */
  footer?: React.ReactNode
  /** Density override; inherits from the surrounding `FloatingPanel`. */
  density?: Density
  className?: string
}

// Body type per density. `text-caption`'s 20px line-height rides in its
// fontSize tuple — no sibling `leading-*` for tailwind-merge to drop.
const MESSAGE_BODY_TYPE: Record<Density, string> = {
  standard: 'text-sm leading-6',
  compact: 'text-caption'
}

const USER_BUBBLE_PAD: Record<Density, string> = {
  standard: 'gap-1.5 px-3 py-2',
  compact: 'gap-1 px-2.5 py-1.5'
}

/** Motion-safe shimmer: reduced-motion users get plain secondary text. */
const PendingShimmer = ({
  children,
  density
}: {
  children: React.ReactNode
  density: Density
}) => (
  <ShimmerText className={MESSAGE_BODY_TYPE[density]}>{children}</ShimmerText>
)

export const ChatMessage = ({
  role,
  children,
  pending = false,
  busy = false,
  chips,
  header,
  footer,
  density: densityProp,
  className
}: ChatMessageProps) => {
  const density = useDensity(densityProp)
  const body = pending ? (
    <PendingShimmer density={density}>{children ?? 'Thinking…'}</PendingShimmer>
  ) : (
    <div
      className={cn(
        'whitespace-pre-wrap break-words text-foreground',
        MESSAGE_BODY_TYPE[density]
      )}
    >
      {children}
    </div>
  )

  if (role === 'user') {
    return (
      <div className={cn('group/message flex justify-end', className)}>
        <div
          className={cn(
            'flex max-w-[85%] flex-col rounded-card bg-[var(--core-color-surface-subtle)]',
            USER_BUBBLE_PAD[density]
          )}
        >
          {chips && chips.length > 0 && (
            <div className='flex flex-wrap gap-1'>
              {chips.map(chip => (
                <ChatChip chip={chip} key={chip.id} />
              ))}
            </div>
          )}
          {body}
        </div>
      </div>
    )
  }

  return (
    <div
      aria-busy={busy || pending || undefined}
      className={cn('group/message flex flex-col gap-1', className)}
    >
      {header && (
        <div className='text-caption text-[var(--core-color-text-muted)]'>
          {header}
        </div>
      )}
      {body}
      {footer && <div className='flex items-center gap-1'>{footer}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ChatMessageActions — the quiet per-turn action bar (copy, retry, rating).
// Slot it into `ChatMessage footer`, data-driven by an `actions` list (one
// opinionated shape rather than exposing a separate button primitive). With
// `revealOnHover`, the bar shows on hover/focus at the `md` breakpoint and up
// (desktop widths), and stays always-visible below it — narrow/touch layouts
// where hover is unreliable.

/** One entry in a ChatMessageActions bar. */
export type ChatMessageActionItem = {
  id: string
  /** Lucide glyph, sized by the consumer (14px reads best). */
  icon: React.ReactNode
  /** Accessible name; also the pointer tooltip. */
  label: string
  onClick?: () => void
  /** Toggled state for rating-style actions — sets `aria-pressed`. */
  active?: boolean
  disabled?: boolean
}

export type ChatMessageActionsProps = {
  actions: ChatMessageActionItem[]
  /** Fade in on message hover/focus (desktop); always visible below `md`. */
  revealOnHover?: boolean
  /** Accessible name for the action group. */
  label?: string
  className?: string
}

export const ChatMessageActions = ({
  actions,
  revealOnHover = false,
  label = 'Message actions',
  className
}: ChatMessageActionsProps) => (
  <div
    aria-label={label}
    className={cn(
      'flex items-center gap-0.5',
      revealOnHover &&
        'md:opacity-0 md:transition-opacity md:duration-fast md:focus-within:opacity-100 md:group-hover/message:opacity-100 md:motion-reduce:transition-none',
      className
    )}
    role='group'
  >
    {actions.map(action => (
      <button
        aria-label={action.label}
        aria-pressed={action.active}
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded-control',
          'text-[var(--core-color-text-muted)] hover:bg-[var(--core-color-state-hover-bg)] hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          action.active && 'text-[var(--core-color-interactive-default)]'
        )}
        disabled={action.disabled}
        key={action.id}
        title={action.label}
        type='button'
        onClick={action.onClick}
      >
        {action.icon}
      </button>
    ))}
  </div>
)

// ---------------------------------------------------------------------------
// ChatSuggestions — tappable follow-ups below a reply (or as a welcome).
// Pure presentation over consumer data; selecting typically sends the label
// as the next user turn or fills the composer.

export type ChatSuggestion = {
  id: string
  label: string
}

export type ChatSuggestionsProps = {
  suggestions: ChatSuggestion[]
  onSelect: (suggestion: ChatSuggestion) => void
  disabled?: boolean
  /** Accessible name for the group. */
  label?: string
  /** Density override; inherits from the surrounding `FloatingPanel`. */
  density?: Density
  className?: string
}

// Compact pills land exactly on the 24px target floor — never lower.
const SUGGESTION_PILL: Record<Density, string> = {
  standard: 'h-7 px-3 text-sm',
  compact: 'h-6 px-2.5 text-caption'
}

export const ChatSuggestions = ({
  suggestions,
  onSelect,
  disabled = false,
  label = 'Suggestions',
  density: densityProp,
  className
}: ChatSuggestionsProps) => {
  const density = useDensity(densityProp)

  if (suggestions.length === 0) return null

  return (
    <div
      aria-label={label}
      className={cn('flex flex-wrap gap-1.5', className)}
      role='group'
    >
      {suggestions.map(suggestion => (
        <button
          className={cn(
            'max-w-full truncate rounded-pill border border-border text-foreground',
            SUGGESTION_PILL[density],
            'hover:border-[var(--core-color-border-strong)] hover:bg-[var(--core-color-state-hover-bg)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50'
          )}
          disabled={disabled}
          key={suggestion.id}
          type='button'
          onClick={() => onSelect(suggestion)}
        >
          {suggestion.label}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ChatAttachment — a file/image card for turns and (later) the composer.
// Display-only contract: upload transport stays with the consumer; `status`
// narrates it honestly.

export type ChatAttachmentData = {
  id: string
  name: string
  /** Caption line — 'PDF · 1.2 MB', a page count, a source. */
  meta?: string
  kind?: 'file' | 'image'
}

export type ChatAttachmentProps = {
  attachment: ChatAttachmentData
  status?: 'uploading' | 'ready' | 'error'
  /** Renders the name as a button — open a preview, download, … */
  onOpen?: () => void
  /** Renders a trailing remove control (composer-side usage). */
  onRemove?: () => void
  /** Density override; inherits from the surrounding `FloatingPanel`. */
  density?: Density
  className?: string
}

const ATTACHMENT_CARD: Record<Density, string> = {
  standard: 'h-11',
  compact: 'h-10'
}

const ATTACHMENT_NAME: Record<Density, string> = {
  standard: 'text-sm leading-5',
  compact: 'text-dense leading-4'
}

export const ChatAttachment = ({
  attachment,
  status = 'ready',
  onOpen,
  onRemove,
  density: densityProp,
  className
}: ChatAttachmentProps) => {
  const density = useDensity(densityProp)
  const Glyph = attachment.kind === 'image' ? Image : FileText
  const meta =
    status === 'uploading'
      ? 'Uploading…'
      : status === 'error'
        ? 'Upload failed'
        : attachment.meta

  const body = (
    <span className='flex min-w-0 flex-col text-left'>
      <span
        className={cn('truncate text-foreground', ATTACHMENT_NAME[density])}
      >
        {attachment.name}
      </span>
      {meta && (
        <span
          className={cn(
            'truncate text-caption leading-4',
            status === 'error'
              ? 'text-[var(--core-color-status-danger-fg)]'
              : 'text-[var(--core-color-text-muted)]'
          )}
        >
          {meta}
        </span>
      )}
    </span>
  )

  return (
    <span
      className={cn(
        'inline-flex max-w-64 items-center gap-2 rounded-control border px-2.5',
        ATTACHMENT_CARD[density],
        status === 'error'
          ? 'border-[var(--core-color-status-danger-border)] bg-[var(--core-color-status-danger-bg)]'
          : 'border-border bg-[var(--core-color-surface-raised)]',
        onRemove ? 'pr-1' : 'pr-2.5',
        className
      )}
    >
      <span
        aria-hidden='true'
        className='flex shrink-0 items-center text-[var(--core-color-text-secondary)]'
      >
        {status === 'uploading' ? (
          <Spinner label={false} size='sm' tone='muted' />
        ) : (
          <Glyph size={density === 'compact' ? 14 : 16} strokeWidth={1.75} />
        )}
      </span>
      {onOpen ? (
        <button
          className='min-w-0 rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          type='button'
          onClick={onOpen}
        >
          {body}
        </button>
      ) : (
        body
      )}
      {onRemove && (
        <button
          aria-label={`Remove ${attachment.name}`}
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded-[calc(var(--core-radius-control)-2px)]',
            'text-[var(--core-color-text-muted)] hover:bg-[var(--core-color-state-hover-bg)] hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          )}
          type='button'
          onClick={onRemove}
        >
          <X aria-hidden='true' size={12} strokeWidth={2} />
        </button>
      )}
    </span>
  )
}

// ---------------------------------------------------------------------------
// ChatLog — the conversation scroll region.

export type ChatLogProps = {
  children: React.ReactNode
  /** Accessible name for the log region. */
  label?: string
  /** Density override; inherits from the surrounding `FloatingPanel`. */
  density?: Density
  className?: string
  /** Extra classes for the inner scroll viewport. */
  viewportClassName?: string
}

const LOG_VIEWPORT: Record<Density, string> = {
  standard: 'gap-4 px-4 py-4',
  compact: 'gap-3 px-3 py-3'
}

const LOG_JUMP_PILL: Record<Density, string> = {
  standard: 'h-7 w-7',
  compact: 'h-6 w-6'
}

/**
 * `role='log'` (implicitly polite aria-live) so appended turns are announced.
 * Sticks to the bottom while the reader is there; releases the moment they
 * scroll up, and offers a "Jump to latest" pill instead of yanking the view.
 * A mask fades the top edge once content scrolls under it.
 */
export const ChatLog = ({
  children,
  label = 'Conversation',
  density: densityProp,
  className,
  viewportClassName
}: ChatLogProps) => {
  const density = useDensity(densityProp)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const stickRef = useRef(true)
  const [isDetached, setIsDetached] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  const scrollToBottom = useCallback((smooth: boolean) => {
    const el = viewportRef.current
    if (!el) return
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto'
    })
  }, [])

  const handleScroll = useCallback(() => {
    const el = viewportRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24
    stickRef.current = atBottom
    setIsDetached(!atBottom)
    setIsScrolled(el.scrollTop > 4)
  }, [])

  // Follow growing content (new turns, streaming tokens) only while stuck to
  // the bottom — never fight a reader who scrolled up.
  useEffect(() => {
    const el = viewportRef.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(() => {
      if (stickRef.current) scrollToBottom(false)
    })
    for (const child of Array.from(el.children)) observer.observe(child)
    const mutation = new MutationObserver(() => {
      observer.disconnect()
      for (const child of Array.from(el.children)) observer.observe(child)
      if (stickRef.current) scrollToBottom(false)
    })
    mutation.observe(el, { childList: true })
    return () => {
      observer.disconnect()
      mutation.disconnect()
    }
  }, [scrollToBottom])

  return (
    <div className={cn('relative flex min-h-0 flex-1 flex-col', className)}>
      <div
        aria-label={label}
        className={cn(
          'flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain',
          LOG_VIEWPORT[density],
          // Fade the top edge once content slides under it — a mask works on
          // any surface color, unlike a gradient overlay.
          isScrolled &&
            '[mask-image:linear-gradient(to_bottom,transparent,black_24px)]',
          viewportClassName
        )}
        ref={viewportRef}
        role='log'
        onScroll={handleScroll}
      >
        {children}
      </div>
      {isDetached && (
        <button
          aria-label='Jump to latest'
          className={cn(
            'absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center justify-center',
            LOG_JUMP_PILL[density],
            'rounded-pill border border-border bg-[var(--core-color-surface-raised)] text-foreground',
            'shadow-elevation-raised hover:bg-[var(--core-color-state-hover-bg)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'motion-safe:animate-popover-in'
          )}
          type='button'
          onClick={() => scrollToBottom(true)}
        >
          <ArrowDown
            aria-hidden='true'
            size={density === 'compact' ? 12 : 14}
            strokeWidth={2}
          />
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ChatComposer — chips + auto-grow textarea + slash combobox + send/stop.

export type ChatComposerProps = {
  value: string
  onChange: (value: string) => void
  /** Fires on Enter (without Shift) and on the send button. */
  onSubmit: () => void
  /** Attached context, rendered as removable chips inside the frame. */
  chips?: ChatChipData[]
  onRemoveChip?: (id: string) => void
  /** Grouped items for the `/` menu; omit to disable the slash affordance. */
  slashGroups?: ChatSlashGroup[]
  /** Called when a slash item is chosen — typically appends a chip. */
  onSlashSelect?: (item: ChatSlashItem) => void
  /** Slash items still loading (e.g. a search-backed group) — skeleton rows. */
  slashLoading?: boolean
  /**
   * Observe the live `/` query: `null` = menu closed, `''` = just opened,
   * else the text after the `/`. Lets a consumer recompute `slashGroups` per
   * keystroke (search-backed items, `Create "query"` rows). MEMOIZE the
   * callback — it's an effect dependency.
   */
  onSlashQueryChange?: (query: string | null) => void
  /**
   * Keep the menu open when the query contains spaces (multi-word entity
   * names — required by create-from-query affordances). Default off: a space
   * ends the query and returns the `/` to plain typing.
   */
  slashAllowSpaces?: boolean
  /** Swaps send → stop and marks the busy state. */
  isStreaming?: boolean
  onStop?: () => void
  disabled?: boolean
  /**
   * Product gating beyond the built-in emptiness check — e.g. a run
   * launcher that needs at least one agent chip. Enter and the send button
   * both respect it.
   */
  sendDisabled?: boolean
  /**
   * The action row's left slot, next to `+`: a quiet caption (explain gating,
   * hint at `/`) or a small quiet ACTION (a standing suggested ask). The slot
   * truncates — an interactive child should use an inset focus ring.
   */
  hint?: React.ReactNode
  /** Labels the `+` context button; also its accessible name. */
  attachLabel?: string
  /** Visible lines before auto-grow takes over (default 1). */
  minRows?: number
  /** Where the `/` menu opens (default `above`). */
  menuPlacement?: 'above' | 'below'
  /** Class for the menu's scroll container (override `max-h-*` here). */
  menuClassName?: string
  /** The textarea, for a host's `initialFocusRef` or an imperative focus. */
  inputRef?: React.RefObject<HTMLTextAreaElement | null>
  /** `quiet` darkens the frame's border on focus instead of the 2px ring. */
  focusRing?: 'standard' | 'quiet'
  placeholder?: string
  autoFocus?: boolean
  /** Accessible name for the input. */
  label?: string
  /** Density override; inherits from the surrounding `FloatingPanel`. */
  density?: Density
  className?: string
}

const MAX_VISIBLE_OPTIONS_CLASS = 'max-h-64'

// Compact textarea keeps the same identity as standard's 40 = 24lh + 16px pad:
// 36 = 20lh + 16px pad. The action row's padding holds — the buttons shrink to
// the 24px floor instead, keeping their padded hit zones.
const COMPOSER_INPUT: Record<Density, string> = {
  standard: 'max-h-36 min-h-10 px-3 py-2 text-sm leading-6',
  compact: 'max-h-32 min-h-9 px-2.5 py-2 text-caption'
}

const COMPOSER_CHIP_TRAY: Record<Density, string> = {
  standard: 'px-2.5 pt-2',
  compact: 'px-2 pt-1.5'
}

const COMPOSER_BUTTON: Record<Density, string> = {
  standard: 'h-7 w-7',
  compact: 'h-6 w-6'
}

const COMPOSER_ATTACH_LABELED: Record<Density, string> = {
  standard: 'h-7 gap-1.5 px-2 text-sm',
  compact: 'h-6 gap-1 px-1.5 text-caption'
}

// Slash rows are the only keyboard path to node selection — 24px minimum even
// compact (20px caption line + py-1 = 28px).
const SLASH_OPTION: Record<Density, string> = {
  standard: 'py-1.5 text-sm',
  compact: 'py-1 text-caption'
}

const SLASH_EMPTY_TYPE: Record<Density, string> = {
  standard: 'text-sm',
  compact: 'text-caption'
}

/** A DOM id for an option row. Item ids are consumer strings and may contain
 *  whitespace (a `Create "Acme Holdings"` row built from the live query), which
 *  an `aria-activedescendant` IDREF cannot address — so collapse it here,
 *  where the id is minted, rather than trusting every consumer to. */
const optionDomId = (listboxId: string, itemId: string) =>
  `${listboxId}-${itemId.replace(/\s+/g, '_')}`

export const ChatComposer = ({
  value,
  onChange,
  onSubmit,
  chips = [],
  onRemoveChip,
  slashGroups,
  onSlashSelect,
  slashLoading = false,
  onSlashQueryChange,
  slashAllowSpaces = false,
  isStreaming = false,
  onStop,
  disabled = false,
  sendDisabled = false,
  hint,
  attachLabel,
  minRows = 1,
  menuPlacement = 'above',
  menuClassName,
  inputRef,
  focusRing = 'standard',
  placeholder = 'Message…',
  autoFocus = false,
  label = 'Message',
  density: densityProp,
  className
}: ChatComposerProps) => {
  const density = useDensity(densityProp)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const setTextareaRef = useCallback(
    (node: HTMLTextAreaElement | null) => {
      textareaRef.current = node
      if (inputRef) inputRef.current = node
    },
    [inputRef]
  )
  const listboxRef = useRef<HTMLDivElement | null>(null)
  const listboxId = useId()
  // Index of the '/' that opened the menu; null = closed.
  const [slashIndex, setSlashIndex] = useState<number | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  const slashEnabled = Boolean(slashGroups?.length && onSlashSelect)
  const isOpen = slashEnabled && slashIndex !== null
  const query = isOpen && slashIndex !== null ? value.slice(slashIndex + 1) : ''

  const filteredGroups = useMemo(() => {
    if (!isOpen || !slashGroups) return []
    const q = query.trim().toLowerCase()
    return slashGroups
      .map(group => ({
        ...group,
        items: group.items.filter(
          item =>
            item.pinned ||
            q === '' ||
            item.label.toLowerCase().includes(q) ||
            item.keywords?.some(k => k.toLowerCase().includes(q))
        )
      }))
      .filter(group => group.items.length > 0)
  }, [isOpen, slashGroups, query])

  // One observation point covers every path: typed-slash open, the + button
  // (which sets slashIndex directly), all close sites, and each keystroke —
  // `query` re-derives from the controlled value.
  useEffect(() => {
    onSlashQueryChange?.(isOpen ? query : null)
  }, [isOpen, query, onSlashQueryChange])
  // …and the composer unmounting counts as "menu closed": without this, a
  // consumer holding the query in state is left stale (via a ref so the
  // cleanup never fires between keystrokes).
  const onSlashQueryChangeRef = useRef(onSlashQueryChange)
  onSlashQueryChangeRef.current = onSlashQueryChange
  useEffect(() => () => onSlashQueryChangeRef.current?.(null), [])

  // Disabled rows stay visible in their groups but never enter the active/
  // Enter-selection walk.
  const flatItems = useMemo(
    () =>
      filteredGroups.flatMap(group =>
        group.items.filter(item => !item.disabled)
      ),
    [filteredGroups]
  )

  // First option is active whenever the filtered set changes.
  useEffect(() => {
    if (!isOpen) return
    setActiveId(current =>
      current && flatItems.some(item => item.id === current)
        ? current
        : (flatItems[0]?.id ?? null)
    )
  }, [isOpen, flatItems])

  // Keep the active option in view as ↑/↓ walk the list. (Match via dataset
  // rather than a CSS selector — ids are consumer strings, and CSS.escape is
  // not everywhere.)
  useEffect(() => {
    if (!isOpen || !activeId || !listboxRef.current) return
    for (const option of Array.from(
      listboxRef.current.querySelectorAll<HTMLElement>('[data-option-id]')
    )) {
      if (option.dataset.optionId === activeId) {
        option.scrollIntoView?.({ block: 'nearest' })
        break
      }
    }
  }, [isOpen, activeId])

  const closeMenu = useCallback(() => {
    setSlashIndex(null)
    setActiveId(null)
  }, [])

  const autoGrow = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])

  // Resize for controlled `value` changes that don't come through the local
  // handlers — a restored draft on mount, or a consumer filling the composer
  // from a suggestion. The handler-side rAF calls stay for their own paths.
  useEffect(() => {
    autoGrow()
  }, [value, autoGrow])

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = event.target.value
    const caret = event.target.selectionStart ?? next.length

    if (slashEnabled) {
      if (slashIndex === null) {
        // Open on a '/' typed at the start or after whitespace.
        const typedSlash =
          next[caret - 1] === '/' &&
          (caret === 1 || /\s/.test(next[caret - 2] ?? ''))
        if (typedSlash) setSlashIndex(caret - 1)
      } else if (
        next[slashIndex] !== '/' ||
        (!slashAllowSpaces && /\s/.test(next.slice(slashIndex + 1))) ||
        /^\s/.test(next.slice(slashIndex + 1))
      ) {
        // The trigger was deleted, or a space ended the query (unless the
        // consumer allows multi-word queries). A query that STARTS with
        // whitespace closes unconditionally — "compare a / b" is punctuation,
        // not a command, and without this escape hatch `slashAllowSpaces` +
        // always-present `pinned` items would capture Enter for the rest of
        // the message (send becomes impossible; Enter fires a pinned action).
        closeMenu()
      }
    }

    onChange(next)
    requestAnimationFrame(autoGrow)
  }

  const selectItem = (item: ChatSlashItem) => {
    if (slashIndex !== null) {
      // Remove the `/query` text the menu consumed.
      onChange(value.slice(0, slashIndex))
    }
    onSlashSelect?.(item)
    closeMenu()
    textareaRef.current?.focus()
    requestAnimationFrame(autoGrow)
  }

  const moveActive = (delta: 1 | -1) => {
    if (flatItems.length === 0) return
    const index = flatItems.findIndex(item => item.id === activeId)
    const next = (index + delta + flatItems.length) % flatItems.length
    setActiveId(flatItems[next]?.id ?? null)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isOpen) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        moveActive(event.key === 'ArrowDown' ? 1 : -1)
        return
      }
      if (event.key === 'Enter' && !event.shiftKey) {
        const active = flatItems.find(item => item.id === activeId)
        if (active) {
          event.preventDefault()
          selectItem(active)
          return
        }
      }
      if (event.key === 'Escape') {
        // Consume it: inside a FloatingPanel, Esc otherwise minimizes.
        event.preventDefault()
        event.stopPropagation()
        closeMenu()
        return
      }
      if (event.key === 'Tab') closeMenu()
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (canSubmit) {
        onSubmit()
        requestAnimationFrame(autoGrow)
      }
      return
    }

    if (
      event.key === 'Backspace' &&
      value === '' &&
      chips.length > 0 &&
      onRemoveChip
    ) {
      event.preventDefault()
      onRemoveChip(chips[chips.length - 1].id)
    }
  }

  // The + button is the pointer path to the same menu the `/` key opens.
  const openMenuFromButton = () => {
    if (!slashEnabled || disabled) return
    const needsSpace = value.length > 0 && !/\s$/.test(value)
    const next = `${value}${needsSpace ? ' ' : ''}/`
    onChange(next)
    setSlashIndex(next.length - 1)
    textareaRef.current?.focus()
  }

  const canSubmit =
    !disabled &&
    !isStreaming &&
    !sendDisabled &&
    (value.trim().length > 0 || chips.length > 0)

  return (
    <div className={cn('relative', className)}>
      {isOpen && (
        // The painted surface never scrolls — the inner viewport does. With
        // both on one element, macOS elastic overscroll translates the
        // content past the painted background and whatever sits behind the
        // menu bleeds through; `overscroll-contain` also stops the scroll
        // from chaining into the conversation underneath.
        <div
          className={cn(
            menuPlacement === 'below'
              ? 'absolute left-0 right-0 top-full z-10 mt-2 overflow-hidden'
              : 'absolute bottom-full left-0 right-0 z-10 mb-2 overflow-hidden',
            'rounded-card border border-border bg-[var(--core-color-surface-raised)] shadow-elevation-popover',
            'motion-safe:animate-popover-in'
          )}
        >
          <div
            aria-label='Context menu'
            className={cn(
              'overflow-y-auto overscroll-contain p-1',
              MAX_VISIBLE_OPTIONS_CLASS,
              menuClassName
            )}
            id={listboxId}
            ref={listboxRef}
            role='listbox'
          >
            {slashLoading && (
              <div aria-hidden='true' role='presentation'>
                {[0, 1, 2].map(row => (
                  <div
                    className='flex items-center gap-2 px-2 py-1.5'
                    key={row}
                  >
                    <span className='h-3.5 w-3.5 shrink-0 animate-pulse rounded bg-[var(--core-color-surface-subtle)] motion-reduce:animate-none' />
                    <span
                      className='h-3.5 animate-pulse rounded bg-[var(--core-color-surface-subtle)] motion-reduce:animate-none'
                      style={{ width: `${[60, 40, 50][row]}%` }}
                    />
                  </div>
                ))}
              </div>
            )}
            {filteredGroups.map((group, groupIndex) => (
              // role='group' + aria-labelledby so screen readers announce the
              // group name ('Businesses', 'Agents') as options are traversed;
              // role='presentation' would strip the label from the a11y tree.
              // The id is derived from the INDEX, never the label: an
              // `aria-labelledby` value is a space-separated IDREF list, so a
              // label containing whitespace ('Businesses · 5') tokenizes into
              // several ids that don't exist and the announcement is silently
              // dropped. `key` still keys on the label.
              <div
                aria-labelledby={`${listboxId}-group-${groupIndex}`}
                key={group.label}
                role='group'
              >
                <div
                  className='px-2 pb-1 pt-2 text-caption font-medium text-[var(--core-color-text-muted)]'
                  id={`${listboxId}-group-${groupIndex}`}
                >
                  {group.label}
                </div>
                {group.items.map(item => (
                  <div
                    aria-disabled={item.disabled || undefined}
                    aria-selected={item.id === activeId}
                    className={cn(
                      'flex items-center gap-2 rounded-control px-2',
                      SLASH_OPTION[density],
                      item.disabled
                        ? 'text-[var(--core-color-text-muted)]'
                        : 'cursor-pointer text-foreground',
                      item.id === activeId &&
                        'bg-[var(--core-color-state-hover-bg)]'
                    )}
                    data-option-id={item.id}
                    id={optionDomId(listboxId, item.id)}
                    key={item.id}
                    role='option'
                    // Mouse selection must not steal focus from the textarea.
                    onMouseDown={event => event.preventDefault()}
                    onClick={item.disabled ? undefined : () => selectItem(item)}
                    onMouseMove={
                      item.disabled ? undefined : () => setActiveId(item.id)
                    }
                  >
                    {item.icon && (
                      <span
                        aria-hidden='true'
                        className='shrink-0 text-[var(--core-color-text-secondary)]'
                      >
                        {item.icon}
                      </span>
                    )}
                    <span className='flex min-w-0 flex-1 flex-col'>
                      <span className='truncate'>{item.label}</span>
                      {item.description && (
                        <span className='truncate text-caption text-[var(--core-color-text-secondary)]'>
                          {item.description}
                        </span>
                      )}
                    </span>
                    {item.hint && (
                      <span className='shrink-0 text-caption text-[var(--core-color-text-muted)]'>
                        {item.hint}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ))}
            {!slashLoading &&
              filteredGroups.every(group => group.items.length === 0) && (
                <div
                  className={cn(
                    'px-2 py-2 text-[var(--core-color-text-secondary)]',
                    SLASH_EMPTY_TYPE[density]
                  )}
                >
                  No matches
                </div>
              )}
          </div>
        </div>
      )}

      <div
        className={cn(
          'flex flex-col rounded-card border border-border bg-[var(--core-color-surface-raised)]',
          focusRing === 'quiet'
            ? 'transition-colors duration-fast focus-within:border-[var(--core-color-border-bold)]'
            : 'transition-shadow duration-fast focus-within:ring-2 focus-within:ring-ring',
          disabled && 'bg-[var(--core-color-surface-subtle)] opacity-70'
        )}
      >
        {chips.length > 0 && (
          <div
            className={cn('flex flex-wrap gap-1', COMPOSER_CHIP_TRAY[density])}
          >
            {chips.map(chip => (
              <ChatChip
                chip={chip}
                key={chip.id}
                onRemove={
                  onRemoveChip ? () => onRemoveChip(chip.id) : undefined
                }
              />
            ))}
          </div>
        )}
        <textarea
          aria-activedescendant={
            isOpen && activeId ? optionDomId(listboxId, activeId) : undefined
          }
          aria-autocomplete={slashEnabled ? 'list' : undefined}
          aria-controls={isOpen ? listboxId : undefined}
          aria-expanded={slashEnabled ? isOpen : undefined}
          // aria-haspopup, not role='combobox': this is a multi-line message
          // composer with inline autocomplete, not a single-value combobox —
          // the textbox role + expanded/activedescendant is the right fit.
          aria-haspopup={slashEnabled ? 'listbox' : undefined}
          aria-label={label}
          autoFocus={autoFocus}
          className={cn(
            'w-full resize-none bg-transparent',
            COMPOSER_INPUT[density],
            'text-foreground placeholder:text-[var(--core-color-text-muted)]',
            'focus:outline-none disabled:cursor-not-allowed'
          )}
          disabled={disabled}
          placeholder={placeholder}
          ref={setTextareaRef}
          rows={minRows}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />
        <div className='flex items-center justify-between gap-2 px-2 pb-2'>
          <div className='flex min-w-0 items-center gap-2'>
            {slashEnabled && (
              <button
                aria-label={attachLabel ?? 'Add context'}
                className={cn(
                  'flex items-center justify-center rounded-control border border-border',
                  attachLabel
                    ? COMPOSER_ATTACH_LABELED[density]
                    : COMPOSER_BUTTON[density],
                  attachLabel
                    ? 'text-foreground'
                    : 'text-[var(--core-color-text-secondary)]',
                  'hover:bg-[var(--core-color-state-hover-bg)] hover:text-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:cursor-not-allowed disabled:opacity-50'
                )}
                disabled={disabled}
                type='button'
                onClick={openMenuFromButton}
              >
                <Plus
                  aria-hidden='true'
                  className={
                    attachLabel
                      ? 'shrink-0 text-[var(--core-color-text-secondary)]'
                      : undefined
                  }
                  size={density === 'compact' ? 12 : 14}
                  strokeWidth={2}
                />
                {attachLabel && <span className='truncate'>{attachLabel}</span>}
              </button>
            )}
            {hint && (
              <span className='min-w-0 truncate text-caption text-[var(--core-color-text-muted)]'>
                {hint}
              </span>
            )}
          </div>
          {isStreaming && onStop ? (
            <button
              aria-label='Stop generating'
              className={cn(
                'flex items-center justify-center rounded-control border border-border',
                COMPOSER_BUTTON[density],
                'text-foreground hover:bg-[var(--core-color-state-hover-bg)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              )}
              type='button'
              onClick={onStop}
            >
              <Square
                aria-hidden='true'
                fill='currentColor'
                size={10}
                strokeWidth={0}
              />
            </button>
          ) : (
            <button
              aria-label='Send message'
              className={cn(
                'flex items-center justify-center rounded-control',
                COMPOSER_BUTTON[density],
                'bg-[var(--core-color-interactive-default)] text-[var(--core-color-text-inverse)]',
                'hover:bg-[var(--core-color-interactive-hover)] active:bg-[var(--core-color-interactive-active)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'disabled:cursor-not-allowed disabled:opacity-40'
              )}
              disabled={!canSubmit}
              type='button'
              onClick={() => {
                if (canSubmit) {
                  onSubmit()
                  requestAnimationFrame(autoGrow)
                  textareaRef.current?.focus()
                }
              }}
            >
              <ArrowUp
                aria-hidden='true'
                size={density === 'compact' ? 12 : 14}
                strokeWidth={2}
              />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
