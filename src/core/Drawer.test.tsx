import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, describe, expect, test, vi } from 'vitest'

import { Drawer } from './Drawer'

// jsdom has no PointerEvent / pointer capture — same polyfill as DataTable.
beforeAll(() => {
  if (!window.PointerEvent) {
    window.PointerEvent = MouseEvent as unknown as typeof PointerEvent
  }

  window.HTMLElement.prototype.hasPointerCapture = () => false
  window.HTMLElement.prototype.releasePointerCapture = () => {}
  window.HTMLElement.prototype.setPointerCapture = () => {}
})

describe('Drawer', () => {
  test('renders title + children as a dialog when open', () => {
    render(
      <Drawer isOpen onClose={vi.fn()} title='Webhook details'>
        <div>Body content</div>
      </Drawer>
    )

    expect(screen.getByRole('dialog')).not.toBeNull()
    expect(screen.getByText('Webhook details')).not.toBeNull()
    expect(screen.getByText('Body content')).not.toBeNull()
  })

  test('renders nothing when closed', () => {
    render(
      <Drawer isOpen={false} onClose={vi.fn()} title='Webhook details'>
        <div>Body content</div>
      </Drawer>
    )

    expect(screen.queryByText('Body content')).toBeNull()
  })

  test('closes from the close button', () => {
    const onClose = vi.fn()
    render(
      <Drawer isOpen onClose={onClose} title='Details'>
        <div>Body</div>
      </Drawer>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('closes on Escape, unless dismissible is false', () => {
    const onClose = vi.fn()
    const { rerender } = render(
      <Drawer isOpen onClose={onClose} title='Details'>
        <div>Body</div>
      </Drawer>
    )

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    onClose.mockClear()
    rerender(
      <Drawer dismissible={false} isOpen onClose={onClose} title='Details'>
        <div>Body</div>
      </Drawer>
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  test('modal locks body scroll; non-modal leaves the page interactive', () => {
    const { unmount } = render(
      <Drawer isOpen onClose={vi.fn()} title='Details'>
        <div>Body</div>
      </Drawer>
    )

    expect(document.body.style.overflow).toBe('hidden')
    unmount()

    render(
      <Drawer isOpen modal={false} onClose={vi.fn()} title='Details'>
        <div>Body</div>
      </Drawer>
    )
    expect(document.body.style.overflow).not.toBe('hidden')
  })
})

describe('Drawer presentation=docked', () => {
  test('renders an in-flow complementary region named by the title — not a dialog', () => {
    render(
      <Drawer isOpen presentation='docked' title='Details'>
        <div>Body</div>
      </Drawer>
    )

    const rail = screen.getByRole('complementary', { name: 'Details' })
    expect(rail).not.toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(rail.className).not.toContain('fixed')
  })

  test('ignores modal: no backdrop, no body scroll lock', () => {
    const { container } = render(
      <Drawer isOpen modal presentation='docked' title='Details'>
        <div>Body</div>
      </Drawer>
    )

    expect(document.body.style.overflow).not.toBe('hidden')
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull()
  })

  test('does not steal focus on mount', () => {
    render(
      <Drawer isOpen presentation='docked' title='Details'>
        <button type='button'>Focusable</button>
      </Drawer>
    )

    expect(document.activeElement).toBe(document.body)
  })

  test('ignores Escape even when onClose is provided', () => {
    const onClose = vi.fn()
    render(
      <Drawer isOpen presentation='docked' title='Details' onClose={onClose}>
        <div>Body</div>
      </Drawer>
    )

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  test('mounts settled (full width, no slide-in on route load)', () => {
    render(
      <Drawer isOpen presentation='docked' title='Details' width={400}>
        <div>Body</div>
      </Drawer>
    )

    expect(screen.getByRole('complementary').style.width).toBe('400px')
  })

  test('slides closed: width collapses, then it unmounts after the exit', async () => {
    const { rerender } = render(
      <Drawer isOpen presentation='docked' title='Details' width={400}>
        <div>Body</div>
      </Drawer>
    )

    rerender(
      <Drawer isOpen={false} presentation='docked' title='Details' width={400}>
        <div>Body</div>
      </Drawer>
    )
    // exiting: still mounted, collapsing toward 0
    expect(screen.getByRole('complementary').style.width).toBe('0px')
    expect(screen.getByText('Body')).not.toBeNull()

    await waitFor(() => expect(screen.queryByText('Body')).toBeNull(), {
      timeout: 1000
    })

    // reopening brings it back
    rerender(
      <Drawer isOpen presentation='docked' title='Details' width={400}>
        <div>Body</div>
      </Drawer>
    )
    expect(screen.getByText('Body')).not.toBeNull()
  })

  test('chromeless without a title: no header row, named by aria-label', () => {
    render(
      <Drawer aria-label='Entity details' isOpen presentation='docked'>
        <div>Body</div>
      </Drawer>
    )

    expect(
      screen.getByRole('complementary', { name: 'Entity details' })
    ).not.toBeNull()
    expect(screen.queryByRole('heading')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
  })
})

describe('Drawer resizable', () => {
  const resizeOptions = { minWidth: 280, maxWidth: 560, defaultWidth: 376 }

  const renderDocked = (
    onResizeEnd = vi.fn(),
    side: 'left' | 'right' = 'right'
  ) => {
    render(
      <Drawer
        aria-label='Panel'
        isOpen
        presentation='docked'
        resizable={{ ...resizeOptions, onResizeEnd }}
        side={side}
      >
        <div>Body</div>
      </Drawer>
    )

    return {
      onResizeEnd,
      rail: screen.getByRole('complementary', { name: 'Panel' }),
      handle: screen.getByRole('separator', { name: 'Resize panel' })
    }
  }

  test('handle exposes window-splitter semantics', () => {
    const { handle, rail } = renderDocked()

    expect(handle.getAttribute('aria-orientation')).toBe('vertical')
    expect(handle.getAttribute('aria-valuemin')).toBe('280')
    expect(handle.getAttribute('aria-valuemax')).toBe('560')
    expect(handle.getAttribute('aria-valuenow')).toBe('376')
    expect(handle.tabIndex).toBe(0)
    expect(rail.style.width).toBe('376px')
  })

  test('arrow keys step 16px (Shift 64px), APG-literal by direction', () => {
    const { handle, rail, onResizeEnd } = renderDocked()

    // Right-anchored panel: the separator moving left = wider.
    fireEvent.keyDown(handle, { key: 'ArrowLeft' })
    expect(rail.style.width).toBe('392px')
    expect(onResizeEnd).toHaveBeenLastCalledWith(392)

    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(rail.style.width).toBe('376px')

    fireEvent.keyDown(handle, { key: 'ArrowLeft', shiftKey: true })
    expect(rail.style.width).toBe('440px')
  })

  test('side=left mirrors the arrow directions', () => {
    const { handle, rail } = renderDocked(vi.fn(), 'left')

    // Left-anchored panel: the separator moving left = narrower.
    fireEvent.keyDown(handle, { key: 'ArrowLeft' })
    expect(rail.style.width).toBe('360px')
    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(rail.style.width).toBe('376px')
  })

  test('Home/End jump to min/max; clamped no-ops do not re-fire onResizeEnd', () => {
    const { handle, rail, onResizeEnd } = renderDocked()

    fireEvent.keyDown(handle, { key: 'Home' })
    expect(rail.style.width).toBe('280px')
    expect(handle.getAttribute('aria-valuenow')).toBe('280')

    fireEvent.keyDown(handle, { key: 'End' })
    expect(rail.style.width).toBe('560px')

    const calls = onResizeEnd.mock.calls.length
    fireEvent.keyDown(handle, { key: 'ArrowLeft' }) // already at max
    expect(rail.style.width).toBe('560px')
    expect(onResizeEnd.mock.calls.length).toBe(calls)
  })

  test('double-click resets to defaultWidth', () => {
    const { handle, rail, onResizeEnd } = renderDocked()

    fireEvent.keyDown(handle, { key: 'End' })
    fireEvent.dblClick(handle)
    expect(rail.style.width).toBe('376px')
    expect(onResizeEnd).toHaveBeenLastCalledWith(376)
  })

  test('double-click resets to resetWidth (stable) even as defaultWidth drifts', () => {
    // Mirrors the Explorer consumer: defaultWidth restores a persisted width
    // that updates on every commit, while resetWidth is the canonical snap-back.
    const onResizeEnd = vi.fn()
    const { rerender } = render(
      <Drawer
        aria-label='Panel'
        isOpen
        presentation='docked'
        resizable={{
          minWidth: 280,
          maxWidth: 560,
          defaultWidth: 500,
          resetWidth: 376,
          onResizeEnd
        }}
      >
        <div>Body</div>
      </Drawer>
    )
    const handle = screen.getByRole('separator', { name: 'Resize panel' })
    const rail = screen.getByRole('complementary', { name: 'Panel' })
    expect(rail.style.width).toBe('500px') // restored the persisted width

    // simulate the consumer feeding back an updated defaultWidth after a commit
    rerender(
      <Drawer
        aria-label='Panel'
        isOpen
        presentation='docked'
        resizable={{
          minWidth: 280,
          maxWidth: 560,
          defaultWidth: 520,
          resetWidth: 376,
          onResizeEnd
        }}
      >
        <div>Body</div>
      </Drawer>
    )

    fireEvent.dblClick(handle)
    expect(rail.style.width).toBe('376px') // the canonical reset, not 500/520
    expect(onResizeEnd).toHaveBeenLastCalledWith(376)
  })

  test('pointer drag mutates width live and commits once on release', () => {
    const { handle, rail, onResizeEnd } = renderDocked()

    fireEvent.pointerDown(handle, { button: 0, clientX: 600 })

    // Below the 4px threshold: a click, not a drag.
    fireEvent.pointerMove(handle, { clientX: 598 })
    expect(rail.style.width).toBe('376px')
    expect(rail.hasAttribute('data-resizing')).toBe(false)

    fireEvent.pointerMove(handle, { clientX: 560 })
    expect(rail.style.width).toBe('416px')
    expect(handle.getAttribute('aria-valuenow')).toBe('416')
    expect(rail.hasAttribute('data-resizing')).toBe(true)
    expect(document.body.style.userSelect).toBe('none')
    expect(document.body.style.cursor).toBe('col-resize')
    expect(onResizeEnd).not.toHaveBeenCalled()

    // Clamps at maxWidth mid-drag.
    fireEvent.pointerMove(handle, { clientX: 0 })
    expect(rail.style.width).toBe('560px')

    fireEvent.pointerUp(handle)
    expect(onResizeEnd).toHaveBeenCalledTimes(1)
    expect(onResizeEnd).toHaveBeenCalledWith(560)
    expect(rail.hasAttribute('data-resizing')).toBe(false)
    expect(document.body.style.userSelect).not.toBe('none')
    expect(document.body.style.cursor).not.toBe('col-resize')
  })

  test('pointercancel restores body styles and commits the last live width', () => {
    const { handle, rail, onResizeEnd } = renderDocked()

    fireEvent.pointerDown(handle, { button: 0, clientX: 600 })
    fireEvent.pointerMove(handle, { clientX: 590 })
    expect(document.body.style.userSelect).toBe('none')

    fireEvent.pointerCancel(handle)
    expect(document.body.style.userSelect).not.toBe('none')
    expect(rail.hasAttribute('data-resizing')).toBe(false)
    // A cancelled drag commits the last live width (same as a release).
    expect(onResizeEnd).toHaveBeenCalledWith(386)
  })

  test('overlay + resizable keeps dialog behavior with an explicit width', () => {
    const onClose = vi.fn()
    render(
      <Drawer
        isOpen
        resizable={resizeOptions}
        title='Details'
        onClose={onClose}
      >
        <div>Body</div>
      </Drawer>
    )

    const panel = screen.getByRole('dialog')
    expect(panel.style.width).toBe('376px')
    expect(panel.className).toContain('max-w-full')
    expect(panel.className).not.toContain('max-w-lg')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
