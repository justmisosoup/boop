import React from 'react'

import { AlertCircle as FeatherAlertCircleIcon } from 'react-feather'

import { colors } from '../theme'

import { DEFAULT_ICON_PROP_VALUES } from './constants'
import type { FeatherIconProps } from './types'

const Error = (props: FeatherIconProps) => {
  return (
    <FeatherAlertCircleIcon
      {...DEFAULT_ICON_PROP_VALUES}
      color={colors.red}
      {...props}
    />
  )
}

export default Error
