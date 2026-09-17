import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { Toggle } from './Toggle'

describe('Toggle', () => {
  test('fires onCheckedChange with the next boolean when clicked', () => {
    const onCheckedChange = vi.fn()
    render(
      <Toggle onCheckedChange={onCheckedChange}>Email notifications</Toggle>
    )

    fireEvent.click(screen.getByRole('switch', { name: 'Email notifications' }))

    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })

  test('reflects the controlled checked state', () => {
    const { rerender } = render(<Toggle checked={false}>Beta</Toggle>)
    const toggle = screen.getByRole('switch', { name: 'Beta' })

    expect(toggle.getAttribute('data-state')).toBe('unchecked')
    expect(toggle.getAttribute('aria-checked')).toBe('false')

    rerender(<Toggle checked>Beta</Toggle>)

    expect(toggle.getAttribute('data-state')).toBe('checked')
    expect(toggle.getAttribute('aria-checked')).toBe('true')
  })

  test('honors defaultChecked when uncontrolled', () => {
    render(<Toggle defaultChecked>On</Toggle>)

    expect(
      screen.getByRole('switch', { name: 'On' }).getAttribute('data-state')
    ).toBe('checked')
  })

  test('does not toggle when disabled', () => {
    const onCheckedChange = vi.fn()
    render(
      <Toggle disabled onCheckedChange={onCheckedChange}>
        Managed by SSO
      </Toggle>
    )
    const toggle = screen.getByRole('switch', { name: 'Managed by SSO' })

    expect(toggle).toHaveProperty('disabled', true)
    fireEvent.click(toggle)
    expect(onCheckedChange).not.toHaveBeenCalled()
  })

  test('keeps the accessible name the label and exposes the description separately', () => {
    render(
      <Toggle description='Receive a weekly digest of new businesses.'>
        Weekly summary
      </Toggle>
    )

    const toggle = screen.getByRole('switch', {
      name: 'Weekly summary',
      description: 'Receive a weekly digest of new businesses.'
    })

    expect(toggle).toBeTruthy()
  })

  test('sets aria-invalid when invalid', () => {
    render(<Toggle isInvalid>Invalid</Toggle>)

    expect(
      screen
        .getByRole('switch', { name: 'Invalid' })
        .getAttribute('aria-invalid')
    ).toBe('true')
  })
})
