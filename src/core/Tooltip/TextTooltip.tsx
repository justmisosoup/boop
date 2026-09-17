import type React from 'react'

import styled from 'styled-components'

import { colors } from '../theme'

import { Tooltip, type TooltipProps } from './Tooltip'

const Trigger = styled(Tooltip.Trigger)`
  cursor: default;
  text-align: inherit;
  text-decoration: underline dashed 1px currentcolor;
  text-underline-offset: 0.25em;

  &:hover,
  &:focus {
    background: ${colors.dawn};
  }
`

type ContentProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Whether to render an arrow element alongside the overlay. */
  arrow?: boolean
  /** Position of the overlay relative to the trigger. */
  placement?: 'left' | 'right' | 'top' | 'bottom'
  /** Max width of the overlay. */
  maxWidth?: number
  theme?: 'light' | 'dark'
}

export type TextTooltipProps = TooltipProps &
  ContentProps & {
    /** Content of the tooltip overlay. */
    content?: React.ReactNode
    /** Whether to disable interactivity.  */
    disabled?: boolean
    /** Content of the tooltip control. */
    trigger?: React.ReactNode
  }

export const TextTooltip = ({
  arrow = false,
  children,
  trigger,
  ...rest
}: TextTooltipProps) => {
  return (
    <Tooltip arrow={arrow} {...rest}>
      {trigger && <Trigger type='button'>{trigger}</Trigger>}
      {children}
    </Tooltip>
  )
}

TextTooltip.Content = Tooltip.Content
TextTooltip.Trigger = Trigger
