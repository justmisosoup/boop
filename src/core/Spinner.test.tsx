import React from 'react'

import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { ActionButton } from './Action'
import { Spinner } from './Spinner'

describe('Spinner', () => {
  test('exposes a status live region with a default accessible label', () => {
    render(<Spinner />)

    const status = screen.getByRole('status')
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.textContent).toContain('Loading')
  })

  test('uses a custom label', () => {
    render(<Spinner label='Saving policy' />)

    expect(screen.getByRole('status').textContent).toContain('Saving policy')
  })

  test('marks the spinning glyph decorative (aria-hidden)', () => {
    render(<Spinner />)

    const svg = screen.getByRole('status').querySelector('svg')
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
  })

  test('gates the spin behind motion-safe so reduced-motion users get a still glyph', () => {
    render(<Spinner />)

    const svg = screen.getByRole('status').querySelector('svg')
    expect(svg?.getAttribute('class')).toContain('motion-safe:animate-spin')
  })

  test('applies size and tone variant classes', () => {
    render(<Spinner size='lg' tone='muted' />)

    const cls =
      screen.getByRole('status').querySelector('svg')?.getAttribute('class') ??
      ''
    expect(cls).toContain('h-[var(--core-font-size-xl)]')
    expect(cls).toContain('text-[var(--core-color-text-secondary)]')
  })

  test('tone="current" emits no colour class so it inherits currentColor', () => {
    render(<Spinner tone='current' />)

    const cls =
      screen.getByRole('status').querySelector('svg')?.getAttribute('class') ??
      ''
    expect(cls).not.toContain('text-[var(--core-color-text-secondary)]')
  })

  test('label={false} is decorative: no status role and no announced text', () => {
    const { container } = render(<Spinner label={false} />)

    expect(screen.queryByRole('status')).toBeNull()
    expect(container.textContent).toBe('')
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe(
      'true'
    )
  })
})

describe('ActionButton isLoading', () => {
  test('renders a spinning, disabled, busy button (regression: the ring used to be static)', () => {
    render(<ActionButton isLoading>Saving</ActionButton>)

    const button = screen.getByRole('button')
    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(button.hasAttribute('disabled')).toBe(true)

    const spinner = button.querySelector('.core-action-spinner')
    expect(spinner?.getAttribute('class')).toContain('motion-safe:animate-spin')
  })
})
