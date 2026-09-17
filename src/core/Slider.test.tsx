import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, test } from 'vitest'

import { Slider } from './Slider'

beforeAll(() => {
  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

describe('Slider', () => {
  test('applies its accessible label to the interactive thumb', () => {
    render(<Slider aria-label='Confidence threshold' value={0.9} />)

    expect(
      screen.getByRole('slider', { name: 'Confidence threshold' })
    ).not.toBeNull()
  })

  test('supports a visible label through aria-labelledby', () => {
    render(
      <>
        <span id='threshold-label'>Confidence threshold</span>
        <Slider aria-labelledby='threshold-label' value={0.9} />
      </>
    )

    expect(
      screen.getByRole('slider', { name: 'Confidence threshold' })
    ).not.toBeNull()
  })
})
