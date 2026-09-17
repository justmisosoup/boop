import React from 'react'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest'

import {
  DataTable,
  type DataTableColumnDef,
  DataTableRowActions,
  type DataTableSortState
} from './DataTable'

type UserRow = {
  id: string
  name: string
  email: string
  role: string
}

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

const rows: UserRow[] = [
  {
    id: 'user-1',
    name: 'Avery Admin',
    email: 'avery@example.test',
    role: 'Admin'
  },
  {
    id: 'user-2',
    name: 'Devon Developer',
    email: 'devon@example.test',
    role: 'Developer'
  }
]

const columns: DataTableColumnDef<UserRow>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'role', header: 'Role' }
]

describe('DataTable', () => {
  test('renders rows with stable row ids', () => {
    render(<DataTable caption='Users' columns={columns} data={rows} />)

    expect(screen.getByText('Avery Admin')).not.toBeNull()
    expect(screen.getByText('devon@example.test')).not.toBeNull()
  })

  test('requires getRowId when rows do not have string ids', () => {
    const namelessRows = [{ name: 'Avery Admin' }]
    const namelessColumns: DataTableColumnDef<{ name: string }>[] = [
      { accessorKey: 'name', header: 'Name' }
    ]

    expect(() =>
      render(<DataTable columns={namelessColumns} data={namelessRows} />)
    ).toThrow('DataTable rows require getRowId')
  })

  test('emits controlled sort changes from sortable headers', () => {
    const onSortChange = vi.fn<(sort: DataTableSortState) => void>()

    render(
      <DataTable
        columns={[{ accessorKey: 'name', header: 'Name', enableSorting: true }]}
        data={rows}
        onSortChange={onSortChange}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /name/i }))

    expect(onSortChange).toHaveBeenCalledWith({ id: 'name', direction: 'asc' })
  })

  test('supports descending-first controlled sort columns', () => {
    const onSortChange = vi.fn<(sort: DataTableSortState) => void>()
    const { rerender } = render(
      <DataTable
        columns={[
          {
            accessorKey: 'name',
            header: 'Name',
            enableSorting: true,
            sortDescFirst: true
          }
        ]}
        data={rows}
        onSortChange={onSortChange}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /name/i }))

    expect(onSortChange).toHaveBeenLastCalledWith({
      id: 'name',
      direction: 'desc'
    })

    rerender(
      <DataTable
        columns={[
          {
            accessorKey: 'name',
            header: 'Name',
            enableSorting: true,
            sortDescFirst: true
          }
        ]}
        data={rows}
        onSortChange={onSortChange}
        sort={{ id: 'name', direction: 'desc' }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /name/i }))

    expect(onSortChange).toHaveBeenLastCalledWith({
      id: 'name',
      direction: 'asc'
    })
  })

  test('does not render inert sort controls without a sort handler', () => {
    render(
      <DataTable
        columns={[{ accessorKey: 'name', header: 'Name', enableSorting: true }]}
        data={rows}
      />
    )

    expect(screen.queryByRole('button', { name: /name/i })).toBeNull()
    expect(screen.getByText('Name')).not.toBeNull()
  })

  test('supports keyboard activation for selectable rows', () => {
    const onSelect = vi.fn()

    render(
      <DataTable
        columns={columns}
        data={rows}
        rowIntent={{ kind: 'select', onSelect }}
      />
    )

    fireEvent.keyDown(screen.getByRole('button', { name: /avery admin/i }), {
      key: 'Enter'
    })

    expect(onSelect).toHaveBeenCalledWith(rows[0])
  })

  test('allows row clicks through interactive cells marked for click-through', () => {
    const onOpen = vi.fn<(row: UserRow) => void>()

    render(
      <DataTable
        columns={[
          { accessorKey: 'name', header: 'Name' },
          {
            id: 'actions',
            header: 'Actions',
            cell: ({ row }) =>
              row.original.id === 'user-1' ? (
                <button type='button'>Plain action</button>
              ) : (
                <button type='button' data-row-click-through>
                  <span>Click-through action</span>
                </button>
              )
          }
        ]}
        data={rows}
        rowIntent={{ kind: 'detail', onOpen }}
      />
    )

    const firstRow = screen.getByText('Avery Admin').closest('tr')
    expect(firstRow).not.toBeNull()

    fireEvent.click(
      firstRow?.querySelector(
        'button[type="button"]:not([data-row-click-through])'
      ) ??
        (() => {
          throw new Error('Expected plain action button')
        })()
    )

    expect(onOpen).not.toHaveBeenCalled()

    const secondRow = screen.getByText('Devon Developer').closest('tr')
    expect(secondRow).not.toBeNull()

    fireEvent.click(
      secondRow?.querySelector('[data-row-click-through] span') ??
        (() => {
          throw new Error('Expected click-through action span')
        })()
    )

    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onOpen).toHaveBeenCalledWith(rows[1])
  })

  test('renders loading, empty, and error states', () => {
    // `data` undefined = "not loaded yet" → loading region (not the empty state).
    const { rerender } = render(
      <DataTable columns={columns} data={undefined} />
    )

    expect(screen.getByText('Loading records')).not.toBeNull()

    rerender(<DataTable columns={columns} data={[]} empty='No users yet' />)
    expect(screen.getByText('No users yet')).not.toBeNull()

    rerender(
      <DataTable columns={columns} data={[]} error='Unable to fetch users' />
    )
    expect(screen.getByText('Unable to fetch users')).not.toBeNull()
  })

  test('does not flash the empty state during the initial load', () => {
    // The core fix: while data is undefined we must show loading, never "empty",
    // even though there are zero rows to render yet.
    render(
      <DataTable columns={columns} data={undefined} empty='No users yet' />
    )

    expect(screen.queryByText('No users yet')).toBeNull()
    expect(screen.getByText('Loading records')).not.toBeNull()
  })

  test('renders the caption in the loading table to keep table layout stable', () => {
    const { container, rerender } = render(
      <DataTable caption='Users' columns={columns} data={undefined} />
    )

    expect(container.querySelector('table caption')?.textContent).toBe('Users')

    rerender(<DataTable caption='Users' columns={columns} data={rows} />)
    expect(container.querySelector('table caption')?.textContent).toBe('Users')
  })

  test('supports overriding skeleton row height for tables with taller cells', () => {
    const { container } = render(
      <DataTable
        columns={columns}
        data={undefined}
        skeletonRowHeight={52.5}
        skeletonRows={1}
      />
    )

    expect(
      container.querySelector('tbody td')?.getAttribute('style')
    ).toContain('height: 52.5px')
  })

  test('only shows the empty state once a defined (empty) array has loaded', () => {
    const { rerender } = render(
      <DataTable columns={columns} data={undefined} empty='No users yet' />
    )
    expect(screen.queryByText('No users yet')).toBeNull()

    rerender(<DataTable columns={columns} data={[]} empty='No users yet' />)
    expect(screen.getByText('No users yet')).not.toBeNull()
  })

  test('keeps rows visible and marks busy on a refetch', () => {
    const { rerender, container } = render(
      <DataTable columns={columns} data={rows} />
    )
    expect(screen.getByText('Avery Admin')).not.toBeNull()

    // Refetch with rows already present: keep the rows, flag busy (progress bar).
    rerender(<DataTable loading columns={columns} data={rows} />)
    expect(screen.getByText('Avery Admin')).not.toBeNull()
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  })

  test('renders pagination controls when a page handler is provided', () => {
    const onPageChange = vi.fn()

    render(
      <DataTable
        columns={columns}
        data={rows}
        pagination={{ page: 1, perPage: 1, total: 2 }}
        onPageChange={onPageChange}
      />
    )

    expect(screen.getByText('Page 1 of 2')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(onPageChange).toHaveBeenCalledWith(2)
  })
})

describe('DataTableRowActions', () => {
  test('renders row actions with disabled reasons and stops row click propagation', async () => {
    const onRowClick = vi.fn()
    const onEdit = vi.fn()

    render(
      <table>
        <tbody>
          <tr onClick={onRowClick}>
            <td>
              <DataTableRowActions
                label='Open actions for Avery Admin'
                row={rows[0]}
                actions={[
                  {
                    id: 'edit',
                    label: 'Edit user',
                    disabled: row => row.role === 'Admin',
                    disabledReason: 'Admins are managed externally.',
                    onSelect: onEdit
                  }
                ]}
              />
            </td>
          </tr>
        </tbody>
      </table>
    )

    const trigger = screen.getByRole('button', {
      name: 'Open actions for Avery Admin'
    })

    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false })

    const item = await screen.findByRole('menuitem', { name: 'Edit user' })
    expect(item.getAttribute('data-disabled')).not.toBeNull()
    expect(screen.getByText('Admins are managed externally.')).not.toBeNull()

    fireEvent.click(item)
    await waitFor(() => {
      expect(onRowClick).not.toHaveBeenCalled()
      expect(onEdit).not.toHaveBeenCalled()
    })
  })
})

describe('DataTable truncation tooltips', () => {
  // jsdom doesn't lay out, so drive the overflow check by stubbing the measured
  // widths on the element prototype.
  const mockWidths = (scrollWidth: number, clientWidth: number) => {
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get: () => scrollWidth
    })
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => clientWidth
    })
  }

  // Capture the original (jsdom) descriptors so each test fully restores them
  // and can't leak the stubbed widths into other test files.
  const originalWidthDescriptors = {
    scrollWidth: Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollWidth'
    ),
    clientWidth: Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'clientWidth'
    )
  }

  afterEach(() => {
    for (const prop of ['scrollWidth', 'clientWidth'] as const) {
      const original = originalWidthDescriptors[prop]
      if (original) {
        Object.defineProperty(HTMLElement.prototype, prop, original)
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, prop)
      }
    }
  })

  const truncatingColumns: DataTableColumnDef<UserRow>[] = [
    { accessorKey: 'name', header: 'Name', meta: { truncate: true, width: 80 } }
  ]

  test('reveals a clipped text cell value in a tooltip when it overflows', () => {
    mockWidths(220, 80)
    render(<DataTable columns={truncatingColumns} data={rows} />)

    const cell = screen.getByText('Avery Admin')
    expect(cell.closest('button')).not.toBeNull()
  })

  test('leaves a text cell untouched when it fits', () => {
    mockWidths(80, 80)
    render(<DataTable columns={truncatingColumns} data={rows} />)

    const cell = screen.getByText('Avery Admin')
    expect(cell.closest('button')).toBeNull()
  })
})
