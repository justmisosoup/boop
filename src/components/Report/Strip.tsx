import { useId, useState, type ReactNode } from 'react'

import { Text } from '@/core'

import { cn } from '../../utils/twUtils'
import { Collapsible } from '../Collapsible'

/** A label over a table, as "State filings" heads the filing strip. */
export const Label = ({ children }: { children: ReactNode }) => (
  <div className="px-4 pt-3">
    <Text tone="secondary" size="sm" className="leading-snug">
      {children}
    </Text>
  </div>
)

/**
 * A strip of tiles opening a detail under them — the filing strip's and the
 * city strip's behaviour: closed until a tile is picked, the picked one
 * closes it again.
 */
type Tile = { key: string; chip: ReactNode; static?: boolean }

export const Strip = ({
  label,
  tiles,
  more,
  aside,
  detail,
  open
}: {
  label: string
  tiles: Tile[]
  /** A second lock-up of tiles under the first, with its own caption — the
   *  names a screen ran on and returned nothing, apart from the ones it hit. */
  more?: { label: string; tiles: Tile[] }
  /** Plain text after the tiles — the lead classification beside its verdict. */
  aside?: ReactNode
  detail: (key: string) => ReactNode
  /** The tile open from the start — the submitted office. */
  open?: string
}) => {
  const all = [...tiles, ...(more?.tiles ?? [])]
  const [selected, setSelected] = useState(open ?? all.find((t) => !t.static)?.key)
  const [collapsed, setCollapsed] = useState(!open)
  const detailId = useId()
  if (all.length === 0) return null
  const row = (list: Tile[], name: string, after?: ReactNode) => (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap items-center gap-1.5 px-4 pb-3">
      {list.map((t) => {
        const on = t.key === selected && !collapsed
        // A verdict with nothing under it: Non-prohibited is the whole fact.
        if (t.static)
          return (
            <span key={t.key} className="flex">
              {t.chip}
            </span>
          )
        return (
          <button
            key={t.key}
            type="button"
            role="radio"
            aria-checked={on}
            aria-controls={detailId}
            onClick={() => {
              if (on) return setCollapsed(true)
              setSelected(t.key)
              setCollapsed(false)
            }}
            className={cn('flex rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', on && 'ring-1 ring-[var(--core-color-border-strong)]')}
          >
            {t.chip}
          </button>
        )
      })}
      {after && <span className="text-sm text-text-primary">{after}</span>}
    </div>
  )
  return (
    <div className="border-t border-[var(--core-color-border-divider)]">
      <Label>{label}</Label>
      {tiles.length > 0 && <div className="pt-3">{row(tiles, label, aside)}</div>}
      {more && more.tiles.length > 0 && (
        <>
          <div className={cn('px-4', tiles.length > 0 ? 'pt-0' : 'pt-3')}>
            <Text tone="secondary" size="sm" className="text-caption leading-snug">
              {more.label}
            </Text>
          </div>
          <div className="pt-2">{row(more.tiles, `${label}: ${more.label}`)}</div>
        </>
      )}
      <Collapsible open={!collapsed}>
        <div id={detailId} className="border-t border-[var(--core-color-border-divider)]">
          {selected && detail(selected)}
        </div>
      </Collapsible>
    </div>
  )
}
