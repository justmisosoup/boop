import { identityRows } from '../lib/attributes'
import type { BusinessRecord } from '../lib/deriveResults'
import { AttributeGrid, type AttributeCell } from './AttributeGrid'
import { cellsFromRows } from './attributeCells'
import { CardLabel } from './CardLabel'

/**
 * What the record says this business is.
 *
 * The facts are chosen in `identityRows` — the filing facts an account is
 * opened against, read off the record rather than fanned out over whatever
 * happened to be checked. Nothing here is a reading of a value: no verdicts, no
 * bands, no confidence.
 *
 * Drawn through `cellsFromRows`, the mapping the Attributes tab and an
 * insight's evidence also draw through, so every value on this card cites the
 * same way they do: the sources beside the label, then the customer's own claim
 * last, with the tick that says whether a source of record agreed. The card
 * used to state its values bare, with a tick and no chips — the one place in
 * the report where a fact appeared with nothing behind it.
 *
 * A field the record does not hold is not a cell. There is no blank, no "none
 * on the record" — an account reviewer reads a gap as "we did not look", and
 * what is missing is the Attributes tab's job to say.
 */
export const identityCells = (
  record: BusinessRecord,
  onJumpToSource?: (cardId: string) => void
): AttributeCell[] =>
  cellsFromRows(identityRows(record), {
    domesticState: record.formation?.state,
    onJumpToSource
  })

export const BusinessIdentity = ({
  record,
  onJumpToSource
}: {
  record: BusinessRecord
  /** A source chip on the card opens that source's card, as it does everywhere
   *  else the report cites one. */
  onJumpToSource?: (cardId: string) => void
}) => {
  const cells = identityCells(record, onJumpToSource)
  if (cells.length === 0) return null

  return (
    // Spacing above, not below: it sits between the Identity section's opening
    // claim and the insights behind it, and the insight card brings its own.
    <section className="mt-10">
      {/* A label on the card, not a heading over a section: the assessment's
          own headings start below this, and a third one here would make the
          head of the report read as its first argument. */}
      <CardLabel className="mb-2">Business identity</CardLabel>
      <AttributeGrid items={cells} />
    </section>
  )
}
