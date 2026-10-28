import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'

import {
  ActionButton,
  DataTable,
  DateTime,
  MetaChip,
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
  TruncatedText,
  type DataTableColumnDef,
  type DataTableSortState
} from '@/core'
import type { BusinessRecord } from '@/lib/deriveResults'
import { ALL, assessmentOf, type Assessed } from '@/lib/records'
import { displayName } from '@/lib/businessNames'
import { isOrdering, ORDERED } from '@/lib/orderedWorkflows'
import { readAssessments, type AssessmentRead } from '@/lib/assessments'
import { useStoredStatus, type ReviewStatus } from '@/lib/review'
import { polarityCounts } from '@/lib/identityScore'
import { deriveResults } from '@/lib/deriveResults'

import { PortfolioAssistant } from '../components/Assistant/PortfolioAssistant'
import { DeterminationChip } from '../components/DeterminationChip'
import { InsightCounts } from '../components/InsightCounts'
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
  insights: 300,
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
    return { record, assessed: assessed && { ...assessed, counts }, reads, counts, lastAt: lastAssessedOf(reads, assessed?.at) }
  }
  const results = deriveResults(record)
  const keys = new Set(reads.flatMap((r) => r.assessment.insights ?? []))
  const ids = results.filter((r) => keys.has(r.insightId.split(':')[0])).map((r) => r.insightId)
  return { record, assessed: null, reads, counts: polarityCounts(record, results, ids), lastAt: lastAssessedOf(reads, assessmentOf(record)?.at) }
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
const StatusCell = ({ row }: { row: Row }) => {
  const stored = useStoredStatus(row.record.id)
  if (row.pending || isOrdering(row.record.id)) return <MetaChip size="xs">Ordering</MetaChip>
  if (stored)
    return (
      <MetaChip size="compact" tone={STATUS_CHIP[stored].tone}>
        {STATUS_CHIP[stored].label}
      </MetaChip>
    )
  // Nobody has decided yet: Middesk's call, marked as a recommendation so it
  // is never read as an analyst's decision.
  if (row.assessed)
    return (
      <span className="flex flex-col items-start gap-0.5">
        <DeterminationChip band={row.assessed.score.band} />
        <span className="text-text-secondary">Recommended</span>
      </span>
    )
  return <MetaChip size="compact">{row.reads?.length ? 'Not reviewed' : 'Not assessed'}</MetaChip>
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
    // The name is the row's primary identifier, so it's bold. `TruncatedText`
    // shows the full name in a tooltip when it's actually clipped.
    cell: ({ row }) => <TruncatedText className="font-semibold">{displayName(row.original.record.name)}</TruncatedText>,
    meta: { width: COLUMN_WIDTHS.name, grow: true }
  },
  {
    id: 'insights',
    header: 'Insights',
    accessorFn: (row) => row.assessed?.counts.negative ?? -1,
    /**
     * How the insights the assessment rests on read: positive, negative,
     * neutral. The app's `TaskList` triplet, with the score's own reading in
     * place of the review task's status the records do not carry — see
     * `InsightCounts`. A record with no report has nothing the score has read,
     * so it reads as a dash rather than as three zeros.
     */
    cell: ({ row }) => {
      const counts = row.original.counts
      if (!counts) return <span className="text-caption text-text-disabled">—</span>
      return <InsightCounts counts={counts} />
    },
    meta: { align: 'start', width: COLUMN_WIDTHS.insights, grow: true }
  },
  {
    id: 'assessed',
    header: 'Last assessed',
    accessorFn: (row) => row.lastAt ?? '',
    // When the newest report ran — not when the record was created, which is
    // what the column said before and which no decision turns on.
    cell: ({ row }) =>
      row.original.lastAt ? (
        <DateTime className="whitespace-nowrap text-caption text-text-secondary" relative>
          {row.original.lastAt}
        </DateTime>
      ) : (
        <span className="text-caption text-text-disabled">—</span>
      ),
    meta: { width: COLUMN_WIDTHS.assessed, grow: true }
  }
]

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
          </ToolbarSection>
          <ToolbarSpacer />
          <div className="flex shrink-0 items-center gap-2 text-caption text-muted-foreground">
            <span className="whitespace-nowrap tabular-nums">
              {!filtered ? `${ALL.length} businesses` : `${rows.length} of ${ALL.length}`}
            </span>
          </div>
        </Toolbar>
      </div>

      <DataTable
        caption="Businesses"
        className="rounded-t-none border-t-0"
        columns={columns}
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
