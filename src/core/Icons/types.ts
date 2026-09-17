import type { IconProps as ReactFeatherIconProps } from 'react-feather'

export type FeatherIconProps = ReactFeatherIconProps & {
  className?: string
  color?: string
  width?: number
  height?: number
  viewBox?: string
}
