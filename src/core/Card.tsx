import type React from 'react'

import styled from 'styled-components'

import { Button, type ButtonProps } from './Button'
import { colors, typography } from './theme'

const Header = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
  padding: 0 40px;

  > h2 {
    color: ${colors.black};
    text-align: left;
  }

  @media (max-width: 1024px) {
    > h2 {
      font-family: ${typography.faces.default};
      font-size: ${typography.sizes.large};
      font-weight: ${typography.weights.bold};
      line-height: 48px;
    }
  }

  @media (min-width: 1024px) {
    > h2 {
      font-family: ${typography.faces.display};
      font-size: ${typography.sizes.display.large};
      font-weight: ${typography.weights.bold};
      line-height: 48px;
    }
  }
`

const styles = `
  border-width: 4px;
  border-style: solid;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  flex: 1 0 auto;
  height: fit-content;
  overflow: hidden;
  padding-bottom: 2.5rem;
`

const FillCard = styled.div`
  ${styles}
  background-color: ${colors.white};
  border-color: transparent;
`

const OutlineCard = styled.div`
  ${styles}
  background-color: transparent;
  border-color: ${colors.frost};
`

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode
  className?: string
  /**
   * Title for the card
   */
  title?: string

  /**
   * Style card with outline instead of solid background
   */
  outline?: boolean

  /**
   * Add button to card header by passing props
   */
  buttonProps?: ButtonProps
  // deprecate?
  onClick?: React.MouseEventHandler<HTMLDivElement>
}

export const Card = ({
  buttonProps,
  children,
  outline,
  title,
  ...props
}: CardProps) => {
  const Box = outline ? OutlineCard : FillCard

  return (
    <Box {...props}>
      {title ? (
        <Header>
          <h2>{title}</h2>
          {buttonProps ? <Button type='secondary' {...buttonProps} /> : ''}
        </Header>
      ) : (
        ''
      )}
      {children}
    </Box>
  )
}
