/**
 * Who owns this review.
 *
 * Ported from the dashboard's
 * `containers/BusinessHome/BusinessStatusBar/AssigneeDropdown`, with the
 * store and the API replaced by `lib/review.ts`. More than a label:
 * `StatusDropdown` only enables for the assigned user, so this control is the
 * gate on approving or rejecting a business — which is why "Assign to me" is a
 * standing command rather than something you have to find your own name in
 * the list to do.
 */
import { useMemo } from 'react'
import { ChevronDown, UserPlus } from 'lucide-react'

import { Avatar, ListPicker, ToolbarButton, type ListPickerAction, type ListPickerItem } from '@/core'

import { CURRENT_USER_ID, TEAM, assignReview, useReview } from '../../lib/review'

export const AssigneeDropdown = ({ businessId }: { businessId: string }) => {
  const { assigneeId } = useReview(businessId)

  const items = useMemo<ListPickerItem[]>(
    () =>
      // Named members first, alphabetical — the dashboard's order.
      [...TEAM]
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
        .map((user) => ({
          id: user.id,
          label: user.name,
          description: user.email,
          icon: <Avatar aria-hidden name={user.name} size="sm" />,
          meta: user.id === CURRENT_USER_ID ? 'You' : undefined
        })),
    []
  )

  const actions = useMemo<ListPickerAction[]>(
    () =>
      assigneeId !== CURRENT_USER_ID
        ? [
            {
              id: 'assign-to-me',
              label: 'Assign to me',
              icon: <UserPlus aria-hidden="true" className="size-4" strokeWidth={2} />,
              onSelect: () => assignReview(businessId, CURRENT_USER_ID)
            }
          ]
        : [],
    [assigneeId, businessId]
  )

  const assignee = TEAM.find((u) => u.id === assigneeId)

  return (
    <ListPicker
      actions={actions}
      align="end"
      emptyMessage={(query) => (query ? `No teammates match “${query}”` : 'No teammates yet')}
      items={items}
      label="Assignee"
      leading="identity"
      searchable
      searchPlaceholder="Search teammates"
      selectedId={assigneeId}
      onSelect={(item) => assignReview(businessId, item.id)}
    >
      <ToolbarButton trailingIcon={<ChevronDown aria-hidden="true" className="size-4" strokeWidth={1.5} />}>
        {!assignee ? (
          <span className="font-medium">Unassigned</span>
        ) : (
          <>
            {/* The label stays at the button's secondary tone and the person
                comes forward. */}
            Assigned to <span className="font-medium text-foreground">{assignee.name}</span>
          </>
        )}
      </ToolbarButton>
    </ListPicker>
  )
}
