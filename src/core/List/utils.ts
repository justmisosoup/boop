import type { ReactNode } from 'react'

import { matchPath } from 'react-router'

import type { LinkProps } from '../Link'

export const isAnchorLink = (
  to: LinkProps['to'],
  anchor?: boolean
): to is string => {
  return (
    Boolean(to) &&
    typeof to === 'string' &&
    (anchor ||
      !matchPath(
        {
          path: '/*'
        },
        to
      ))
  )
}

export const isDateTime = (
  value: ReactNode,
  type?: string
): value is string => {
  return typeof value === 'string' && type === 'datetime'
}
