import React from 'react'

import { DEFAULT_ICON_PROP_VALUES } from './constants'
import type { FeatherIconProps } from './types'

const FlagIcon = ({ ...props }: FeatherIconProps) => {
  return (
    <svg
      width='16'
      height='16'
      viewBox='0 0 16 16'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
      {...props}
    >
      <path
        fillRule='evenodd'
        clipRule='evenodd'
        d='M3.57046 14.61C3.29431 14.61 3.07046 14.3861 3.07046 14.11L3.07047 7.90999L3.07046 2.38733C3.07046 1.71431 3.72187 1.23345 4.36502 1.4317L12.2247 3.85436C13.1653 4.14428 13.1653 5.4757 12.2247 5.76562L4.07047 8.27908L4.07046 14.11C4.07046 14.3861 3.8466 14.61 3.57046 14.61ZM4.07047 7.23265L11.9302 4.80999L4.07046 2.38733L4.07047 7.23265Z'
        fill='var(--core-color-text-primary)'
      />
    </svg>
  )
}
const Flag = (props: FeatherIconProps) => {
  return <FlagIcon {...DEFAULT_ICON_PROP_VALUES} {...props} />
}

export default Flag
