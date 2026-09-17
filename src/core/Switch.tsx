import type React from 'react'
import type { FC } from 'react'

import { lighten } from 'polished'
import styled from 'styled-components'

import { colors } from './theme'

const Box = styled.label`
  border-radius: 9999px;
  outline: 0;
  position: relative;
  width: 52px;
`

const Input = styled.input<{ color: string }>`
  border: 0;
  clip-path: inset(50%);
  height: 1px;
  opacity: 0;
  overflow: hidden;
  padding: 0;
  position: absolute;
  white-space: nowrap;
  width: 1px;

  &:not(:checked, :disabled) + div > div {
    background-color: ${colors.karlLight2};
  }

  &:disabled:not(:checked) + div > div {
    background-color: ${colors.karlLight2};
  }

  &:disabled:checked + div > div {
    background-color: ${({ color }) => lighten(0.2, color)};
  }

  /* stylelint-disable no-descending-specificity */
  &:checked + div > div {
    background-color: ${({ color }) => color};

    > div {
      transform: translateX(50%);
    }

    span:first-of-type {
      opacity: 1;
    }
  }

  &:not(:checked) + div > div {
    span:last-of-type {
      opacity: 1;
    }
  }

  &:not(:disabled) {
    &:active,
    &:focus,
    &:hover {
      & + div {
        border-color: ${colors.blueLight};
      }
    }
  }
  /* stylelint-enable no-descending-specificity */
`

const Slot = styled.div<{ disabled?: boolean }>`
  border: 2px solid transparent;
  border-radius: 9999px;
  color: white;
  cursor: ${({ disabled }) => (disabled ? 'default' : 'pointer')};
  display: flex;
  height: 28px;
  outline: 0;
  padding: 2px;
  transition: border-color 250ms ease;
`

const InnerSlot = styled.div`
  background-color: transparent;
  border-radius: 9999px;
  flex: 1;
`

const Label = styled.span`
  display: inline-block;
  font-size: 10px;
  font-weight: 600;
  line-height: 28px;
  opacity: 0;
  position: absolute;
  top: 0;
  transition: opacity 250ms ease;
  user-select: none;

  &:first-child {
    left: 10px;
  }

  &:last-child {
    right: 10px;
  }
`

const Slide = styled.div`
  flex: 1;
  padding: 4px;
  transition: transform 250ms ease;
`

const Handle = styled.div`
  background-color: ${colors.white};
  border-radius: 9999px;
  height: 12px;
  width: 12px;
`

export type SwitchProps = {
  color?: string
  disabled?: boolean
  onChange?: React.ChangeEventHandler
  value?: boolean
  showLabel?: boolean
}

export const Switch: FC<SwitchProps> = ({
  color = colors.midnight,
  disabled,
  value: checked = false,
  showLabel = true,
  ...props
}: SwitchProps) => {
  return (
    <Box tabIndex={0}>
      <Input
        checked={checked}
        color={color}
        type='checkbox'
        value={String(checked)}
        disabled={disabled}
        {...props}
      />
      <Slot disabled={disabled}>
        <InnerSlot>
          {showLabel && <Label> ON </Label>}
          <Slide>
            <Handle />
          </Slide>
          {showLabel && <Label>OFF</Label>}
        </InnerSlot>
      </Slot>
    </Box>
  )
}
