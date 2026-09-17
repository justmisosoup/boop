import React from 'react'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, describe, expect, test, vi } from 'vitest'

import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuShortcut,
  MenuTrigger
} from './Menu'

beforeAll(() => {
  if (!window.PointerEvent) {
    window.PointerEvent = MouseEvent as unknown as typeof PointerEvent
  }

  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }

  window.HTMLElement.prototype.scrollIntoView = () => {}
  window.HTMLElement.prototype.hasPointerCapture = () => false
  window.HTMLElement.prototype.releasePointerCapture = () => {}
  window.HTMLElement.prototype.setPointerCapture = () => {}
})

const openMenu = (label: string) => {
  fireEvent.pointerDown(screen.getByText(label), {
    button: 0,
    ctrlKey: false
  })
}

describe('Menu', () => {
  test('applies theme and size contracts to portaled menu content', async () => {
    render(
      <Menu>
        <MenuTrigger>Actions</MenuTrigger>
        <MenuContent size='standard' themeMode='dark'>
          <MenuLabel>Business actions</MenuLabel>
          <MenuItem>Copy business ID</MenuItem>
          <MenuSeparator />
        </MenuContent>
      </Menu>
    )

    openMenu('Actions')

    const content = await screen.findByRole('menu')
    expect(content.getAttribute('data-theme')).toBe('dark')
    expect(content.getAttribute('data-size')).toBe('standard')
    expect(content.className).toContain('core-menu-content')
    expect(content.className).toContain('data-[state=open]:animate-popover-in')
    expect(content.className).toContain(
      'data-[state=closed]:animate-popover-out'
    )
    expect(document.querySelector('.core-menu-separator')).not.toBeNull()
  })

  test('renders shortcut keycaps', () => {
    render(<MenuShortcut keys={['⌘', 'K']} />)

    const keys = document.querySelectorAll('.core-menu-shortcut-key')
    expect(keys).toHaveLength(2)
    expect(keys[0]?.textContent).toBe('⌘')
    expect(keys[1]?.textContent).toBe('K')
  })

  test('opens from trigger and renders menu content', async () => {
    render(
      <Menu>
        <MenuTrigger>Actions</MenuTrigger>
        <MenuContent>
          <MenuLabel>Business actions</MenuLabel>
          <MenuItem>Copy business ID</MenuItem>
        </MenuContent>
      </Menu>
    )

    openMenu('Actions')

    await waitFor(() => {
      expect(screen.getByText('Copy business ID')).not.toBeNull()
    })
  })

  test('calls onSelect when an item is selected', async () => {
    const onSelect = vi.fn()

    render(
      <Menu>
        <MenuTrigger>Actions</MenuTrigger>
        <MenuContent>
          <MenuItem onSelect={onSelect}>Archive</MenuItem>
        </MenuContent>
      </Menu>
    )

    openMenu('Actions')

    const item = await screen.findByText('Archive')
    fireEvent.click(item)

    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  test('supports checkbox items without closing the menu', async () => {
    const CheckboxMenu = () => {
      const [checked, setChecked] = React.useState(true)

      return (
        <Menu>
          <MenuTrigger>Filters</MenuTrigger>
          <MenuContent>
            <MenuCheckboxItem
              checked={checked}
              onCheckedChange={nextChecked => setChecked(nextChecked === true)}
            >
              Show inactive
            </MenuCheckboxItem>
            <MenuSeparator />
            <MenuItem>Clear filters</MenuItem>
          </MenuContent>
        </Menu>
      )
    }

    render(<CheckboxMenu />)

    openMenu('Filters')

    const item = await screen.findByRole('menuitemcheckbox', {
      name: 'Show inactive'
    })
    expect(item.getAttribute('data-state')).toBe('checked')
    expect(item.getAttribute('aria-checked')).toBe('true')

    fireEvent.click(item)

    expect(item.getAttribute('data-state')).toBe('unchecked')
    expect(item.getAttribute('aria-checked')).toBe('false')
    await waitFor(() => {
      expect(screen.getByText('Clear filters')).not.toBeNull()
    })
  })

  test('supports radio items without closing the menu', async () => {
    const RadioMenu = () => {
      const [value, setValue] = React.useState('compact')

      return (
        <Menu>
          <MenuTrigger>Density</MenuTrigger>
          <MenuContent>
            <MenuRadioGroup onValueChange={setValue} value={value}>
              <MenuRadioItem value='compact'>Compact</MenuRadioItem>
              <MenuRadioItem value='comfortable'>Comfortable</MenuRadioItem>
            </MenuRadioGroup>
            <MenuSeparator />
            <MenuItem>Reset density</MenuItem>
          </MenuContent>
        </Menu>
      )
    }

    render(<RadioMenu />)

    openMenu('Density')

    const compactItem = await screen.findByRole('menuitemradio', {
      name: 'Compact'
    })
    const comfortableItem = await screen.findByRole('menuitemradio', {
      name: 'Comfortable'
    })

    expect(compactItem.getAttribute('data-state')).toBe('checked')
    expect(compactItem.getAttribute('aria-checked')).toBe('true')

    fireEvent.click(comfortableItem)

    expect(compactItem.getAttribute('data-state')).toBe('unchecked')
    expect(comfortableItem.getAttribute('data-state')).toBe('checked')
    expect(comfortableItem.getAttribute('aria-checked')).toBe('true')
    await waitFor(() => {
      expect(screen.getByText('Reset density')).not.toBeNull()
    })
  })
})
