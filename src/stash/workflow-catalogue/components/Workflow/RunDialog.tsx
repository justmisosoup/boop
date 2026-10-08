import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'

import { ActionButton, Combobox, Dialog, Field, FieldDescription, FieldLabel } from '@/core'

import { displayName } from '../../../../lib/businessNames'
import { ALL } from '../../../../lib/records'
import type { Workflow } from '../../../../lib/workflows'

/**
 * Run this workflow, as a modal.
 *
 * Opened from the page's Run workflow button. Pick a business the prototype
 * holds and Run opens its record, where the workflow's outcome already sits
 * in the report. Upload a file stands for the batch route the real thing
 * would take; it does nothing here.
 */
export const RunDialog = ({
  workflow,
  open,
  onClose
}: {
  workflow: Workflow
  open: boolean
  onClose: () => void
}) => {
  const navigate = useNavigate()
  const [picked, setPicked] = useState<string[]>([])

  const options = useMemo(
    () =>
      [...ALL]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((r) => ({ label: displayName(r.name), value: r.id })),
    []
  )

  const run = () => {
    const id = picked[0]
    if (!id) return
    onClose()
    navigate(`/businesses/${id}`)
  }

  return (
    <Dialog
      isOpen={open}
      onClose={onClose}
      size="sm"
      title={`Run ${workflow.name}`}
      description="Pick a business to run it on, or upload a file of businesses."
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <ActionButton variant="secondary">Upload a file</ActionButton>
          <span className="flex items-center gap-2">
            <ActionButton variant="quiet" onClick={onClose}>
              Cancel
            </ActionButton>
            <ActionButton variant="primary" disabled={picked.length === 0} onClick={run}>
              Run
            </ActionButton>
          </span>
        </div>
      }
    >
      <Field>
        <FieldLabel htmlFor={`run-${workflow.slug}`}>Business</FieldLabel>
        <Combobox
          id={`run-${workflow.slug}`}
          aria-label={`Business to run ${workflow.name} on`}
          multiple={false}
          options={options}
          value={picked}
          onChange={setPicked}
          placeholder="Business name"
          searchPlaceholder="Business name or EIN"
          emptyMessage="No business by that name."
          className="w-full"
        />
        <FieldDescription>Searches the businesses on your list.</FieldDescription>
      </Field>
    </Dialog>
  )
}
