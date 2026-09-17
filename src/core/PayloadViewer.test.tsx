import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { PayloadViewer } from './PayloadViewer'

describe('PayloadViewer', () => {
  test('renders nothing for an empty payload', () => {
    const { container } = render(<PayloadViewer payload={null} />)

    expect(container.textContent).toBe('')
  })

  test('renders a title and the formatted JSON', () => {
    const { container } = render(
      <PayloadViewer
        payload={{ event: 'business.created', id: 'wh_1' }}
        title='Request'
      />
    )

    expect(screen.getByText('Request')).not.toBeNull()
    expect(container.textContent).toContain('business.created')
  })

  test('unwraps a stringified body before rendering', () => {
    const { container } = render(
      <PayloadViewer payload={{ body: JSON.stringify({ nested: true }) }} />
    )

    expect(container.textContent).toContain('nested')
  })

  test('anchors the pinned actions outside the scrolling body', () => {
    // The actions sit in the frame, not the scrollport, so their offset
    // resolves against the visible edge rather than the scrollbar's reserved
    // gutter. `getByRole` also fails on a duplicate, which guards the single
    // render shared by both the scrolling and non-scrolling paths.
    const { container } = render(
      <PayloadViewer payload={{ id: 'biz_42' }} scrollBody showDownload />
    )

    const scrollport = container.querySelector('.overflow-auto')

    expect(scrollport).not.toBeNull()
    expect(
      scrollport?.contains(
        screen.getByRole('button', { name: 'Copy to clipboard' })
      )
    ).toBe(false)
    expect(
      scrollport?.contains(
        screen.getByRole('button', { name: 'Download response' })
      )
    ).toBe(false)
  })

  test('hides the scrollbar until the scrolling body is hovered or focused', () => {
    const { container } = render(
      <PayloadViewer payload={{ id: 'biz_42' }} scrollBody showLineNumbers />
    )

    // These have to survive `cn()` together — tailwind-merge treats arbitrary
    // properties as their own conflict groups, so a merge bug would drop one
    // silently: losing the gutter lets the content box resize per platform,
    // and losing either reveal leaves the scrollbar permanently invisible.
    const scrollport = container.querySelector('.overflow-auto')
    const tinted = 'scrollbar-color:var(--core-color-border-strong)_transparent'

    for (const className of [
      '[@media(hover:hover)]:[scrollbar-width:thin]',
      '[@media(hover:hover)]:[scrollbar-gutter:stable]',
      '[@media(hover:hover)]:[scrollbar-color:transparent_transparent]',
      `hover:[${tinted}]`,
      `[@media(hover:hover)]:focus-within:[${tinted}]`
    ]) {
      expect(scrollport?.classList.contains(className)).toBe(true)
    }
  })

  test('still offers the actions when the body does not scroll', () => {
    const { container } = render(
      <PayloadViewer payload={{ id: 'biz_42' }} showDownload />
    )

    expect(container.querySelector('.overflow-auto')).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Copy to clipboard' })
    ).not.toBeNull()
    expect(
      screen.getByRole('button', { name: 'Download response' })
    ).not.toBeNull()
  })

  test('shows the oversize copy/download fallback for huge bodies', () => {
    render(<PayloadViewer payload={'x'.repeat(600 * 1024)} />)

    expect(screen.getByText(/too large to display/i)).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Download file' })).not.toBeNull()
    expect(
      screen.getByRole('button', { name: 'Copy to clipboard' })
    ).not.toBeNull()
  })
})
