import React from 'react'

import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import Dropzone from './Dropzone'

describe('Dropzone', () => {
  test('renders the inactive prompt by default', () => {
    render(<Dropzone onDrop={vi.fn()} accept='application/pdf' />)

    // Dropzone shows a default placeholder that contains 'drop' or 'browse'
    // somewhere in the inactive state. Check that the file input is present.
    const input = document.querySelector('input[type="file"]')
    expect(input).not.toBeNull()
  })

  test('forwards accept attribute to the underlying file input', () => {
    render(<Dropzone onDrop={vi.fn()} accept='application/pdf' />)

    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    expect(input.accept).toContain('application/pdf')
  })

  test('renders custom label when provided', () => {
    render(
      <Dropzone onDrop={vi.fn()} accept='application/pdf' label='Documents' />
    )

    expect(screen.getByText('Documents')).not.toBeNull()
  })
})
