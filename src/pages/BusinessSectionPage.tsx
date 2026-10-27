import { useMemo } from 'react'
import { Navigate, useParams } from 'react-router'

import { PageHeadingCount } from '@/core'

import { ActivityTab, useActivity } from '../components/Assessments/ActivityTab'
import { BusinessFrame } from '../components/Assessments/BusinessFrame'
import { SectionTitle } from '../components/Assessments/SectionTitle'
import { Timeline } from '../components/Timeline'
import { readAssessments, type AssessmentRead } from '../lib/assessments'
import type { BusinessRecord } from '../lib/deriveResults'
import { byId } from '../lib/records'

const LABEL = { timeline: 'Timeline', activity: 'Activity' } as const

/** Every event, counted in its heading as Activity counts them. */
const ActivitySection = ({ record, reads }: { record: BusinessRecord; reads: AssessmentRead[] }) => {
  const events = useActivity(record, reads)
  return (
    <>
      <SectionTitle className="mb-6 flex items-center gap-2">
        {LABEL.activity}
        <PageHeadingCount>{events.length}</PageHeadingCount>
      </SectionTitle>
      <ActivityTab record={record} reads={reads} />
    </>
  )
}

/**
 * The business's Timeline or Activity in full, under its profile — opened from
 * the profile's menu, with the crumb leading back to the business, as an
 * assessment is.
 */
export const BusinessSectionPage = ({ section }: { section: 'timeline' | 'activity' }) => {
  const { businessId } = useParams()
  const record = byId(businessId)
  const reads = useMemo(() => (record ? readAssessments(record) : []), [record])
  if (!record) return <Navigate replace to="/businesses" />

  return (
    <BusinessFrame record={record} crumb={LABEL[section]}>
      {section === 'timeline' ? (
        <>
          <SectionTitle className="mb-6">{LABEL.timeline}</SectionTitle>
          <Timeline businessId={record.id} />
        </>
      ) : (
        <ActivitySection record={record} reads={reads} />
      )}
    </BusinessFrame>
  )
}
