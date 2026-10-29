import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { ChevronDown, ChevronUp, Columns3, GripVertical } from 'lucide-react'

import {
  ActionButton,
  DataTable,
  DateTime,
  Checkbox,
  IconActionButton,
  MetaChip,
  Popover,
  PopoverContent,
  PopoverTrigger,
  PageContainer,
  PageHeader,
  PageHeaderActions,
  PageHeaderBand,
  PageHeaderBar,
  PageHeaderTitles,
  PageHeading,
  SearchInput,
  Toolbar,
  ToolbarSection,
  ToolbarSpacer,
  type DataTableColumnDef,
  type DataTableSortState
} from '@/core'
import type { BusinessRecord } from '@/lib/deriveResults'
import { cn } from '@/utils/twUtils'
import { ALL, assessmentOf, type Assessed } from '@/lib/records'
import { displayName } from '@/lib/businessNames'
import { isOrdering, ORDERED } from '@/lib/orderedWorkflows'
import { readAssessments, type AssessmentRead } from '@/lib/assessments'
import { assessmentCountsOf, type AssessmentCounts, type AssessmentStatus } from '@/lib/assessmentCounts'
import { StatusDot } from '@/components/Report/AssessmentPanel'
import { PointerTip } from '@/components/PointerTip'
import { maskTin } from '@/lib/attributes'
import dayjs from '@/lib/dayjs'
import { entityTypeShown } from '@/lib/normalise'
import { stateName } from '@/lib/states'
import { statusForBand, TEAM, useReview, useStoredStatus, type ReviewStatus } from '@/lib/review'
import { CURRENT_USER } from '@/lib/user'
import { domesticOf, notPublished, registrationState } from '@/lib/registrationStatus'
import { polarityCounts } from '@/lib/identityScore'
import { deriveResults } from '@/lib/deriveResults'

import { PortfolioAssistant } from '../components/Assistant/PortfolioAssistant'
import { DeterminationChip } from '../components/DeterminationChip'
import { PAGE_MEASURE } from '../lib/pageMeasure'


/**
 * Column widths — each a minimum; the growing columns share what is left. The
 * app's (`app/src/containers/Businesses/BusinessList/columns.ts`) summed to
 * 1096, wider than the business flow's measure (`pageMeasure.ts`), so the
 * table scrolled sideways inside it. These are what each cell needs: the
 * Status chip, a name and assessment chips that wrap, the three counts'
 * fixed tracks (3 × 86 + gaps, with padding), a relative date. 940 in all.
 */
const COLUMN_WIDTHS = {
  status: 120,
  name: 200,
  // Four marks and their counts: no wider, so it sits by Last updated.
  assessments: 210,
  assessed: 120
}

/** What a row holds: the record and its newest assessment. A business whose
 *  order is placed but not yet pulled has only its id, name and workflows. */
type Row = {
  record: Pick<BusinessRecord, 'id' | 'name'>
  assessed: Assessed | null
  /** Each of its assessments, read: one chip each in the row. */
  reads?: AssessmentRead[]
  /** Across its assessments, each insight once. */
  counts?: { positive: number; negative: number; neutral: number }
  /** Its assessments by status, as its page's Assessments panel counts them. */
  statuses?: AssessmentCounts
  /** When it was last assessed: the newest run, completion or summary. */
  lastAt?: string
  pending?: string[]
}

/** The newest date any of its assessments carries. */
const lastAssessedOf = (reads: AssessmentRead[], held?: string) =>
  [
    held,
    ...reads.flatMap((r) => [r.assessment.orderedAt, r.assessment.completedAt, r.summary?.at])
  ]
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1)

/** A business, as a row: its newest report for "Full Business KYB", or each of its
 *  custom orders' assessments with their insights counted once. */
const rowFor = (record: BusinessRecord): Row => {
  const reads = readAssessments(record)
  // A business with a "Full Business KYB" report reads as that report: its call
  // and its insights counted as the report's Insights panel counts them, review
  // folded into negative — so the row and the report it opens agree.
  const full = reads.find((r) => r.assessment.full)
  if (full) {
    const assessed = assessmentOf(record)
    const { good, bad, review, neutral } = full.tally
    const counts = { positive: good, negative: bad + review, neutral }
    return { record, assessed: assessed && { ...assessed, counts }, reads, counts, statuses: assessmentCountsOf(record), lastAt: lastAssessedOf(reads, assessed?.at) }
  }
  const results = deriveResults(record)
  const keys = new Set(reads.flatMap((r) => r.assessment.insights ?? []))
  const ids = results.filter((r) => keys.has(r.insightId.split(':')[0])).map((r) => r.insightId)
  return {
    record,
    assessed: null,
    reads,
    counts: polarityCounts(record, results, ids),
    statuses: assessmentCountsOf(record),
    lastAt: lastAssessedOf(reads, assessmentOf(record)?.at)
  }
}

/** Ordered from `/order` but not in records.json yet — the pull right after
 *  ordering failed, and the poll below retries it. */
const pendingRows = (): Row[] =>
  Object.entries(ORDERED)
    .filter(([id, o]) => o.assessments.some((a) => !a.completedAt) && !ALL.some((r) => r.id === id))
    .map(([id, o]) => ({ id, o, at: o.assessments.map((a) => a.orderedAt).sort().at(-1) ?? '' }))
    .sort((a, b) => b.at.localeCompare(a.at))
    .map(({ id, o }) => ({ record: { id, name: o.name }, assessed: null, pending: o.assessments.map((a) => a.name) }))

const STATUS_CHIP: Record<ReviewStatus, { label: string; tone: 'success' | 'warning' | 'danger' }> = {
  approved: { label: 'Approved', tone: 'success' },
  in_review: { label: 'Needs review', tone: 'warning' },
  rejected: { label: 'Rejected', tone: 'danger' }
}

/** The reviewer's status for the business; where nobody has set one, the
 *  report's own call for "Full Business KYB", and "Not reviewed" for custom orders,
 *  which have no roll-up. */
/** A long date, as the cards write one: "Mar 24, 2000". */
const longDay = (iso?: string | null) => (iso ? dayjs(iso.slice(0, 10)).format('MMM D, YYYY') : undefined)

/**
 * A cell, and on hover what is behind it: the same white card, following the
 * pointer, as the name's and the assessments'. One fact a line.
 */
const Tipped = ({ facts, children }: { facts: Array<[string, ReactNode]>; children: ReactNode }) => {
  const shown = facts.filter(([, v]) => v !== undefined && v !== null && v !== '')
  if (shown.length === 0) return <>{children}</>
  return (
    <PointerTip
      className="inline-block max-w-full align-middle"
      content={
        <dl className="m-0 flex max-w-56 flex-col gap-1.5">
          {shown.map(([label, value], i) => (
            <div className="flex flex-col" key={label || i}>
              {/* A fact that says itself — "Policy · Full Business KYB" — has no label. */}
              {label && <dt className="text-text-secondary">{label}</dt>}
              <dd className="m-0 break-words text-text-primary">{value}</dd>
            </div>
          ))}
        </dl>
      }
    >
      {children}
    </PointerTip>
  )
}

const StatusCell = ({ row }: { row: Row }) => {
  const stored = useStoredStatus(row.record.id)
  const review = useReview(row.record.id)
  if (row.pending || isOrdering(row.record.id))
    return (
      <Tipped facts={[['Ordering', row.pending?.join(', ') ?? 'Its assessments are still running']]}>
        <MetaChip size="xs">Ordering</MetaChip>
      </Tipped>
    )
  // Who decided, in one field: the policy and which, or the assignee and who
  // (an agent among them) — and their note, only where there is one.
  if (stored)
    return (
      <Tipped
        facts={[
          ['', review.change ? `Assignee · ${review.change.by}` : undefined],
          ['Note', review.change?.note]
        ]}
      >
        <MetaChip size="compact" tone={STATUS_CHIP[stored].tone}>
          {STATUS_CHIP[stored].label}
        </MetaChip>
      </Tipped>
    )
  if (row.assessed)
    return (
      <Tipped
        facts={[
          ['', `Policy · ${row.reads?.find((r) => r.assessment.full)?.assessment.name ?? 'Full Business KYB'}`]
        ]}
      >
        <DeterminationChip band={row.assessed.score.band} />
      </Tipped>
    )
  return <MetaChip size="compact">{row.reads?.length ? 'Not reviewed' : 'Not assessed'}</MetaChip>
}

/** A business's age from its formation date: "27 years", or months under a year. */
const ageOf = (date?: string) => {
  if (!date) return undefined
  const years = dayjs().diff(dayjs(date.slice(0, 10)), 'year')
  if (years >= 1) return `${years} ${years === 1 ? 'year' : 'years'}`
  const months = dayjs().diff(dayjs(date.slice(0, 10)), 'month')
  return `${months} ${months === 1 ? 'month' : 'months'}`
}

/** The top-level identity, one fact a line — the name is the row's own: what
 *  it is, how old, where formed, its TIN, where it is, its site. */
const listFacts = (record: BusinessRecord): Array<{ label: string; value: string }> => {
  const f = record.formation
  const tin = (record.tin as { tin?: string } | null)?.tin
  const site = (record.website as { url?: string } | null)?.url
  const office = record.addresses.find((a) => a.submitted) ?? record.addresses[0]
  return [
    { label: 'Entity type', value: f?.entityType ? String(entityTypeShown(record, f.entityType)) : '—' },
    { label: 'Age', value: ageOf(f?.date) ?? '—' },
    { label: 'Formation state', value: f?.state ? stateName(f.state) : '—' },
    { label: 'TIN', value: tin ? maskTin(tin) : 'Not found' },
    { label: 'Office address', value: office?.fullAddress ?? '—' },
    { label: 'Website', value: site ? site.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') : '—' }
  ]
}

/**
 * The business's name, and on hover its identity (`listFacts`) in the white
 * popover the report uses. A business still ordering has no record yet: its
 * name alone.
 */
const BusinessNameCell = ({ id, name }: { id: string; name: string }) => {
  const record = ALL.find((r) => r.id === id)
  const label = <span className="block truncate font-semibold">{displayName(name)}</span>
  if (!record) return label
  return (
    // As wide as the name; the card follows the pointer over it.
    <PointerTip
      className="inline-block max-w-full align-middle"
      content={
        <dl className="m-0 flex w-64 flex-col gap-1.5">
          {listFacts(record).map((f) => (
            <div className="flex flex-col" key={f.label}>
              <dt className="text-text-secondary">{f.label}</dt>
              <dd className="m-0 break-words text-text-primary">{f.value}</dd>
            </div>
          ))}
        </dl>
      }
    >
      {label}
    </PointerTip>
  )
}

/** The panel's four statuses, in its order and with its marks. */
const STATUS_ORDER: Array<{ key: AssessmentStatus; intent: AssessmentStatus; word: string }> = [
  { key: 'failure', intent: 'failure', word: 'Not passed' },
  { key: 'success', intent: 'success', word: 'Passed' },
  { key: 'unknown', intent: 'unknown', word: 'Context' },
  { key: 'pending', intent: 'pending', word: "Can't assess" }
]

/** A business's assessments by status: each its mark and its count; a status
 *  none of them has is left out. On hover, each assessment and how it came
 *  out, grouped by status in the same order. */
const AssessmentStatusCounts = ({ counts }: { counts: AssessmentCounts }) => {
  const shown = STATUS_ORDER.filter(({ key }) => counts[key] > 0)
  // What every mark opens: each assessment, grouped by how it came out.
  const outcomes = (
    <span className="flex flex-col gap-2">
      {shown.map(({ key, intent, word }) => (
        <span className="flex flex-col gap-0.5" key={key}>
          <span className="flex items-baseline justify-between gap-4 font-semibold text-text-primary">
            {word}
            <span className="font-normal tabular-nums text-text-secondary">{counts[key]}</span>
          </span>
          {counts.items
            .filter((i) => i.status === key)
            .map((i) => (
              <span className="flex items-center gap-1.5 text-text-primary" key={i.cardId}>
                <StatusDot intent={intent} size={12} />
                {i.label}
              </span>
            ))}
        </span>
      ))}
    </span>
  )
  return (
    // The marks and their counts; the card follows the pointer over them.
    <PointerTip className="inline-flex flex-wrap items-center gap-x-3 gap-y-1" content={outcomes}>
      {shown.map(({ key, intent, word }) => (
        // The mark and the count; the word is the mark's name, to a screen reader.
        <span
          aria-label={`${counts[key]} ${word.toLowerCase()}`}
          className="inline-flex items-center gap-1 whitespace-nowrap"
          key={key}
          role="img"
        >
          <StatusDot intent={intent} size={14} />
          <span className="tabular-nums text-text-primary">{counts[key]}</span>
        </span>
      ))}
    </PointerTip>
  )
}

/** Every business whose orders are still running, pulled or not. */
const ORDERING = Object.keys(ORDERED).filter(isOrdering)

/** How often a pending order is checked on. */
const POLL_MS = 10_000

const columns: DataTableColumnDef<Row>[] = [
  {
    id: 'status',
    header: 'Status',
    accessorFn: (row) => row.assessed?.score.value ?? -1,
    /**
     * The determination the newest assessment reached — Approve, Needs review,
     * Reject — in the app's own Status chip, at the app's own width. A business
     * with no assessment reads Not assessed. It leads the row, ahead of the
     * name, so the list scans by outcome first.
     */
    cell: ({ row }) => <StatusCell row={row.original} />,
    meta: { width: COLUMN_WIDTHS.status }
  },
  {
    id: 'name',
    header: 'Business Name',
    accessorFn: (row) => row.record.name,
    // The name is the row's primary identifier, so it's bold. On hover, the
    // business's identity in the white popover — the full name among it.
    cell: ({ row }) => <BusinessNameCell id={row.original.record.id} name={row.original.record.name} />,
    meta: { width: COLUMN_WIDTHS.name, grow: true }
  },
  {
    id: 'assessments',
    header: 'Assessments',
    accessorFn: (row) => row.statuses?.failure ?? -1,
    /** Its assessments by status, in the report's own terms — not passed,
     *  passed, context, can't assess yet — each with the panel's mark. A
     *  business with none run reads as a dash. */
    cell: ({ row }) => {
      const s = row.original.statuses
      if (!s) return <span className="text-caption text-text-disabled">—</span>
      return <AssessmentStatusCounts counts={s} />
    },
    meta: { align: 'start', width: COLUMN_WIDTHS.assessments }
  },
  {
    id: 'assessed',
    header: 'Last updated',
    accessorFn: (row) => row.lastAt ?? '',
    // When the newest report ran — not when the record was created, which is
    // what the column said before and which no decision turns on.
    // On hover, the day, and each workflow run with when it ran.
    cell: ({ row }) =>
      row.original.lastAt ? (
        <Tipped
          facts={[
            ['Last updated', longDay(row.original.lastAt)]
          ]}
        >
          <DateTime className="whitespace-nowrap text-caption text-text-secondary" relative>
            {row.original.lastAt}
          </DateTime>
        </Tipped>
      ) : (
        <span className="text-caption text-text-disabled">—</span>
      ),
    meta: { width: COLUMN_WIDTHS.assessed }
  }
]

/** The record behind a row; a business still ordering has none yet. */
const recordOf = (row: Row) => ALL.find((r) => r.id === row.record.id)
const dash = <span className="text-caption text-text-disabled">—</span>
/** A plain fact of the record, or a dash. */
const fact = (value: string | undefined) => (value ? <span className="block truncate">{value}</span> : dash)

/** Who has the business, as its page's "Assigned to" says. */
const AssigneeCell = ({ id }: { id: string }) => {
  const review = useReview(id)
  const who = TEAM.find((t) => t.id === review.assigneeId)
  if (!who) return dash
  return (
    <Tipped facts={[['Email', who.email]]}>
      {fact(who.name)}
    </Tipped>
  )
}

/**
 * Columns the reader can add: when the business was created, who has it, and
 * its identity's attributes — one fact a column, as the name's card lists them.
 */
const OPTIONAL_COLUMNS: DataTableColumnDef<Row>[] = [
  {
    id: 'created',
    header: 'Created',
    accessorFn: (row) => recordOf(row)?.createdAt ?? '',
    cell: ({ row }) => {
      const at = recordOf(row.original)?.createdAt
      return at ? (
        // When it was ordered, how, and by whom. Everything in the prototype is
        // ordered in the dashboard, by the reader, as Activity says too.
        <Tipped
          facts={[
            ['Ordered', `${longDay(at)} by ${CURRENT_USER} · Dashboard`]
          ]}
        >
          <DateTime className="whitespace-nowrap text-caption text-text-secondary" relative>
            {at}
          </DateTime>
        </Tipped>
      ) : (
        dash
      )
    },
    meta: { width: 120 }
  },
  {
    id: 'assigned',
    header: 'Assigned to',
    cell: ({ row }) => <AssigneeCell id={row.original.record.id} />,
    meta: { width: 140 }
  },
  {
    id: 'entity_type',
    header: 'Entity type',
    accessorFn: (row) => recordOf(row)?.formation?.entityType ?? '',
    // On hover, the filing that says so.
    cell: ({ row }) => {
      const r = recordOf(row.original)
      if (!r?.formation?.entityType) return dash
      const d = domesticOf(r)
      return (
        <Tipped
          facts={[
            ['From', d ? `${stateName(d.state)} Secretary of State filing` : 'The submitted details']
          ]}
        >
          {fact(String(entityTypeShown(r, r.formation.entityType)))}
        </Tipped>
      )
    },
    meta: { width: 170 }
  },
  {
    id: 'age',
    header: 'Age',
    accessorFn: (row) => recordOf(row)?.formation?.date ?? '',
    // On hover, the domestic registration it is counted from: when, and where.
    cell: ({ row }) => {
      const r = recordOf(row.original)
      const age = ageOf(r?.formation?.date)
      if (!r || !age) return dash
      const d = domesticOf(r)
      return (
        <Tipped
          facts={[
            [
              'Domestic registration',
              [longDay(d?.registrationDate ?? r.formation?.date), d ? stateName(d.state) : r.formation?.state ? stateName(r.formation.state) : undefined]
                .filter(Boolean)
                .join(' · ')
            ]
          ]}
        >
          {fact(age)}
        </Tipped>
      )
    },
    meta: { width: 100 }
  },
  {
    id: 'formation_state',
    header: 'Formation state',
    accessorFn: (row) => recordOf(row)?.formation?.state ?? '',
    // On hover, how its domestic filing there stands.
    cell: ({ row }) => {
      const r = recordOf(row.original)
      const st = r?.formation?.state
      if (!r || !st) return dash
      const d = domesticOf(r)
      const s = d ? registrationState(d) : undefined
      return (
        <Tipped
          facts={[
            ['Domestic filing', !d ? 'None found' : notPublished(d) ? 'Status not published by the state' : (s?.status ?? 'No status')]
          ]}
        >
          {fact(stateName(st))}
        </Tipped>
      )
    },
    meta: { width: 140 }
  },
  {
    id: 'tin',
    header: 'TIN',
    cell: ({ row }) => {
      const r = recordOf(row.original)
      if (!r) return dash
      const tin = (r.tin as { tin?: string } | null)?.tin
      if (!tin) return <span className="text-text-secondary">Not found</span>
      // On hover, what the IRS said of it.
      const irs = r.reviewTasks.find((t) => t.key === 'tin')?.subLabel
      return (
        <Tipped facts={[['IRS match', irs]]}>
          <span className="tabular-nums">{maskTin(tin)}</span>
        </Tipped>
      )
    },
    meta: { width: 130 }
  },
  {
    id: 'office',
    header: 'Office address',
    // On hover, what the address is: deliverable, what kind of property, an agent's.
    cell: ({ row }) => {
      const r = recordOf(row.original)
      const a = r?.addresses.find((x) => x.submitted) ?? r?.addresses[0]
      if (!a) return dash
      return (
        <Tipped
          facts={[
            [
              'Office',
              [
                a.propertyType ? a.propertyType.charAt(0).toUpperCase() + a.propertyType.slice(1).toLowerCase() : undefined,
                a.deliverable === false ? 'Undeliverable' : a.deliverable ? 'Deliverable' : undefined,
                a.isRegisteredAgent ? 'Registered agent' : undefined
              ]
                .filter(Boolean)
                .join(' · ') || undefined
            ]
          ]}
        >
          {fact(a.fullAddress)}
        </Tipped>
      )
    },
    meta: { width: 260 }
  },
  {
    id: 'website',
    header: 'Website',
    // On hover, the full address and whether it is up.
    cell: ({ row }) => {
      const w = recordOf(row.original)?.website as { url?: string | null; status?: string | null; parked?: boolean } | null
      if (!w?.url) return dash
      return (
        <Tipped
          facts={[
            ['Website', w.parked ? 'Parked' : w.status ? w.status.charAt(0).toUpperCase() + w.status.slice(1) : undefined]
          ]}
        >
          {fact(w.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}
        </Tipped>
      )
    },
    meta: { width: 180 }
  }
]

/**
 * Which columns show, and in what order — the reader's own, and kept. The
 * name cannot be hidden. Every column the list knows is in `order`, shown or
 * not, so one put back returns to where it was.
 */
type ColumnLayout = { order: string[]; shown: string[] }
const LOCKED = 'name'
const COLUMNS_KEY = 'prototype:business-columns.v2'
const columnById = (id: string) => [...columns, ...OPTIONAL_COLUMNS].find((c) => c.id === id)
const DEFAULT_LAYOUT: ColumnLayout = {
  order: ['status', 'name', ...OPTIONAL_COLUMNS.map((c) => c.id!), 'assessments', 'assessed'],
  shown: ['status', 'name', 'assessments', 'assessed']
}
const readLayout = (): ColumnLayout => {
  try {
    const saved = JSON.parse(window.localStorage.getItem(COLUMNS_KEY) ?? 'null') as ColumnLayout | null
    if (!saved?.order || !saved.shown?.includes(LOCKED)) return DEFAULT_LAYOUT
    // A column added since the layout was kept joins at the end, hidden.
    const known = saved.order.filter((id) => columnById(id))
    return { order: [...known, ...DEFAULT_LAYOUT.order.filter((id) => !known.includes(id))], shown: saved.shown }
  } catch {
    return DEFAULT_LAYOUT
  }
}

/**
 * The columns, to show or hide and to put in order: dragged by the grip, or
 * moved a place at a time with the arrows (the keyboard's way). The name can
 * move but not be hidden.
 */
const ColumnsPanel = ({ layout, onChange }: { layout: ColumnLayout; onChange: (next: ColumnLayout) => void }) => {
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  // The shown, in the table's order, then the hidden: only the shown are put
  // in order, so a move never jumps past a column that isn't there.
  const visible = layout.order.filter((id) => id === LOCKED || layout.shown.includes(id))
  const hidden = layout.order.filter((id) => !visible.includes(id))
  const setVisible = (next: string[], shown = layout.shown) => onChange({ order: [...next, ...hidden.filter((h) => !next.includes(h))], shown })
  const move = (id: string, to: number) => {
    const next = visible.filter((x) => x !== id)
    next.splice(Math.max(0, Math.min(next.length, to)), 0, id)
    setVisible(next)
  }
  // Put on: it joins the end of the shown. Taken off: it goes to the hidden.
  const show = (id: string) => setVisible([...visible, id], [...layout.shown, id])
  const hide = (id: string) => {
    const shown = layout.shown.filter((x) => x !== id)
    onChange({ order: [...visible.filter((x) => x !== id), id, ...hidden], shown })
  }
  const label = (id: string) => String(columnById(id)?.header ?? id)
  return (
    <div className="flex w-64 flex-col">
      <span className="px-2 pb-1 pt-0.5 text-caption font-semibold text-text-secondary">Shown · drag to reorder</span>
      <ol className="m-0 flex list-none flex-col p-0">
        {visible.map((id, i) => {
          const locked = id === LOCKED
          return (
            <li
              className={cn(
                'flex items-center gap-1.5 rounded-control px-1 py-0.5',
                dragging === id && 'opacity-50',
                over === id && dragging !== id && 'shadow-[inset_0_2px_0_var(--core-color-action-primary-bg)]'
              )}
              draggable
              key={id}
              onDragEnd={() => {
                setDragging(null)
                setOver(null)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                setOver(id)
              }}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move'
                setDragging(id)
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (dragging && dragging !== id) move(dragging, visible.filter((x) => x !== dragging).indexOf(id))
                setDragging(null)
                setOver(null)
              }}
            >
              <GripVertical aria-hidden="true" className="shrink-0 cursor-grab text-text-secondary" size={14} strokeWidth={1.75} />
              <Checkbox checked className="min-w-0 flex-1" disabled={locked} onCheckedChange={() => hide(id)}>
                {label(id)}
              </Checkbox>
              <IconActionButton aria-label={`Move ${label(id)} up`} disabled={i === 0} onClick={() => move(id, i - 1)} size="compact" variant="quiet">
                <ChevronUp aria-hidden="true" size={14} />
              </IconActionButton>
              <IconActionButton
                aria-label={`Move ${label(id)} down`}
                disabled={i === visible.length - 1}
                onClick={() => move(id, i + 1)}
                size="compact"
                variant="quiet"
              >
                <ChevronDown aria-hidden="true" size={14} />
              </IconActionButton>
            </li>
          )
        })}
      </ol>
      {hidden.length > 0 && (
        <>
          <span className="mt-2 border-t border-[var(--core-color-border-divider)] px-2 pb-1 pt-2 text-caption font-semibold text-text-secondary">
            Hidden
          </span>
          <ul className="m-0 flex list-none flex-col p-0">
            {hidden.map((id) => (
              // Indented to the shown columns' checkboxes, past their grip.
              <li className="flex items-center py-0.5 pl-[26px] pr-1" key={id}>
                <Checkbox checked={false} className="min-w-0 flex-1" onCheckedChange={() => show(id)}>
                  {label(id)}
                </Checkbox>
              </li>
            ))}
          </ul>
        </>
      )}
      <ActionButton className="mt-1 self-start" onClick={() => onChange(DEFAULT_LAYOUT)} size="compact" variant="quiet">
        Reset
      </ActionButton>
    </div>
  )
}

/** What a column sorts by — the same value its cell prints. */
const sortKey = (row: Row, id: string): number | string => {
  switch (id) {
    case 'name':
      return row.record.name
    case 'status':
      return row.assessed?.score.value ?? -1
    case 'insights':
      return row.assessed?.counts.negative ?? -1
    case 'assessed':
      return row.lastAt ?? ''
    default:
      return ''
  }
}

const compare = (a: Row, b: Row, id: string) => {
  const x = sortKey(a, id)
  const y = sortKey(b, id)
  if (typeof x === 'number' && typeof y === 'number') return x - y
  return String(x).localeCompare(String(y))
}

/**
 * Every business the prototype has ingested.
 *
 * The 25 rows in `records.json` and nothing else — no placeholder rows, no
 * synthesised entries. A row opens the business and its assessment. Searched
 * by name, sorted by any column, most recently assessed first by default —
 * a business never assessed sorts last.
 *
 * The shell is the app's businesses page: a page heading over one bordered
 * card, where the toolbar owns the rounded top and the table drops its top
 * border (`rounded-t-none border-t-0`) so the two read as a single box.
 */
export const BusinessesPage = () => {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  // Seeded from ?q= so the palette's "See all results" lands on a filtered
  // list rather than the full one.
  const [query, setQuery] = useState(() => params.get('q') ?? '')
  // Newest assessment first: the business just worked on is the one being looked for.
  const [sort, setSort] = useState<DataTableSortState>({ id: 'assessed', direction: 'desc' })
  // Which columns show, and in what order — the reader's own, and kept.
  const [layout, setLayout] = useState<ColumnLayout>(readLayout)
  const changeLayout = (next: ColumnLayout) => {
    setLayout(next)
    try {
      window.localStorage.setItem(COLUMNS_KEY, JSON.stringify(next))
    } catch {
      // Blocked storage: the choice lasts for this visit.
    }
  }
  const visibleColumns = layout.order
    .filter((id) => id === LOCKED || layout.shown.includes(id))
    .map((id) => columnById(id)!)
    .filter(Boolean)

  /**
   * Dock the table's sticky column header to the sticky filter bar.
   *
   * The bar publishes its measured height as `--bus-thead-top` and the table
   * reads it, so the header pins BELOW the bar rather than under it. A fixed
   * offset would let the bar paint over the header on scroll. Ported from the
   * app's Toolbar, which needs the measurement because its active-filter tags
   * wrap to extra rows; this bar is one row today, and the observer keeps it
   * honest if that changes.
   */
  const stickyRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = stickyRef.current
    if (!el) return
    const publish = () =>
      document.documentElement.style.setProperty('--bus-thead-top', `${el.offsetHeight}px`)
    publish()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(publish)
    observer.observe(el)
    return () => {
      observer.disconnect()
      document.documentElement.style.removeProperty('--bus-thead-top')
    }
  }, [])

  /** Every record, read once, with its newest assessment. */
  const all = useMemo<Row[]>(() => ALL.map(rowFor), [])
  const pending = useMemo(pendingRows, [])

  /**
   * Pull each business still ordering again until its orders finish. The
   * endpoint rewrites its record in records.json when it changed, and the dev
   * server reloads the page with it.
   */
  useEffect(() => {
    if (ORDERING.length === 0) return
    const check = () =>
      ORDERING.forEach((id) => {
        fetch(`/api/order?id=${encodeURIComponent(id)}`).catch(() => {})
      })
    check()
    const timer = window.setInterval(check, POLL_MS)
    return () => window.clearInterval(timer)
  }, [])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const out = all.filter((row) => !q || row.record.name.toLowerCase().includes(q))
    if (sort) out.sort((a, b) => (sort.direction === 'asc' ? 1 : -1) * compare(a, b, sort.id))
    // Just ordered: at the top whatever the sort, as the app lists a new business.
    const ordering = out.filter((row) => isOrdering(row.record.id))
    return [
      ...pending.filter((row) => !q || row.record.name.toLowerCase().includes(q)),
      ...ordering,
      ...out.filter((row) => !ordering.includes(row))
    ]
  }, [all, pending, query, sort])

  const onQueryChange = (value: string) => {
    setQuery(value)
    // Keep the URL honest, so a filtered list can be shared or reloaded.
    const next = new URLSearchParams(params)
    if (value.trim()) next.set('q', value)
    else next.delete('q')
    setParams(next, { replace: true })
  }

  const filtered = Boolean(query.trim())

  return (
    // The business flow's one measure (`pageMeasure.ts`): the same width and
    // breakpoint steps as a business and its report — centred as theirs are,
    // with the rail's 49px kept clear at the right from `wide`.
    <div className="wide:pr-[49px]">
    <PageContainer className={PAGE_MEASURE} padding="none" width="full">
      <div className="py-6">
      {/* The title's centre on the rail's search line (74px from the top):
          24px of container padding, then 50px less half the serif's 40px line. */}
      <PageHeaderBand className="px-0 pt-[30px]">
        <PageHeader>
          <PageHeaderBar>
            <PageHeaderTitles>
              {/* The Workflows page's H1 treatment: the serif at its one weight. */}
              <PageHeading
                count={ALL.length}
                weight="normal"
                className="font-arizona text-3xl font-light leading-10 tracking-[-0.02em]"
              >
                Businesses
              </PageHeading>
            </PageHeaderTitles>
            <PageHeaderActions>
              <ActionButton onClick={() => navigate('/order', { state: { origin: '/businesses' } })} variant="primary">
                Run assessment
              </ActionButton>
            </PageHeaderActions>
          </PageHeaderBar>
        </PageHeader>
      </PageHeaderBand>

      {/*
        * The filter bar pins to the top of the page while the heading scrolls
        * off above it. The WRAPPER is the sticky element, and its canvas
        * background stays opaque over the gap — so rows scrolling up behind
        * the bar never peek above it and the bar's rounded top corners read as
        * page background rather than stray lines. From the app's Toolbar.
        */}
      <div ref={stickyRef} className="sticky top-0 z-[3] bg-surface-canvas pt-6">
        <Toolbar className="flex-nowrap gap-3 rounded-t-card border border-border bg-card px-3 py-1.5">
          <ToolbarSection className="min-w-0 flex-wrap gap-2">
            <search aria-label="Search businesses" className="relative shrink-0">
              <SearchInput
                aria-label="Search by business name"
                className="w-56"
                placeholder="Search businesses"
                value={query}
                onChange={onQueryChange}
              />
            </search>
            {/* How many, beside what narrows them. */}
            <span className="whitespace-nowrap text-caption tabular-nums text-muted-foreground">
              {!filtered ? `${ALL.length} businesses` : `${rows.length} of ${ALL.length}`}
            </span>
          </ToolbarSection>
          <ToolbarSpacer />
          {/* The columns to show: every one but the name can be taken off, and
              the record's other attributes put on. */}
          <Popover>
            <PopoverTrigger asChild>
              <ActionButton leadingIcon={<Columns3 aria-hidden="true" size={14} strokeWidth={1.75} />} size="compact" variant="quiet">
                Columns
              </ActionButton>
            </PopoverTrigger>
            <PopoverContent align="end" className="p-2" themeMode="light">
              <ColumnsPanel layout={layout} onChange={changeLayout} />
            </PopoverContent>
          </Popover>
        </Toolbar>
      </div>

      <DataTable
        caption="Businesses"
        className="rounded-t-none border-t-0"
        columns={visibleColumns}
        data={rows}
        density="compact"
        empty={`No businesses match “${query.trim()}”`}
        getRowId={(row) => row.record.id}
        rowIntent={{
          kind: 'detail',
          // The business — the container — with its assessments listed under
          // it. The row's number and chip are the newest of those.
          onOpen: (row) => {
            if (!row.pending) navigate(`/businesses/${row.record.id}`)
          }
        }}
        sort={sort}
        onSortChange={setSort}
        stickyHeader
        stickyHeaderTop='var(--bus-thead-top, 74px)'
      />

      {/* Questions about every business at once, in the corner. */}
      <PortfolioAssistant />
      </div>
    </PageContainer>
    </div>
  )
}
