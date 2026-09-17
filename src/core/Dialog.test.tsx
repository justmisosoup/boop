import { createRef } from 'react'

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { Dialog, DialogBody } from './Dialog'

const getOverlay = () => {
  const overlay = screen.getByRole('dialog').parentElement
  if (!overlay) throw new Error('Dialog overlay was not rendered')
  return overlay
}

describe('DialogBody', () => {
  test('does not render an empty body', () => {
    const { container } = render(<DialogBody />)

    expect(container.firstChild).toBeNull()
  })

  test('renders children and forwards its ref and HTML attributes', () => {
    const ref = createRef<HTMLDivElement>()

    render(
      <DialogBody ref={ref} aria-label='Dialog content'>
        Body content
      </DialogBody>
    )

    expect(ref.current).toBe(screen.getByLabelText('Dialog content'))
    expect(screen.getByText('Body content')).not.toBeNull()
  })
})

describe('Dialog', () => {
  test('renders mounted-open dialogs visibly on the first paint', () => {
    render(
      <Dialog isOpen onClose={vi.fn()} title='Welcome'>
        <div>Body content</div>
      </Dialog>
    )

    expect(screen.getByRole('dialog').style.opacity).toBe('1')
  })

  test('closes from the close button', () => {
    const onClose = vi.fn()
    render(
      <Dialog isOpen onClose={onClose} title='Welcome'>
        <div>Body content</div>
      </Dialog>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('can opt out of overlay-click dismissal', () => {
    const onClose = vi.fn()
    render(
      <Dialog
        closeOnOverlayClick={false}
        isOpen
        onClose={onClose}
        title='Welcome'
      >
        <div>Body content</div>
      </Dialog>
    )

    fireEvent.click(getOverlay())
    expect(onClose).not.toHaveBeenCalled()
  })

  test('can opt out of Escape dismissal', () => {
    const onClose = vi.fn()
    render(
      <Dialog closeOnEscape={false} isOpen onClose={onClose} title='Welcome'>
        <div>Body content</div>
      </Dialog>
    )

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  test('can render without a visual header while keeping an accessible name', () => {
    render(
      <Dialog isOpen showHeader={false} title='Welcome'>
        <div>Body content</div>
      </Dialog>
    )

    screen.getByRole('dialog', { name: 'Welcome' })
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
    expect(screen.getByText('Body content')).not.toBeNull()
  })
})
