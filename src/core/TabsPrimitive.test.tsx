import { fireEvent, render, screen } from '@testing-library/react'
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'

import {
  Tabs,
  TabsContent,
  TabsCount,
  TabsList,
  TabsTrigger
} from './TabsPrimitive'

// jsdom doesn't implement layout or ResizeObserver. Widths are driven per
// element through data attributes so the overflow math sees realistic,
// per-child numbers (a constant prototype stub can't express that):
// `data-test-width` → offsetWidth, `data-test-client-width` → clientWidth.
const originalDescriptors = {
  offsetWidth: Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'offsetWidth'
  ),
  clientWidth: Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'clientWidth'
  )
}

beforeAll(() => {
  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
  if (!window.PointerEvent) {
    window.PointerEvent = MouseEvent as unknown as typeof PointerEvent
  }
  window.HTMLElement.prototype.scrollIntoView = () => {}
  window.HTMLElement.prototype.hasPointerCapture = () => false
  window.HTMLElement.prototype.releasePointerCapture = () => {}
  window.HTMLElement.prototype.setPointerCapture = () => {}

  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return Number(this.getAttribute('data-test-width')) || 0
    }
  })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return Number(this.getAttribute('data-test-client-width')) || 0
    }
  })
})

afterAll(() => {
  for (const prop of ['offsetWidth', 'clientWidth'] as const) {
    const original = originalDescriptors[prop]
    if (original) Object.defineProperty(HTMLElement.prototype, prop, original)
    else Reflect.deleteProperty(HTMLElement.prototype, prop)
  }
})

const openMenu = async () => {
  fireEvent.pointerDown(screen.getByRole('button', { name: /More/ }), {
    button: 0,
    ctrlKey: false
  })
  return await screen.findByRole('menu')
}

// jsdom reports '' for columnGap, which the hook coerces to 0, so widths below
// assume no gaps. Every trigger is 100 wide, More is 60.
const trigger = (
  value: string,
  extra?: Partial<React.ComponentProps<typeof TabsTrigger>>
) => (
  <TabsTrigger data-test-width={100} key={value} value={value} {...extra}>
    {value}
  </TabsTrigger>
)

type RenderTabsOptions = {
  listWidth: number
  values?: string[]
  listProps?: Partial<React.ComponentProps<typeof TabsList>>
  rootProps?: Partial<React.ComponentProps<typeof Tabs>>
}

const renderTabs = ({
  listProps,
  listWidth,
  rootProps,
  values = ['alpha', 'beta', 'gamma', 'delta']
}: RenderTabsOptions) =>
  render(
    <Tabs defaultValue={values[0]} {...rootProps}>
      <TabsList data-test-client-width={listWidth} {...listProps}>
        {values.map(value => trigger(value))}
      </TabsList>
      {values.map(value => (
        <TabsContent key={value} value={value}>
          {value} panel
        </TabsContent>
      ))}
    </Tabs>
  )

// The More trigger renders 0-wide under the attribute stub (no data-test-width
// on it), so the fit math reserves 0px for it — fine for these tests, which
// pick list widths where the reservation isn't the deciding factor.

describe('TabsPrimitive baseline (root wrapper regression)', () => {
  test('uncontrolled: clicking a trigger switches the panel', () => {
    renderTabs({ listWidth: 1000 })

    expect(screen.getByText('alpha panel')).toBeTruthy()
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'beta' }))
    fireEvent.click(screen.getByRole('tab', { name: 'beta' }))
    expect(screen.getByText('beta panel')).toBeTruthy()
    expect(screen.queryByText('alpha panel')).toBeNull()
  })

  test('controlled: onValueChange fires and value prop wins', () => {
    const onValueChange = vi.fn()
    renderTabs({
      listWidth: 1000,
      rootProps: { value: 'alpha', onValueChange }
    })

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'gamma' }))
    fireEvent.click(screen.getByRole('tab', { name: 'gamma' }))
    expect(onValueChange).toHaveBeenCalledWith('gamma')
    // Still controlled to 'alpha' — panel does not switch.
    expect(screen.getByText('alpha panel')).toBeTruthy()
  })
})

describe('overflow collapse', () => {
  test('all fit: More button hidden, no hidden triggers', () => {
    renderTabs({ listWidth: 1000 })

    // jsdom applies no stylesheets, so the Tailwind data-attribute hiding
    // can't be observed through role visibility — assert the attribute that
    // drives it instead.
    const more = screen.getByRole('button', { name: /More/ })
    expect(more.hasAttribute('data-core-tabs-overflow-hidden')).toBe(true)
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab.hasAttribute('data-core-tabs-overflow-hidden')).toBe(false)
    }
  })

  test('overflow files the trailing tabs into the menu, in order', async () => {
    // 4 tabs × 100 = 400 natural > 250 → greedy keeps alpha + beta.
    renderTabs({ listWidth: 250 })

    const hidden = screen
      .getAllByRole('tab', { hidden: true })
      .filter(tab => tab.hasAttribute('data-core-tabs-overflow-hidden'))
    expect(hidden.map(tab => tab.textContent)).toEqual(['gamma', 'delta'])

    const menu = await openMenu()
    const items = Array.from(menu.querySelectorAll('[role="menuitem"]')).map(
      item => item.textContent
    )
    expect(items).toEqual(['gamma', 'delta'])
  })

  test('menu select activates a collapsed tab (uncontrolled)', async () => {
    renderTabs({ listWidth: 250 })

    await openMenu()
    const item = await screen.findByRole('menuitem', { name: 'delta' })
    fireEvent.pointerDown(item, { button: 0 })
    fireEvent.pointerUp(item, { button: 0 })
    fireEvent.click(item)

    expect(screen.getByText('delta panel')).toBeTruthy()
    // Tab order unchanged: DOM order of triggers is still alpha..delta.
    const tabs = screen.getAllByRole('tab', { hidden: true })
    expect(tabs.map(tab => tab.textContent)).toEqual([
      'alpha',
      'beta',
      'gamma',
      'delta'
    ])
  })

  test('menu select notifies a controlled root', async () => {
    const onValueChange = vi.fn()
    renderTabs({
      listWidth: 250,
      rootProps: { value: 'alpha', onValueChange }
    })

    await openMenu()
    const item = await screen.findByRole('menuitem', { name: 'gamma' })
    fireEvent.pointerDown(item, { button: 0 })
    fireEvent.pointerUp(item, { button: 0 })
    fireEvent.click(item)

    expect(onValueChange).toHaveBeenCalledWith('gamma')
  })

  test('active tab in overflow marks the More trigger and menu item', async () => {
    renderTabs({
      listWidth: 250,
      rootProps: { value: 'delta', onValueChange: () => {} }
    })

    // The trigger keeps its "More" label; the selection is indicated by the
    // active marker here and the checked item in the menu.
    const more = screen.getByRole('button', { name: 'More' })
    expect(more.hasAttribute('data-core-tabs-more-active')).toBe(true)

    await openMenu()
    const item = await screen.findByRole('menuitem', { name: 'delta' })
    expect(item.hasAttribute('data-core-tabs-menu-active')).toBe(true)
  })

  test('active tab visible: More trigger is not marked active', () => {
    renderTabs({
      listWidth: 250,
      rootProps: { value: 'alpha', onValueChange: () => {} }
    })

    const more = screen.getByRole('button', { name: 'More' })
    expect(more.hasAttribute('data-core-tabs-more-active')).toBe(false)
  })

  test('disabled collapsed tab renders a disabled menu item', async () => {
    render(
      <Tabs defaultValue='alpha'>
        <TabsList data-test-client-width={250}>
          {trigger('alpha')}
          {trigger('beta')}
          {trigger('gamma')}
          {trigger('delta', { disabled: true })}
        </TabsList>
      </Tabs>
    )

    await openMenu()
    const item = await screen.findByRole('menuitem', {
      hidden: true,
      name: 'delta'
    })
    expect(item.getAttribute('data-disabled')).not.toBeNull()
  })

  test('TabsCount content renders inside the menu item', async () => {
    render(
      <Tabs defaultValue='alpha'>
        <TabsList data-test-client-width={250}>
          {trigger('alpha')}
          {trigger('beta')}
          {trigger('gamma')}
          <TabsTrigger data-test-width={100} value='delta'>
            delta
            <TabsCount>7</TabsCount>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    )

    const menu = await openMenu()
    expect(menu.textContent).toContain('delta')
    expect(menu.textContent).toContain('7')
  })
})

describe('overflow fallbacks', () => {
  test('custom moreLabel renders on the trigger', () => {
    renderTabs({ listWidth: 250, listProps: { moreLabel: 'More views' } })

    expect(screen.getByRole('button', { name: /More views/ })).toBeTruthy()
  })

  test('unmeasurable container (clientWidth 0) shows every tab', () => {
    renderTabs({ listWidth: 0 })

    const more = screen.getByRole('button', { name: /More/ })
    expect(more.hasAttribute('data-core-tabs-overflow-hidden')).toBe(true)
    expect(screen.getAllByRole('tab')).toHaveLength(4)
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab.hasAttribute('data-core-tabs-overflow-hidden')).toBe(false)
    }
  })

  test('re-measures when children change', () => {
    const { rerender } = renderTabs({ listWidth: 250 })
    const more = screen.getByRole('button', { name: /More/ })
    expect(more.hasAttribute('data-core-tabs-overflow-hidden')).toBe(false)

    // Shrink to two tabs (200 natural ≤ 250): the More button hides again.
    rerender(
      <Tabs defaultValue='alpha'>
        <TabsList data-test-client-width={250}>
          {trigger('alpha')}
          {trigger('beta')}
        </TabsList>
        <TabsContent value='alpha'>alpha panel</TabsContent>
        <TabsContent value='beta'>beta panel</TabsContent>
      </Tabs>
    )

    expect(more.hasAttribute('data-core-tabs-overflow-hidden')).toBe(true)
  })
})

describe("fixed-in-More tabs (overflow='fixed')", () => {
  const renderWithFixed = (listWidth: number, rootProps = {}) =>
    render(
      <Tabs defaultValue='alpha' {...rootProps}>
        <TabsList data-test-client-width={listWidth}>
          {trigger('alpha')}
          {trigger('beta')}
          {trigger('gamma')}
          {trigger('orders', { overflow: 'fixed' })}
          {trigger('history', { overflow: 'fixed' })}
        </TabsList>
        {['alpha', 'beta', 'gamma', 'orders', 'history'].map(value => (
          <TabsContent key={value} value={value}>
            {value} panel
          </TabsContent>
        ))}
      </Tabs>
    )

  test('at full width: More stays visible, designated tabs are hidden and in the menu', async () => {
    renderWithFixed(1000)

    const more = screen.getByRole('button', { name: /More/ })
    expect(more.hasAttribute('data-core-tabs-overflow-hidden')).toBe(false)

    const hidden = screen
      .getAllByRole('tab', { hidden: true })
      .filter(tab => tab.hasAttribute('data-core-tabs-overflow-hidden'))
    expect(hidden.map(tab => tab.textContent)).toEqual(['orders', 'history'])

    const menu = await openMenu()
    const items = Array.from(menu.querySelectorAll('[role="menuitem"]')).map(
      item => item.textContent
    )
    expect(items).toEqual(['orders', 'history'])
    // Designated-only menu: no separator.
    expect(menu.querySelector('[role="separator"]')).toBeNull()
  })

  test('designated tab activates from the menu', async () => {
    renderWithFixed(1000)

    await openMenu()
    const item = await screen.findByRole('menuitem', { name: 'orders' })
    fireEvent.pointerDown(item, { button: 0 })
    fireEvent.pointerUp(item, { button: 0 })
    fireEvent.click(item)

    expect(screen.getByText('orders panel')).toBeTruthy()
  })

  test('active designated tab marks the More trigger active', () => {
    renderWithFixed(1000, { value: 'history', onValueChange: () => {} })

    const more = screen.getByRole('button', { name: 'More' })
    expect(more.hasAttribute('data-core-tabs-more-active')).toBe(true)
  })

  test('collapsed auto tabs stack above designated ones behind a separator', async () => {
    // 3 auto tabs × 100 = 300 natural > 250 → gamma collapses.
    renderWithFixed(250)

    const menu = await openMenu()
    const items = Array.from(menu.querySelectorAll('[role="menuitem"]')).map(
      item => item.textContent
    )
    expect(items).toEqual(['gamma', 'orders', 'history'])
    expect(menu.querySelector('[role="separator"]')).not.toBeNull()
  })
})
