import React from 'react'

import { AlertTriangle as FeatherAlertTriangleIcon } from 'react-feather'

import { DEFAULT_ICON_PROP_VALUES } from './constants'
import type { FeatherIconProps } from './types'

const Warning = (props: FeatherIconProps) => {
  return <FeatherAlertTriangleIcon {...DEFAULT_ICON_PROP_VALUES} {...props} />
}

export default Warning
