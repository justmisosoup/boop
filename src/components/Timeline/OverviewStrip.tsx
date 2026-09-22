/*
 * Ported from the dashboard: `app/src/containers/Timeline/OverviewStrip.tsx`.
 *
 * Two dependencies did not come with it — `@visx/axis` and `@visx/event`. The
 * axis is drawn inline with the app's own parameters, and `localPoint` is the
 * one rect subtraction it stood for. Everything else, including every class
 * string and the brush arithmetic, is the app's.
 */

import { useId, useMemo, useRef, useState } from 'react'

import { Hint } from '@/core'

import { useElementWidth } from '../../hooks/useElementWidth'
import dayjs from '../../lib/dayjs'
import {
  COVERAGE_START_YEAR,
  KIND_COLOR_VAR,
  KIND_LABEL,
  KIND_ORDER,
  LAYOUT
} from '../../lib/timeline/constants'
import {
  buildScale,
  layoutStems,
  type Stem,
  stemLabel,
  stripRange
} from '../../lib/timeline/strip'
import type { FilingUpdate } from '../../lib/timeline/types'
import { cn } from '../../utils/twUtils'

const PAD = 16
const BLOCK_GAP = 3
const MIN_BRUSH = 6

export type StripBrush = { from: string; to: string }

type Props = {
  updates: FilingUpdate[]
  /** Ids of updates the active filters keep; `null` when nothing is filtered. */
  matchingIds: Set<string> | null
  /** `null` when nothing is hovered. */
  hoveredIds: Set<string> | null
  selectedRange: StripBrush | null
  onSelectStem: (stem: Stem) => void
  onHoverStem: (stem: Stem | null) => void
  onBrush: (range: StripBrush) => void
}

const Peek = ({ stem }: { stem: Stem }) => (
  <div className='grid gap-0.5'>
    <div className='font-semibold'>
      {stem.title}
      {stem.blocks.length > 1 && ` · ${stem.blocks.length} filings`}
    </div>
    {KIND_ORDER.filter(kind => stem.counts[kind] > 0).map(kind => (
      <div key={kind} className='flex items-center gap-2'>
        <span
          aria-hidden='true'
          className='size-2 shrink-0 rounded-[2px]'
          style={{ background: KIND_COLOR_VAR[kind] }}
        />
        <span>
          {stem.counts[kind]} {KIND_LABEL[kind].singular.toLowerCase()}{' '}
          {stem.counts[kind] === 1 ? 'change' : 'changes'}
        </span>
      </div>
    ))}
  </div>
)

const intersects = (ids: Set<string> | null, stem: Stem): boolean | null =>
  ids === null ? null : stem.updateIds.some(id => ids.has(id))

export const OverviewStrip = ({
  updates,
  matchingIds,
  hoveredIds,
  selectedRange,
  onSelectStem,
  onHoverStem,
  onBrush
}: Props) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const width = useElementWidth(containerRef)
  const hatchId = useId()
  const [brush, setBrush] = useState<{ x0: number; x1: number } | null>(null)

  const inner = Math.max(0, width - PAD * 2)
  const range = useMemo(() => stripRange(updates), [updates])
  const scale = useMemo(() => buildScale(range, inner), [range, inner])
  const stems = useMemo(
    () => layoutStems(updates, scale, LAYOUT.stemWidth),
    [updates, scale]
  )

  if (updates.length === 0) return null

  const height = LAYOUT.stripHeight
  const axisY = height - 20
  const top = 4
  const x = (date: Date) => PAD + scale.x(date)
  const maxTotal = Math.max(1, ...stems.map(stem => stem.total))
  const maxBlocks = Math.max(1, ...stems.map(stem => stem.blocks.length))
  const unit = Math.min(
    LAYOUT.segmentHeight,
    (axisY - 16 - (maxBlocks - 1) * BLOCK_GAP) / maxTotal
  )
  const stemWidth = LAYOUT.stemWidth
  const hit = Math.max(stemWidth + 12, 20)
  const showCoverageCaption =
    range.start.getFullYear() <= COVERAGE_START_YEAR - 3
  const shelf = scale.shelf
  const coverageX = shelf ? PAD + shelf.x1 : null

  const localX = (event: React.PointerEvent<HTMLDivElement>) => {
    const node = containerRef.current
    // `localPoint` from `@visx/event`, which is not a dependency here. It is
    // the pointer's x within the element, which is this subtraction.
    const px = node ? event.clientX - node.getBoundingClientRect().left : 0
    return Math.min(inner, Math.max(0, px - PAD))
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.pointerType === 'touch') return
    if (!(event.target as HTMLElement).hasAttribute('data-brush')) return
    const px = localX(event)
    setBrush({ x0: px, x1: px })
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (brush) setBrush({ x0: brush.x0, x1: localX(event) })
  }
  const onPointerUp = () => {
    if (!brush) return
    const [a, b] = [Math.min(brush.x0, brush.x1), Math.max(brush.x0, brush.x1)]
    setBrush(null)
    if (b - a < MIN_BRUSH) return
    onBrush({
      from: dayjs(scale.dateAt(a)).format('YYYY-MM-DD'),
      to: dayjs(scale.dateAt(b)).format('YYYY-MM-DD')
    })
  }

  const band =
    brush !== null
      ? {
          left: PAD + Math.min(brush.x0, brush.x1),
          width: Math.abs(brush.x1 - brush.x0)
        }
      : selectedRange
        ? {
            left: x(dayjs(selectedRange.from).toDate()),
            width: Math.max(
              2,
              x(dayjs(selectedRange.to).endOf('day').toDate()) -
                x(dayjs(selectedRange.from).toDate())
            )
          }
        : null

  return (
    <div
      ref={containerRef}
      className={cn('relative select-none', brush && 'cursor-crosshair')}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setBrush(null)}
      style={{ height }}
    >
      {width > 0 && (
        <div
          aria-hidden='true'
          className='absolute inset-x-0 top-0 cursor-crosshair'
          data-brush
          style={{ height: axisY }}
        />
      )}
      {width > 0 && band && (
        <div
          aria-hidden='true'
          className={cn(
            'absolute top-1 rounded-control border-[var(--core-color-state-selected-border)] border-x bg-[var(--core-color-state-selected-bg)] transition-opacity',
            brush ? 'opacity-80' : 'opacity-60'
          )}
          style={{ left: band.left, width: band.width, height: axisY - 2 }}
        />
      )}
      {width > 0 &&
        stems.map(stem => (
          <Hint
            key={stem.key}
            asChild
            content={<Peek stem={stem} />}
            side='top'
          >
            <button
              aria-label={stemLabel(stem)}
              className={cn(
                'absolute top-1 rounded-control transition-colors duration-fast',
                'hover:!bg-[var(--core-color-state-hover-bg)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
                intersects(hoveredIds, stem) &&
                  '!bg-[var(--core-color-state-selected-bg)]'
              )}
              onBlur={() => onHoverStem(null)}
              onClick={() => onSelectStem(stem)}
              onFocus={() => onHoverStem(stem)}
              onMouseEnter={() => onHoverStem(stem)}
              onMouseLeave={() => onHoverStem(null)}
              style={{
                left: PAD + stem.x - hit / 2,
                width: hit,
                height: axisY - 2
              }}
              type='button'
            />
          </Hint>
        ))}
      {width > 0 && (
        <svg
          aria-label={`Changes over time, ${range.start.getFullYear()} to ${range.end.getFullYear()}`}
          className='pointer-events-none relative block'
          height={height}
          role='img'
          width={width}
        >
          <defs>
            <pattern
              height={6}
              id={hatchId}
              patternUnits='userSpaceOnUse'
              width={6}
            >
              <path
                d='M0 6 L6 0'
                stroke='var(--core-color-border-default)'
                strokeWidth={1}
              />
            </pattern>
          </defs>
          {shelf && coverageX !== null && (
            <>
              <rect
                fill={`url(#${hatchId})`}
                height={axisY - top}
                width={Math.max(0, coverageX - PAD)}
                x={PAD}
                y={top}
              />
              <line
                stroke='var(--core-color-border-strong)'
                strokeDasharray='2 3'
                x1={coverageX}
                x2={coverageX}
                y1={top}
                y2={axisY}
              />
            </>
          )}
          {/* `AxisBottom` from `@visx/axis`, drawn here instead: the same
              baseline, the same 4px ticks, the same 11px labels and the same
              edge-aware anchoring. */}
          <g>
            <line
              stroke='var(--core-color-border-default)'
              x1={PAD}
              x2={PAD + inner}
              y1={axisY}
              y2={axisY}
            />
            {scale.ticks.map(tick => {
              const px = scale.x(tick)
              const anchor =
                px < 12 ? 'start' : px > inner - 12 ? 'end' : 'middle'
              return (
                <g
                  key={tick.getTime()}
                  transform={`translate(${PAD + px}, ${axisY})`}
                >
                  <line stroke='var(--core-color-border-strong)' y1={0} y2={4} />
                  <text
                    dx={anchor === 'start' ? -4 : anchor === 'end' ? 4 : 0}
                    dy='0.9em'
                    fill='var(--core-color-text-secondary)'
                    fontFamily='inherit'
                    fontSize={11}
                    textAnchor={anchor}
                    y={6}
                  >
                    {tick.getFullYear()}
                  </text>
                </g>
              )
            })}
          </g>
          {stems.map(stem => {
            const cx = PAD + stem.x
            const filtered = intersects(matchingIds, stem)
            const hovered = intersects(hoveredIds, stem)
            const opacity =
              filtered === false ? 0.35 : hovered === false ? 0.45 : 1
            let y = axisY
            return (
              <g
                key={stem.key}
                className='transition-opacity duration-fast'
                opacity={opacity}
              >
                {stem.blocks.flatMap((block, blockIndex) => {
                  if (blockIndex > 0) y -= BLOCK_GAP
                  return KIND_ORDER.flatMap(kind =>
                    Array.from({ length: block.counts[kind] }, (_, index) => {
                      y -= unit
                      return (
                        <rect
                          key={`${block.updateId}-${kind}-${index}`}
                          fill={KIND_COLOR_VAR[kind]}
                          height={Math.max(1.5, unit - 1.5)}
                          rx={1.5}
                          width={stemWidth}
                          x={cx - stemWidth / 2}
                          y={y}
                        />
                      )
                    })
                  )
                })}
              </g>
            )
          })}
        </svg>
      )}
      {width > 0 && showCoverageCaption && (
        <span
          className='pointer-events-none absolute rounded-xxs bg-card px-1 text-[11px] leading-4 text-[var(--core-color-text-disabled)]'
          style={{ left: PAD + 2, top: 4 }}
        >
          Only initial filings before {COVERAGE_START_YEAR}
        </span>
      )}
    </div>
  )
}
