import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { SourceView } from '.'

describe('SourceView', () => {
  test('renders object content as pretty-printed source', () => {
    const { container } = render(
      <SourceView content={{ name: 'Acme' }} language='json' />
    )

    expect(container.textContent).toContain('Acme')
  })

  test('renders a copy control with the given label', () => {
    render(
      <SourceView content={{ a: 1 }} copyLabel='Copy JSON' language='json' />
    )

    expect(screen.getByRole('button', { name: 'Copy JSON' })).not.toBeNull()
  })

  test('renders nothing when content is empty', () => {
    const { container } = render(
      <SourceView content={undefined} language='json' />
    )

    expect(container.firstChild).toBeNull()
  })
})
