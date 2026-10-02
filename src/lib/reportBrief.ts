import { orderByTiers } from '../components/AnalysisPanel'
import { formationCardSummary, formationCardTitle } from '../components/FormationCard'
import { cardSentence, reportSections } from '../components/ReportBody'
import type { AreaSummary } from './areaSummaries'
import type { BusinessRecord, Derived } from './deriveResults'
import type { GroupId } from './groups'
import type { IdentityScore, ScoreArea } from './identityScore'
import { FORMATION_CARD_ID } from './needsReview'
import { statusForBand, type ReviewStatus } from './review'
import { scoreLine } from './scoreReasons'
import type { Report } from './useAnalysis'

/**
 * The report, as the Assistant's opening message.
 *
 * What a reviewer reads first on the page — the determination, then each
 * card's title and sentence — said again where the conversation starts, so
 * nobody has to ask for a summary of a report that already has one. Built
 * from the same functions the page draws with, never written by the model:
 * the two cannot say different things.
 */
export type ReportBrief = {
  /** The recommendation: the status the score implies, its word, the number
   *  and why — and the score itself, for the ring. */
  determination?: { status: ReviewStatus; label: string; value: number; reason?: string; score: IdentityScore }
  /** In the report's order. `anchor` is the card's element id on the page. */
  cards: Array<{ anchor: string; title: string; sentence?: string }>
}

/** The determination's word, as the status control writes it. */
const STATUS_WORD: Record<ReviewStatus, string> = {
  approved: 'Approved',
  rejected: 'Rejected',
  in_review: 'Needs Review'
}

export const reportBrief = ({
  version,
  record,
  results,
  groupFor,
  score,
  scoreAreas,
  summaries,
  policy,
  tiers
}: {
  version: Pick<Report, 'at' | 'policy' | 'result'> | null | undefined
  record: BusinessRecord
  results: Derived[]
  groupFor: (insightId: string) => GroupId
  score: IdentityScore | null
  scoreAreas: ScoreArea[]
  summaries: ReadonlyMap<string, AreaSummary>
  /** The standing assessments, for a report kept without its own manifest. */
  policy: Array<{ id: string; name: string }>
  tiers?: ReadonlyMap<string, unknown>
}): ReportBrief | undefined => {
  if (!version) return undefined
  const sections = reportSections(orderByTiers(version.policy ?? policy, tiers), version.result)
  return {
    determination: score
      ? {
          // The assessment's own call, which the reviewer accepts or not; the
          // page header's control says where the review stands.
          status: statusForBand(score.band.id),
          label: STATUS_WORD[statusForBand(score.band.id)],
          value: score.value,
          reason: scoreLine(score, scoreAreas, { record, results }),
          score
        }
      : undefined,
    cards: [
      {
        anchor: FORMATION_CARD_ID,
        title: formationCardTitle(record, results, groupFor),
        sentence: formationCardSummary(record, results, groupFor)
      },
      ...sections.map(({ id, heading, section }) => ({
        anchor: `section-${id}`,
        // What the area found, as its name — the card's own header.
        title: summaries.get(id)?.headline ?? heading,
        sentence: cardSentence(section, summaries.get(id)?.summary)
      }))
    ]
  }
}
