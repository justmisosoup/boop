import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, test, vi } from 'vitest'

import { FacetFilter, type FacetFilterOption } from './FacetFilter'

const OPTIONS: FacetFilterOption[] = [
  { label: 'business.created', value: 'business.created' },
  { label: 'business.updated', value: 'business.updated' },
  { label: 'order.created', value: 'order.created' }
]

const Harness = ({
  initial = [],
  onChange,
  options = OPTIONS,
  searchable
}: {
  initial?: string[]
  onChange?: (value: string[]) => void
  options?: FacetFilterOption[]
  searchable?: boolean
}) => {
  const [value, setValue] = useState<string[]>(initial)

  return (
    <FacetFilter
      aria-label='Event type'
      label='Event type'
      onChange={next => {
        setValue(next)
        onChange?.(next)
      }}
      options={options}
      searchable={searchable}
      value={value}
    />
  )
}

const open = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Event type' }))

describe('FacetFilter', () => {
  test('opens to list every option as a checkbox', () => {
    render(<Harness />)

    open()

    expect(screen.getAllByRole('checkbox')).toHaveLength(3)
    expect(
      screen.getByRole('checkbox', { name: /business\.created/ })
    ).not.toBeNull()
  })

  test('toggles a value on and back off', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    open()
    fireEvent.click(screen.getByRole('checkbox', { name: /business\.created/ }))

    expect(onChange).toHaveBeenLastCalledWith(['business.created'])

    fireEvent.click(screen.getByRole('checkbox', { name: /business\.created/ }))

    expect(onChange).toHaveBeenLastCalledWith([])
  })

  test('surfaces the selected count on the trigger', () => {
    render(<Harness initial={['business.created', 'order.created']} />)

    expect(
      screen.getByRole('button', { name: 'Event type' }).textContent
    ).toContain('2')
  })

  test('clears every selection from the footer', () => {
    const onChange = vi.fn()
    render(<Harness initial={['business.created']} onChange={onChange} />)

    open()
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))

    expect(onChange).toHaveBeenLastCalledWith([])
  })

  test('filters options through the in-popover search', () => {
    render(<Harness searchable />)

    open()
    fireEvent.change(screen.getByPlaceholderText('Filter…'), {
      target: { value: 'order' }
    })

    expect(
      screen.queryByRole('checkbox', { name: /business\.created/ })
    ).toBeNull()
    expect(
      screen.getByRole('checkbox', { name: /order\.created/ })
    ).not.toBeNull()
  })

  test('renders nothing when there are no options', () => {
    render(<Harness options={[]} />)

    expect(screen.queryByRole('button', { name: 'Event type' })).toBeNull()
  })
})
