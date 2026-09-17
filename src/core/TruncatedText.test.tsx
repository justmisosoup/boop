import { render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, test } from 'vitest'

import { TruncatedText } from './TruncatedText'

beforeAll(() => {
  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
  // The Radix tooltip trigger calls pointer-capture APIs jsdom doesn't provide.
  window.HTMLElement.prototype.hasPointerCapture = () => false
})

// jsdom doesn't lay out, so `scrollWidth`/`clientWidth` are 0 by default. Drive
// the overflow decision by stubbing them on the element prototype per test.
const mockWidths = (scrollWidth: number, clientWidth: number) => {
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get: () => scrollWidth
  })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => clientWidth
  })
}

// Capture the original (jsdom) descriptors so each test fully restores them and
// can't leak the stubbed widths into other test files.
const originalWidthDescriptors = {
  scrollWidth: Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'scrollWidth'
  ),
  clientWidth: Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'clientWidth'
  )
}

afterEach(() => {
  for (const prop of ['scrollWidth', 'clientWidth'] as const) {
    const original = originalWidthDescriptors[prop]
    if (original) {
      Object.defineProperty(HTMLElement.prototype, prop, original)
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, prop)
    }
  }
})

describe('TruncatedText', () => {
  test('renders plain text with no tooltip trigger when it fits', () => {
    mockWidths(80, 80)
    render(<TruncatedText>Acme Inc</TruncatedText>)

    expect(screen.getByText('Acme Inc')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  test('wraps the text in a tooltip trigger when it overflows', () => {
    mockWidths(220, 80)
    const value = 'A very long business name that gets clipped'
    render(<TruncatedText>{value}</TruncatedText>)

    const trigger = screen.getByRole('button')
    expect(trigger.textContent).toBe(value)
  })
})
