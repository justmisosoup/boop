import { useCallback, useEffect, useState } from 'react'

import summaryStore from '../../analysis/assessments.json'
import { groupLabelsOf, resultsIn, type Assessment } from './assessments'
import { deriveResults, type BusinessRecord } from './deriveResults'
import { ORDER_CATALOG } from './customOrders/catalog'
import { useSavedWorkflows } from './savedWorkflows'
import { runsFor } from './assessmentRuns'
import { nextStepsFor } from './nextSteps'
import { statementOf } from './insightOutcome'

/**
 * Generate / Regenerate for an Assessment card's summary.
 *
 * A run queues one request at `/api/assessment-summary` for the session to
 * write, and is polled until it is kept. The endpoint writes
 * `analysis/assessments.json`, which reloads the page with the summary in it —
 * so the runs in flight are remembered across that reload, and dropped once the
 * store holds a summary newer than the request.
 */
const KEY = 'prototype:summary-runs'
const POLL_MS = 3000

type Run = { requestId: string; requestedAt: string }
type Runs = Record<string, Run>

const STORE = summaryStore as Record<string, Record<string, { at: string }>>
const runKey = (businessId: string, assessmentId: string) => `${businessId}/${assessmentId}`

const read = (): Runs => {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as Runs
  } catch {
    return {}
  }
}
const write = (runs: Runs) => {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(runs))
  } catch {
    /* the run still completes; only the "Writing…" state is lost on reload */
  }
}

/** Still waiting: no summary newer than the request has been kept. */
const stillRunning = (key: string, run: Run) => {
  const [businessId, assessmentId] = key.split('/')
  const kept = STORE[businessId]?.[assessmentId]
  return !kept || kept.at < run.requestedAt
}

export const useSummaryRuns = (record: BusinessRecord) => {
  const saved = useSavedWorkflows()
  const [runs, setRuns] = useState<Runs>(() => {
    const all = read()
    const live = Object.fromEntries(Object.entries(all).filter(([k, r]) => stillRunning(k, r)))
    write(live)
    return live
  })

  const isRunning = (assessmentId: string) => Boolean(runs[runKey(record.id, assessmentId)])

  const generate = useCallback(
    async (a: Assessment) => {
      const results = resultsIn(a, deriveResults(record)).filter((r) => !r.notReported)
      const description = saved.find((w) => w.id === a.customOrderId)?.description
      const groups = groupLabelsOf(a)
      const res = await fetch('/api/assessment-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: record.id,
          business: { name: record.name },
          assessment: {
            id: a.id,
            name: a.name,
            instructions: [
              `Summarise what the ${a.name} assessment found for ${record.name}, from these insights only: ${groups.join(', ')}.`,
              description
            ]
              .filter(Boolean)
              .join(' '),
            insightIds: results.map((r) => r.insightId)
          },
          // Each insight as the panel says it (a conversion is not an inactive filing).
          insights: results.map((r) => ({ id: r.insightId, statement: statementOf(r, record), state: r.state, reason: r.reason })),
          // The rules' next steps: the session may reword their whys, not choose them.
          steps: nextStepsFor(record, a, deriveResults(record), runsFor(record.id, a.id)).map(({ id, label, why }) => ({ id, label, why })),
          catalogVersion: ORDER_CATALOG.version
        })
      })
      if (!res.ok) return
      const { id } = (await res.json()) as { id: string }
      setRuns((cur) => {
        const next = { ...cur, [runKey(record.id, a.id)]: { requestId: id, requestedAt: new Date().toISOString() } }
        write(next)
        return next
      })
    },
    [record, saved]
  )

  // Poll each run in flight; a kept one reloads the page with its summary.
  const mine = Object.entries(runs).filter(([k]) => k.startsWith(`${record.id}/`))
  useEffect(() => {
    if (mine.length === 0) return
    // A run whose request is gone — or kept for another assessment — will never
    // land here: drop it, so its card can ask again.
    const drop = (key: string) =>
      setRuns((cur) => {
        const { [key]: _gone, ...rest } = cur
        write(rest)
        return rest
      })
    const timer = window.setInterval(() => {
      mine.forEach(([key, run]) => {
        fetch(`/api/assessment-summary?id=${run.requestId}`)
          .then(async (res) => {
            if (res.status === 404 || res.status === 422) return drop(key)
            const body = (await res.json()) as { kept?: boolean; assessmentId?: string }
            if (body.kept && body.assessmentId !== key.split('/')[1]) drop(key)
          })
          .catch(() => {})
      })
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [mine.map(([k, r]) => `${k}:${r.requestId}`).join()])

  return { generate, isRunning }
}
