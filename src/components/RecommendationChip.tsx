import { MetaChip, type MetaChipTone } from '@/core'

import type { ScoreBand } from '../lib/identityScore'

/**
 * The recommendation a report reached, as the businesses list shows it.
 *
 * It replaces the record's review status in the Status column. The status is
 * Middesk's word on the order; the recommendation is the assessment's word on
 * the account, and that is what the list is for. Same chip as the app's
 * `MetaTagStatus` — `MetaChip`, compact, one tone per band — so the column
 * reads as the app's Status column does, saying a different thing.
 *
 * A business with no report gets the neutral chip and the words for it: an
 * absence stated, not a fourth band.
 */
const TONE: Record<ScoreBand['tone'], MetaChipTone> = {
  success: 'success',
  warning: 'warning',
  danger: 'danger'
}

export const RecommendationChip = ({ band }: { band: ScoreBand | null }) => (
  <MetaChip size="compact" tone={band ? TONE[band.tone] : 'neutral'}>
    {band ? band.label : 'Not assessed'}
  </MetaChip>
)
