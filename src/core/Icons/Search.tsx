import React from 'react'

import { Search as FeatherSearch } from 'react-feather'

import { DEFAULT_ICON_PROP_VALUES } from './constants'
import type { FeatherIconProps } from './types'

const Search = (props: FeatherIconProps) => {
  return <FeatherSearch {...DEFAULT_ICON_PROP_VALUES} {...props} />
}

export default Search
