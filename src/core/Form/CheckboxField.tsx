import type React from 'react'
import type { ReactNode } from 'react'

import { CheckIcon } from '@radix-ui/react-icons'
import styled from 'styled-components'

import { Attribute } from '../Attribute'
import { colors, spacing } from '../theme'
import { TooltipIcon } from '../Tooltip/TooltipIcon'

const StyledCheck = styled(CheckIcon)`
  position: absolute;
`

const StyledCheckboxField = styled(Attribute)<{
  bold?: boolean
  disabled?: boolean
}>`
  margin-top: ${spacing.xxsmall};
  position: relative;
  width: 100%;

  label {
    align-items: center;
    display: flex;
  }

  span ~ div {
    color: ${({ disabled }) =>
      disabled ? colors.karlLight2 : colors.graphite};
    font-weight: ${({ bold }) => (bold ? 'bold' : 'normal')};
    padding-left: ${spacing.xlarge};

    div {
      cursor: ${({ disabled }) => (disabled ? 'default' : 'pointer')};
      pointer-events: ${({ disabled }) => (disabled ? 'none' : 'default')};
    }
  }

  & input {
    cursor: ${({ disabled }) => (disabled ? 'default' : 'pointer')};
    height: 0;
    opacity: 0;
    position: absolute;
    width: 0;
  }

  span {
    background-color: ${({ disabled }) => (disabled ? colors.dawn : '')};
    border: 1px solid ${colors.karlLight1};
    border-radius: 2px;
    cursor: ${({ disabled }) => (disabled ? 'default' : 'pointer')};
    height: 16px;
    left: 4px;
    position: absolute;
    top: 0;
    width: 16px;

    &:active {
      background-color: ${colors.dawn};
      border: 1px solid ${colors.karlLight1};
    }

    &:hover,
    &:focus span {
      border: 1px solid ${colors.karlLight1};
    }
  }

  & input:focus ~ span {
    border: 1px solid ${colors.karlLight1};
  }

  & input:checked ~ span {
    background-color: ${colors.midnight};
    border: 1px solid ${colors.midnight};
  }

  & input:disabled ~ span {
    background-color: ${colors.dawn};
    border: 1px solid ${colors.frost};
  }

  & input:disabled:checked ~ span {
    background-color: ${colors.midnightLight1};
    border: 1px solid ${colors.midnightLight1};
  }
`

const StyledFocus = styled.div`
  border-radius: 4px;
  display: inline-block;
  padding: 0 4px;

  :has(:focus-visible) {
    outline: 2px solid ${colors.midnightDark1};
    outline-offset: 4px;
  }
`

export type CheckboxFieldProps = React.HTMLAttributes<HTMLInputElement> & {
  /**
   * Whether the label font weight is heavy
   */
  bold?: boolean
  /**
   * Space-separated list of classes passed to the component
   */
  className?: string
  /**
   * Whether to prevent interactivity
   */
  disabled?: boolean
  /**
   * Unique identifier for the input
   */
  id?: string
  /**
   * Description associated with the checkbox input
   */
  label?: ReactNode
  /**
   * Name passed to the underlying input element
   */
  name: string
  /**
   * Object containing tooltip information
   */
  tooltip?: { content?: string; text?: string; url?: string }
  /**
   * Aria label for the checkbox, recommended when label is ReactNode
   */
  ariaLabel?: string
  /**
   * Optional prop to manually pass in checked value
   */
  checked?: boolean
}

const StartDiv = styled.div`
  display: flex;
  gap: ${spacing.xsmall};
  justify-content: start;
  line-height: 1.15;
`

export type CheckboxControlProps = Omit<CheckboxFieldProps, 'checked'> & {
  checked: boolean
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void
}

/**
 * Presentational checkbox (no form-library coupling). The `FormCheckboxField`
 * React Hook Form adapter renders through this; product code can also use it
 * directly for standalone (non-form) checkboxes.
 */
export const CheckboxControl = ({
  bold,
  className,
  disabled,
  name,
  id = name,
  label,
  tooltip,
  ariaLabel,
  checked,
  onChange,
  ...rest
}: CheckboxControlProps) => (
  <StyledCheckboxField bold={bold} className={className} disabled={disabled}>
    <StyledFocus>
      <label htmlFor={id}>
        <input
          type='checkbox'
          id={id}
          name={name}
          onChange={onChange}
          checked={checked}
          disabled={disabled}
          {...rest}
        />
        <span aria-checked={checked} aria-label={ariaLabel} role='checkbox'>
          {checked && <StyledCheck height={14} width={14} color='white' />}
        </span>
        <StartDiv>
          {label} {tooltip && <TooltipIcon {...tooltip} />}
        </StartDiv>
      </label>
    </StyledFocus>
  </StyledCheckboxField>
)
