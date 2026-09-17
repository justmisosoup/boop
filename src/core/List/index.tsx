import type React from 'react'

import get from 'lodash/get'
import { type To, useLinkClickHandler } from 'react-router'
import styled from 'styled-components'

import { ButtonIcon } from '../ButtonIcon'
import DateTime from '../DateTime'
import { Icon } from '../Icon'
import type { LinkProps } from '../Link'
import Pagination from '../Pagination'
import { colors, spacing, typography } from '../theme'

import Controls from './Controls'
import Filters from './Filters'
import { isDateTime } from './utils'

type Row<T = Record<string, unknown>> = T & {
  anchor?: boolean
  children?: React.ReactNode
  className?: string
  onClick?: React.MouseEventHandler
  to?: LinkProps['to']
}

const NavigableRow = ({ to, children, ...rest }: Row) => {
  const handleClick = useLinkClickHandler<HTMLTableRowElement>(to as To)

  return (
    <tr {...rest} onClick={handleClick}>
      {children}
    </tr>
  )
}

const Row = styled(({ to, children, onClick, ...rest }: Row) => {
  if (to) {
    return (
      <NavigableRow to={to} {...rest}>
        {children}
      </NavigableRow>
    )
  }

  if (onClick) {
    return (
      <tr onClick={onClick} {...rest}>
        {children}
      </tr>
    )
  }

  return <tr {...rest}>{children}</tr>
})`
  align-items: center;
  background: white;
  border: solid ${colors.frost};
  border-bottom: 1px solid ${colors.frost};
  border-width: 0 1px 1px;
  color: ${colors.graphite};
  display: inline-flex;
  font-family: ${typography.faces.default};
  font-weight: normal;
  min-height: min-content;
  min-width: min-content;
  outline-offset: 0;
  padding: ${spacing.medium} ${spacing.large};
  text-align: left;
  width: 100%;

  @media (max-width: 480px) {
    flex-wrap: wrap;
    min-width: 50%;
  }

  [data-active]:not([disabled]),
  :active:not(:disabled) {
    color: ${colors.graphite};
  }

  &:hover,
  &:focus {
    > td[data-show-on-hover] {
      opacity: 1;
    }
  }

  ${({ onClick, to }) => {
    if (onClick || to) {
      return `
        cursor: pointer
      `
    }
  }}
`

const BodyRow = styled(Row)`
  ${({ onClick, to }) => {
    if (onClick || to) {
      return `
        &:focus,
        &:hover:not(:disabled) {
          background-color: ${colors.frostLight};
        }
      `
    }
  }}
`

const HeaderCell = styled.th<Column>`
  flex: 1 1 0;
  flex-grow: ${({ width }) => (width ? `${width}` : 'auto')};
  font-weight: ${typography.weights.normal};
  min-width: ${({ minWidth }) => (minWidth ? `${minWidth}px` : 'unset')};
  padding-right: ${spacing.xsmall};

  ${({ ellipsis = true }) => {
    if (ellipsis) {
      return `
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      `
    }
  }}
`

const Cell = styled.td<ColumnInformation>`
  align-items: center;
  display: flex;
  flex: 1 1 0;
  flex-grow: ${({ width }) => (width ? `${width}` : 'auto')};
  height: 43px;
  justify-content: ${({ lastColumn }) => (lastColumn ? 'center' : null)};
  min-width: ${({ minWidth }) => (minWidth ? `${minWidth}px` : 'unset')};
  padding-right: ${spacing.xsmall};

  ${({ ellipsis = true }) => {
    if (ellipsis) {
      return `
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      `
    }
  }}

  ${({ showOnHover }) => {
    if (showOnHover) {
      return `
        opacity: 0;
        transition: opacity 0.2s ease;
      `
    }
  }}
`

const Table = styled.table`
  background: inherit;
  display: flex;
  flex: 1 0 auto;
  flex-direction: column;
  font-size: ${typography.sizes.medium};
  height: inherit;
  width: 100%;
`

const HeaderRow = styled(Row)`
  background: white;
  color: ${colors.karl};
  cursor: default;
  padding: ${spacing.small} ${spacing.large};

  /* Override Row's :active state to prevent color changes on non-sortable headers */
  &:active:not(:disabled) {
    color: ${colors.karl};
  }

  > th[data-sort-order] {
    color: black;
    font-weight: 600;

    @media screen and (prefers-reduced-motion: reduce) {
      &::after {
        border-bottom: 8px solid ${colors.graphite};
        border-left: 4px solid transparent;
        border-right: 4px solid transparent;
        content: '';
        display: inline-block;
        height: 0;
        margin-bottom: 1px;
        margin-left: 4px;
        transition: none;
        width: 0;
      }
    }

    &::after {
      border-bottom: 8px solid ${colors.graphite};
      border-left: 4px solid transparent;
      border-right: 4px solid transparent;
      content: '';
      display: inline-block;
      height: 0;
      margin-bottom: 1px;
      margin-left: 4px;
      transition: transform 250ms ease;
      width: 0;
    }
  }

  > th[data-sort-order='desc']::after {
    transform: rotate(180deg);
  }
`

const TopBar = styled.tr`
  border-bottom: 1px solid ${colors.frost};
  display: flex;
  justify-content: space-between;
  padding: ${spacing.small} ${spacing.large};
`

const Header = styled.thead<{ sticky?: boolean; top?: number }>`
  background: inherit;
  position: ${({ sticky = false }) => (sticky ? 'sticky' : 'unset')};
  top: ${({ top = 0 }) => top}px;
  width: 100%;

  & > :first-child {
    background: white;
    border: 1px solid ${colors.frost};
    border-radius: 10px 10px 0 0;
  }
`
const Body = styled.tbody`
  > tr {
    display: inline-flex;
    width: 100%;

    &:last-child {
      border-bottom: 1px solid ${colors.frost};
      border-radius: 0 0 10px 10px;
    }
  }
`

const NewTabIcon = styled(ButtonIcon)`
  background-color: transparent;
  border: none;
  color: ${colors.graphite};
  min-height: 35px;
  min-width: 35px;

  &:hover,
  :focus {
    background-color: ${colors.frost} !important;
  }

  :focus:not(:focus-visible) {
    background-color: transparent !important;
  }
`

type Column<T = Record<string, unknown>> = {
  /** Whether to show an ellipsis on overflow. */
  ellipsis?: boolean
  key: string
  /** Minimum width of the column. */
  minWidth?: number
  render?: (values: Row<T>) => React.ReactNode
  /** Whether to show this cell only on row hover. */
  showOnHover?: boolean
  sortBy?: string
  title?: React.ReactNode
  type?: string
  width?: number
}

type ColumnInformation = Column & {
  lastColumn?: boolean
}

export interface ListProps<T> extends React.HTMLAttributes<HTMLDivElement> {
  anchor?: boolean
  children?: React.ReactNode
  /** The column definitions for the list */
  columns: Column<T>[]
  /** The row values for the list */
  data: Row<T>[]
  /** Callback to invoke when a row is clicked. */
  onRowClick?: (e: React.MouseEvent, values: T) => void
  /** Handler for sorting */
  onSort?: (sortKey?: string) => void
  /** A tuple for sort key and order */
  sort?: [string, string]
  /** Whether the controls and header stick on scroll. */
  stickyHeader?: boolean
  /** Generator for row links */
  to?: (data: T) => LinkProps['to']
  /** Position at which the header should stick. */
  top?: number
  /** Callback to invoke when a new tab icon is clicked. */
  onNewTabClick?: (values: T) => void
}

const renderOpenNewLink = (
  url: string,
  onNewTabClick: (() => void) | undefined
) => {
  const handleClick: React.MouseEventHandler = e => {
    e.stopPropagation()

    if (onNewTabClick) {
      e.preventDefault()
      onNewTabClick()
    }
  }

  return (
    <>
      <NewTabIcon
        href={onNewTabClick ? undefined : url}
        onClick={handleClick}
        rel={onNewTabClick ? undefined : 'noreferrer'}
        target={onNewTabClick ? undefined : '_blank'}
        ariaLabel='Open row in new tab'
      >
        <Icon name='externalLink' size={20} />
      </NewTabIcon>
    </>
  )
}

const renderNewTabColumn = (): Column => {
  return {
    key: 'newTab',
    title: '',
    width: 0.3,
    showOnHover: true
  }
}

const List = <T,>({
  anchor,
  children,
  columns,
  data,
  onRowClick,
  onSort,
  sort,
  stickyHeader,
  to,
  top,
  onNewTabClick,
  ...rest
}: ListProps<T>) => {
  const [sortKey, sortOrder] = sort || []

  const showNewTabColumn = to || onNewTabClick
  const newTabColumn = showNewTabColumn ? [renderNewTabColumn()] : []
  const allColumns = [...columns, ...newTabColumn]

  return (
    <Table {...rest}>
      <Header sticky={stickyHeader} top={top} tabIndex={0}>
        {children && <TopBar>{children}</TopBar>}
        <HeaderRow top={top}>
          {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
          {allColumns.map(({ key, render, sortBy, title, ...column }) => {
            return (
              <HeaderCell
                key={key}
                onClick={onSort ? () => onSort(sortBy) : undefined}
                {...(sortKey === sortBy
                  ? { 'data-sort-order': sortOrder }
                  : {})}
                {...column}
              >
                {title}
              </HeaderCell>
            )
          })}
        </HeaderRow>
      </Header>
      <Body tabIndex={0}>
        {(data || []).map((values, index) => {
          return (
            <BodyRow
              key={index}
              to={to && to(values)}
              anchor={anchor}
              onClick={
                onRowClick
                  ? (e: React.MouseEvent) => onRowClick(e, values)
                  : undefined
              }
            >
              {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
              {allColumns.map(({ key, render, title, type, ...column }, i) => {
                let value = get(values, key) as React.ReactNode
                const lastColumn = i === allColumns.length - 1

                if (lastColumn && showNewTabColumn) {
                  const url = to && to(values)
                  const newTabOnClick = onNewTabClick
                    ? () => onNewTabClick(values)
                    : undefined

                  value = renderOpenNewLink(url as string, newTabOnClick)
                }

                if (render) {
                  value = render(values)
                } else if (isDateTime(value, type)) {
                  value = <DateTime>{value}</DateTime>
                }

                return (
                  <Cell
                    key={`${key}-${i}`}
                    lastColumn={showNewTabColumn && lastColumn}
                    data-show-on-hover={column.showOnHover || undefined}
                    {...column}
                  >
                    {value}
                  </Cell>
                )
              })}
            </BodyRow>
          )
        })}
      </Body>
    </Table>
  )
}

List.Controls = Controls
List.Filters = Filters
List.Pagination = Pagination

export default List
