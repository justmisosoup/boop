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
  type DataTableColumnDef
} from '@/core'
import type { BusinessRecord } from '@/lib/deriveResults'
import { ALL, insightCountOf } from '@/lib/records'

import { MetaTagStatus } from '../components/MetaTagStatus'

/**
 * Column widths, from `app/src/containers/Businesses/BusinessList/columns.ts`.
 * Only the four columns the prototype has data for are here; the app's
 * `agent_runs` (158) and `assignee` (144) have nothing to show.
 */
const COLUMN_WIDTHS = {
  created: 148,
  status: 132,
  name: 232,
  insights: 304
}

/**
 * Column order is the app's: `created` leads at the far left, then status, the
 * name, and the insights. See the note on `BUSINESS_COLUMNS` in the app's
 * `columns.ts` — order there drives render order too.
 */
const columns: DataTableColumnDef<BusinessRecord>[] = [
  {
    id: 'created',
    header: 'Created',
    accessorFn: (row) => row.createdAt ?? '',
    // Keep the relative time on one line; the column is sized to fit it.
    cell: ({ row }) => (
      <DateTime className="whitespace-nowrap text-caption text-text-secondary">
        {row.original.createdAt ?? undefined}
      </DateTime>
    ),
    meta: { width: COLUMN_WIDTHS.created, grow: true }
  },
  {
    id: 'status',
    header: 'Status',
    accessorFn: (row) => row.status,
    cell: ({ row }) => <MetaTagStatus status={row.original.status} />,
    meta: { width: COLUMN_WIDTHS.status, grow: true }
  },
  {
    id: 'name',
    header: 'Business Name',
    accessorFn: (row) => row.name,
    // The name is the row's primary identifier, so it's bold. `TruncatedText`
    // shows the full name in a tooltip when it's actually clipped. No
    // `truncate` meta: it would cap the column at `max-w-64` and steal its
    // grow share; `TruncatedText` clips itself.
    cell: ({ row }) => (
      <TruncatedText style={{ fontWeight: 'var(--core-font-weight-bold)' }}>
        {row.original.name ?? ''}
      </TruncatedText>
    ),
    meta: { width: COLUMN_WIDTHS.name, grow: true }
  },
  {
    id: 'insights',
    header: 'Insights',
    accessorFn: (row) => insightCountOf(row),
    /**
     * How many insights the record reported.
     *
     * The app shows a Success / Warning / Failure triplet here (its `TaskList`),
     * read off `review.tasks[].status`. These records carry no per-task status,
     * and this prototype's insight grammar is deliberately two-state — a result
     * or no result, see `StateMark` — so there is no third count to show. One
     * number until there is.
     */
    cell: ({ row }) => {
      const count = insightCountOf(row.original)
      // Plain text, no chip — the app's `InsightStat` says why: the Insights
      // cell stays quiet so the Status chip beside it stays the loud thing in
      // the row. Zero takes the recede grey, as its counts do; and nothing
      // derived is not zero insights, it is a record the catalog had nothing to
      // say about, so it reads as a dash.
      if (!count) {
        return <span className="text-caption text-text-disabled">—</span>
      }
      return <span className="text-caption tabular-nums">{count}</span>
    },
    meta: { align: 'start', width: COLUMN_WIDTHS.insights, grow: true }
  }
]

/**
 * Every business the prototype has ingested.
 *
 * The 25 rows in `records.json` and nothing else — no placeholder rows, no
 * synthesised entries. A row opens the assessment that has been the whole
 * prototype until now.
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
      document.documentElement.style.setProperty(
        '--bus-thead-top',
        `${el.offsetHeight}px`
      )
    publish()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(publish)
    observer.observe(el)
    return () => {
      observer.disconnect()
      document.documentElement.style.removeProperty('--bus-thead-top')
    }
  }, [])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return ALL
    return ALL.filter((record) => record.name.toLowerCase().includes(q))
  }, [query])

  const onQueryChange = (value: string) => {
    setQuery(value)
    // Keep the URL honest, so a filtered list can be shared or reloaded.
    const next = new URLSearchParams(params)
    if (value.trim()) next.set('q', value)
    else next.delete('q')
    setParams(next, { replace: true })
  }

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
        <Toolbar className="flex-nowrap gap-3 rounded-t-[10px] border border-border bg-card px-3 py-1.5">
          <ToolbarSection className="min-w-0 flex-wrap">
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
              {rows.length === ALL.length
                ? `${ALL.length} businesses`
                : `${rows.length} of ${ALL.length}`}
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
        getRowId={(row) => row.id}
        rowIntent={{
          kind: 'detail',
          onOpen: (row) => navigate(`/businesses/${row.id}`)
        }}
        stickyHeader
        stickyHeaderTop='var(--bus-thead-top, 74px)'
      />
    </PageContainer>
  )
}
