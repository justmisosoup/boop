import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, test, vi } from 'vitest'

import { Combobox, type ComboboxOption } from './Combobox'

const OPTIONS: ComboboxOption[] = [
  { label: 'business.created', value: 'business.created', group: 'business' },
  { label: 'business.updated', value: 'business.updated', group: 'business' },
  { label: 'order.updated', value: 'order.updated', group: 'order' }
]

const Harness = ({
  initial = [],
  multiple = true,
  onChange
}: {
  initial?: string[]
  multiple?: boolean
  onChange?: (value: string[]) => void
}) => {
  const [value, setValue] = useState<string[]>(initial)

  return (
    <Combobox
      aria-label='Events'
      multiple={multiple}
      options={OPTIONS}
      value={value}
      onChange={next => {
        setValue(next)
        onChange?.(next)
      }}
    />
  )
}

const openMenu = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Events' }))

describe('Combobox', () => {
  test('shows the placeholder when empty and opens to list options', () => {
    render(<Harness />)

    expect(screen.getByText('Select…')).not.toBeNull()

    openMenu()

    expect(screen.getByRole('listbox')).not.toBeNull()
    expect(
      screen.getByRole('option', { name: /business\.created/ })
    ).not.toBeNull()
  })

  test('multi-selects values', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    openMenu()
    fireEvent.click(screen.getByRole('option', { name: /business\.created/ }))
    fireEvent.click(screen.getByRole('option', { name: /order\.updated/ }))

    expect(onChange).toHaveBeenLastCalledWith([
      'business.created',
      'order.updated'
    ])
  })

  test('toggles a selected value off', () => {
    const onChange = vi.fn()
    render(<Harness initial={['order.updated']} onChange={onChange} />)

    openMenu()
    fireEvent.click(screen.getByRole('option', { name: /order\.updated/ }))

    expect(onChange).toHaveBeenLastCalledWith([])
  })

  test('filters options by search query', () => {
    render(<Harness />)

    openMenu()
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'order' }
    })

    expect(
      screen.queryByRole('option', { name: /business\.created/ })
    ).toBeNull()
    expect(
      screen.getByRole('option', { name: /order\.updated/ })
    ).not.toBeNull()
  })

  test('shows the empty message when nothing matches', () => {
    render(<Harness />)

    openMenu()
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'zzz' }
    })

    expect(screen.getByText('No matches.')).not.toBeNull()
  })

  test('renders namespace group headers', () => {
    render(<Harness />)

    openMenu()

    expect(screen.getByText('business')).not.toBeNull()
    expect(screen.getByText('order')).not.toBeNull()
  })

  test('single-select replaces the value and closes the popover', () => {
    const onChange = vi.fn()
    render(<Harness multiple={false} onChange={onChange} />)

    openMenu()
    fireEvent.click(screen.getByRole('option', { name: /business\.created/ }))

    expect(onChange).toHaveBeenLastCalledWith(['business.created'])
    // Selecting closes the popover in single-select mode.
    expect(screen.queryByRole('listbox')).toBeNull()
    // The trigger reflects the single selection (no tags).
    expect(
      screen.getByRole('button', { name: 'Events' }).textContent
    ).toContain('business.created')

    openMenu()
    fireEvent.click(screen.getByRole('option', { name: /order\.updated/ }))

    // Picking another replaces rather than appends.
    expect(onChange).toHaveBeenLastCalledWith(['order.updated'])
  })

  test('single-select marks the selected option with a trailing check, no leading checkbox', () => {
    render(<Harness multiple={false} initial={['business.created']} />)

    openMenu()

    // The leading multi-select checkbox square (border-border) is not rendered
    // in single-select mode.
    const container = screen.getByRole('listbox')
    expect(container.querySelector('.border-border')).toBeNull()

    // The selected option shows a trailing check icon; an unselected one does not.
    const selected = screen.getByRole('option', { name: /business\.created/ })
    const unselected = screen.getByRole('option', { name: /order\.updated/ })
    expect(selected.querySelector('svg')).not.toBeNull()
    expect(unselected.querySelector('svg')).toBeNull()
  })

  test('renders selected values as removable tags in multi-select', () => {
    const onChange = vi.fn()
    render(
      <Harness
        initial={['business.created', 'order.updated']}
        onChange={onChange}
      />
    )

    // Each selection has a remove control, even with the popover closed.
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove order.updated' })
    )

    expect(onChange).toHaveBeenLastCalledWith(['business.created'])
  })
})
