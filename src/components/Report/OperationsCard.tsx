import { useMemo, type ReactNode } from 'react'
import { ArrowUpRight, Check, TriangleAlert, X } from 'lucide-react'

import { ChatSourceChip, MetaChip } from '@/core'

import type { BusinessRecord } from '../../lib/deriveResults'
import { filingsListing } from '../../lib/attributes'
import { namedCard } from '../../lib/sourceCards'
import { licencesAt, locationBand, operationsOf, type Location, type Operations } from '../../lib/operations'
import { cn } from '../../utils/twUtils'
import { AttributeCells, type AttributeCell } from '../AttributeGrid'
import { IndustryTable } from '../IndustryTable'
import { AttributeSources, SubmittedChip } from '../Provenance'
import { Strip } from './Strip'

const icon = { 'aria-hidden': true, size: 12, strokeWidth: 2, className: 'shrink-0' } as const
/** USPS's city abbreviations, written out so one city is one tile. */
const CITY_ABBR: Record<string, string> = { cty: 'City', hts: 'Heights', mt: 'Mount', ft: 'Fort', spgs: 'Springs', jct: 'Junction', vlg: 'Village', twp: 'Township' }
/** "San Francisco, CA" from a full address — "Salt Lake Cty" read as Salt Lake City. */
const placeOf = (a: Location) => {
  const parts = a.fullAddress.split(',').map((x) => x.trim())
  const raw = parts.length >= 3 ? parts[parts.length - 2] : parts[1]
  const city = raw
    ?.split(/\s+/)
    .map((w) => CITY_ABBR[w.toLowerCase()] ?? w)
    .join(' ')
  return city ? `${city}, ${a.state}` : (a.state ?? '')
}
const titleCase = (n: string) => n.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
const absent = (text: string) => <span className="text-text-secondary">{text}</span>

/**
 * What USPS and the record say of an address, on one quiet line: the property
 * type, deliverability, a mail drop, a registered agent's, and how many
 * businesses share it. Our readings, under the value rather than in it, and
 * ungraded — the report does not colour an address.
 */
const addressLine = (a: Location): ReactNode => {
  const band = locationBand(a.locationCount)
  // Deliverable · Residential · how many businesses share it. No "USPS ·"
  // prefix: the readings are the line, not their source. An address the
  // post cannot reach is the one reading drawn red.
  // The role the filing gave the address — mailing, physical, primary — read
  // from the registration references that carry it.
  const roles = [...new Set((a.sourceRefs ?? []).flatMap((r) => (r.metadata as { labels?: string[] } | undefined)?.labels ?? []))]
    .filter((x) => x !== 'registered_agent')
    .map((x) => `${x.replace(/^./, (c) => c.toUpperCase())} address`)
  const rest = [
    ...roles,
    a.propertyType && a.propertyType.toLowerCase().replace(/^./, (c) => c.toUpperCase()),
    a.cmra && 'Commercial mail receiving agency',
    (a.isRegisteredAgent || a.labels.includes('registered_agent')) && 'Registered agent address',
    band?.label
  ].filter(Boolean) as string[]
  const delivery =
    a.deliverable === true ? (
      'Deliverable'
    ) : a.deliverable === false ? (
      <span className="inline-flex items-center gap-1 text-[var(--core-color-text-danger)]">
        <X {...icon} />
        Not deliverable
      </span>
    ) : null
  if (!delivery && rest.length === 0) return null
  return (
    <>
      {delivery}
      {delivery && rest.length > 0 && ' · '}
      {rest.join(' · ')}
    </>
  )
}

/** A registry record as its source chip: the register, opening its page. */
const RegistryChip = ({ id, label, title, url, annotation, onSelect }: { id: string; label: string; title: string; url?: string | null; annotation: string; onSelect?: () => void }) => (
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
        badge: !onSelect && url ? <ArrowUpRight aria-label="Opens in a new tab" size={12} strokeWidth={2} className="text-text-secondary" /> : undefined
      }
    ]}
  />
)

/** The licence the industry requires, and what the register holds. */
const licenceCell = (ops: Operations, onJumpToSource?: (cardId: string) => void): AttributeCell | undefined => {
  const l = ops.licence
  if (!l.required) return undefined
  // Under its own strip, so the cell names the record, not the strip again.
  const base = { key: 'licence', label: l.registry === 'FMCSA' ? 'FMCSA record' : 'NPI Registry record', span: 'full' as const }
  if (l.registry === 'none') return { ...base, values: [{ value: absent(`Required for ${l.profession}; no public register checked`) }] }
  if (l.found.length === 0)
    return {
      ...base,
      values: [{ value: absent(l.registry === 'NPI' ? 'None found in the NPI Registry for the people submitted' : 'No FMCSA registration on the record') }]
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
              onSelect={onJumpToSource ? () => onJumpToSource(namedCard('FMCSA registration')) : undefined}
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
            onSelect={onJumpToSource ? () => onJumpToSource(namedCard(x.registry)) : undefined}
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

/** A source label the registry chip already names. */
const REGISTRY_LABELS = new Set(['State registration', 'registration'])

/**
 * One location, as the Formation grid states a fact: the label, the chips
 * that attest it — Submitted, the filings that list it, every other record
 * that carries it, and the licence practised from it — then the address, with
 * whether the business is registered in its state and what USPS says of it.
 */
const locationCell = (
  a: Location,
  key: string,
  label: string,
  ops: Operations,
  record: BusinessRecord,
  onJumpToSource?: (cardId: string) => void
): AttributeCell => {
  const filings = filingsListing(record, a.fullAddress, 'addresses')
  /* The website, where the web address check found the submitted office on
     it: the check is the association — "Match identified to the submitted
     Office Address" — so the site is a source of the address it matched. */
  const webSaid = record.reviewTasks.find((t) => t.key === 'web_address_verification')?.subLabel ?? ''
  const onSite = a.submitted && /verified|match/i.test(webSaid) && !/unverified|mismatch/i.test(webSaid)
  const others = [...a.sourceNames.filter((n) => !REGISTRY_LABELS.has(n)), ...(onSite && record.website?.url ? ['Website'] : [])]
  const licences = licencesAt(ops.licence, a.fullAddress)
  const line = addressLine(a)
  return {
    key,
    label,
    span: 'full',
    badge: (
      <span className="flex flex-wrap items-center gap-1">
        {a.submitted && <SubmittedChip verified={filings.length > 0 || others.length > 0} onJumpToSource={onJumpToSource} />}
        {(filings.length > 0 || others.length > 0 || licences.length > 0) && (
          <AttributeSources
            sources={others}
            registrations={filings}
            domesticState={record.formation?.state}
            refs={a.sourceRefs?.filter((r) => r.type !== 'registration')}
            href={onSite ? (record.website?.url ?? undefined) : undefined}
            // The licence practised from this address, in the same chip as
            // the filings that list it.
            extra={licences.map((l) => ({
              id: `${key}-${l.id}`,
              label: l.registry,
              domain: l.registry,
              title: `NPI ${l.number}`,
              onSelect: onJumpToSource ? () => onJumpToSource(namedCard(l.registry)) : undefined,
              annotation: titleCase(l.holder)
            }))}
            onJumpToSource={onJumpToSource}
          />
        )}
      </span>
    ),
    values: [
      {
        value: a.fullAddress,
        note: line ? <span className="text-caption text-text-secondary">{line}</span> : undefined
      }
    ]
  }
}

/**
 * What the business does, where, and whether it is allowed to.
 *
 * The headline names the classification and the sentence says what the
 * Prohibited scheme made of it, so the body draws what they rest on: every
 * location the record ties to the business, then every classification as the
 * dashboard's table, then the licence the industry requires.
 */
export const OperationsBody = ({ record, onJumpToSource }: { record: BusinessRecord; onJumpToSource?: (cardId: string) => void }) => {
  const ops = useMemo(() => operationsOf(record), [record])
  const { industry, locations } = ops
  const licence = licenceCell(ops, onJumpToSource)

  // One tile per place, the submitted office's marked and first; closed until picked.
  const places = [...new Set(locations.map(placeOf))]
  const at = (p: string) => locations.filter((a) => placeOf(a) === p)
  const officePlace = places.find((p) => at(p).some((a) => a.submitted))
  const lic = ops.licence

  return (
    <div className="border-b border-[var(--core-color-border-divider)]">
      {/* One tile: what the Prohibited scheme made of it, opening every
          classification — NAICS, MCC, SIC — as the dashboard's table. */}
      {industry.table.length > 0 && industry.prohibited !== 'unknown' && (
        <Strip
          label="Industry"
          // The lead classification, in words, beside the verdict.
          aside={industry.lead?.name}
          tiles={[
            industry.prohibited === 'flagged'
              ? {
                  key: 'all',
                  chip: (
                    <MetaChip tone="danger" size="compact">
                      <TriangleAlert {...icon} />
                      Prohibited
                      {industry.flagged.length > 1 && <span className="tabular-nums">{industry.flagged.length}</span>}
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
      )}
      {/* The licence the industry requires: what the register holds as a
          tile, opening the record; an absence as a statement. */}
      {lic.required && licence && (
        <Strip
          label="Professional licence"
          tiles={
            lic.registry === 'none'
              ? [{ key: 'none', static: true, chip: <MetaChip tone="neutral" size="compact">Required · no public register checked</MetaChip> }]
              : lic.found.length === 0
                ? [
                    {
                      key: 'missing',
                      static: true,
                      chip: (
                        <MetaChip tone="danger" size="compact">
                          <X {...icon} />
                          {lic.registry === 'NPI' ? 'None found in the NPI Registry' : 'No FMCSA registration'}
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
          }
          detail={() => <AttributeCells items={[licence]} className="-mb-px" />}
        />
      )}
      {/* Every place the record puts the business — the submitted office
          first, with its mark — each opening its addresses as the grid up
          top states a fact: Submitted, the filings that list it, the licence
          practised from it, then the address. */}
      {places.length > 0 && (
        <Strip
          label="Locations"
          tiles={[...(officePlace ? [officePlace] : []), ...places.filter((p) => p !== officePlace)].map((p) => {
            const here = at(p)
            const submitted = here.some((a) => a.submitted)
            const undeliverable = here.some((a) => a.deliverable === false)
            // The mark is the post's: a check where it delivers, an X where
            // it cannot. The colour is the office's — green for the submitted
            // one, grey for the rest, red wherever the post cannot reach.
            const deliverable = here.some((a) => a.deliverable === true)
            return {
              key: p,
              chip: (
                <MetaChip tone={undeliverable ? 'danger' : submitted ? 'success' : 'neutral'} size="compact">
                  {undeliverable ? <X {...icon} /> : deliverable || submitted ? <Check {...icon} /> : null}
                  {p}
                  {here.length > 1 && <span className="tabular-nums text-text-secondary">{here.length}</span>}
                </MetaChip>
              )
            }
          })}
          detail={(p) => (
            <AttributeCells
              className="-mb-px"
              items={at(p).map((a, i) => locationCell(a, `${p}-${i}`, a.submitted ? 'Office' : 'Address', ops, record, onJumpToSource))}
            />
          )}
        />
      )}
    </div>
  )
}
