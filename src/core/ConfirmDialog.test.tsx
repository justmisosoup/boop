import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { ConfirmDialog } from './ConfirmDialog'

const baseProps = {
  isOpen: true,
  title: 'Discard unsaved changes?',
  description: 'You have unsaved changes. If you leave now, they will be lost.',
  confirmLabel: 'Discard changes',
  cancelLabel: 'Keep editing',
  onConfirm: vi.fn(),
  onCancel: vi.fn()
}

describe('ConfirmDialog', () => {
  test('renders title, description, and both actions when open', () => {
    render(
      <ConfirmDialog {...baseProps} onCancel={vi.fn()} onConfirm={vi.fn()} />
    )

    expect(
      screen.getByRole('dialog', {
        name: 'Discard unsaved changes?',
        description:
          'You have unsaved changes. If you leave now, they will be lost.'
      })
    ).not.toBeNull()
    expect(screen.getByText('Discard unsaved changes?')).not.toBeNull()
    expect(screen.getByText(/If you leave now/)).not.toBeNull()
    expect(
      screen.getByRole('button', { name: 'Discard changes' })
    ).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Keep editing' })).not.toBeNull()
  })

  test('renders nothing when closed', () => {
    render(
      <ConfirmDialog
        {...baseProps}
        isOpen={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    )

    expect(screen.queryByText('Discard unsaved changes?')).toBeNull()
  })

  test('confirm and cancel fire their handlers', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <ConfirmDialog {...baseProps} onCancel={onCancel} onConfirm={onConfirm} />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  test('Escape routes to onCancel', () => {
    const onCancel = vi.fn()
    render(
      <ConfirmDialog {...baseProps} onCancel={onCancel} onConfirm={vi.fn()} />
    )

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  test('danger tone paints the confirm button destructive', () => {
    render(
      <ConfirmDialog
        {...baseProps}
        tone='danger'
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    )

    const confirm = screen.getByRole('button', { name: 'Discard changes' })
    expect(confirm.className).toContain('destructive')
  })

  test('isConfirming disables both actions', () => {
    render(
      <ConfirmDialog
        {...baseProps}
        isConfirming
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'Keep editing' })).toHaveProperty(
      'disabled',
      true
    )
  })
})
