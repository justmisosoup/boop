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
  /** The conversation a question belongs to. Absent on the report turn. */
  threadId?: string
}

/**
 * The conversation a question with no thread id belongs to.
 *
 * Questions kept before conversations existed carry none; they are the
 * report's first conversation, which is what they always were.
 */
export const FIRST_THREAD = 'thread-1'

/** One conversation on a report: its questions, oldest first. */
export type Thread = {
  id: string
  questions: AnalysisVersion[]
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
      at: q.at,
      threadId: q.threadId ?? FIRST_THREAD
    }))
  }
}

/** The conversation a report was last asked in, or null when none has been. */
const newestThread = (r: Report | null) => {
  const last = r?.questions[r.questions.length - 1]
  return last ? (last.threadId ?? FIRST_THREAD) : null
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
  /**
   * The ask that was not answered, kept beside the error.
   *
   * A failed turn stays in the conversation as what was asked and what went
   * wrong, and Retry sends it again. Without this the question vanished with
   * the pending state and the error hung under the previous answer.
   */
  const [failed, setFailed] = useState<{
    prompt: string
    skills?: string[]
    typed?: string
    policy?: Array<{ id: string; name: string; instructions: string; insightIds?: string[] }>
    reportId: string | null
    at: string
  } | null>(null)

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
    /** The same, whole, so a failed run can be sent again as it was. */
    fullPolicy?: Array<{ id: string; name: string; instructions: string; insightIds?: string[] }>
    kind: 'report' | 'question'
    startedAt: number
    /** Which report a question was asked of. Null on a report. */
    reportId: string | null
    /** Which conversation a question joins. Null on a report. */
    threadId: string | null
    /** What the page was reading when it was sent. Frozen then, not on landing:
     *  a four-minute run belongs to the inputs it was asked with. */
    snapshot: ReportSnapshot | null
  } | null>(null)
  /** A run nobody answers stops waiting rather than spinning for the session. */
  const giveUpTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const waiting = pending !== null

  /**
   * Which conversation is open.
   *
   * Starts on the newest one the report holds, or the first if it holds none
   * yet. "New conversation" mints a fresh id, which exists only here until a
   * question is asked in it — an empty conversation is not worth keeping.
   */
  const [activeThreadId, setActiveThreadId] = useState<string>(
    () => newestThread(heldReport(record.name)) ?? FIRST_THREAD
  )

  // A different business is a different analysis.
  useEffect(() => {
    const held = heldReport(record.name)
    setReport(held)
    setActiveThreadId(newestThread(held) ?? FIRST_THREAD)
    setError(null)
    setFailed(null)
    setPending(null)
    setDraft(null)
  }, [record.id])

  // Poll for whatever is outstanding.
  useEffect(() => {
    if (!pending) return

    /** What was asked, for the error turn and for Retry. */
    const keep = () =>
      setFailed({
        prompt: pending.asked,
        skills: pending.skills,
        typed: pending.typed,
        policy: pending.fullPolicy,
        reportId: pending.reportId,
        at: new Date(pending.startedAt).toISOString()
      })

    giveUpTimer.current = setTimeout(() => {
      keep()
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
        keep()
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
          at: new Date().toISOString(),
          threadId: pending.threadId ?? FIRST_THREAD
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

  /**
   * The report's conversations, oldest first, each with its questions.
   *
   * Grouped from the flat list rather than stored as a tree: the store keeps
   * one list per report and a conversation is a label on a question, so an
   * older store with no labels reads as one conversation without migrating.
   */
  const threads = useMemo<Thread[]>(() => {
    const byId = new Map<string, AnalysisVersion[]>()
    for (const q of questions) {
      const id = q.threadId ?? FIRST_THREAD
      byId.set(id, [...(byId.get(id) ?? []), q])
    }
    return [...byId.entries()].map(([id, qs]) => ({ id, questions: qs }))
  }, [questions])

  /** The open conversation's questions. Empty for a conversation just started. */
  const thread = useMemo(
    () => threads.find((t) => t.id === activeThreadId)?.questions ?? [],
    [threads, activeThreadId]
  )

  /** Start a conversation. It is only kept once something is asked in it. */
  const newThread = useCallback(() => {
    setActiveThreadId(`thread-${Date.now()}`)
    setError(null)
    setFailed(null)
  }, [])

  const openThread = useCallback((id: string) => {
    setActiveThreadId(id)
    setError(null)
    setFailed(null)
  }, [])

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
      setFailed(null)

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
          // The report, then this conversation's turns. Another conversation
          // on the same report is a different line of questioning; feeding it
          // in would answer this one against things nobody here asked.
          history: [
            ...versions.filter((v) => v.kind === 'report'),
            ...versions.filter((v) => v.kind === 'question' && (v.threadId ?? FIRST_THREAD) === activeThreadId)
          ].map((v) => ({ prompt: v.prompt, result: v.result })),
          typed,
          threadId: kind === 'question' ? activeThreadId : undefined,
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
            fullPolicy: policy,
            kind,
            startedAt: Date.now(),
            reportId: kind === 'question' ? (target ?? report?.id ?? null) : null,
            threadId: kind === 'question' ? activeThreadId : null,
            snapshot: kind === 'report' ? { recordId: record.id, record, results } : null
          })
        )
        .catch((e: unknown) =>
          setError(e instanceof Error ? e.message : 'Could not reach the dev server.')
        )
    },
    [record, results, report?.id, versions, activeThreadId]
  )

  /**
   * Ask the conversation's last question again.
   *
   * The same prompt, the same skills, against the same report — what "Retry"
   * means on an answer that did not land or did not satisfy. Nothing to
   * replay is a no-op rather than an error.
   */
  const retry = useCallback(() => {
    if (failed) {
      run(failed.prompt, [], 'question', failed.skills, failed.typed, failed.policy, failed.reportId ?? undefined)
      return
    }
    const last = thread[thread.length - 1]
    if (!last) return
    run(last.prompt, [], 'question', last.skills, last.typed, undefined, report?.id)
  }, [failed, thread, run, report?.id])

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
    /** The report's conversations, and the one that is open. */
    threads,
    thread,
    activeThreadId,
    newThread,
    openThread,
    retry,
    /** The business's report — its assessment, and the snapshot the tabs render. */
    selected: report,
    waiting,
    error,
    /** The ask the error belongs to, when there is one. */
    failed,
    run,
    active: versions[versions.length - 1]
  }
}
