import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import Pagination from './Pagination'

describe('Pagination', () => {
  it('renders nothing when total fits on one page', () => {
    const { container } = render(<Pagination page={1} perPage={10} total={5} />)
    expect(container.innerHTML).toBe('')
  })

  it('self-scopes .core-theme when no ancestor provides it', () => {
    const { container } = render(
      <Pagination page={2} perPage={10} total={45} />
    )
    expect(
      container.querySelector('nav')?.classList.contains('core-theme')
    ).toBe(true)
  })

  it('does not re-scope .core-theme when an ancestor already provides it', () => {
    const { container } = render(
      <div className='core-theme'>
        <Pagination page={2} perPage={10} total={45} />
      </div>
    )
    expect(
      container.querySelector('nav')?.classList.contains('core-theme')
    ).toBe(false)
  })

  it('shows page-of-total label and only prev/next controls', () => {
    render(<Pagination page={2} perPage={10} total={45} />)
    expect(screen.getByText('Page 2 of 5')).toBeTruthy()
    // Only the two arrow controls render — no numbered page buttons.
    expect(screen.queryByText('3')).toBeNull()
    expect(screen.getByLabelText('Go to previous page')).toBeTruthy()
    expect(screen.getByLabelText('Go to next page')).toBeTruthy()
  })

  it('fires onPage with the next page on next click', () => {
    const onPage = vi.fn()
    render(<Pagination page={2} perPage={10} total={45} onPage={onPage} />)
    fireEvent.click(screen.getByLabelText('Go to next page'))
    expect(onPage).toHaveBeenCalledWith(3)
  })

  it('fires onPage with the previous page on prev click', () => {
    const onPage = vi.fn()
    render(<Pagination page={3} perPage={10} total={45} onPage={onPage} />)
    fireEvent.click(screen.getByLabelText('Go to previous page'))
    expect(onPage).toHaveBeenCalledWith(2)
  })

  it('disables prev on the first page and next on the last page', () => {
    const onPage = vi.fn()
    const { rerender } = render(
      <Pagination page={1} perPage={10} total={45} onPage={onPage} />
    )
    const prev = screen.getByLabelText('Go to previous page')
    expect(prev.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(prev)
    expect(onPage).not.toHaveBeenCalled()

    rerender(<Pagination page={5} perPage={10} total={45} onPage={onPage} />)
    const next = screen.getByLabelText('Go to next page')
    expect(next.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(next)
    expect(onPage).not.toHaveBeenCalled()
  })

  it('forwards className to the root element (for styled() wrappers)', () => {
    const { container } = render(
      <Pagination page={2} perPage={10} total={45} className='custom-cls' />
    )
    expect(
      container.querySelector('nav')?.classList.contains('custom-cls')
    ).toBe(true)
  })

  it('keeps next enabled and shows "Page X" when total is unknown', () => {
    const onPage = vi.fn()
    render(<Pagination page={4} total={null} onPage={onPage} />)
    expect(screen.getByText('Page 4')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Go to next page'))
    expect(onPage).toHaveBeenCalledWith(5)
  })

  it('persistent keeps a single page rendered with both arrows disabled', () => {
    const onPage = vi.fn()
    render(
      <Pagination page={1} perPage={10} persistent total={5} onPage={onPage} />
    )
    expect(screen.getByText('Page 1 of 1')).toBeTruthy()

    const next = screen.getByLabelText('Go to next page')
    expect(next.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(next)
    expect(onPage).not.toHaveBeenCalled()
    expect(
      screen.getByLabelText('Go to previous page').getAttribute('aria-disabled')
    ).toBe('true')
  })

  it('persistent floors an empty list at "Page 1 of 1"', () => {
    render(<Pagination page={1} perPage={10} persistent total={0} />)
    expect(screen.getByText('Page 1 of 1')).toBeTruthy()
    expect(
      screen.getByLabelText('Go to next page').getAttribute('aria-disabled')
    ).toBe('true')
  })
})
