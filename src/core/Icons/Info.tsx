import React from 'react'

import { Info as FeatherInfoIcon } from 'react-feather'

import { DEFAULT_ICON_PROP_VALUES } from './constants'
import type { FeatherIconProps } from './types'

const Info = (props: FeatherIconProps) => {
  return <FeatherInfoIcon {...DEFAULT_ICON_PROP_VALUES} {...props} />
}

export default Info
