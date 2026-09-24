/**
 * Verbatim from the dashboard: `app/src/components/StatusPill/index.tsx`.
 *
 * styled-components over `theme.colors`, as the app has it. Kept as is rather
 * than re-expressed in tokens because it is rendered inside `Modal`, whose
 * portal sits outside the `.core-theme` scope where the `--core-*` tokens are
 * defined — a `Tag` there drew with no colour at all.
 */
import React from 'react'

import { theme } from '@/core'
import styled from 'styled-components'

const { colors, typography } = theme

type StatusPillProps = {
  className?: string
  children?: React.ReactNode
  text?: string
  type?: string
  small?: boolean
  xsmall?: boolean
  disabled?: boolean
}

const StatusPill = styled(({ className, children, text }: StatusPillProps) => {
  return <div className={className}>{text || children}</div>
})`
  border: 1px solid;
  border-radius: 34px;
  cursor: default;
  font-size: ${typography.sizes.medium};
  font-weight: 400;
  opacity: ${({ disabled }) => (disabled ? '0.5' : '1.0')};
  padding: ${({ small }) => (small ? '8px 16px' : '8px 32px;')};
  white-space: nowrap;
  width: max-content;

  ${({ xsmall }) => {
    if (xsmall)
      return `
    border: none;
    border-radius: 24px;
    cursor: default;
    font-size: 12px;
    font-weight: 600;
    padding: 4px 20px; `
  }}

  ${({ type }) => {
    switch (type) {
      case 'pending':
        return `
          background-color: ${colors.frost};
          color: ${colors.karl};
        `
      case 'approved':
        return `
          background-color: ${colors.greenLight};
          border-color: ${colors.green};
          color: ${colors.green};
        `
      case 'rejected':
        return `
          background-color: ${colors.redLight};
          border-color: ${colors.red};
          color: ${colors.red};
        `
      case 'in_review':
        return `
            background-color: ${colors.white};
            border-color: ${colors.frost};
            color: ${colors.graphite};
          `
      default:
        return
    }
  }}
`

export default StatusPill
