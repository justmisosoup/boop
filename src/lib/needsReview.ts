import type { AnalysisDraft, AnalysisResult, AssessmentSection } from '../types'
import type { AreaSummary } from './areaSummaries'
import type { BusinessRecord, Derived } from './deriveResults'
import type { GroupId } from './groups'
import { FORMATION_CARD_INSIGHTS, IDENTITY_SECTIONS } from './identitySections'
import type { IdentityScore } from './identityScore'
import { splitFlags } from './scoreReasons'

/**
 * One thing on a card that needs a look: an insight the assessment flagged, or
 * a question the assessment left open.
 */
export type AttentionItem =
  | { kind: 'flag'; result: Derived }
  | { kind: 'gap'; gap: NonNullable<AssessmentSection['gaps']>[number] }

/** One report card with something to review, named as its header reads. */
export type ReviewCard = {
  key: string
  title: string
  /** The assessment the card belongs to, as the policy names it. The
   *  Formation card is the record's, not an assessment's. */
  group: string
  /** The rendered card's element id, to scroll to. */
  anchorId: string
  /** Rows the assessment flagged on it. */
  flagged: number
  /** What needs the look, in the order the card shows it. */
  items: AttentionItem[]
}

/** A question an assessment left genuinely open — the ones the score holds
 *  an assessment for. A gap nobody will act on, or one the state does not
 *  publish, is not an item. */
export const isOpenQuestion = (g: NonNullable<AssessmentSection['gaps']>[number]) =>
  !g.noAction && (g.why === 'not_held_or_unreachable' || g.why === 'no_insight_covers_it')

/**
 * What a section cites, resolved the way `ReportBody` resolves it: a check
 * that never ran is dropped, two checks reaching one sentence are one row,
 * and the Formation card's rows are the card's, not the section's.
 */
export const citedRows = (section: AssessmentSection, results: Derived[]): Derived[] => {
  const onFormation = new Set<string>(FORMATION_CARD_INSIGHTS)
  const ids = [
    ...section.body.flatMap((b) => b.cites ?? []),
    ...(section.gaps ?? []).filter((g) => !g.noAction).flatMap((g) => g.cites ?? [])
  ]
  const seen = new Set<string>()
  return ids
    .map((id) => results.find((r) => r.insightId === id))
    .filter((r): r is Derived => Boolean(r) && !r!.notReported)
    .filter((r) => !seen.has(r.statement) && seen.add(r.statement))
    .filter((r) => !onFormation.has(r.insightId.split(':')[0]))
}

/**
 * An assessment's numbers, as its section shows them: rows cited, rows the
 * section marks as flagged (`ReportBody`'s rule — adverse, or read against
 * the identity by the score), and questions left open. Counted from the same
 * rows the section draws, so a tile and its card can never disagree.
 */
export const assessmentStats = (
  section: AssessmentSection,
  results: Derived[],
  negatives: ReadonlySet<string>
): { cited: number; flagged: number; open: number } => {
  const rows = citedRows(section, results)
  return {
    cited: rows.length,
    flagged: rows.filter((r) => r.reason === 'should_exist_not_found' || negatives.has(r.insightId)).length,
    open: (section.gaps ?? []).filter(isOpenQuestion).length
  }
}

/** The Formation card's own element id (`FormationCard`). */
export const FORMATION_CARD_ID = 'formation-card'
/** An Identity part card's element id (`ReportBody`'s parts). */
export const partAnchor = (sectionId: string, part: number) => `section-${sectionId}-${part}`

/** The section the Identity parts split — the one `ReportBody` splits. */
const IDENTITY_ID = 'skill-kyb-identification'

/**
 * What the determination already says. A fact that capped the score is the
 * determination card's one sentence — "The domestic registration in New York
 * is inactive. That alone rules out approval." — so the rows that state the
 * same fact are not listed again as needing review under it.
 */
const CEILING_STATES: Record<string, RegExp> = {
  filing_not_active: /^sos_/,
  filing_standing_review: /^sos_/,
  name_not_found: /name|dba/i,
  name_needs_review: /name|dba/i,
  tin_mismatch: /tin/i,
  watchlist_hit: /watchlist|sanction|ofac/i,
  adverse_media_match: /adverse/i,
  pep_match: /pep|politically/i,
  bankruptcy: /bankrupt/i,
  liens_high_risk: /lien/i
}

/**
 * The report's cards that need attention, in the report's own order, each
 * titled exactly as its header reads on the page.
 *
 * Derived from what THIS report surfaced — the cited insights it flagged —
 * never from a checklist over the record. The fact that capped the score is
 * the determination's sentence, directly above, and is not repeated here. A report composed differently, or with
 * nothing flagged, lists different cards or none. Registry silence (a state
 * that publishes no status) is not a finding and is not counted.
 */
export const cardsNeedingReview = ({
  score,
  result,
  results,
  record,
  summaries,
  policy,
  groupFor,
  formationTitle
}: {
  score: IdentityScore | null
  result: AnalysisResult | AnalysisDraft
  results: Derived[]
  record: BusinessRecord
  summaries: ReadonlyMap<string, AreaSummary>
  /** The areas in the order the report lays them out. */
  policy: Array<{ id: string; name: string }>
  groupFor: (insightId: string) => GroupId
  /** The Formation card's header, as `FormationCard` titles it. */
  formationTitle: string
}): ReviewCard[] => {
  const { relevant } = splitFlags(record, results)
  const relevantIds = new Set(relevant.map((r) => r.insightId))
  const stated = (score?.ceilings ?? []).map((c) => CEILING_STATES[c.id]).filter((re): re is RegExp => Boolean(re))
  const isFlagged = (r: Derived) =>
    (r.reason === 'should_exist_not_found' || relevantIds.has(r.insightId)) && !stated.some((re) => re.test(r.insightId))
  const keyOf = (r: Derived) => r.insightId.split(':')[0]
  const onFormation = new Set<string>(FORMATION_CARD_INSIGHTS)

  const cards: ReviewCard[] = []
  const flagsOf = (rows: Derived[]): AttentionItem[] =>
    rows.filter(isFlagged).map((result) => ({ kind: 'flag', result }))

  // The Formation card: the record's filings, whatever section cited them.
  const formationRows = results.filter((r) => onFormation.has(keyOf(r)) && r.state !== 'unknown' && !r.notReported)
  const formationFlags = flagsOf(formationRows)
  cards.push({
    key: 'formation',
    title: formationTitle,
    group: 'Formation',
    anchorId: FORMATION_CARD_ID,
    flagged: formationFlags.length,
    items: formationFlags
  })

  const citedOf = (section: AssessmentSection) => citedRows(section, results)

  const byId = new Map(result.sections.map((s) => [s.id, s]))
  for (const { id, name } of policy) {
    const section = byId.get(id)
    if (!section) continue
    const cited = citedOf(section)
    // The assessment's open questions ride on its card — on the first part,
    // for an assessment drawn in parts, which is where the section's own
    // sentences lead.
    const open: AttentionItem[] = (section.gaps ?? []).filter(isOpenQuestion).map((gap) => ({ kind: 'gap', gap }))

    if (id === IDENTITY_ID) {
      // One card per part, as the page draws them.
      const sectionOf = (r: Derived) =>
        IDENTITY_SECTIONS.find((s) => s.insights?.includes(keyOf(r)) || s.groups.includes(groupFor(r.insightId)))
      const parts = [
        ...IDENTITY_SECTIONS.map((s, i) => ({
          i,
          title: s.headline(record),
          rows: cited.filter((r) => sectionOf(r) === s && !s.stated?.(record).includes(keyOf(r)))
        })),
        { i: IDENTITY_SECTIONS.length, title: 'Other', rows: cited.filter((r) => !sectionOf(r)) }
      ].filter((p) => p.rows.length > 0)
      parts.forEach((p, n) => {
        const flags = flagsOf(p.rows)
        cards.push({
          key: `${id}:${p.i}`,
          title: p.title,
          group: name,
          anchorId: partAnchor(id, p.i),
          flagged: flags.length,
          items: [...flags, ...(n === 0 ? open : [])]
        })
      })
      // An assessment with open questions but no cited part still has them.
      if (parts.length === 0 && open.length > 0)
        cards.push({ key: id, title: name, group: name, anchorId: `section-${id}`, flagged: 0, items: open })
      continue
    }

    const flags = flagsOf(cited)
    cards.push({
      key: id,
      title: summaries.get(id)?.headline ?? name,
      group: name,
      anchorId: `section-${id}`,
      flagged: flags.length,
      items: [...flags, ...open]
    })
  }

  return cards.filter((c) => c.items.length > 0)
}
