/*
 * Ported from the dashboard: `app/src/containers/Timeline/strip.ts`.
 *
 * Only the scale differs: `@visx/scale`'s `scaleTime` is not a dependency here,
 * so `piecewiseTime` beside this file does the same two things it was asked
 * for — clamped piecewise-linear mapping, and invert. The shelf arithmetic, the
 * tick steps and the stem merging are the app's, unchanged.
 */

import dayjs from '../dayjs'

import { COVERAGE_START_YEAR, KIND_ORDER } from './constants'
import { plural } from './plural'
import { piecewiseTime, type TimeScale } from './scale'
import { formatUpdateDate } from './format'
import type { FilingUpdate, Kind } from './types'

export type StripRange = { start: Date; end: Date; years: number }

export const stripRange = (
  updates: FilingUpdate[],
  now = new Date()
): StripRange => {
  const earliest = updates.reduce<Date | null>(
    (min, update) => (min === null || update.date < min ? update.date : min),
    null
  )
  const startYear = (earliest ?? now).getFullYear()
  const start = new Date(startYear, 0, 1)
  const end = dayjs(now).startOf('month').add(1, 'month').toDate()
  const years = Math.max(
    1,
    (end.getTime() - start.getTime()) / (365.25 * 86_400_000)
  )
  return { start, end, years }
}

/** Share of the axis the pre-coverage era may take before it is compressed. */
const SHELF_SHARE = 0.25
const MIN_TICK_GAP = 56
const TICK_STEPS = [1, 2, 5, 10, 20, 50]

export type StripScale = {
  width: number
  /** The time scale behind `x`, for the axis. */
  time: TimeScale
  x: (date: Date) => number
  dateAt: (x: number) => Date
  /** The pre-coverage era, `[0, x1]`, when the range starts before coverage. */
  shelf: { x1: number; start: Date; end: Date; compressed: boolean } | null
  /** The first day of each labelled year. */
  ticks: Date[]
}

const yearTicks = (
  fromYear: number,
  toYear: number,
  xOf: (year: number) => number
): Date[] => {
  const pxPerYear = Math.abs(xOf(fromYear + 1) - xOf(fromYear))
  const step =
    TICK_STEPS.find(candidate => candidate * pxPerYear >= MIN_TICK_GAP) ??
    TICK_STEPS[TICK_STEPS.length - 1]
  const ticks: Date[] = []
  for (let year = fromYear; year <= toYear; year += step)
    ticks.push(new Date(year, 0, 1))
  return ticks
}

export const buildScale = (
  range: StripRange,
  width: number,
  coverageYear = COVERAGE_START_YEAR
): StripScale => {
  const coverage = new Date(coverageYear, 0, 1)
  const total = Math.max(1, range.end.getTime() - range.start.getTime())
  const preShare = (coverage.getTime() - range.start.getTime()) / total
  const hasShelf = range.start < coverage
  const compressed = hasShelf && preShare > SHELF_SHARE
  const x1 = width * (compressed ? SHELF_SHARE : Math.max(0, preShare))
  const scale = piecewiseTime(
    hasShelf ? [range.start, coverage, range.end] : [range.start, range.end],
    hasShelf ? [0, x1, width] : [0, width]
  )
  const x = (date: Date) => scale(date) ?? 0
  const dateAt = (px: number) => scale.invert(px)
  const yearX = (year: number) => x(new Date(year, 0, 1))

  const first = range.start.getFullYear()
  const last = range.end.getFullYear()
  const ticks = hasShelf
    ? [
        ...(compressed
          ? [new Date(first, 0, 1)]
          : yearTicks(first, coverageYear - 1, yearX)),
        ...yearTicks(coverageYear, last, yearX)
      ]
    : yearTicks(first, last, yearX)

  return {
    width,
    time: scale,
    x,
    dateAt,
    shelf: hasShelf
      ? { x1, start: range.start, end: coverage, compressed }
      : null,
    ticks
  }
}

export type StemBlock = {
  updateId: string
  date: Date
  counts: Record<Kind, number>
  total: number
}

export type Stem = {
  key: string
  title: string
  start: Date
  end: Date
  /** Centre of the stem, px from the axis origin. */
  x: number
  updateIds: string[]
  /** One block per filing, oldest first. */
  blocks: StemBlock[]
  counts: Record<Kind, number>
  total: number
}

const emptyCounts = (): Record<Kind, number> =>
  Object.fromEntries(KIND_ORDER.map(kind => [kind, 0])) as Record<Kind, number>

const blockOf = (update: FilingUpdate): StemBlock => {
  const counts = emptyCounts()
  for (const change of update.changes) counts[change.kind] += 1
  return {
    updateId: update.id,
    date: update.date,
    counts,
    total: update.changes.length
  }
}

const rangeTitle = (start: Date, end: Date): string => {
  const a = dayjs(start)
  const b = dayjs(end)
  if (a.isSame(b, 'day')) return formatUpdateDate(start)
  if (a.isSame(b, 'month'))
    return `${a.format('MMM D')} – ${b.format('D, YYYY')}`
  if (a.isSame(b, 'year'))
    return `${a.format('MMM D')} – ${b.format('MMM D, YYYY')}`
  return `${a.format('MMM YYYY')} – ${b.format('MMM YYYY')}`
}

const addCounts = (into: Record<Kind, number>, from: Record<Kind, number>) => {
  for (const kind of KIND_ORDER) into[kind] += from[kind]
}

/** One stem per filing, placed on its date; stems that would overlap merge into one. */
export const layoutStems = (
  updates: FilingUpdate[],
  scale: StripScale,
  stemWidth: number,
  gap = 2
): Stem[] => {
  const half = stemWidth / 2
  const place = (px: number) => Math.min(scale.width - half, Math.max(half, px))
  const singles = [...updates]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map<Stem>(update => {
      const block = blockOf(update)
      return {
        key: update.id,
        title: formatUpdateDate(update.date),
        start: update.date,
        end: update.date,
        x: place(scale.x(update.date)),
        updateIds: [update.id],
        blocks: [block],
        counts: { ...block.counts },
        total: block.total
      }
    })

  const stems: Stem[] = []
  for (const stem of singles) {
    const prev = stems[stems.length - 1]
    if (prev && stem.x - prev.x < stemWidth + gap) {
      prev.updateIds.push(...stem.updateIds)
      prev.blocks.push(...stem.blocks)
      addCounts(prev.counts, stem.counts)
      prev.total += stem.total
      prev.end = stem.end
      prev.x = place(
        prev.blocks.reduce((sum, block) => sum + scale.x(block.date), 0) /
          prev.blocks.length
      )
      prev.key = `${prev.blocks[0].updateId}+${prev.blocks.length}`
      prev.title = rangeTitle(prev.start, prev.end)
      continue
    }
    stems.push(stem)
  }
  return stems
}

export const stemLabel = (stem: Stem): string => {
  const changes = plural('change', stem.total)
  return stem.blocks.length > 1
    ? `${stem.title}: ${changes} in ${plural('filing', stem.blocks.length)}`
    : `${stem.title}: ${changes}`
}
