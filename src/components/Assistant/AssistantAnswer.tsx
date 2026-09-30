import { useMemo } from 'react'

import { ChatSourceChip, ChatSources, MutedText } from '@/core'

import type { BusinessRecord, Derived } from '../../lib/deriveResults'
import type { GroupId } from '../../lib/groups'
import type { AnalysisResult } from '../../types'
import { Para } from '../ReportBody'
import { evidenceFor } from './evidence'

/**
 * An answer, as prose.
 *
 * Kha's grammar: the paragraphs the session wrote, each ending in a chip per
 * category of evidence it cited, and the roll-up of everything it read at the
 * foot. The report keeps its own grammar — insight cards under each section —
 * because a report is read as a document; a conversation is read as talk, and
 * a paragraph followed by a stack of cards broke every answer into blocks.
 *
 * No headline. It is one sentence summarising the paragraphs, and printed over
 * them it said everything twice — the first paragraph is where the direct
 * answer goes (`analysis/README.md`). Still written and validated: it is what
 * records the answer in one line for anything that lists conversations.
 */
export const AssistantAnswer = ({
  result,
  results,
  record,
  groupFor,
  onJumpToGroup
}: {
  result: AnalysisResult
  results: Derived[]
  record: BusinessRecord
  groupFor: (insightId: string) => GroupId
  onJumpToGroup?: (groupId: string, insightIds: string[]) => void
}) => {
  const paragraphs = useMemo(
    () =>
      result.sections
        // A question is answered in one section; a report's sections, should
        // one ever land here, read in their own order.
        .filter((s) => s.id !== 'recommendation')
        .flatMap((s) => s.body),
    [result.sections]
  )

  return (
    <div className="flex flex-col gap-3">
      {paragraphs.map((p, i) => {
        const { sources } = evidenceFor(p.cites, results, groupFor, onJumpToGroup)
        return (
          <Para key={i} results={results} record={record} inline>
            {p.text}
            {sources.length > 0 && (
              // Chips run on from the sentence: a claim and where it comes
              // from are one line of thought, not a paragraph and a footer.
              <span className="ml-1 inline-flex flex-wrap gap-1 align-baseline">
                {sources.map((s) => (
                  <ChatSourceChip key={s.id} sources={[s]} />
                ))}
              </span>
            )}
          </Para>
        )
      })}
    </div>
  )
}

/**
 * Everything the answer read, at its foot.
 *
 * The same categories as the chips, collapsed into Kha's stacked tiles and a
 * count. A cite that matches no row on this record is counted rather than
 * swallowed: a citation that cannot be looked at is the kind of thing this
 * product exists to surface.
 */
export const AnswerSources = ({
  used,
  results,
  groupFor,
  onJumpToGroup
}: {
  used: string[]
  results: Derived[]
  groupFor: (insightId: string) => GroupId
  onJumpToGroup?: (groupId: string, insightIds: string[]) => void
}) => {
  const { sources, missing } = useMemo(
    () => evidenceFor(used, results, groupFor, onJumpToGroup),
    [used, results, groupFor, onJumpToGroup]
  )
  if (sources.length === 0 && missing === 0) return null
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {sources.length > 0 && <ChatSources label="Sources" sources={sources} />}
      {missing > 0 && (
        <MutedText className="text-caption">
          {missing} cited insight{missing === 1 ? '' : 's'} not found on this record
        </MutedText>
      )}
    </div>
  )
}
