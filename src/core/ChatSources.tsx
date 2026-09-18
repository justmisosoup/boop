import type React from 'react'

import { middleEllipsis } from '@/utils/stringUtils'
import { cn } from '@/utils/twUtils'

import type { CoreThemeMode } from './CoreTheme'
import { toneFromLabel } from './internal/identityTone'
import { HoverCard, HoverCardContent, HoverCardTrigger } from './HoverCard'
import { Popover, PopoverContent, PopoverTrigger } from './Popover'

// ---------------------------------------------------------------------------
// ChatSources — citation primitives for the Chat family.
// ---------------------------------------------------------------------------
//
// Two components over one data contract: `ChatSourceChip` is the inline
// citation token composed into a `ChatMessage`'s children right after the
// claim it supports (the Perplexity placement — the chip sits where doubt
// arises); `ChatSources` is the message-level roll-up that slots into the
// message `footer`. Both stay quiet until the reader leans in.
//
// Design decisions:
// - ONE interaction grammar: click commits, hover only enriches. A chip for a
//   single source is a real link (or an `onSelect` button for in-app sources)
//   whose HoverCard is an optional sighted-pointer preview — never the only
//   path, per the HoverCard contract. A chip citing several sources is a
//   Popover trigger (`label +N`): the answer to "what's behind this?" is a
//   list, and a list must be keyboard/touch/SR-reachable, which a hover body
//   is not. No pager inside the hover card, ever.
// - Glyphs are deterministic letter tiles (the Avatar tint hash over the
//   domain) unless the consumer passes `icon`. No favicon service: core makes
//   no network requests, and a compliance dashboard shouldn't leak the
//   domains it verified to a third-party favicon endpoint.
// - Trust is a text slot, not a color system: `annotation` carries the
//   provenance note ('Government registry') as a muted byline. Product maps
//   its tier vocabulary to copy; core stays noun-free.
// - Empty is honest: no sources, no chip, no row — a citation UI must never
//   decorate. Sources without a `url` or `onSelect` render as static text
//   (no hover card either — a preview reachable only by pointer would be the
//   sole home of that information, which the HoverCard contract forbids).
// - Inline geometry (the References.tsx lessons): the chip is an
//   inline-block whose 18px box (16px line + 2px padding) rides inside both
//   the standard 24px and compact 20px line struts, so lines with citations
//   measure exactly like lines without. The chip text is bounded at the TEXT
//   layer (`middleEllipsis`) — `overflow-hidden` on an inline-block moves its
//   baseline to the bottom margin edge (CSS 2.1 §10.8.1), so only the fixed
//   glyph boxes clip, each with an explicit optical `align-[-…]`.
// - Density: chips and the roll-up are density-invariant — both already sit
//   at the family's 24px interactive floor; compact travels through type and
//   whitespace elsewhere.
//
// Readiness: prototype — settling on the workbench beside the rest of the
// Chat family; the agent dock is the intended first consumer.

/**
 * One cited source behind a claim or a reply — a registry page, a news
 * article, a filed document. Product-agnostic: `url` is optional because some
 * sources open in-app (an evidence panel, a document viewer) via `onSelect`.
 * A source with neither renders as static text, so give every source a real
 * destination whenever one exists.
 */
export type ChatSourceData = {
  id: string
  /** Display name — the list-row title and the chip text when no `domain`.
   *  Chips read best with short, lowercase labels (the domain convention). */
  label: string
  /** Opens in a new tab from the chip and the list row. */
  url?: string
  /** In-app open path for url-less sources; ignored when `url` is present. */
  onSelect?: () => void
  /** Short host ('sos.ca.gov') — the chip text and the preview byline.
   *  Derived from `url` (www. stripped) when omitted. */
  domain?: string
  /** Preview-card headline; falls back to `label`. */
  title?: string
  /** Up to ~3 lines of quote/summary, shown only in the hover preview. */
  snippet?: string
  /** Short provenance/trust note ('Government registry', 'News · 2024') —
   *  muted byline in the preview and list rows. The trust slot: product maps
   *  its source-tier vocabulary to copy here; core stays noun-free. */
  annotation?: string
  /** Custom glyph (a favicon `<img>`, a product mark) sized by the consumer
   *  (12–16px reads best). Falls back to a deterministic letter tile. */
  icon?: React.ReactNode
}

// Same derivation as the BusinessHome source cards (which core cannot import)
// — keep the two in step if the rule ever grows.
const extractDomain = (url: string): string | undefined => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return undefined
  }
}

const sourceDomain = (source: ChatSourceData): string | undefined =>
  source.domain ?? (source.url ? extractDomain(source.url) : undefined)

/** Chip text budget — single-line nowrap tokens must bound at the text layer. */
const CHIP_TEXT_MAX = 28

// ---------------------------------------------------------------------------
// SourceGlyph — the identity tile: consumer icon, else a letter on the
// deterministic Avatar tint. Square with a small radius (favicon-like), so it
// never reads as a person — Avatar keeps the circle.

const GLYPH_BOX: Record<12 | 16, string> = { 12: 'size-3', 16: 'size-4' }
// Decorative glyph letter, not body text — sized to the tile like a mark's
// path, kept inline so the dynamic value stays clear of the token scan.
const GLYPH_FONT_PX: Record<12 | 16, number> = { 12: 7, 16: 9 }

const SourceGlyph = ({
  size,
  source
}: {
  size: 12 | 16
  source: ChatSourceData
}) => {
  if (source.icon) {
    return (
      <span
        aria-hidden='true'
        className={cn(
          'flex shrink-0 items-center justify-center',
          GLYPH_BOX[size]
        )}
      >
        {source.icon}
      </span>
    )
  }

  const seed = sourceDomain(source) ?? source.label
  const tone = toneFromLabel(seed)

  return (
    <span
      aria-hidden='true'
      className={cn(
        'flex shrink-0 select-none items-center justify-center overflow-hidden',
        'rounded-[calc(var(--core-radius-control)-2px)] font-mono font-medium uppercase',
        GLYPH_BOX[size]
      )}
      // The avatar pair INVERTED: ink as ground, wash as the letter. The
      // pair's mutual contrast is symmetric, and at 12–16px only a solid ink
      // tile reads like a favicon — the wash blends into the chip in light
      // and disappears on dark surfaces.
      style={{
        backgroundColor: `var(--core-color-avatar-${tone}-fg)`,
        color: `var(--core-color-avatar-${tone}-bg)`,
        fontSize: GLYPH_FONT_PX[size],
        lineHeight: 1
      }}
    >
      {seed.trim().charAt(0) || '?'}
    </span>
  )
}

// ---------------------------------------------------------------------------
// SourcePreview — the hover-card body. Presentation only: the HoverCard
// contract forbids interactive children (its body never reaches touch or
// screen readers), so everything here is also reachable via the trigger's
// destination or the source list.

const SourceByline = ({ source }: { source: ChatSourceData }) => {
  const parts = [sourceDomain(source), source.annotation].filter(Boolean)
  if (parts.length === 0) return null

  return (
    <div className='flex min-w-0 items-center gap-1.5'>
      <SourceGlyph size={16} source={source} />
      <span className='truncate text-caption text-[var(--core-color-text-muted)]'>
        {parts.join(' · ')}
      </span>
    </div>
  )
}

const SourcePreview = ({ source }: { source: ChatSourceData }) => (
  <div className='grid gap-1.5 p-3'>
    <SourceByline source={source} />
    <div className='line-clamp-2 text-sm font-medium leading-5 text-foreground'>
      {source.title ?? source.label}
    </div>
    {source.snippet && (
      <div className='line-clamp-3 text-caption text-[var(--core-color-text-secondary)]'>
        {source.snippet}
      </div>
    )}
  </div>
)

// ---------------------------------------------------------------------------
// SourceList — the accessible full list (the +N popover and the ChatSources
// roll-up share it). Rows commit like chips do: url → new tab, else onSelect.

const SOURCE_ROW_CLASS = cn(
  'flex w-full items-start gap-2 rounded-control px-2 py-1.5 text-left',
  'transition-colors duration-fast motion-reduce:transition-none',
  'hover:bg-[var(--core-color-state-hover-bg)]',
  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring'
)

const SourceRowContent = ({
  source,
  glyph = true
}: {
  source: ChatSourceData
  /** LOCAL MODIFICATION (4): false when the list carries one shared identity —
   *  see `ChatSources.glyph`. */
  glyph?: boolean
}) => {
  const byline = [sourceDomain(source), source.annotation]
    .filter(Boolean)
    .join(' · ')

  return (
    <>
      {glyph && (
        <span className='mt-0.5 flex shrink-0'>
          <SourceGlyph size={16} source={source} />
        </span>
      )}
      <span className='min-w-0 flex-1'>
        <span className='block truncate text-sm leading-5 text-foreground'>
          {source.title ?? source.label}
        </span>
        {byline && (
          <span className='block truncate text-caption text-[var(--core-color-text-muted)]'>
            {byline}
          </span>
        )}
      </span>
    </>
  )
}

const SourceListRow = ({
  source,
  glyph
}: {
  source: ChatSourceData
  glyph?: boolean
}) => {
  if (source.url) {
    return (
      <a
        className={SOURCE_ROW_CLASS}
        href={source.url}
        rel='noreferrer'
        target='_blank'
      >
        <SourceRowContent glyph={glyph} source={source} />
      </a>
    )
  }

  if (source.onSelect) {
    return (
      <button
        className={SOURCE_ROW_CLASS}
        type='button'
        onClick={source.onSelect}
      >
        <SourceRowContent glyph={glyph} source={source} />
      </button>
    )
  }

  return (
    <div className='flex w-full items-start gap-2 rounded-control px-2 py-1.5 text-left'>
      <SourceRowContent glyph={glyph} source={source} />
    </div>
  )
}

const SourceList = ({
  label,
  sources,
  glyph
}: {
  label?: string
  sources: ChatSourceData[]
  glyph?: boolean
}) => (
  <div className='flex max-h-80 flex-col'>
    {label && (
      <div className='px-3 pb-1 pt-2 text-caption font-medium text-[var(--core-color-text-muted)]'>
        {label} · {sources.length}
      </div>
    )}
    <div className='overflow-y-auto overscroll-contain p-1'>
      {sources.map(source => (
        <SourceListRow glyph={glyph} key={source.id} source={source} />
      ))}
    </div>
  </div>
)

// ---------------------------------------------------------------------------
// ChatSourceChip — the inline citation token for one claim (1..n sources).

const CHIP_CLASS = cn(
  'inline-block max-w-full whitespace-nowrap align-baseline',
  // `text-caption leading-4 py-px`: a 16px line + 2px padding = an 18px box
  // that stays inside the compact 20px strut and the standard 24px strut —
  // lines with citations measure exactly like lines without.
  'rounded-pill bg-[var(--core-color-chip-bg)] px-1.5 py-px text-caption leading-4',
  'text-[var(--core-color-text-secondary)]',
  'transition-colors duration-fast motion-reduce:transition-none',
  'hover:bg-[var(--core-color-chip-hover-bg)] hover:text-foreground',
  'data-[state=open]:bg-[var(--core-color-chip-hover-bg)] data-[state=open]:text-foreground',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
)

const ChipFace = ({ source }: { source: ChatSourceData }) => (
  <>
    {/* Fixed glyph box: `overflow-hidden` pins the inline-block's baseline to
        its bottom edge so the optical nudge is exact — a 12px tile drops
        1.5px to center on the 12px caption's cap-height axis. */}
    <span className='mr-1 inline-block size-3 overflow-hidden align-[-1.5px] leading-none'>
      <SourceGlyph size={12} source={source} />
    </span>
    {middleEllipsis(sourceDomain(source) ?? source.label, CHIP_TEXT_MAX)}
  </>
)

type ChatSourceChipProps = {
  /** The claim's sources. One → a link/`onSelect` chip with a hover preview;
   *  several → a `label +N` chip opening the claim's list in a popover. */
  sources: ChatSourceData[]
  /** Theme for the portaled preview/list (portals can't inherit the scoped
   *  theme); defaults from the nearest `CoreThemeProvider`. */
  themeMode?: CoreThemeMode
  className?: string
}

export const ChatSourceChip = ({
  className,
  sources,
  themeMode
}: ChatSourceChipProps) => {
  if (sources.length === 0) return null

  const [first] = sources

  if (sources.length > 1) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            aria-label={`${sources.length} sources`}
            className={cn(CHIP_CLASS, className)}
            type='button'
          >
            <ChipFace source={first} />
            <span className='ml-1 text-[var(--core-color-text-muted)]'>
              +{sources.length - 1}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className='w-80' side='top' themeMode={themeMode}>
          <SourceList sources={sources} />
        </PopoverContent>
      </Popover>
    )
  }

  const face = <ChipFace source={first} />
  const name = `Source: ${first.title ?? first.label}`

  const trigger = first.url ? (
    <a
      aria-label={name}
      className={cn(CHIP_CLASS, className)}
      href={first.url}
      rel='noreferrer'
      target='_blank'
    >
      {face}
    </a>
  ) : first.onSelect ? (
    <button
      aria-label={name}
      className={cn(CHIP_CLASS, className)}
      type='button'
      onClick={first.onSelect}
    >
      {face}
    </button>
  ) : null

  // No destination → static text, and no hover card: a pointer-only preview
  // must never be information's only home.
  if (!trigger) {
    return <span className={cn(CHIP_CLASS, className)}>{face}</span>
  }

  return (
    <HoverCard>
      <HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
      <HoverCardContent className='w-72' side='top' themeMode={themeMode}>
        <SourcePreview source={first} />
      </HoverCardContent>
    </HoverCard>
  )
}

// ---------------------------------------------------------------------------
// ChatSources — the message-level roll-up for the `ChatMessage` footer:
// stacked glyph tiles + a count, opening the full list.

type ChatSourcesProps = {
  sources: ChatSourceData[]
  /** Visible label; the count is appended ('Sources · 12'). */
  label?: string
  /**
   * LOCAL MODIFICATION (4) — one identity for the whole list.
   *
   * The default trigger stacks a tile per source, which says "these came from
   * different places". When they did not — three datasets of one provider, the
   * parts of a single record — the stack is three copies of the same mark and
   * the per-row tiles repeat it again down the list.
   *
   * Set it to the shared mark: the trigger renders this node alone, and the
   * rows render without tiles, because the identity is the list's and not each
   * row's. Unset, nothing changes.
   */
  glyph?: React.ReactNode
  /** Theme for the portaled list; defaults from the nearest provider. */
  themeMode?: CoreThemeMode
  className?: string
}

export const ChatSources = ({
  className,
  glyph,
  label = 'Sources',
  sources,
  themeMode
}: ChatSourcesProps) => {
  if (sources.length === 0) return null

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'inline-flex h-6 max-w-full items-center gap-1.5 rounded-pill px-1.5',
            'text-caption text-[var(--core-color-text-secondary)]',
            'transition-colors duration-fast motion-reduce:transition-none',
            'hover:bg-[var(--core-color-state-hover-bg)] hover:text-foreground',
            'data-[state=open]:bg-[var(--core-color-state-hover-bg)] data-[state=open]:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            className
          )}
          type='button'
        >
          {glyph ? (
            <span aria-hidden='true' className='flex shrink-0 items-center'>
              {glyph}
            </span>
          ) : (
            <span className='flex shrink-0 -space-x-1'>
              {sources.slice(0, 3).map(source => (
                // The surface-colored ring separates overlapped tiles.
                <span
                  className='rounded-[calc(var(--core-radius-control)-2px)] ring-1 ring-[var(--core-color-surface-default)]'
                  key={source.id}
                >
                  <SourceGlyph size={16} source={source} />
                </span>
              ))}
            </span>
          )}
          <span className='truncate'>
            {label} · {sources.length}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className='w-80' themeMode={themeMode}>
        <SourceList glyph={glyph ? false : undefined} label={label} sources={sources} />
      </PopoverContent>
    </Popover>
  )
}
