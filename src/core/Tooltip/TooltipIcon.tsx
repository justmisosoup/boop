import React from 'react'

import { InfoCircledIcon } from '@radix-ui/react-icons'

import { colors } from '../theme'

import { Tooltip } from './Tooltip'

export const TooltipIcon = ({
  content,
  text,
  url
}: {
  content?: string
  text?: string
  url?: string
}) => {
  const icon = (
    <InfoCircledIcon height='18px' width='18px' color={colors.graphite} />
  )

  const trigger = url ? (
    <a aria-label={content || text} href={url} rel='noreferrer' target='_blank'>
      {icon}
    </a>
  ) : (
    icon
  )

  return (
    <Tooltip
      content={content || text}
      trigger={trigger}
      triggerAsChild={Boolean(url)}
    />
  )
}
