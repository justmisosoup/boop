import React from 'react'

import { ArrowLeft as FeatherArrowLeft } from 'react-feather'

import { DEFAULT_ICON_PROP_VALUES } from './constants'
import type { FeatherIconProps } from './types'

const ArrowLeft = (props: FeatherIconProps) => {
  return <FeatherArrowLeft {...DEFAULT_ICON_PROP_VALUES} {...props} />
}

export default ArrowLeft
