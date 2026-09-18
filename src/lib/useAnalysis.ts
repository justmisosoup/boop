import { useCallback, useEffect, useRef, useState } from 'react'

import reportStore from '../../analysis/reports.json'

import type { AnalysisDraft, AnalysisResult } from '../types'

/**
 * The reports written for this prototype, bundled.
 *
 * `/api/analyse` is dev-server middleware: it does not exist in a `vite build`,
 * so a deployed copy cannot ask a Claude Code session for a report. It carries
 * the ones already written instead, keyed by business name because a re-pull
 * mints new business ids.
 *
 * In dev this changes nothing — the endpoint answers first and the live run
 * replaces it. Deployed, it is the whole of what the page can show.
 */
const BUNDLED_REPORTS: Record<
  string,
  { report: AnalysisResult; policy?: Array<{ id: string; name: string }> }
> = (reportStore as { reports?: Record<string, { report: AnalysisResult; policy?: Array<{ id: string; name: string }> }> })
  .reports ?? {}

const bundledReport = (name: string) =>
  BUNDLED_REPORTS[name.toLowerCase().replace(/\s+/g, ' ').trim()] ?? null
import type { BusinessRecord, Derived } from './deriveResults'

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

/** The report kept for a business, as the one version to show. Static: it is on
 *  screen from the first paint rather than arriving after a round trip. */
const heldVersions = (name: string, insightCount: number): AnalysisVersion[] => {
  const held = bundledReport(name)
  if (!held) return []
  return [
    {
      id: `held:${name}`,
      kind: 'report',
      prompt: '',
      skills: [],
      typed: '',
      policy: held.policy ?? [],
      result: held.report,
      pinned: [],
      durationMs: 0,
      insightCount,
      at: new Date().toISOString()
    }
  ]
}

export const useAnalysis = (
  record: BusinessRecord,
  results: Derived[]
) => {
  /**
   * The bundled report is on screen from the first paint.
   *
   * It used to seed behind a `fetch` probe, so the report arrived a round trip
   * after the page did and visibly dropped in. It is held state, so a live run
   * still replaces it.
   */
  const [versions, setVersions] = useState<AnalysisVersion[]>(() =>
    heldVersions(record.name, results.length)
  )

  /**
   * Reports a re-run replaced, newest first.
   *
   * A re-run against an edited workflow answers a different question, so it
   * takes the report's place rather than stacking beneath it — but the one it
   * replaced is the only way to see what the edit changed, so it is kept and
   * readable rather than dropped.
   */
  const [superseded, setSuperseded] = useState<AnalysisVersion[]>([])
  const [current, setCurrent] = useState(0)
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
    setVersions(heldVersions(record.name, results.length))
    setSuperseded([])
    setCurrent(0)
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
        insightCount: results.length,
        at: new Date().toISOString()
      }

      setVersions((prev) => {
        // A question is a turn and stacks. A report is THE report: a re-run
        // against an edited workflow replaces it in place, so the transcript
        // never shows two reports disagreeing about the same business.
        if (landed.kind !== 'report') return [...prev, landed]

        const at = prev.findIndex((v) => v.kind === 'report')
        if (at === -1) return [...prev, landed]

        setSuperseded((old) => [prev[at], ...old])
        return prev.map((v, i) => (i === at ? landed : v))
      })
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
      policy?: Array<{ id: string; name: string; instructions: string }>
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
          history: versions.map((v) => ({ prompt: v.prompt, result: v.result }))
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
            startedAt: Date.now()
          })
        )
        .catch((e: unknown) =>
          setError(e instanceof Error ? e.message : 'Could not reach the dev server.')
        )
    },
    [pinned, record, results, versions]
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

  /**
   * Show the newest version as it lands.
   *
   * This used to be a `setCurrent` call inside the `setVersions` updater, which
   * does not reliably apply — a setter invoked from inside another setter's
   * updater. It went unnoticed for as long as a business only ever had one
   * version, because `current` is 0 either way; the moment a second landed, the
   * panel kept rendering the first. Keyed on the count rather than the array so
   * that stepping back through versions by hand is not undone on every render.
   */
  useEffect(() => {
    if (versions.length > 0) setCurrent(versions.length - 1)
  }, [versions.length])

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
    superseded,
    rerunReport,
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
