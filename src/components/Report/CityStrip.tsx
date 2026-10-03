import { useContext, useId, useState } from 'react'
import * as RadixTooltip from '@radix-ui/react-tooltip'
import { Check, X } from 'lucide-react'

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
            // Closed is grey, not red: a city registration that closed is history,
            // not a problem.
            <MetaChip tone={open ? 'success' : 'neutral'} size="compact">
              {open ? <Check {...icon} /> : <X {...icon} />}
              {open ? 'Open' : 'Closed'}
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
    ])
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

const cityName = (r: CityRegistration) => (r.state === 'DC' ? `${r.city}, DC` : r.city)
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
            // Closed is grey: a closed city registration is history, not a finding.
            const tone = open ? 'success' : 'neutral'
            const on = k === selected && !collapsed
            const since = here.map((r) => r.businessStart ?? r.locationStart).filter((d): d is string => Boolean(d)).sort()[0]
            return (
              <RadixTooltip.Root key={k} delayDuration={200}>
                <RadixTooltip.Trigger asChild>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-controls={detailId}
                    aria-label={`City registration, ${cityName(first)}: ${open ? 'open' : 'closed'}`}
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
                    <span className="flex items-baseline justify-between gap-4">
                      <span className="font-semibold text-foreground">City registration · {cityName(first)}</span>
                      <span className="text-text-secondary">{open ? 'Open' : 'Closed'}</span>
                    </span>
                    {distinct(here.map((r) => r.dba)).length > 0 && <span className="block">DBA: {distinct(here.map((r) => r.dba)).join(', ')}</span>}
                    {distinct(here.map((r) => r.owner)).length > 0 && <span className="block">Owner: {distinct(here.map((r) => r.owner)).join(', ')}</span>}
                    {first.licenseType && <span className="block">License: {first.licenseType}</span>}
                    {since && <span className="block">Since {formatDate(since)}</span>}
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
