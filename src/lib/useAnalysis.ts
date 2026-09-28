import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { AnalysisDraft, AnalysisResult, ReportSnapshot } from '../types'
import { deriveResults, type BusinessRecord, type Derived } from './deriveResults'
// The bundled store, shared with the businesses list — see `heldReports.ts`.
// In dev this changes nothing: the endpoint answers first and the live run
// replaces it. Deployed, it is the whole of what the page can show.
import { heldReportFor } from './heldReports'

/** One turn: the report, or a question asked of it. */
export type AnalysisVersion = {
  id: string
  kind: 'report' | 'question'
  /** The composed instructions actually sent. */
  prompt: string
  /** The skills that composed it, in the order they were read. */
  skills?: string[]
  /** What the reader typed, if anything — the prompt minus the skills. */
  typed?: string
  /** The assessments it ran, so the settled turn lists them too. */
  policy?: Array<{ id: string; name: string }>
  /** How long the session took, so the thinking block persists with the turn. */
  durationMs: number
  insightCount: number
  result: AnalysisResult
  at: string
}

export type Attachment = { name: string; type: string; size: number; dataBase64: string }

/**
 * The business's report, in the page's hands.
 *
 * What it concluded and what it was reading, together — the assessment and the
 * record and insight list the tabs are built from. One per business: a run
 * replaces it. The questions asked of it belong to it, because they were
 * answered against its snapshot.
 */
export type Report = {
  id: string
  /** The assessment it was run from — what the report is called. */
  name: string
  /** When it was asked. */
  at: string
  policy: Array<{ id: string; name: string }>
  result: AnalysisResult
  snapshot: ReportSnapshot | null
  questions: AnalysisVersion[]
}

/** The report kept for a business. Static: on screen from the first paint
 *  rather than arriving a round trip later. */
const heldReport = (name: string): Report | null => {
  const r = heldReportFor(name)
  if (!r) return null
  return {
    id: r.id,
    name: r.name || 'Assessment',
    at: r.at,
    policy: r.policy ?? [],
    result: r.report,
    // The snapshot's RECORD is the point in time; its rows are re-read from
    // it with today's rules. Stored rows froze how a check was read the day
    // the report ran, so a reading rule fixed since — Delaware's Unknown
    // status is not a finding — never reached an existing report.
    snapshot: r.snapshot ? { ...r.snapshot, results: deriveResults(r.snapshot.record) } : null,
    questions: (r.questions ?? []).map((q) => ({
      id: q.id,
      kind: 'question' as const,
      prompt: q.prompt,
      skills: q.skills,
      typed: q.typed,
      result: q.result,
      durationMs: q.durationMs ?? 0,
      insightCount: r.snapshot?.results.length ?? 0,
      at: q.at
    }))
  }
}

/**
 * A report, as the turn the panel renders.
 *
 * The panel reads `AnalysisVersion`s — a report and the questions asked of it
 * are turns in the same thread, and it does not need to know which came from
 * where.
 */
const reportTurn = (r: Report): AnalysisVersion => ({
  id: r.id,
  kind: 'report',
  prompt: '',
  skills: [],
  typed: '',
  policy: r.policy,
  result: r.result,
  durationMs: 0,
  insightCount: r.snapshot?.results.length ?? 0,
  at: r.at
})

export const useAnalysis = (
  record: BusinessRecord,
  results: Derived[]
) => {
  /** The business's report, on screen from the first paint. */
  const [report, setReport] = useState<Report | null>(() => heldReport(record.name))
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
    skills?: string[]
    typed?: string
    policy?: Array<{ id: string; name: string }>
    kind: 'report' | 'question'
    startedAt: number
    /** Which report a question was asked of. Null on a report. */
    reportId: string | null
    /** What the page was reading when it was sent. Frozen then, not on landing:
     *  a four-minute run belongs to the inputs it was asked with. */
    snapshot: ReportSnapshot | null
  } | null>(null)
  /** A run nobody answers stops waiting rather than spinning for the session. */
  const giveUpTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const waiting = pending !== null

  // A different business is a different analysis.
  useEffect(() => {
    setReport(heldReport(record.name))
    setError(null)
    setPending(null)
    setDraft(null)
  }, [record.id])

  // Poll for whatever is outstanding.
  useEffect(() => {
    if (!pending) return

    giveUpTimer.current = setTimeout(() => {
      setPending(null)
      setDraft(null)
      setError('This run was not answered. Send it again to retry.')
    }, 600_000)

    const tick = async () => {
      let data:
        | { pending: true }
        | { stage: 'assessments'; draft: AnalysisDraft; arrived: string[] }
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
        return // keep polling for the rest, then the verdict
      }

      // Abandoned if the user moved on.
      if (pending.recordId !== record.id) return setPending(null)

      if ('error' in data) {
        setError(data.error)
        setPending(null)
        return
      }

      /* A report replaces the one the business had; a question is filed into
         the report it was asked of. */
      if (pending.kind === 'report') {
        setReport({
          id: pending.id,
          name: pending.skills?.[0] ?? 'Assessment',
          at: new Date().toISOString(),
          policy: pending.policy ?? [],
          result: data,
          snapshot: pending.snapshot,
          questions: []
        })
      } else {
        const landed: AnalysisVersion = {
          id: pending.id,
          kind: 'question',
          prompt: pending.asked,
          skills: pending.skills,
          typed: pending.typed,
          policy: pending.policy,
          result: data,
          durationMs: Date.now() - pending.startedAt,
          insightCount: results.length,
          at: new Date().toISOString()
        }
        setReport((prev) =>
          prev && prev.id === pending.reportId ? { ...prev, questions: [...prev.questions, landed] } : prev
        )
      }
      setPending(null)
      setDraft(null)
    }

    const interval = setInterval(tick, 1200)
    void tick()

    return () => {
      clearInterval(interval)
      clearTimeout(giveUpTimer.current)
    }
  }, [pending, record.id, results.length])

  /**
   * The report and the turns under it.
   *
   * `versions` is what the panel renders: the report first, then the questions
   * asked of it.
   */
  const versions = useMemo<AnalysisVersion[]>(
    () => (report ? [reportTurn(report), ...report.questions] : []),
    [report]
  )

  /**
   * The two halves of a thread, named rather than sliced at the call site.
   *
   * The report and the questions render in different columns — the report in
   * the report, the questions in the chat — and index arithmetic spread across
   * two components is how they drift.
   */
  const reportVersion = useMemo(() => versions[0] ?? null, [versions])
  const questions = useMemo(() => versions.slice(1), [versions])

  const run = useCallback(
    (
      prompt: string,
      attachments: Attachment[] = [],
      kind: 'report' | 'question' = 'question',
      /** The skills that composed the prompt, for the transcript. */
      skills?: string[],
      typed?: string,
      /**
       * The assessments this run is composed of, in order — the manifest.
       *
       * Sent to the server, not just held for the transcript: it is what tells
       * the run when it is complete. Without it there is no difference between
       * an assessment still being worked and one that was never written, and a
       * recommendation could be served against a report quietly missing a
       * section.
       */
      policy?: Array<{ id: string; name: string; instructions: string; insightIds?: string[] }>,
      /**
       * Which report a question is asked of. Defaults to the business's; a
       * report ignores it, because a report always starts its own.
       */
      target?: string
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
          skills,
          assessments: policy ?? [],
          // Every insight, with its id — the session picks from these.
          insights: results.map((r) => ({
            id: r.insightId,
            statement: r.statement,
            state: r.state,
            reason: r.reason,
            because: r.because,
            evidence: r.evidence
          })),
          attachments,
          history: versions.map((v) => ({ prompt: v.prompt, result: v.result })),
          // What the page is reading, frozen at the moment it is asked. Only on
          // a report: a question inherits the snapshot of the report it joins.
          snapshot:
            kind === 'report' ? { recordId: record.id, record, results } : undefined,
          reportId: kind === 'question' ? (target ?? report?.id ?? undefined) : undefined
        })
      })
        .then((res) => res.json() as Promise<{ id: string }>)
        .then(({ id }) =>
          setPending({
            id,
            recordId: record.id,
            asked,
            skills,
            typed,
            policy: policy?.map(({ id, name }) => ({ id, name })),
            kind,
            startedAt: Date.now(),
            reportId: kind === 'question' ? (target ?? report?.id ?? null) : null,
            snapshot: kind === 'report' ? { recordId: record.id, record, results } : null
          })
        )
        .catch((e: unknown) =>
          setError(e instanceof Error ? e.message : 'Could not reach the dev server.')
        )
    },
    [record, results, report?.id, versions]
  )

  return {
    draft,
    /** The assessments this run is composed of, in order. */
    waitingPolicy: pending?.policy ?? [],
    waitingKind: pending?.kind ?? null,
    waitingSkills: pending?.skills ?? [],
    waitingTyped: pending?.typed ?? '',
    versions,
    reportVersion,
    questions,
    /** The business's report — its assessment, and the snapshot the tabs render. */
    selected: report,
    waiting,
    error,
    run,
    active: versions[versions.length - 1]
  }
}
