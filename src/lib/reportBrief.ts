import { orderByTiers } from '../components/AnalysisPanel'
import { formationCardSummary, formationCardTitle } from '../components/FormationCard'
import { cardRows, cardSentence, reportSections } from '../components/ReportBody'
import { FORMATION_CARD_INSIGHTS } from './identitySections'
import type { AreaSummary } from './areaSummaries'
import type { BusinessRecord, Derived } from './deriveResults'
import type { GroupId } from './groups'
import type { BandId, IdentityScore, ScoreArea } from './identityScore'
import { REPORT_CARDS, cardAnchor, cardFor } from './reportCards'
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
  /** The report's lede: its one-sentence answer (`headline`), which the
   *  report page does not print. The opening message leads with it. */
  lede?: string
  /**
   * The recommendation — always a call the customer can act on, never
   * "Needs Review": approve, reject, or request what the record is short of
   * from the applicant. Its word, the number and why, the score itself for
   * the ring, and the report's follow-ups as the steps.
   */
  determination?: {
    kind: RecommendationKind
    /** What Accept writes, for an approve or a reject. */
    status: ReviewStatus
    label: string
    value: number
    reason?: string
    score: IdentityScore
    /** The report's follow-ups, most pressing first: the instruction, and why. */
    steps: Array<{ instruction: string; why?: string; cites?: string[] }>
  }
  /** One per assessment, in the report's order. */
  cards: BriefCard[]
}

/**
 * An assessment, as the opening message says it: its name, its sentence, the
 * insights it carries (`cites`) and the report cards those reach (`cards`,
 * in the report's order). `anchor` is the first of those cards on the page.
 */
export type BriefCard = { id: string; anchor: string; title: string; sentence?: string; cites: string[]; cards: string[] }

/** The assessment the report is narrowed to: which, and the cards to show. */
export type ReportFocus = { id: string; title: string; sentence?: string; cards: string[] }

export type RecommendationKind = 'approve' | 'reject' | 'request'

/**
 * The band, as a call. The middle band is not "Needs Review" — the reviewer
 * is already reviewing — but what would settle it: the information the record
 * is short of, requested from the applicant.
 */
export const KIND_OF_BAND: Record<BandId, RecommendationKind> = {
  established: 'approve',
  not_established: 'reject',
  conditions: 'request'
}

/** A call in a word or two, for under the score. */
export const KIND_SHORT: Record<RecommendationKind, string> = {
  approve: 'Approve',
  reject: 'Reject',
  request: 'Request information'
}

/** A call, as the recommendation is titled. */
export const KIND_WORD: Record<RecommendationKind, string> = {
  approve: 'Approve',
  reject: 'Reject',
  request: 'Request information from the applicant'
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
  const onFormation = new Set<string>(FORMATION_CARD_INSIGHTS)
  const sections = reportSections(orderByTiers(version.policy ?? policy, tiers), version.result)
  // The report cards a set of citations reaches, in the report's order.
  const cardsOf = (cites: string[]) => {
    const reached = new Set(cites.map((i) => cardFor(i, groupFor)))
    return REPORT_CARDS.filter((c) => reached.has(c.id)).map((c) => c.id)
  }
  // The filing checks: what the Names, Formation, Registrations and Tax ID
  // cards state. The website's name check is the Website card's, not these.
  const formationCites = results
    .filter(
      (r) =>
        !r.notReported &&
        r.state !== 'unknown' &&
        onFormation.has(r.insightId.split(':')[0]) &&
        cardFor(r.insightId, groupFor) !== 'website'
    )
    .map((r) => r.insightId)
  const formationCards = cardsOf(formationCites)
  const headline = 'headline' in version.result ? (version.result as { headline?: string }).headline?.trim() : undefined
  return {
    lede: headline || undefined,
    determination: score
      ? {
          // The assessment's own call, which the reviewer accepts or not; the
          // page header's control says where the review stands.
          kind: KIND_OF_BAND[score.band.id],
          status: statusForBand(score.band.id),
          label: KIND_WORD[KIND_OF_BAND[score.band.id]],
          value: score.value,
          reason: scoreLine(score, scoreAreas, { record, results }),
          score,
          // Each follow-up is the instruction, then the facts behind it. An
          // Approve has none: a call with something still to get is not an
          // approval, so whatever follow-ups the report wrote are not its steps.
          steps: (KIND_OF_BAND[score.band.id] === 'approve'
            ? []
            : 'followUps' in version.result
              ? ((version.result as { followUps?: Array<{ text: string; cites?: string[] }> }).followUps ?? [])
              : [])
            .map((f) => {
              const [instruction, ...why] = f.text.split('\n')
              return { instruction: instruction.trim(), why: why.join(' ').trim() || undefined, cites: f.cites }
            })
            .filter((x) => x.instruction)
        }
      : undefined,
    cards: [
      {
        id: 'formation',
        anchor: cardAnchor(formationCards[0] ?? 'formation'),
        title: formationCardTitle(record, results, groupFor),
        sentence: formationCardSummary(record, results, groupFor),
        // The filing checks — the Names, Formation, Registrations and Tax ID cards'.
        cites: formationCites,
        cards: formationCards
      },
      ...sections.map(({ id, heading, section }) => {
        // What the assessment carries, less the filing checks — those are the
        // Formation card's and the Names, Registrations and Tax ID cards'.
        const cites = cardRows(section, results)
          .map((r) => r.insightId)
          .filter((i) => !onFormation.has(i.split(':')[0]))
        // The cards its citations reach, in the report's order; the block
        // lands on the first — the data most of the assessment rests on.
        const cards = cardsOf(cites)
        return {
          id,
          anchor: cardAnchor(cards[0] ?? 'name'),
          // What the area found, as its name — the block's own header.
          title: summaries.get(id)?.headline ?? heading,
          sentence: cardSentence(section, summaries.get(id)?.summary),
          cites,
          cards
        }
      })
    ]
  }
}
