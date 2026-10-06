import { attributesFor } from '../../lib/attributes'
import type { Bankruptcy, BusinessRecord } from '../../lib/deriveResults'
import { bankruptcySections, chapterTitle } from './bankruptcySections'
import { ClaimBand, RecordBlock } from './recordSections'

/**
 * One bankruptcy petition in the report.
 *
 * The band: whether the case is still open, the chapter it was filed under,
 * and the court, with the court's chip at the far side. Under it, the filing
 * details, the debtors, and the case updates as the court published them.
 */
export const BankruptcyBlock = ({
  bankruptcy,
  record,
  onJumpToSource
}: {
  bankruptcy: Bankruptcy
  record: BusinessRecord
  onJumpToSource?: (cardId: string) => void
}) => {
  const row = attributesFor('bankruptcies', record).find((r) => r.docId === bankruptcy.id)
  return (
    <RecordBlock
      band={
        <ClaimBand
          status={bankruptcy.status}
          title={chapterTitle(bankruptcy)}
          detail={bankruptcy.court ?? bankruptcy.courtState ?? undefined}
          row={row}
          onJumpToSource={onJumpToSource}
        />
      }
      sections={bankruptcySections(bankruptcy)}
    />
  )
}
