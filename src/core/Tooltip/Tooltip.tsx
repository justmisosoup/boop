import type React from 'react'

import * as RadixTooltip from '@radix-ui/react-tooltip'
import cx from 'classnames'
import styled from 'styled-components'

import { colors, spacing, typography } from '../theme'

const Trigger = styled(RadixTooltip.Trigger)`
  background: inherit;
  border: none;
  color: inherit;
  cursor: default;
  font-family: inherit;
  font-size: inherit;
  letter-spacing: inherit;
  max-width: 100%;
  padding: 0;
  text-transform: inherit;

  &:focus-visible {
    outline: 2px solid ${colors.midnightDark1};
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

const Content = styled(
  ({
    arrow,
    className,
    children,
    placement,
    theme: tooltipTheme = 'light',
    ...rest
  }: ContentProps) => {
    return (
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          avoidCollisions
          className={cx(tooltipTheme, className)}
          collisionPadding={10}
          sideOffset={10}
          side={placement}
          {...rest}
        >
          {children}
          {arrow && (
            <RadixTooltip.Arrow
              fill={tooltipTheme === 'light' ? colors.white : colors.graphite}
            />
          )}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    )
  }
)`
  border-radius: 4px;
  box-shadow: 0 5px 20px rgb(0 0 0 / 15%);
  font-family: ${typography.faces.default};
  font-size: ${typography.sizes.medium};
  max-width: ${({ maxWidth = 300 }) => `${maxWidth}px`};
  padding: ${spacing.medium};
  /* Tooltips are topmost transient content — the popover layer of the
     --core-z ladder (above the floating dock at 1050, matching the Radix
     tooltip family). The old 1001 hid report tooltips behind the dock. */
  z-index: var(--core-z-popover, 1200);

  &.light {
    background: ${colors.white};
    color: ${colors.graphite};
  }

  &.dark {
    background: ${colors.graphite};
    color: ${colors.white};
  }
`

export type TooltipProps = RadixTooltip.TooltipProps &
  ContentProps & {
    /** Content of the tooltip overlay. */
    content?: React.ReactNode
    /** Content of the tooltip control. */
    trigger?: React.ReactNode
    /** Whether the trigger child should provide the underlying DOM element. */
    triggerAsChild?: boolean
  }

export const Tooltip = ({
  arrow = true,
  children,
  content,
  delayDuration = 300,
  maxWidth = 300,
  placement = 'top',
  theme: tooltipTheme,
  trigger,
  triggerAsChild = false,
  ...rest
}: TooltipProps) => {
  return (
    <RadixTooltip.Provider>
      <RadixTooltip.Root delayDuration={delayDuration} {...rest}>
        {trigger && (
          <Trigger
            asChild={triggerAsChild}
            type={triggerAsChild ? undefined : 'button'}
          >
            {trigger}
          </Trigger>
        )}
        {content && (
          <Content
            arrow={arrow}
            maxWidth={maxWidth}
            placement={placement}
            theme={tooltipTheme}
          >
            {content}
          </Content>
        )}
        {children}
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  )
}

Tooltip.Content = Content
Tooltip.Trigger = Trigger
