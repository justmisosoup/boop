import type React from 'react'

import styled from 'styled-components'

import { colors, spacing, typography } from '../theme'

type TabMetaProps = {
  active?: boolean
  children?: React.ReactNode
}

const StyledTabMeta = styled.span<TabMetaProps>`
  border-radius: 4px;
  font-size: ${typography.sizes.small};
  margin-left: ${spacing.xxsmall};
  padding: 0.125rem 0.75rem;

  ${({ active }) => {
    if (active) {
      return `
        background: ${colors.midnightDark2};
        color: ${colors.white};
        margin-left: ${spacing.xxsmall};
      `
    }

    return `
      background: ${colors.dawn};
      color: ${colors.graphite};
    `
  }}
`

const TabMeta = ({ active, children }: TabMetaProps) => {
  return <StyledTabMeta active={active}>{children}</StyledTabMeta>
}

export default TabMeta
