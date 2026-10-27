import { useEffect, useMemo, useRef, useState } from 'react'

import { EmptyState } from '@/core'

import timelineFixture from '../../data/timeline.json'
import { LAYOUT, LIST_WINDOW } from '../../lib/timeline/constants'
import {
  EMPTY_FILTERS,
  applyFilters,
  hidesChanges,
  isFilterActive,
  type TimelineFilters
} from '../../lib/timeline/filters'
import { summaryText } from '../../lib/timeline/format'
import { countChanges, groupUpdates, yearsOf } from '../../lib/timeline/group'
import { layoutVars } from '../../lib/timeline/layout'
import type { Stem } from '../../lib/timeline/strip'
import type { FilingUpdate, Kind, TimelineEvent } from '../../lib/timeline/types'
import { OverviewStrip, type StripBrush } from './OverviewStrip'
import { Spine } from './Spine'
import { filingKey, TimelineToolbar } from './TimelineToolbar'
import { updateDomId } from './UpdateEntry'

/**
 * The business timeline — what the Secretary of State has filed, and when.
 *
 * A port of the dashboard's Timeline tab (`app/src/containers/Timeline`, rebuilt
 * in `c4379d1cd`). The parsing, folding, grouping, filtering, the strip's scale
 * and every component are the app's own files; this is the container that feeds
 * them, following `index.tsx` there.
 *
 * WHAT DID NOT COME ACROSS:
 *
 * - **The data.** The app fetches up to ten pages of a hundred events from
 *   `v1/businesses/:id/timeline`; this reads the same, pulled ahead of time by
 *   `scripts/pull-timeline.ts` into one file keyed by business.
 * - **The date-range calendar.** `@/core`'s `DateRangePicker` arrived with the
 *   same commit and is not in this read-only clone, so the toolbar offers its
 *   presets as a menu — see `TimelineToolbar`.
 * - **Filters in the URL.** The app keeps them in the query string and mirrors
 *   them to session storage per business (`hooks.ts`); here they are state, and
 *   go away with the page.
 */
/** The filings (`filingKey`) a business's timeline has changes for: where a
 *  "Timeline" button has something to open. */
export const filingsWithTimeline = (businessId: string): Set<string> =>
  new Set(
    groupUpdates((timelineFixture as { byBusiness: Record<string, TimelineEvent[]> }).byBusiness[businessId] ?? []).map((u) =>
      filingKey(u.source.state, u.source.fileNumber)
    )
  )

export { filingKey }

export const Timeline = ({
  businessId,
  focus,
  onOpenFiling
}: {
  businessId: string
  /** Opens a filing's card in Sources, from its chip on an entry. */
  onOpenFiling?: (source: FilingUpdate['source']) => void
  /** A change to open on and mark — the Formation card's name history — with
   *  the change types to filter to; or a filing (`filingKey`) to show alone.
   *  `n` makes a second click follow it again. */
  focus?: { eventId?: string; kinds?: Kind[]; filing?: string; n: number }
}) => {
  // This business's stored response (`scripts/pull-timeline.ts`); none stored
  // reads as no events, which the empty state covers.
  const events = useMemo(
    () =>
      (timelineFixture as { byBusiness: Record<string, TimelineEvent[]> }).byBusiness[businessId] ?? [],
    [businessId]
  )

  const [filters, setFilters] = useState<TimelineFilters>(EMPTY_FILTERS)
  // The Registration facet: the prototype's own, held beside the app's filters.
  const [filings, setFilings] = useState<string[]>([])
  const [shown, setShown] = useState(LIST_WINDOW)
  const [highlightedIds, setHighlightedIds] = useState<Set<string> | null>(null)
  const [hoveredIds, setHoveredIds] = useState<Set<string> | null>(null)
  const highlightTimer = useRef<number | null>(null)

  const allUpdates = useMemo(() => groupUpdates(events), [events])
  const visibleUpdates = useMemo(() => {
    const ofFilings = filings.length
      ? allUpdates.filter((u) => filings.includes(filingKey(u.source.state, u.source.fileNumber)))
      : allUpdates
    return applyFilters(ofFilings, filters)
  }, [allUpdates, filters, filings])
  const filtered = isFilterActive(filters) || filings.length > 0

  // `null` means nothing is dimmed in the strip.
  const matchingIds = useMemo(
    () => (filtered ? new Set(visibleUpdates.map((update) => update.id)) : null),
    [filtered, visibleUpdates]
  )

  useEffect(() => setShown(LIST_WINDOW), [filters, filings])
  useEffect(
    () => () => {
      if (highlightTimer.current) window.clearTimeout(highlightTimer.current)
    },
    []
  )

  const summary = useMemo(() => {
    return summaryText({
      changes: countChanges(visibleUpdates),
      filings: visibleUpdates.length,
      totalChanges: filtered ? countChanges(allUpdates) : undefined,
      years: yearsOf(visibleUpdates)
    })
  }, [allUpdates, filtered, visibleUpdates])

  const selectedRange: StripBrush | null =
    filters.from && filters.to ? { from: filters.from, to: filters.to } : null

  /** Follow a stem into the list: extend the window far enough to hold it,
   *  mark it, and scroll it to the middle. */
  const jumpToStem = (stem: Stem) => {
    const index = visibleUpdates.findIndex((update) =>
      stem.updateIds.includes(update.id)
    )
    if (index === -1) return
    const target = visibleUpdates[index]
    setShown((current) =>
      Math.max(current, Math.ceil((index + 1) / LIST_WINDOW) * LIST_WINDOW)
    )
    setHighlightedIds(new Set([target.id]))
    if (highlightTimer.current) window.clearTimeout(highlightTimer.current)
    highlightTimer.current = window.setTimeout(() => setHighlightedIds(null), 1600)
    requestAnimationFrame(() =>
      document
        .getElementById(updateDomId(target.id))
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    )
  }

  /* Followed from the report: every filter off, the update holding the
     change in the list and marked until something else is. */
  useEffect(() => {
    if (!focus) return
    // A filing: every other filter off, that filing alone, from the top.
    if (focus.filing) {
      setFilters(EMPTY_FILTERS)
      setFilings([focus.filing])
      setHighlightedIds(null)
      return
    }
    if (!focus.eventId) return
    const eventId = focus.eventId
    setFilings([])
    const next = { ...EMPTY_FILTERS, kinds: focus.kinds ?? [] }
    const list = applyFilters(allUpdates, next)
    const index = list.findIndex((u) => u.changes.some((c) => c.id === eventId))
    if (index === -1) return
    const target = list[index]
    setFilters(next)
    setShown((current) => Math.max(current, Math.ceil((index + 1) / LIST_WINDOW) * LIST_WINDOW))
    if (highlightTimer.current) window.clearTimeout(highlightTimer.current)
    setHighlightedIds(new Set([target.id]))
    const t = window.setTimeout(
      () => document.getElementById(updateDomId(target.id))?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
      80
    )
    return () => window.clearTimeout(t)
  }, [focus, allUpdates])

  if (allUpdates.length === 0)
    return (
      <EmptyState
        title="No filing history yet"
        description="Middesk is monitoring this business. Secretary of State filings will appear here as they are found."
      />
    )

  return (
    <div className="flex flex-col" style={layoutVars(LAYOUT)}>
      <div className="rounded-card border border-solid border-border bg-card">
        <TimelineToolbar
          className="min-h-12 border-b border-solid border-border px-3 py-1.5"
          filters={filters}
          onChange={setFilters}
          filings={filings}
          onFilingsChange={setFilings}
          summary={summary}
          updates={allUpdates}
        />
        <div className="px-4 py-2">
          <OverviewStrip
            hoveredIds={hoveredIds}
            matchingIds={matchingIds}
            onBrush={(range) => setFilters({ ...filters, from: range.from, to: range.to })}
            onHoverStem={(stem) => setHoveredIds(stem ? new Set(stem.updateIds) : null)}
            onSelectStem={jumpToStem}
            selectedRange={selectedRange}
            updates={allUpdates}
          />
        </div>
      </div>

      {visibleUpdates.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            title="No matching changes"
            description={`None of the ${countChanges(allUpdates)} recorded changes match these filters. The strip above still shows where the history is.`}
            actionLabel="Clear filters"
            onAction={() => {
              setFilters(EMPTY_FILTERS)
              setFilings([])
            }}
          />
        </div>
      ) : (
        <div className="mt-3 rounded-card border border-solid border-border bg-card px-2 py-4">
          <Spine
            businessId={businessId}
            hidesChanges={hidesChanges(filters)}
            highlightedIds={highlightedIds}
            hoveredIds={hoveredIds}
            onHover={(id) => setHoveredIds(id ? new Set([id]) : null)}
            onOpenFiling={onOpenFiling}
            onShowMore={() => setShown((current) => current + LIST_WINDOW)}
            shown={shown}
            updates={visibleUpdates}
          />
        </div>
      )}
    </div>
  )
}
