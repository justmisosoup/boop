import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router'

import { FULL_REPORT, readAssessments } from '../../lib/assessments'
import type { BusinessRecord } from '../../lib/deriveResults'
import { statusForBand } from '../../lib/review'
import { IdentityHeader } from './IdentityHeader'

/** The business's own pages, under its profile. */
export const businessHref = (businessId: string, section?: 'timeline' | 'activity') =>
  section ? `/businesses/${businessId}/${section}` : `/businesses/${businessId}`

/**
 * A business page: the profile band, pinned, and the page under its rule — the
 * overview's assessments, or the business's Timeline or Activity in full.
 *
 * The report's own geometry, so moving between the business, one of its
 * assessments and its timeline never moves the page: the same top offset, the
 * same centred measure (`MEASURE` in RecordPage), room for the rail the report
 * keeps at its right, and the same band.
 */
export const BusinessFrame = ({
  record,
  crumb,
  children
}: {
  record: BusinessRecord
  /** The page under the business — "Timeline", "Activity" — in the crumb. */
  crumb?: string
  children: ReactNode
}) => {
  const navigate = useNavigate()
  const reads = useMemo(() => readAssessments(record), [record])
  // The reviewer's call for the business. A single "Full Business KYB" defaults
  // to its report's call, as the page always has; several have no roll-up.
  const defaultStatus =
    reads.length === 1 && reads[0].assessment.id === FULL_REPORT ? statusForBand(reads[0].score?.band.id) : 'in_review'
  const here = typeof window === 'undefined' ? businessHref(record.id) : window.location.pathname

  return (
    <div className="pb-12 pt-[54px] wide:pr-[49px]">
      <div className="mx-auto w-full max-w-[1200px] px-6 wide:px-12">
        <title>{`${crumb ? `${crumb} • ` : ''}${record.name} • Middesk`}</title>
        <div className="sticky top-0 z-[5]">
          <IdentityHeader
            record={record}
            defaultStatus={defaultStatus}
            assessment={crumb}
            onRunAssessment={() => navigate('/order', { state: { businessId: record.id, origin: here } })}
            onOpenTimeline={() => navigate(businessHref(record.id, 'timeline'))}
            onOpenActivity={() => navigate(businessHref(record.id, 'activity'))}
          />
        </div>
        <div className="pt-8">{children}</div>
      </div>
    </div>
  )
}
