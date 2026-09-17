import { css } from 'styled-components'

import { colors, spacing, typography } from '../theme'

// Shared text-input styling. Consumed by the RHF `FormTextField` adapter and by
// product code that renders its own inputs with the standard Middesk look.
export const textFieldStyle = css<{ hasError?: boolean }>`
  appearance: none;
  background-color: ${colors.white};
  border: ${({ hasError }) =>
    hasError ? `1px solid ${colors.red}` : `1px solid ${colors.frost}`};
  border-radius: 4px;
  color: ${colors.graphite};
  display: flex;
  font-family: ${typography.faces.default};
  font-size: ${typography.sizes.medium};
  font-weight: ${typography.weights.normal};
  margin-top: ${spacing.xxsmall};
  outline: none;
  padding: ${spacing.xsmall};
  width: 100%;

  &:active {
    border-color: ${colors.midnight};
  }

  &:disabled {
    background: ${colors.dawn};
    color: ${colors.karlLight1};
  }

  &:focus {
    outline: 2px solid ${colors.blueLight};
  }

  &:focus,
  &:hover:not(:disabled) {
    border-color: ${colors.karlLight2};
  }

  &::placeholder {
    color: ${colors.karl};
  }
`
