import type { ReactNode } from 'react'

import { Heading, MutedText } from '@/core'

import type { BusinessRecord } from '../../lib/deriveResults'
import { reportDate } from '../../lib/reportLabels'

/**
 * The report's head: who it is about and when it was written, level with who
 * owns the review and where it stands. No lede under it: what the assessment
 * made of the business is the Assistant's, beside the report.
 */
export const ReportHero = ({
  record,
  report,
  controls
}: {
  record: BusinessRecord
  /** The report on screen: when it was written. */
  report: { id: string; name: string; at: string }
  /** Who owns the review and where it stands: the assignee and the status. */
  controls?: ReactNode
}) => (
  <section aria-label="Report" className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
    <div className="flex min-w-0 flex-col gap-1">
      <Heading level={2} className="text-3xl font-semibold leading-tight tracking-[-0.01em]">
        {record.name}
      </Heading>
      <MutedText className="text-caption">Report generated on {reportDate(report)}</MutedText>
    </div>
    {controls && <div className="flex shrink-0 items-center gap-2">{controls}</div>}
  </section>
)
