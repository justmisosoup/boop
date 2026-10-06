import { money, sentence, shortDate } from '../../lib/attributes'
import type { Litigation } from '../../lib/deriveResults'
import { cell, type AttributeCell } from '../AttributeGrid'
import { ClampedText } from '../ClampedText'
import { field, type Extra, type Section } from './recordSections'

/**
 * A court case's facts, in the dashboard's own arrangement
 * (`app/src/containers/BusinessHome/DiveCards/Litigations.tsx`): the filing
 * details, the parties with their roles, the judgments as the docket entered
 * them. Drawn by the report's block and the Sources tab's court-record card.
 */

/** The court's own "UNKNOWN" is not a value; it is left out, as the rows leave it. */
const known = (v: string | null | undefined) => (v && v.toUpperCase() !== 'UNKNOWN' ? v : undefined)

/** The case as the court names it. */
export const caseTitle = (c: Pick<Litigation, 'caseName'>) => c.caseName ?? 'Unnamed case'

/** The business's part in the case — "Defendant" — where the court states it. */
export const partyRole = (c: Pick<Litigation, 'partyType'>) => {
  const p = known(c.partyType)
  return p ? (sentence(p) ?? p) : undefined
}

export const filingDetails = (c: Litigation, extra: Extra = {}): Section => ({
  key: 'filing',
  label: 'Filing details',
  columns: 3,
  cells: [
    ...(extra.lead ?? []),
    field('Case number', c.caseNumber),
    field('Court', c.court),
    field('State', c.courtState),
    field('Filing date', shortDate(c.filingDate)),
    field('Party type', partyRole(c)),
    // Every field has its cell; a dash where the court gave no type.
    field('Case type', known(c.caseType)),
    ...(extra.trail ?? [])
  ]
})

/** A name as one party, however the court spaced or cased it. */
const nameKey = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * The parties: one cell each, under the roles the court lists them in. The
 * same name filed twice — "Defendant" and "Respondent" — is one party with
 * two roles, as the People card draws a person's titles.
 */
const partiesSection = (c: Litigation): Section | undefined => {
  const byName = new Map<string, { name: string; roles: string[] }>()
  for (const p of c.parties ?? []) {
    if (!p.name) continue
    const key = nameKey(p.name)
    const role = known(p.role) ? (sentence(p.role) ?? p.role!) : 'Party'
    const entry = byName.get(key) ?? { name: p.name, roles: [] }
    if (!entry.roles.includes(role)) entry.roles.push(role)
    byName.set(key, entry)
  }
  const parties = [...byName.values()]
  if (parties.length === 0) return undefined
  return {
    key: 'parties',
    label: parties.length === 1 ? 'Party' : 'Parties',
    columns: 2,
    cells: parties.map((p, i) => cell(p.roles.join(' · '), p.name, { key: `party-${i}` }))
  }
}

/**
 * The judgments as the docket entered them: each entry under its date, held
 * to three lines, and the sum it carries as its own cell where it carries one.
 */
const judgmentsSection = (c: Litigation): Section | undefined => {
  const judgments = (c.judgments ?? []).filter((j) => j.text || j.amountCents)
  if (judgments.length === 0) return undefined
  return {
    key: 'judgments',
    label: judgments.length === 1 ? 'Judgment' : 'Judgments',
    columns: 2,
    cells: judgments.flatMap((j, i): AttributeCell[] => [
      ...(j.text
        ? [cell(j.date ? `Entered ${shortDate(j.date) ?? j.date}` : 'Entry', <ClampedText text={j.text} />, { key: `judgment-${i}`, span: 'full' })]
        : []),
      ...(j.amountCents ? [cell('Judgment amount', money(j.amountCents), { key: `judgment-${i}-amount` })] : [])
    ])
  }
}

export const litigationSections = (c: Litigation, extra?: Extra): Section[] =>
  [filingDetails(c, extra), partiesSection(c), judgmentsSection(c)].filter((s): s is Section => Boolean(s))
