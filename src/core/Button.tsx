import type React from 'react'

import { Link, type LinkProps as RouterLinkProps } from 'react-router'
import styled, { ThemeProvider } from 'styled-components'

import { primary, secondary, transparent, typography } from './theme'

const Component = styled.button`
  appearance: none;
  background-color: ${({ theme }) => (theme as typeof primary).backgroundColor};
  border: 1px solid transparent;
  border-color: ${({ theme }) => (theme as typeof primary).borderColor};
  border-radius: 35px;
  color: ${({ theme }) => (theme as typeof primary).color};
  cursor: pointer;
  display: inline-block;
  font-family: inherit;
  font-size: ${typography.sizes.medium};
  font-weight: ${typography.weights.bold};
  line-height: 1;
  max-height: 35px;
  min-width: 80px;
  outline: none;
  padding: 9px 20px 10px;
  text-align: center;
  text-decoration: none;
  transition:
    background-color 150ms ease,
    border-color 150ms ease,
    color 150ms ease;
  user-select: none;
  white-space: nowrap;

  &[data-focus='true'],
  &[data-hover='true'],
  &:focus:not([disabled]),
  &:hover:not([disabled]) {
    background-color: ${({ theme }) => (theme as typeof primary).hover.backgroundColor};
  }

  &[data-hover='true'],
  &:hover:not([disabled]) {
    border-color: ${({ theme }) => (theme as typeof primary).hover.borderColor};
  }

  &[data-focus='true'],
  &:focus-visible:not([disabled]) {
    border-color: ${({ theme }) => (theme as typeof primary).focus.borderColor};
    outline: 2px solid ${({ theme }) => (theme as typeof primary).focus.outlineColor};
    outline-offset: 2px;
  }

  &[data-active='true']:not([disabled]),
  &:active:not([disabled]) {
    background-color: ${({ theme }) => (theme as typeof primary).active.backgroundColor};
    border-color: ${({ theme }) => (theme as typeof primary).active.borderColor};
  }

  &[disabled] {
    background-color: ${({ theme }) => (theme as typeof primary).disabled.backgroundColor};
    border-color: ${({ theme }) => (theme as typeof primary).disabled.borderColor};
    color: ${({ theme }) => (theme as typeof primary).disabled.color};
    cursor: default;
  }
`

const themes = Object.freeze({
  primary,
  secondary,
  submit: primary,
  cancel: secondary,
  transparent
})

// TODO: Split out Link
// TODO: Add label prop
export type ButtonProps = {
  children?: React.ReactNode
  className?: string
  /**
   * The button's disabled state
   */
  disabled?: boolean
  /**
   * URL to point to (used by native anchor element - not React Router's Link)
   */
  href?: string
  to?: string | RouterLinkProps['to']
  /**
   * The button's click handler
   */
  onClick?: React.MouseEventHandler
  rel?: string
  style?: React.CSSProperties
  target?: string
  title?: string
  /**
   * Type dictates the theme for the button
   */
  type?: 'primary' | 'secondary' | 'submit' | 'cancel' | 'transparent'
}

type InternalProps = Omit<ButtonProps, 'type'> & {
  as?: 'a' | 'input' | typeof Link
  type?: 'submit' | 'button'
  value?: string | number | readonly string[]
}

export const Button = ({
  children,
  type: variant = 'primary',
  disabled,
  onClick,
  to,
  href,
  style,
  ...etc
}: ButtonProps) => {
  const theme = themes[variant]
  let props: Partial<InternalProps> = {
    ...etc,
    onClick,
    style,
    disabled,
    children
  }

  if (variant === 'submit' || variant === 'cancel') {
    const { children: value, ...rest } = props

    props = rest
    props.type = variant === 'submit' ? variant : 'button'
    props.as = 'input'
    props.value = value as string
  }

  if (to) {
    props.to = to
    props.as = Link
  } else if (href) {
    props.as = 'a'
    props.href = href
  }

  return (
    <ThemeProvider theme={theme}>
      <Component {...props} />
    </ThemeProvider>
  )
}
