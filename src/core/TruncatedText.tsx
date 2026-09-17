import React from 'react'

import { cn } from '@/utils/twUtils'

import { Tooltip } from './Tooltip'
import { useIsOverflowing } from './internal/useIsOverflowing'

export type TruncatedTextProps = Omit<
  React.HTMLAttributes<HTMLSpanElement>,
  'children'
> & {
  /** The text to render; revealed in a tooltip when it overflows. */
  children: string
  /** Tooltip placement relative to the text. */
  placement?: 'top' | 'bottom' | 'left' | 'right'
  /** Max width of the tooltip overlay, in px. */
  tooltipMaxWidth?: number
}

/**
 * Single-line text that clips with an ellipsis and reveals its full value in a
 * tooltip — but only when it is *actually* truncated. The decision is driven by
 * the rendered width (`scrollWidth > clientWidth`), not a character count, so it
 * stays correct at any container/column size.
 */
export const TruncatedText = ({
  children,
  className,
  placement = 'top',
  tooltipMaxWidth,
  ...rest
}: TruncatedTextProps) => {
  const ref = React.useRef<HTMLSpanElement>(null)
  const isOverflowing = useIsOverflowing(ref, [children])

  const text = (
    <span
      ref={ref}
      className={cn('block max-w-full truncate', className)}
      {...rest}
    >
      {children}
    </span>
  )

  if (!isOverflowing) return text

  return (
    <Tooltip
      trigger={text}
      content={children}
      placement={placement}
      maxWidth={tooltipMaxWidth}
    />
  )
}
