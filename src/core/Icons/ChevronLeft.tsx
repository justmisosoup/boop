import React from 'react'

import { ChevronLeft as FeatherChevronLeft } from 'react-feather'
import styled from 'styled-components'

import { DEFAULT_ICON_PROP_VALUES } from './constants'
import type { FeatherIconProps } from './types'

const StyledFeatherChevronLeft = styled(FeatherChevronLeft)``

const ChevronLeft = (props: FeatherIconProps) => {
  return <StyledFeatherChevronLeft {...DEFAULT_ICON_PROP_VALUES} {...props} />
}

export default ChevronLeft
