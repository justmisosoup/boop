import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { Drawer } from './LegacyDrawer'

describe('LegacyDrawer', () => {
  test('renders title and children', () => {
    render(
      <Drawer isOpen onClose={vi.fn()} title='Details'>
        <div>Body</div>
      </Drawer>
    )

    expect(screen.getByText('Details')).not.toBeNull()
    expect(screen.getByText('Body')).not.toBeNull()
  })

  test('fires onClose when the close button is clicked', () => {
    const onClose = vi.fn()

    render(
      <Drawer isOpen onClose={onClose} title='Details'>
        <div>Body</div>
      </Drawer>
    )

    fireEvent.click(screen.getByLabelText('Close drawer'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('fires onClose when Escape is pressed', () => {
    const onClose = vi.fn()

    render(
      <Drawer isOpen onClose={onClose} title='Details'>
        <div>Body</div>
      </Drawer>
    )

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('does not fire onClose on Escape when closeOnEscape is false', () => {
    const onClose = vi.fn()

    render(
      <Drawer closeOnEscape={false} isOpen onClose={onClose} title='Details'>
        <div>Body</div>
      </Drawer>
    )

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })
})
