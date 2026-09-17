import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { SegmentedControl, SegmentedControlItem } from './SegmentedControl'

const renderControl = (value: string, onValueChange = vi.fn()) =>
  render(
    <SegmentedControl
      aria-label='View'
      value={value}
      onValueChange={onValueChange}
    >
      <SegmentedControlItem value='all'>All</SegmentedControlItem>
      <SegmentedControlItem value='success'>Succeeded</SegmentedControlItem>
      <SegmentedControlItem value='failure'>Failed</SegmentedControlItem>
    </SegmentedControl>
  )

describe('SegmentedControl', () => {
  test('renders every segment', () => {
    renderControl('all')

    expect(screen.getByText('All')).not.toBeNull()
    expect(screen.getByText('Succeeded')).not.toBeNull()
    expect(screen.getByText('Failed')).not.toBeNull()
  })

  test('selecting another segment reports the new value', () => {
    const onValueChange = vi.fn()
    renderControl('all', onValueChange)

    fireEvent.click(screen.getByText('Succeeded'))

    expect(onValueChange).toHaveBeenCalledWith('success')
  })

  test('re-pressing the active segment does not deselect it', () => {
    const onValueChange = vi.fn()
    renderControl('all', onValueChange)

    // Radix toggle-group emits '' when the active item is pressed again; the
    // segmented control swallows it so a filter always keeps one choice.
    fireEvent.click(screen.getByText('All'))

    expect(onValueChange).not.toHaveBeenCalled()
  })

  test('marks the active segment via data-state', () => {
    renderControl('success')

    const active = screen.getByText('Succeeded').closest('button')

    expect(active?.getAttribute('data-state')).toBe('on')
  })
})
