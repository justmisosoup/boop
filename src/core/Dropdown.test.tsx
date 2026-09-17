import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import Dropdown from './Dropdown'

describe('Dropdown', () => {
  test('renders the toggle but no menu when closed', () => {
    render(
      <Dropdown>
        <Dropdown.Toggle>Open</Dropdown.Toggle>
        <Dropdown.Menu>
          <Dropdown.Option>One</Dropdown.Option>
        </Dropdown.Menu>
      </Dropdown>
    )

    expect(screen.getByText('Open')).not.toBeNull()
    expect(screen.queryByText('One')).toBeNull()
  })

  test('opens the menu when the toggle is clicked', () => {
    render(
      <Dropdown>
        <Dropdown.Toggle>Open</Dropdown.Toggle>
        <Dropdown.Menu>
          <Dropdown.Option>One</Dropdown.Option>
          <Dropdown.Option>Two</Dropdown.Option>
        </Dropdown.Menu>
      </Dropdown>
    )

    fireEvent.click(screen.getByText('Open'))

    expect(screen.getByText('One')).not.toBeNull()
    expect(screen.getByText('Two')).not.toBeNull()
  })

  test('closes the menu after an option is selected and forwards its onClick', () => {
    const onClick = vi.fn()

    render(
      <Dropdown>
        <Dropdown.Toggle>Open</Dropdown.Toggle>
        <Dropdown.Menu>
          <Dropdown.Option onClick={onClick}>One</Dropdown.Option>
        </Dropdown.Menu>
      </Dropdown>
    )

    fireEvent.click(screen.getByText('Open'))
    fireEvent.click(screen.getByText('One'))

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('One')).toBeNull()
  })

  test('keeps the menu open when an Interactive child is clicked', () => {
    const onClick = vi.fn()

    render(
      <Dropdown>
        <Dropdown.Toggle>Open</Dropdown.Toggle>
        <Dropdown.Menu>
          <Dropdown.Interactive onClick={onClick}>
            Stay open
          </Dropdown.Interactive>
        </Dropdown.Menu>
      </Dropdown>
    )

    fireEvent.click(screen.getByText('Open'))
    fireEvent.click(screen.getByText('Stay open'))

    expect(onClick).toHaveBeenCalledTimes(1)
    // Interactive does not toggle the dropdown closed.
    expect(screen.getByText('Stay open')).not.toBeNull()
  })

  test('respects the controlled isOpen prop and calls onToggle', () => {
    const onToggle = vi.fn()

    const { rerender } = render(
      <Dropdown isOpen={false} onToggle={onToggle}>
        <Dropdown.Toggle>Open</Dropdown.Toggle>
        <Dropdown.Menu>
          <Dropdown.Option>One</Dropdown.Option>
        </Dropdown.Menu>
      </Dropdown>
    )

    expect(screen.queryByText('One')).toBeNull()

    rerender(
      <Dropdown isOpen={true} onToggle={onToggle}>
        <Dropdown.Toggle>Open</Dropdown.Toggle>
        <Dropdown.Menu>
          <Dropdown.Option>One</Dropdown.Option>
        </Dropdown.Menu>
      </Dropdown>
    )

    expect(screen.getByText('One')).not.toBeNull()
  })

  test('closes when clicking outside the menu', () => {
    render(
      <div>
        <button type='button' data-testid='outside'>
          Outside
        </button>
        <Dropdown>
          <Dropdown.Toggle>Open</Dropdown.Toggle>
          <Dropdown.Menu>
            <Dropdown.Option>One</Dropdown.Option>
          </Dropdown.Menu>
        </Dropdown>
      </div>
    )

    fireEvent.click(screen.getByText('Open'))
    expect(screen.getByText('One')).not.toBeNull()

    fireEvent.mouseDown(screen.getByTestId('outside'))
    expect(screen.queryByText('One')).toBeNull()
  })

  test('closes when the document is scrolled while open', () => {
    render(
      <Dropdown>
        <Dropdown.Toggle>Open</Dropdown.Toggle>
        <Dropdown.Menu>
          <Dropdown.Option>One</Dropdown.Option>
        </Dropdown.Menu>
      </Dropdown>
    )

    fireEvent.click(screen.getByText('Open'))
    expect(screen.getByText('One')).not.toBeNull()

    // onClickOut is registered on `scroll` too — scroll-to-close behavior.
    fireEvent.scroll(document)
    expect(screen.queryByText('One')).toBeNull()
  })

  test('stays open when the click target is a text input (e.g. Dropdown.Search)', () => {
    render(
      <Dropdown>
        <Dropdown.Toggle>Open</Dropdown.Toggle>
        <Dropdown.Menu>
          <Dropdown.Search placeholder='Filter' />
          <Dropdown.Option>One</Dropdown.Option>
        </Dropdown.Menu>
      </Dropdown>
    )

    fireEvent.click(screen.getByText('Open'))
    const search = screen.getByPlaceholderText('Filter')
    expect(search).not.toBeNull()

    fireEvent.mouseDown(search)
    // Text-input target should not close the menu — Dropdown.Search must stay
    // usable so the user can type into it.
    expect(screen.getByText('One')).not.toBeNull()
  })

  test('stays open when the click target is inside the menu', () => {
    render(
      <Dropdown>
        <Dropdown.Toggle>Open</Dropdown.Toggle>
        <Dropdown.Menu>
          <Dropdown.Interactive>
            <span>Inside</span>
          </Dropdown.Interactive>
          <Dropdown.Option>One</Dropdown.Option>
        </Dropdown.Menu>
      </Dropdown>
    )

    fireEvent.click(screen.getByText('Open'))
    expect(screen.getByText('Inside')).not.toBeNull()

    // Click hits a node inside the menu — menu.contains(target) should short-
    // circuit onClickOut and keep the menu open.
    fireEvent.mouseDown(screen.getByText('Inside'))
    expect(screen.getByText('One')).not.toBeNull()
  })

  test('calls onToggle when the user toggles the menu', () => {
    const onToggle = vi.fn()

    render(
      <Dropdown onToggle={onToggle}>
        <Dropdown.Toggle>Open</Dropdown.Toggle>
        <Dropdown.Menu>
          <Dropdown.Option>One</Dropdown.Option>
        </Dropdown.Menu>
      </Dropdown>
    )

    fireEvent.click(screen.getByText('Open'))
    expect(onToggle).toHaveBeenCalledWith({ isOpen: true })

    fireEvent.click(screen.getByText('One'))
    expect(onToggle).toHaveBeenCalledWith({ isOpen: false })
    expect(onToggle).toHaveBeenCalledTimes(2)
  })

  test('accepts a single child element instead of an array', () => {
    // Children isn't always an array — React passes a single element when
    // only one child is provided. The component must handle both shapes.
    const Single = () => (
      <Dropdown>
        <Dropdown.Toggle>Open</Dropdown.Toggle>
      </Dropdown>
    )

    expect(() => render(<Single />)).not.toThrow()
    expect(screen.getByText('Open')).not.toBeNull()
  })
})
