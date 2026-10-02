import type { AreaSummary } from '../lib/areaSummaries'
import type { BusinessRecord, Derived } from '../lib/deriveResults'
import type { AssessmentWeight } from '../lib/identityScore'
import type { AnalysisVersion } from '../lib/useAnalysis'
import type { AnalysisDraft } from '../types'
import { ReportBody } from './ReportBody'

/**
 * A stored report's areas in the assessment's current order — the agent's,
 * which `tiers` is keyed in — not the order the report happened to run them
 * in. Areas the agent no longer lists keep their place at the end. The report
 * is laid out in this order, and the Assistant's opening message reads it.
 */
export const orderByTiers = <T extends { id: string }>(policy: ReadonlyArray<T>, tiers?: ReadonlyMap<string, unknown>): T[] => {
  const order = [...(tiers?.keys() ?? [])]
  const at = (id: string) => {
    const i = order.indexOf(id)
    return i < 0 ? 99 : i
  }
  return [...policy].sort((a, b) => at(a.id) - at(b.id))
}

/**
 * The report, as a document.
 *
 * It used to be a chat message — an assistant bubble with a sources roll-up in
 * its footer, one per turn, with every typed question stacked underneath it in
 * the same column. The conversation has its own panel now (`Assistant/AssistantPanel`), so
 * what is left here is the thing itself: one standing report, laid out as a
 * report. A bubble around it would be an affordance for a conversation that is
 * no longer happening in this column.
 *
 * It takes the report turn alone. The questions asked of it belong to the chat,
 * and they render through the same `ReportBody` from there.
 */
export const AnalysisPanel = ({
  version,
  draft,
  waiting,
  policy,
  results,
  record,
  negatives,
  tiers,
  summaries,
  revealed,
  onJumpToSource
}: {
  /** The report turn, or null before one has been run. */
  version: AnalysisVersion | null
  /** Insight ids an assistant citation has just led to: their rows open. */
  revealed?: ReadonlySet<string>
  /** Stage one, on screen while the verdict is still being written. */
  draft: AnalysisDraft | null
  /** A REPORT is in flight. A typed question does not put this column to work. */
  waiting: boolean
  /** The assessments inside the run in flight, for the draft's layout. */
  policy: Array<{ id: string; name: string }>
  results: Derived[]
  /** The record itself, so a cited check can show the value behind it. */
  record?: BusinessRecord
  /** Insight ids the assessment score read as a point against the identity —
   *  marked where they are argued. See `negativesFor`. */
  negatives?: ReadonlySet<string>
  /** Each area's weight in the assessment, for its card's header. */
  tiers?: ReadonlyMap<string, AssessmentWeight>
  /** What each area asks, for the head of its card. */
  summaries?: ReadonlyMap<string, AreaSummary>
  /** Follow an evidence chip on a cited insight to that source's card, the way
   *  the Insights tab does. */
  onJumpToSource?: (cardId: string) => void
}) => {
  if (!version && !(waiting && draft)) return null

  return (
    <div>
      {version && (
        <ReportBody
          result={version.result}
          results={results}
          record={record}
          /* Laid out in the assessment's current order — the agent's, which
             `tiers` is keyed in — not the order a stored report happened to
             run its areas in. Areas the agent no longer lists keep their
             place at the end. */
          policy={orderByTiers(version.policy ?? [], tiers)}
          negatives={negatives}
          summaries={summaries}
          revealed={revealed}
          onJumpToSource={onJumpToSource}
        />
      )}

      {/* The assessments, already written, while the verdict is not. This is
          the whole point of two stages: the reader watches the argument land
          before the conclusion it supports. Nothing announces the run here —
          the contents rail carries its state, and saying so twice put a
          "Running assessment" block in the column meant for the report. */}
      {waiting && draft && (
        <div aria-busy="true">
          <ReportBody
            result={draft}
            results={results}
            record={record}
            policy={policy}
            negatives={negatives}
            onJumpToSource={onJumpToSource}
          />
        </div>
      )}

    </div>
  )
}
