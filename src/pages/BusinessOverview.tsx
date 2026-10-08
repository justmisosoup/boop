import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import { ActionButton, IconActionButton, PageHeadingCount, SearchInput, Text } from '@/core'
import { Search, X } from 'lucide-react'


import { RecentActivity } from '../components/Assessments/ActivityTab'
import { AlertsCard } from '../components/Assessments/AlertsCard'
import {
  AssessmentCard,
  AssessmentLayoutToggle,
  type AssessmentLayout
} from '../components/Assessments/AssessmentCard'
import { AssessmentTable } from '../components/Assessments/AssessmentTable'
import { BusinessFrame } from '../components/Assessments/BusinessFrame'
import { SectionTitle } from '../components/Assessments/SectionTitle'
import { readAssessments, type Assessment } from '../lib/assessments'
import type { BusinessRecord } from '../lib/deriveResults'
import { useSummaryRuns } from '../lib/useSummaryRuns'

const LAYOUT_KEY = 'prototype:assessments-layout'

/** Where an assessment opens. */
export const assessmentHref = (businessId: string, assessmentId: string) =>
  `/businesses/${businessId}/assessments/${assessmentId}`

/**
 * A business: its identity, then its Assessments — one card per custom order it
 * was ordered with, each scored on its own insights. Opening one moves it into
 * the report's left column with that assessment's report beside it. What has
 * happened to the business — its filings over time, its activity here — is in
 * the right-hand column, behind the same rail the report keeps.
 */
export const BusinessOverview = ({ record }: { record: BusinessRecord }) => {
  const navigate = useNavigate()
  const reads = useMemo(() => readAssessments(record), [record])
  const { generate, isRunning } = useSummaryRuns(record)
  /**
   * While its orders run, pull the business again every 10s, as the list does:
   * the endpoint rewrites its record when something changed, and the page
   * reloads with the cards filled in.
   */
  const ordering = reads.some((r) => r.ordering && !r.assessment.full)
  /**
   * A summary is written as soon as an assessment's orders finish — nobody has
   * to ask. Once per page per assessment; the card's ghost holds its place.
   */
  const summaryAsked = useRef(new Set<string>())
  useEffect(() => {
    for (const r of reads) {
      const a = r.assessment
      if (a.full || r.ordering || r.summary || isRunning(a.id) || summaryAsked.current.has(a.id)) continue
      summaryAsked.current.add(a.id)
      void generate(a)
    }
  }, [reads, generate, isRunning])
  useEffect(() => {
    if (!ordering) return
    const check = () => fetch(`/api/order?id=${encodeURIComponent(record.id)}`).catch(() => {})
    const timer = window.setInterval(check, 10_000)
    return () => window.clearInterval(timer)
  }, [ordering, record.id])
  // The reader's own preference, kept across businesses on this browser.
  const [layout, setLayoutState] = useState<AssessmentLayout>(() => {
    try {
      return window.localStorage.getItem(LAYOUT_KEY) === 'list' ? 'list' : 'grid'
    } catch {
      return 'grid'
    }
  })
  const setLayout = (next: AssessmentLayout) => {
    setLayoutState(next)
    try {
      window.localStorage.setItem(LAYOUT_KEY, next)
    } catch {
      /* the choice lasts for this page */
    }
  }

  const open = (a: Assessment) => navigate(assessmentHref(record.id, a.id), { viewTransition: true })
  // Run assessments on this business: the order page, fixed to it, pre-ticked
  // with one for "Run again"; running comes back here.
  const order = (customOrderId?: string) =>
    navigate('/order', { state: { businessId: record.id, origin: `/businesses/${record.id}`, customOrderId } })
  // "Full Business KYB" is the report's own run: it regenerates from the report.
  const regenerate = (a: Assessment) =>
    a.full
      ? navigate(assessmentHref(record.id, a.id), { state: { regenerate: true } })
      : void generate(a)

  // Find an assessment by name: the icon opens the field, Escape or clearing
  // it puts it away.
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const shownReads = q ? reads.filter((r) => r.assessment.name.toLowerCase().includes(q)) : reads

  const cardProps = (read: (typeof reads)[number]) => ({
    read,
    running: isRunning(read.assessment.id),
    onOpen: () => open(read.assessment),
    onGenerate: () => regenerate(read.assessment),
    onOrderAgain: read.assessment.customOrderId ? () => order(read.assessment.customOrderId) : undefined
  })

  return (
    <BusinessFrame record={record}>
      {/* Two columns: the assessments, and a 320px column of alerts and
          recent activity at the right. */}
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-x-12">


      <section aria-label="Assessments" className="min-w-0">
        <div className="mb-3 flex items-center gap-3">
          {/* The same title as Alerts and Recent activity, with its count. */}
          <SectionTitle className="flex items-center gap-2">
            Assessments
            {/* The core count chip, as the list pages' headings carry theirs. */}
            <PageHeadingCount>{reads.length}</PageHeadingCount>
          </SectionTitle>
          <div className="flex-1" />
          {searching ? (
            <div className="flex items-center gap-1">
            <SearchInput
              aria-label="Search assessments"
              autoFocus
              // Expands out from where the icon was.
              className="w-56 origin-right animate-in fade-in-0 zoom-in-95 slide-in-from-right-4 duration-fast motion-reduce:animate-none"
              onChange={setQuery}
              onClear={() => {
                setQuery('')
                setSearching(false)
              }}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === 'Escape') {
                  setQuery('')
                  setSearching(false)
                }
              }}
              onBlur={() => {
                // Clicked away with nothing typed: put the field away.
                if (!query.trim()) setSearching(false)
              }}
              placeholder="Search assessments"
              size="compact"
              value={query}
            />
            <IconActionButton
              aria-label="Close search"
              onClick={() => {
                setQuery('')
                setSearching(false)
              }}
              size="compact"
              variant="quiet"
            >
              <X aria-hidden="true" />
            </IconActionButton>
            </div>
          ) : (
            <IconActionButton aria-label="Search assessments" onClick={() => setSearching(true)} variant="quiet">
              <Search aria-hidden="true" />
            </IconActionButton>
          )}
          <AssessmentLayoutToggle value={layout} onChange={setLayout} />
        </div>
        {layout === 'list' ? (
          <AssessmentTable rows={shownReads.map(cardProps)} />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {shownReads.map((read) => (
              <AssessmentCard key={read.assessment.id} {...cardProps(read)} />
            ))}
          </div>
        )}
        {q && shownReads.length === 0 && (
          <Text tone="secondary" className="mt-3">
            No assessments match “{query.trim()}”.
          </Text>
        )}
      </section>

      <aside className="flex flex-col gap-12">
        <RecentActivity record={record} reads={reads} />
        <AlertsCard />
      </aside>
      </div>
    </BusinessFrame>
  )
}
