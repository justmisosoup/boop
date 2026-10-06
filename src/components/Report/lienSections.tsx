import type { ReactNode } from 'react'

import { LIEN_KIND, money, shortDate } from '../../lib/attributes'
import type { Lien, LienParty } from '../../lib/deriveResults'
import { stateName } from '../../lib/states'
import { cell } from '../AttributeGrid'
import { ClampedText } from '../ClampedText'
import { BLANK, field, RecordSections, type Extra, type Section } from './recordSections'

/**
 * A lien's facts, in the dashboard's own arrangement
 * (`app/src/containers/Liens/LienDiveCard.tsx`): filing information, then the
 * secured parties, then the debtors, each party a name and its address.
 *
 * Built once here and drawn by both the report's lien block and the Sources
 * tab's lien card, so the two always show the same fields.
 */
export type LienSection = Section

/** "UCC lien", "State lien", "Federal lien" — the filing's kind as a label. */
export const lienKind = (l: Pick<Lien, 'type'>) => LIEN_KIND[(l.type ?? '').toLowerCase()] ?? 'Lien'

/** Open or closed, as the chip and the tiles read the status word; '' where
 *  the source gave neither. */
export const lienStatusKind = (status: string | null | undefined): 'Open' | 'Closed' | '' => {
  const s = (status ?? '').toLowerCase()
  return /open/.test(s) ? 'Open' : /closed|terminated|lapsed|released|dismissed|satisfied|discharged/.test(s) ? 'Closed' : ''
}

/**
 * Filing information: where and under what number it was filed, its dates,
 * what secures it. `lead` and `trail` let a surface add its own cells — the
 * Sources card's Status, its link to the filing office.
 */
export const filingInformation = (l: Lien, extra: Extra = {}): Section => ({
  key: 'filing',
  label: 'Filing information',
  columns: 3,
  cells: [
    ...(extra.lead ?? []),
    field('State', l.state ? stateName(l.state) : undefined),
    field('File number', l.fileNumber),
    field('Filed date', shortDate(l.filingDate)),
    field('Lapse date', shortDate(l.lapseDate)),
    field('Updated date', shortDate(l.updatedDate)),
    // The dashboard's split: a UCC filing states what it secures; a tax lien
    // states what is owed. Each field has its cell, a dash where the office
    // gave nothing or said "Unknown".
    ...(/ucc/i.test(l.type ?? '')
      ? [
          field('Collateral type', l.collateralType && !/^unknown$/i.test(l.collateralType) ? l.collateralType : undefined),
          cell('Collateral notes', l.collateral ? <ClampedText text={l.collateral} /> : BLANK, { span: 'full' })
        ]
      : [field('Liability amount', l.liabilityCents ? money(l.liabilityCents) : undefined)]),
    ...(l.loanPrincipalCents ? [field('Loan principal', money(l.loanPrincipalCents))] : []),
    ...(extra.trail ?? [])
  ]
})

/**
 * The parties, two cells each: the name, and the address the filing states
 * for it — a dash where it states none, so each party keeps its row.
 */
const partySection = (key: string, one: string, many: string, parties: LienParty[]): Section | undefined =>
  parties.length === 0
    ? undefined
    : {
        key,
        label: parties.length === 1 ? one : many,
        columns: 2,
        cells: parties.flatMap((p, i) => {
          const addresses = (p.addresses ?? []).filter(Boolean)
          return [
            field('Name', p.name),
            addresses.length > 0
              ? { key: `${key}-${i}-address`, label: 'Address', values: addresses.map((a) => ({ value: a })) }
              : field('Address', undefined)
          ].map((c, j) => ({ ...c, key: c.key ?? `${key}-${i}-${j}` }))
        })
      }

export const lienSections = (l: Lien, extra?: Extra): Section[] =>
  [
    filingInformation(l, extra),
    partySection('secured', 'Secured party', 'Secured parties', l.securedParties ?? []),
    partySection('debtors', 'Debtor', 'Debtors', l.debtors ?? [])
  ].filter((s): s is Section => Boolean(s))

/** The lien's sections drawn, for the Sources card. */
export const LienSections = ({
  lien,
  extra,
  heading,
  last
}: {
  lien: Lien
  extra?: Extra
  heading?: (label: string) => ReactNode
  last?: boolean
}) => <RecordSections sections={lienSections(lien, extra)} heading={heading} last={last} />
