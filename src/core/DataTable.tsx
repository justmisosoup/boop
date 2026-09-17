import React from 'react'

import {
  type ColumnDef,
  type Row,
  type SortDirection,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table'

import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  MoreHorizontal
} from 'lucide-react'

import { cn } from '@/utils/twUtils'

import { ActionButton, IconActionButton } from './Action'
import { Checkbox } from './ChoiceControl'
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger
} from './Menu'
import {
  EmptyState,
  ErrorState,
  LoadingRegion,
  Skeleton
} from './FeedbackState'
import { Tooltip } from './Tooltip'
import { useIsOverflowing } from './internal/useIsOverflowing'

export type DataTableSortState = {
  id: string
  direction: Extract<SortDirection, 'asc' | 'desc'>
} | null

export type DataTablePaginationState = {
  page: number
  perPage: number
  total?: number | null
}

export type DataTableDensity = 'compact' | 'standard' | 'comfortable'

export type DataTableRowIntent<TData> =
  | { kind: 'static' }
  | { kind: 'select'; onSelect: (row: TData) => void }
  | { kind: 'detail'; onOpen: (row: TData) => void }

export type DataTableRowAction<TData> = {
  id: string
  label: string
  disabled?: boolean | ((row: TData) => boolean)
  disabledReason?: string | ((row: TData) => string | undefined)
  destructive?: boolean
  onSelect: (row: TData) => void
}

export type DataTableColumnMeta = {
  align?: 'start' | 'center' | 'end'
  density?: DataTableDensity
  width?: 'auto' | 'content' | number
  minWidth?: number
  truncate?: boolean
  priority?: 'primary' | 'secondary' | 'tertiary'
  hideBelow?: 'sm' | 'md' | 'lg'
  /** Set false to omit the loading-skeleton bar for this column. Use for
   * icon-only / control columns (row actions, selection) that have no text to
   * stand in for — a bar there reads as phantom content. */
  skeleton?: boolean
  /**
   * Opt into even-fill: spare width is split into equal shares across all
   * `grow` columns. Requires a numeric `width` (the column's minimum); give the
   * non-grow columns numeric widths too, else they're squeezed to zero. See
   * `DataTableProps.fillWidth`.
   */
  grow?: boolean
}

export type DataTableColumnDef<TData, TValue = unknown> = ColumnDef<
  TData,
  TValue
> & {
  meta?: DataTableColumnMeta
}

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> extends DataTableColumnMeta {}
}

export type DataTableProps<TData> = {
  caption?: string
  className?: string
  columns: DataTableColumnDef<TData>[]
  /**
   * Row data. Pass `undefined` until the first load resolves — the table shows
   * a skeleton while it's undefined and only ever shows the empty state once a
   * defined array (even `[]`) has arrived. A defined `[]` means "loaded, empty".
   */
  data?: TData[]
  density?: DataTableDensity
  empty?: React.ReactNode
  error?: React.ReactNode
  getRowId?: (row: TData, index: number) => string
  /** A fetch is in flight. On a refetch (rows already present) it shows a top
   * progress bar; the initial-load skeleton is driven by `data` being undefined. */
  loading?: boolean
  /** Cap the scroll-body height (number = px). Enables vertical scrolling. */
  maxHeight?: number | string
  /**
   * Width (px) to distribute across `meta.grow` columns. Supply this in layouts
   * that can be widened by their own content (e.g. a horizontally-scrollable
   * page) so the fill can't feed back on itself; otherwise the table
   * self-measures. No effect unless a column sets `meta.grow`.
   */
  fillWidth?: number
  /** Skeleton row count for the initial load. Defaults to the page size (or 5). */
  skeletonRows?: number
  /** Override skeleton row height when real cells contain taller controls. */
  skeletonRowHeight?: number
  onPageChange?: (page: number) => void
  onSortChange?: (sort: DataTableSortState) => void
  /** Selection (checkbox column). Controlled by id; rows need a stable id. */
  onSelectedRowIdsChange?: (ids: string[]) => void
  pagination?: DataTablePaginationState
  rowIntent?: DataTableRowIntent<TData>
  selectable?: boolean
  selectedRowIds?: string[]
  sort?: DataTableSortState
  /**
   * Pin the header on scroll. With `maxHeight` set, the body scrolls inside the
   * table and the header pins to the table top (container scroll). Without
   * `maxHeight`, the header pins to the page viewport as the whole page scrolls
   * (page scroll) — use `stickyHeaderTop` to offset it below a sticky topbar.
   */
  stickyHeader?: boolean
  /** Offset (px or CSS length) for the page-scroll sticky header. Default 0. */
  stickyHeaderTop?: number | string
  /** Zebra-stripe alternate rows. */
  striped?: boolean
}

const resolveRowId = <TData,>(
  getRowId: DataTableProps<TData>['getRowId'] | undefined
) => {
  return (row: TData, index: number) => {
    if (getRowId) return getRowId(row, index)

    if (
      row &&
      typeof row === 'object' &&
      'id' in row &&
      typeof (row as { id?: unknown }).id === 'string'
    ) {
      return (row as { id: string }).id
    }

    throw new Error(
      'DataTable rows require getRowId unless each row has a string id field.'
    )
  }
}

const alignClass = (align: DataTableColumnMeta['align']) => {
  if (align === 'center') return 'text-center'
  if (align === 'end') return 'text-right'
  return 'text-left'
}

const HEADER_PAD: Record<DataTableDensity, string> = {
  compact: 'px-3 py-2',
  standard: 'px-4 py-2.5',
  comfortable: 'px-5 py-3'
}

const CELL_PAD: Record<DataTableDensity, string> = {
  compact: 'px-3 py-2',
  standard: 'px-4 py-3',
  comfortable: 'px-5 py-4'
}

const ROW_HEIGHT: Record<DataTableDensity, number> = {
  compact: 36,
  standard: 44,
  comfortable: 52
}

const widthStyle = (meta?: DataTableColumnMeta): React.CSSProperties => {
  if (!meta) return {}

  const style: React.CSSProperties = {}

  if (typeof meta.width === 'number') {
    style.width = meta.width
    // Pin max-width to the column width so a truncating column clips at its own
    // size, not the 16rem (`max-w-64`) fallback used when no width is given.
    if (meta.truncate) {
      style.maxWidth = meta.width
    }
  }

  if (meta.width === 'content') {
    style.width = '1%'
    style.whiteSpace = 'nowrap'
  }

  if (meta.minWidth) {
    style.minWidth = meta.minWidth
  }

  return style
}

// The id a column renders under, matching `cell.column.id` at runtime: an
// explicit `id`, else the `accessorKey` TanStack falls back to. Keys the
// even-fill widths so they line up with the rendered cells.
const columnKey = <TData,>(
  column: DataTableColumnDef<TData>
): string | undefined => {
  if (column.id != null) return column.id
  const accessorKey = (column as { accessorKey?: unknown }).accessorKey
  return typeof accessorKey === 'string' ? accessorKey : undefined
}

// A numeric width pins max-width in `widthStyle`, so the column truncates at its
// real size; without one, fall back to a 16rem cap so the ellipsis still works.
const truncateClass = (meta?: DataTableColumnMeta): string | false =>
  meta?.truncate
    ? typeof meta.width === 'number'
      ? 'truncate'
      : 'max-w-64 truncate'
    : false

// Surfaces a truncating cell's full value in a tooltip, but only when the text
// is actually clipped — decided from the rendered width (`scrollWidth >
// clientWidth`), not a character count. Wraps the cell's existing content, so
// custom cell renderers keep rendering exactly as they do today.
const TruncatingCell = ({
  remeasureKey,
  children
}: {
  remeasureKey: unknown
  children: React.ReactNode
}) => {
  const ref = React.useRef<HTMLSpanElement>(null)
  const isOverflowing = useIsOverflowing(ref, [remeasureKey])

  const content = (
    <span ref={ref} className='block max-w-full truncate'>
      {children}
    </span>
  )

  if (!isOverflowing) return content

  return (
    <Tooltip
      trigger={content}
      content={ref.current?.textContent}
      placement='top'
    />
  )
}

const nextSort = (
  columnId: string,
  current: DataTableSortState,
  sortDescFirst = false
): DataTableSortState => {
  const firstDirection = sortDescFirst ? 'desc' : 'asc'
  const secondDirection = sortDescFirst ? 'asc' : 'desc'

  if (!current || current.id !== columnId) {
    return { id: columnId, direction: firstDirection }
  }

  if (current.direction === firstDirection) {
    return { id: columnId, direction: secondDirection }
  }

  return null
}

const toTanStackSort = (sort: DataTableSortState) => {
  if (!sort) return []
  return [{ id: sort.id, desc: sort.direction === 'desc' }]
}

const pageCount = (pagination?: DataTablePaginationState) => {
  if (!pagination || typeof pagination.total !== 'number') return null
  return Math.max(1, Math.ceil(pagination.total / pagination.perPage))
}

export const createDataTableColumnHelper = createColumnHelper

export const DataTableEmptyState = ({
  children
}: {
  children?: React.ReactNode
}) => <EmptyState title='No records'>{children}</EmptyState>

export const DataTableLoadingState = () => (
  <LoadingRegion label='Loading records' className='min-h-28' />
)

export const DataTableErrorState = ({
  children
}: {
  children?: React.ReactNode
}) => <ErrorState title='Unable to load records'>{children}</ErrorState>

const getActionValue = <TData, TValue extends boolean | string | undefined>(
  value: TValue | ((row: TData) => TValue),
  row: TData
): TValue => {
  if (typeof value === 'function') {
    return (value as (row: TData) => TValue)(row)
  }

  return value
}

export const DataTableRowActions = <TData,>({
  actions,
  label = 'Row actions',
  row,
  themeMode,
  triggerClassName,
  visibleOnHover = true
}: {
  actions: DataTableRowAction<TData>[]
  label?: string
  row: TData
  themeMode?: 'light' | 'dark'
  triggerClassName?: string
  visibleOnHover?: boolean
}) => {
  if (actions.length === 0) return null

  return (
    <div
      className='flex items-center justify-end'
      onClick={event => event.stopPropagation()}
      onKeyDown={event => event.stopPropagation()}
    >
      <Menu>
        <MenuTrigger asChild>
          <IconActionButton
            aria-label={label}
            className={cn(
              // Contrasting hover so the button reads against an already-hovered
              // row (the quiet hover otherwise equals the row hover). `!` beats
              // the unlayered .core-action:hover rule.
              'hover:!bg-[var(--core-color-table-action-hover-bg)] data-[state=open]:!bg-[var(--core-color-table-action-hover-bg)]',
              visibleOnHover &&
                'opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100',
              triggerClassName
            )}
            variant='quiet'
          >
            <MoreHorizontal aria-hidden='true' />
          </IconActionButton>
        </MenuTrigger>
        <MenuContent align='end' themeMode={themeMode}>
          <MenuLabel>{label}</MenuLabel>
          <MenuSeparator />
          {actions.map(action => {
            const disabled = !!getActionValue(action.disabled, row)
            const disabledReason = getActionValue(action.disabledReason, row)

            return (
              <React.Fragment key={action.id}>
                <MenuItem
                  disabled={disabled}
                  tone={action.destructive ? 'destructive' : 'neutral'}
                  onSelect={() => {
                    if (!disabled) action.onSelect(row)
                  }}
                >
                  {action.label}
                </MenuItem>
                {disabled && disabledReason && (
                  <div className='px-2 pb-1 text-xs leading-5 text-muted-foreground'>
                    {disabledReason}
                  </div>
                )}
              </React.Fragment>
            )
          })}
        </MenuContent>
      </Menu>
    </div>
  )
}

const handleRowIntent = <TData,>(
  intent: DataTableRowIntent<TData> | undefined,
  row: Row<TData>
) => {
  if (!intent || intent.kind === 'static') return undefined

  return () => {
    if (intent.kind === 'select') intent.onSelect(row.original)
    if (intent.kind === 'detail') intent.onOpen(row.original)
  }
}

const isInteractiveEventTarget = (
  target: EventTarget | null,
  currentTarget: HTMLElement
) => {
  if (!(target instanceof HTMLElement)) return false

  const interactiveElement = target.closest(
    'a[href], button, input, textarea, select, [role="button"], [role="switch"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]'
  )

  return !!interactiveElement && interactiveElement !== currentTarget
}

// Some cells wrap content in a focusable element that has no click action of
// its own — most commonly a hover/focus tooltip trigger (see `HintTrigger`).
// It reads as "interactive" to the guard above, which would swallow the row
// click. Opt such an element out with `data-row-click-through` so a mouse click
// on it still opens the row, while the element stays keyboard-focusable for the
// tooltip. Scoped to click (not keydown) so Enter on the trigger keeps its own
// behaviour and never double-fires the row intent.
const isRowClickThroughTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement && !!target.closest('[data-row-click-through]')

// Stable empty array so coercing `data ?? []` never hands TanStack a fresh
// reference (and so the "not loaded yet" path doesn't churn).
const EMPTY_ROWS: never[] = []

// A thin indeterminate bar pinned to the top of the card while a refetch
// (a filter/sort/page change with rows already on screen) is in flight — the
// least-jarring "updating" affordance, so we never flash skeletons over data.
const DataTableProgressBar = () => (
  <div
    aria-hidden='true'
    className='pointer-events-none absolute inset-x-0 top-0 z-30 h-0.5 overflow-hidden bg-[var(--core-color-surface-subtle)]'
  >
    <div className='h-full w-1/3 animate-indeterminate rounded-pill bg-[var(--core-color-action-primary-bg)]' />
  </div>
)

// Body rows that mirror the real columns (count, widths, alignment, density) so
// the layout is identical and nothing shifts when real rows replace them. Varied
// widths read as content rather than a grid of identical bars; a short bar (8px,
// fully rounded) reads as a slim placeholder line rather than a chunky block.
const SKELETON_CELL_WIDTHS = ['72%', '54%', '84%', '60%', '76%', '48%']
const SKELETON_BAR_HEIGHT = 8

const DataTableSkeletonRows = <TData,>({
  columns,
  density,
  getColumnStyle,
  rowCount,
  rowHeight
}: {
  columns: DataTableColumnDef<TData>[]
  density: DataTableDensity
  getColumnStyle: (
    meta: DataTableColumnMeta | undefined,
    columnId: string
  ) => React.CSSProperties
  rowCount: number
  rowHeight: number
}) => (
  <tbody>
    {Array.from({ length: rowCount }).map((_, rowIndex) => (
      <tr key={rowIndex} className='last:[&>td]:border-b-0'>
        {columns.map((column, colIndex) => (
          <td
            key={column.id ?? colIndex}
            className={cn(
              'border-b border-[var(--core-color-table-divider)] align-middle',
              CELL_PAD[density],
              alignClass(column.meta?.align)
            )}
            style={{
              // Key via `columnKey` so accessor columns line up with the grown
              // widths (their raw def has no `id`).
              ...getColumnStyle(
                column.meta,
                columnKey(column) ?? String(colIndex)
              ),
              height: rowHeight
            }}
          >
            {/* Icon-only / control columns opt out (meta.skeleton === false) —
                an empty cell matches their resting state (e.g. a hover-reveal
                action icon) better than a phantom bar. */}
            {column.meta?.skeleton !== false && (
              <Skeleton
                style={{
                  borderRadius: SKELETON_BAR_HEIGHT / 2,
                  height: SKELETON_BAR_HEIGHT,
                  width:
                    SKELETON_CELL_WIDTHS[colIndex % SKELETON_CELL_WIDTHS.length]
                }}
              />
            )}
          </td>
        ))}
      </tr>
    ))}
  </tbody>
)

export const DataTable = <TData,>({
  caption,
  className,
  columns,
  data,
  density = 'standard',
  empty,
  error,
  fillWidth,
  getRowId,
  loading = false,
  maxHeight,
  onPageChange,
  onSortChange,
  onSelectedRowIdsChange,
  pagination,
  rowIntent = { kind: 'static' },
  selectable = false,
  selectedRowIds,
  skeletonRowHeight,
  skeletonRows,
  sort = null,
  stickyHeader = false,
  stickyHeaderTop = 0,
  striped = false
}: DataTableProps<TData>) => {
  // Two sticky modes: container-scroll (bounded body via maxHeight, header pins
  // to the table) and page-scroll (header pins to the viewport as the page
  // scrolls). Page sticky needs no clipping ancestor, so the card drops
  // overflow-hidden and the horizontal-scroll wrapper.
  const containerScroll = maxHeight != null
  const pageSticky = stickyHeader && !containerScroll

  const rowSelection = React.useMemo(
    () =>
      Object.fromEntries(
        (selectedRowIds ?? []).map(id => [id, true])
      ) as Record<string, boolean>,
    [selectedRowIds]
  )

  const selectionColumn = React.useMemo<DataTableColumnDef<TData>>(
    () => ({
      id: '__select__',
      enableSorting: false,
      meta: { align: 'center', width: 44, skeleton: false },
      // Wrap in a flex box so the checkbox centers on the cell middle. As a bare
      // inline-flex label it aligns to the text baseline and rides ~2px high.
      header: ({ table }) => (
        <div className='flex items-center justify-center'>
          <Checkbox
            aria-label='Select all rows'
            checked={table.getIsAllRowsSelected()}
            indeterminate={
              table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected()
            }
            onCheckedChange={value => table.toggleAllRowsSelected(!!value)}
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className='flex items-center justify-center'>
          <Checkbox
            aria-label='Select row'
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onCheckedChange={value => row.toggleSelected(!!value)}
          />
        </div>
      )
    }),
    []
  )

  const tableColumns = React.useMemo(
    () => (selectable ? [selectionColumn, ...columns] : columns),
    [selectable, selectionColumn, columns]
  )

  // Even-fill: split the table's spare width into equal shares across the
  // `meta.grow` columns, using a caller-supplied `fillWidth` or self-measuring
  // the card when omitted.
  const hasGrowColumns = React.useMemo(
    () => tableColumns.some(column => column.meta?.grow),
    [tableColumns]
  )
  const sectionRef = React.useRef<HTMLElement>(null)
  const [measuredWidth, setMeasuredWidth] = React.useState(0)
  React.useLayoutEffect(() => {
    if (!hasGrowColumns || fillWidth != null) return
    const node = sectionRef.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const measure = () => setMeasuredWidth(node.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasGrowColumns, fillWidth])

  const effectiveWidths = React.useMemo(() => {
    const widths = new Map<string, number>()
    const fill = fillWidth ?? measuredWidth
    if (!hasGrowColumns || !fill) return widths
    const growColumns = tableColumns.filter(
      column => column.meta?.grow && columnKey(column) != null
    )
    if (growColumns.length === 0) return widths
    const naturalSum = tableColumns.reduce(
      (sum, column) =>
        sum + (typeof column.meta?.width === 'number' ? column.meta.width : 0),
      0
    )
    const spare = Math.max(0, fill - naturalSum)
    const share = Math.floor(spare / growColumns.length)
    const remainder = spare - share * growColumns.length
    growColumns.forEach((column, index) => {
      const base =
        typeof column.meta?.width === 'number' ? column.meta.width : 0
      // The sub-pixel remainder goes to the first grow column so the widths sum
      // to the fill width exactly.
      widths.set(
        columnKey(column) as string,
        base + share + (index === 0 ? remainder : 0)
      )
    })
    return widths
  }, [fillWidth, measuredWidth, hasGrowColumns, tableColumns])

  // Per-column inline style: the even-fill width when the column grows,
  // else the declared width.
  const columnStyle = React.useCallback(
    (
      meta: DataTableColumnMeta | undefined,
      columnId: string
    ): React.CSSProperties => {
      const grown = effectiveWidths.get(columnId)
      if (grown == null) return widthStyle(meta)
      // A truncating column has its max-width pinned to its base width by
      // `widthStyle` (the #5831 truncate fix); when it grows, clip at the GROWN
      // width instead so the ellipsis tracks the column's real size.
      return {
        ...widthStyle(meta),
        width: grown,
        ...(meta?.truncate ? { maxWidth: grown } : {})
      }
    },
    [effectiveWidths]
  )

  // Stabilize the derived TanStack inputs. `resolveRowId` and `toTanStackSort`
  // each return a brand-new function/array per call, and TanStack treats new
  // option identities as "something changed" — so deriving them inline made the
  // table recompute on every render.
  const rowIdFn = React.useMemo(() => resolveRowId(getRowId), [getRowId])
  const sorting = React.useMemo(() => toTanStackSort(sort), [sort])
  const tableState = React.useMemo(
    () => ({ rowSelection, sorting }),
    [rowSelection, sorting]
  )

  // Coerce the "not loaded yet" (undefined) data to a stable empty array for the
  // table instance; the undefined-ness itself drives the skeleton (see below).
  const safeData = data ?? EMPTY_ROWS

  const table = useReactTable({
    columns: tableColumns,
    data: safeData,
    enableRowSelection: selectable,
    enableSorting: !!onSortChange,
    // This table paginates manually (the caller slices its own page), so
    // TanStack holds no pagination/expansion state of its own. Its default
    // `autoReset*` behavior still fires an internal state update whenever the
    // `data` reference changes — and a caller passing a freshly-derived array
    // each render (the natural, common pattern) then spins:
    // new data ref → auto-reset dispatch → re-render → new data ref → …, which
    // pegs the main thread in production builds (React's prod scheduler doesn't
    // absorb it the way dev does). Disabling the auto-resets makes the primitive
    // resilient to unstable `data`/`getRowId` props so consumers can't trip an
    // infinite render loop just by inlining them.
    autoResetPageIndex: false,
    autoResetExpanded: false,
    getCoreRowModel: getCoreRowModel(),
    getRowId: rowIdFn,
    getSortedRowModel: getSortedRowModel(),
    manualSorting: !!onSortChange,
    onRowSelectionChange: updater => {
      if (!onSelectedRowIdsChange) return
      const next =
        typeof updater === 'function' ? updater(rowSelection) : updater
      onSelectedRowIdsChange(Object.keys(next).filter(id => next[id]))
    },
    state: tableState
  })

  const pages = pageCount(pagination)

  // Latches once a defined `data` array arrives (even `[]`). Until then we're in
  // the initial-load window and must NEVER show the empty state — gating empty
  // behind this is what kills the "flash of No records" before the first load.
  const hasLoadedRef = React.useRef(false)
  if (data != null) hasLoadedRef.current = true
  const hasLoadedOnce = hasLoadedRef.current

  // Initial load → paint the skeleton immediately, so the card border and the
  // skeleton rows appear together (no empty-card beat before the skeleton shows).
  // Refetch (rows already present) → keep the rows and float a top progress bar;
  // never swap data for skeletons. The brief anti-flash gate for navigation now
  // lives at the page/route boundary (the route skeleton), so we don't double-gate.
  const showLoadingRegion = !hasLoadedOnce
  const isRefetching = loading && hasLoadedOnce && safeData.length > 0
  const skeletonRowCount =
    skeletonRows ?? Math.min(pagination?.perPage ?? 5, 12)
  const resolvedSkeletonRowHeight = skeletonRowHeight ?? ROW_HEIGHT[density]

  const tableCaption = caption ? (
    <caption className='sr-only'>{caption}</caption>
  ) : null

  // The real header, lifted out so the skeleton renders the SAME thead (and the
  // same column widths) — so nothing shifts when real rows replace the skeleton.
  const tableHead = (
    <thead
      className={cn(
        'bg-[var(--core-color-table-header-bg)] text-[var(--core-color-table-header-text)]',
        containerScroll && 'sticky top-0 z-10',
        pageSticky && 'sticky z-20'
      )}
      style={pageSticky ? { top: stickyHeaderTop } : undefined}
    >
      {table.getHeaderGroups().map(headerGroup => (
        <tr key={headerGroup.id}>
          {headerGroup.headers.map(header => {
            // Manual sorting: the consumer sorts the data, so a column is
            // sortable whenever `onSortChange` is wired and it hasn't opted out
            // — independent of whether it has an accessor, so display columns
            // (id + cell) can sort too.
            const canSort =
              !!onSortChange && header.column.columnDef.enableSorting !== false
            const sorted =
              sort?.id === header.column.id ? sort.direction : undefined

            return (
              <th
                key={header.id}
                aria-sort={
                  sorted === 'asc'
                    ? 'ascending'
                    : sorted === 'desc'
                      ? 'descending'
                      : undefined
                }
                className={cn(
                  'border-b border-[var(--core-color-table-border)] align-middle text-xs font-medium',
                  HEADER_PAD[density],
                  alignClass(header.column.columnDef.meta?.align),
                  truncateClass(header.column.columnDef.meta)
                )}
                style={columnStyle(
                  header.column.columnDef.meta,
                  header.column.id
                )}
              >
                {canSort ? (
                  <button
                    type='button'
                    className='inline-flex items-center gap-1 rounded-md text-left font-medium text-inherit focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--core-color-focus-ring)]'
                    onClick={() =>
                      onSortChange?.(
                        nextSort(
                          header.column.id,
                          sort,
                          header.column.columnDef.sortDescFirst
                        )
                      )
                    }
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                    {sorted === 'asc' ? (
                      <ChevronUp aria-hidden='true' className='size-3.5' />
                    ) : sorted === 'desc' ? (
                      <ChevronDown aria-hidden='true' className='size-3.5' />
                    ) : (
                      <ChevronsUpDown
                        aria-hidden='true'
                        className='size-3.5 opacity-40'
                      />
                    )}
                  </button>
                ) : (
                  flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  )
                )}
              </th>
            )
          })}
        </tr>
      ))}
    </thead>
  )

  return (
    <section
      ref={sectionRef}
      aria-busy={showLoadingRegion || isRefetching ? true : undefined}
      className={cn(
        'relative rounded-[var(--core-radius-card)] border border-[var(--core-color-table-border)] bg-[var(--core-color-surface-card)] shadow-elevation-card',
        // overflow-clip keeps rounded corners (top + bottom) while NOT becoming a
        // scroll container, so the page-sticky header still pins to the viewport.
        // The header is rounded at rest (it sits at the card's rounded top) and
        // naturally squares when stuck (pinned mid-card, away from the corner).
        pageSticky ? 'overflow-clip' : 'overflow-hidden',
        className
      )}
    >
      {/* Polite live region so assistive tech hears the load settle. */}
      <span aria-live='polite' className='sr-only' role='status'>
        {showLoadingRegion
          ? 'Loading records'
          : `${safeData.length} record${safeData.length === 1 ? '' : 's'} loaded`}
      </span>
      {isRefetching && <DataTableProgressBar />}
      {error ? (
        <div className='p-4'>{error}</div>
      ) : showLoadingRegion ? (
        <div
          aria-hidden='true'
          className={cn(
            containerScroll && 'overflow-auto',
            !containerScroll && !pageSticky && 'overflow-x-auto'
          )}
          style={containerScroll ? { maxHeight } : undefined}
        >
          <table
            className='w-full border-separate border-spacing-0 text-sm text-[var(--core-color-table-cell-text)]'
            // `fixed` makes the browser honor the even-fill widths instead of
            // auto-sizing columns to content.
            style={hasGrowColumns ? { tableLayout: 'fixed' } : undefined}
          >
            {tableCaption}
            {tableHead}
            <DataTableSkeletonRows
              columns={tableColumns}
              density={density}
              getColumnStyle={columnStyle}
              rowCount={skeletonRowCount}
              rowHeight={resolvedSkeletonRowHeight}
            />
          </table>
        </div>
      ) : safeData.length === 0 ? (
        <div className='p-4'>{empty ?? <DataTableEmptyState />}</div>
      ) : (
        <div
          className={cn(
            containerScroll && 'overflow-auto',
            !containerScroll && !pageSticky && 'overflow-x-auto'
            // page-sticky: no overflow wrapper so the header can pin to the page
          )}
          style={containerScroll ? { maxHeight } : undefined}
        >
          <table
            className='w-full border-separate border-spacing-0 text-sm text-[var(--core-color-table-cell-text)]'
            // `fixed` makes the browser honor the even-fill widths instead of
            // auto-sizing columns to content.
            style={hasGrowColumns ? { tableLayout: 'fixed' } : undefined}
          >
            {tableCaption}
            {tableHead}
            <tbody>
              {table.getRowModel().rows.map(row => {
                const onClick = handleRowIntent(rowIntent, row)
                const onKeyDown = onClick
                  ? (event: React.KeyboardEvent<HTMLTableRowElement>) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return
                      if (
                        isInteractiveEventTarget(
                          event.target,
                          event.currentTarget
                        )
                      )
                        return

                      event.preventDefault()
                      onClick()
                    }
                  : undefined
                const onRowClick = onClick
                  ? (event: React.MouseEvent<HTMLTableRowElement>) => {
                      if (
                        isInteractiveEventTarget(
                          event.target,
                          event.currentTarget
                        ) &&
                        !isRowClickThroughTarget(event.target)
                      )
                        return
                      onClick()
                    }
                  : undefined
                const selected = row.getIsSelected()
                const zebra = striped && row.index % 2 === 1

                return (
                  <tr
                    key={row.id}
                    aria-selected={selectable ? selected : undefined}
                    className={cn(
                      'group last:[&>td]:border-b-0',
                      selected
                        ? 'bg-[var(--core-color-table-row-selected-bg)]'
                        : zebra
                          ? 'bg-[var(--core-color-table-row-stripe-bg)]'
                          : 'bg-[var(--core-color-table-row-bg)]',
                      // Keyboard focus (not mouse-click focus) tints the row:
                      // `focus-visible` for the row itself and
                      // `has-[:focus-visible]` for a focused child (e.g. the row
                      // actions button). Using these instead of
                      // `focus`/`focus-within` stops a row from staying
                      // highlighted after a click-driven flow restores focus to
                      // it — e.g. after closing a detail drawer.
                      !selected &&
                        'hover:bg-[var(--core-color-table-row-hover-bg)] has-[:focus-visible]:bg-[var(--core-color-table-row-hover-bg)]',
                      onClick &&
                        'cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--core-color-focus-ring)]',
                      onClick &&
                        !selected &&
                        'focus-visible:bg-[var(--core-color-table-row-hover-bg)]'
                    )}
                    role={onClick ? 'button' : undefined}
                    tabIndex={onClick ? 0 : undefined}
                    onClick={onRowClick}
                    onKeyDown={onKeyDown}
                  >
                    {row.getVisibleCells().map(cell => (
                      <td
                        key={cell.id}
                        className={cn(
                          'border-b border-[var(--core-color-table-divider)] align-middle',
                          CELL_PAD[density],
                          alignClass(cell.column.columnDef.meta?.align),
                          truncateClass(cell.column.columnDef.meta)
                        )}
                        style={columnStyle(
                          cell.column.columnDef.meta,
                          cell.column.id
                        )}
                      >
                        {cell.column.columnDef.meta?.truncate ? (
                          <TruncatingCell remeasureKey={cell.getValue()}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TruncatingCell>
                        ) : (
                          flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )
                        )}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {pagination && pages && pages > 1 && (
        <div className='flex items-center justify-between border-t border-[var(--core-color-table-border)] bg-[var(--core-color-surface-card)] px-4 py-3 text-sm text-muted-foreground'>
          <span>
            Page {pagination.page} of {pages}
          </span>
          {onPageChange && (
            <div className='flex items-center gap-2'>
              <ActionButton
                disabled={pagination.page <= 1}
                variant='secondary'
                onClick={() => onPageChange(pagination.page - 1)}
              >
                Previous
              </ActionButton>
              <ActionButton
                disabled={pagination.page >= pages}
                variant='secondary'
                onClick={() => onPageChange(pagination.page + 1)}
              >
                Next
              </ActionButton>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

DataTable.displayName = 'DataTable'
