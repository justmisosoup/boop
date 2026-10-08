import { useMemo } from 'react'
import { Navigate, useParams } from 'react-router'

import { ActivityTab } from '../components/Assessments/ActivityTab'
import { BusinessFrame } from '../components/Assessments/BusinessFrame'
import { SectionTitle } from '../components/Assessments/SectionTitle'
import { Timeline } from '../components/Timeline'
import { readAssessments } from '../lib/assessments'
import { byId } from '../lib/records'

const LABEL = { timeline: 'Timeline', activity: 'Activity' } as const

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
      <SectionTitle className="mb-3">{LABEL[section]}</SectionTitle>
      {section === 'timeline' ? <Timeline businessId={record.id} /> : <ActivityTab record={record} reads={reads} />}
    </BusinessFrame>
  )
}
