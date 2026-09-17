import { useState } from 'react'

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import {
  ChatAttachment,
  ChatComposer,
  ChatLog,
  ChatMarker,
  ChatMessage,
  ChatMessageActions,
  ChatSuggestions,
  type ChatSlashGroup
} from './Chat'
import { FloatingPanel } from './FloatingPanel'

const SLASH_GROUPS: ChatSlashGroup[] = [
  {
    label: 'Businesses',
    items: [
      { id: 'biz-1', label: 'Sequoia', keywords: ['similar'] },
      { id: 'biz-2', label: 'Faraway Data LLC' }
    ]
  },
  {
    label: 'Agents',
    items: [{ id: 'agent-1', label: 'CIP Orchestrator', hint: 'agent' }]
  }
]

/** Controlled harness — the composer is a controlled component. */
const Harness = ({
  onSubmit = () => {},
  onSlashSelect = () => {},
  onRemoveChip,
  chips = [] as { id: string; label: string }[],
  isStreaming = false,
  onStop,
  slashGroups = SLASH_GROUPS,
  slashAllowSpaces,
  onSlashQueryChange,
  attachLabel,
  minRows,
  menuPlacement,
  menuClassName
}: Partial<React.ComponentProps<typeof ChatComposer>>) => {
  const [value, setValue] = useState('')
  return (
    <ChatComposer
      attachLabel={attachLabel}
      chips={chips}
      menuClassName={menuClassName}
      menuPlacement={menuPlacement}
      minRows={minRows}
      isStreaming={isStreaming}
      slashAllowSpaces={slashAllowSpaces}
      slashGroups={slashGroups}
      value={value}
      onChange={setValue}
      onRemoveChip={onRemoveChip}
      onSlashQueryChange={onSlashQueryChange}
      onSlashSelect={onSlashSelect}
      onStop={onStop}
      onSubmit={onSubmit}
    />
  )
}

const getInput = () =>
  screen.getByRole('textbox', { name: 'Message' }) as HTMLTextAreaElement

const type = (value: string) =>
  fireEvent.change(getInput(), { target: { value } })

describe('ChatComposer', () => {
  test('Enter submits; Shift+Enter is left to the browser (newline)', () => {
    const onSubmit = vi.fn()
    render(<Harness onSubmit={onSubmit} />)

    type('hello')
    fireEvent.keyDown(getInput(), { key: 'Enter', shiftKey: true })
    expect(onSubmit).not.toHaveBeenCalled()

    fireEvent.keyDown(getInput(), { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  test('empty input does not submit', () => {
    const onSubmit = vi.fn()
    render(<Harness onSubmit={onSubmit} />)

    type('   ')
    fireEvent.keyDown(getInput(), { key: 'Enter' })
    expect(onSubmit).not.toHaveBeenCalled()
    expect(
      (
        screen.getByRole('button', {
          name: 'Send message'
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
  })

  test('slashAllowSpaces + pinned: a mid-sentence "/ " is punctuation — the menu closes and Enter SENDS', () => {
    // Regression: with spaces allowed and a pinned row always present, an
    // unclosed menu would capture Enter for the rest of the message — send
    // becomes impossible and Enter fires the pinned action instead.
    const onSubmit = vi.fn()
    const onSlashSelect = vi.fn()
    const PINNED: ChatSlashGroup[] = [
      {
        label: 'Add',
        items: [
          { id: 'create:business', label: 'Add as business', pinned: true }
        ]
      }
    ]
    render(
      <Harness
        slashAllowSpaces
        slashGroups={PINNED}
        onSlashSelect={onSlashSelect}
        onSubmit={onSubmit}
      />
    )

    type('compare a /')
    expect(screen.getByRole('listbox')).toBeTruthy()
    // the very next character is a space → punctuation, not a command
    type('compare a / ')
    expect(screen.queryByRole('listbox')).toBeNull()

    type('compare a / b exposure')
    fireEvent.keyDown(getInput(), { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSlashSelect).not.toHaveBeenCalled()
  })

  test('slashAllowSpaces: a multi-word command query stays open', () => {
    render(<Harness slashAllowSpaces />)
    type('/')
    type('/Acme')
    expect(screen.getByRole('listbox')).toBeTruthy()
    type('/Acme Holdings')
    // an internal space must NOT close the menu (multi-word entity names)
    expect(screen.getByRole('listbox')).toBeTruthy()
  })

  test('pinned rows survive the filter; disabled rows are visible but inert', () => {
    const onSlashSelect = vi.fn()
    const onSubmit = vi.fn()
    const GROUPS: ChatSlashGroup[] = [
      {
        label: 'Businesses',
        items: [{ id: 'biz-1', label: 'Sequoia' }]
      },
      {
        label: 'Add',
        items: [
          { id: 'create:business', label: 'Add as business', pinned: true },
          {
            id: 'hint:teach',
            label: 'Type a name…',
            pinned: true,
            disabled: true
          }
        ]
      }
    ]
    render(
      <Harness
        slashGroups={GROUPS}
        onSlashSelect={onSlashSelect}
        onSubmit={onSubmit}
      />
    )

    type('/')
    type('/zzz')
    // 'Sequoia' is filtered away; both pinned rows remain visible
    expect(screen.queryByRole('option', { name: /Sequoia/ })).toBeNull()
    expect(screen.getByRole('option', { name: /Add as business/ })).toBeTruthy()
    const teach = screen.getByRole('option', { name: /Type a name…/ })
    expect(teach.getAttribute('aria-disabled')).toBe('true')

    // a disabled row can't be clicked into a selection…
    fireEvent.click(teach)
    expect(onSlashSelect).not.toHaveBeenCalled()

    // …and Enter selects the enabled pinned row (the disabled one never
    // enters the active walk)
    fireEvent.keyDown(getInput(), { key: 'Enter' })
    expect(onSlashSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'create:business' })
    )
  })

  test('a menu of only teaching rows does not also say No matches', () => {
    render(
      <Harness
        slashGroups={[
          {
            label: 'Add a business',
            items: [
              {
                id: 'hint',
                label: 'Type a business name…',
                pinned: true,
                disabled: true
              }
            ]
          }
        ]}
      />
    )
    type('/')
    expect(screen.getByText('Type a business name…')).toBeTruthy()
    expect(screen.queryByText('No matches')).toBeNull()
    type('/zzz')
    expect(screen.queryByText('No matches')).toBeNull()
  })

  test('a menu of ONLY disabled rows lets Enter fall through to send', () => {
    const onSlashSelect = vi.fn()
    const onSubmit = vi.fn()
    render(
      <Harness
        slashGroups={[
          {
            label: 'Start',
            items: [
              {
                id: 'hint:teach',
                label: 'Type a name…',
                pinned: true,
                disabled: true
              }
            ]
          }
        ]}
        onSlashSelect={onSlashSelect}
        onSubmit={onSubmit}
      />
    )
    type('hello /')
    expect(screen.getByRole('listbox')).toBeTruthy()
    fireEvent.keyDown(getInput(), { key: 'Enter' })
    expect(onSlashSelect).not.toHaveBeenCalled()
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  test('onSlashQueryChange observes open/typing/close — and unmount reports null', () => {
    const onSlashQueryChange = vi.fn()
    const { unmount } = render(
      <Harness onSlashQueryChange={onSlashQueryChange} />
    )
    type('/')
    expect(onSlashQueryChange).toHaveBeenLastCalledWith('')
    type('/acm')
    expect(onSlashQueryChange).toHaveBeenLastCalledWith('acm')
    fireEvent.keyDown(getInput(), { key: 'Escape' })
    expect(onSlashQueryChange).toHaveBeenLastCalledWith(null)

    type('')
    type('/')
    type('/x')
    expect(onSlashQueryChange).toHaveBeenLastCalledWith('x')
    unmount()
    // unmount counts as closed — a consumer holding the query is not left stale
    expect(onSlashQueryChange).toHaveBeenLastCalledWith(null)
  })

  test('animateIn is opt-in per chip', () => {
    render(
      <Harness
        chips={[
          { id: 'a', label: 'Quiet' },
          { id: 'b', label: 'Popped', animateIn: true }
        ]}
      />
    )
    const animated = Array.from(document.querySelectorAll('span')).filter(
      span => span.className.includes('animate-popover-in')
    )
    expect(animated).toHaveLength(1)
    expect(animated[0].textContent).toContain('Popped')
  })

  test('typing / opens the grouped menu; the query filters labels and keywords', () => {
    render(<Harness />)

    type('/')
    expect(screen.getByRole('listbox')).toBeTruthy()
    expect(screen.getByText('Businesses')).toBeTruthy()
    expect(screen.getAllByRole('option')).toHaveLength(3)

    type('/sim')
    expect(screen.getAllByRole('option')).toHaveLength(1)
    expect(screen.getByRole('option', { name: /Sequoia/ })).toBeTruthy()

    type('/simzzz')
    expect(screen.getByText('No matches')).toBeTruthy()
  })

  test('arrows walk options via aria-activedescendant; Enter selects and cleans the query', () => {
    const onSlashSelect = vi.fn()
    const onSubmit = vi.fn()
    render(<Harness onSlashSelect={onSlashSelect} onSubmit={onSubmit} />)

    type('check /')
    const input = getInput()
    expect(input.getAttribute('aria-expanded')).toBe('true')

    // First option active by default; ArrowDown moves to the second.
    expect(
      screen
        .getByRole('option', { name: /Sequoia/ })
        .getAttribute('aria-selected')
    ).toBe('true')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(
      screen
        .getByRole('option', { name: /Faraway Data LLC/ })
        .getAttribute('aria-selected')
    ).toBe('true')
    expect(input.getAttribute('aria-activedescendant')).toContain('biz-2')

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSlashSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'biz-2' })
    )
    // Selecting is not sending, and the `/` text is removed from the value.
    expect(onSubmit).not.toHaveBeenCalled()
    expect(getInput().value).toBe('check ')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  test('Escape closes the menu without bubbling (panel Esc contract)', () => {
    const outerEscape = vi.fn()
    render(
      <div
        onKeyDown={event => {
          if (event.key === 'Escape') outerEscape()
        }}
      >
        <Harness />
      </div>
    )

    type('/')
    expect(screen.getByRole('listbox')).toBeTruthy()
    fireEvent.keyDown(getInput(), { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(outerEscape).not.toHaveBeenCalled()
  })

  test('a space after the slash query dismisses the menu', () => {
    render(<Harness />)

    type('/')
    type('/seq')
    expect(screen.getByRole('listbox')).toBeTruthy()
    type('/seq ')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  test('a mid-word slash does not open the menu', () => {
    render(<Harness />)

    type('a/')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  test('the + button opens the same menu and clicking an option keeps focus in the input', () => {
    const onSlashSelect = vi.fn()
    render(<Harness onSlashSelect={onSlashSelect} />)

    fireEvent.click(screen.getByRole('button', { name: 'Add context' }))
    expect(screen.getByRole('listbox')).toBeTruthy()
    expect(document.activeElement).toBe(getInput())

    fireEvent.click(screen.getByRole('option', { name: /CIP Orchestrator/ }))
    expect(onSlashSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'agent-1' })
    )
    expect(document.activeElement).toBe(getInput())
    expect(getInput().value).toBe('')
  })

  test('attachLabel makes the + a labeled button — same menu, same focus contract', () => {
    render(<Harness attachLabel='Add a business' />)
    const button = screen.getByRole('button', { name: 'Add a business' })
    expect(button.textContent).toContain('Add a business')
    expect(screen.queryByRole('button', { name: 'Add context' })).toBeNull()

    fireEvent.click(button)
    expect(screen.getByRole('listbox')).toBeTruthy()
    expect(document.activeElement).toBe(getInput())
  })

  test('a slash item description renders as a second line inside its option', () => {
    render(
      <Harness
        slashGroups={[
          {
            label: 'Records',
            items: [
              {
                id: 'r-1',
                label: 'Acme LLC',
                description: 'Houston, TX · R Goolsby'
              }
            ]
          }
        ]}
      />
    )
    type('/')
    const option = screen.getByRole('option', { name: /Acme LLC/ })
    expect(option.textContent).toContain('Houston, TX · R Goolsby')
  })

  test('inputRef reaches the textarea so a host can hand focus to it', () => {
    const ref = { current: null as HTMLTextAreaElement | null }
    render(
      <ChatComposer
        inputRef={ref}
        value=''
        onChange={() => {}}
        onSubmit={() => {}}
      />
    )
    expect(ref.current).toBe(getInput())
    ref.current?.focus()
    expect(document.activeElement).toBe(getInput())
  })

  test('focusRing: the standard frame wears the 2px ring; quiet darkens its own border instead', () => {
    const { unmount } = render(<Harness />)
    const frame = () => getInput().parentElement as HTMLElement
    expect(frame().className).toContain('focus-within:ring-2')
    unmount()

    render(
      <ChatComposer
        focusRing='quiet'
        value=''
        onChange={() => {}}
        onSubmit={() => {}}
      />
    )
    expect(frame().className).not.toContain('focus-within:ring-2')
    expect(frame().className).toContain(
      'focus-within:border-[var(--core-color-border-bold)]'
    )
  })

  test('minRows sets the resting height; menuPlacement and menuClassName move and size the menu', () => {
    render(
      <Harness
        menuClassName='max-h-[420px]'
        menuPlacement='below'
        minRows={3}
      />
    )
    expect(getInput().rows).toBe(3)

    type('/')
    const listbox = screen.getByRole('listbox')
    expect(listbox.className).toContain('max-h-[420px]')
    expect(listbox.className).not.toContain('max-h-64')
    expect(listbox.parentElement?.className).toContain('top-full')
  })

  test('the menu opens above by default and keeps its 256px cap', () => {
    render(<Harness />)
    expect(getInput().rows).toBe(1)
    type('/')
    const listbox = screen.getByRole('listbox')
    expect(listbox.className).toContain('max-h-64')
    expect(listbox.parentElement?.className).toContain('bottom-full')
  })

  test('a chip with detail renders a hover-card trigger on its label; without it, plain text', () => {
    render(
      <Harness
        chips={[
          { id: 'c1', label: 'Acme LLC', detail: <span>Houston, TX</span> },
          { id: 'c2', label: 'Plain Co' }
        ]}
      />
    )
    expect(screen.getByText('Acme LLC').getAttribute('data-state')).toBe(
      'closed'
    )
    expect(screen.getByText('Plain Co').getAttribute('data-state')).toBeNull()
  })

  test('Backspace in an empty input removes the last chip; the X removes a specific one', () => {
    const onRemoveChip = vi.fn()
    render(
      <Harness
        chips={[
          { id: 'c1', label: 'Sequoia' },
          { id: 'c2', label: 'CIP Orchestrator' }
        ]}
        onRemoveChip={onRemoveChip}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Remove Sequoia' }))
    expect(onRemoveChip).toHaveBeenCalledWith('c1')

    fireEvent.keyDown(getInput(), { key: 'Backspace' })
    expect(onRemoveChip).toHaveBeenLastCalledWith('c2')
  })

  test('chips alone are sendable context', () => {
    const onSubmit = vi.fn()
    render(
      <Harness chips={[{ id: 'c1', label: 'Sequoia' }]} onSubmit={onSubmit} />
    )

    const send = screen.getByRole('button', { name: 'Send message' })
    expect((send as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(send)
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  test('streaming swaps send for stop and blocks Enter submits', () => {
    const onSubmit = vi.fn()
    const onStop = vi.fn()
    render(<Harness isStreaming onStop={onStop} onSubmit={onSubmit} />)

    expect(screen.queryByRole('button', { name: 'Send message' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Stop generating' }))
    expect(onStop).toHaveBeenCalledTimes(1)

    type('queued thought')
    fireEvent.keyDown(getInput(), { key: 'Enter' })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  test('sendDisabled gates Enter and the button even with content; hint renders', () => {
    const onSubmit = vi.fn()
    render(
      <ChatComposer
        hint='Pick agents with /'
        sendDisabled
        slashGroups={SLASH_GROUPS}
        value='some text'
        onChange={() => {}}
        onSlashSelect={() => {}}
        onSubmit={onSubmit}
      />
    )

    expect(screen.getByText('Pick agents with /')).toBeTruthy()
    fireEvent.keyDown(getInput(), { key: 'Enter' })
    expect(onSubmit).not.toHaveBeenCalled()
    expect(
      (
        screen.getByRole('button', {
          name: 'Send message'
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
  })

  test('slashLoading shows skeleton rows instead of No matches', () => {
    render(
      <ChatComposer
        slashGroups={[{ label: 'Businesses', items: [] }]}
        slashLoading
        value=''
        onChange={() => {}}
        onSlashSelect={() => {}}
        onSubmit={() => {}}
      />
    )

    type('/')
    expect(screen.getByRole('listbox')).toBeTruthy()
    expect(screen.queryByText('No matches')).toBeNull()
  })

  test('disabled composer locks every affordance', () => {
    render(
      <ChatComposer
        disabled
        slashGroups={SLASH_GROUPS}
        value=''
        onChange={() => {}}
        onSlashSelect={() => {}}
        onSubmit={() => {}}
      />
    )

    expect(getInput().disabled).toBe(true)
    expect(
      (screen.getByRole('button', { name: 'Add context' }) as HTMLButtonElement)
        .disabled
    ).toBe(true)
    expect(
      (
        screen.getByRole('button', {
          name: 'Send message'
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
  })
})

describe('ChatLog / ChatMessage / ChatMarker', () => {
  test('the log is a screen-reader log region and renders turns', () => {
    render(
      <ChatLog>
        <ChatMarker>Run started</ChatMarker>
        <ChatMessage chips={[{ id: 'b', label: 'Sequoia' }]} role='user'>
          Verify this business
        </ChatMessage>
        <ChatMessage role='assistant'>Verified against SOS.</ChatMessage>
      </ChatLog>
    )

    const log = screen.getByRole('log', { name: 'Conversation' })
    expect(log).toBeTruthy()
    expect(log.className).toContain('overscroll-contain')
    expect(screen.getByText('Run started')).toBeTruthy()
    expect(screen.getByText('Verify this business')).toBeTruthy()
    expect(screen.getByText('Sequoia')).toBeTruthy()
    expect(screen.getByText('Verified against SOS.')).toBeTruthy()
  })

  test('a pending assistant message shows the shimmer placeholder', () => {
    render(<ChatMessage pending role='assistant' />)
    expect(screen.getByText('Thinking…')).toBeTruthy()
  })
})

describe('ChatMessageActions', () => {
  test('actions carry labels, fire clicks, and expose pressed state', () => {
    const onCopy = vi.fn()
    render(
      <ChatMessageActions
        actions={[
          { id: 'copy', icon: <span />, label: 'Copy', onClick: onCopy },
          { id: 'up', icon: <span />, label: 'Good response', active: true },
          { id: 'retry', icon: <span />, label: 'Retry', disabled: true }
        ]}
      />
    )

    expect(screen.getByRole('group', { name: 'Message actions' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    expect(onCopy).toHaveBeenCalledTimes(1)
    expect(
      screen
        .getByRole('button', { name: 'Good response' })
        .getAttribute('aria-pressed')
    ).toBe('true')
    expect(
      (screen.getByRole('button', { name: 'Retry' }) as HTMLButtonElement)
        .disabled
    ).toBe(true)
  })
})

describe('ChatSuggestions', () => {
  test('selecting a suggestion returns it; an empty set renders nothing', () => {
    const onSelect = vi.fn()
    const { rerender } = render(
      <ChatSuggestions
        suggestions={[
          { id: 's1', label: 'What changed on watchlists?' },
          { id: 's2', label: 'Which agent should I run first?' }
        ]}
        onSelect={onSelect}
      />
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'Which agent should I run first?' })
    )
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 's2' }))

    rerender(<ChatSuggestions suggestions={[]} onSelect={onSelect} />)
    expect(screen.queryByRole('group', { name: 'Suggestions' })).toBeNull()
  })
})

describe('ChatAttachment', () => {
  test('ready state shows meta; open and remove are wired', () => {
    const onOpen = vi.fn()
    const onRemove = vi.fn()
    render(
      <ChatAttachment
        attachment={{ id: 'a1', name: 'ss4.pdf', meta: 'PDF · 1.2 MB' }}
        onOpen={onOpen}
        onRemove={onRemove}
      />
    )

    expect(screen.getByText('PDF · 1.2 MB')).toBeTruthy()
    fireEvent.click(screen.getByText('ss4.pdf'))
    expect(onOpen).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Remove ss4.pdf' }))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  test('status narrates uploading and failure over the meta line', () => {
    const { rerender } = render(
      <ChatAttachment
        attachment={{ id: 'a1', name: 'ss4.pdf', meta: 'PDF · 1.2 MB' }}
        status='uploading'
      />
    )
    expect(screen.getByText('Uploading…')).toBeTruthy()

    rerender(
      <ChatAttachment
        attachment={{ id: 'a1', name: 'ss4.pdf', meta: 'PDF · 1.2 MB' }}
        status='error'
      />
    )
    expect(screen.getByText('Upload failed')).toBeTruthy()
    expect(screen.queryByText('PDF · 1.2 MB')).toBeNull()
  })
})

describe('density', () => {
  test('standard is the default: 14px/24 body, 40px composer floor, 28px send', () => {
    render(
      <>
        <ChatMessage role='assistant'>Verified.</ChatMessage>
        <Harness />
      </>
    )

    const body = screen.getByText('Verified.')
    expect(body.className).toContain('text-sm')
    expect(body.className).toContain('leading-6')
    expect(getInput().className).toContain('min-h-10')
    expect(
      screen.getByRole('button', { name: 'Send message' }).className
    ).toContain('h-7')
  })

  test('compact drops to the caption ramp with 24px-floor controls', () => {
    render(
      <>
        <ChatMessage density='compact' role='assistant'>
          Verified.
        </ChatMessage>
        <ChatSuggestions
          density='compact'
          suggestions={[{ id: 's1', label: 'Trace the structure' }]}
          onSelect={() => {}}
        />
        <ChatComposer
          density='compact'
          value=''
          onChange={() => {}}
          onSubmit={() => {}}
        />
      </>
    )

    const body = screen.getByText('Verified.')
    expect(body.className).toContain('text-caption')
    expect(body.className).not.toContain('leading-6')
    const pill = screen.getByRole('button', { name: 'Trace the structure' })
    expect(pill.className).toContain('h-6')
    expect(pill.className).toContain('text-caption')
    expect(getInput().className).toContain('min-h-9')
    expect(getInput().className).toContain('text-caption')
    expect(
      screen.getByRole('button', { name: 'Send message' }).className
    ).toContain('h-6')
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
        <ChatMessage role='assistant'>Inherited</ChatMessage>
        <ChatMessage density='standard' role='assistant'>
          Overridden
        </ChatMessage>
      </FloatingPanel>
    )

    expect(screen.getByText('Inherited').className).toContain('text-caption')
    const overridden = screen.getByText('Overridden')
    expect(overridden.className).toContain('leading-6')
    expect(overridden.className).not.toContain('text-caption')
  })
})
