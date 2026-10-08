import { useState, type ReactNode } from 'react'

import { Building2, CircleCheck, Flag, Play, Sparkles } from 'lucide-react'

import { ActionButton, DateTime, PageHeadingCount, Surface, Text } from '@/core'
import { cn } from '@/utils/twUtils'

import { SectionTitle } from './SectionTitle'

import type { AssessmentRead } from '../../lib/assessments'
import type { BusinessRecord } from '../../lib/deriveResults'
import { useReview, type ReviewStatus } from '../../lib/review'

const STATUS_LABEL: Record<ReviewStatus, string> = {
  approved: 'Approve',
  in_review: 'Needs review',
  rejected: 'Reject'
}

type Kind = 'created' | 'run' | 'completed' | 'summary' | 'status'
type Event = { at: string; text: string; kind: Kind; by?: string }

/** What kind of thing happened, at a glance. */
const ICON: Record<Kind, ReactNode> = {
  created: <Building2 aria-hidden="true" size={14} strokeWidth={1.75} />,
  run: <Play aria-hidden="true" size={14} strokeWidth={1.75} />,
  completed: <CircleCheck aria-hidden="true" size={14} strokeWidth={1.75} />,
  summary: <Sparkles aria-hidden="true" size={14} strokeWidth={1.75} />,
  status: <Flag aria-hidden="true" size={14} strokeWidth={1.75} />
}

/**
 * What has happened to the business, newest first: when it was created, each
 * assessment run and completed, each summary written, and the status changed.
 * Assembled from what is already kept — the orders, the summaries, the review —
 * so nothing new is stored.
 */
export const useActivity = (record: BusinessRecord, reads: AssessmentRead[]): Event[] => {
  const review = useReview(record.id)
  const events: Event[] = [
    ...(record.createdAt ? [{ at: record.createdAt, text: 'Business created', kind: 'created' as const }] : []),
    ...reads.flatMap(({ assessment: a, summary }) => [
      ...(a.orderedAt ? [{ at: a.orderedAt, text: `${a.name} assessment run`, kind: 'run' as const }] : []),
      ...(a.completedAt ? [{ at: a.completedAt, text: `${a.name} assessment completed`, kind: 'completed' as const }] : []),
      ...(summary?.at ? [{ at: summary.at, text: `${a.name} summary generated`, kind: 'summary' as const }] : [])
    ]),
    ...(review.change
      ? [
          {
            at: review.change.at,
            text: `Status changed from ${STATUS_LABEL[review.change.from]} to ${STATUS_LABEL[review.change.to]}`,
            kind: 'status' as const,
            by: review.change.by
          }
        ]
      : [])
  ]
  return events.sort((a, b) => b.at.localeCompare(a.at))
}

/** Ruled rows. `stacked` — the narrow column — sets each event over its time,
 *  with its icon at the left; otherwise the time sits at the row's end. */
const EventList = ({
  events,
  stacked = false,
  flush = false,
  timeAtEnd = false
}: {
  events: Event[]
  stacked?: boolean
  /** The time at the row's far right rather than under the event. */
  timeAtEnd?: boolean
  /** No side inset: the rows sit on the page rather than in a card. */
  flush?: boolean
}) => (
  <ol className="m-0 list-none p-0">
    {events.map((e, i) => (
      <li
        key={`${e.at}-${i}`}
        className={cn(
          // A feed on the page (flush): no rules between rows — each icon sits
          // in a circle on a thin line that runs down to the next. In a card,
          // ruled rows as before.
          flush
            ? 'relative pb-4 last:pb-0 before:absolute before:bottom-0 before:left-[11px] before:top-6 before:w-px before:bg-[var(--core-color-border-divider)] last:before:hidden'
            : 'px-4 py-2.5 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-[var(--core-color-border-divider)]',
          stacked ? 'flex items-start gap-3 text-sm' : 'flex items-baseline justify-between gap-4'
        )}
      >
        {stacked ? (
          <>
            <span
              className={cn(
                'flex shrink-0 text-text-secondary',
                flush
                  ? 'size-6 items-center justify-center rounded-full border border-border bg-card'
                  : 'mt-0.5'
              )}
            >
              {ICON[e.kind]}
            </span>
            <span
              className={cn(
                'flex min-w-0 flex-1',
                timeAtEnd ? 'items-baseline justify-between gap-4' : 'flex-col',
                flush && 'pt-0.5'
              )}
            >
              <span className="min-w-0">
                {e.text}
                {e.by && <span className="text-text-secondary"> · {e.by}</span>}
              </span>
              {/* The cards' "Generated …" line: small, secondary. */}
              <Text size="sm" tone="secondary" className={cn(timeAtEnd && 'shrink-0 whitespace-nowrap')}>
                <DateTime relative>{e.at}</DateTime>
              </Text>
            </span>
          </>
        ) : (
          <>
            <span className="min-w-0">
              {e.text}
              {e.by && <span className="text-text-secondary"> · {e.by}</span>}
            </span>
            <DateTime className="shrink-0 whitespace-nowrap text-text-secondary" relative>
              {e.at}
            </DateTime>
          </>
        )}
      </li>
    ))}
  </ol>
)

/** Every event, as the business page's Recent activity reads them: the same
 *  feed — icons on a line, each time under its event — in full. */
export const ActivityTab = ({ record, reads }: { record: BusinessRecord; reads: AssessmentRead[] }) => {
  const events = useActivity(record, reads)
  return events.length === 0 ? (
    <Text tone="secondary">No activity yet.</Text>
  ) : (
    <EventList events={events} stacked flush timeAtEnd />
  )
}

const FIRST = 3
const PAGE = 20

/** The newest few, in the overview's right column; more twenty at a time. */
export const RecentActivity = ({ record, reads }: { record: BusinessRecord; reads: AssessmentRead[] }) => {
  const events = useActivity(record, reads)
  const [shown, setShown] = useState(FIRST)
  const more = Math.min(PAGE, events.length - shown)
  return (
    <section aria-label="Recent activity" className="flex flex-col gap-3">
      <SectionTitle className="flex items-center gap-2">
        Recent activity
        {/* Every event, as Assessments counts its cards. */}
        <PageHeadingCount>{events.length}</PageHeadingCount>
      </SectionTitle>
      {/* No card: a plain list under its title, ruled apart. */}
      <div>
        {events.length === 0 ? (
          <Text tone="secondary">No activity yet.</Text>
        ) : (
          <>
            <EventList events={events.slice(0, shown)} stacked flush />
            {more > 0 && (
              <ActionButton className="mt-3" onClick={() => setShown((n) => n + PAGE)} size="compact" variant="secondary">
                Show {more} more
              </ActionButton>
            )}
          </>
        )}
      </div>
    </section>
  )
}
