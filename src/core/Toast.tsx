import React from 'react'

import { Toaster as SonnerToaster, toast as sonnerToast } from 'sonner'
import styled from 'styled-components'

import { colors, spacing } from './theme'

export type ToastProps = {
  text: string
  appearance?: AppearanceTypes
  hasIcon?: boolean
  className?: string
}

export type AppearanceTypes = 'success' | 'warning' | 'error'

const appearanceToStyles: {
  [key in AppearanceTypes]: {
    background: string
    borderColor: string
    color: string
  }
} = {
  success: {
    background: colors.greenLight,
    borderColor: colors.green,
    color: colors.green
  },
  warning: {
    background: colors.yellowLight,
    borderColor: colors.yellow,
    color: colors.black
  },
  error: {
    background: colors.redLight,
    borderColor: colors.red,
    color: colors.red
  }
}

const StyledToaster = styled(SonnerToaster)`
  [data-sonner-toast] {
    align-items: center;
    border: 1px solid;
    border-radius: ${spacing.xsmall};
    display: flex;
    font-size: 0.875rem;
    line-height: 1;
    min-width: 120px;
    padding: 8px 16px;
  }

  [data-sonner-toast] [data-icon] {
    flex-shrink: 0;
    height: 20px;
    width: 20px;
  }

  [data-sonner-toast] [data-content] {
    align-items: center;
    display: flex;
  }

  [data-sonner-toast] [data-title] {
    line-height: 1;
  }

  [data-sonner-toast][data-type='success'] {
    background-color: ${appearanceToStyles.success.background};
    border-color: ${appearanceToStyles.success.borderColor};
    color: ${appearanceToStyles.success.color};
  }

  [data-sonner-toast][data-type='warning'] {
    background-color: ${appearanceToStyles.warning.background};
    border-color: ${appearanceToStyles.warning.borderColor};
    color: ${appearanceToStyles.warning.color};
  }

  [data-sonner-toast][data-type='error'] {
    background-color: ${appearanceToStyles.error.background};
    border-color: ${appearanceToStyles.error.borderColor};
    color: ${appearanceToStyles.error.color};
  }
`

export const Toaster = () => (
  <StyledToaster position='bottom-center' visibleToasts={5} />
)

const showToast = ({
  text,
  appearance = 'success',
  hasIcon,
  className
}: ToastProps) => {
  const options = {
    className,
    icon: hasIcon ? undefined : null
  }

  if (appearance === 'success') {
    return sonnerToast.success(text, options)
  }
  if (appearance === 'warning') {
    return sonnerToast.warning(text, options)
  }
  if (appearance === 'error') {
    return sonnerToast.error(text, options)
  }
  return sonnerToast(text, options)
}

export const useToast = () => ({ showToast })
