import type { ReactNode } from 'react'

import { PageHeading } from '@/core'

import { displayName } from '../../lib/businessNames'
import type { BusinessRecord } from '../../lib/deriveResults'

/**
 * The report's head: who it is about, level with who
 * owns the review and where it stands. No lede under it: what the assessment
 * made of the business is the Assistant's, beside the report.
 */
export const ReportHero = ({
  record,
  controls
}: {
  record: BusinessRecord
  /** Who owns the review and where it stands: the assignee and the status. */
  controls?: ReactNode
}) => (
  <section aria-label="Report" className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
    <div className="flex min-w-0 flex-col">
      {/* The Workflows page's H1 treatment: the serif at its one weight. */}
      <PageHeading level={2} size="lg" weight="normal" className="font-arizona text-3xl font-light leading-10 tracking-[-0.02em]">
        {displayName(record.name)}
      </PageHeading>
    </div>
    {controls && <div className="flex shrink-0 items-center gap-2">{controls}</div>}
  </section>
)
