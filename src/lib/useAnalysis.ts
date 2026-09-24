import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { AnalysisDraft, AnalysisResult, ReportSnapshot } from '../types'
import { deriveResults, type BusinessRecord, type Derived } from './deriveResults'
// The bundled store, shared with the businesses list — see `heldReports.ts`.
// In dev this changes nothing: the endpoint answers first and the live run
// replaces it. Deployed, it is the whole of what the page can show.
import { heldReportsFor as bundledReports } from './heldReports'

/** One run. Re-running produces another, so a reading can be compared with the
 *  one it replaced rather than overwriting it. */
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
 * A report, in the page's hands.
 *
 * What it concluded and what it was reading, together — the assessment prose
 * and the record and insight list the three tabs are built from. A business has
 * a list of these; a run appends to it. The questions asked of a report belong
 * to it, because they were answered against its snapshot.
 */
export type Report = {
  id: string
  /** The assessment it was run from — what the report is called. */
  name: string
  /** When it was asked. Empty only for a report kept before this was recorded. */
  at: string
  policy: Array<{ id: string; name: string }>
  result: AnalysisResult
  /** Null for a report kept before snapshots existed — the page falls back to
   *  the live record for those, which is what it always did. */
  snapshot: ReportSnapshot | null
  questions: AnalysisVersion[]
}

/** The reports kept for a business. Static: on screen from the first paint
 *  rather than arriving a round trip later. */
const heldReports = (name: string): Report[] =>
  bundledReports(name).map((r) => ({
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
      pinned: q.pinned ?? [],
      durationMs: q.durationMs ?? 0,
      insightCount: r.snapshot?.results.length ?? 0,
      at: q.at
    }))
  }))

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
  pinned: [],
  durationMs: 0,
  insightCount: r.snapshot?.results.length ?? 0,
  at: r.at
})

/** Newest last, so the page opens on the one at the end. */
const newestId = (reports: Report[]) =>
  reports.length > 0 ? reports[reports.length - 1].id : null

export const useAnalysis = (
  record: BusinessRecord,
  results: Derived[]
) => {
  /**
   * Every report this business has, on screen from the first paint.
   *
   * They used to seed behind a `fetch` probe, so the report arrived a round
   * trip after the page did and visibly dropped in.
   */
  const [reports, setReports] = useState<Report[]>(() => heldReports(record.name))
  /**
   * The one being read.
   *
   * A report is a moment, so a business accumulates them rather than
   * overwriting one slot: opening an earlier report is how you see what a
   * re-run changed. Everything the page shows — the assessment and all three
   * tabs — resolves from this one id, so they cannot disagree.
   */
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    newestId(heldReports(record.name))
  )
  const [pinned, setPinned] = useState<string[]>([])
  const [slow, setSlow] = useState(false)
  /** Stage one, while stage two is still outstanding. The assessments are on
   *  screen before the verdict exists, which is the point of writing them in
   *  two passes rather than one. */
  const [draft, setDraft] = useState<AnalysisDraft | null>(null)
  /**
   * Which assessments have landed, by id.
   *
   * Progress used to be `draft.sections.length` matched positionally against the
   * assessment list — fine while they were written in order, wrong the moment
   * they are worked at the same time, because the third to finish would light
   * the first row. Keyed by id, a slow assessment holds only its own row.
   */
  const [arrived, setArrived] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  /** The server has the request — the first poll came back. Real, not a timer. */
  const [acknowledged, setAcknowledged] = useState(false)

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
    pinnedIds: string[]
    startedAt: number
    /** Which report a question was asked of. Null on a report. */
    reportId: string | null
    /** What the page was reading when it was sent. Frozen then, not on landing:
     *  a four-minute run belongs to the inputs it was asked with. */
    snapshot: ReportSnapshot | null
  } | null>(null)
  const slowTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  /** A run nobody answers stops waiting rather than spinning for the session. */
  const giveUpTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const waiting = pending !== null

  /**
   * Nothing is restored on arrival.
   *
   * The report IS kept — the endpoint files the last one per business — but a
   * refresh starts blank on purpose: opening a record should not look like a
   * run just happened. Pressing send brings it back, replayed section by
   * section, unless a brief has been edited since, in which case it is written
   * afresh. See `analysis/reports.json`.
   */

  // A different business is a different analysis.
  useEffect(() => {
    const held = heldReports(record.name)
    setReports(held)
    setSelectedId(newestId(held))
    setPinned([])
    setError(null)
    setPending(null)
    setSlow(false)
    setDraft(null)
    setArrived([])
    setAcknowledged(false)
  }, [record.id])

  // Poll for whatever is outstanding.
  useEffect(() => {
    if (!pending) return

    slowTimer.current = setTimeout(() => setSlow(true), 180_000)
    giveUpTimer.current = setTimeout(() => {
      setPending(null)
      setSlow(false)
      setDraft(null)
      setArrived([])
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
      if ('pending' in data) {
        setAcknowledged(true)
        return
      }

      if ('stage' in data) {
        if (pending.recordId === record.id) {
          setDraft(data.draft)
          setArrived(data.arrived ?? [])
        }
        return // keep polling for the rest, then the verdict
      }

      // Abandoned if the user moved on.
      if (pending.recordId !== record.id) return setPending(null)

      if ('error' in data) {
        setError(data.error)
        setPending(null)
        return
      }

      const landed: AnalysisVersion = {
        id: pending.id,
        kind: pending.kind,
        prompt: pending.asked,
        skills: pending.skills,
        typed: pending.typed,
        // Kept on the version so a settled run still lists what it worked
        // through, rather than collapsing to a count of nothing.
        policy: pending.policy,
        result: data,
        pinned: pending.pinnedIds,
        durationMs: Date.now() - pending.startedAt,
        insightCount: pending.snapshot?.results.length ?? results.length,
        at: new Date().toISOString()
      }

      /*
       * A report arrives as a report; a question is filed into the one it was
       * asked of.
       *
       * These used to be the same list, with a landing report replacing the one
       * already in it — so a re-run destroyed the reading it was being compared
       * against, and a question about an older report landed against whatever
       * was on screen.
       */
      if (pending.kind === 'report') {
        const made: Report = {
          id: pending.id,
          name: pending.skills?.[0] ?? 'Assessment',
          at: new Date().toISOString(),
          policy: pending.policy ?? [],
          result: data,
          snapshot: pending.snapshot,
          questions: []
        }
        setReports((prev) => [...prev, made])
        setSelectedId(made.id)
      } else {
        setReports((prev) =>
          prev.map((r) =>
            r.id === pending.reportId ? { ...r, questions: [...r.questions, landed] } : r
          )
        )
      }
      setPending(null)
      setSlow(false)
      setDraft(null)
      setArrived([])
    }

    const interval = setInterval(tick, 1200)
    void tick()

    return () => {
      clearInterval(interval)
      clearTimeout(slowTimer.current)
      clearTimeout(giveUpTimer.current)
    }
  }, [pending, record.id, results.length])

  /**
   * The report being read, and the turns under it.
   *
   * `versions` is what the panel renders: the report first, then the questions
   * asked of it. Switch report and the thread changes with it — a question
   * asked of March's report is not part of September's.
   */
  const selected = useMemo(
    () => reports.find((r) => r.id === selectedId) ?? null,
    [reports, selectedId]
  )
  const versions = useMemo<AnalysisVersion[]>(
    () => (selected ? [reportTurn(selected), ...selected.questions] : []),
    [selected]
  )

  /**
   * The two halves of a thread, named rather than sliced at the call site.
   *
   * The report is always the first turn and the questions are always the rest
   * (`versions` is built that way, just above), but those two now render in
   * different columns — the report in the report, the questions in the chat —
   * and index arithmetic spread across two components is how they drift.
   */
  const reportVersion = useMemo(() => versions[0] ?? null, [versions])
  const questions = useMemo(() => versions.slice(1), [versions])

  const run = useCallback(
    (
      prompt: string,
      pinnedIds: string[] = pinned,
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
      policy?: Array<{ id: string; name: string; instructions: string }>,
      /**
       * Which report a question is asked of. Defaults to the one being read; a
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
          pinned: pinnedIds,
          attachments,
          history: versions.map((v) => ({ prompt: v.prompt, result: v.result })),
          // What the page is reading, frozen at the moment it is asked. Only on
          // a report: a question inherits the snapshot of the report it joins.
          snapshot:
            kind === 'report' ? { recordId: record.id, record, results } : undefined,
          reportId: kind === 'question' ? (target ?? selectedId ?? undefined) : undefined
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
            pinnedIds,
            startedAt: Date.now(),
            reportId: kind === 'question' ? (target ?? selectedId) : null,
            snapshot: kind === 'report' ? { recordId: record.id, record, results } : null
          })
        )
        .catch((e: unknown) =>
          setError(e instanceof Error ? e.message : 'Could not reach the dev server.')
        )
    },
    [pinned, record, results, selectedId, versions]
  )

  /**
   * Nothing runs on arrival.
   *
   * The report used to fire the moment a business was opened, which meant the
   * screen was busy before the reader had asked for anything and the assessment
   * that produced it was never a thing they sent. The composer opens with it
   * selected instead: the run starts when they send it, and the turn above the
   * answer is theirs.
   */
  const rerunReport = useCallback(
    (prompt: string) => run(prompt, [], [], 'report'),
    [run]
  )

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
    /** Assessment ids already on disk — what lights each step. */
    arrived,
    /** The assessments this run is composed of, in order. */
    waitingPolicy: pending?.policy ?? [],
    waitingKind: pending?.kind ?? null,
    /** What was sent, so the turn can be on screen before the answer is. */
    acknowledged,
    waitingSkills: pending?.skills ?? [],
    waitingTyped: pending?.typed ?? '',
    versions,
    reportVersion,
    questions,
    /** Every report this business has, oldest first. */
    reports,
    /** The one being read — its assessment, and the snapshot the tabs render. */
    selected,
    select: setSelectedId,
    rerunReport,
    pinned,
    waiting,
    slow,
    error,
    run,
    addAndRerun,
    unpin,
    active: versions[versions.length - 1]
  }
}
