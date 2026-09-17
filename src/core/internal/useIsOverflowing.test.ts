import { renderHook } from '@testing-library/react'
import { beforeAll, describe, expect, test } from 'vitest'

import { useIsOverflowing } from './useIsOverflowing'

beforeAll(() => {
  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

const elementWith = (scrollWidth: number, clientWidth: number) => {
  const element = document.createElement('div')
  Object.defineProperty(element, 'scrollWidth', {
    configurable: true,
    value: scrollWidth
  })
  Object.defineProperty(element, 'clientWidth', {
    configurable: true,
    value: clientWidth
  })
  return element
}

describe('useIsOverflowing', () => {
  test('is true when content is wider than the box', () => {
    const ref = { current: elementWith(120, 80) }
    const { result } = renderHook(() => useIsOverflowing(ref))
    expect(result.current).toBe(true)
  })

  test('is false when content fits the box', () => {
    const ref = { current: elementWith(80, 80) }
    const { result } = renderHook(() => useIsOverflowing(ref))
    expect(result.current).toBe(false)
  })

  test('is false when there is no element', () => {
    const ref = { current: null }
    const { result } = renderHook(() => useIsOverflowing(ref))
    expect(result.current).toBe(false)
  })
})
