import type React from 'react'

import styled from 'styled-components'

import { colors, spacing } from '../theme'

const StyledRadioWrapper = styled.div<{ disabled: boolean; bold?: boolean }>`
  display: flex;
  pointer-events: ${({ disabled }) => (disabled ? 'none' : 'default')};
  width: 100%;

  > div {
    border-radius: 4px;
    display: flex;

    :has(:focus-visible) {
      outline: 2px solid ${colors.midnightDark1};
      outline-offset: 4px;
      width: 100%;
    }
  }

  input[type='radio'] {
    appearance: none;
    border: 1px solid ${colors.karlLight1};
    border-radius: 50%;
    cursor: ${({ disabled }) => (disabled ? 'default' : 'pointer')};
    flex-shrink: 0;
    height: 16px;
    margin-right: 0;
    margin-top: 0;
    outline: none;
    position: relative;
    width: 16px;

    &:disabled {
      background-color: ${colors.dawn};
    }

    &:hover,
    &:focus {
      border-color: ${colors.karlLight1};
    }

    &:checked {
      background-color: ${colors.white};
      border-color: ${({ disabled }) =>
        disabled ? colors.midnightLight1 : colors.midnight};
      border-width: 2px;
    }

    &:active {
      background-color: ${colors.dawn};
    }
  }

  input[type='radio']:checked::before {
    background-color: ${({ disabled }) =>
      disabled ? colors.midnightLight1 : colors.midnight};
    border-radius: 50%;
    content: '';
    height: 8px;
    left: 50%;
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 8px;
  }

  label {
    color: ${({ disabled }) =>
      disabled ? colors.karlLight2 : colors.graphite};
    cursor: ${({ disabled }) => (disabled ? 'default' : 'pointer')};
    font-size: 14px;
    font-weight: ${({ bold }) => (bold ? 'bold' : 'normal')};
    line-height: 1.15;
    margin-left: ${spacing.xsmall};
  }
`

type RadioFieldProps = {
  checked?: boolean
  disabled?: boolean
  label?: React.ReactNode
  name: string
  value: string
  bold?: boolean
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  onClick?: (e: React.MouseEvent<HTMLInputElement>) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [x: string]: any
}

export type RadioControlProps = Omit<RadioFieldProps, 'onClick'> & {
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void
}

/**
 * Presentational radio (no form-library coupling). The `FormRadioField` React
 * Hook Form adapter renders through this; product code can also use it directly
 * for standalone (non-form) radios.
 */
export const RadioControl = ({
  checked = false,
  disabled = false,
  label,
  name,
  value,
  bold,
  onChange,
  ...rest
}: RadioControlProps) => {
  const id = `${name}-${value}`

  return (
    <StyledRadioWrapper disabled={disabled} bold={bold}>
      <div>
        <input
          type='radio'
          value={value}
          name={name}
          disabled={disabled}
          checked={checked}
          onChange={onChange}
          id={id}
          {...rest}
        />
        <label htmlFor={id}>{label}</label>
      </div>
    </StyledRadioWrapper>
  )
}
