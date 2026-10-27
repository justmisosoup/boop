import type { AssessmentRead } from './assessments'

/** About two lines of the card at its small size. */
const BUDGET = 110

/** The card's headline, kept concise: the summary's first sentence cut at its
 *  first clause (a semicolon or a dash), then whole sentences after it while
 *  they fit the card's two lines — so a summary of short findings isn't left
 *  at one of them. */
export const headlineOf = (read: AssessmentRead) => {
  const [first, ...rest] = read.summary?.text.split(/(?<=[.!?])\s+/) ?? []
  if (!first) return undefined
  let headline = `${first.split(/\s*(?:;|\s[—–]\s)\s*/)[0].replace(/[.!?,:\s]+$/, '')}.`
  for (const next of rest) {
    if (headline.length + 1 + next.length > BUDGET) break
    headline = `${headline} ${next}`
  }
  return headline
}
