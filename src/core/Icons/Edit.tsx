import React from 'react'

import { Edit2 as FeatherEditIcon } from 'react-feather'

import { DEFAULT_ICON_PROP_VALUES } from './constants'
import type { FeatherIconProps } from './types'

const Edit = (props: FeatherIconProps) => {
  return <FeatherEditIcon {...DEFAULT_ICON_PROP_VALUES} {...props} />
}

export default Edit
