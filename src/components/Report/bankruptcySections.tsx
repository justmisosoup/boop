import { sentence, shortDate } from '../../lib/attributes'
import type { Bankruptcy } from '../../lib/deriveResults'
import { cell } from '../AttributeGrid'
import { ClampedText } from '../ClampedText'
import { field, type Extra, type Section } from './recordSections'

/**
 * A bankruptcy petition's facts, in the dashboard's own arrangement
 * (`app/src/containers/Bankruptcies/Bankruptcy.tsx`): the filing details, the
 * debtors, and the case updates as the court published them. Drawn by the
 * report's block and the Sources tab's petition card.
 */

/** "Chapter 7", or "Petition" where the record names no chapter. */
export const chapterTitle = (b: Pick<Bankruptcy, 'chapter'>) => (b.chapter ? `Chapter ${b.chapter}` : 'Petition')

export const petitionDetails = (b: Bankruptcy, extra: Extra = {}): Section => ({
  key: 'filing',
  label: 'Filing details',
  columns: 3,
  cells: [
    ...(extra.lead ?? []),
    field('Case number', b.caseNumber),
    field('Court', b.court),
    field('State', b.courtState),
    field('Filing date', shortDate(b.filingDate)),
    field('Closed date', shortDate(b.closedDate)),
    field('Disposition', b.disposition ? (sentence(b.disposition) ?? b.disposition) : undefined),
    ...(extra.trail ?? [])
  ]
})

const debtorsSection = (b: Bankruptcy): Section | undefined => {
  const debtors = (b.debtors ?? []).filter((d) => d.name)
  if (debtors.length === 0) return undefined
  return {
    key: 'debtors',
    label: debtors.length === 1 ? 'Debtor' : 'Debtors',
    columns: 2,
    cells: debtors.map((d, i) => cell('Name', d.name, { key: `debtor-${i}` }))
  }
}

/** The court's docket, newest entry as the court lists it, each under its date. */
const updatesSection = (b: Bankruptcy): Section | undefined => {
  const updates = (b.caseUpdates ?? []).filter((u) => u.description)
  if (updates.length === 0) return undefined
  return {
    key: 'updates',
    label: updates.length === 1 ? 'Case update' : 'Case updates',
    columns: 2,
    cells: updates.map((u, i) =>
      cell(u.date ? (shortDate(u.date) ?? u.date) : 'Update', <ClampedText text={u.description!} />, { key: `update-${i}`, span: 'full' })
    )
  }
}

export const bankruptcySections = (b: Bankruptcy, extra?: Extra): Section[] =>
  [petitionDetails(b, extra), debtorsSection(b), updatesSection(b)].filter((s): s is Section => Boolean(s))
