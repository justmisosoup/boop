import type React from 'react'
import type { CSSProperties, FC } from 'react'

import {
  Link as RouterLink,
  type LinkProps as RouterLinkProps
} from 'react-router'
import styled from 'styled-components'

import { colors, typography } from './theme'

const styles = `
  color: ${colors.blue};
  font-weight: ${typography.weights.bold};
  text-decoration: none;

  &[data-active='true']:not([disabled]),
  &:active:not(:disabled) {
    color: ${colors.blueDark};
  }

  &[disabled] {
    color: ${colors.blueLight};
  }

  &:focus-visible:not([disabled]) {
    outline: 2px solid ${colors.midnightDark1};
  }
`

type BaseLinkProps = {
  /**
   * The button's disabled state
   */
  disabled?: boolean
  href?: string
  onClick?: React.MouseEventHandler
  rel?: string
  style?: CSSProperties
  target?: string
  to?: RouterLinkProps['to']
}

const StyledLink = styled.a<BaseLinkProps>`
  ${styles};
`

type StyledRouterLinkProps = BaseLinkProps & RouterLinkProps

const StyledRouterLink = styled(RouterLink)<StyledRouterLinkProps>`
  ${styles};
`

export type LinkProps = BaseLinkProps | StyledRouterLinkProps

export const Link: FC<LinkProps> = ({
  to,
  ...props
}: LinkProps): JSX.Element => {
  // All links should have either a href prop (for a regular anchor element) or a to prop (for a React Router Link)
  return to ? (
    <StyledRouterLink to={to} {...props} />
  ) : (
    <StyledLink {...props} />
  )
}
