import { useState } from 'react'

import { MoreHorizontal } from 'lucide-react'
import { useNavigate } from 'react-router'

import {
  Checkbox,
  ConfirmDialog,
  DateTime,
  IconActionButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Text,
  useToast
} from '@/core'
import cya from '@/utils/cya'

import { useDeleteCustomOrderMutation } from '../../lib/customOrders/api'
import { ORDER_CATALOG } from '../../lib/customOrders/catalog'
import { summarize } from '../../lib/customOrders/model'
import type { SavedCustomOrder } from '../../lib/customOrders/types'
import { useSavedWorkflows } from '../../lib/savedWorkflows'
import { duplicateWorkflowPath, editWorkflowPath } from '../Workflows/paths'

/**
 * The saved assessments to run, as a checklist: one or many. Each is its own
 * assessment on the business; a check two of them share is ordered once.
 *
 * The order page's first step. Editing and duplicating go to the builder and
 * come back to `returnTo`; new assessments are made under Assessments.
 */
export const AssessmentChecklist = ({
  selected,
  onChange,
  returnTo,
  lastRun
}: {
  selected: string[]
  onChange: (ids: string[]) => void
  /** Where the builder returns to after a save. */
  returnTo: string
  /** When this business last ran an assessment, by its id; absent off a business. */
  lastRun?: (assessmentId: string) => string | undefined
}) => {
  const navigate = useNavigate()
  const assessments = useSavedWorkflows()
  const [deleteOrder, { isLoading: isDeleting }] = useDeleteCustomOrderMutation()
  const [pendingDelete, setPendingDelete] = useState<SavedCustomOrder | null>(null)
  const { showToast } = useToast()
  const openBuilder = (path: string) => navigate(path, { state: { returnTo } })
  const toggle = (id: string, on: boolean) =>
    onChange(on ? [...new Set([...selected, id])] : selected.filter((x) => x !== id))

  const confirmDelete = async () => {
    if (!pendingDelete) return
    try {
      await deleteOrder(pendingDelete.id).unwrap()
      onChange(selected.filter((x) => x !== pendingDelete.id))
      showToast({ text: 'Assessment deleted', appearance: 'success' })
    } catch {
      showToast({ text: 'Couldn’t delete the assessment', appearance: 'error' })
    }
    setPendingDelete(null)
  }

  return (
    <>
      <ul className="m-0 list-none rounded-card border border-border bg-card p-0">
        {assessments.map((a) => {
          const { orderable, reason } = a.availability
          const ran = lastRun?.(a.id)
          return (
            <li
              key={a.id}
              className="flex items-start justify-between gap-4 px-4 py-3 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-[var(--core-color-border-divider)]"
              {...cya(`SavedCustomOrder-${a.name}`)}
            >
              <Checkbox
                checked={selected.includes(a.id)}
                className="min-w-0 flex-1"
                description={orderable ? summarize(ORDER_CATALOG, a) : reason}
                disabled={!orderable}
                onCheckedChange={(on) => toggle(a.id, on === true)}
                {...cya('SelectSavedCustomOrder')}
              >
                <span className="font-semibold">{a.name}</span>
              </Checkbox>
              <div className="flex shrink-0 items-center gap-2">
                {ran && (
                  <Text tone="secondary" className="whitespace-nowrap">
                    Ran <DateTime relative>{ran}</DateTime>
                  </Text>
                )}
                <Menu>
                  <MenuTrigger asChild>
                    <IconActionButton aria-label={`Actions for ${a.name}`} type="button" variant="quiet">
                      <MoreHorizontal aria-hidden="true" />
                    </IconActionButton>
                  </MenuTrigger>
                  <MenuContent align="end" themeMode="light">
                    <MenuItem onSelect={() => openBuilder(editWorkflowPath(a.id))}>Edit</MenuItem>
                    <MenuItem onSelect={() => openBuilder(duplicateWorkflowPath(a.id))}>Duplicate</MenuItem>
                    <MenuSeparator />
                    <MenuItem onSelect={() => setPendingDelete(a)} tone="destructive">
                      Delete
                    </MenuItem>
                  </MenuContent>
                </Menu>
              </div>
            </li>
          )
        })}
        {assessments.length === 0 && (
          <li className="px-4 py-3">
            <Text tone="secondary">No assessments yet.</Text>
          </li>
        )}
      </ul>

      <ConfirmDialog
        confirmLabel="Delete"
        description="Reports already run with it are not affected."
        isConfirming={isDeleting}
        isOpen={pendingDelete !== null}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title={`Delete “${pendingDelete?.name ?? ''}”?`}
        tone="danger"
      />
    </>
  )
}
