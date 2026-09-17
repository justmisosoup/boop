import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, test } from 'vitest'

import { Markdown } from './Markdown'

const renderMarkdown = (markdown: string) =>
  render(
    <MemoryRouter>
      <Markdown>{markdown}</Markdown>
    </MemoryRouter>
  )

describe('Markdown', () => {
  test('renders bullet lists as list items, not literal dashes', () => {
    renderMarkdown('Lead sentence.\n\n- First point\n- Second point')

    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0].textContent).toBe('First point')
    expect(document.body.textContent).not.toContain('- First')
  })

  test('renders emphasis as elements, not literal markers', () => {
    renderMarkdown('This is **bold** and *italic*.')

    expect(screen.getByText('bold').tagName).toBe('STRONG')
    expect(screen.getByText('italic').tagName).toBe('EM')
    expect(document.body.textContent).not.toContain('**')
  })

  test('routes cross-origin links to a new tab', () => {
    renderMarkdown('See [the docs](https://example.com/docs).')

    const link = screen.getByRole('link', { name: 'the docs' })
    expect(link.getAttribute('href')).toBe('https://example.com/docs')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  test('routes same-origin links through the SPA router', () => {
    renderMarkdown('Back to [settings](/settings/team).')

    const link = screen.getByRole('link', { name: 'settings' })
    expect(link.getAttribute('href')).toBe('/settings/team')
    expect(link.getAttribute('target')).toBeNull()
  })

  test('renders an anchor without an href as plain text', () => {
    renderMarkdown('An empty [link]().')

    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('link').tagName).toBe('SPAN')
  })

  test('keeps raw HTML inert', () => {
    renderMarkdown('before <img src=x onerror="window.pwned=1"> after')

    expect(document.querySelector('img')).toBeNull()
    expect((window as unknown as { pwned?: number }).pwned).toBeUndefined()
  })

  test('renders a softbreak as a visual line break via pre-wrap', () => {
    renderMarkdown('line one\nline two')

    const paragraph = screen.getByText(/line one/)
    expect(paragraph.textContent).toBe('line one\nline two')
    expect(window.getComputedStyle(paragraph).whiteSpace).toBe('pre-wrap')
  })

  test('renders plain text unchanged as a single paragraph', () => {
    const plain = 'A plain legacy summary with no markup at all.'
    renderMarkdown(plain)

    expect(screen.getByText(plain).tagName).toBe('P')
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })
})
