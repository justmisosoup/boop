import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import type { ChatSourceData } from './ChatSources'
import { ChatSourceChip, ChatSources } from './ChatSources'
import { FloatingPanel } from './FloatingPanel'

const REGISTRY: ChatSourceData = {
  id: 'sos',
  label: 'California Secretary of State',
  url: 'https://www.sos.ca.gov/business/be/12345',
  title: 'Statement of Information — Middesk Inc.',
  snippet: 'Entity listed as active at 85 2nd Street, Suite 710.',
  annotation: 'Government registry'
}

const NEWS: ChatSourceData = {
  id: 'news',
  label: 'Regional Business Journal',
  url: 'https://news.example.com/articles/1',
  title: 'Identity platform expands verification coverage'
}

const EVIDENCE: ChatSourceData = {
  id: 'evidence',
  label: 'Site visit evidence',
  title: 'Street View capture',
  onSelect: () => {}
}

describe('ChatSourceChip', () => {
  test('a single source with a url renders a link opening in a new tab', () => {
    render(<ChatSourceChip sources={[REGISTRY]} />)

    const link = screen.getByRole('link', {
      name: 'Source: Statement of Information — Middesk Inc.'
    })
    expect(link.getAttribute('href')).toBe(REGISTRY.url)
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noreferrer')
  })

  test('a single source without a url renders a button that fires onSelect', () => {
    const onSelect = vi.fn()
    render(<ChatSourceChip sources={[{ ...EVIDENCE, onSelect }]} />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Source: Street View capture' })
    )
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  test('focusing a single-source chip opens the preview with title, byline, and snippet', () => {
    vi.useFakeTimers()
    try {
      render(<ChatSourceChip sources={[REGISTRY]} />)

      act(() => {
        fireEvent.focus(screen.getByRole('link'))
        vi.advanceTimersByTime(400)
      })

      expect(
        screen.getByText('Statement of Information — Middesk Inc.')
      ).toBeDefined()
      expect(screen.getByText('sos.ca.gov · Government registry')).toBeDefined()
      expect(
        screen.getByText('Entity listed as active at 85 2nd Street, Suite 710.')
      ).toBeDefined()
    } finally {
      vi.useRealTimers()
    }
  })

  test('the chip text prefers the domain and falls back to the label', () => {
    const { rerender } = render(
      <ChatSourceChip
        sources={[
          { id: 'a', label: 'OpenCorporates', domain: 'opencorporates.com' }
        ]}
      />
    )
    expect(screen.getByText(/opencorporates\.com/)).toBeDefined()

    rerender(
      <ChatSourceChip sources={[{ id: 'a', label: 'OpenCorporates' }]} />
    )
    expect(screen.getByText(/OpenCorporates/)).toBeDefined()
  })

  test('the domain derives from the url with www. stripped when not provided', () => {
    render(<ChatSourceChip sources={[REGISTRY]} />)

    expect(screen.getByRole('link').textContent).toContain('sos.ca.gov')
  })

  test('several sources render one +N chip whose popover lists every source as a real link or button', () => {
    render(<ChatSourceChip sources={[REGISTRY, NEWS, EVIDENCE]} />)

    const chip = screen.getByRole('button', { name: '3 sources' })
    expect(chip.textContent).toContain('+2')

    fireEvent.click(chip)

    expect(
      screen
        .getByRole('link', {
          name: /Statement of Information — Middesk Inc\./
        })
        .getAttribute('href')
    ).toBe(REGISTRY.url)
    expect(
      screen.getByRole('link', {
        name: /Identity platform expands verification coverage/
      })
    ).toBeDefined()
    expect(
      screen.getByRole('button', { name: /Street View capture/ })
    ).toBeDefined()
  })

  // Focus return to the trigger is Radix FocusScope behavior that jsdom's
  // synthetic focus model doesn't reproduce — covered by the workbench
  // keyboard pass instead.
  test('Escape closes the +N popover', () => {
    render(<ChatSourceChip sources={[REGISTRY, NEWS]} />)

    const chip = screen.getByRole('button', { name: '2 sources' })
    chip.focus()
    fireEvent.click(chip)
    expect(
      screen.getByRole('link', { name: /Statement of Information/ })
    ).toBeDefined()

    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' })

    expect(
      screen.queryByRole('link', { name: /Statement of Information/ })
    ).toBeNull()
    expect(chip.getAttribute('aria-expanded')).toBe('false')
  })

  test('a consumer icon replaces the deterministic letter tile', () => {
    render(
      <ChatSourceChip
        sources={[{ ...REGISTRY, icon: <svg data-testid='custom-glyph' /> }]}
      />
    )

    expect(screen.getByTestId('custom-glyph')).toBeDefined()
  })

  test('a source with no destination renders static text with no hover preview', () => {
    render(<ChatSourceChip sources={[{ id: 'a', label: 'Internal note' }]} />)

    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText(/Internal note/)).toBeDefined()
  })

  test('renders nothing for an empty source list', () => {
    const { container } = render(<ChatSourceChip sources={[]} />)

    expect(container.firstChild).toBeNull()
  })
})

describe('ChatSources', () => {
  test('renders stacked glyphs with a visible count and opens the full list on click', () => {
    render(<ChatSources sources={[REGISTRY, NEWS, EVIDENCE]} />)

    const trigger = screen.getByRole('button', { name: 'Sources · 3' })
    fireEvent.click(trigger)

    expect(
      screen.getByRole('link', { name: /Statement of Information/ })
    ).toBeDefined()
    expect(
      screen.getByRole('button', { name: /Street View capture/ })
    ).toBeDefined()
  })

  test('the trigger reports its expanded state to assistive tech', () => {
    render(<ChatSources sources={[REGISTRY]} />)

    const trigger = screen.getByRole('button', { name: 'Sources · 1' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })

  test('list rows commit: urls open in a new tab, url-less rows fire onSelect', () => {
    const onSelect = vi.fn()
    render(<ChatSources sources={[REGISTRY, { ...EVIDENCE, onSelect }]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Sources · 2' }))

    const link = screen.getByRole('link', { name: /Statement of Information/ })
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noreferrer')

    fireEvent.click(screen.getByRole('button', { name: /Street View capture/ }))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  test('renders nothing when sources is empty', () => {
    const { container } = render(<ChatSources sources={[]} />)

    expect(container.firstChild).toBeNull()
  })
})

describe('density', () => {
  test('the chip and the sources row are density-invariant at the 24px floor', () => {
    render(
      <FloatingPanel
        corner='bottom-left'
        density='compact'
        label='Dock'
        launcher={<span>Open</span>}
        state='window'
        onStateChange={() => {}}
      >
        <ChatSourceChip sources={[REGISTRY]} />
        <ChatSources sources={[REGISTRY]} />
      </FloatingPanel>
    )

    const chip = screen.getByRole('link', { name: /Statement of Information/ })
    expect(chip.className).toContain('text-caption')
    expect(chip.className).toContain('py-px')
    expect(
      screen.getByRole('button', { name: 'Sources · 1' }).className
    ).toContain('h-6')
  })
})
