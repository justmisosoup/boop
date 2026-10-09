import { useState, type ReactNode } from 'react'
import * as RadixTooltip from '@radix-ui/react-tooltip'
import { Building2, House, Landmark, LayoutGrid, Table2 } from 'lucide-react'

import { ActionButton, Hint, MetaChip, SegmentedControl, SegmentedControlItem } from '@/core'

import { StatusDot } from '../StatusDot'

import { filingsListing } from '../../lib/attributes'
import type { BusinessRecord } from '../../lib/deriveResults'
import { licencesAt, locationBand, type Location, type Operations } from '../../lib/operations'
import { docCard } from '../../lib/sourceCards'
import { cn } from '../../utils/twUtils'
import { AttributeCells, type AttributeCell } from '../AttributeGrid'
import { AttributeSources } from '../Provenance'

const titleCase = (n: string) => n.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
const REGISTRY_LABELS = new Set(['State registration', 'registration'])
/** The rows shown before "Show N more". */

const isAgents = (a: Location) =>
  Boolean(a.isRegisteredAgent || a.labels.includes('registered_agent'))

/** The roles the filings give the address — mailing, physical, primary. */
const addressRoles = (a: Location): string[] => [
  ...new Set(
    (a.sourceRefs ?? [])
      .flatMap((r) => (r.metadata as { labels?: string[] } | undefined)?.labels ?? [])
      .filter((x) => x !== 'registered_agent')
  )
]

/** "Mailing, Primary, Physical", or "Registered agent"; nothing where no filing says. */
const addressType = (a: Location): string | null => {
  const roles = addressRoles(a).map((r) => r.replace(/^./, (c) => c.toUpperCase()))
  if (roles.length > 0) return roles.join(', ')
  return isAgents(a) ? 'Registered agent' : null
}

/**
 * Who attests the address: Submitted (verified where a filing or another
 * record lists it), the filings, every other record, and the licence practised
 * from it — one chip, as the report's cells cite a value.
 */
export const addressSources = (
  a: Location,
  key: string,
  ops: Operations,
  record: BusinessRecord,
  onJumpToSource?: (cardId: string) => void
) => {
  const filings = filingsListing(record, a.fullAddress, 'addresses')
  /* The website, where the web address check found the submitted office on
     it: the check is the association, so the site is a source of the address. */
  const webSaid =
    record.reviewTasks.find((t) => t.key === 'web_address_verification')?.subLabel ?? ''
  const onSite =
    a.submitted && /verified|match/i.test(webSaid) && !/unverified|mismatch/i.test(webSaid)
  const others = [
    ...a.sourceNames.filter((n) => !REGISTRY_LABELS.has(n)),
    ...(onSite && record.website?.url ? ['Website'] : [])
  ]
  const licences = licencesAt(ops.licence, a.fullAddress)
  const verified = filings.length > 0 || others.length > 0
  const chip =
    a.submitted || verified || licences.length > 0 ? (
      <AttributeSources
        submitted={a.submitted ? { verified } : undefined}
        plainClaim
        sources={others}
        registrations={filings}
        domesticState={record.formation?.state}
        refs={a.sourceRefs?.filter((r) => r.type !== 'registration')}
        href={onSite ? (record.website?.url ?? undefined) : undefined}
        extra={licences.map((l) => ({
          id: `${key}-${l.id}`,
          label: l.registry,
          domain: l.registry,
          title: `NPI ${l.number}`,
          onSelect: onJumpToSource ? () => onJumpToSource(docCard(l.id)) : undefined,
          annotation: titleCase(l.holder)
        }))}
        onJumpToSource={onJumpToSource}
      />
    ) : null
  return { chip, verified, filings, licences }
}

export type AddressView = 'table' | 'grid'

/** The card's display switch: the same addresses as a table or a grid. */
export const AddressViewToggle = ({
  value,
  onChange
}: {
  value: AddressView
  onChange: (view: AddressView) => void
}) => (
  <SegmentedControl
    size="sm"
    value={value}
    onValueChange={(v) => v && onChange(v as AddressView)}
    aria-label="Address display"
  >
    <SegmentedControlItem
      value="table"
      aria-label="Table"
      className="!px-2"
      icon={<Table2 aria-hidden="true" size={14} strokeWidth={1.75} />}
    />
    <SegmentedControlItem
      value="grid"
      aria-label="Grid"
      className="!px-2"
      icon={<LayoutGrid aria-hidden="true" size={14} strokeWidth={1.75} />}
    />
  </SegmentedControl>
)

const COLUMNS = 'md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]'
const ColumnLabel = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span
    className={cn(
      'text-xs font-medium text-[var(--core-color-table-header-text)]',
      className
    )}
  >
    {children}
  </span>
)

/** The icon is the property: a house where USPS says residential, an office
 *  where commercial; with no property type, an agent's address its landmark. */
const PropertyIcon = ({ a }: { a: Location }) => {
  const property = a.propertyType ? titleCase(a.propertyType) : null
  const Icon = /residential/i.test(property ?? '')
    ? House
    : property
      ? Building2
      : isAgents(a)
        ? Landmark
        : Building2
  const label = property ?? (isAgents(a) ? 'Registered agent' : null)
  const tile =
    'flex size-8 shrink-0 items-center justify-center rounded-control bg-[var(--core-color-surface-subtle)] text-text-secondary'
  if (!label)
    return (
      <span className={tile}>
        <Icon aria-hidden="true" size={16} strokeWidth={1.5} />
      </span>
    )
  return (
    <Hint content={label} asChild>
      <span
        // biome-ignore lint/a11y/noNoninteractiveTabindex: focusable so the hint is reachable by keyboard
        tabIndex={0}
        aria-label={label}
        className={cn(
          tile,
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
        )}
      >
        <Icon aria-hidden="true" size={16} strokeWidth={1.5} />
      </span>
    </Hint>
  )
}

/** The submitted address, after it: the insights sidebar's own mark — a green
 *  check where a record lists it, the alert where none does. */
const VerifiedIcon = ({ a, verified }: { a: Location; verified: boolean }) =>
  // Verified, the Verified chip under it says so; only the amber mark stays.
  a.submitted && !verified ? (
    <span role="img" aria-label="Unverified" className="flex shrink-0">
      <StatusDot intent="warning" />
    </span>
  ) : null

/** Over the address: what the records list it as — "Mailing, Primary, Physical". */
const TypeLine = ({ a, chip }: { a: Location; chip?: ReactNode }) => {
  const type = addressType(a)
  // Its chip beside the label — Verified, or where a found address is from.
  return type || chip ? (
    <span className="flex flex-wrap items-center gap-1.5 text-caption text-text-secondary">
      {type}
      {chip}
    </span>
  ) : null
}

/** Under a submitted address that matched only in part: the address it matched. */
const MatchedLine = ({ match, to }: { match?: string; to?: string }) =>
  match && to ? (
    <span className="mt-0.5 block text-caption text-text-secondary">
      {match}: {to}
    </span>
  ) : null

/** Under the address: the records that list it — "[Submitted +27]". */
const SubLine = ({ chip }: { chip: ReactNode }) =>
  chip ? (
    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-caption text-text-secondary">
      {chip}
    </span>
  ) : null

/** Whether the post reaches it, what the property is, and how many businesses share it. */
/** What each characteristic means, for the reader who hovers it. */

/** A characteristic chip with what it means on hover, in the registrations' tooltip. */
export const Explained = ({ tip, children }: { tip: string; children: ReactNode }) => (
  <RadixTooltip.Root delayDuration={200}>
    <RadixTooltip.Trigger asChild>
      <span tabIndex={0} className="flex rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {children}
      </span>
    </RadixTooltip.Trigger>
    <RadixTooltip.Portal>
      <RadixTooltip.Content
        side="top"
        sideOffset={6}
        collisionPadding={10}
        className="core-theme z-popover max-w-64 rounded-popover border border-border bg-popover px-3 py-2 text-caption text-popover-foreground shadow-elevation-popover"
      >
        {tip}
      </RadixTooltip.Content>
    </RadixTooltip.Portal>
  </RadixTooltip.Root>
)

/** How the submitted address matched, where it matched only in part: "Similar
 *  match", "Approximate match", "Incomplete match". Exact or none: nothing. */
export const partialMatchOf = (record: BusinessRecord): string | undefined => {
  const said = record.reviewTasks.find((t) => t.key === 'address_verification')?.subLabel ?? ''
  return /similar|approximate|incomplete/i.test(said) ? said.charAt(0).toUpperCase() + said.slice(1).toLowerCase() : undefined
}

/** Miles between two points, as the crow flies. */
const miles = (a: [number, number], b: [number, number]) => {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b[0] - a[0])
  const dLng = rad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2
  return 3958.8 * 2 * Math.asin(Math.sqrt(h))
}

/**
 * The address the submitted one matched only in part, where the check does not
 * name it: the nearest other address on the record within half a mile — the
 * approximate check reports "within 0.2 miles"; a similar match can sit a
 * little further, 2775 Greene 707 Rd for a submitted 2755 — 2622 SE Clayton
 * St for a submitted 2612.
 */
export const partialMatchAddressOf = (record: BusinessRecord, submitted: Location): string | undefined => {
  if (!partialMatchOf(record) || !submitted.latitude || !submitted.longitude) return undefined
  const at: [number, number] = [submitted.latitude, submitted.longitude]
  const near = record.addresses
    .filter((a) => !a.submitted && a.latitude && a.longitude && a.fullAddress !== submitted.fullAddress)
    .map((a) => ({ a, d: miles(at, [a.latitude as number, a.longitude as number]) }))
    .filter(({ d }) => d <= 0.5)
    .sort((x, y) => x.d - y.d)[0]
  return near?.a.fullAddress
}

/** Whether the post reaches it, what the property is, and how many businesses
 *  share it — each chip saying what it means when pointed at — and, flagged,
 *  what makes it less than an office: a mailbox, a registered agent, or a
 *  submitted address that matched only in part. */
export const Relevance = ({ a, match, matchedTo }: { a: Location; match?: string; matchedTo?: string }) => {
  const band = locationBand(a.locationCount)?.label.replace(/ uses? this location$/, '')
  return (
    <RadixTooltip.Provider>
      <span className="flex flex-wrap items-center gap-1.5">
        {a.deliverable != null && (
          <Explained
            tip={
              a.deliverable ? 'USPS can deliver to this address.' : 'USPS can’t deliver to this address.'
            }
          >
            <MetaChip tone={a.deliverable ? 'neutral' : 'warning'} size="compact">
              {a.deliverable ? 'Deliverable' : 'Undeliverable'}
            </MetaChip>
          </Explained>
        )}
        {a.propertyType && (
          <Explained tip={`USPS recognises this as a ${titleCase(a.propertyType).toLowerCase()} address.`}>
            <MetaChip tone="neutral" size="compact">
              {titleCase(a.propertyType)}
            </MetaChip>
          </Explained>
        )}
        {match && a.submitted && (
          <Explained
            tip={
              matchedTo
                ? `The submitted address is a ${match.toLowerCase()} to ${matchedTo}, not an exact one.`
                : `The submitted address is a ${match.toLowerCase()} to the address on record, not an exact one.`
            }
          >
            <MetaChip tone="warning" size="compact">
              {match}
            </MetaChip>
          </Explained>
        )}
        {a.cmra && (
          <Explained tip="USPS recognises this as a commercial mail receiving agency — a private mailbox, not a place the business works from.">
            <MetaChip tone="warning" size="compact">
              CMRA
            </MetaChip>
          </Explained>
        )}
        {a.isRegisteredAgent && (
          <Explained tip="A registered agent’s address — it takes legal mail for many businesses, not where this one works.">
            <MetaChip tone="warning" size="compact">
              Registered agent
            </MetaChip>
          </Explained>
        )}
        {band && (
          <Explained tip={`${a.locationCount === 1 ? 'Used' : 'Shared'} by ${band}.`}>
            <MetaChip tone="neutral" size="compact">
              {band}
            </MetaChip>
          </Explained>
        )}
      </span>
    </RadixTooltip.Provider>
  )
}

type AddressProps = {
  ops: Operations
  record: BusinessRecord
  onJumpToSource?: (cardId: string) => void
}

const AddressRow = ({
  a,
  rowKey,
  ops,
  record,
  onJumpToSource
}: AddressProps & { a: Location; rowKey: string }) => {
  const { chip, verified } = addressSources(a, rowKey, ops, record, onJumpToSource)

  return (
    <div className="bg-[image:var(--dash-rule-x)] bg-[length:100%_1px] bg-[position:left_bottom] bg-no-repeat last:bg-none">
      <div className={cn('grid grid-cols-1 items-start gap-x-4 gap-y-2 px-4 py-3', COLUMNS)}>
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <TypeLine a={a} chip={!a.submitted || verified ? chip : undefined} />
            <div className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-text-primary">
              <span className="truncate" title={a.fullAddress}>
                {a.fullAddress}
              </span>
              <VerifiedIcon a={a} verified={verified} />
            </div>
            {a.submitted && !verified && <SubLine chip={chip} />}
            {a.submitted && <MatchedLine match={partialMatchOf(record)} to={partialMatchAddressOf(record, a)} />}
          </div>
        </div>
        <Relevance
          a={a}
          match={partialMatchOf(record)}
          matchedTo={a.submitted ? partialMatchAddressOf(record, a) : undefined}
        />
      </div>
    </div>
  )
}

/** The addresses folded away under the submitted, verified ones: the ones found. */
const ShowFound = ({
  total,
  shown,
  expanded,
  onToggle
}: {
  total: number
  shown: number
  expanded: boolean
  onToggle: () => void
}) => {
  const found = total - shown
  if (found <= 0) return null
  const noun = found === 1 ? 'address' : 'addresses'
  return (
    <div
      className={cn(
        'flex justify-start px-2 py-2',
        // Nothing above it while folded: the card's own rule is the top edge.
        (shown > 0 || expanded) && 'border-t border-[var(--core-color-border-divider)]'
      )}
    >
      <ActionButton variant="quiet" size="compact" onClick={onToggle}>
        {expanded ? `Hide found ${noun}` : `Show ${found} found ${noun}`}
      </ActionButton>
    </div>
  )
}

const TableView = ({ rows, lead, ...props }: AddressProps & { rows: Location[]; lead: number }) => {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? rows : rows.slice(0, lead)
  return (
    <>
      {shown.length > 0 && (
      <div
        className={cn(
          'hidden gap-x-4 border-b border-[var(--core-color-border-divider)] px-4 py-1.5 md:grid',
          COLUMNS
        )}
      >
        <ColumnLabel>Addresses</ColumnLabel>
        <ColumnLabel>Characteristics</ColumnLabel>
      </div>
      )}
      {shown.map((a, i) => (
        <AddressRow key={`${a.fullAddress}-${i}`} a={a} rowKey={`address-${i}`} {...props} />
      ))}
      <ShowFound
        total={rows.length}
        shown={lead}
        expanded={expanded}
        onToggle={() => setExpanded(!expanded)}
      />
    </>
  )
}

/** Each address as a cell of the report's grid: what the filings call it as its label,
 *  its sources beside it, the address, its relevance under it. */
const GridView = ({
  rows,
  lead,
  ops,
  record,
  onJumpToSource
}: AddressProps & { rows: Location[]; lead: number }) => {
  const [expanded, setExpanded] = useState(false)
  const items: AttributeCell[] = (expanded ? rows : rows.slice(0, lead)).map((a, i) => {
    const { chip, verified } = addressSources(a, `address-${i}`, ops, record, onJumpToSource)
    return {
      key: `${a.fullAddress}-${i}`,
      label: a.fullAddress,
      // What the records list it as, over the address; who attests it, under.
      labelNode: <TypeLine a={a} chip={!a.submitted || verified ? chip : undefined} />,
      values: [
        {
          value: (
            <span className="flex flex-col">
              <span className="inline-flex items-center gap-1.5 font-medium">
                {a.fullAddress}
                <VerifiedIcon a={a} verified={verified} />
              </span>
              {a.submitted && !verified && <SubLine chip={chip} />}
              {a.submitted && <MatchedLine match={partialMatchOf(record)} to={partialMatchAddressOf(record, a)} />}
            </span>
          ),
          note: (
            <Relevance
              a={a}
              match={partialMatchOf(record)}
              matchedTo={a.submitted ? partialMatchAddressOf(record, a) : undefined}
            />
          )
        }
      ]
    }
  })
  return (
    <>
      {items.length > 0 && (
        <div className="overflow-hidden">
          <AttributeCells items={items} columns={2} className="-mb-px" />
        </div>
      )}
      <ShowFound
        total={rows.length}
        shown={lead}
        expanded={expanded}
        onToggle={() => setExpanded(!expanded)}
      />
    </>
  )
}

/**
 * Every address on the record, as the viewer chose to see them: a table — the
 * address and its delivery line, whether it was submitted and verified, what
 * the property is — or a grid of cells. (The app also offers its Google map;
 * the prototype has no Maps key, so it has no map view.)
 */
export const AddressTable = ({
  view = 'table',
  ...props
}: AddressProps & { view?: AddressView }) => {
  // Submitted and verified first — the only ones shown until the reader asks
  // for the rest — then the other submitted ones, then the ones found.
  const { locations } = props.ops
  const isLead = (a: Location) =>
    a.submitted && addressSources(a, 'lead', props.ops, props.record).verified
  const leads = locations.filter(isLead)
  const rows = [
    ...leads,
    ...locations.filter((a) => a.submitted && !isLead(a)),
    ...locations.filter((a) => !a.submitted)
  ]
  if (rows.length === 0) return null
  // Every submitted address shows — verified first, then one that matched only
  // in part or not at all — and with none submitted, a lone address shows.
  const submittedCount = locations.filter((a) => a.submitted).length
  const lead = submittedCount || (rows.length === 1 ? 1 : 0)
  return (
    <div className="border-t border-[var(--core-color-border-divider)]">
      {view === 'grid' ? (
        <GridView rows={rows} lead={lead} {...props} />
      ) : (
        <TableView rows={rows} lead={lead} {...props} />
      )}
    </div>
  )
}
