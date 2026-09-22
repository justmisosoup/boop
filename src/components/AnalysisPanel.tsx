import type { BusinessRecord, Derived } from '../lib/deriveResults'
import type { AnalysisVersion } from '../lib/useAnalysis'
import type { AnalysisDraft } from '../types'
import { AnalysisSources } from './AnalysisSources'
import { ReportBody } from './ReportBody'

/**
 * The report, as a document.
 *
 * It used to be a chat message — an assistant bubble with a sources roll-up in
 * its footer, one per turn, with every typed question stacked underneath it in
 * the same column. The conversation has its own column now (`AnalysisChat`), so
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
  identity,
  score,
  results,
  categories,
  record,
  negatives,
  onJumpToGroup,
  onJumpToSource
}: {
  /** The report turn, or null before one has been run. */
  version: AnalysisVersion | null
  /** Stage one, on screen while the verdict is still being written. */
  draft: AnalysisDraft | null
  /** A REPORT is in flight. A typed question does not put this column to work. */
  waiting: boolean
  /** The assessments inside the run in flight, for the draft's layout. */
  policy: Array<{ id: string; name: string }>
  /** The business identity card, rendered under the recommendations. */
  identity?: React.ReactNode
  /** The assessment score card, under the recommendations. */
  score?: React.ReactNode
  results: Derived[]
  categories: Map<string, string>
  /** The record itself, so a cited check can show the value behind it. */
  record?: BusinessRecord
  /** Insight ids the assessment score read as a point against the identity —
   *  marked where they are argued. See `negativesFor`. */
  negatives?: ReadonlySet<string>
  onJumpToGroup: (groupId: string, insightIds: string[]) => void
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
          identity={identity}
          score={score}
          policy={version.policy ?? []}
          negatives={negatives}
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
            stream
            negatives={negatives}
            onJumpToSource={onJumpToSource}
          />
        </div>
      )}

      {/* What the whole report rested on, at the end of it. It hung off the
          message bubble's footer, which put it level with the report's first
          line and made it read as a header on the conversation. */}
      {version && (
        <AnalysisSources
          className="mt-12 border-t border-solid border-border pt-4"
          used={version.result.used}
          results={results}
          categories={categories}
          onSelect={onJumpToGroup}
        />
      )}
    </div>
  )
}
