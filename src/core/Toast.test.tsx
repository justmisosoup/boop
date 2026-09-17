import React from 'react'

import { render } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { useToast } from './Toast'

vi.mock('sonner', async () => {
  const actual = await vi.importActual<typeof import('sonner')>('sonner')
  const fn = vi.fn()
  const toast = Object.assign(fn, {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn()
  })

  return {
    ...actual,
    toast,
    Toaster: () => null
  }
})

describe('useToast', () => {
  test('dispatches a success toast through sonner', async () => {
    const { toast } = await import('sonner')

    const Trigger = () => {
      const { showToast } = useToast()

      React.useEffect(() => {
        showToast({ text: 'Saved', appearance: 'success' })
      }, [showToast])

      return null
    }

    render(<Trigger />)

    expect(
      (toast as unknown as { success: ReturnType<typeof vi.fn> }).success
    ).toHaveBeenCalledWith('Saved', expect.anything())
  })

  test('dispatches an error toast through sonner', async () => {
    const { toast } = await import('sonner')

    const Trigger = () => {
      const { showToast } = useToast()

      React.useEffect(() => {
        showToast({ text: 'Boom', appearance: 'error' })
      }, [showToast])

      return null
    }

    render(<Trigger />)

    expect(
      (toast as unknown as { error: ReturnType<typeof vi.fn> }).error
    ).toHaveBeenCalledWith('Boom', expect.anything())
  })
})
