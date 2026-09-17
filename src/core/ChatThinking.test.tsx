import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import type { ChatThinkingStep } from './ChatThinking'
import { ChatThinking } from './ChatThinking'
import { FloatingPanel } from './FloatingPanel'

const STEPS: ChatThinkingStep[] = [
  {
    id: 'plan',
    label: 'Reading the request',
    description: 'Deciding which registries answer it.'
  },
  {
    id: 'search',
    label: 'Searching registries',
    chips: [
      { id: 'query', label: 'site:sos.ca.gov middesk' },
      { id: 'page', label: 'sos.ca.gov', url: 'https://www.sos.ca.gov' }
    ]
  }
]

const getSummary = () =>
  screen.getByRole('button', { name: /Thought|Thinking/ })

describe('ChatThinking', () => {
  test('collapsed by default with a summary formatted from duration', () => {
    render(<ChatThinking duration={45_000} steps={STEPS} />)

    const summary = getSummary()
    expect(summary.textContent).toContain('Thought for 45s')
    expect(summary.getAttribute('aria-expanded')).toBe('false')
  })

  test('formats minute-scale durations as 1m 12s and clamps sub-second to 1s', () => {
    const { rerender } = render(
      <ChatThinking duration={72_000} steps={STEPS} />
    )
    expect(getSummary().textContent).toContain('Thought for 1m 12s')

    rerender(<ChatThinking duration={120_000} steps={STEPS} />)
    expect(getSummary().textContent).toContain('Thought for 2m')

    rerender(<ChatThinking duration={300} steps={STEPS} />)
    expect(getSummary().textContent).toContain('Thought for 1s')
  })

  test('while active the summary defaults to Thinking… and the root is aria-busy', () => {
    const { container } = render(<ChatThinking active />)

    expect(screen.getByText('Thinking…')).toBeDefined()
    expect(
      (container.firstChild as HTMLElement).getAttribute('aria-busy')
    ).toBe('true')
  })

  test('expanding wires aria-expanded and aria-controls to the step region', () => {
    render(<ChatThinking duration={45_000} steps={STEPS} />)

    const summary = getSummary()
    fireEvent.click(summary)

    expect(summary.getAttribute('aria-expanded')).toBe('true')
    const regionId = summary.getAttribute('aria-controls')
    expect(regionId).toBeTruthy()
    const region = document.getElementById(regionId as string) as HTMLElement
    expect(region.getAttribute('aria-hidden')).toBeNull()
    expect(region.textContent).toContain('Searching registries')
  })

  test('collapsed steps stay mounted but inert and hidden from the accessibility tree', () => {
    render(<ChatThinking duration={45_000} steps={STEPS} />)

    const region = document.getElementById(
      getSummary().getAttribute('aria-controls') as string
    ) as HTMLElement
    expect(region.textContent).toContain('Reading the request')
    expect(region.getAttribute('aria-hidden')).toBe('true')
    expect(region.hasAttribute('inert')).toBe(true)

    fireEvent.click(getSummary())
    expect(region.hasAttribute('inert')).toBe(false)
  })

  test('auto-expands while active once steps exist and settles closed when the run ends', () => {
    const { rerender } = render(<ChatThinking active steps={STEPS} />)
    expect(getSummary().getAttribute('aria-expanded')).toBe('true')

    rerender(<ChatThinking duration={45_000} steps={STEPS} />)
    expect(getSummary().getAttribute('aria-expanded')).toBe('false')
  })

  test('a user toggle overrides auto expand and collapse for the rest of the run', () => {
    const { rerender } = render(<ChatThinking active steps={STEPS} />)

    fireEvent.click(getSummary())
    expect(getSummary().getAttribute('aria-expanded')).toBe('false')

    rerender(<ChatThinking duration={45_000} steps={STEPS} />)
    expect(getSummary().getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(getSummary())
    rerender(<ChatThinking active steps={STEPS} />)
    expect(getSummary().getAttribute('aria-expanded')).toBe('true')
  })

  test('controlled open disables auto behavior and reports through onOpenChange', () => {
    const onOpenChange = vi.fn()
    render(
      <ChatThinking
        active
        open={false}
        steps={STEPS}
        onOpenChange={onOpenChange}
      />
    )

    const summary = getSummary()
    expect(summary.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(summary)
    expect(onOpenChange).toHaveBeenCalledWith(true)
    expect(summary.getAttribute('aria-expanded')).toBe('false')
  })

  test('defaultOpen pins the disclosure open across activity changes', () => {
    const { rerender } = render(
      <ChatThinking defaultOpen duration={45_000} steps={STEPS} />
    )
    expect(getSummary().getAttribute('aria-expanded')).toBe('true')

    rerender(<ChatThinking active defaultOpen steps={STEPS} />)
    rerender(<ChatThinking defaultOpen duration={45_000} steps={STEPS} />)
    expect(getSummary().getAttribute('aria-expanded')).toBe('true')
  })

  test('without steps the summary is plain text, not a disclosure button', () => {
    render(<ChatThinking duration={45_000} />)

    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Thought for 45s')).toBeDefined()
  })

  test('a custom label replaces the default summary in both states', () => {
    const { rerender } = render(
      <ChatThinking active label='Searching the web' steps={STEPS} />
    )
    expect(screen.getByText('Searching the web')).toBeDefined()

    rerender(
      <ChatThinking duration={45_000} label='Searched the web' steps={STEPS} />
    )
    expect(screen.getByText('Searched the web')).toBeDefined()
  })

  test('step status drives the ink and screen-reader prefix on failed and skipped steps', () => {
    render(
      <ChatThinking
        defaultOpen
        steps={[
          { id: 'bad', label: 'Watchlist screen', status: 'error' },
          { id: 'skip', label: 'Street View', status: 'skipped' }
        ]}
      />
    )

    const failed = screen.getByText('Watchlist screen')
    expect(failed.className).toContain('text-[var(--core-color-text-danger)]')
    expect(screen.getByText('Failed:')).toBeDefined()
    expect(screen.getByText('Skipped:')).toBeDefined()
  })

  test('step chips with a url render links; label-only chips are static text', () => {
    render(<ChatThinking defaultOpen steps={STEPS} />)

    const page = screen.getByRole('link', { name: 'sos.ca.gov' })
    expect(page.getAttribute('target')).toBe('_blank')

    expect(screen.getByText('site:sos.ca.gov middesk')).toBeDefined()
    expect(
      screen.queryByRole('button', { name: 'site:sos.ca.gov middesk' })
    ).toBeNull()
  })
})

describe('density', () => {
  test('standard thinking summary uses the 14px/24 ramp; compact drops to caption', () => {
    const { rerender } = render(
      <ChatThinking duration={45_000} steps={STEPS} />
    )
    expect(getSummary().className).toContain('text-sm')
    expect(getSummary().className).toContain('leading-6')

    rerender(<ChatThinking density='compact' duration={45_000} steps={STEPS} />)
    expect(getSummary().className).toContain('text-caption')
    expect(getSummary().className).not.toContain('leading-6')
  })

  test('step rows keep the caption ramp in both densities; compact tightens spacing only', () => {
    const { rerender } = render(
      <ChatThinking defaultOpen duration={45_000} steps={STEPS} />
    )
    const row = () =>
      screen.getByText('Reading the request').closest('div.flex.items-start')
    expect(row()?.className).toContain('py-1')

    rerender(
      <ChatThinking
        defaultOpen
        density='compact'
        duration={45_000}
        steps={STEPS}
      />
    )
    expect(row()?.className).toContain('py-0.5')
    expect(screen.getByText('Reading the request').className).toContain(
      'text-caption'
    )
  })

  test('density inherits from a surrounding FloatingPanel; an explicit prop wins', () => {
    render(
      <FloatingPanel
        corner='bottom-left'
        density='compact'
        label='Dock'
        launcher={<span>Open</span>}
        state='window'
        onStateChange={() => {}}
      >
        <ChatThinking duration={45_000} steps={STEPS} />
        <ChatThinking
          density='standard'
          duration={12_000}
          steps={[{ id: 'x', label: 'Overridden' }]}
        />
      </FloatingPanel>
    )

    const summaries = screen.getAllByRole('button', { name: /Thought for/ })
    expect(summaries[0].className).toContain('text-caption')
    expect(summaries[1].className).toContain('leading-6')
  })
})
