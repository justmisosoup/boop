import answerStore from '../../analysis/answers.json'

import type { AnalysisResult } from '../types'

/**
 * The assistant's stored answers to its starter questions.
 *
 * Written once per business by the session, offline, against the report's own
 * snapshot (`scripts/export-questions.ts` → `scripts/build-answers.ts`), and
 * bundled here the way `reports.json` is — so a starter has an answer from the
 * first click, deployed or not, without a dev server behind it. A typed
 * question that is not a starter still goes to the session.
 */
export type StoredAnswer = {
  question: string
  durationMs: number
  at: string
  result: AnalysisResult
}

const RAW = ((answerStore as { answers?: Record<string, Record<string, StoredAnswer>> }).answers ?? {}) as Record<
  string,
  Record<string, StoredAnswer>
>

/** The same key the report store uses. */
const reportKey = (name: string) => name.toLowerCase().replace(/\s+/g, ' ').trim()

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

/** The stored answer to `question` for the business, if it is a starter that
 *  was answered — matched on the question's text, not its id, so a starter
 *  typed by hand is served too. */
export const heldAnswerFor = (name: string, question: string): StoredAnswer | null => {
  const set = RAW[reportKey(name)]
  if (!set) return null
  const wanted = norm(question)
  return Object.values(set).find((a) => norm(a.question) === wanted) ?? null
}
