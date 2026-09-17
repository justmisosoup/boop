import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, test, vi } from 'vitest'

import { SearchInput } from './SearchInput'

const Harness = ({
  initial = '',
  onChange,
  onClear,
  onSearch
}: {
  initial?: string
  onChange?: (value: string) => void
  onClear?: () => void
  onSearch?: (value: string) => void
}) => {
  const [value, setValue] = useState(initial)

  return (
    <SearchInput
      aria-label='Search object ID'
      onChange={next => {
        setValue(next)
        onChange?.(next)
      }}
      onClear={onClear}
      onSearch={onSearch}
      value={value}
    />
  )
}

describe('SearchInput', () => {
  test('reports typing through onChange', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'biz_42' }
    })

    expect(onChange).toHaveBeenLastCalledWith('biz_42')
  })

  test('fires onSearch with the trimmed value on Enter', () => {
    const onSearch = vi.fn()
    render(<Harness onSearch={onSearch} />)

    const input = screen.getByRole('searchbox')
    fireEvent.change(input, { target: { value: '  biz_42  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSearch).toHaveBeenCalledWith('biz_42')
  })

  test('hides the clear control while empty', () => {
    render(<Harness />)

    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull()
  })

  test('shows a clear control with a value and clears via onChange by default', () => {
    const onChange = vi.fn()
    render(<Harness initial='biz_42' onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))

    expect(onChange).toHaveBeenLastCalledWith('')
  })

  test('prefers onClear over the default clear when provided', () => {
    const onClear = vi.fn()
    const onChange = vi.fn()
    render(<Harness initial='biz_42' onChange={onChange} onClear={onClear} />)

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))

    expect(onClear).toHaveBeenCalledTimes(1)
    expect(onChange).not.toHaveBeenCalled()
  })

  test('composes a consumer onKeyDown with Enter-to-search', () => {
    const onSearch = vi.fn()
    const onKeyDown = vi.fn()
    render(
      <SearchInput
        aria-label='Search'
        onChange={() => {}}
        onKeyDown={onKeyDown}
        onSearch={onSearch}
        value='acme'
      />
    )

    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Enter' })

    expect(onKeyDown).toHaveBeenCalledTimes(1)
    expect(onSearch).toHaveBeenCalledWith('acme')
  })

  test('a consumer onKeyDown can preventDefault to suppress onSearch', () => {
    const onSearch = vi.fn()
    render(
      <SearchInput
        aria-label='Search'
        onChange={() => {}}
        onKeyDown={event => event.preventDefault()}
        onSearch={onSearch}
        value='acme'
      />
    )

    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Enter' })

    expect(onSearch).not.toHaveBeenCalled()
  })

  test('swaps the magnifier for a decorative spinner while loading', () => {
    const { container, rerender } = render(
      <SearchInput aria-label='Search' value='acme' onChange={() => {}} />
    )

    expect(container.querySelector('.core-spinner')).toBeNull()
    expect(container.querySelector('svg.lucide-search')).not.toBeNull()

    rerender(
      <SearchInput
        aria-label='Search'
        loading
        value='acme'
        onChange={() => {}}
      />
    )

    expect(container.querySelector('.core-spinner')).not.toBeNull()
    expect(container.querySelector('svg.lucide-search')).toBeNull()
    // Presentation only — no competing status announcement from the field.
    expect(container.querySelector('[role="status"]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Clear search' })).not.toBeNull()
  })
})
