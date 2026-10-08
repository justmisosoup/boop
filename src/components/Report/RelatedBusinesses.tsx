import { Fragment, useMemo, useState, type ReactNode } from 'react'
import * as RadixTooltip from '@radix-ui/react-tooltip'
import { Building2, ChevronDown, MapPin, UsersRound } from 'lucide-react'

import { ActionButton, MetaChip } from '@/core'

import type { BusinessRecord } from '../../lib/deriveResults'
import { operationsOf, type Location } from '../../lib/operations'
import {
  corroborated,
  nameKey,
  peopleByPerson,
  peopleRows,
  verifiedBy,
  type AttributeRow
} from '../../lib/attributes'
import { sameName } from '../../lib/registrationStatus'
import { isBusinessName } from '../../lib/businessNames'
import { LIKELY_MATCH } from '../../lib/relatedBusinesses'
import { RowProvenance } from '../Provenance'
import { Relevance, addressSources, partialMatchOf } from './AddressTable'
import { selectedStyle } from './FilingStrip'
import { cn } from '../../utils/twUtils'

type Connection = NonNullable<BusinessRecord['connections']>[number]
type Shared = 'people' | 'entities' | 'addresses'

/** The match a business must reach, sharing people, to read as likely related. */
const LIKELY = LIKELY_MATCH

const icon = { 'aria-hidden': true, size: 12, strokeWidth: 2, className: 'shrink-0' } as const
const COLUMNS = 'md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]'
const RULE =
  'bg-[image:var(--dash-rule-x)] bg-[length:100%_1px] bg-[position:left_bottom] bg-no-repeat last:bg-none'

/** "registered_agent" → "Registered agent". */
const roleName = (v: string) => {
  const s = v.replace(/_/g, ' ').toLowerCase()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Who the business shares with this one: the people, and a business named on its filing. */
const sharedPeople = (c: Connection) => (c.people ?? []).filter((p) => !isBusinessName(p.name))

/** The businesses it shares with this one: one named on its filing — as an
 *  officer, a member, a registered agent — whether filed as a business or listed
 *  among the people. */
const sharedEntities = (c: Connection) => [
  ...(c.businesses ?? []),
  ...(c.people ?? []).filter((p) => isBusinessName(p.name))
]

/** It shares someone — a person, or a business named on both filings. */
const sharesParties = (c: Connection) => sharedPeople(c).length + sharedEntities(c).length > 0

/** How much a business shares with this one: its people and addresses together. */
const sharedCount = (c: Connection) =>
  sharedPeople(c).length + sharedEntities(c).length + (c.addresses ?? []).length

const ColumnLabel = ({ children }: { children: string }) => (
  <span className="text-xs font-medium text-[var(--core-color-table-header-text)]">
    {children}
  </span>
)

/** One shared person, as a row of the opened list: the name — with the
 *  Submitted tag under it where the customer submitted them — the roles as chips. */
const SharedRow = ({
  name,
  roles,
  submitted,
  domesticState
}: {
  name: string
  roles: string[]
  submitted?: AttributeRow
  domesticState?: string | null
}) => (
  <div className={cn('grid grid-cols-1 items-start gap-x-4 gap-y-2 px-4 py-2.5', COLUMNS, RULE)}>
    <span className="min-w-0">
      <span className="block text-sm text-text-primary">{name}</span>
      {/* The People card's own tag: "Submitted +13". */}
      {submitted && (
        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-caption text-text-secondary">
          <RowProvenance
            row={submitted}
            domesticState={domesticState ?? undefined}
            submitted={{ verified: corroborated(submitted), by: verifiedBy(submitted) }}
            plainClaim
          />
        </span>
      )}
    </span>
    <span className="flex flex-wrap items-center gap-1.5">
      {roles.map((r) => (
        <MetaChip key={r} tone="neutral" size="compact">
          {r}
        </MetaChip>
      ))}
    </span>
  </div>
)

/** An address by its street line and ZIP, so "…UT 84123" finds "…UT 84123-2550". */
const addressKey = (full: string) =>
  `${(full.split(',')[0] ?? '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()}|${
    (full.match(/\b(\d{5})(?:-\d{4})?\b/) ?? [])[1] ?? ''
  }`

/** One shared address, as the Addresses card reads one: its type over it, and
 *  its characteristics beside it where this business's own record has it. */
const SharedAddress = ({
  address,
  location,
  tag,
  match
}: {
  address: NonNullable<Connection['addresses']>[number]
  location?: Location
  /** The Addresses card's own tag, where this business submitted it: "Submitted +27". */
  tag?: ReactNode
  /** How the submitted address matched, where only in part. */
  match?: string
}) => {
  const type = [...new Set((address.labels ?? []).map(roleName))].join(', ')
  return (
    <div className={cn('grid grid-cols-1 items-start gap-x-4 gap-y-2 px-4 py-2.5', COLUMNS, RULE)}>
      <span className="min-w-0">
        {type && <span className="block text-caption text-text-secondary">{type}</span>}
        <span className="block text-sm text-text-primary">{address.fullAddress}</span>
        {tag && (
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-caption text-text-secondary">
            {tag}
          </span>
        )}
      </span>
      {location ? <Relevance a={location} match={match} /> : <span />}
    </div>
  )
}

/** A business's shared people or addresses, opened under its row. */
const SharedList = ({
  c,
  kind,
  locations,
  submittedAs,
  domesticState,
  addressTag,
  match
}: {
  c: Connection
  kind: Shared
  locations: Map<string, Location>
  /** The submitted person a shared name is, if any. */
  submittedAs: (name: string) => AttributeRow | undefined
  domesticState?: string | null
  /** A submitted address's tag, as the Addresses card draws it. */
  addressTag: (location: Location, key: string) => ReactNode
  match?: string
}) => (
  <div className="border-t border-[var(--core-color-border-divider)]">
    {kind === 'entities' ? (
      <>
        <div className={cn('hidden gap-x-4 border-b border-[var(--core-color-border-divider)] px-4 py-1.5 md:grid', COLUMNS)}>
          <ColumnLabel>Shared entities</ColumnLabel>
          <ColumnLabel>Roles</ColumnLabel>
        </div>
        {sharedEntities(c).map((e, i) => (
          <SharedRow
            key={`${e.name}-${i}`}
            name={e.name}
            roles={[...new Set((e.titles ?? []).map(roleName))]}
          />
        ))}
      </>
    ) : kind === 'people' ? (
      <>
        <div className={cn('hidden gap-x-4 border-b border-[var(--core-color-border-divider)] px-4 py-1.5 md:grid', COLUMNS)}>
          <ColumnLabel>Shared people</ColumnLabel>
          <ColumnLabel>Roles</ColumnLabel>
        </div>
        {/* The submitted people first. */}
        {sharedPeople(c)
          .map((p) => ({ p, submitted: submittedAs(p.name) }))
          .sort((a, b) => Number(Boolean(b.submitted)) - Number(Boolean(a.submitted)))
          .map(({ p, submitted }, i) => (
            <SharedRow
              key={`${p.name}-${i}`}
              name={p.name}
              roles={[...new Set((p.titles ?? []).map(roleName))]}
              submitted={submitted}
              domesticState={domesticState}
            />
          ))}
      </>
    ) : (
      <>
        <div className={cn('hidden gap-x-4 border-b border-[var(--core-color-border-divider)] px-4 py-1.5 md:grid', COLUMNS)}>
          <ColumnLabel>Shared addresses</ColumnLabel>
          <ColumnLabel>Characteristics</ColumnLabel>
        </div>
        {/* The submitted addresses first. */}
        {(c.addresses ?? [])
          .map((a) => ({ a, location: locations.get(addressKey(a.fullAddress)) }))
          .sort((x, y) => Number(Boolean(y.location?.submitted)) - Number(Boolean(x.location?.submitted)))
          .map(({ a, location }, i) => (
            <SharedAddress
              key={`${a.fullAddress}-${i}`}
              address={a}
              location={location}
              tag={location?.submitted ? addressTag(location, `shared-${c.id}-${i}`) : undefined}
              match={match}
            />
          ))}
      </>
    )}
  </div>
)

/** A shared-people or shared-addresses chip: its count, and it opens the list. */
const SharedChip = ({
  kind,
  n,
  on,
  onToggle,
  hint
}: {
  kind: Shared
  n: number
  on: boolean
  onToggle: () => void
  /** Pointed at: how many of them were submitted and how many found. */
  hint?: ReactNode
}) => {
  const chip = (
  <button
    type="button"
    aria-expanded={on}
    onClick={onToggle}
    className="group flex rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    {/* Open, it reads as a picked registration tile does: filled, inverted. */}
    <MetaChip
      tone="neutral"
      size="compact"
      className="cursor-pointer"
      style={on ? selectedStyle('neutral') : undefined}
    >
      {kind === 'people' ? (
        <UsersRound {...icon} />
      ) : kind === 'entities' ? (
        <Building2 {...icon} />
      ) : (
        <MapPin {...icon} />
      )}
      {LABEL[kind]}
      <span className={cn('tabular-nums', on ? 'opacity-70' : 'text-text-secondary')}>{n}</span>
      {/* That it opens: a chevron that slides in on hover or focus, and stays,
          turned up, while its list is open. Collapsed, it takes back the chip's
          gap, so the chip does not grow until it shows. */}
      <span
        aria-hidden="true"
        className={cn(
          'flex overflow-hidden transition-[max-width,margin,opacity] duration-fast ease-standard motion-reduce:transition-none',
          on
            ? 'ml-0 max-w-3 opacity-100'
            : '-ml-1 max-w-0 opacity-0 group-hover:ml-0 group-hover:max-w-3 group-hover:opacity-100 group-focus-visible:ml-0 group-focus-visible:max-w-3 group-focus-visible:opacity-100'
        )}
      >
        <ChevronDown
          size={12}
          strokeWidth={2}
          className={cn(
            'shrink-0 transition-transform duration-fast ease-standard motion-reduce:transition-none',
            on && 'rotate-180'
          )}
        />
      </span>
    </MetaChip>
  </button>
  )
  return hint ? (
    // The registrations' tooltip: the same popover, the same type.
    <RadixTooltip.Root delayDuration={200}>
      <RadixTooltip.Trigger asChild>{chip}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side="top"
          sideOffset={6}
          collisionPadding={10}
          className="core-theme z-popover max-w-64 rounded-popover border border-border bg-popover px-3 py-2 text-caption text-popover-foreground shadow-elevation-popover"
        >
          <div className="flex flex-col">
            <span className="flex items-baseline justify-between gap-4">
              <span className="font-semibold text-foreground">Shared {LABEL[kind].toLowerCase()}</span>
              <span className="shrink-0 whitespace-nowrap tabular-nums text-text-secondary">{n}</span>
            </span>
            {hint}
          </div>
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  ) : (
    chip
  )
}

const LABEL: Record<Shared, string> = { people: 'People', entities: 'Entities', addresses: 'Addresses' }

/** "3 shared submitted addresses / 1 shared found address": the counts, each on its line. */
const rollUp = (counts: Array<[number, string, string, string]>) => {
  const lines = counts
    .filter(([n]) => n > 0)
    .map(([n, kind, one, many]) => `${n} shared ${kind} ${n === 1 ? one : many}`)
  return lines.length > 0 ? (
    <>
      {lines.map((l) => (
        <span key={l}>{l}</span>
      ))}
    </>
  ) : undefined
}

/**
 * The businesses connected to this one, as the People card reads its people:
 * one row per business — "Likely related" over its name — and what it shares
 * with this one as chips, People and Addresses with their counts. A chip opens,
 * under the row, the people or addresses shared and the roles each plays.
 *
 * Likely related: it shares people, at a 95% match or better. The rest fold
 * away under them — "Show N possible companies" — the ones that
 * share only addresses last, as they are probably neighbours, a building's
 * other tenants. With none likely related, all of them show.
 */
export const RelatedBusinesses = ({ record }: { record: BusinessRecord }) => {
  const [open, setOpen] = useState<{ i: number; kind: Shared } | null>(null)
  const [showNeighbours, setShowNeighbours] = useState(false)
  // This business's addresses, by street and ZIP: a shared address's characteristics.
  // The people the customer submitted, as the People card holds them.
  const submittedPeople = useMemo(
    () => peopleByPerson(peopleRows(record)).filter((r) => r.submitted),
    [record]
  )
  // The same person under a middle initial or not: "REED E STEINER" is Reed Steiner.
  const firstLast = (v: string) => {
    const words = v.toLowerCase().replace(/[^a-z\s]+/g, ' ').trim().split(/\s+/)
    return words.length > 1 ? `${words[0]} ${words[words.length - 1]}` : words[0]
  }
  const submittedAs = (name: string) =>
    submittedPeople.find(
      (r) =>
        nameKey(String(r.value)) === nameKey(name) ||
        sameName(String(r.value), name) ||
        firstLast(String(r.value)) === firstLast(name)
    )
  const ops = useMemo(() => operationsOf(record), [record])
  // Every address the record holds — registered agents' included, which the
  // Addresses card leaves out — under the card's own locations where it has them.
  const locations = useMemo(
    () =>
      new Map<string, Location>([
        ...record.addresses.map((a): [string, Location] => [addressKey(a.fullAddress), { ...a, sourceNames: [] }]),
        ...ops.locations.map((l): [string, Location] => [addressKey(l.fullAddress), l])
      ]),
    [record, ops]
  )
  const addressTag = (location: Location, key: string) =>
    addressSources(location, key, ops, record).chip
  const connections = record.connections ?? []
  if (connections.length === 0) return null
  // Those sharing both people and addresses first, then people, then addresses;
  // within each, the most shared first — the count is the strongest sign —
  // then the strongest match.
  const rank = (c: Connection) => {
    const parties = sharesParties(c)
    const addresses = (c.addresses ?? []).length > 0
    return parties && addresses ? 0 : parties ? 1 : 2
  }
  const rows = connections
    .map((c, i) => ({
      c,
      i,
      related: sharesParties(c) && (c.confidence ?? 0) >= LIKELY
    }))
    .sort(
      (a, b) =>
        rank(a.c) - rank(b.c) ||
        sharedCount(b.c) - sharedCount(a.c) ||
        (b.c.confidence ?? 0) - (a.c.confidence ?? 0)
    )
  const neighbours = rows.filter((r) => !r.related).length
  const shown = [
    ...rows.filter((r) => r.related),
    ...(showNeighbours ? rows.filter((r) => !r.related) : [])
  ]
  const toggle = (i: number, kind: Shared) =>
    setOpen((cur) => (cur?.i === i && cur.kind === kind ? null : { i, kind }))

  return (
    <RadixTooltip.Provider>
    <div className="border-t border-[var(--core-color-border-divider)]">
      {/* Nothing at 95% or above: said so, the weaker ones a click away. */}
      {neighbours === rows.length && (
        <div className="px-4 py-3 text-sm text-text-primary">No confident matches found</div>
      )}
      {shown.length > 0 && (
        <div
          className={cn(
            'hidden gap-x-4 border-b border-[var(--core-color-border-divider)] px-4 py-1.5 md:grid',
            neighbours === rows.length && 'border-t',
            COLUMNS
          )}
        >
          <ColumnLabel>Business</ColumnLabel>
          <ColumnLabel>Shared</ColumnLabel>
        </div>
      )}
      {shown.map(({ c, i, related: isRelated }) => {
        const people = sharedPeople(c).length
        const entities = sharedEntities(c).length
        const addresses = (c.addresses ?? []).length
        // Of what it shares, how much this business submitted and how much was found.
        const submittedPeople = sharedPeople(c).filter((p) => submittedAs(p.name)).length
        const placed = (c.addresses ?? []).map((a) => locations.get(addressKey(a.fullAddress)))
        const submittedAddresses = placed.filter((l) => l?.submitted).length
        const peopleHint = rollUp([
          [submittedPeople, 'submitted', 'person', 'people'],
          [people - submittedPeople, 'found', 'person', 'people']
        ])
        const addressHint = rollUp([
          [submittedAddresses, 'submitted', 'address', 'addresses'],
          [addresses - submittedAddresses, 'found', 'address', 'addresses']
        ])
        const confidence = typeof c.confidence === 'number' ? `${Math.round(c.confidence * 100)}% match` : null
        return (
          <Fragment key={c.id ?? i}>
            <div className={cn('grid grid-cols-1 items-start gap-x-4 gap-y-2 px-4 py-3', COLUMNS, RULE)}>
              <div className="min-w-0">
                <span className="block text-caption text-text-secondary">
                  {[
                    isRelated
                      ? 'Likely related'
                      : sharesParties(c)
                        ? 'Possibly related'
                        : (c.addresses ?? []).length === 1
                        ? 'Shared address only'
                        : 'Shared addresses only',
                    confidence
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                <span className="block text-sm font-medium text-text-primary">{c.name}</span>
              </div>
              <span className="flex flex-wrap items-center gap-1.5">
                {people > 0 && (
                  <SharedChip
                    kind="people"
                    n={people}
                    on={open?.i === i && open.kind === 'people'}
                    onToggle={() => toggle(i, 'people')}
                    hint={peopleHint}
                  />
                )}
                {entities > 0 && (
                  <SharedChip
                    kind="entities"
                    n={entities}
                    on={open?.i === i && open.kind === 'entities'}
                    onToggle={() => toggle(i, 'entities')}
                  />
                )}
                {addresses > 0 && (
                  <SharedChip
                    kind="addresses"
                    n={addresses}
                    on={open?.i === i && open.kind === 'addresses'}
                    onToggle={() => toggle(i, 'addresses')}
                    hint={addressHint}
                  />
                )}
              </span>
            </div>
            {open?.i === i && (
              <SharedList
                c={c}
                kind={open.kind}
                locations={locations}
                submittedAs={submittedAs}
                domesticState={record.formation?.state}
                addressTag={addressTag}
                match={partialMatchOf(record)}
              />
            )}
          </Fragment>
        )
      })}
      {neighbours > 0 && (
        <div className="flex justify-start border-t border-[var(--core-color-border-divider)] px-2 py-2">
          <ActionButton variant="quiet" size="compact" onClick={() => setShowNeighbours(!showNeighbours)}>
            {showNeighbours
              ? `Hide possible ${neighbours === 1 ? 'business' : 'businesses'}`
              : `Show ${neighbours} possible ${neighbours === 1 ? 'business' : 'businesses'}`}
          </ActionButton>
        </div>
      )}
    </div>
    </RadixTooltip.Provider>
  )
}
