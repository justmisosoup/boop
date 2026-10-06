import { attributesFor } from '../../lib/attributes'
import type { BusinessRecord, Litigation } from '../../lib/deriveResults'
import { caseTitle, litigationSections, partyRole } from './litigationSections'
import { ClaimBand, RecordBlock } from './recordSections'

/**
 * One court case in the report.
 *
 * The band: whether the case is still open, its name as the court filed it,
 * and the business's part in it — defendant, plaintiff, garnishee — with the
 * court's chip at the far side. Under it, the filing details, the parties
 * under their roles, and the judgments as the docket entered them.
 */
export const LitigationBlock = ({
  litigation,
  record,
  onJumpToSource
}: {
  litigation: Litigation
  record: BusinessRecord
  onJumpToSource?: (cardId: string) => void
}) => {
  const row = attributesFor('litigations', record).find((r) => r.docId === litigation.id)
  return (
    <RecordBlock
      band={
        <ClaimBand
          status={litigation.caseStatus}
          title={caseTitle(litigation)}
          detail={partyRole(litigation)}
          row={row}
          onJumpToSource={onJumpToSource}
        />
      }
      sections={litigationSections(litigation)}
    />
  )
}
