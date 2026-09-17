import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, test, vi } from 'vitest'

import { TextTooltip } from './TextTooltip'
import { Tooltip } from './Tooltip'

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

describe('Tooltip', () => {
  test('trigger is a non-submitting button inside a form', () => {
    const onSubmit = vi.fn(event => event.preventDefault())

    render(
      <form onSubmit={onSubmit}>
        <Tooltip
          content='Tooltip content'
          delayDuration={0}
          trigger={<span>Help</span>}
        />
      </form>
    )

    const trigger = screen.getByText('Help').closest('button')!
    expect(trigger.getAttribute('type')).toBe('button')

    fireEvent.click(trigger)
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe('TextTooltip', () => {
  test('trigger is a non-submitting button inside a form', () => {
    const onSubmit = vi.fn(event => event.preventDefault())

    render(
      <form onSubmit={onSubmit}>
        <TextTooltip
          content='Tooltip content'
          delayDuration={0}
          trigger={<span>Underlined term</span>}
        />
      </form>
    )

    const trigger = screen.getByText('Underlined term').closest('button')!
    expect(trigger.getAttribute('type')).toBe('button')

    fireEvent.click(trigger)
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
