import type { ReactNode } from 'react'

import { Popover, PopoverContent, PopoverTrigger, type ChatSourceData } from '@/core'

import { cn } from '../utils/twUtils'

/**
 * Core's chip face, restated: `ChatSourceChip`'s own class string (not
 * exported from the clone), so this trigger reads as every source chip does
 * and the claim tints (`chipStyles`) apply to it unchanged.
 */
const CHIP =
  'inline-block max-w-full whitespace-nowrap align-baseline rounded-pill bg-[var(--core-color-chip-bg)] px-1.5 py-px text-caption leading-4 text-[var(--core-color-text-secondary)] transition-colors duration-fast motion-reduce:transition-none hover:bg-[var(--core-color-chip-hover-bg)] hover:text-foreground data-[state=open]:bg-[var(--core-color-chip-hover-bg)] data-[state=open]:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/** One source, as the registration tooltip reads a place: its name in bold
 *  with its status at the right, what it is under it. The whole row opens it. */
const Row = ({ source }: { source: ChatSourceData }) => {
  const body = (
    <>
      <span className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate font-semibold text-foreground">{source.title ?? source.label}</span>
        {source.badge && <span className="shrink-0">{source.badge}</span>}
      </span>
      {source.annotation && <span className="block text-text-secondary">{source.annotation}</span>}
    </>
  )
  const row = 'block w-full px-3 py-2 text-left'
  const interactive = cn(
    row,
    'transition-colors duration-fast hover:bg-[var(--core-color-list-item-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none'
  )
  if (source.url)
    return (
      <a className={interactive} href={source.url} rel="noreferrer" target="_blank">
        {body}
      </a>
    )
  if (source.onSelect)
    return (
      <button className={interactive} onClick={source.onSelect} type="button">
        {body}
      </button>
    )
  return <div className={row}>{body}</div>
}

/**
 * A claim and the sources behind it — "Verified", "Submitted +15" — opening
 * every source in the registration tooltip's form rather than core's list:
 * the claim at the head, then each source, its place in bold and its status
 * chip beside it, what it is under it. Nothing the core list held is dropped.
 */
export const SourceListChip = ({
  claim,
  sources,
  className,
  hideCount = false
}: {
  /** The claim itself — the chip's face and the list's head. */
  claim: ChatSourceData
  sources: ChatSourceData[]
  /** The claim's tint: `CHIP_CLAIM`, `CHIP_UNVERIFIED`, `CHIP_NO_GLYPH`. */
  className?: string
  /** No "+N" on the chip. */
  hideCount?: boolean
}) => {
  const icon: ReactNode = claim.icon
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label={`${claim.title ?? claim.label}, ${sources.length} source${sources.length === 1 ? '' : 's'}`}
          className={cn(CHIP, className)}
          type="button"
        >
          {icon && <span className="mr-1 inline-block size-3 overflow-hidden align-[-1.5px] leading-none">{icon}</span>}
          {claim.label}
          {!hideCount && <span className="ml-1 text-[var(--core-color-text-muted)]">+{sources.length}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 overflow-hidden p-0 text-caption" side="top">
        {/* The claim, as the list's head. */}
        <div className="flex items-center gap-1.5 border-b border-[var(--core-color-border-divider)] px-3 py-2 font-medium text-foreground">
          {icon && <span className="inline-flex size-3 shrink-0">{icon}</span>}
          {claim.title ?? claim.label}
        </div>
        <div className="max-h-80 divide-y divide-[var(--core-color-border-divider)] overflow-y-auto overscroll-contain">
          {sources.map((s) => (
            <Row key={s.id} source={s} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
