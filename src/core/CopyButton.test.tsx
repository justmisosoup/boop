import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'

const showToast = vi.fn()
vi.mock('./Toast', () => ({ useToast: () => ({ showToast }) }))

import { CopyButton } from './CopyButton'

const stubClipboard = (writeText: () => Promise<void>) =>
  Object.assign(navigator, { clipboard: { writeText } })

describe('CopyButton', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  test('writes the value to the clipboard and announces success', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    stubClipboard(writeText)

    render(<CopyButton label='Copy secret' value='whsec_123' />)

    fireEvent.click(screen.getByRole('button', { name: 'Copy secret' }))

    expect(writeText).toHaveBeenCalledWith('whsec_123')
    // confirmed both on the button name and in the polite live region
    expect(
      await screen.findByRole('button', { name: 'Copied to clipboard' })
    ).not.toBeNull()
    expect(screen.getByRole('status').textContent).toBe('Copied to clipboard')
  })

  test('reverts to the idle label after the reset delay', async () => {
    vi.useFakeTimers()
    stubClipboard(() => Promise.resolve())

    render(<CopyButton label='Copy secret' value='x' />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy secret' }))
      await Promise.resolve()
    })
    expect(
      screen.getByRole('button', { name: 'Copied to clipboard' })
    ).not.toBeNull()

    act(() => vi.advanceTimersByTime(1500))

    expect(screen.getByRole('button', { name: 'Copy secret' })).not.toBeNull()
  })

  test('toasts an error when the clipboard write fails', async () => {
    stubClipboard(vi.fn(() => Promise.reject(new Error('blocked'))))

    render(<CopyButton value='x' />)

    fireEvent.click(screen.getByRole('button', { name: 'Copy to clipboard' }))

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ appearance: 'error' })
      )
    )
  })

  test('uses the provided label as the idle accessible name', () => {
    stubClipboard(vi.fn(() => Promise.resolve()))

    render(<CopyButton label='Copy endpoint URL' value='x' />)

    expect(
      screen.getByRole('button', { name: 'Copy endpoint URL' })
    ).not.toBeNull()
  })
})
