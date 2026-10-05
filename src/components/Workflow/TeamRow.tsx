import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { ChevronLeft, ChevronRight } from 'lucide-react'

import { ActionLink, Heading, IconActionButton, PageHeadingCount } from '@/core'
import { cn } from '@/utils/twUtils'

import { teamHref, type WorkflowListing, type WorkflowTeam } from '../../lib/workflowCatalogue'
import { WorkflowCard } from './WorkflowCard'

/**
 * One team's workflows, as a paged row.
 *
 * The team's name and count, "View all" on the right, and a single row of
 * cards beneath — as many as fit, four on a wide screen. The rest are a page
 * away: two bold arrows surface over the row's edges on hover (and whenever a
 * card or arrow has focus), and each click slides the track one page. There is
 * no sideways scroll: the track is clipped and moved, never scrolled, so a
 * trackpad can't leave it half-way between cards and no scrollbar appears.
 */
const GAP = 16

/** How many cards fit the row at this width: four on the wide layout, three
 *  at tablet widths, two below that. */
const perViewFor = (width: number) => (width >= 1024 ? 4 : width >= 720 ? 3 : 2)

export const TeamRow = ({ team, listings }: { team: WorkflowTeam; listings: WorkflowListing[] }) => {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [page, setPage] = useState(0)

  useLayoutEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const measure = () => setWidth(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const perView = perViewFor(width)
  const pages = Math.max(1, Math.ceil(listings.length / perView))
  const last = pages - 1

  // A narrower row has more pages; a wider one fewer. Keep the page in range.
  useEffect(() => {
    if (page > last) setPage(last)
  }, [page, last])

  const cardWidth = width > 0 ? (width - GAP * (perView - 1)) / perView : undefined
  const offset = cardWidth ? Math.min(page, last) * perView * (cardWidth + GAP) : 0
  const paged = listings.length > perView
  const headingId = `team-${team.slug}`

  return (
    <section aria-labelledby={headingId} className="group/row flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Heading id={headingId} level={3} className="font-arizona font-light">
            {team.name}
          </Heading>
          <PageHeadingCount>{listings.length}</PageHeadingCount>
        </div>
        <ActionLink variant="quiet" size="compact" to={teamHref(team.slug)} className="-mr-2 text-text-secondary">
          View all
        </ActionLink>
      </div>

      <div className="relative">
        <div
          ref={viewportRef}
          aria-roledescription="carousel"
          aria-labelledby={headingId}
          // `clip`, not `hidden`: a hidden overflow still scrolls when a card
          // off the page takes focus, which would leave the track mid-way.
          className="overflow-clip"
        >
          <div
            className="flex gap-4 transition-transform duration-standard ease-out motion-reduce:transition-none"
            style={{ transform: `translateX(-${offset}px)` }}
          >
            {listings.map((l, i) => {
              const onPage = Math.floor(i / perView) === Math.min(page, last)
              return (
                // The width is measured, not a breakpoint class, so the track
                // can be moved by exact page widths. Cards off the page are
                // inert: not tabbable, not read, until paged in.
                <div
                  key={l.slug}
                  className="shrink-0"
                  style={cardWidth ? { width: cardWidth } : undefined}
                  inert={!onPage}
                >
                  <WorkflowCard listing={l} />
                </div>
              )
            })}
          </div>
        </div>

        {paged && (
          <>
            <Arrow side="left" hidden={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} />
            <Arrow side="right" hidden={page >= last} onClick={() => setPage((p) => Math.min(last, p + 1))} />
          </>
        )}
      </div>
    </section>
  )
}

/** The way to the next page: a filled round button, half over the row's edge,
 *  shown when the pointer is over the row or anything in it has focus. The one
 *  at an end is removed from view and the tab order, not merely faded. */
const Arrow = ({ side, hidden, onClick }: { side: 'left' | 'right'; hidden: boolean; onClick: () => void }) => {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight
  return (
    <IconActionButton
      aria-label={side === 'left' ? 'Previous workflows' : 'Next workflows'}
      variant="primary"
      size="standard"
      tabIndex={hidden ? -1 : 0}
      onClick={onClick}
      className={cn(
        'absolute top-1/2 z-10 -translate-y-1/2 rounded-full shadow-elevation-raised',
        'opacity-0 transition-opacity duration-fast motion-reduce:transition-none',
        'group-hover/row:opacity-100 focus-visible:opacity-100 group-focus-within/row:opacity-100',
        side === 'left' ? 'left-3' : 'right-3',
        hidden && 'invisible'
      )}
    >
      <Icon aria-hidden="true" size={18} strokeWidth={2} />
    </IconActionButton>
  )
}
