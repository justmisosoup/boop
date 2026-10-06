import { attributesFor } from '../../lib/attributes'
import type { BusinessRecord, Lien } from '../../lib/deriveResults'
import { lienKind, lienSections } from './lienSections'
import { ClaimBand, RecordBlock } from './recordSections'

/**
 * One lien in the report.
 *
 * A band names it the way a reviewer reads it — whether it is still live, what
 * kind of filing it is, and who holds it — with its source chip at the far
 * side. Under the band, the filing's facts in the dashboard's arrangement:
 * filing information, the secured parties, the debtors. It replaces one cell
 * that ran every field together as text, the collateral clause whole among
 * them.
 */
export const LienBlock = ({
  lien,
  record,
  onJumpToSource
}: {
  lien: Lien
  record: BusinessRecord
  onJumpToSource?: (cardId: string) => void
}) => {
  // The lien's attribute row carries its provenance: the Sources card it jumps
  // to and the filing office's page it links out to.
  const row = attributesFor('liens', record).find((r) => r.docId === lien.id)
  const holders = (lien.securedParties ?? []).map((p) => p.name).filter(Boolean)
  return (
    <RecordBlock
      band={
        <ClaimBand
          status={lien.status}
          title={lienKind(lien)}
          detail={holders.join(', ') || 'Secured party not stated'}
          row={row}
          onJumpToSource={onJumpToSource}
        />
      }
      sections={lienSections(lien)}
    />
  )
}
