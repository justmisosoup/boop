import type React from 'react'
import { Component, cloneElement, Children } from 'react'

import type { Placement } from '@popperjs/core'
import { Manager, Popper, Reference } from 'react-popper'
import styled from 'styled-components'

import { colors, spacing, typography } from './theme'

type DropdownProps = {
  children: React.ReactElement | React.ReactElement[]
  isOpen?: boolean
  onToggle?: (state: DropdownState) => void
  position?: Placement
}

type DropdownState = {
  isOpen: boolean
}

const Subheader = styled.div`
  border-bottom: 1px solid ${colors.frost};
  display: flex;
  flex-direction: column;
  margin-bottom: ${spacing.compact};
  padding: ${spacing.compact} ${spacing.normal};
  padding-bottom: ${spacing.normal};
`

const Toggle = styled.a`
  cursor: pointer;
  display: inline-block;
  font-size: ${typography.sizes.medium};
  line-height: 1rem;
`

const Search = styled.input`
  border: none;
  font-size: ${typography.sizes.medium};
  outline: none;
  padding: 10px 20px;
`

const Menu = styled.div`
  background-color: white;
  border: 1px solid ${colors.frost};
  border-radius: 4px;
  box-shadow: 0 3px 3px 3px rgb(0 0 0 / 2.5%);
  font-size: ${typography.sizes.medium};
  margin-top: 10px;
  padding: 10px 0;
  width: 200px;
  z-index: 1;
`

const Interactive = styled.div``

const Option = styled.div<{ selected?: boolean }>`
  color: ${colors.graphite};
  cursor: pointer;
  padding: 10px 20px;

  ${({ selected }) => {
    if (selected) {
      return `
        background: ${colors.frostLight};
        cursor: default;

        > div {
          font-weight: ${typography.weights.bold};
        }
      `
    }
  }}

  &:hover,
  &:focus {
    background-color: ${colors.dawn};
    color: black;
  }
`

class Dropdown extends Component<DropdownProps, DropdownState> {
  static defaultProps: Partial<DropdownProps> = {
    onToggle: () => undefined,
    isOpen: false
  }

  static Subheader = Subheader
  static Toggle = Toggle
  static Search = Search
  static Menu = Menu
  static Interactive = Interactive
  static Option = Option

  private menu: HTMLElement | null = null

  constructor(props: DropdownProps) {
    super(props)

    this.state = {
      isOpen: Boolean(props.isOpen)
    }
  }

  componentDidMount() {
    document.addEventListener('scroll', this.onClickOut, true)
    document.addEventListener('mousedown', this.onClickOut, true)
  }

  componentWillUnmount() {
    document.removeEventListener('scroll', this.onClickOut, true)
    document.removeEventListener('mousedown', this.onClickOut, true)
  }

  componentDidUpdate(prevProps: DropdownProps, prevState: DropdownState) {
    const { onToggle, isOpen: proppedIsOpen } = this.props
    const { isOpen } = this.state

    if (prevProps.isOpen !== proppedIsOpen) {
      this.setState({
        isOpen: Boolean(proppedIsOpen)
      })
    } else if (prevState.isOpen !== isOpen && onToggle) {
      onToggle(this.state)
    }
  }

  render() {
    const { children, position = 'bottom-end' } = this.props
    const { isOpen } = this.state
    const { onClick, onSelect } = this
    let toggle: React.ReactElement | undefined
    let menu: React.ReactElement | undefined

    const childArray = Array.isArray(children) ? children : [children]

    for (const child of childArray) {
      const { type } = child

      if (type === Dropdown.Toggle) {
        toggle = child
      } else if (type === Dropdown.Menu) {
        menu = child
      }
    }

    return (
      <div>
        <Manager>
          <Reference>
            {({ ref }) =>
              toggle ? cloneElement(toggle, { ref, onClick }) : null
            }
          </Reference>
          {isOpen && menu ? (
            <Popper
              placement={position}
              innerRef={(m: HTMLElement | null) => {
                this.menu = m
              }}
            >
              {({ ref, style, placement }) => {
                const menuChildrenProp = (
                  menu as React.ReactElement<{
                    children: React.ReactElement | React.ReactElement[]
                  }>
                ).props.children
                const menuChildren = Array.isArray(menuChildrenProp)
                  ? menuChildrenProp
                  : [menuChildrenProp]

                return cloneElement(menu as React.ReactElement, {
                  children: Children.map(menuChildren, e => {
                    if (!e) {
                      return null
                    } else if (e.type === Dropdown.Search) {
                      return cloneElement(e)
                    } else if (e.type !== Dropdown.Interactive) {
                      const existingOnClick = (
                        e.props as { onClick?: (event: unknown) => void }
                      ).onClick
                      return cloneElement(e, {
                        onClick: existingOnClick
                          ? (event: unknown) => {
                              existingOnClick(event)
                              onSelect()
                            }
                          : onSelect
                      } as Partial<unknown>)
                    } else {
                      const existingOnClick = (
                        e.props as { onClick?: (event: unknown) => void }
                      ).onClick
                      return cloneElement(e, {
                        onClick: existingOnClick
                          ? (event: unknown) => {
                              existingOnClick(event)
                            }
                          : null
                      } as Partial<unknown>)
                    }
                  }),
                  ref,
                  style,
                  'data-placement': placement
                })
              }}
            </Popper>
          ) : (
            ''
          )}
        </Manager>
      </div>
    )
  }

  onClick = () => {
    this.setState({ isOpen: !this.state.isOpen })
  }

  onClickOut = (event: Event) => {
    const target = event.target as HTMLElement | null
    const { menu } = this

    if (!target) {
      return
    }

    const tagType = (target as HTMLInputElement).type

    if (
      tagType === 'text' ||
      !menu ||
      target === menu ||
      menu.contains(target)
    ) {
      return
    }

    this.setState({ isOpen: false })
  }

  onSelect = () => {
    this.setState({ isOpen: !this.state.isOpen })
  }
}

export default Dropdown
