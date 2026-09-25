import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'

import {
  DataTable,
  DateTime,
  PageContainer,
  PageHeader,
  PageHeaderBand,
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

import { DeterminationChip } from '../components/DeterminationChip'
import { InsightCounts } from '../components/InsightCounts'


/**
 * Column widths, from `app/src/containers/Businesses/BusinessList/columns.ts`
 * where the app has the column. The name, the determination as the app's
 * Status chip, how its insights read, and when the business was last assessed.
 */
const COLUMN_WIDTHS = {
  name: 232,
  status: 132,
  insights: 304,
  assessed: 148
}

/** What a row holds: the record and its newest assessment. */
type Row = {
  record: BusinessRecord
  assessed: Assessed | null
}

const columns: DataTableColumnDef<Row>[] = [
  {
    id: 'name',
    header: 'Business Name',
    accessorFn: (row) => row.record.name,
    // The name is the row's primary identifier, so it's bold. `TruncatedText`
    // shows the full name in a tooltip when it's actually clipped.
    cell: ({ row }) => <TruncatedText className="font-semibold">{row.original.record.name ?? ''}</TruncatedText>,
    meta: { width: COLUMN_WIDTHS.name, grow: true }
  },
  {
    id: 'status',
    header: 'Status',
    accessorFn: (row) => row.assessed?.score.value ?? -1,
    /**
     * The determination the newest assessment reached — Approve, Needs review,
     * Reject — in the app's own Status chip, at the app's own width. A business
     * with no assessment reads Not assessed.
     */
    cell: ({ row }) => <DeterminationChip band={row.original.assessed?.score.band ?? null} />,
    meta: { width: COLUMN_WIDTHS.status }
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
      const assessed = row.original.assessed
      if (!assessed) return <span className="text-caption text-text-disabled">—</span>
      return <InsightCounts counts={assessed.counts} />
    },
    meta: { align: 'start', width: COLUMN_WIDTHS.insights, grow: true }
  },
  {
    id: 'assessed',
    header: 'Last assessed',
    accessorFn: (row) => row.assessed?.at ?? '',
    // When the newest report ran — not when the record was created, which is
    // what the column said before and which no decision turns on.
    cell: ({ row }) =>
      row.original.assessed?.at ? (
        <DateTime className="whitespace-nowrap text-caption text-text-secondary" relative>
          {row.original.assessed.at}
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
      return row.assessed?.at ?? ''
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
  const all = useMemo<Row[]>(() => ALL.map((record) => ({ record, assessed: assessmentOf(record) })), [])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const out = all.filter((row) => !q || row.record.name.toLowerCase().includes(q))
    if (sort) out.sort((a, b) => (sort.direction === 'asc' ? 1 : -1) * compare(a, b, sort.id))
    return out
  }, [all, query, sort])

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
    <PageContainer width="wide">
      <PageHeaderBand>
        <PageHeader>
          <PageHeading count={ALL.length} weight="normal">
            Businesses
          </PageHeading>
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
          onOpen: (row) => navigate(`/businesses/${row.record.id}`)
        }}
        sort={sort}
        onSortChange={setSort}
        stickyHeader
        stickyHeaderTop='var(--bus-thead-top, 74px)'
      />
    </PageContainer>
  )
}
