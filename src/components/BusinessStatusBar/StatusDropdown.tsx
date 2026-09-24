/**
 * Verbatim from the dashboard:
 * `app/src/containers/BusinessHome/BusinessStatusBar/StatusDropdown`.
 *
 * The props it read off the business payload (`assigneeId`, `status`,
 * `currentUserId`) come from `lib/review.ts` instead; the `Pending` branch for
 * an unknown status has no path here, since the store only holds the three.
 * Only the assigned user can change the status; everyone else gets the
 * static, disabled trigger. Every change goes through `StatusChangeModal`.
 */
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { ActionButton, Menu, MenuContent, MenuItem, MenuTrigger } from '@/core'

import { CURRENT_USER_ID, REVIEW_STATUSES, useReview, type ReviewStatus } from '../../lib/review'
import { cn } from '../../utils/twUtils'
import { StatusChangeModal } from './StatusChangeModal'

const STATUS_DOT_CLASS: Record<ReviewStatus, string> = {
  approved: 'bg-[var(--core-color-status-success-fg)]',
  rejected: 'bg-[var(--core-color-status-danger-fg)]',
  in_review: 'bg-[var(--core-color-status-neutral-fg)]'
}

const STATUS_INTENT: Record<ReviewStatus, string> = {
  approved: 'Approve',
  in_review: 'Needs Review',
  rejected: 'Reject'
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const statusLabel = (status: string) => (status === 'in_review' ? 'Needs Review' : capitalize(status))

const StatusDot = ({ status }: { status: ReviewStatus }) => (
  <span aria-hidden='true' className={`size-2 shrink-0 rounded-full ${STATUS_DOT_CLASS[status]}`} />
)

export const StatusDropdown = ({
  businessId,
  defaultStatus = 'in_review'
}: {
  businessId: string
  /** What the status reads before anyone sets it — the determination's word. */
  defaultStatus?: ReviewStatus
}) => {
  const [statusChangeModalOpen, setStatusChangeModalOpen] = useState(false)
  const [newStatus, setNewStatus] = useState('')

  const { assigneeId, status: reviewStatus } = useReview(businessId, defaultStatus)
  const isAssignedUser = assigneeId === CURRENT_USER_ID

  const trigger = (
    <ActionButton
      aria-label='Business status'
      disabled={!isAssignedUser}
      leadingIcon={<StatusDot status={reviewStatus} />}
      trailingIcon={<ChevronDown aria-hidden='true' className='size-4' strokeWidth={1.5} />}
      variant='secondary'
    >
      {statusLabel(reviewStatus)}
    </ActionButton>
  )

  // Only the assigned user can change the status; everyone else gets the
  // static, disabled trigger.
  if (!isAssignedUser) return trigger

  return (
    <>
      <StatusChangeModal
        businessId={businessId}
        previousStatus={reviewStatus}
        newStatus={newStatus}
        modalOpen={statusChangeModalOpen}
        setModalOpen={setStatusChangeModalOpen}
      />
      <Menu>
        <MenuTrigger asChild>{trigger}</MenuTrigger>
        <MenuContent align='end'>
          {REVIEW_STATUSES.map((statusOption) => {
            const isSelected = statusOption === reviewStatus

            return (
              <MenuItem
                aria-current={isSelected || undefined}
                className={cn(
                  isSelected &&
                    'bg-[var(--core-color-state-selected-bg)] font-medium text-[var(--core-color-state-selected-fg)]'
                )}
                key={statusOption}
                onSelect={() => {
                  if (statusOption !== reviewStatus) {
                    setNewStatus(statusOption)
                    setStatusChangeModalOpen(true)
                  }
                }}
              >
                <StatusDot status={statusOption} />
                {STATUS_INTENT[statusOption]}
              </MenuItem>
            )
          })}
        </MenuContent>
      </Menu>
    </>
  )
}
