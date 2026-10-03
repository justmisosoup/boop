import { useId, useState } from 'react'
import * as RadixTooltip from '@radix-ui/react-tooltip'
import { Check, X } from 'lucide-react'

import { MetaChip, Text } from '@/core'

import type { BusinessRecord } from '../../lib/deriveResults'
import { naicsTitle } from '../../lib/naics'
import { NOT_PROVIDED } from '../../lib/registrationStatus'
import { formatDate } from '../../lib/reportLabels'
import { cn } from '../../utils/twUtils'
import { AttributeCells, type AttributeCell } from '../AttributeGrid'
import { Collapsible } from '../Collapsible'

type CityRegistration = NonNullable<BusinessRecord['cityRegistrations']>[number]

const icon = { 'aria-hidden': true, size: 12, strokeWidth: 2, className: 'shrink-0' } as const
const absent = <span className="text-text-secondary">{NOT_PROVIDED}</span>

/** Open while any location under it is: no location or business end date. */
export const isOpen = (r: CityRegistration) => !r.locationEnd && !r.businessEnd

/**
 * One city's registration in the report's cells: what it trades as and whose
 * it is, side by side and first, then its standing, what it does, and each
 * location under it — where, then when the registration began beside the first
 * location's start and end, then its numbers.
 */
export const cityRegistrationCells = (regs: CityRegistration[], city: string): AttributeCell[] => {
  const here = regs.filter((r) => r.city === city)
  const first = here[0]
  const open = here.some(isOpen)
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
            <MetaChip tone={open ? 'success' : 'danger'} size="compact">
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
        label: here.length > 1 ? `Location ${i + 1}` : 'Location',
        span: 'full' as const,
        values: [{ value: r.address }]
      },
      ...(r.licenseType ? [{ key: `type-${i}`, label: 'License type', values: [{ value: r.licenseType }] }] : []),
      ...(r.activity && !r.naics ? [{ key: `act-${i}`, label: 'Activity', values: [{ value: r.activity }] }] : []),
      ...(i === 0
        ? [{ key: 'registered', label: 'Registered', values: [{ value: first.businessStart ? formatDate(first.businessStart) : absent }] }]
        : []),
      { key: `start-${i}`, label: 'Location start', values: [{ value: r.locationStart ? formatDate(r.locationStart) : absent }] },
      { key: `end-${i}`, label: 'Location end', values: [{ value: r.locationEnd ? formatDate(r.locationEnd) : 'Open' }] },
      { key: `acct-${i}`, label: 'Account number', values: [{ value: r.accountNumber ?? absent }] },
      ...(r.locationId ? [{ key: `loc-${i}`, label: 'Location ID', values: [{ value: r.locationId }] }] : [])
    ])
  ]
}

/**
 * A business's city registrations, as its state filings are shown: a tile per
 * city — San Francisco — its status as the tile's mark, and under it, opened
 * from the tile, the registration in the report's cells. Closed until a city
 * is picked; picking the open one again closes it.
 */
export const CityStrip = ({ regs, className }: { regs: CityRegistration[]; className?: string }) => {
  const cities = [...new Set(regs.map((r) => r.city))]
  const [selected, setSelected] = useState(cities[0])
  const [collapsed, setCollapsed] = useState(true)
  const detailId = useId()
  if (cities.length === 0) return null

  const cells = cityRegistrationCells(regs, selected)

  return (
    <div className={cn('border-t border-[var(--core-color-border-divider)]', className)}>
      <div className="px-4 pt-3">
        {/* A label, as State filings is. */}
        <Text tone="secondary" size="sm" className="leading-snug">
          City registrations
        </Text>
      </div>
      <RadixTooltip.Provider>
        <div role="radiogroup" aria-label="City registrations" className="flex flex-wrap gap-1.5 px-4 py-3">
          {cities.map((city) => {
            const mine = regs.filter((r) => r.city === city)
            const cityOpen = mine.some(isOpen)
            const on = city === selected && !collapsed
            return (
              <RadixTooltip.Root key={city} delayDuration={200}>
                <RadixTooltip.Trigger asChild>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-controls={detailId}
                    aria-label={`${city}: ${cityOpen ? 'open' : 'closed'}`}
                    onClick={() => {
                      if (on) return setCollapsed(true)
                      setSelected(city)
                      setCollapsed(false)
                    }}
                    className="flex rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <MetaChip
                      tone={cityOpen ? 'success' : 'danger'}
                      size="compact"
                      className={cn(on && 'ring-1 ring-[var(--core-color-border-strong)]')}
                    >
                      {cityOpen ? <Check {...icon} /> : <X {...icon} />}
                      {city}
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
                      <span className="font-semibold text-foreground">{city}</span>
                      <span className="text-text-secondary">
                        {mine.length} {mine.length === 1 ? 'location' : 'locations'}
                      </span>
                    </span>
                    <span className="flex items-center gap-1">
                      {cityOpen ? <Check {...icon} /> : <X {...icon} />}
                      {cityOpen ? 'Open' : 'Closed'}
                    </span>
                  </RadixTooltip.Content>
                </RadixTooltip.Portal>
              </RadixTooltip.Root>
            )
          })}
        </div>
      </RadixTooltip.Provider>

      <Collapsible open={!collapsed}>
        <div id={detailId} className="border-t border-[var(--core-color-border-divider)]">
          <div
            className="flex min-h-12 items-center gap-2 bg-bottom bg-no-repeat px-4 py-2"
            style={{ backgroundImage: 'var(--dash-rule-x)', backgroundSize: '100% 1px' }}
          >
            <Text className="font-semibold">{selected}</Text>
          </div>
          <AttributeCells items={cells} className="-mb-px" />
        </div>
      </Collapsible>
    </div>
  )
}
