import React from 'react'

import { colors } from '../theme'

import CheckCircle from './CheckCircle'
import { DEFAULT_ICON_PROP_VALUES } from './constants'
import type { FeatherIconProps } from './types'

const Success = (props: FeatherIconProps) => {
  return (
    <CheckCircle
      {...DEFAULT_ICON_PROP_VALUES}
      {...props}
      color={colors.green}
    />
  )
}

export default Success
