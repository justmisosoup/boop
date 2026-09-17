import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { FloatingPanel } from './FloatingPanel'
import { ListPicker, matchSnippet, type ListPickerItem } from './ListPicker'

const THREADS: ListPickerItem[] = [
  {
    id: 'g1',
    label: 'Apple Inc.',
    description: 'Who else shares this address?',
    meta: '2m',
    body: 'Who else shares this address? Show the officers in Cupertino.'
  },
  {
    id: 'g2',
    label: 'Keystone Pipe Trading',
    description: 'Show the ownership chain',
    meta: '1h',
    body: 'Show the ownership chain up to the ultimate beneficial owner.'
  },
  {
    id: 'g3',
    label: 'Pico Ranch Holdings',
    description: 'Compare the registered agents',
    meta: '3d',
    body: 'Compare the registered agents across both filings.'
  }
]

const many = (count: number): ListPickerItem[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `g${index}`,
    label: `Thread ${index}`
  }))

const Harness = (
  props: Partial<React.ComponentProps<typeof ListPicker>> = {}
) => (
  <ListPicker
    defaultOpen
    items={THREADS}
    label='Graph threads'
    onSelect={vi.fn()}
    {...props}
  >
    <button type='button'>Apple Inc.</button>
  </ListPicker>
)

const optionNames = () =>
  screen.getAllByRole('option').map(option => option.textContent)

describe('ListPicker', () => {
  describe('aria structure', () => {
    test('the trigger claims a listbox, not the Radix default dialog', () => {
      render(<Harness defaultOpen={false} />)

      const trigger = screen.getByRole('button', { name: 'Apple Inc.' })
      expect(trigger.getAttribute('aria-haspopup')).toBe('listbox')
      expect(trigger.getAttribute('aria-expanded')).toBe('false')
    })

    test('past the threshold the search input is the combobox focus host', () => {
      render(<Harness items={many(12)} />)

      const input = screen.getByRole('combobox')
      expect(input.getAttribute('aria-autocomplete')).toBe('list')
      expect(input.getAttribute('aria-controls')).toBe(
        screen.getByRole('listbox').id
      )
      expect(document.activeElement).toBe(input)
    })

    test('below the threshold there is no combobox and the listbox takes focus', () => {
      render(<Harness />)

      expect(screen.queryByRole('combobox')).toBeNull()
      const list = screen.getByRole('listbox', { name: 'Graph threads' })
      expect(list.getAttribute('tabindex')).toBe('0')
      expect(document.activeElement).toBe(list)
    })

    test('search auto-appears past searchThreshold, and searchable overrides both ways', () => {
      const { rerender, unmount } = render(<Harness items={many(8)} />)
      expect(screen.queryByRole('combobox')).toBeNull()

      rerender(<Harness items={many(9)} />)
      expect(screen.getByRole('combobox')).not.toBeNull()

      rerender(<Harness searchable={false} items={many(9)} />)
      expect(screen.queryByRole('combobox')).toBeNull()
      unmount()

      render(<Harness searchable items={THREADS} />)
      expect(screen.getByRole('combobox')).not.toBeNull()
    })

    test('aria-selected marks only the committed row', () => {
      render(<Harness selectedId='g2' />)

      const selected = screen
        .getAllByRole('option')
        .filter(option => option.getAttribute('aria-selected') === 'true')
      expect(selected).toHaveLength(1)
      expect(selected[0].textContent).toContain('Keystone Pipe Trading')
    })

    // The visual half of `aria-selected`. It is load-bearing rather than
    // decorative: in scoped dark `state-selected-bg` and `state-hover-bg` are
    // the same value, so without the glyph a committed row is indistinguishable
    // from the keyboard-highlighted one.
    test('the committed row draws a check, and only that row', () => {
      render(<Harness selectedId='g2' />)

      const withCheck = screen
        .getAllByRole('option')
        .filter(option => option.querySelector('svg') !== null)
      expect(withCheck).toHaveLength(1)
      expect(withCheck[0].textContent).toContain('Keystone Pipe Trading')
    })

    // Opening lands the highlight ON the committed row, so the two states
    // collide there. tailwind-merge keeps the last of a conflicting pair and
    // DROPS the other, so this asserts the resolution both ways: highlighted
    // while it's active, selected once the highlight moves off it.
    test('the highlight wins while active, and the selected fill returns after', () => {
      render(<Harness selectedId='g2' />)
      const list = screen.getByRole('listbox')
      const row = () =>
        screen.getByRole('option', { name: /Keystone Pipe Trading/ })

      expect(row().className).toContain('state-hover-bg')
      expect(row().className).not.toContain('state-selected-bg')

      // walk off g2 — it stays committed, so it must now show as selected
      fireEvent.keyDown(list, { key: 'ArrowDown' })

      expect(row().className).toContain('state-selected-bg')
      expect(row().className).not.toContain('state-hover-bg')
    })

    test('actions are options INSIDE the listbox, so activedescendant stays valid', () => {
      render(
        <Harness
          actions={[{ id: 'new', label: 'New graph', onSelect: vi.fn() }]}
        />
      )

      const list = screen.getByRole('listbox')
      const action = screen.getByRole('option', { name: 'New graph' })
      expect(list.contains(action)).toBe(true)
      // an action is never a selectable value
      expect(action.getAttribute('aria-selected')).toBe('false')
    })

    test('actions survive a query that matches nothing', () => {
      render(
        <Harness
          searchable
          actions={[{ id: 'new', label: 'New graph', onSelect: vi.fn() }]}
        />
      )

      fireEvent.change(screen.getByRole('combobox'), {
        target: { value: 'zzzz' }
      })

      expect(screen.getByRole('option', { name: 'New graph' })).not.toBeNull()
      expect(screen.getByText('No matches for “zzzz”')).not.toBeNull()
    })

    test('the listbox is not the scroller, so pinned actions cannot scroll away', () => {
      render(
        <Harness
          actions={[{ id: 'new', label: 'New graph', onSelect: vi.fn() }]}
          items={many(40)}
        />
      )

      const list = screen.getByRole('listbox')
      const action = screen.getByRole('option', { name: 'New graph' })
      const scroller = list.firstElementChild

      // actions stay inside the listbox (aria-activedescendant must resolve)…
      expect(list.contains(action)).toBe(true)
      // …but outside the element that scrolls, or a long list slides the
      // footer up through the last row
      expect(scroller?.contains(action)).toBe(false)
      expect(scroller?.contains(screen.getAllByRole('option')[0])).toBe(true)
      expect(list.className).not.toContain('overflow-y-auto')
      expect(scroller?.className).toContain('overflow-y-auto')
    })

    test('an id containing whitespace still yields one resolvable DOM token', () => {
      render(
        <Harness
          items={[{ id: 'thread one', label: 'Spaced' }]}
          selectedId='thread one'
        />
      )

      const option = screen.getByRole('option', { name: 'Spaced' })
      expect(option.id).not.toContain(' ')
      expect(
        screen.getByRole('listbox').getAttribute('aria-activedescendant')
      ).toBe(option.id)
    })
  })

  describe('keyboard', () => {
    test('ArrowDown/ArrowUp move the active descendant and wrap', () => {
      render(<Harness />)
      const list = screen.getByRole('listbox')
      const ids = screen.getAllByRole('option').map(option => option.id)

      expect(list.getAttribute('aria-activedescendant')).toBe(ids[0])
      fireEvent.keyDown(list, { key: 'ArrowDown' })
      expect(list.getAttribute('aria-activedescendant')).toBe(ids[1])
      fireEvent.keyDown(list, { key: 'ArrowUp' })
      fireEvent.keyDown(list, { key: 'ArrowUp' })
      expect(list.getAttribute('aria-activedescendant')).toBe(ids[2])
    })

    test('the walk skips disabled rows', () => {
      render(
        <Harness
          items={[
            { id: 'a', label: 'A' },
            { id: 'b', label: 'B', disabled: true },
            { id: 'c', label: 'C' }
          ]}
        />
      )
      const list = screen.getByRole('listbox')
      const ids = screen.getAllByRole('option').map(option => option.id)

      fireEvent.keyDown(list, { key: 'ArrowDown' })
      expect(list.getAttribute('aria-activedescendant')).toBe(ids[2])
    })

    test('Home and End reach the first and last entries, actions included', () => {
      render(
        <Harness
          actions={[{ id: 'new', label: 'New graph', onSelect: vi.fn() }]}
        />
      )
      const list = screen.getByRole('listbox')
      const ids = screen.getAllByRole('option').map(option => option.id)

      fireEvent.keyDown(list, { key: 'End' })
      expect(list.getAttribute('aria-activedescendant')).toBe(
        ids[ids.length - 1]
      )
      fireEvent.keyDown(list, { key: 'Home' })
      expect(list.getAttribute('aria-activedescendant')).toBe(ids[0])
    })

    test('ArrowDown off the last record lands on the first action', () => {
      const onSelect = vi.fn()
      render(
        <Harness
          actions={[{ id: 'new', label: 'New graph', onSelect }]}
          items={[{ id: 'a', label: 'A' }]}
        />
      )
      const list = screen.getByRole('listbox')

      fireEvent.keyDown(list, { key: 'ArrowDown' })
      fireEvent.keyDown(list, { key: 'Enter' })
      expect(onSelect).toHaveBeenCalledTimes(1)
    })

    test('Enter commits the active row', () => {
      const onSelect = vi.fn()
      render(<Harness onSelect={onSelect} />)
      const list = screen.getByRole('listbox')

      fireEvent.keyDown(list, { key: 'ArrowDown' })
      fireEvent.keyDown(list, { key: 'Enter' })

      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'g2' })
      )
    })

    test('opening lands the highlight on the selected row, not the top', () => {
      render(<Harness selectedId='g3' />)

      const list = screen.getByRole('listbox')
      const options = screen.getAllByRole('option')
      expect(list.getAttribute('aria-activedescendant')).toBe(options[2].id)

      // …and Enter on it is a no-op re-selection, not a jump elsewhere
      const onSelect = vi.fn()
      screen.getAllByRole('option')
      fireEvent.keyDown(list, { key: 'Enter' })
      expect(onSelect).not.toHaveBeenCalled()
    })

    test('re-filtering resets the highlight to the first match', () => {
      render(<Harness searchable />)
      const input = screen.getByRole('combobox')

      fireEvent.keyDown(input, { key: 'ArrowDown' })
      fireEvent.change(input, { target: { value: 'Pico' } })

      const options = screen.getAllByRole('option')
      expect(options).toHaveLength(1)
      expect(input.getAttribute('aria-activedescendant')).toBe(options[0].id)
    })
  })

  describe('search', () => {
    test('matches label, description, keywords and body independently', () => {
      const items: ListPickerItem[] = [
        { id: 'a', label: 'Alpha' },
        { id: 'b', label: 'B', description: 'Bravo subtitle' },
        { id: 'c', label: 'C', keywords: ['charlie'] },
        { id: 'd', label: 'D', body: 'delta transcript' }
      ]
      const { rerender } = render(<Harness searchable items={items} />)
      const input = screen.getByRole('combobox')

      for (const [query, expected] of [
        ['Alpha', 'Alpha'],
        ['bravo', 'B'],
        ['charlie', 'C'],
        ['delta', 'D']
      ]) {
        fireEvent.change(input, { target: { value: query } })
        expect(optionNames().join()).toContain(expected)
        rerender(<Harness searchable items={items} />)
      }
    })

    test('a filter override fully replaces the built-in matcher', () => {
      render(<Harness searchable filter={() => true} />)

      fireEvent.change(screen.getByRole('combobox'), {
        target: { value: 'nothing-matches-this' }
      })

      expect(screen.getAllByRole('option')).toHaveLength(3)
    })

    test('onQueryChange reports the live query', () => {
      const onQueryChange = vi.fn()
      render(<Harness searchable onQueryChange={onQueryChange} />)

      fireEvent.change(screen.getByRole('combobox'), {
        target: { value: 'Pico' }
      })

      expect(onQueryChange).toHaveBeenCalledWith('Pico')
    })
  })

  describe('highlight and snippet', () => {
    test('a label match emphasises the matched run', () => {
      render(<Harness searchable />)

      fireEvent.change(screen.getByRole('combobox'), {
        target: { value: 'Keystone' }
      })

      // the content is portaled, so query the document rather than `container`
      const marks = document.querySelectorAll('mark')
      expect(marks.length).toBeGreaterThan(0)
      expect(marks[0].textContent).toBe('Keystone')
    })

    test('a body-only match swaps the subtitle for the matching passage', () => {
      render(<Harness searchable />)

      fireEvent.change(screen.getByRole('combobox'), {
        target: { value: 'Cupertino' }
      })

      const option = screen.getByRole('option')
      expect(option.textContent).toContain('Cupertino')
      // the stored description is replaced, not appended
      expect(option.textContent).not.toContain('Who else shares this address?')
    })

    test('a cross-field match renders the row with no mark and no throw', () => {
      render(
        <Harness
          searchable
          items={[{ id: 'a', label: 'Apple', description: 'Inc' }]}
        />
      )

      // "apple inc" only exists across the label/description boundary, so the
      // matcher hits but no single field holds a literal run to emphasise
      fireEvent.change(screen.getByRole('combobox'), {
        target: { value: 'apple inc' }
      })

      expect(screen.getAllByRole('option')).toHaveLength(1)
      expect(document.querySelectorAll('mark')).toHaveLength(0)
    })

    test('regex metacharacters in the query neither throw nor drop the row', () => {
      render(
        <Harness searchable items={[{ id: 'a', label: 'Acme (Holdings)' }]} />
      )

      expect(() =>
        fireEvent.change(screen.getByRole('combobox'), {
          target: { value: '(Hold' }
        })
      ).not.toThrow()
      expect(screen.getAllByRole('option')).toHaveLength(1)
    })

    test('matchSnippet keeps the match when no word boundary is nearby', () => {
      // an unbroken run either side — the nearest space is PAST the match, so
      // a naive word-boundary trim would window straight past the term
      const body = `${'x'.repeat(80)}NEEDLE${'y'.repeat(80)} tail`
      const snippet = matchSnippet(body, 'NEEDLE')

      expect(snippet).toContain('NEEDLE')
    })

    test('matchSnippet windows around the match and ellipsizes', () => {
      const body =
        'the quick brown fox jumps over the lazy dog and then keeps running well past the end'
      const snippet = matchSnippet(body, 'lazy')

      expect(snippet).toContain('lazy')
      expect(snippet?.length).toBeLessThan(body.length)
      expect(matchSnippet(body, 'absent')).toBeUndefined()
    })
  })

  describe('pointer and selection', () => {
    test('clicking a row selects it', () => {
      const onSelect = vi.fn()
      render(<Harness onSelect={onSelect} />)

      fireEvent.click(screen.getByRole('option', { name: /Keystone/ }))

      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'g2' })
      )
    })

    test('mousedown on a row does not blur the search input', () => {
      render(<Harness searchable />)
      const input = screen.getByRole('combobox')

      const event = fireEvent.mouseDown(
        screen.getByRole('option', { name: /Keystone/ })
      )

      // preventDefault returns false from fireEvent when default was prevented
      expect(event).toBe(false)
      expect(document.activeElement).toBe(input)
    })

    test('mousemove sets the active row', () => {
      render(<Harness />)
      const list = screen.getByRole('listbox')
      const options = screen.getAllByRole('option')

      fireEvent.mouseMove(options[2])

      expect(list.getAttribute('aria-activedescendant')).toBe(options[2].id)
    })

    test('a keepOpen action runs without closing', () => {
      const onSelect = vi.fn()
      render(
        <Harness
          actions={[{ id: 'x', label: 'Clear', keepOpen: true, onSelect }]}
        />
      )

      fireEvent.click(screen.getByRole('option', { name: 'Clear' }))

      expect(onSelect).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('listbox')).not.toBeNull()
    })
  })

  describe('states', () => {
    test('the empty message distinguishes no-items from no-matches', () => {
      const { unmount } = render(<Harness items={[]} />)
      expect(screen.getByText('Nothing here yet')).not.toBeNull()
      unmount()

      render(<Harness searchable />)
      fireEvent.change(screen.getByRole('combobox'), {
        target: { value: 'zzz' }
      })
      expect(screen.getByText('No matches for “zzz”')).not.toBeNull()
    })

    test('themeMode stamps the portaled content — the greenhouse guard', () => {
      render(<Harness themeMode='dark' />)

      const content = screen.getByRole('listbox').closest('.core-theme')
      expect(content?.getAttribute('data-theme')).toBe('dark')
    })

    test('group headers render and grouped items keep first-seen order', () => {
      render(
        <Harness
          items={[
            { id: 'a', label: 'A', group: 'Recent' },
            { id: 'b', label: 'B', group: 'Earlier' },
            { id: 'c', label: 'C', group: 'Recent' }
          ]}
        />
      )

      expect(screen.getByText('Recent')).not.toBeNull()
      expect(screen.getByText('Earlier')).not.toBeNull()
      // Recent was seen first, so its group (A, C) precedes Earlier (B)
      expect(optionNames()).toEqual(['A', 'C', 'B'])
    })

    test('depth indents the row', () => {
      render(
        <Harness
          items={[
            { id: 'a', label: 'Parent' },
            { id: 'b', label: 'Child', depth: 1 }
          ]}
        />
      )

      const [parent, child] = screen.getAllByRole('option')
      expect(parent.style.paddingLeft).toBe('')
      expect(child.style.paddingLeft).toBe('26px')
    })
  })

  describe('density', () => {
    test('standalone defaults to standard rows', () => {
      render(<Harness />)

      const [first] = screen.getAllByRole('option')
      expect(first.className).toContain('py-2')
    })

    test('inherits compact from a surrounding FloatingPanel across the popover portal', () => {
      render(
        <FloatingPanel
          corner='bottom-left'
          density='compact'
          label='Explorer agent'
          launcher={<span>Ask</span>}
          state='window'
          onStateChange={() => {}}
        >
          <Harness />
        </FloatingPanel>
      )

      // The popover mounts on document.body — outside the panel's DOM — so a
      // compact row here proves density travels the REACT tree, not the DOM.
      const [first] = screen.getAllByRole('option')
      expect(first.className).toContain('py-1.5')
      expect(first.querySelector('.text-dense')).not.toBeNull()
    })
  })
})
