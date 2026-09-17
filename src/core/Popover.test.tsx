import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { Popover, PopoverContent, PopoverTrigger } from './Popover'

describe('Popover', () => {
  test('applies open and closed fade animation classes to content', async () => {
    render(
      <Popover open>
        <PopoverTrigger>Filters</PopoverTrigger>
        <PopoverContent>Filter options</PopoverContent>
      </Popover>
    )

    const content = await screen.findByText('Filter options')
    expect(content.className).toContain('data-[state=open]:animate-popover-in')
    expect(content.className).toContain(
      'data-[state=closed]:animate-popover-out'
    )
  })
})
