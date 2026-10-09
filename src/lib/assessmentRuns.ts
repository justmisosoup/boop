import { useSyncExternalStore } from 'react'

/**
 * The next steps an analyst has run on an assessment, kept per business and
 * assessment. Running a step reveals what is already on the record — checks
 * the assessment didn't read, documents the state publishes — so a run is all
 * there is to keep: which step, when, and what it found.
 *
 * A prototype store in localStorage, the same shape of store as
 * `savedWorkflows.ts`. Read by the assessment's scope (`assessments.ts`), the
 * report's documents card, Activity, and the Assistant's next steps.
 */

export type DocNeed = 'aoi' | 'cogs'

export type StepRun = {
  stepId: string
  /** The step's label and why when it ran: a ran step reads as it did then,
   *  not as the widened scope would word it now. */
  label: string
  why?: string
  at: string
  /** Insight keys the step added to the assessment. */
  adds?: string[]
  /** A documents step: what it found, by document id, and what it could not. */
  found?: string[]
  missing?: DocNeed[]
  /** A request: sent to the applicant, or documents the analyst uploaded. */
  requested?: { email: string; message: string }
  /** Documents added to the report: their kept file's id, the name they had,
   *  and who provided them — the analyst's upload, or the applicant's reply. */
  uploads?: Array<{ id: string; name: string; from?: 'analyst' | 'applicant' }>
}

type Runs = Record<string, StepRun[]>

const KEY = 'prototype:assessment-runs'
const keyOf = (businessId: string, assessmentId: string) => `${businessId}/${assessmentId}`

let cache: Runs | null = null
const listeners = new Set<() => void>()

const read = (): Runs => {
  if (cache) return cache
  try {
    cache = JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as Runs
  } catch {
    cache = {}
  }
  return cache
}

const write = (next: Runs) => {
  cache = next
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* kept for this session only */
  }
  listeners.forEach((l) => l())
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export const runsFor = (businessId: string, assessmentId: string): StepRun[] =>
  read()[keyOf(businessId, assessmentId)] ?? []

/** Every run on a business, by assessment id. */
export const runsOnBusiness = (businessId: string): Record<string, StepRun[]> =>
  Object.fromEntries(
    Object.entries(read())
      .filter(([k]) => k.startsWith(`${businessId}/`))
      .map(([k, v]) => [k.slice(businessId.length + 1), v])
  )

/** The insight keys runs have added to an assessment. */
export const addedKeys = (businessId: string, assessmentId: string) =>
  runsFor(businessId, assessmentId).flatMap((r) => r.adds ?? [])

export const recordRun = (businessId: string, assessmentId: string, run: StepRun) => {
  const all = read()
  const k = keyOf(businessId, assessmentId)
  write({ ...all, [k]: [...(all[k] ?? []).filter((r) => r.stepId !== run.stepId), run] })
}

/** Re-render on any run: the scope, the score and the report all follow it. */
export const useAssessmentRuns = () => useSyncExternalStore(subscribe, read, () => ({}) as Runs)

/* ---- Documents held back for a demo ------------------------------------- */

/**
 * Businesses whose Secretary of State documents are held back until the
 * document agent "retrieves" them — so a record that already has them can be
 * walked through as if they were still to be ordered. A demo switch, in this
 * browser only.
 */
const WITHHELD_KEY = 'prototype:withheld-documents'
let withheldCache: string[] | null = null
const readWithheld = (): string[] => {
  if (withheldCache) return withheldCache
  try {
    withheldCache = JSON.parse(window.localStorage.getItem(WITHHELD_KEY) ?? '[]') as string[]
  } catch {
    withheldCache = []
  }
  return withheldCache
}
export const documentsWithheld = (businessId: string) => readWithheld().includes(businessId)
export const withholdDocuments = (businessId: string, on = true) => {
  const next = on ? [...new Set([...readWithheld(), businessId])] : readWithheld().filter((id) => id !== businessId)
  withheldCache = next
  try {
    window.localStorage.setItem(WITHHELD_KEY, JSON.stringify(next))
  } catch {
    /* this session only */
  }
  listeners.forEach((l) => l())
}
