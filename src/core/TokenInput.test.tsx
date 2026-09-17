import { fireEvent, render } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { TokenInput } from './TokenInput'

const getInput = (c: HTMLElement) =>
  c.querySelector('input') as HTMLInputElement

describe('TokenInput', () => {
  test('commits a token on Enter', () => {
    const onChange = vi.fn()
    const { container } = render(
      <TokenInput aria-label='emails' onChange={onChange} value={[]} />
    )
    const input = getInput(container)
    fireEvent.change(input, { target: { value: 'a@x.com' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith(['a@x.com'])
  })

  test('commits a token on comma', () => {
    const onChange = vi.fn()
    const { container } = render(<TokenInput onChange={onChange} value={[]} />)
    const input = getInput(container)
    fireEvent.change(input, { target: { value: 'a@x.com' } })
    fireEvent.keyDown(input, { key: ',' })

    expect(onChange).toHaveBeenCalledWith(['a@x.com'])
  })

  test('splits a pasted list on whitespace / comma / semicolon', () => {
    const onChange = vi.fn()
    const { container } = render(<TokenInput onChange={onChange} value={[]} />)
    fireEvent.paste(getInput(container), {
      clipboardData: { getData: () => 'a@x.com, b@y.com;c@z.com' }
    })

    expect(onChange).toHaveBeenCalledWith(['a@x.com', 'b@y.com', 'c@z.com'])
  })

  test('commits the draft on blur', () => {
    const onChange = vi.fn()
    const { container } = render(<TokenInput onChange={onChange} value={[]} />)
    const input = getInput(container)
    fireEvent.change(input, { target: { value: 'a@x.com' } })
    fireEvent.blur(input)

    expect(onChange).toHaveBeenCalledWith(['a@x.com'])
  })

  test('Backspace on an empty field removes the last chip', () => {
    const onChange = vi.fn()
    const { container } = render(
      <TokenInput onChange={onChange} value={['a@x.com', 'b@y.com']} />
    )
    fireEvent.keyDown(getInput(container), { key: 'Backspace' })

    expect(onChange).toHaveBeenCalledWith(['a@x.com'])
  })

  test('removing a chip drops just that token', () => {
    const onChange = vi.fn()
    const { container } = render(
      <TokenInput onChange={onChange} value={['a@x.com', 'b@y.com']} />
    )
    const remove = container.querySelector(
      'button[aria-label]'
    ) as HTMLButtonElement
    fireEvent.click(remove)

    expect(onChange).toHaveBeenCalledWith(['b@y.com'])
  })

  test('does not add a duplicate token', () => {
    const onChange = vi.fn()
    const { container } = render(
      <TokenInput onChange={onChange} value={['a@x.com']} />
    )
    const input = getInput(container)
    fireEvent.change(input, { target: { value: 'a@x.com' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onChange).not.toHaveBeenCalled()
  })

  test('disabled field renders chips without remove buttons', () => {
    const { container } = render(
      <TokenInput disabled onChange={() => {}} value={['a@x.com']} />
    )

    expect(container.querySelector('button')).toBeNull()
    expect(getInput(container).disabled).toBe(true)
  })
})
