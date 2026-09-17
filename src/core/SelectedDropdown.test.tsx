import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import SelectedDropdown from './SelectedDropdown'

const OPTIONS = [
  { value: 'one', label: 'One' },
  { value: 'two', label: 'Two' }
]

describe('SelectedDropdown', () => {
  // Regression: styled-components v6 overwrote the `theme` prop that
  // react-select v5's internal Control forwards to its default styler,
  // causing "Cannot read properties of undefined (reading 'colors')" on
  // first render. See EGX-2981.
  test('renders without crashing when the menu is open', () => {
    expect(() =>
      render(
        <SelectedDropdown
          options={OPTIONS}
          value='one'
          ariaLabel='Selection'
          defaultMenuIsOpen
        />
      )
    ).not.toThrow()

    expect(screen.getByText('One')).not.toBeNull()
    expect(screen.getByText('Two')).not.toBeNull()
  })
})
