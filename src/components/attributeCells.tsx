import type { ReactNode } from 'react'

import { Tag } from '@/core'

import { corroborated, type AttributeRow } from '../lib/attributes'
import type { AttributeCell, AttributeValue } from './AttributeGrid'
import { RowProvenance, SubmittedChip } from './Provenance'

/** Colour follows the provider's confidence, not our reading of it. */
export const RISK_TONE: Record<string, 'subtle' | 'warning' | 'danger'> = {
  'Low risk': 'subtle',
  'Moderate risk': 'warning',
  'High risk': 'danger'
}

export type CellContext = {
  domesticState?: string | null
  onJumpToSource?: (cardId: string) => void
  /** The role a value played for THIS source, where that is not its own label —
   *  "Mailing address" on a filing, rather than "Address". */
  labelFor?: (row: AttributeRow, i: number) => string
  /** The value as this surface states it: bare, or without the role it was
   *  already labelled with. */
  valueFor?: (row: AttributeRow, i: number) => ReactNode
  /** Off inside a source card, where the card IS the provenance and a chip on
   *  every value would cite the card to itself. */
  provenance?: boolean
  /**
   * Consecutive rows sharing a label become one cell.
   *
   * For a source's payload, where the label is the role the value played for
   * that source — one "Mailing address" over the three the filing lists, one
   * "SIC" over eleven codes. Off in the Attributes tab: there the rows are the
   * record's own facts rather than one source's account of them, each is
   * separately attested, and each carries its own claim — folding them put one
   * Submitted chip over three addresses when one of the three was submitted.
   */
  fold?: boolean
  /**
   * Show `evidenceNote` — our own reading of a value, not something a source
   * handed us: a property type, how many businesses share an address.
   *
   * On inside an expanded insight, where that reading IS the finding. Off
   * everywhere else, which is the contract `AttributeRow.evidenceNote` states:
   * the Attributes tab answers what the sources supplied, so it shows the
   * address, and the judgement of that address belongs to the insight making
   * it. "2 businesses at this location" under an address in a list of
   * attributes is a verdict filed as a fact.
   */
  evidence?: boolean
}

/**
 * Who says so, beside the label.
 *
 * The claim and what attests it read as one statement, so they sit together on
 * the label's line rather than in two places — a mark beside the label and a
 * row of chips under the value.
 *
 * Sources first, the customer's claim last. The claim is the weakest of them
 * and the only one that is not independent, and it is the one carrying the
 * verdict on itself — so it reads as what the records to its left add up to,
 * rather than as the first authority on the row.
 */
const badgeFor = (row: AttributeRow, ctx: CellContext): ReactNode => {
  if (ctx.provenance === false) return undefined

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <RowProvenance
        row={row}
        domesticState={ctx.domesticState}
        onJumpToSource={ctx.onJumpToSource}
      />
      {row.submitted && (
        <SubmittedChip verified={corroborated(row)} onJumpToSource={ctx.onJumpToSource} />
      )}
    </span>
  )
}

/** A reading OF the value, under it — what we made of it, not where it came
 *  from. The provider's risk band, our own count of what shares an address. */
const noteFor = (row: AttributeRow, ctx: CellContext): ReactNode => {
  const evidenceNote = ctx.evidence ? row.evidenceNote : undefined
  const trailing =
    row.trailing &&
    (RISK_TONE[row.trailing] ? (
      <Tag tone={RISK_TONE[row.trailing]} size="compact">
        {row.trailing}
      </Tag>
    ) : (
      <span>{row.trailing}</span>
    ))
  if (!trailing && !evidenceNote) return undefined

  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {trailing}
      {evidenceNote && <span>{evidenceNote}</span>}
    </span>
  )
}

/**
 * Attribute rows, as cells.
 *
 * The one mapping from what the record holds to how this report draws a fact,
 * so the Attributes tab, a source's payload and an insight's evidence cannot
 * drift apart again — they did, down to two files setting different widths for
 * the same column of industry codes.
 *
 * Consecutive rows sharing a label fold into one cell. A filing lists three
 * addresses; printing "Address" over each of them says three facts where there
 * is one fact with three values, and the reader counts labels. The rows arrive
 * already ordered (`ordered`/`ROW_ORDER` in the Attributes tab, the source's
 * own order in Sources), which is what makes same-label rows adjacent and the
 * fold safe.
 */
export const cellsFromRows = (rows: AttributeRow[], ctx: CellContext = {}): AttributeCell[] => {
  const cells: AttributeCell[] = []

  rows.forEach((row, i) => {
    const label = ctx.labelFor ? ctx.labelFor(row, i) : row.label
    const value = ctx.valueFor ? ctx.valueFor(row, i) : row.value
    const note = noteFor(row, ctx)

    // A roll-up carries its whole statement in the label — "Active
    // registrations (2)" — and has nothing to put opposite it. The grid already
    // draws a value that names itself, so it becomes one.
    if (value === '' || value === undefined || value === null) {
      cells.push({ key: `${label}-${i}`, values: [{ value: label, note }] })
      return
    }

    const entry: AttributeValue = {
      key: `${i}`,
      lead: row.lead,
      value,
      qualifier: row.qualifier,
      note
    }

    const last = cells[cells.length - 1]

    // Detail belongs to the fact above it: nine articles are evidence about the
    // name being screened, not nine findings of their own. They used to say so
    // with a second left-hand indent; as further lines of that name's cell they
    // say it without one, and the name stays the subject.
    if (row.detail && last) {
      last.values.push({ ...entry, key: `detail-${i}` })
      last.span = 'full'
      return
    }

    if (ctx.fold && label && last?.label === label) {
      last.values.push(entry)
      last.span = 'full'
      // Any value in the run that was claimed makes the run claimed: the mark
      // is on the label, and the label now heads all of them.
      return
    }

    cells.push({
      key: `${label}-${i}`,
      label,
      values: [entry],
      badge: badgeFor(row, ctx),
      // A URL is 60 characters of unbreakable string, and a run of adverse
      // media is a list. Neither survives half a row. `href` alone does not
      // qualify: every row a crawl produced carries the site it was read from,
      // and spanning on that put a one-word title across the whole card.
      span:
        row.span === 'full' ||
        row.links?.length ||
        (typeof value === 'string' && /^https?:\/\//.test(value))
          ? 'full'
          : undefined
    })
  })

  return cells
}
