import { CircleCheck, CircleMinus, CircleX } from 'lucide-react'

import { ChatSourceChip } from '@/core'

import { NOT_PROVIDED } from '../lib/registrationStatus'
import { CHIP_CLAIM, CHIP_GOOD, CHIP_UNVERIFIED } from './chipStyles'

/** The registry's word, read as a sentence: "GOOD_STANDING" → "Good standing". */
const sentence = (v: string) => v.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())

/**
 * A status as a small tag, in the very chip the Verified tag is (core's
 * `ChatSourceChip`, static): a circle mark and the word — a cross in red
 * where it reads badly (Inactive), a check in green where it reads well
 * (Active), a dash in the claim tint where the registry gives none. The Sources
 * cards' heads and the registration tooltips both draw their status with it.
 */
export const StatusTagChip = ({ status }: { status?: string | null }) => {
  const word = (status && sentence(status)) || NOT_PROVIDED
  const bad = Boolean(status && /inactive|revoked|expired|cancel|suspend|terminat|lapsed|dissolv|forfeit|withdrawn|open/i.test(status))
  const good = Boolean(status && !bad && /active|valid|current|good standing|closed|released|dismissed|satisfied|discharged/i.test(status))
  const Mark = bad ? CircleX : good ? CircleCheck : CircleMinus
  // The Verified tag's own chip: no destination, so it draws as static text.
  return (
    <ChatSourceChip
      // Red when it reads badly, green when well; the claim tint for neither.
      className={bad ? CHIP_UNVERIFIED : good ? CHIP_GOOD : CHIP_CLAIM}
      sources={[{ id: `status-${word}`, label: word, icon: <Mark aria-hidden="true" className="size-3" /> }]}
    />
  )
}
