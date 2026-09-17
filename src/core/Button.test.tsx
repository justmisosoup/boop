import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { Button } from './Button'

describe('Button', () => {
  test('renders children and fires onClick', () => {
    const onClick = vi.fn()

    render(<Button onClick={onClick}>Save</Button>)

    fireEvent.click(screen.getByText('Save'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  test('renders as anchor when href is provided', () => {
    render(<Button href='https://middesk.com'>Visit</Button>)

    const link = screen.getByText('Visit')
    expect(link.tagName).toBe('A')
    expect(link.getAttribute('href')).toBe('https://middesk.com')
  })

  test('does not fire onClick when disabled', () => {
    const onClick = vi.fn()

    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>
    )

    fireEvent.click(screen.getByText('Save'))
    expect(onClick).not.toHaveBeenCalled()
  })
})
