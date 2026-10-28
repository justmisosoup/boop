import type { ReactNode } from 'react'

import { Building2, CircleCheck, Code, Flag, ListChecks, Monitor, Play, Sparkles } from 'lucide-react'

import { ActionLink, DateTime, PageHeadingCount, Surface, Text } from '@/core'
import { cn } from '@/utils/twUtils'

import { businessHref } from './BusinessFrame'
import { SectionTitle } from './SectionTitle'
import { CURRENT_USER } from '../../lib/user'
import { runsOnBusiness, useAssessmentRuns } from '../../lib/assessmentRuns'

import type { AssessmentRead } from '../../lib/assessments'
import type { BusinessRecord } from '../../lib/deriveResults'
import { useReview, type ReviewStatus } from '../../lib/review'

const STATUS_LABEL: Record<ReviewStatus, string> = {
  approved: 'Approved',
  in_review: 'Needs review',
  rejected: 'Rejected'
}

type Kind = 'created' | 'run' | 'completed' | 'summary' | 'status' | 'step'
/** Where it came from — the dashboard or the API — and who. */
type Event = {
  at: string
  text: string
  /** The assessment it is about, apart from what happened to it — so the
   *  narrow column can clip the name and keep the action. */
  subject?: string
  action?: string
  kind: Kind
  by: string
  via: 'Dashboard' | 'API'
}

const MIDDESK = 'Middesk'
// Everything here was done in the dashboard: the orders went through its
// order page, and nothing reaches this prototype through the API yet.
const DASHBOARD = 'Dashboard' as const

/** What kind of thing happened, at a glance. */
const ICON: Record<Kind, ReactNode> = {
  created: <Building2 aria-hidden="true" size={14} strokeWidth={1.75} />,
  run: <Play aria-hidden="true" size={14} strokeWidth={1.75} />,
  completed: <CircleCheck aria-hidden="true" size={14} strokeWidth={1.75} />,
  summary: <Sparkles aria-hidden="true" size={14} strokeWidth={1.75} />,
  status: <Flag aria-hidden="true" size={14} strokeWidth={1.75} />,
  step: <ListChecks aria-hidden="true" size={14} strokeWidth={1.75} />
}

/**
 * What has happened to the business, newest first: when it was created, each
 * workflow run and completed, each of its assessments completed (`assessed`,
 * the open workflow's: Registrations, Names…), each summary written, and the
 * status changed. Assembled from what is already kept — the orders, the
 * summaries, the review — so nothing new is stored.
 */
export const useActivity = (
  record: BusinessRecord,
  reads: AssessmentRead[],
  assessed: Array<{ label: string; at: string }> = []
): Event[] => {
  const review = useReview(record.id)
  useAssessmentRuns()
  // The next steps run on each assessment, from the Assistant.
  const stepRuns = runsOnBusiness(record.id)
  const nameOf = (id: string) => reads.find((r) => r.assessment.id === id)?.assessment.name ?? 'Assessment'
  const stepEvents: Event[] = Object.entries(stepRuns).flatMap(([assessmentId, runs]) =>
    runs.map((r) => {
      const action = r.requested ? `requested from ${r.requested.email}` : r.uploads?.length ? 'documents uploaded' : r.label.toLowerCase()
      return {
        at: r.at,
        text: `${nameOf(assessmentId)}: ${r.label}`,
        subject: nameOf(assessmentId),
        action,
        kind: 'step' as const,
        by: CURRENT_USER,
        via: DASHBOARD
      }
    })
  )
  const events: Event[] = [
    ...stepEvents,
    // Who did it: the reader for what a person does — creating, running,
    // changing the status — and Middesk for what follows on its own.
    // A workflow — Full Business KYB, a custom order — run, and come back. Full
    // Business KYB has no order of its own: it ran when the business's report did.
    ...reads.flatMap(({ assessment: a, summary, runAt }) => [
      ...((a.orderedAt ?? runAt)
        ? [{ at: (a.orderedAt ?? runAt)!, text: `${a.name} workflow run`, subject: a.name, action: 'workflow run', kind: 'run' as const, by: CURRENT_USER, via: DASHBOARD }]
        : []),
      ...(a.completedAt ? [{ at: a.completedAt, text: `${a.name} workflow completed`, subject: a.name, action: 'workflow completed', kind: 'completed' as const, by: MIDDESK, via: DASHBOARD }] : []),
      ...(summary?.at ? [{ at: summary.at, text: `${a.name} summary generated`, subject: a.name, action: 'summary generated', kind: 'summary' as const, by: MIDDESK, via: DASHBOARD }] : [])
    ]),
    // Created last in the list, so at the same moment as a first run it reads under it.
    ...(record.createdAt ? [{ at: record.createdAt, text: 'Business created', kind: 'created' as const, by: CURRENT_USER, via: DASHBOARD }] : []),
    // Each assessment the open workflow ran, completed.
    ...assessed.map((x) => ({
      at: x.at,
      text: `${x.label} assessment completed`,
      subject: x.label,
      action: 'assessment completed',
      kind: 'completed' as const,
      by: MIDDESK,
      via: DASHBOARD
    })),
    ...(review.change
      ? [
          {
            at: review.change.at,
            text: `Status changed from ${STATUS_LABEL[review.change.from]} to ${STATUS_LABEL[review.change.to]}`,
            kind: 'status' as const,
            by: review.change.by,
            via: DASHBOARD
          }
        ]
      : [])
  ]
  return events.sort((a, b) => b.at.localeCompare(a.at))
}

/**
 * The side panel's activity, in the Timeline's own pattern (Timeline/
 * UpdateEntry.tsx): a rail with a line down it and a round node per entry; on
 * the entry's head, when — how long ago — at the left and where it was ordered
 * from at the right; under it, what happened, a row each. Events of one day
 * are one entry.
 */
const PanelEventList = ({ events }: { events: Event[] }) => {
  const days: Event[][] = []
  for (const e of events) {
    const last = days[days.length - 1]
    if (last && last[0].at.slice(0, 10) === e.at.slice(0, 10)) last.push(e)
    else days.push([e])
  }
  return (
    <ol className="m-0 flex list-none flex-col p-0">
      {days.map((day, i) => {
        const vias = [...new Set(day.map((e) => e.via))]
        const kinds = [...new Set(day.map((e) => e.kind))]
        return (
          <li key={day[0].at} className="grid grid-cols-[40px_minmax(0,1fr)]">
            {/* The rail: the node, and the line on to the next entry. */}
            <div className="relative flex justify-center">
              {i < days.length - 1 && (
                <span aria-hidden="true" className="absolute bottom-0 left-1/2 top-3 w-px -translate-x-1/2 bg-border" />
              )}
              <span
                aria-hidden="true"
                className="relative z-[1] grid size-6 shrink-0 place-items-center rounded-full border border-border bg-[var(--core-color-surface-subtle)] text-text-secondary"
              >
                {kinds.length === 1 ? ICON[kinds[0]] : ICON.step}
              </span>
            </div>
            <div className={cn('min-w-0 pr-2', i < days.length - 1 && 'pb-4')}>
              <div className="flex min-h-6 items-center gap-x-1.5 text-dense tabular-nums text-text-secondary">
                <DateTime relative>{day[0].at}</DateTime>
                <span className="ml-auto flex items-center gap-1">
                  {vias.map((v) =>
                    v === 'API' ? (
                      <Code aria-label="Ordered through the API" key={v} size={13} strokeWidth={1.75} />
                    ) : (
                      <Monitor aria-label="Ordered in the dashboard" key={v} size={13} strokeWidth={1.75} />
                    )
                  )}
                </span>
              </div>
              <div className="flex flex-col">
                {day.map((e, j) => (
                  <span className="flex min-h-7 items-center text-dense leading-5 text-text-primary" key={`${e.at}-${j}`}>
                    {e.text}
                  </span>
                ))}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
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
            ? cn(
                // The line runs from this icon's centre to the next one's — each
                // row's two lines are 40px, the icon centred on them — and
                // passes behind the icons.
                'relative last:pb-0 before:absolute before:-bottom-5 before:left-[11px] before:top-5 before:w-px before:bg-[var(--core-color-border-divider)] last:before:hidden',
                // The full page breathes; the overview's column stays compact.
                timeAtEnd ? 'pb-6' : 'pb-4'
              )
            : 'px-4 py-2.5 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-[var(--core-color-border-divider)]',
          stacked ? cn('flex gap-3 text-sm', flush ? 'items-center' : 'items-start') : 'flex items-baseline justify-between gap-4'
        )}
      >
        {stacked ? (
          <>
            <span
              className={cn(
                'flex shrink-0 text-text-secondary',
                flush
                  ? 'relative z-[1] size-6 items-center justify-center rounded-full border border-border bg-card'
                  : 'mt-0.5'
              )}
            >
              {ICON[e.kind]}
            </span>
            <span
              className={cn(
                'flex min-w-0 flex-1',
                timeAtEnd ? 'items-baseline justify-between gap-4' : 'flex-col'
              )}
            >
              {timeAtEnd ? (
                // The full page: what happened, and under it where from and who.
                <span className="flex min-w-0 flex-col">
                  <span className="font-semibold">{e.text}</span>
                  <Text size="sm" tone="secondary">
                    {e.via} · {e.by}
                  </Text>
                </span>
              ) : (
                // The narrow column: the assessment (clipped when long) over
                // when and what happened to it — no who.
                <span className="flex min-w-0 flex-col" title={e.text}>
                  <span className="truncate font-semibold">{e.subject ?? e.text}</span>
                  {/* When, then what happened: "18 hours ago · Summary generated". */}
                  <Text className="truncate" size="sm" tone="secondary">
                    <DateTime relative>{e.at}</DateTime>
                    {e.action && <> · {e.action[0].toUpperCase() + e.action.slice(1)}</>}
                  </Text>
                </span>
              )}
              {timeAtEnd && (
                <Text size="sm" tone="secondary" className="shrink-0 whitespace-nowrap">
                  <DateTime relative>{e.at}</DateTime>
                </Text>
              )}
            </span>
          </>
        ) : (
          <>
            <span className="min-w-0">
              {e.text}
              <span className="text-text-secondary"> · {e.via} · {e.by}</span>
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

/** Every event, as the business page's Activity reads them: the same
 *  feed — icons on a line, each time under its event — in full. */
export const ActivityTab = ({
  record,
  reads,
  dense = false,
  assessed
}: {
  record: BusinessRecord
  reads: AssessmentRead[]
  dense?: boolean
  /** The open workflow's assessments and when each completed. */
  assessed?: Array<{ label: string; at: string }>
}) => {
  const events = useActivity(record, reads, assessed)
  return events.length === 0 ? (
    <Text tone="secondary">No activity yet.</Text>
  ) : (
    dense ? <PanelEventList events={events} /> : <EventList events={events} stacked flush timeAtEnd />
  )
}

const FIRST = 3

/** The newest few, in the overview's right column; all of them on the Activity page. */
export const RecentActivity = ({ record, reads }: { record: BusinessRecord; reads: AssessmentRead[] }) => {
  const events = useActivity(record, reads)
  return (
    <section aria-label="Activity" className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <SectionTitle className="flex items-center gap-2">
          Activity
          {/* Every event, as Assessments counts its cards. */}
          <PageHeadingCount>{events.length}</PageHeadingCount>
        </SectionTitle>
        {/* The rest is the business's Activity page, from the heading's end. */}
        {events.length > FIRST && (
          // A secondary button filled with the page's own canvas rather than
          // white — its stroke kept — so it sits back beside the heading.
          <ActionLink
            className="!bg-surface-canvas hover:!bg-[var(--core-color-state-hover-bg)]"
            size="compact"
            to={businessHref(record.id, 'activity')}
            variant="secondary"
          >
            Show all
          </ActionLink>
        )}
      </div>
      {/* No card: a plain list under its title, ruled apart. */}
      <div>
        {events.length === 0 ? (
          <Text tone="secondary">No activity yet.</Text>
        ) : (
          <>
            <EventList events={events.slice(0, FIRST)} stacked flush />
          </>
        )}
      </div>
    </section>
  )
}
