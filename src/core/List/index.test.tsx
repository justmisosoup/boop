import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, test, vi } from 'vitest'

import List from './index'

type Row = { id: string; name: string; state: string }

const COLUMNS = [
  { key: 'name', title: 'Name' },
  { key: 'state', title: 'State', sortBy: 'state' }
]

const ROWS: Row[] = [
  { id: '1', name: 'Acme', state: 'CA' },
  { id: '2', name: 'Globex', state: 'NY' }
]

describe('List', () => {
  test('renders columns and row values', () => {
    render(<List<Row> columns={COLUMNS} data={ROWS} />)

    expect(screen.getByText('Name')).not.toBeNull()
    expect(screen.getByText('Acme')).not.toBeNull()
    expect(screen.getByText('Globex')).not.toBeNull()
  })

  test('invokes onSort with the column sortBy when header is clicked', () => {
    const onSort = vi.fn()

    render(<List<Row> columns={COLUMNS} data={ROWS} onSort={onSort} />)

    fireEvent.click(screen.getByText('State'))
    expect(onSort).toHaveBeenCalledWith('state')
  })

  test('invokes onRowClick with the row when a row is clicked', () => {
    const onRowClick = vi.fn()

    render(<List<Row> columns={COLUMNS} data={ROWS} onRowClick={onRowClick} />)

    fireEvent.click(screen.getByText('Acme'))
    expect(onRowClick).toHaveBeenCalledTimes(1)
    expect(onRowClick.mock.calls[0][1]).toEqual(ROWS[0])
  })

  test('renders the new-tab action as an anchor', () => {
    render(
      <MemoryRouter>
        <List<Row>
          columns={COLUMNS}
          data={ROWS}
          to={({ id }) => `/businesses/1/orders/${id}`}
        />
      </MemoryRouter>
    )

    const [link] = screen.getAllByLabelText('Open row in new tab')

    expect(link.tagName).toBe('A')
    expect(link.getAttribute('href')).toBe('/businesses/1/orders/1')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noreferrer')
  })

  test('does not intercept modified row link clicks', () => {
    render(
      <MemoryRouter initialEntries={['/businesses/1/orders']}>
        <Routes>
          <Route
            path='/businesses/1/orders'
            element={
              <List<Row>
                columns={COLUMNS}
                data={ROWS}
                to={({ id }) => `/businesses/1/orders/${id}`}
              />
            }
          />
          <Route
            path='/businesses/1/orders/:orderId'
            element={<div>Order details</div>}
          />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.click(screen.getByText('Acme'), { ctrlKey: true })

    expect(screen.queryByText('Order details')).toBeNull()
    expect(screen.getByText('Globex')).not.toBeNull()
  })

  test('navigates row links without reloading the page', () => {
    render(
      <MemoryRouter initialEntries={['/businesses/1/orders']}>
        <Routes>
          <Route
            path='/businesses/1/orders'
            element={
              <List<Row>
                columns={COLUMNS}
                data={ROWS}
                to={({ id }) => `/businesses/1/orders/${id}`}
              />
            }
          />
          <Route
            path='/businesses/1/orders/:orderId'
            element={<div>Order details</div>}
          />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.click(screen.getByText('Acme'))

    expect(screen.getByText('Order details')).not.toBeNull()
  })
})
