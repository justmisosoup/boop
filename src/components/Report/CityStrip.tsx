import { useContext, useId, useState, type ReactElement, type ReactNode } from 'react'
import * as RadixTooltip from '@radix-ui/react-tooltip'
import { Database, Check, ChevronDown, X } from 'lucide-react'

import { MetaChip, Text } from '@/core'

import type { BusinessRecord } from '../../lib/deriveResults'
import { naicsTitle } from '../../lib/naics'
import { formatDate } from '../../lib/reportLabels'
import { cn } from '../../utils/twUtils'
import { AttributeCells, type AttributeCell } from '../AttributeGrid'
import { Collapsible } from '../Collapsible'
import { selectedStyle } from './FilingStrip'
import { StripExpand } from './Strip'

type CityRegistration = NonNullable<BusinessRecord['cityRegistrations']>[number]

const icon = { 'aria-hidden': true, size: 12, strokeWidth: 2, className: 'shrink-0' } as const
// A city's register, not a state's: "Not provided", without the state.
const absent = <span className="text-text-secondary">Not provided</span>

/** Open while any location under it is: no location or business end date. */
export const isOpen = (r: CityRegistration) => !r.locationEnd && !r.businessEnd

/**
 * One city's registration in the report's cells: what it trades as and whose
 * it is, side by side and first, then its standing, what it does, and each
 * location under it — where, then when the registration began beside the first
 * location's start and end, then its numbers.
 */
export const cityRegistrationCells = (regs: CityRegistration[], city: string): AttributeCell[] => {
  // Open locations first, then the newest: Washington DC's one active licence
  // for Expert Fence ahead of its five closed ones.
  const here = regs
    .filter((r) => r.city === city)
    .sort((a, b) => Number(isOpen(b)) - Number(isOpen(a)) || (b.locationStart ?? '').localeCompare(a.locationStart ?? ''))
  const first = here[0]
  const open = here.some(isOpen)
  // When the registration began: the earliest date any of it gives.
  const registered = here.map((r) => r.businessStart).filter((d): d is string => Boolean(d)).sort()[0]
  // One account can trade under several names over time; each is its own value.
  const dbas = [...new Set(here.map((r) => r.dba).filter((d): d is string => Boolean(d)))]
  const owners = [...new Set(here.map((r) => r.owner).filter((o): o is string => Boolean(o)))]
  const licensed = here.some((r) => r.licenseType)
  return [
    {
      key: 'dba',
      label: 'Doing business as (DBA)',
      values: dbas.length > 0 ? dbas.map((value) => ({ value })) : [{ value: absent }]
    },
    {
      key: 'owner',
      label: 'Owner',
      values: owners.length > 0 ? owners.map((value) => ({ value })) : [{ value: absent }]
    },
    {
      key: 'status',
      label: 'Status',
      values: [
        {
          value: (
            // Read as a state filing's standing is: Active, or Inactive in red.
            <MetaChip tone={open ? 'success' : 'danger'} size="compact">
              {open ? <Check {...icon} /> : <X {...icon} />}
              {open ? 'Active' : 'Inactive'}
            </MetaChip>
          )
        }
      ]
    },
    ...(first.naics || !licensed
      ? [
          {
            key: 'naics',
            label: 'NAICS',
            span: 'full' as const,
            values: [
              {
                value: first.naics ? (
                  <>
                    {first.naics}
                    {naicsTitle(first.naics) && <span className="text-text-secondary"> · {naicsTitle(first.naics)}</span>}
                  </>
                ) : (
                  absent
                )
              }
            ]
          }
        ]
      : []),
    // Each location: where, when it opened and closed, then its numbers. A
    // city that licenses by kind (Washington DC) says what each licence is.
    ...here.flatMap((r, i) => [
      {
        key: `addr-${i}`,
        // A city that licenses by kind issues licences, not locations.
        label: licensed ? (here.length > 1 ? `License ${i + 1}` : 'License') : here.length > 1 ? `Location ${i + 1}` : 'Location',
        span: 'full' as const,
        values: [{ value: r.address }]
      },
      ...(r.licenseType ? [{ key: `type-${i}`, label: 'License type', values: [{ value: r.licenseType }] }] : []),
      ...(r.activity && !r.naics ? [{ key: `act-${i}`, label: 'Activity', values: [{ value: r.activity }] }] : []),
      ...(i === 0
        ? [{ key: 'registered', label: 'Registered', values: [{ value: registered ? formatDate(registered) : absent }] }]
        : []),
      { key: `start-${i}`, label: licensed ? 'License start' : 'Location start', values: [{ value: r.locationStart ? formatDate(r.locationStart) : absent }] },
      { key: `end-${i}`, label: licensed ? 'License end' : 'Location end', values: [{ value: r.locationEnd ? formatDate(r.locationEnd) : 'Open' }] },
      { key: `acct-${i}`, label: 'Account number', values: [{ value: r.accountNumber ?? absent }] },
      ...(r.locationId ? [{ key: `loc-${i}`, label: 'Location ID', values: [{ value: r.locationId }] }] : [])
    ]),
    // The register itself: the city's own page, and when we last read it.
    ...(first.dataAsOf ? [{ key: 'asof', label: 'Register as of', values: [{ value: formatDate(first.dataAsOf) }] }] : []),
    ...(first.sourceUrl
      ? [
          {
            key: 'record',
            label: 'Record',
            span: 'full' as const,
            values: [
              {
                value: (
                  <a
                    href={first.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-[var(--core-color-border-strong)] underline-offset-2 hover:decoration-current"
                  >
                    {first.registry}
                  </a>
                )
              }
            ]
          }
        ]
      : [])
  ]
}

/** One registration: a Middesk city_registration reference, as the Sources
 *  tab's cards are — the locations under it together. */
export const registrationsOf = (regs: CityRegistration[]) => {
  const by = new Map<string, CityRegistration[]>()
  for (const r of regs) {
    const k = r.refId ?? `${r.city}|${r.accountNumber ?? ''}|${r.locationId ?? ''}`
    by.set(k, [...(by.get(k) ?? []), r])
  }
  const started = (rs: CityRegistration[]) => rs.map((r) => r.businessStart ?? r.locationStart ?? '').sort().reverse()[0] ?? ''
  // Open ones first, then the newest.
  return [...by.entries()].sort(
    ([, a], [, b]) => Number(b.some(isOpen)) - Number(a.some(isOpen)) || started(b).localeCompare(started(a))
  )
}

export const cityName = (r: CityRegistration) => (r.state === 'DC' ? `${r.city}, DC` : r.city)
const distinct = (xs: Array<string | null | undefined>) => [...new Set(xs.filter((x): x is string => Boolean(x)))]

/**
 * A business's city registrations, drawn as its state filings are: the label,
 * a tile per registration named by its city — the same city as often as it
 * registered there — its standing as the tile's mark and fill, the picked one
 * inverted, a tooltip saying which registration it is, and under it the
 * registration in the report's cells. Closed until one is picked; picking the
 * open one again closes it.
 */
export const CityStrip = ({ regs, className }: { regs: CityRegistration[]; className?: string }) => {
  const registrations = registrationsOf(regs)
  const expand = useContext(StripExpand)
  const [selected, setSelected] = useState(registrations[0]?.[0])
  const [collapsed, setCollapsed] = useState(!expand)
  const detailId = useId()
  if (registrations.length === 0) return null

  const shown = registrations.find(([k]) => k === selected)?.[1] ?? registrations[0][1]

  return (
    // Over the rule above it, as the State filings strip is: the line between is solid.
    <div className={cn('relative -mt-px border-t border-[var(--core-color-border-divider)] bg-card', className)}>
      <div className="px-4 pt-3">
        {/* A label, as State filings is. */}
        <Text tone="secondary" size="sm" className="leading-snug">
          City registrations
        </Text>
      </div>
      <RadixTooltip.Provider>
        <div role="radiogroup" aria-label="City registrations" className="flex flex-wrap gap-1.5 px-4 py-3">
          {registrations.map(([k, here]) => {
            const first = here[0]
            const open = here.some(isOpen)
            // Active, or Inactive in red, as a state filing reads.
            const tone = open ? 'success' : 'danger'
            const on = k === selected && !collapsed
            return (
              <RadixTooltip.Root key={k} delayDuration={200}>
                <RadixTooltip.Trigger asChild>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-controls={detailId}
                    aria-label={`City registration, ${cityName(first)}: ${open ? 'active' : 'inactive'}`}
                    onClick={() => {
                      if (on) return setCollapsed(true)
                      setSelected(k)
                      setCollapsed(false)
                    }}
                    className="flex min-w-14 rounded-control transition-shadow duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                  >
                    <MetaChip tone={tone} size="compact" className="w-full justify-center" style={on ? selectedStyle(tone) : undefined}>
                      {open ? <Check {...icon} /> : <X {...icon} />}
                      {cityName(first)}
                    </MetaChip>
                  </button>
                </RadixTooltip.Trigger>
                <RadixTooltip.Portal>
                  <RadixTooltip.Content
                    side="top"
                    sideOffset={6}
                    collisionPadding={10}
                    className="core-theme z-popover max-w-64 rounded-popover border border-border bg-popover px-3 py-2 text-caption text-popover-foreground shadow-elevation-popover"
                  >
                    <CityTooltip here={here} />
                  </RadixTooltip.Content>
                </RadixTooltip.Portal>
              </RadixTooltip.Root>
            )
          })}
        </div>
      </RadixTooltip.Provider>

      {/* The picked registration, in the report's cells, under a header naming it. */}
      <Collapsible open={!collapsed}>
        <div id={detailId} className="border-t border-[var(--core-color-border-divider)]">
          <div
            className="flex min-h-12 items-center gap-2 bg-bottom bg-no-repeat px-4 py-2"
            style={{ backgroundImage: 'var(--dash-rule-x)', backgroundSize: '100% 1px' }}
          >
            <Text size="sm" className="font-semibold">
              City registration · {cityName(shown[0])}
            </Text>
          </div>
          <AttributeCells items={cityRegistrationCells(shown, shown[0].city)} columns={3} className="-mb-px" />
        </div>
      </Collapsible>
    </div>
  )
}

/**
 * One city registration as a row of the Registrations table, as a state's
 * filing reads there: "City registration" over the city where a state row says
 * Domestic or Foreign, its standing beside it, and the registration in the
 * report's cells under the row when it is opened.
 */
export const CityRegistrationRow = ({
  here,
  open,
  onToggle,
  onOpen
}: {
  here: CityRegistration[]
  open: boolean
  onToggle: () => void
  /** Given, the row opens the registration in Sources rather than its details under it. */
  onOpen?: () => void
}) => {
  const detailId = useId()
  const first = here[0]
  const { active, kind, registered, chip } = cityRegistrationSummary(here)
  return (
    <>
      {withCityTip(
      here,
      <button
        type="button"
        aria-expanded={onOpen ? undefined : open}
        aria-controls={onOpen ? undefined : detailId}
        aria-label={`City registration, ${cityName(first)}: ${active ? 'active' : 'inactive'}${onOpen ? '. Open in Sources' : ''}`}
        onClick={onOpen ?? onToggle}
        className={cn(
          'grid w-full grid-cols-1 items-center gap-x-4 gap-y-2 bg-[image:var(--dash-rule-x)] bg-[length:100%_1px] bg-[position:left_bottom] bg-no-repeat px-4 py-3 text-left transition-colors last:bg-none hover:bg-[var(--core-color-state-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]',
          open && 'bg-[var(--core-color-surface-subtle)]'
        )}
      >
        <span className="min-w-0">
          {/* The caption names the register; the title is just the city. */}
          <span className="block text-caption text-text-secondary">{kind}</span>
          <span className="block text-sm font-medium text-text-primary">{cityName(first)}</span>
          {registered && <span className="block text-caption text-text-secondary">{registered}</span>}
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          {chip}
          {/* Opening in Sources: the Sources mark, as the side rail draws it. Opening here: the chevron. */}
          {onOpen ? (
            <SourceDataMark />
          ) : (
            <ChevronDown
              aria-hidden="true"
              size={16}
              strokeWidth={1.75}
              className={cn(
                'ml-auto shrink-0 text-text-secondary transition-transform duration-fast motion-reduce:transition-none',
                open && 'rotate-180'
              )}
            />
          )}
        </span>
      </button>
      )}
      <Collapsible open={open && !onOpen}>
        <div id={detailId}>
          <CityRegistrationDetail here={here} />
        </div>
      </Collapsible>
    </>
  )
}

/** A city registration's caption and standing, as its row and its grid cell both read them. */
const cityRegistrationSummary = (here: CityRegistration[]) => {
  const active = here.some(isOpen)
  const since = here
    .map((r) => r.businessStart ?? r.locationStart)
    .filter((d): d is string => Boolean(d))
    .sort()[0]
  const registered = since
    ? `Registered ${new Date(`${since.slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
    : null
  return {
    active,
    caption: ['City registration', registered].filter(Boolean).join(' · '),
    // The table's row: the kind over the name, the date under it.
    kind: 'City registration',
    registered,
    // Active, or Inactive in red, as a state filing reads.
    chip: (
      <MetaChip tone={active ? 'success' : 'danger'} size="compact">
        {active ? <Check {...icon} /> : <X {...icon} />}
        {active ? 'Active' : 'Inactive'}
      </MetaChip>
    )
  }
}

/**
 * One city registration as a cell of the Registrations grid, as a state's
 * filing reads there: "City registration" over the city, its standing under.
 * Its details open under the grid's row, which the grid draws.
 */
export const CityRegistrationCell = ({
  here,
  open,
  onToggle,
  onOpen,
  className
}: {
  here: CityRegistration[]
  open: boolean
  onToggle: () => void
  /** Given, the cell opens the registration in Sources rather than its details. */
  onOpen?: () => void
  className?: string
}) => {
  const { active, caption, chip } = cityRegistrationSummary(here)
  return withCityTip(
    here,
    <button
      type="button"
      aria-expanded={onOpen ? undefined : open}
      aria-label={`City registration, ${cityName(here[0])}: ${active ? 'active' : 'inactive'}${onOpen ? '. Open in Sources' : ''}`}
      onClick={onOpen ?? onToggle}
      className={cn(
        'grid gap-1 border-t border-[var(--core-color-border-divider)] px-4 py-3 text-left transition-colors hover:bg-[var(--core-color-state-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        open && 'bg-[var(--core-color-surface-subtle)]',
        className
      )}
    >
      <span className="text-caption text-text-secondary">{caption}</span>
      <span className="text-sm font-medium text-text-primary">{cityName(here[0])} City Registration</span>
      <span className="flex flex-wrap items-center gap-1.5">{chip}</span>
    </button>
  )
}

/** A city registration's details, in the report's cells, under its row or its
 *  grid row — or, `titled`, under the map, with a header naming it. */
export const CityRegistrationDetail = ({ here, titled = false }: { here: CityRegistration[]; titled?: boolean }) => (
  <div className="border-t border-[var(--core-color-border-divider)]">
    {titled && (
      <div
        className="flex min-h-12 items-center gap-2 bg-bottom bg-no-repeat px-4 py-2"
        style={{ backgroundImage: 'var(--dash-rule-x)', backgroundSize: '100% 1px' }}
      >
        <Text size="sm" className="font-semibold">
          City registration · {cityName(here[0])}
        </Text>
      </div>
    )}
    <AttributeCells items={cityRegistrationCells(here, here[0].city)} columns={3} className="-mb-px" />
  </div>
)

/**
 * A city registration's tooltip, read as a state filing's is (`TileTooltip`):
 * its name and how many locations it holds, then its standing with the mark
 * its chip carries, then what the register says of it.
 */
export const CityTooltip = ({ here }: { here: CityRegistration[] }) => {
  const active = here.some(isOpen)
  const mark = { 'aria-hidden': true, size: 12, strokeWidth: 2, className: 'shrink-0' } as const
  const since = here
    .map((r) => r.businessStart ?? r.locationStart)
    .filter((d): d is string => Boolean(d))
    .sort()[0]
  const line = (text: string, icon?: ReactNode) => (
    <span className="flex items-center gap-1">
      {icon ?? <span aria-hidden="true" className="w-3 shrink-0" />}
      {text}
    </span>
  )
  const dbas = distinct(here.map((r) => r.dba))
  const owners = distinct(here.map((r) => r.owner))
  return (
    <div className="flex flex-col">
      <span className="flex items-baseline justify-between gap-4">
        <span className="font-semibold text-foreground">{cityName(here[0])} City Registration</span>
        <span className="shrink-0 whitespace-nowrap text-text-secondary">
          {here.length} location{here.length === 1 ? '' : 's'}
        </span>
      </span>
      {line(active ? 'Active' : 'Inactive', active ? <Check {...mark} /> : <X {...mark} />)}
      {since && line(`Registered ${formatDate(since)}`)}
      {dbas.length > 0 && line(`DBA: ${dbas.join(', ')}`)}
      {owners.length > 0 && line(`Owner: ${owners.join(', ')}`)}
      {here[0].licenseType && line(`License: ${here[0].licenseType}`)}
    </div>
  )
}

/** A city registration's row, cell or pin, with its tooltip. */
/**
 * The Sources mark at a registration row's end, as the side rail draws it —
 * the row opens the registration's source data — with a tooltip of its own
 * that says so. The row's own tooltip (the state's or the city's standing)
 * does not open over it: the mark keeps the pointer to itself.
 */
export const SourceDataMark = () => (
  <RadixTooltip.Provider>
    <RadixTooltip.Root delayDuration={200}>
      <RadixTooltip.Trigger asChild>
        <span
          className="ml-auto inline-flex shrink-0 text-text-secondary"
          onPointerMove={(e) => e.stopPropagation()}
          onPointerEnter={(e) => e.stopPropagation()}
        >
          <Database aria-hidden="true" size={16} strokeWidth={1.5} />
        </span>
      </RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side="top"
          sideOffset={6}
          collisionPadding={10}
          className="core-theme z-popover max-w-64 rounded-popover border border-border bg-popover px-3 py-2 text-caption text-popover-foreground shadow-elevation-popover"
        >
          Show source data
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  </RadixTooltip.Provider>
)

export const withCityTip = (here: CityRegistration[], element: ReactElement, key?: string) => (
  <RadixTooltip.Root key={key} delayDuration={200}>
    <RadixTooltip.Trigger asChild>{element}</RadixTooltip.Trigger>
    <RadixTooltip.Portal>
      <RadixTooltip.Content
        side="top"
        sideOffset={6}
        collisionPadding={10}
        className="core-theme z-popover max-w-64 rounded-popover border border-border bg-popover px-3 py-2 text-caption text-popover-foreground shadow-elevation-popover"
      >
        <CityTooltip here={here} />
      </RadixTooltip.Content>
    </RadixTooltip.Portal>
  </RadixTooltip.Root>
)
