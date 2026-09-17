import React from 'react'

import { ArrowUpRight as FeatherArrowUpRight } from 'react-feather'

import { DEFAULT_ICON_PROP_VALUES } from './constants'
import type { FeatherIconProps } from './types'

const ArrowUpRight = (props: FeatherIconProps) => {
  return <FeatherArrowUpRight {...DEFAULT_ICON_PROP_VALUES} {...props} />
}

export default ArrowUpRight
