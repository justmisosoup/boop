import type React from 'react'

import { ActionButton } from './Action'
import { Dialog } from './Dialog'

export type ConfirmDialogTone = 'default' | 'danger'

export type ConfirmDialogProps = {
  /** Controls visibility. */
  isOpen: boolean
  /** Short, specific question — e.g. "Discard unsaved changes?". */
  title: React.ReactNode
  /**
   * Supporting copy announced with the title when the dialog opens.
   */
  description?: React.ReactNode
  /** Confirm (primary action) label. */
  confirmLabel?: string
  /** Cancel (dismiss) label. */
  cancelLabel?: string
  /**
   * `danger` paints the confirm button destructive — use for irreversible or
   * data-losing actions (discard, delete). `default` is a primary confirm.
   */
  tone?: ConfirmDialogTone
  /** Disables buttons and shows a spinner on confirm while an async op runs. */
  isConfirming?: boolean
  /** Fired when the user confirms. */
  onConfirm: () => void
  /**
   * Fired on cancel, Escape, overlay click, or the close button — every
   * "did not confirm" exit routes here, so callers only need one dismiss path.
   */
  onCancel: () => void
}

/**
 * A minimal, reusable confirm dialog: title, optional description, and a
 * cancel/confirm button pair. Composes the `Dialog` primitive (overlay, focus
 * trap, Escape, transitions) — this is the design-system home for the
 * enable/disable/delete/discard pattern that pages were otherwise hand-rolling.
 *
 * For anything richer than "ask a question, get yes/no" (forms, multi-step),
 * compose `Dialog` directly instead.
 */
export const ConfirmDialog = ({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  isConfirming = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps) => (
  <Dialog
    description={description}
    footer={
      <>
        <ActionButton
          disabled={isConfirming}
          onClick={onCancel}
          type='button'
          variant='secondary'
        >
          {cancelLabel}
        </ActionButton>
        <ActionButton
          isLoading={isConfirming}
          onClick={onConfirm}
          type='button'
          variant={tone === 'danger' ? 'destructive' : 'primary'}
        >
          {confirmLabel}
        </ActionButton>
      </>
    }
    isOpen={isOpen}
    onClose={onCancel}
    size='sm'
    title={title}
  />
)

ConfirmDialog.displayName = 'ConfirmDialog'
