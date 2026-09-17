import React from 'react'

import { Download as FeatherDownload } from 'react-feather'

import { DEFAULT_ICON_PROP_VALUES } from './constants'
import type { FeatherIconProps } from './types'

const Download = (props: FeatherIconProps) => {
  return <FeatherDownload {...DEFAULT_ICON_PROP_VALUES} {...props} />
}

export default Download
