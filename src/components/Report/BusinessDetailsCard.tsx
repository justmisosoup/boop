import { useState, type FormEvent } from 'react'

import { ActionButton, FieldLabel, InlineAlert, Input, Popover, PopoverContent, PopoverTrigger, Surface } from '@/core'

import { maskTin } from '../../lib/attributes'
import { displayName } from '../../lib/businessNames'
import type { BusinessRecord, Derived, SourceRef } from '../../lib/deriveResults'
import dayjs from '../../lib/dayjs'
import { outcomeOf } from '../../lib/insightOutcome'
import { createLocalStore } from '../../lib/localStore'
import { entityTypeShown } from '../../lib/normalise'
import { domesticOf, notPublished, registrationState } from '../../lib/registrationStatus'
import { cardAnchor } from '../../lib/reportCards'
import { stateName } from '../../lib/states'
import { AttributeCells, type AttributeCell } from '../AttributeGrid'
import { CardHeader } from '../CardHeader'
import { AttributeSources } from '../Provenance'

/**
 * The business at a glance, at the top of the report: the dashboard's own
 * "Business details" card (`app/src/containers/BusinessHome/BusinessSummaryCard`)
 * — business name and office address as submitted, TIN,
 * formation state, entity type, formation date, operating status and
 * website, three across — and its banner when no Secretary of State filing
 * matched. Each value as the record holds it from the API; the cards below
 * carry the evidence. The app's phone number and external ID are the
 * business's own submitted fields, which the prototype's pull doesn't keep, so
 * they are left off rather than shown empty.
 */
/** A TIN the reviewer submitted for a business Middesk found none for. Kept in
 *  the browser, never in `records.json`, which `pull` rewrites. */
const SUBMITTED_TIN = createLocalStore<{ tin: string; at: string }>('prototype.submitted-tin.v1')

const digitsOf = (v: string) => v.replace(/\D/g, '').slice(0, 9)
/** As an EIN reads: "12-3456789". */
const asEin = (d: string) => (d.length > 2 ? `${d.slice(0, 2)}-${d.slice(2)}` : d)

/**
 * The TIN where the record has none: Middesk looked for it with prefill and
 * found nothing, so the cell says that — not a bare "Not submitted" — and
 * offers to take the TIN from the reviewer, who may have it from the
 * applicant, to run a TIN match on. Once given, the cell holds it, masked,
 * with its match still to run.
 */
const MissingTin = ({ businessId }: { businessId: string }) => {
  const submitted = SUBMITTED_TIN.useAll()[businessId]
  const [open, setOpen] = useState(false)
  const [digits, setDigits] = useState('')
  if (submitted)
    return (
      <span className="flex flex-col gap-0.5">
        <span>{maskTin(submitted.tin)}</span>
        <span className="text-text-secondary">Submitted · TIN match pending</span>
      </span>
    )
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (digits.length !== 9) return
    SUBMITTED_TIN.set(businessId, { tin: asEin(digits), at: new Date().toISOString() })
    setOpen(false)
  }
  return (
    <span className="flex flex-col items-start gap-1">
      <span>Not found</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <ActionButton className="-ml-2" size="compact" variant="quiet">
            Submit TIN
          </ActionButton>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-4">
          <form className="flex flex-col gap-3" onSubmit={submit}>
            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor={`tin-${businessId}`}>TIN (EIN)</FieldLabel>
              <Input
                autoComplete="off"
                autoFocus
                id={`tin-${businessId}`}
                inputMode="numeric"
                onChange={(e) => setDigits(digitsOf(e.target.value))}
                placeholder="12-3456789"
                value={asEin(digits)}
              />
              <span className="text-text-secondary">We'll run a TIN match against IRS records.</span>
            </div>
            <div className="flex justify-end gap-2">
              <ActionButton onClick={() => setOpen(false)} size="compact" type="button" variant="quiet">
                Cancel
              </ActionButton>
              <ActionButton disabled={digits.length !== 9} size="compact" type="submit" variant="primary">
                Submit TIN
              </ActionButton>
            </div>
          </form>
        </PopoverContent>
      </Popover>
    </span>
  )
}

export const BusinessDetailsCard = ({
  record,
  results,
  onJumpToSource
}: {
  record: BusinessRecord
  results: Derived[]
  onJumpToSource?: (cardId: string) => void
}) => {
  // What the customer submitted, and whether its own check confirmed it: the
  // business name against the filings, the office address against its sources.
  const verifiedBy = (key: string) => results.some((r) => r.insightId.split(':')[0] === key && outcomeOf(r, record) === 'pass')
  const legal = record.names.find((n) => n.type === 'legal' && (n as { submitted?: boolean }).submitted)?.name ?? record.name
  const office = record.addresses.find((a) => a.submitted) ?? record.addresses[0]
  const tin = (record.tin as { tin?: string } | null)?.tin
  const domestic = domesticOf(record)
  const f = record.formation
  const site = (record.website as { url?: string } | null)?.url

  // Where each submitted value is attested: the record's own sources for it.
  const legalEntry = record.names.find((n) => n.type === 'legal' && (n as { submitted?: boolean }).submitted) as
    | { sources?: string[]; sourceRefs?: SourceRef[] }
    | undefined
  const officeEntry = office as unknown as { sources?: string[]; sourceRefs?: SourceRef[] } | undefined
  const provenance: Record<string, { sources: string[]; refs?: SourceRef[] }> = {
    ...(legalEntry?.sources?.length && { name: { sources: [...new Set(legalEntry.sources)], refs: legalEntry.sourceRefs } }),
    ...(officeEntry?.sources?.length && {
      address_verification: { sources: [...new Set(officeEntry.sources)], refs: officeEntry.sourceRefs }
    })
  }

  /** The registry's own word for where the filing stands; a state that publishes none says so. */
  const operating = (() => {
    if (!domestic) return undefined
    const st = registrationState(domestic)
    if (st.silent || notPublished(domestic)) return 'Not published by the state'
    return st.statusDetails && st.statusDetails !== st.status ? `${st.status} · ${st.statusDetails}` : st.status
  })()

  const cell = (label: string, value: string | null | undefined, check?: string): AttributeCell => {
    const verified = check && value ? verifiedBy(check) : undefined
    return {
      label,
      // A submitted value's check sits beside its label — the Names card's
      // own green check where verified, amber where not — so a long value
      // (an address) wraps clear of it. Found values carry none.
      // Beside the label, the report's own Submitted chip: verified or not, and
      // the record's sources for the value listed under it.
      ...(verified !== undefined && {
        badge: (
          <AttributeSources
            domesticState={record.formation?.state}
            onJumpToSource={onJumpToSource}
            refs={provenance[check!]?.refs}
            sources={provenance[check!]?.sources ?? []}
            submitted={{ verified }}
          />
        )
      }),
      values: [{ value: value || '—' }]
    }
  }
  const items: AttributeCell[] = [
    cell('Business name', displayName(legal), 'name'),
    cell('Office address', office?.fullAddress, 'address_verification'),
    // None on the record: say Middesk looked and couldn't find one, and take it if the reviewer has it.
    tin ? cell('TIN', maskTin(tin)) : { label: 'TIN', values: [{ value: <MissingTin businessId={record.id} /> }] },
    cell('Formation state', f?.state ? stateName(f.state) : undefined),
    cell('Entity type', f?.entityType ? entityTypeShown(record, f.entityType) : undefined),
    // How long ago, then the day: "14 years ago · Dec 19, 2012".
    cell(
      'Formation date',
      f?.date
        ? `${dayjs(f.date).fromNow()} · ${new Date(`${f.date.slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
        : undefined
    ),
    cell('Operating status', operating),
    cell('Website', site?.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))
  ]

  return (
    <Surface id={cardAnchor('details')} variant="card" padding="none" className="scroll-mt-6 overflow-hidden" role="region" aria-label="Business details">
      <CardHeader title="Business details" />
      {!f?.state && (
        <InlineAlert className="mx-4 mt-3" size="compact" tone="danger">
          No matching Secretary of State filings
        </InlineAlert>
      )}
      <AttributeCells columns={3} items={items} />
    </Surface>
  )
}
