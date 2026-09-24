import type { BusinessRecord, Derived } from './deriveResults'
import { negativesFor, type IdentityScore, type ScoreArea } from './identityScore'
import { STATUS_NOT_PUBLISHED, stateName } from './states'

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

/** Filing-status flags. In a state that does not publish status, an Unknown is
 *  the registry's silence, not a fact about the business. */
const SOS_STATUS = new Set(['sos_domestic', 'sos_unknown'])

/** The flags a reviewer has to weigh, and the ones that only describe the
 *  registry — named so the line can say why they were left out. */
const splitFlags = (record: BusinessRecord, results: Derived[]) => {
  const negative = negativesFor(record, results)
  const silent = STATUS_NOT_PUBLISHED.has(record.formation?.state ?? '')
  const flags = results.filter((r) => negative.has(r.insightId))
  const registry = flags.filter((r) => silent && SOS_STATUS.has(r.insightId))
  return { relevant: flags.filter((r) => !registry.includes(r)), registry }
}

const clause = (s: string) => s.replace(/\.$/, '')

/** The one sentence the card says under the band. */
export const scoreLine = (
  score: IdentityScore,
  areas: ScoreArea[] = [],
  evidence?: { record: BusinessRecord; results: Derived[] }
): string => {
  const cap = score.ceilings[0]
  if (cap)
    return `${cap.plain} ${
      score.band.id === 'not_established' ? 'That alone rules out approval.' : 'It has to be resolved before approval.'
    }`
  const held = heldArea(score, areas)
  if (held) return `${held.name} left a question open. ${held.openQuestions?.[0] ?? ''}`.trim()
  if (score.findings > 0 && evidence) {
    const { relevant, registry } = splitFlags(evidence.record, evidence.results)
    if (relevant.length > 0) {
      const named = relevant.slice(0, 2).map((r) => clause(r.statement))
      const more = relevant.length > 2 ? `, and ${relevant.length - 2} more` : ''
      return `${named.join('; ')}${more}. Confirm before approving; none of it rules the business out.`
    }
    if (registry.length > 0)
      return `Nothing flagged bears on the decision. The filing-status gaps are ${stateName(
        evidence.record.formation?.state
      )} not publishing status, not a signal about the business.`
  }
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
