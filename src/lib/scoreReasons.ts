import type { IdentityScore, ScoreArea } from './identityScore'

/**
 * Why the number is what it is, in a reviewer's words.
 *
 * The score model knows which fact capped it, which question holds an area
 * for review and how many insights it flagged. It used to say so in its own
 * terms — "capped at 49 from a weighted 90" — which told a reviewer nothing
 * they could act on. These say the fact, then what it means for the call.
 */

/** A hold caps an AREA at the top of Review; the whole can still clear 90 on
 *  the others, and saying "held" over an Approve contradicts the band. */
const heldArea = (score: IdentityScore, areas: ScoreArea[]) =>
  score.band.id !== 'established' ? areas.find((a) => (a.openQuestions?.length ?? 0) > 0) : undefined

/** The one sentence the card says under the band. */
export const scoreLine = (score: IdentityScore, areas: ScoreArea[] = []): string => {
  const cap = score.ceilings[0]
  if (cap)
    return `${cap.plain} ${
      score.band.id === 'not_established' ? 'That alone rules out approval.' : 'It has to be resolved before approval.'
    }`
  const held = heldArea(score, areas)
  if (held) return `${held.name} left a question open. ${held.openQuestions?.[0] ?? ''}`.trim()
  if (score.findings > 0)
    return `${score.findings} ${score.findings === 1 ? 'insight was' : 'insights were'} flagged by the assessment. No single fact rules it out.`
  return 'Nothing flagged. Every insight the assessment cited stands.'
}

/** The clause for a list cell: the fact, without the consequence. */
export const scoreSummary = (score: IdentityScore, areas: ScoreArea[] = []): string => {
  const cap = score.ceilings[0]
  if (cap) return cap.plain.replace(/\.$/, '')
  const held = heldArea(score, areas)
  if (held) return `${held.name} left a question open`
  if (score.findings > 0) return `${score.findings} flagged`
  return 'Nothing flagged'
}
