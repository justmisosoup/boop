import { useMemo } from 'react'

import { ChevronDown } from 'lucide-react'

import {
  ActionButton,
  FacetFilter,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  SegmentedControl,
  SegmentedControlItem,
  Toolbar,
  ToolbarButton,
  ToolbarCount,
  ToolbarSpacer
} from '@/core'

import dayjs from '../../lib/dayjs'
import { COVERAGE_START_YEAR, KIND_LABEL, KIND_ORDER } from '../../lib/timeline/constants'
import {
  EMPTY_FILTERS,
  isFilterActive,
  type Show,
  type TimelineFilters
} from '../../lib/timeline/filters'
import type { FilingUpdate, Kind } from '../../lib/timeline/types'
import { cn } from '../../utils/twUtils'

/*
 * Ported from the dashboard: `app/src/containers/Timeline/TimelineToolbar.tsx`.
 *
 * ONE PART COULD NOT COME ACROSS. The app's date control is `DateRangePicker`,
 * added to `@/core` by the same commit that rebuilt this tab and not in this
 * prototype's read-only clone — so the presets it offered (`All time`,
 * `Last 12 months`, `Last 5 years`, `Since 2019`) are a menu here, and the
 * custom range its calendar allowed is not offered at all. The brush on the
 * strip still sets an arbitrary range, which is how most ranges get set anyway.
 *
 * `FacetFilter` here also predates the app's: no `trigger`, no `footer`, no
 * per-option `leading`/`count`. So the swatches and the counts are gone from
 * the option rows, and Show sits beside the facet rather than inside it.
 *
 * ONE PART IS THE PROTOTYPE'S OWN: the Registration facet — the filings by
 * state and filing number — so a filing's history can be read on its own.
 * It is not one of `filters.ts`'s filters (that file is the app's, copied
 * verbatim); the timeline holds it beside them.
 */

/** A filing as the Registration facet keys it: its state and filing number,
 *  the number without a letter prefix or punctuation — the timeline writes
 *  Illinois's filing "C64323091" where the filing itself says "64323091". */
export const filingKey = (state?: string, fileNumber?: string) =>
  `${state ?? ''}|${(fileNumber ?? '').replace(/^[A-Za-z]+/, '').replace(/[^0-9A-Za-z]/g, '')}`

type Props = {
  filters: TimelineFilters
  onChange: (next: TimelineFilters) => void
  /** The filings shown, by `filingKey`; none, every filing. */
  filings: string[]
  onFilingsChange: (next: string[]) => void
  /** All loaded updates, unfiltered. */
  updates: FilingUpdate[]
  summary: string
  className?: string
}

const PRESETS: Array<{ label: string; value: { from: string; to: string } | null }> = [
  { label: 'All time', value: null },
  {
    label: 'Last 12 months',
    value: {
      from: dayjs().subtract(365, 'day').format('YYYY-MM-DD'),
      to: dayjs().format('YYYY-MM-DD')
    }
  },
  {
    label: 'Last 5 years',
    value: {
      from: dayjs().subtract(5, 'year').format('YYYY-MM-DD'),
      to: dayjs().format('YYYY-MM-DD')
    }
  },
  {
    label: `Since ${COVERAGE_START_YEAR}`,
    value: {
      from: `${COVERAGE_START_YEAR}-01-01`,
      to: dayjs().format('YYYY-MM-DD')
    }
  }
]

export const TimelineToolbar = ({
  filters,
  onChange,
  filings,
  onFilingsChange,
  updates,
  summary,
  className
}: Props) => {
  const kindOptions = useMemo(() => {
    const counts = new Map<Kind, number>()
    for (const update of updates)
      for (const change of update.changes)
        counts.set(change.kind, (counts.get(change.kind) ?? 0) + 1)
    return KIND_ORDER.filter((kind) => kind !== 'other' || counts.has('other')).map(
      (kind) => ({
        value: kind,
        label: `${KIND_LABEL[kind].plural} · ${counts.get(kind) ?? 0}`
      })
    )
  }, [updates])

  // Every filing that has changes, each counted: the ones picked first, then
  // the rest — each run by state then filing number — so a selection is never
  // searched for.
  const filingOptions = useMemo(() => {
    const counts = new Map<string, { state?: string; fileNumber?: string; n: number }>()
    for (const update of updates) {
      const key = filingKey(update.source.state, update.source.fileNumber)
      const at = counts.get(key) ?? { state: update.source.state, fileNumber: update.source.fileNumber, n: 0 }
      at.n += update.changes.length
      counts.set(key, at)
    }
    return [...counts.entries()]
      .filter(([, f]) => f.state || f.fileNumber)
      .sort(
        ([ka, a], [kb, b]) =>
          Number(filings.includes(kb)) - Number(filings.includes(ka)) ||
          (a.state ?? '').localeCompare(b.state ?? '') ||
          (a.fileNumber ?? '').localeCompare(b.fileNumber ?? '')
      )
      .map(([key, f]) => ({ value: key, name: [f.state, f.fileNumber].filter(Boolean).join(' · '), label: `${[f.state, f.fileNumber].filter(Boolean).join(' · ')} · ${f.n}` }))
  }, [updates, filings])
  // One or two picked: the button names them rather than counting them.
  const named =
    filings.length > 0 && filings.length <= 2
      ? filingOptions.filter((o) => filings.includes(o.value)).map((o) => o.name)
      : []

  const rangeLabel =
    PRESETS.find(
      (p) => (p.value?.from ?? null) === filters.from && (p.value?.to ?? null) === filters.to
    )?.label ?? (filters.from || filters.to ? 'Custom range' : 'All time')

  return (
    <Toolbar className={className}>
      <Menu>
        <MenuTrigger asChild>
          <ToolbarButton trailingIcon={<ChevronDown aria-hidden="true" className="size-4" />}>
            {rangeLabel}
          </ToolbarButton>
        </MenuTrigger>
        <MenuContent align="start" className="z-popover w-48">
          {PRESETS.map((preset) => (
            <MenuItem
              key={preset.label}
              className={cn(preset.label === rangeLabel && 'bg-muted')}
              onSelect={() =>
                onChange({
                  ...filters,
                  from: preset.value?.from ?? null,
                  to: preset.value?.to ?? null
                })
              }
            >
              {preset.label}
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>

      <FacetFilter
        label="Change type"
        options={kindOptions}
        value={filters.kinds}
        onChange={(next) => onChange({ ...filters, kinds: next as Kind[] })}
        searchable={false}
      />

      <FacetFilter
        aria-label="Registration"
        className={cn(named.length > 0 && '[&_.core-count]:hidden')}
        label={named.length > 0 ? `Registration: ${named.join(', ')}` : 'Registration'}
        options={filingOptions.map(({ value, label }) => ({ value, label }))}
        value={filings}
        onChange={onFilingsChange}
        searchable={filingOptions.length > 8}
      />

      <SegmentedControl
        aria-label="Show added or removed"
        onValueChange={(next) => onChange({ ...filters, show: next as Show })}
        size="sm"
        value={filters.show}
      >
        <SegmentedControlItem value="all">All</SegmentedControlItem>
        <SegmentedControlItem value="added">Added</SegmentedControlItem>
        <SegmentedControlItem value="removed">Removed</SegmentedControlItem>
      </SegmentedControl>

      {(isFilterActive(filters) || filings.length > 0) && (
        <ActionButton
          onClick={() => {
            onChange(EMPTY_FILTERS)
            onFilingsChange([])
          }}
          size="compact"
          variant="quiet"
        >
          Clear filters
        </ActionButton>
      )}
      <ToolbarSpacer />
      <ToolbarCount>{summary}</ToolbarCount>
    </Toolbar>
  )
}
