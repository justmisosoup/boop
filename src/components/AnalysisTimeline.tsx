import { ChatMarker, MutedText, Text } from '@/core'

import type { Report } from '../lib/useAnalysis'

const when = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * What has been run against this business, and when.
 *
 * Off the reports already on the page — each run, and each question asked of
 * it — rather than a log of its own. Nothing here is new data: it is the same
 * thread the picker switches between, read as a sequence instead of as a
 * selection, which is the question "what has happened to this file" rather than
 * "what does this report say".
 */
export const AnalysisTimeline = ({
  reports,
  selectedId,
  onSelect
}: {
  reports: Report[]
  selectedId?: string | null
  onSelect?: (id: string) => void
}) => {
  if (reports.length === 0)
    return (
      <MutedText className="px-1 text-caption">
        Nothing has been run against this business yet.
      </MutedText>
    )

  // Newest first: the last thing that happened is the thing being asked about.
  const ordered = [...reports].reverse()

  return (
    <div className="space-y-6">
      {ordered.map((r) => (
        <div key={r.id} className="space-y-2">
          <ChatMarker>{when(r.at)}</ChatMarker>

          <button
            type="button"
            onClick={onSelect ? () => onSelect(r.id) : undefined}
            className="block w-full rounded-control px-2 py-1.5 text-left transition-colors hover:bg-[var(--core-color-state-hover-bg)]"
          >
            <Text size="sm" className="font-semibold">
              {r.name}
            </Text>
            <MutedText className="block text-caption">
              {r.id === selectedId ? 'Showing now' : 'Report'}
              {r.questions.length > 0 &&
                ` · ${r.questions.length} question${r.questions.length === 1 ? '' : 's'}`}
            </MutedText>
          </button>

          {r.questions.map((q) => (
            <div key={q.id} className="border-l border-solid border-border pl-3">
              <MutedText className="block text-caption">{when(q.at)}</MutedText>
              <Text size="sm" className="line-clamp-2">
                {q.typed || 'A follow-up question'}
              </Text>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
