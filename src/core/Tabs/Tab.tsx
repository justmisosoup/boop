import type React from 'react'
import { forwardRef } from 'react'

import styled from 'styled-components'

import { colors, typography } from '../theme'

import TabMeta from './TabMeta'

const StyledTab = styled.button<{ active?: boolean }>`
  appearance: none;
  background: transparent;
  border: none;
  color: ${colors.graphite};
  cursor: pointer;
  font-size: ${typography.sizes.medium};
  font-weight: ${({ active }) =>
    active ? typography.weights.bold : typography.weights.normal};
  padding: 2px 0;

  &::after {
    content: attr(data-title);
    display: flex;
    font-weight: ${typography.weights.bold};
    height: 0;
    overflow-y: hidden;
    visibility: hidden;
  }

  &:focus-visible {
    outline: 2px solid ${colors.midnightDark1};
  }
`

export type TabProps = React.HTMLAttributes<HTMLButtonElement> & {
  /** Whether the tab is selected. */
  active?: boolean
  /** Contents of the tab control. */
  children: React.ReactNode
  /** Type of the tab component. */
  type?: 'button' | 'submit' | 'reset' | undefined
  /** Metadata associated with the tab. */
  meta?: React.ReactNode
}

export const Tab = forwardRef<HTMLButtonElement, TabProps>(
  ({ children, meta, type = 'button', ...props }, ref) => {
    const hasMeta = meta || meta === 0

    return (
      <StyledTab {...props} ref={ref} data-title={children} type={type}>
        {children}
        {hasMeta && <TabMeta>{meta}</TabMeta>}
      </StyledTab>
    )
  }
)

Tab.displayName = 'Tab'
