import React from 'react'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, describe, expect, test, vi } from 'vitest'

import { HelpIcon, Hint, HintContent, HintProvider, HintTrigger } from './Hint'

beforeAll(() => {
  if (!window.PointerEvent) {
    window.PointerEvent = MouseEvent as unknown as typeof PointerEvent
  }

  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }

  window.HTMLElement.prototype.scrollIntoView = () => {}
  window.HTMLElement.prototype.hasPointerCapture = () => false
  window.HTMLElement.prototype.releasePointerCapture = () => {}
  window.HTMLElement.prototype.setPointerCapture = () => {}
})

const hoverTrigger = (element: HTMLElement) => {
  fireEvent.pointerMove(element, { pointerType: 'mouse' })
}

describe('Hint', () => {
  test('simple API opens on hover and renders themed, portaled content', async () => {
    render(
      <Hint
        content='Definition of the field'
        delayDuration={0}
        themeMode='dark'
      >
        Registered agent
      </Hint>
    )

    hoverTrigger(screen.getByText('Registered agent'))

    // Radix exposes a visually-hidden a11y bridge with role=tooltip.
    const tooltip = await screen.findByRole('tooltip')
    expect(tooltip.textContent).toContain('Definition of the field')

    // The styled overlay is the wrapper carrying the core theme contract.
    const content = document.querySelector('.core-hint-content')
    expect(content).not.toBeNull()
    expect(content?.className).toContain('core-theme')
    expect(content?.getAttribute('data-theme')).toBe('dark')
    // Portaled out of the inline flow.
    expect(content?.closest('body')).toBe(document.body)
  })

  test('works without a HintProvider ancestor (local provider fallback)', async () => {
    expect(() =>
      render(
        <Hint content='Standalone' delayDuration={0}>
          Trigger
        </Hint>
      )
    ).not.toThrow()

    hoverTrigger(screen.getByText('Trigger'))

    const tooltip = await screen.findByRole('tooltip')
    expect(tooltip.textContent).toContain('Standalone')
  })

  test('opens on keyboard focus, closes on Escape', async () => {
    render(
      <Hint content='Keyboard reachable' delayDuration={0}>
        Focusable trigger
      </Hint>
    )

    const trigger = screen.getByText('Focusable trigger')
    fireEvent.focus(trigger)

    const tooltip = await screen.findByRole('tooltip')
    expect(tooltip.textContent).toContain('Keyboard reachable')

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).toBeNull()
    })
  })

  test('simple API trigger is a non-submitting button', () => {
    const onSubmit = vi.fn(event => event.preventDefault())

    render(
      <form onSubmit={onSubmit}>
        <Hint content='No accidental submits' delayDuration={0}>
          In a form
        </Hint>
      </form>
    )

    const trigger = screen.getByText('In a form')
    expect(trigger.getAttribute('type')).toBe('button')

    fireEvent.click(trigger)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  test('asChild reuses the child element instead of nesting buttons', async () => {
    render(
      <Hint asChild content='Action description' delayDuration={0}>
        <button type='button'>Run check</button>
      </Hint>
    )

    const trigger = screen.getByRole('button', { name: 'Run check' })
    expect(trigger.querySelector('button')).toBeNull()

    hoverTrigger(trigger)

    const tooltip = await screen.findByRole('tooltip')
    expect(tooltip.textContent).toContain('Action description')
  })

  test('underline affordance marks text triggers as hoverable', () => {
    render(
      <Hint content='Definition' delayDuration={0} underline>
        Good standing
      </Hint>
    )

    const trigger = screen.getByText('Good standing')
    expect(trigger.className).toContain('decoration-dashed')
  })

  test('composable API applies size, arrow, and maxWidth contracts', async () => {
    render(
      <HintProvider delayDuration={0}>
        <Hint>
          <HintTrigger>Composed</HintTrigger>
          <HintContent arrow={false} maxWidth={240} size='compact'>
            Compact content
          </HintContent>
        </Hint>
      </HintProvider>
    )

    hoverTrigger(screen.getByText('Composed'))

    await screen.findByRole('tooltip')

    const content = document.querySelector<HTMLElement>('.core-hint-content')
    expect(content).not.toBeNull()
    expect(content?.getAttribute('data-size')).toBe('compact')
    expect(content?.style.maxWidth).toBe('240px')

    const viewport = document.querySelector<HTMLElement>(
      '.core-hint-scroll-viewport'
    )
    expect(viewport).not.toBeNull()
    expect(viewport?.className).toContain('overflow-y-auto')
    expect(viewport?.style.maxHeight).toBe(
      'var(--radix-tooltip-content-available-height)'
    )
  })
})

describe('HelpIcon', () => {
  test('is a named, keyboard-focusable button that reveals its content', async () => {
    render(
      <HintProvider delayDuration={0}>
        <HelpIcon content='Explains the risk score' />
      </HintProvider>
    )

    const trigger = screen.getByRole('button', { name: 'More information' })
    expect(trigger.getAttribute('type')).toBe('button')

    fireEvent.focus(trigger)

    const tooltip = await screen.findByRole('tooltip')
    expect(tooltip.textContent).toContain('Explains the risk score')
  })

  test('supports a custom accessible label', () => {
    render(
      <HintProvider delayDuration={0}>
        <HelpIcon content='TIN match details' label='About TIN match' />
      </HintProvider>
    )

    expect(
      screen.getByRole('button', { name: 'About TIN match' })
    ).not.toBeNull()
  })
})
