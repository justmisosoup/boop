import React from 'react'

import { DEFAULT_ICON_PROP_VALUES } from './constants'
import type { FeatherIconProps } from './types'

const CheckCircle = ({
  color = DEFAULT_ICON_PROP_VALUES.color,
  width = DEFAULT_ICON_PROP_VALUES.width,
  height = DEFAULT_ICON_PROP_VALUES.height,
  viewBox
}: FeatherIconProps) => {
  const stroke = color

  const strokeLinecap = 'round'
  const strokeLinejoin = 'round'
  const strokeWidth = '2px'

  return (
    <svg
      {...{
        width,
        height,
        viewBox
      }}
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path
        d='M9 16.5C13.1421 16.5 16.5 13.1421 16.5 9C16.5 4.85786 13.1421 1.5 9 1.5C4.85786 1.5 1.5 4.85786 1.5 9C1.5 13.1421 4.85786 16.5 9 16.5Z'
        {...{ stroke, strokeLinecap, strokeLinejoin, strokeWidth }}
      />
      <path
        d='M11.6663 7L7.99967 10.6667L6.33301 9'
        {...{ stroke, strokeLinecap, strokeLinejoin, strokeWidth }}
      />
    </svg>
  )
}

export default CheckCircle
