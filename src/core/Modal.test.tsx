import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { Modal } from './Modal'

describe('Modal', () => {
  test('does not render content when closed', () => {
    render(
      <Modal isOpen={false} close={vi.fn()} title='Test'>
        <div>Body</div>
      </Modal>
    )

    expect(screen.queryByText('Body')).toBeNull()
  })

  test('renders title and body when open', () => {
    render(
      <Modal isOpen close={vi.fn()} title='Confirm'>
        <div>Are you sure?</div>
      </Modal>
    )

    expect(screen.getByText('Confirm')).not.toBeNull()
    expect(screen.getByText('Are you sure?')).not.toBeNull()
  })

  test('fires close when the close icon is clicked', () => {
    const close = vi.fn()

    render(
      <Modal isOpen close={close} title='Confirm'>
        <div>Body</div>
      </Modal>
    )

    fireEvent.click(screen.getByLabelText('close'))
    expect(close).toHaveBeenCalledTimes(1)
  })

  test('fires confirm when the confirm button is clicked', () => {
    const confirm = vi.fn()

    render(
      <Modal
        isOpen
        close={vi.fn()}
        confirm={confirm}
        confirmLabel='Yes'
        title='Confirm'
      >
        <div>Body</div>
      </Modal>
    )

    fireEvent.click(screen.getByText('Yes'))
    expect(confirm).toHaveBeenCalledTimes(1)
  })
})
