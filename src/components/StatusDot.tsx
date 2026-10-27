import { Circle, CircleCheck, CircleX, type LucideIcon } from 'lucide-react'

import { cn } from '../utils/twUtils'

/** The dashboard's status glyph (`components/StatusDot` in the app), in the
 *  `--core-*` status tokens rather than its raw Tailwind palette. */
export type StatusDotProps = {
  className?: string
  intent?: 'success' | 'warning' | 'failure' | 'unknown' | 'pending'
  size?: number
}

const ICON: Record<NonNullable<StatusDotProps['intent']>, LucideIcon> = {
  success: CircleCheck,
  // One mark against: a warning draws as the failure's X.
  warning: CircleX,
  failure: CircleX,
  unknown: Circle,
  pending: Circle
}

const TONE: Record<NonNullable<StatusDotProps['intent']>, string> = {
  success: 'text-[var(--mark-pass)]',
  warning: 'text-[var(--core-color-status-danger-fg)]',
  failure: 'text-[var(--core-color-status-danger-fg)]',
  unknown: 'text-text-secondary',
  pending: 'text-text-secondary'
}

export const StatusDot = ({ intent = 'unknown', size = 16, className }: StatusDotProps) => {
  const Icon = ICON[intent]
  return (
    <span className={cn('inline-block flex-none align-middle leading-none', TONE[intent], className)}>
      <Icon aria-hidden="true" size={size} strokeWidth={2.5} />
    </span>
  )
}
