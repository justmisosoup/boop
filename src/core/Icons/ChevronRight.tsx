import React from 'react'

import { ChevronRight as FeatherChevronRight } from 'react-feather'

import { DEFAULT_ICON_PROP_VALUES } from './constants'
import type { FeatherIconProps } from './types'

const ChevronRight = (props: FeatherIconProps) => {
  return <FeatherChevronRight {...DEFAULT_ICON_PROP_VALUES} {...props} />
}

export default ChevronRight
