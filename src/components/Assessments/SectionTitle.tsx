import type { ReactNode } from 'react'

import { Heading } from '@/core'

import { cn } from '@/utils/twUtils'

/**
 * A section's name on the business overview, over its card rather than inside
 * it — Assessments, Alerts, Recent activity — in the report cards' serif.
 */
export const SectionTitle = ({ children, className }: { children: ReactNode; className?: string }) => (
  <Heading level={2} className={cn('m-0 font-arizona text-xl font-light', className)}>
    {children}
  </Heading>
)
