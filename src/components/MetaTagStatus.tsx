import { MetaChip, type MetaChipTone } from '@/core'

/**
 * A business's review status, as the businesses list shows it.
 *
 * Ported from `app/src/containers/Businesses/BusinessList/MetaTagStatus.tsx` —
 * same tones, same words. The app reads `PENDING_STATUSES` from its shared
 * `constants/business`; the prototype has no such module, so the list is
 * inlined here unchanged.
 */
const PENDING_STATUSES = ['in_audit', 'open', 'pending']

export const MetaTagStatus = ({ status }: { status: string }) => {
  let tone: MetaChipTone = 'success'
  let statusText = 'Approved'

  if (PENDING_STATUSES.includes(status)) {
    tone = 'neutral'
    statusText = 'Pending'
  } else if (status === 'in_review') {
    tone = 'warning'
    statusText = 'Needs Review'
  } else if (status === 'rejected') {
    tone = 'danger'
    statusText = 'Rejected'
  }

  return (
    <MetaChip size='compact' tone={tone}>
      {statusText}
    </MetaChip>
  )
}
