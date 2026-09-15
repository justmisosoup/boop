import { useCallback, useEffect, useRef, useState } from 'react'

import type { AnalysisDraft, AnalysisResult } from '../types'
import type { BusinessRecord, Derived } from './deriveResults'

/** One run. Re-running produces another, so a reading can be compared with the
 *  one it replaced rather than overwriting it. */
export type AnalysisVersion = {
  id: string
  kind: 'report' | 'question'
  prompt: string
  /** How long the session took, so the thinking block persists with the turn. */
  durationMs: number
  insightCount: number
  result: AnalysisResult
  pinned: string[]
  at: string
}

export type Attachment = { name: string; type: string; size: number; dataBase64: string }

/** The policy the standing report is run against. */
export const POLICY = {
  id: 'smb-account-opening',
  name: 'SMB account opening'
}

/**
 * The standing brief. The analysis opens as a report rather than an empty box:
 * an analyst arriving at a business already knows why they are here, and making
 * them type it is the same mistake as making them pick the insights.
 */
export const KYB_BRIEF =
  'Core KYB for a financial institution opening a business bank account. ' +
  'Cover, in this order: whether a legally registered entity exists and is active; ' +
  'whether it is actually operating; who is behind it and whether that can be established; ' +
  'whether anything screens adversely; and what would block or delay account opening.'

export const useAnalysis = (record: BusinessRecord, results: Derived[]) => {
  const [versions, setVersions] = useState<AnalysisVersion[]>([])
  const [current, setCurrent] = useState(0)
  const [pinned, setPinned] = useState<string[]>([])
  const [slow, setSlow] = useState(false)
  /** Stage one, while stage two is still outstanding. The assessments are on
   *  screen before the verdict exists, which is the point of writing them in
   *  two passes rather than one. */
  const [draft, setDraft] = useState<AnalysisDraft | null>(null)
  const [error, setError] = useState<string | null>(null)

  /** The request being waited on. Held in state, not a ref, so polling is an
   *  effect that re-establishes itself — StrictMode double-mounts the tree, and
   *  an interval started inside a handler is cleared by that cleanup and never
   *  comes back. */
  const [pending, setPending] = useState<{
    id: string
    recordId: string
    asked: string
    kind: 'report' | 'question'
    pinnedIds: string[]
    startedAt: number
  } | null>(null)
  const slowTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const waiting = pending !== null

  // A different business is a different analysis.
  useEffect(() => {
    setVersions([])
    setCurrent(0)
    setPinned([])
    setError(null)
    setPending(null)
    setSlow(false)
    setDraft(null)
  }, [record.id])

  // Poll for whatever is outstanding.
  useEffect(() => {
    if (!pending) return

    slowTimer.current = setTimeout(() => setSlow(true), 180_000)

    const tick = async () => {
      let data:
        | { pending: true }
        | { stage: 'assessments'; draft: AnalysisDraft }
        | { error: string }
        | AnalysisResult
      try {
        const r = await fetch(`/api/analyse?id=${pending.id}`)
        data = await r.json()
      } catch {
        return // the session may be mid-write; keep polling
      }

      if ('pending' in data) return

      if ('stage' in data) {
        if (pending.recordId === record.id) setDraft(data.draft)
        return // keep polling for the verdict
      }

      // Abandoned if the user moved on.
      if (pending.recordId !== record.id) return setPending(null)

      if ('error' in data) {
        setError(data.error)
        setPending(null)
        return
      }

      setVersions((prev) => {
        const next = [
          ...prev,
          {
            id: pending.id,
            kind: pending.kind,
            prompt: pending.asked,
            result: data,
            pinned: pending.pinnedIds,
            durationMs: Date.now() - pending.startedAt,
            insightCount: results.length,
            at: new Date().toISOString()
          }
        ]
        setCurrent(next.length - 1)
        return next
      })
      setPending(null)
      setSlow(false)
      setDraft(null)
    }

    const interval = setInterval(tick, 1200)
    void tick()

    return () => {
      clearInterval(interval)
      clearTimeout(slowTimer.current)
    }
  }, [pending, record.id, results.length])

  const run = useCallback(
    (
      prompt: string,
      pinnedIds: string[] = pinned,
      attachments: Attachment[] = [],
      kind: 'report' | 'question' = 'question'
    ) => {
      const asked = prompt.trim()
      if (!asked) return
      setError(null)

      void fetch('/api/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: record.id,
          business: {
            name: record.name,
            entityType: record.formation?.entityType,
            state: record.formation?.state,
            formed: record.formation?.date
          },
          kind,
          prompt: asked,
          // Every insight, with its id — the session picks from these.
          insights: results.map((r) => ({
            id: r.insightId,
            statement: r.statement,
            state: r.state,
            reason: r.reason,
            because: r.because,
            evidence: r.evidence
          })),
          pinned: pinnedIds,
          attachments,
          history: versions.map((v) => ({ prompt: v.prompt, result: v.result }))
        })
      })
        .then((res) => res.json() as Promise<{ id: string }>)
        .then(({ id }) =>
          setPending({ id, recordId: record.id, asked, kind, pinnedIds, startedAt: Date.now() })
        )
        .catch((e: unknown) =>
          setError(e instanceof Error ? e.message : 'Could not reach the dev server.')
        )
    },
    [pinned, record, results, versions]
  )

  // The standing report fires on arrival, once per business.
  const reportFor = useRef<string | null>(null)
  useEffect(() => {
    if (results.length === 0) return
    if (reportFor.current === record.id) return
    reportFor.current = record.id
    run(KYB_BRIEF, [], [], 'report')
  }, [record.id, results.length, run])

  /** Add an insight the session did not pick, and re-ask the same question. */
  const addAndRerun = useCallback(
    (insightId: string) => {
      const last = versions[versions.length - 1]
      if (!last) return
      const next = [...new Set([...pinned, insightId])]
      setPinned(next)
      run(last.prompt, next, [], 'question')
    },
    [pinned, run, versions]
  )

  const unpin = useCallback(
    (insightId: string) => setPinned((prev) => prev.filter((id) => id !== insightId)),
    []
  )

  return {
    draft,
    waitingKind: pending?.kind ?? null,
    versions,
    current,
    setCurrent,
    pinned,
    waiting,
    slow,
    error,
    run,
    addAndRerun,
    unpin,
    active: versions[current]
  }
}
