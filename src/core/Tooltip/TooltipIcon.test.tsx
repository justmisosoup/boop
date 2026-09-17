import React from 'react'

import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { TooltipIcon } from './TooltipIcon'

describe('TooltipIcon', () => {
  test('renders its URL as an external link', () => {
    render(
      <TooltipIcon
        content='More information'
        url='https://example.com/details'
      />
    )

    const link = screen.getByRole('link')

    expect(link.getAttribute('href')).toBe('https://example.com/details')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noreferrer')
    expect(link.getAttribute('type')).toBeNull()
  })
})
