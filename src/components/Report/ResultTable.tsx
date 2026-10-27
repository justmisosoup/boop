import { Fragment, useState, type ReactNode } from 'react'
import * as RadixTooltip from '@radix-ui/react-tooltip'
import { Check, ChevronDown } from 'lucide-react'

import { ActionButton, MetaChip, SegmentedControl, SegmentedControlItem } from '@/core'

import { cn } from '../../utils/twUtils'

const COLUMNS = 'md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]'
const RULE =
  'bg-[image:var(--dash-rule-x)] bg-[length:100%_1px] bg-[position:left_bottom] bg-no-repeat last:bg-none'

/** One result: what it is over its name, its source under, its status beside;
 *  its full record opening under the row. */
export type ResultRow = {
  key: string
  /** Over the name: what the result is — the list it matched, the lien's kind. */
  caption?: ReactNode
  title: ReactNode
  /** Under the name: where the record holds it — its source chip. */
  sub?: ReactNode
  /** Beside it: its status, its score. */
  chips?: ReactNode
  /** Dismissed, or closed: listed after the standing ones, as they are. */
  cleared: boolean
  /** The record in full, under the row when it is opened. */
  detail: ReactNode
}

const ColumnLabel = ({ children }: { children: ReactNode }) => (
  <span className="text-xs font-medium text-[var(--core-color-table-header-text)]">
    {children}
  </span>
)

/**
 * A screen's or a public record's results, as the Addresses card reads its
 * places: a row per match — what it is over its name, its source under, its
 * status beside — each opening to its record. The standing first, then the
 * dismissed or closed, every one shown. With no match at all, "None found" in
 * their place. The names searched that came back with nothing fold under it
 * all — "Show 22 clear names" — a row each.
 */
/** Which results a table shows, from its card's header: all, the standing
 *  (open, hits), the cleared (closed, dismissed), or the names searched that
 *  came back with nothing (clear). */
export type StatusFilter = 'all' | 'standing' | 'cleared' | 'clear'

export const statusCounts = (rows: Array<{ cleared: boolean }>, clear = 0): Record<StatusFilter, number> => ({
  all: rows.length + clear,
  standing: rows.filter((r) => !r.cleared).length,
  cleared: rows.filter((r) => r.cleared).length,
  clear
})

/** A results card's header control: All, then the standing and the cleared in
 *  the card's own words — Open and Closed, Hits and Dismissed — each counted. */
export const StatusControl = ({
  counts,
  labels,
  value,
  onChange
}: {
  counts: Record<StatusFilter, number>
  labels: { standing: string; cleared: string }
  value: StatusFilter
  onChange: (next: StatusFilter) => void
}) => (
  <SegmentedControl size="sm" aria-label="Filter results" value={value} onValueChange={(v) => v && onChange(v as StatusFilter)}>
    {(
      [
        ['all', 'All'],
        ['standing', labels.standing],
        ['cleared', labels.cleared],
        ['clear', 'Clear']
      ] as const
    )
      // Only what there are results for; All always.
      .filter(([v]) => v === 'all' || counts[v] > 0)
      .map(([v, label]) => (
      <SegmentedControlItem key={v} value={v}>
        {label}
        <span className="ml-1 tabular-nums text-text-secondary">{counts[v]}</span>
      </SegmentedControlItem>
    ))}
  </SegmentedControl>
)

/** Whose: everything, what the customer submitted, or what the records found besides. */
export type Provenance = 'all' | 'submitted' | 'found'

const PROVENANCE_WORD: Record<Provenance, string> = { all: 'All', submitted: 'Submitted', found: 'Found' }

/**
 * The Names and People cards' filter: All, Submitted and Found (former names
 * among the found) — each counted, as the other cards count theirs. One with none is still shown, disabled: the card
 * says it found nothing as plainly as it says what it found.
 */
export const ProvenanceControl = ({
  counts,
  value,
  onChange,
  label
}: {
  counts: Record<'submitted' | 'found', number>
  value: Provenance
  onChange: (next: Provenance) => void
  /** What is being filtered, for assistive tech: "names", "people". */
  label: string
}) => (
  <SegmentedControl size="sm" aria-label={`Filter ${label}`} value={value} onValueChange={(v) => v && onChange(v as Provenance)}>
    {(['all', 'submitted', 'found'] as const)
      .map((v) => (
        <SegmentedControlItem disabled={v !== 'all' && !counts[v]} key={v} value={v}>
          {PROVENANCE_WORD[v]}
          <span className="ml-1 tabular-nums text-text-secondary">
            {v === 'all' ? counts.submitted + counts.found : counts[v]}
          </span>
        </SegmentedControlItem>
      ))}
  </SegmentedControl>
)

/** All, as every card's filter opens on. */
export const defaultProvenance = (): Provenance => 'all'

export const ResultTable = ({
  columns,
  rows: allRows,
  status,
  none,
  clean = [],
  cleanCaption,
  footnote,
  foldCleared: foldClearedProp,
  noneTitle = 'None found',
  top
}: {
  /** The first few rows only; the rest fold under "Show N more". */
  top?: number
  /** The header's filter: with it, the cleared no longer fold — it says which show. */
  status?: StatusFilter
  columns: [string, string]
  rows: ResultRow[]
  /** What the search came to, in a line: "Screened 24 names · 2 matches dismissed". */
  none?: ReactNode
  /** The names searched that came back with nothing: a row each, "No results". */
  clean?: string[]
  /** Over a clear name, who it is to the business: "Manager", "Registered agent". */
  cleanCaption?: (name: string) => ReactNode
  /** After it: the searches that found none of their kind. */
  footnote?: ReactNode
  /** Fold the cleared away, as what they are — "closed lien(s)" — with
   *  `none` saying so where nothing stands: "No open liens". */
  foldCleared?: { one: string; many: string; none: string }
  /** What the card says with nothing found: "No results for tax liens or UCC liens". */
  noneTitle?: string
}) => {
  const rows =
    status === 'standing'
      ? allRows.filter((r) => !r.cleared)
      : status === 'cleared'
        ? allRows.filter((r) => r.cleared)
        : status === 'clear'
          ? []
          : allRows
  // Filtered from the card's header, the cleared show or don't by the filter, not a fold.
  const foldCleared = status ? undefined : foldClearedProp
  const [open, setOpen] = useState<string | null>(null)
  const [showCleared, setShowCleared] = useState(false)
  const [showClosed, setShowClosed] = useState(false)
  const standing = rows.filter((r) => !r.cleared)
  const cleared = rows.filter((r) => r.cleared)
  const [showAll, setShowAll] = useState(false)
  const listed = [...standing, ...(!foldCleared || showClosed ? cleared : [])]
  // Filtered from the header, the clear names are rows of the table — under
  // All after the results, or alone under Clear — not a fold of their own.
  // With no results at all, the card says so — "No results for …", what was
  // searched — and lists the names searched under it, the first few.
  const cleanListed = status === 'all' || status === 'clear' ? clean : []
  const budget = top && !showAll ? top : Infinity
  const shown = listed.slice(0, budget)
  const cleanShown = cleanListed.slice(0, Math.max(0, budget - shown.length))
  const hidden = listed.length + cleanListed.length - shown.length - cleanShown.length
  // The rows past the first few, folded: "Show 4 more".
  const moreButton =
    top && (hidden > 0 || showAll) && listed.length + cleanListed.length > top ? (
      <div className="flex justify-start border-t border-[var(--core-color-border-divider)] px-2 py-2">
        <ActionButton variant="quiet" size="compact" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Show less' : `Show ${hidden} more`}
        </ActionButton>
      </div>
    ) : null
  // What was searched, in a line: "Screened 24 names · 2 matches dismissed".
  const searchedLine = (
    <>
      {none && <span className="mt-0.5 block text-caption text-text-secondary">{none}</span>}
      {footnote && <span className="mt-0.5 block text-caption text-text-secondary">{footnote}</span>}
    </>
  )
  const noneFound = (
    <div className="px-4 py-3">
      <span className="block text-sm text-text-primary">
        {foldCleared && cleared.length > 0 ? foldCleared.none : noneTitle}
      </span>
      {searchedLine}
    </div>
  )
  // A name that came back with nothing, as a row of the table.
  const cleanRow = (name: string, i: number) => (
    <div key={`${name}-${i}`} className={cn('grid grid-cols-1 items-start gap-x-4 gap-y-2 px-4 py-3', COLUMNS, RULE)}>
      <span className="min-w-0">
        {cleanCaption && <span className="block text-caption text-text-secondary">{cleanCaption(name)}</span>}
        <span className="block text-sm font-medium text-text-primary">{name}</span>
      </span>
      <span className="flex flex-wrap items-center gap-1.5">
        <MetaChip tone="neutral" size="compact">
          <Check aria-hidden="true" size={12} strokeWidth={2} className="shrink-0" />
          No results
        </MetaChip>
      </span>
    </div>
  )
  const cleanRows = clean.map((name, i) => (
    <div key={`${name}-${i}`} className={cn('grid grid-cols-1 items-start gap-x-4 gap-y-2 px-4 py-3', COLUMNS, RULE)}>
      <span className="min-w-0 text-sm font-medium text-text-primary">{name}</span>
      <span className="flex flex-wrap items-center gap-1.5">
        <MetaChip tone="neutral" size="compact">
          <Check aria-hidden="true" size={12} strokeWidth={2} className="shrink-0" />
          No results
        </MetaChip>
      </span>
    </div>
  ))
  const foldButton = (label: string) => (
    <div className="flex justify-start border-t border-[var(--core-color-border-divider)] px-2 py-2">
      <ActionButton variant="quiet" size="compact" onClick={() => setShowCleared(!showCleared)}>
        {label}
      </ActionButton>
    </div>
  )

  const header = (
    <div
      className={cn(
        'hidden gap-x-4 border-b border-[var(--core-color-border-divider)] px-4 py-1.5 md:grid',
        COLUMNS
      )}
    >
      <ColumnLabel>{columns[0]}</ColumnLabel>
      <ColumnLabel>{columns[1]}</ColumnLabel>
    </div>
  )
  const table = (
    <>
      {shown.map((r) => {
        const on = open === r.key
        return (
          <Fragment key={r.key}>
            {/* The whole row opens it; the chevron is the button keyboards reach.
                A source chip inside keeps its own click. Not a <button>: the
                chip is one, and buttons do not nest. */}
            <div
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('button, a') !== null) return
                setOpen(on ? null : r.key)
              }}
              className={cn(
                'grid w-full cursor-pointer grid-cols-1 items-start gap-x-4 gap-y-2 px-4 py-3 text-left transition-colors hover:bg-[var(--core-color-state-hover-bg)]',
                COLUMNS,
                RULE,
                on && 'bg-[var(--core-color-surface-subtle)]',
                // The first cleared row starts their run: a solid rule over it.
                r.cleared && r === cleared[0] && standing.length > 0 && 'border-t border-[var(--core-color-border-divider)]'
              )}
            >
              <span className="min-w-0">
                {r.caption && <span className="block text-caption text-text-secondary">{r.caption}</span>}
                <span className="block text-sm font-medium text-text-primary">{r.title}</span>
                {r.sub && (
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-caption text-text-secondary">
                    {r.sub}
                  </span>
                )}
              </span>
              {/* Nothing beside it but the chevron — the Documents rows — it
                  centres on the row. */}
              <span className={cn('flex flex-wrap items-center gap-1.5', !r.chips && 'md:self-center')}>
                {r.chips}
                <button
                  type="button"
                  aria-expanded={on}
                  aria-label={on ? 'Hide details' : 'Show details'}
                  onClick={() => setOpen(on ? null : r.key)}
                  className="ml-auto flex shrink-0 rounded-control text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ChevronDown
                    aria-hidden="true"
                    size={16}
                    strokeWidth={1.75}
                    className={cn(
                      'transition-transform duration-fast motion-reduce:transition-none',
                      on && 'rotate-180'
                    )}
                  />
                </button>
              </span>
            </div>
            {on && <div className="border-t border-[var(--core-color-border-divider)]">{r.detail}</div>}
          </Fragment>
        )
      })}
    </>
  )

  return (
    <RadixTooltip.Provider>
      <div className="border-t border-[var(--core-color-border-divider)]">
        {/* Every match, as it stands: the hits, then the dismissed. With none
            at all, the answer in their place. */}
        {status ? (
          // Filtered from the header: the results, then the clear names, as one
          // table. Nothing found under All still says so, over the clear names.
          <>
            {shown.length === 0 && status !== 'clear' && noneFound}
            {(shown.length > 0 || cleanShown.length > 0) && (
              <div className={cn(shown.length === 0 && status !== 'clear' && 'border-t border-[var(--core-color-border-divider)]')}>
                {header}
                {table}
                {cleanShown.map(cleanRow)}
              </div>
            )}
          </>
        ) : shown.length > 0 ? (
          <>
            {foldCleared && standing.length === 0 && noneFound}
            <div className={cn(foldCleared && standing.length === 0 && 'border-t border-[var(--core-color-border-divider)]')}>
              {header}
              {table}
            </div>
          </>
        ) : (
          noneFound
        )}
        {moreButton}
        {/* The closed, folded under the open: "Show 12 closed liens". */}
        {foldCleared && cleared.length > 0 && (
          <div className="flex justify-start border-t border-[var(--core-color-border-divider)] px-2 py-2">
            <ActionButton variant="quiet" size="compact" onClick={() => setShowClosed(!showClosed)}>
              {showClosed
                ? `Hide ${foldCleared.many}`
                : `Show ${cleared.length} ${cleared.length === 1 ? foldCleared.one : foldCleared.many}`}
            </ActionButton>
          </div>
        )}
        {/* The names that came back with nothing, folded under the matches. */}
        {!status && showCleared && clean.length > 0 && (
          <div className="border-t border-[var(--core-color-border-divider)]">{cleanRows}</div>
        )}
        {!status && clean.length > 0 &&
          foldButton(
            showCleared
              ? 'Hide clear names'
              : `Show ${clean.length} clear ${clean.length === 1 ? 'name' : 'names'}`
          )}
      </div>
    </RadixTooltip.Provider>
  )
}

/**
 * The same results as cells, two to a row, as the Registrations grid lays its
 * filings: what it is over its name, its status under. A lone last cell takes
 * the whole row; a picked cell's record opens under its row. With none, "None
 * found".
 */
export const ResultGrid = ({
  rows: all,
  none,
  noneTitle = 'None found',
  top
}: {
  /** The first few cells only; the rest fold under "Show N more". */
  top?: number
  rows: ResultRow[]
  none?: ReactNode
  noneTitle?: string
}) => {
  const [open, setOpen] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const rows = top && !showAll ? all.slice(0, top) : all
  if (rows.length === 0)
    return (
      <div className="border-t border-[var(--core-color-border-divider)] px-4 py-3">
        <span className="block text-sm text-text-primary">{noneTitle}</span>
        {none && <span className="mt-0.5 block text-caption text-text-secondary">{none}</span>}
      </div>
    )
  const pairs = rows.reduce<ResultRow[][]>(
    (out, r, i) => (i % 2 === 0 ? [...out, [r]] : [...out.slice(0, -1), [...out[out.length - 1], r]]),
    []
  )
  return (
    <RadixTooltip.Provider>
    <div className="grid grid-cols-1 md:grid-cols-2">
      {pairs.map((pair) => (
        <Fragment key={pair[0].key}>
          {pair.map((r, i) => {
            const on = open === r.key
            return (
              <div
                key={r.key}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('button, a') !== null) return
                  setOpen(on ? null : r.key)
                }}
                className={cn(
                  'grid cursor-pointer gap-1 border-t border-[var(--core-color-border-divider)] px-4 py-3 text-left transition-colors hover:bg-[var(--core-color-state-hover-bg)]',
                  i === 1 && 'md:border-l',
                  pair.length === 1 && 'md:col-span-2',
                  on && 'bg-[var(--core-color-surface-subtle)]'
                )}
              >
                {r.caption && <span className="text-caption text-text-secondary">{r.caption}</span>}
                <span className="flex min-w-0 items-start justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-medium text-text-primary">{r.title}</span>
                  <button
                    type="button"
                    aria-expanded={on}
                    aria-label={on ? 'Hide details' : 'Show details'}
                    onClick={() => setOpen(on ? null : r.key)}
                    className="flex shrink-0 rounded-control text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ChevronDown
                      aria-hidden="true"
                      size={16}
                      strokeWidth={1.75}
                      className={cn('transition-transform duration-fast motion-reduce:transition-none', on && 'rotate-180')}
                    />
                  </button>
                </span>
                {r.sub && <span className="flex flex-wrap items-center gap-1.5 text-caption text-text-secondary">{r.sub}</span>}
                {r.chips && <span className="flex flex-wrap items-center gap-1.5">{r.chips}</span>}
              </div>
            )
          })}
          {/* The picked cell's record, under its row. */}
          {pair.map(
            (r) =>
              open === r.key && (
                <div key={`${r.key}-detail`} className="border-t border-[var(--core-color-border-divider)] md:col-span-2">
                  {r.detail}
                </div>
              )
          )}
        </Fragment>
      ))}
    </div>
    {top && all.length > top && (
      <div className="flex justify-start border-t border-[var(--core-color-border-divider)] px-2 py-2">
        <ActionButton variant="quiet" size="compact" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Show less' : `Show ${all.length - top} more`}
        </ActionButton>
      </div>
    )}
    </RadixTooltip.Provider>
  )
}
