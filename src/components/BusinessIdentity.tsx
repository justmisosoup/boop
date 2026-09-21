import { MutedText } from '@/core'

import { trueEntityType, type BusinessRecord } from '../lib/deriveResults'
import { capitalize } from '../utils/stringUtils'
import { AttributeGrid, type AttributeCell } from './AttributeGrid'

/** The last four, the way a TIN is shown anywhere it is shown at all. */
const maskTin = (tin: string) => `••••• ${tin.replace(/\D/g, '').slice(-4)}`

/**
 * What the record says this business is.
 *
 * Read off the record itself rather than through `attributesFor`, which fans
 * out over the insights and so returns whatever happened to be checked. These
 * are attributes: the filing facts an account is opened against, stated once,
 * before the report starts arguing about them. Nothing here is a reading of a
 * value — no verdicts, no bands, no confidence.
 *
 * `trueEntityType` is the one derived value and has to be: the provider reports
 * this business as an LLC while its filing, its name and every other surface in
 * the app say PLLC.
 *
 * A field the record does not hold is not a cell. There is no blank, no "none
 * on the record" — an account reviewer reads a gap as "we did not look", and
 * what is missing is the Attributes tab's job to say.
 *
 * Nothing here is labelled "submitted" any more. Who supplied a value is not
 * what a reviewer is asking at this point in the page; whether it stood up is.
 * So the only mark is a tick, on the values the customer gave us that a source
 * of record then confirmed.
 */
export const identityCells = (record: BusinessRecord): AttributeCell[] => {
  // The filing the business was formed under, not a foreign qualification: the
  // standing that matters is the domestic state's.
  const domestic =
    record.registrations.find((r) => r.jurisdiction === 'DOMESTIC') ??
    record.registrations.find((r) => r.state === record.formation?.state) ??
    record.registrations[0]

  // The IRS holds this TIN against a name associated with the business: the
  // customer gave us the number and a source of record agreed.
  const tin = record.tin as { tin?: string; verified?: boolean } | null
  const dba = record.names.find((n) => n.type === 'dba')?.name
  // The address the customer gave us, which is the one the account is opened
  // against — the record carries others the state happens to list.
  const office = record.addresses.find((a) => a.submitted)

  const cells: Array<AttributeCell | null> = [
    dba ? { label: 'DBA', value: dba } : null,
    trueEntityType(record) ? { label: 'Entity type', value: trueEntityType(record) as string } : null,
    record.formation?.state ? { label: 'Formation state', value: record.formation.state } : null,
    record.formation?.date ? { label: 'Formation date', value: record.formation.date } : null,
    // The record stores it lowercase; every other surface prints it as a word.
    domestic?.status ? { label: 'Status', value: capitalize(domestic.status) } : null,
    tin?.tin ? { label: 'TIN', value: maskTin(tin.tin), verified: tin.verified === true } : null,
    office
      ? {
          label: 'Office address',
          value: office.fullAddress,
          // Submitted by the customer and carried by a source of record — the
          // state's filing lists it — which is the pair this tick is for. A
          // submitted address nothing corroborates gets no mark.
          verified: (office.sources ?? []).length > 0
        }
      : null
  ]

  return cells.filter((c): c is AttributeCell => c !== null)
}

export const BusinessIdentity = ({ record }: { record: BusinessRecord }) => {
  const cells = identityCells(record)
  if (cells.length === 0) return null

  return (
    <section className="mb-8">
      {/* A label on the card, not a heading over a section: the assessment's
          own headings start below this, and a third one here would make the
          head of the report read as its first argument. */}
      <MutedText className="mb-2 block text-caption uppercase tracking-[0.08em]">
        Business identity
      </MutedText>
      <AttributeGrid items={cells} />
    </section>
  )
}
