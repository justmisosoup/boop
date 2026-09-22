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
import { COVERAGE_START_YEAR, KIND_COLOR_VAR, KIND_LABEL, KIND_ORDER } from '../../lib/timeline/constants'
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
 */

type Props = {
  filters: TimelineFilters
  onChange: (next: TimelineFilters) => void
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

      {isFilterActive(filters) && (
        <ActionButton onClick={() => onChange(EMPTY_FILTERS)} size="compact" variant="quiet">
          Clear filters
        </ActionButton>
      )}
      <ToolbarSpacer />
      <ToolbarCount>{summary}</ToolbarCount>
    </Toolbar>
  )
}
