import { useMemo, type ReactNode } from 'react'
import { ArrowUpRight, Check, TriangleAlert, X } from 'lucide-react'

import { ChatSourceChip, MetaChip } from '@/core'

import type { BusinessRecord } from '../../lib/deriveResults'
import { filingsListing, provenanceList } from '../../lib/attributes'
import { sameName } from '../../lib/registrationStatus'
import { docCard } from '../../lib/sourceCards'
import {
  operationsOf,
  type FmcsaRegistration,
  type Operations,
  type StateLicence
} from '../../lib/operations'
import { AttributeCells, type AttributeCell } from '../AttributeGrid'
import { IndustryTable } from '../IndustryTable'
import { AttributeSources, SubmittedChip } from '../Provenance'
import { AddressTable } from './AddressTable'
import { Strip } from './Strip'

const icon = { 'aria-hidden': true, size: 12, strokeWidth: 2, className: 'shrink-0' } as const
const titleCase = (n: string) => n.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
const absent = (text: string) => <span className="text-text-secondary">{text}</span>

/**
 * What USPS and the record say of an address, on one quiet line: the property
 * type, deliverability, a mail drop, a registered agent's, and how many
 * businesses share it. Our readings, under the value rather than in it, and
 * ungraded — the report does not colour an address.
 */
/** A registry record as its source chip: the register, opening its page. */
const RegistryChip = ({
  id,
  label,
  title,
  url,
  annotation,
  onSelect
}: {
  id: string
  label: string
  title: string
  url?: string | null
  annotation: string
  onSelect?: () => void
}) => (
  <ChatSourceChip
    sources={[
      {
        id,
        label,
        domain: label,
        title,
        // To the register's card in Sources, where the whole record and its
        // link are, as every record chip follows; out to the page only where
        // there is no card to go to.
        url: onSelect ? undefined : (url ?? undefined),
        onSelect,
        annotation,
        badge:
          !onSelect && url ? (
            <ArrowUpRight
              aria-label="Opens in a new tab"
              size={12}
              strokeWidth={2}
              className="text-text-secondary"
            />
          ) : undefined
      }
    ]}
  />
)

/** The licence the industry requires, and what the register holds. */
/** A source label that is the FMCSA's own, or the registry chip's. */
const NOT_CORROBORATING =
  /^(state registration|registration|submitted by the customer|submitted|fmcsa registration|fmcsa)$/i
const streetZip = (a: string) =>
  `${(a.split(',')[0] ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()}|${(a.match(/\b(\d{5})(?:-\d{4})?\b/) ?? [])[1] ?? ''}`

/**
 * What else on the record states a value the FMCSA states — the submitted
 * name or address, the filings that carry it, any other record — as the
 * chips the Formation grid puts beside a field: Submitted (verified when a
 * source agrees), then the sources.
 */
const corroboration = (
  held: Array<{
    submitted?: boolean
    sources?: string[]
    sourceRefs?: BusinessRecord['addresses'][number]['sourceRefs']
  }>,
  filings: BusinessRecord['registrations'],
  record: BusinessRecord,
  onJumpToSource?: (cardId: string) => void
): ReactNode => {
  const submitted = held.some((h) => h.submitted)
  const others = [...new Set(held.flatMap((h) => provenanceList(h)))].filter(
    (n) => !NOT_CORROBORATING.test(n)
  )
  const refs = held
    .flatMap((h) => h.sourceRefs ?? [])
    .filter((r) => r.type !== 'registration' && !/fmcsa/i.test(r.type))
  if (!submitted && filings.length === 0 && others.length === 0) return undefined
  // One chip: the customer's claim, where it is theirs, with the filings and
  // records that verify it under it.
  return (
    <AttributeSources
      sources={others}
      registrations={filings}
      domesticState={record.formation?.state}
      refs={refs}
      submitted={submitted ? { verified: filings.length > 0 || others.length > 0 } : undefined}
      onJumpToSource={onJumpToSource}
    />
  )
}

/**
 * An FMCSA registration in the grid, field for field as the Sources card
 * reads it — business name, DBA, USDOT number, each address. The FMCSA chip
 * sits on the USDOT number, the FMCSA's own fact, and follows to that card,
 * where the record link is. The name and each address carry what else on the
 * record states them: the submission, the filings, any other record.
 */
const fmcsaCells = (
  f: FmcsaRegistration,
  record: BusinessRecord,
  onJumpToSource?: (cardId: string) => void
): AttributeCell[] => {
  const names = (record.names ?? []).filter((n) => sameName(n.name, f.legalName))
  const nameFilings = record.registrations.filter((g) => sameName(g.name, f.legalName))
  return [
    {
      key: `${f.id}-name`,
      label: 'Business name',
      badge: f.legalName ? corroboration(names, nameFilings, record, onJumpToSource) : undefined,
      values: [{ value: f.legalName ?? absent('Not provided') }]
    },
    ...(f.dbaName
      ? [{ key: `${f.id}-dba`, label: 'DBA name', values: [{ value: f.dbaName }] }]
      : []),
    {
      key: `${f.id}-dot`,
      label: 'USDOT number',
      badge: (
        <RegistryChip
          id={f.id}
          label="FMCSA"
          title={`USDOT ${f.dotNumber ?? ''}`}
          url={f.sourceUrl}
          annotation="Company snapshot"
          onSelect={onJumpToSource ? () => onJumpToSource(docCard(f.id)) : undefined}
        />
      ),
      values: [{ value: f.dotNumber ?? absent('Not provided') }]
    },
    ...f.addresses.map((addr, i) => {
      const held = record.addresses.filter((x) => streetZip(x.fullAddress) === streetZip(addr))
      const filings = [
        ...new Set(held.flatMap((x) => filingsListing(record, x.fullAddress, 'addresses')))
      ]
      return {
        key: `${f.id}-addr-${i}`,
        label: 'Address',
        span: 'full' as const,
        badge: corroboration(held, filings, record, onJumpToSource),
        values: [{ value: addr }]
      }
    })
  ]
}

const licenceCell = (
  ops: Operations,
  onJumpToSource?: (cardId: string) => void
): AttributeCell | undefined => {
  const l = ops.licence
  if (!l.required) return undefined
  // Under its own strip, so the cell names the record, not the strip again.
  const base = {
    key: 'licence',
    label: l.registry === 'FMCSA' ? 'FMCSA record' : 'NPI Registry record',
    span: 'full' as const
  }
  if (l.registry === 'none')
    return {
      ...base,
      values: [{ value: absent(`Required for ${l.profession}; no public register checked`) }]
    }
  if (l.found.length === 0)
    return {
      ...base,
      values: [
        {
          value: absent(
            l.registry === 'NPI'
              ? 'None found in the NPI Registry for the people submitted'
              : 'No FMCSA registration on the record'
          )
        }
      ]
    }
  if (l.registry === 'FMCSA')
    return {
      ...base,
      badge: (
        <span className="flex flex-wrap items-center gap-1">
          {l.found.map((f) => (
            <RegistryChip
              key={f.id}
              id={f.id}
              label="FMCSA"
              title={`USDOT ${f.dotNumber ?? ''}`}
              url={f.sourceUrl}
              annotation="Company snapshot"
              onSelect={onJumpToSource ? () => onJumpToSource(docCard(f.id)) : undefined}
            />
          ))}
        </span>
      ),
      values: l.found.map((f) => ({
        key: f.id,
        value: `USDOT ${f.dotNumber ?? '—'}`,
        note: (
          <span className="flex flex-col gap-0.5 text-caption text-text-secondary">
            {f.legalName && <span>{f.legalName}</span>}
            {f.addresses.map((x) => (
              <span key={x}>{x}</span>
            ))}
          </span>
        )
      }))
    }
  return {
    ...base,
    badge: (
      <span className="flex flex-wrap items-center gap-1">
        {l.found.map((x) => (
          <RegistryChip
            key={x.id}
            id={x.id}
            label={x.registry}
            title={`NPI ${x.number}`}
            url={x.sourceUrl}
            annotation={x.profession}
            onSelect={onJumpToSource ? () => onJumpToSource(docCard(x.id)) : undefined}
          />
        ))}
      </span>
    ),
    values: l.found.map((x) => ({
      key: x.id,
      value: [x.holder, x.credential].filter(Boolean).join(', '),
      note: (
        <span className="flex flex-col gap-0.5 text-caption text-text-secondary">
          <span>
            {x.profession}
            {x.licenseState && x.licenseNumber && ` · ${x.licenseState} licence ${x.licenseNumber}`}
            {x.status && ` · ${x.status}`}
          </span>
          {x.address && <span>{x.address}</span>}
        </span>
      )
    }))
  }
}

/** The app's licence-type text: `general_contractor` as General Contractor. */
const licenceTypeText = (t?: string) =>
  (t ?? '').split('_').filter(Boolean).map(titleCase).join(' ')

/** Whether a source's status reads active. */
const isActive = (s?: string) => /active/i.test(s ?? '') && !/inactive/i.test(s ?? '')

/**
 * A state licence, field for field as the app's licence card reads it
 * (`BusinessHome/Sources/ProfessionalLicenseCard.tsx`) — business name,
 * licence number, then each address — with the status the record states. The
 * licence chip sits on the number, the licence's own fact, and follows to its
 * card in Sources; the name and an address carry Submitted when they are the
 * customer's.
 */
/** The licence as a source entry, for the claim chip it verifies. */
const licenceSource = (l: StateLicence, onJumpToSource?: (cardId: string) => void) => ({
  id: `${l.id}-licence`,
  label: 'Professional license',
  domain: 'Professional license',
  title: [l.state, 'licence', l.number].filter(Boolean).join(' '),
  annotation: `${licenceTypeText(l.type)} licence`.trim(),
  onSelect: onJumpToSource ? () => onJumpToSource(docCard(l.id)) : undefined
})

const stateLicenceCells = (
  l: StateLicence,
  record: BusinessRecord,
  onJumpToSource?: (cardId: string) => void
): AttributeCell[] => [
  ...l.names.map((n, i) => ({
    key: `${l.id}-name-${i}`,
    label: 'Business name',
    badge: record.names?.some((x) => x.submitted && sameName(x.name, n)) ? (
      <SubmittedChip
        verified
        sources={[licenceSource(l, onJumpToSource)]}
        onJumpToSource={onJumpToSource}
      />
    ) : undefined,
    values: [{ value: n }]
  })),
  {
    key: `${l.id}-number`,
    label: 'Licence number',
    badge: (
      <RegistryChip
        id={l.id}
        label="Professional license"
        title={[l.state, 'licence', l.number].filter(Boolean).join(' ')}
        annotation={`${licenceTypeText(l.type)} licence`.trim()}
        onSelect={onJumpToSource ? () => onJumpToSource(docCard(l.id)) : undefined}
      />
    ),
    values: [{ value: l.number ?? absent('Not provided') }]
  },
  ...(l.status
    ? [{ key: `${l.id}-status`, label: 'Status', values: [{ value: titleCase(l.status) }] }]
    : []),
  ...l.addresses.map((a, i) => ({
    key: `${l.id}-addr-${i}`,
    label: 'Address',
    span: 'full' as const,
    badge: record.addresses.some((x) => x.submitted && x.fullAddress === a) ? (
      <SubmittedChip
        verified
        sources={[licenceSource(l, onJumpToSource)]}
        onJumpToSource={onJumpToSource}
      />
    ) : undefined,
    values: [{ value: a }]
  }))
]

/** A source label the registry chip already names. */

/** Whether each strip has anything to draw, so a card can be left out rather than empty. */
export const industryDrawn = (ops: Operations) =>
  ops.industry.table.length > 0 && ops.industry.prohibited !== 'unknown'
export const licencesDrawn = (ops: Operations) =>
  ops.licence.required || ops.stateLicences.length > 0
export const locationsDrawn = (ops: Operations) => ops.locations.length > 0

/**
 * What the business does: what the Prohibited scheme made of it — one tile,
 * opening every classification (NAICS, MCC, SIC) as the dashboard's table —
 * with the lead classification, in words, beside the verdict.
 */
export const IndustryStrip = ({ ops }: { ops: Operations }) => {
  const { industry } = ops
  if (!industryDrawn(ops)) return null
  return (
    <Strip
      label="Industry"
      hideLabel
      aside={industry.lead?.name}
      tiles={[
        industry.prohibited === 'flagged'
          ? {
              key: 'all',
              chip: (
                <MetaChip tone="danger" size="compact">
                  <TriangleAlert {...icon} />
                  Prohibited
                  {industry.flagged.length > 1 && (
                    <span className="tabular-nums">{industry.flagged.length}</span>
                  )}
                </MetaChip>
              )
            }
          : {
              key: 'all',
              chip: (
                <MetaChip tone="success" size="compact">
                  <Check {...icon} />
                  Non-prohibited
                </MetaChip>
              )
            }
      ]}
      detail={() => <IndustryTable rows={industry.table} />}
    />
  )
}

/**
 * The licences the business practises under: the one its industry requires,
 * as the register holds it — a tile opening the record, or an absence as a
 * statement — then each state licence on the record, opening its fields.
 */
export const LicenceStrip = ({
  ops,
  record,
  onJumpToSource
}: {
  ops: Operations
  record: BusinessRecord
  onJumpToSource?: (cardId: string) => void
}) => {
  const lic = ops.licence
  const licence = licenceCell(ops, onJumpToSource)
  const required: Array<{ key: string; chip: ReactNode; static?: boolean }> =
    !lic.required || !licence
      ? []
      : lic.registry === 'none'
        ? [
            {
              key: 'none',
              static: true,
              chip: (
                <MetaChip tone="neutral" size="compact">
                  Required · no public register checked
                </MetaChip>
              )
            }
          ]
        : lic.found.length === 0
          ? [
              {
                key: 'missing',
                static: true,
                chip: (
                  <MetaChip tone="danger" size="compact">
                    <X {...icon} />
                    {lic.registry === 'NPI'
                      ? 'None found in the NPI Registry'
                      : 'No FMCSA registration'}
                  </MetaChip>
                )
              }
            ]
          : lic.registry === 'FMCSA'
            ? lic.found.map((f) => ({
                key: f.id,
                chip: (
                  <MetaChip tone="success" size="compact">
                    <Check {...icon} />
                    USDOT {f.dotNumber}
                  </MetaChip>
                )
              }))
            : lic.found.map((x) => ({
                key: x.id,
                chip: (
                  <MetaChip tone="success" size="compact">
                    <Check {...icon} />
                    {[titleCase(x.holder), x.credential].filter(Boolean).join(', ')}
                  </MetaChip>
                )
              }))
  const tiles = [
    ...required,
    ...ops.stateLicences.map((l) => ({
      key: `state-licence:${l.id}`,
      chip: (
        <MetaChip tone={isActive(l.status) ? 'success' : 'neutral'} size="compact">
          {isActive(l.status) && <Check {...icon} />}
          {[l.state, licenceTypeText(l.type), 'licence'].filter(Boolean).join(' ')}
        </MetaChip>
      )
    }))
  ]
  if (tiles.length === 0) return null
  return (
    <Strip
      label="Professional licence"
      tiles={tiles}
      detail={(key) => {
        const state = ops.stateLicences.find((l) => `state-licence:${l.id}` === key)
        if (state)
          return (
            <AttributeCells
              items={stateLicenceCells(state, record, onJumpToSource)}
              className="-mb-px"
            />
          )
        const f =
          lic.required && lic.registry === 'FMCSA' ? lic.found.find((x) => x.id === key) : undefined
        return (
          <AttributeCells
            items={f ? fmcsaCells(f, record, onJumpToSource) : licence ? [licence] : []}
            className="-mb-px"
          />
        )
      }}
    />
  )
}

/** Every address on the record, as a table — the Addresses card's body. */
export const LocationsStrip = AddressTable

/**
 * What the business does, where, and whether it is allowed to — the three
 * strips together, for anything that still wants them as one body. The
 * grouped report draws each on its own card.
 */
export const OperationsBody = ({
  record,
  onJumpToSource
}: {
  record: BusinessRecord
  onJumpToSource?: (cardId: string) => void
}) => {
  const ops = useMemo(() => operationsOf(record), [record])
  return (
    <div className="border-b border-[var(--core-color-border-divider)]">
      <IndustryStrip ops={ops} />
      <LicenceStrip ops={ops} record={record} onJumpToSource={onJumpToSource} />
      <LocationsStrip ops={ops} record={record} onJumpToSource={onJumpToSource} />
    </div>
  )
}
