import type { ReactNode } from 'react'

import { Heading, MutedText } from '@/core'

import type { BusinessRecord, Derived } from '../../lib/deriveResults'
import type { ReportBrief } from '../../lib/reportBrief'
import { formatTime, reportDate } from '../../lib/reportLabels'
import type { RevisedRecommendation } from '../../types'
import { Para } from '../ReportBody'

/**
 * The report's head: who it is about and when it was written, level with who
 * owns the review and where it stands; then the report's lede and why the
 * call is what it is, as one paragraph.
 *
 * A document added in the Assistant's chat box can change the call: the
 * answer's `revisedRecommendation` reloads the reason, with a caption naming
 * the file.
 *
 * The cards under the hero are the data; the Assistant carries each
 * assessment.
 */
export const ReportHero = ({
  record,
  report,
  brief,
  revision,
  results,
  controls
}: {
  record: BusinessRecord
  /** The report on screen: when it was written. */
  report: { id: string; name: string; at: string }
  brief: ReportBrief
  /** What the newest document did to the recommendation, and when. */
  revision?: RevisedRecommendation & { at: string }
  results: Derived[]
  /** Who owns the review and where it stands: the assignee and the status. */
  controls?: ReactNode
}) => {
  /* One paragraph: what to do, then why. A document's reason replaces the
     score's. */
  const overview = revision ? [brief.lede, revision.reason].filter(Boolean).join(' ') : brief.overview

  return (
    <section aria-label="Report" className="flex flex-col gap-4">
      {/* Who it is about and when, level with who owns the review and where it stands. */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Heading level={2} className="text-3xl font-semibold leading-tight tracking-[-0.01em]">
            {record.name}
          </Heading>
          <MutedText className="text-caption">Report generated on {reportDate(report)}</MutedText>
        </div>
        {controls && <div className="flex shrink-0 items-center gap-2">{controls}</div>}
      </div>

      {/* What to do and why. */}
      <div className="flex min-w-0 flex-col gap-1">
        {overview && (
          <Para inline className="text-sm leading-5 text-foreground" results={results} record={record}>
            {overview}
          </Para>
        )}
        {/* Why the call moved, where a document moved it. */}
        {revision && (
          <span className="text-caption text-[var(--core-color-text-muted)]">
            Updated from {revision.source} · {formatTime(revision.at)}
          </span>
        )}
      </div>
    </section>
  )
}
