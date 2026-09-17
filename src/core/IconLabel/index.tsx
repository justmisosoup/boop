import type React from 'react'
import type { ReactNode } from 'react'

import styled from 'styled-components'

import { Icon, type IconProps } from '../Icon'
import { typography } from '../theme'

type LabelProps = {
  /** Custom content associated with the Icon. */
  children?: React.ReactNode
  /** Color of the label and icon. */
  color?: string
  /** Text or element associated with the Icon. */
  label?: ReactNode
  /** Location of the label relative to the Icon. */
  labelPosition?: 'left' | 'right'
  /** Size of the label and icon - prefer rems for scalability. */
  size?: number | string
}

export type IconLabelProps = LabelProps & Pick<IconProps, 'name'>

const StyledIconLabel = styled.div<LabelProps>`
  align-items: center;
  color: ${({ color }) => color};
  display: inline-flex;
  flex-direction: ${({ labelPosition }) =>
    labelPosition === 'right' ? 'row' : 'row-reverse'};
  font-family: ${typography.faces.default};
  font-size: ${({ size }) => size};
  gap: 0.25em;
`

export const IconLabel: React.FC<IconLabelProps> = ({
  children,
  color = 'currentColor',
  label,
  labelPosition = 'right',
  name,
  size = '1rem',
  ...rest
}) => {
  const fontSize = typeof size === 'number' ? `${size}px` : size

  return (
    <StyledIconLabel
      color={color}
      labelPosition={labelPosition}
      size={fontSize}
      {...rest}
    >
      <Icon color={color} name={name} size={fontSize} />
      {label || children}
    </StyledIconLabel>
  )
}
