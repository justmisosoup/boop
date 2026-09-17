import { useCallback, useEffect, useRef, useState } from 'react'

import type { AnalysisDraft, AnalysisResult } from '../types'
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
  /** The assessments it ran through, so the settled turn lists them too. */
  policy?: string[]
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
  'Work the stages an onboarding file is built from, in this order: customer ' +
  'identification, whether a legally registered entity exists, is active, and is the ' +
  'applicant; beneficial ownership and control, including what can only come from the ' +
  'customer; the nature and purpose of the account, meaning whether the business is ' +
  'actually operating and what is expected to flow through it; sanctions, PEP and ' +
  'watchlist screening; and adverse information and financial standing. ' +
  'Then recommend whether to onboard, and name the steps that complete the case file.'

export const useAnalysis = (
  record: BusinessRecord,
  results: Derived[],
  /** The standing assessment workflow. Editable, so it is passed in rather
   *  than read from the constant — see useWorkflow. */
  workflow: string = KYB_BRIEF,
  /** False while the saved workflow is still being read from disk. The first
   *  report must not be queued against the shipped default and then be wrong
   *  the moment the edited one arrives. */
  workflowReady = true
) => {
  const [versions, setVersions] = useState<AnalysisVersion[]>([])
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
    policy?: string[]
    kind: 'report' | 'question'
    pinnedIds: string[]
    startedAt: number
  } | null>(null)
  const slowTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  /** A run nobody answers stops waiting rather than spinning for the session. */
  const giveUpTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const waiting = pending !== null

  // A different business is a different analysis.
  useEffect(() => {
    setVersions([])
    setSuperseded([])
    setCurrent(0)
    setPinned([])
    setError(null)
    setPending(null)
    setSlow(false)
    setDraft(null)
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
      setError('This run was not answered. Send it again to retry.')
    }, 600_000)

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
      if ('pending' in data) {
        setAcknowledged(true)
        return
      }

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
      /** The assessments inside the one being run, in order. */
      policy?: string[]
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
          setPending({
            id,
            recordId: record.id,
            asked,
            skills,
            typed,
            policy,
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
