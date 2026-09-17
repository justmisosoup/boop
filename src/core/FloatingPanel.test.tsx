import { useRef, useState } from 'react'

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import {
  FLOATING_PANEL_INSET_PX,
  FLOATING_PANEL_WINDOW_WIDTH,
  FloatingPanel,
  FloatingPanelBody,
  FloatingPanelFooter,
  FloatingPanelHeader,
  FloatingPanelRow,
  FloatingPanelTitle,
  FloatingPanelTitleSwitcher,
  type FloatingPanelCorner,
  type FloatingPanelPresentation,
  type FloatingPanelResizeOptions,
  type FloatingPanelState
} from './FloatingPanel'
import type { Density } from './internal/density'

const Harness = ({
  density,
  initialState = 'window',
  onCornerChange = vi.fn(),
  onStateChange,
  presentation,
  resizable
}: {
  density?: Density
  initialState?: FloatingPanelState
  onCornerChange?: (corner: FloatingPanelCorner) => void
  onStateChange?: (state: FloatingPanelState) => void
  presentation?: FloatingPanelPresentation
  resizable?: FloatingPanelResizeOptions
}) => {
  const [state, setState] = useState<FloatingPanelState>(initialState)
  const [corner, setCorner] = useState<FloatingPanelCorner>('bottom-right')
  const focusRef = useRef<HTMLButtonElement>(null)

  return (
    <FloatingPanel
      corner={corner}
      density={density}
      initialFocusRef={focusRef}
      label='Assistant'
      launcher={<span>Agents</span>}
      launcherLabel='Agents'
      presentation={presentation}
      resizable={resizable}
      state={state}
      onCornerChange={next => {
        setCorner(next)
        onCornerChange(next)
      }}
      onStateChange={next => {
        setState(next)
        onStateChange?.(next)
      }}
    >
      <FloatingPanelHeader>
        <span>Threads</span>
        <button ref={focusRef} type='button'>
          New thread
        </button>
      </FloatingPanelHeader>
      <FloatingPanelBody>
        <div>Body content</div>
      </FloatingPanelBody>
      <FloatingPanelFooter>
        <button type='button'>Run agent</button>
      </FloatingPanelFooter>
    </FloatingPanel>
  )
}

describe('FloatingPanel', () => {
  test('window state renders a non-modal dialog with header/body/footer', () => {
    render(<Harness />)

    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-label')).toBe('Assistant')
    expect(dialog.getAttribute('aria-modal')).toBe('false')
    expect(dialog.getAttribute('data-state')).toBe('window')
    expect(dialog.getAttribute('data-corner')).toBe('bottom-right')
    expect(screen.getByText('Body content')).not.toBeNull()
    // Non-modal contract: the page keeps scrolling — no body scroll lock.
    expect(document.body.style.overflow).not.toBe('hidden')
  })

  test('body is a contained scroll boundary so wheel gestures do not bleed into the page', () => {
    render(<Harness />)

    const body = screen.getByText('Body content').parentElement
    expect(body?.className).toContain('overflow-y-auto')
    expect(body?.className).toContain('overscroll-contain')
  })

  test('pill state hides the dialog from assistive tech and shows the launcher', () => {
    render(<Harness initialState='pill' />)

    // The panel stays mounted (content survives minimize) but is aria-hidden,
    // so it is not exposed as a dialog.
    expect(screen.queryByRole('dialog')).toBeNull()
    const launcher = screen.getByRole('button', { name: 'Agents' })
    expect(launcher.getAttribute('aria-haspopup')).toBe('dialog')
    expect(launcher.getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByText('Body content')).not.toBeNull()
  })

  test('clicking the launcher opens the window and focuses the initial control', () => {
    const onStateChange = vi.fn()
    render(<Harness initialState='pill' onStateChange={onStateChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Agents' }))

    expect(onStateChange).toHaveBeenCalledWith('window')
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'New thread' })
    )
  })

  test('Escape inside the panel minimizes to the pill and returns focus to it', () => {
    const onStateChange = vi.fn()
    render(<Harness onStateChange={onStateChange} />)

    const inside = screen.getByRole('button', { name: 'Run agent' })
    inside.focus()
    fireEvent.keyDown(inside, { key: 'Escape' })

    expect(onStateChange).toHaveBeenCalledWith('pill')
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Agents' })
    )
  })

  test('Escape outside the panel does nothing', () => {
    const onStateChange = vi.fn()
    render(
      <>
        <button type='button'>Page control</button>
        <Harness onStateChange={onStateChange} />
      </>
    )

    const outside = screen.getByRole('button', { name: 'Page control' })
    outside.focus()
    fireEvent.keyDown(outside, { key: 'Escape' })

    expect(onStateChange).not.toHaveBeenCalled()
  })

  test('mount in a persisted open state does not steal focus', () => {
    render(<Harness />)

    expect(document.activeElement).toBe(document.body)
  })

  test('expanded state keeps the same dialog and reports its state', () => {
    render(<Harness initialState='expanded' />)

    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('data-state')).toBe('expanded')
  })

  describe('docked presentation', () => {
    test('is a complementary landmark, not a dialog — page furniture takes no dialog semantics', () => {
      render(<Harness presentation='docked' />)

      expect(screen.queryByRole('dialog')).toBeNull()
      const rail = screen.getByRole('complementary', { name: 'Assistant' })
      expect(rail.getAttribute('aria-modal')).toBeNull()
      expect(rail.getAttribute('data-presentation')).toBe('docked')
      expect(screen.getByText('Body content')).not.toBeNull()
    })

    test('is in flow and reserves its own width instead of overlaying the page', () => {
      render(<Harness presentation='docked' />)

      const rail = screen.getByRole('complementary')
      expect(rail.className).not.toContain('fixed')
      // Sticky is what holds the rail while the document scrolls underneath.
      expect(rail.className).toContain('sticky')
      expect(rail.style.width).toBe('400px')
    })

    test('Escape does not minimize a rail — Escape belongs to the page around furniture', () => {
      const onStateChange = vi.fn()
      render(<Harness presentation='docked' onStateChange={onStateChange} />)

      const inside = screen.getByRole('button', { name: 'Run agent' })
      inside.focus()
      fireEvent.keyDown(inside, { key: 'Escape' })

      expect(onStateChange).not.toHaveBeenCalled()
    })

    test('opening a rail does not steal focus, but minimizing still hands it to the launcher', () => {
      const onStateChange = vi.fn()
      render(
        <Harness
          initialState='pill'
          presentation='docked'
          onStateChange={onStateChange}
        />
      )

      const launcher = screen.getByRole('button', { name: 'Agents' })
      fireEvent.click(launcher)

      expect(onStateChange).toHaveBeenCalledWith('window')
      expect(document.activeElement).not.toBe(
        screen.getByRole('button', { name: 'New thread' })
      )
    })

    test('the pill state collapses the rail to zero width, releasing the page space', () => {
      render(<Harness initialState='pill' presentation='docked' />)

      // Still mounted — content survives minimize in both presentations.
      expect(screen.getByText('Body content')).not.toBeNull()
      const rail = document.querySelector('[data-presentation="docked"]')
      expect((rail as HTMLElement).style.width).toBe('0px')
      expect(rail?.getAttribute('aria-hidden')).toBe('true')
      // `aria-hidden` only affects the accessibility tree. `inert` also keeps
      // the zero-width rail's buttons and resize separator out of tab order.
      expect(rail?.hasAttribute('inert')).toBe(true)
    })

    test('resizable exposes the window-splitter separator with the given bounds', () => {
      render(
        <Harness
          presentation='docked'
          resizable={{ minWidth: 320, maxWidth: 560, defaultWidth: 440 }}
        />
      )

      const handle = screen.getByRole('separator', { name: 'Resize panel' })
      expect(handle.getAttribute('aria-orientation')).toBe('vertical')
      expect(handle.getAttribute('aria-valuemin')).toBe('320')
      expect(handle.getAttribute('aria-valuemax')).toBe('560')
      expect(handle.getAttribute('aria-valuenow')).toBe('440')
      expect(screen.getByRole('complementary').style.width).toBe('440px')
    })

    test('tracks externally clamped width when viewport-derived bounds change', () => {
      const { rerender } = render(
        <Harness
          presentation='docked'
          resizable={{ minWidth: 320, maxWidth: 560, defaultWidth: 560 }}
        />
      )

      expect(screen.getByRole('complementary').style.width).toBe('560px')

      rerender(
        <Harness
          presentation='docked'
          resizable={{ minWidth: 320, maxWidth: 360, defaultWidth: 360 }}
        />
      )

      expect(screen.getByRole('complementary').style.width).toBe('360px')
      expect(screen.getByRole('separator').getAttribute('aria-valuenow')).toBe(
        '360'
      )
    })

    test('arrow keys resize and commit once per step', () => {
      const onResizeEnd = vi.fn()
      render(
        <Harness
          presentation='docked'
          resizable={{
            minWidth: 320,
            maxWidth: 560,
            defaultWidth: 400,
            onResizeEnd
          }}
        />
      )

      const handle = screen.getByRole('separator')
      // Left widens a right-anchored rail.
      fireEvent.keyDown(handle, { key: 'ArrowLeft' })
      expect(onResizeEnd).toHaveBeenCalledWith(416)

      fireEvent.keyDown(handle, { key: 'End' })
      expect(onResizeEnd).toHaveBeenLastCalledWith(560)
    })

    test('the floating window ignores resizable — its size comes from its state', () => {
      render(
        <Harness
          resizable={{ minWidth: 320, maxWidth: 560, defaultWidth: 440 }}
        />
      )

      expect(screen.queryByRole('separator')).toBeNull()
      expect(screen.getByRole('dialog').style.width).toBe('')
    })
  })

  test('header parts throw outside FloatingPanel', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() =>
      render(<FloatingPanelHeader>Header</FloatingPanelHeader>)
    ).toThrow(/must be rendered inside <FloatingPanel>/)

    spy.mockRestore()
  })

  describe('title', () => {
    test('the caption is a sibling of the title, never inside the trigger', () => {
      render(
        <FloatingPanelTitle caption='73 entities · 4 asks'>
          <FloatingPanelTitleSwitcher>Apple Inc.</FloatingPanelTitleSwitcher>
        </FloatingPanelTitle>
      )

      // The caption must stay OUT of the trigger's accessible name — a live
      // region nested in a button re-announces on every focus change, and the
      // name would drift every time the scope changed.
      const trigger = screen.getByRole('button')
      expect(trigger.textContent).toBe('Apple Inc.')
      expect(screen.getByText('73 entities · 4 asks')).not.toBeNull()
    })

    test('captionLive opts the caption into a polite live region', () => {
      const { rerender } = render(
        <FloatingPanelTitle caption='3 selected'>Apple Inc.</FloatingPanelTitle>
      )
      expect(
        screen.getByText('3 selected').getAttribute('aria-live')
      ).toBeNull()

      rerender(
        <FloatingPanelTitle captionLive caption='3 selected'>
          Apple Inc.
        </FloatingPanelTitle>
      )
      expect(screen.getByText('3 selected').getAttribute('aria-live')).toBe(
        'polite'
      )
    })

    test('the switcher is a real button so the header drag guard sees it', () => {
      // FloatingPanel's pointer guard treats `button` targets as clicks, not
      // drags — a non-button trigger would be swallowed by the drag handle.
      const onClick = vi.fn()
      render(
        <FloatingPanelTitleSwitcher glyph={<span>G</span>} onClick={onClick}>
          Apple Inc.
        </FloatingPanelTitleSwitcher>
      )

      const trigger = screen.getByRole('button')
      expect(trigger.getAttribute('type')).toBe('button')
      fireEvent.click(trigger)
      expect(onClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('row', () => {
    test('renders glyph, title, gist and meta', () => {
      render(
        <FloatingPanelRow
          gist='Who else shares this address?'
          icon={<span data-testid='glyph' />}
          meta='2m'
          title='Apple Inc.'
        />
      )

      expect(screen.getByTestId('glyph')).not.toBeNull()
      expect(screen.getByText('Apple Inc.')).not.toBeNull()
      expect(screen.getByText('Who else shares this address?')).not.toBeNull()
      expect(screen.getByText('2m')).not.toBeNull()
    })

    test('selected is aria-current — these rows navigate, they are not options', () => {
      const { rerender } = render(<FloatingPanelRow title='Apple Inc.' />)
      expect(screen.getByRole('button').getAttribute('aria-current')).toBeNull()

      rerender(<FloatingPanelRow selected title='Apple Inc.' />)
      const row = screen.getByRole('button')
      expect(row.getAttribute('aria-current')).toBe('true')
      // never aria-selected: that belongs to a listbox option
      expect(row.getAttribute('aria-selected')).toBeNull()
    })

    test('a row without a gist stays single-line', () => {
      render(<FloatingPanelRow meta='1h' title='Keystone Pipe Trading' />)

      const row = screen.getByRole('button')
      expect(row.textContent).toContain('Keystone Pipe Trading')
      expect(row.className).toContain('items-center')
      expect(row.className).not.toContain('items-start')
    })
  })

  describe('density', () => {
    test('default is standard — geometry and chrome are the pre-density values', () => {
      render(<Harness />)

      const dialog = screen.getByRole('dialog')
      expect(dialog.getAttribute('data-density')).toBe('standard')
      expect(dialog.className).toContain('w-[440px]')
      expect(dialog.className).toContain('h-[clamp(520px,72dvh,720px)]')

      const header = screen.getByText('Threads').parentElement
      expect(header?.className).toContain('h-12')
      expect(header?.className).toContain('pl-4')

      const footer = screen.getByRole('button', {
        name: 'Run agent'
      }).parentElement
      expect(footer?.className).toContain('h-12')
    })

    test('compact narrows the window and tightens the chrome', () => {
      render(<Harness density='compact' />)

      const dialog = screen.getByRole('dialog')
      expect(dialog.getAttribute('data-density')).toBe('compact')
      expect(dialog.className).toContain('w-[336px]')
      expect(dialog.className).toContain('h-[clamp(480px,64dvh,640px)]')

      const header = screen.getByText('Threads').parentElement
      expect(header?.className).toContain('h-10')
      expect(header?.className).toContain('pl-3')

      const footer = screen.getByRole('button', {
        name: 'Run agent'
      }).parentElement
      expect(footer?.className).toContain('h-10')
    })

    test('the exported width constants match the rendered class literals', () => {
      // The class must be a static literal for the Tailwind scanner, so the
      // number lives twice — this is the tripwire if the two drift.
      for (const density of ['standard', 'compact'] as const) {
        const { unmount } = render(<Harness density={density} />)
        expect(screen.getByRole('dialog').className).toContain(
          `w-[${FLOATING_PANEL_WINDOW_WIDTH[density]}px]`
        )
        unmount()
      }
      expect(FLOATING_PANEL_INSET_PX).toBe(24)
    })

    test('density flows to parts by context, and an explicit prop wins', () => {
      render(
        <FloatingPanel
          corner='bottom-left'
          density='compact'
          label='Assistant'
          launcher={<span>Agents</span>}
          state='window'
          onStateChange={() => {}}
        >
          <FloatingPanelRow title='Inherited' />
          <FloatingPanelRow density='standard' title='Overridden' />
        </FloatingPanel>
      )

      expect(
        screen.getByRole('button', { name: 'Inherited' }).className
      ).toContain('py-1.5')
      const overridden = screen.getByRole('button', { name: 'Overridden' })
      expect(overridden.className).toContain('py-2')
      expect(overridden.className).not.toContain('py-1.5')
    })

    test('standalone parts outside a panel default to standard', () => {
      render(
        <>
          <FloatingPanelRow title='Loose row' />
          <FloatingPanelTitleSwitcher>Apple Inc.</FloatingPanelTitleSwitcher>
        </>
      )

      expect(
        screen.getByRole('button', { name: 'Loose row' }).className
      ).toContain('py-2')
      expect(
        screen.getByRole('button', { name: 'Apple Inc.' }).className
      ).toContain('text-sm')
    })

    test('TitleSwitcher compact drops to the 13px anchor type', () => {
      render(
        <FloatingPanelTitleSwitcher density='compact'>
          Apple Inc.
        </FloatingPanelTitleSwitcher>
      )

      expect(
        screen.getByRole('button', { name: 'Apple Inc.' }).className
      ).toContain('text-dense')
    })
  })
})
