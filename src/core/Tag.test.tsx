import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { Tag } from './Tag'

describe('Tag', () => {
  test('renders its content and is static (no button) by default', () => {
    render(<Tag>order.updated</Tag>)

    expect(screen.getByText('order.updated')).not.toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })

  test('renders a remove button that fires onRemove', () => {
    const onRemove = vi.fn()
    render(
      <Tag onRemove={onRemove} removeLabel='Remove order.updated'>
        order.updated
      </Tag>
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'Remove order.updated' })
    )

    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  test('defaults the remove label to "Remove"', () => {
    render(<Tag onRemove={() => undefined}>events</Tag>)

    expect(screen.getByRole('button', { name: 'Remove' })).not.toBeNull()
  })

  test('disables the remove button when disabled', () => {
    render(
      <Tag disabled onRemove={() => undefined} removeLabel='Remove events'>
        events
      </Tag>
    )

    expect(
      (
        screen.getByRole('button', {
          name: 'Remove events'
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
  })

  test('renders a leading icon', () => {
    render(<Tag icon={<svg data-testid='leading-icon' />}>events</Tag>)

    expect(screen.getByTestId('leading-icon')).not.toBeNull()
  })
})
