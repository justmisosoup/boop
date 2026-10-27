import { ArrowLeft, CircleCheck, Sparkles } from 'lucide-react'

import { ActionButton, Hint, IconActionButton, Surface, Text } from '@/core'

import type { BusinessRecord, Derived } from '../../lib/deriveResults'
import type { ReportBrief } from '../../lib/reportBrief'
import { CardHeader } from '../CardHeader'
import { Para } from '../ReportBody'

/**
 * The assessment, at the head of the report: what the Assistant opens with,
 * on the page. The lede — the report's one-sentence answer — then each
 * area's headline and sentence, in the report's order. The same text the
 * Assistant's opening message carries (`BriefTurn`), without the chat frame
 * or the citation chips. Narrowed to an area from the list beside it, it is
 * that area's text alone, under the area's name — and, where the report left
 * something open in the area, the way to ask the Assistant what to do about
 * it. The steps themselves are not listed here: they are the Assistant's to
 * walk, when asked.
 */
export const AssessmentBrief = ({
  brief,
  cards = brief.cards,
  title = 'Assessment',
  prose,
  results,
  record,
  onRecommend,
  satisfied = false,
  onShowFullReport
}: {
  brief: ReportBrief
  /** The areas to show — the one selected, or all of them. */
  cards?: ReportBrief['cards']
  /** The card's name: the area, where it is narrowed to one. */
  title?: string
  /** The area's answer in one paragraph, in place of its blocks' headlines and sentences. */
  prose?: string
  results: Derived[]
  record: BusinessRecord
  /** Asks the Assistant what to do about this area. Absent, nothing is open in it. */
  onRecommend?: () => void
  /** Narrowed to an area with nothing open in it: the card says it meets the policy. */
  satisfied?: boolean
  /** Narrowed to an area: the way back to the whole report, an arrow beside its name. */
  onShowFullReport?: () => void
}) => {
  // Narrowed to an area, its text alone: the lede is the whole report's.
  const narrowed = cards.length !== brief.cards.length
  const empty = !prose && cards.length === 0 && (narrowed || !brief.lede)
  // Narrowed with nothing to say, the card is still the way back: its name and the arrow.
  if (empty && !onShowFullReport) return null
  return (
    <div className="flex min-w-0 flex-col gap-2">
        <Surface variant="card" padding="none" className="flex min-w-0 flex-col overflow-hidden">
          <CardHeader
            title={
              onShowFullReport ? (
                // The way back to the whole report, beside the area's name.
                <span className="flex items-center gap-1.5">
                  <Hint asChild content="Show full report" side="bottom">
                    <IconActionButton variant="quiet" size="compact" aria-label="Show full report" onClick={onShowFullReport} className="-ml-1.5">
                      <ArrowLeft size={16} aria-hidden="true" />
                    </IconActionButton>
                  </Hint>
                  {title}
                </span>
              ) : (
                title
              )
            }
            className={empty ? 'border-b-0' : undefined}
          />
          {!empty && <div className="flex flex-col gap-4 px-4 py-3">
            {prose && (
              <Para inline className="leading-6 text-foreground" results={results} record={record}>
                {prose}
              </Para>
            )}
            {!prose && !narrowed && brief.lede && (
              <Para inline className="leading-6 text-foreground" results={results} record={record}>
                {brief.lede}
              </Para>
            )}
            {!prose && cards.length > 0 && (
              <dl className="flex flex-col gap-3">
                {cards.map((c) => (
                  <div key={c.id} className="flex flex-col gap-0.5">
                    <dt>
                      <Text className="font-medium">{c.title}</Text>
                    </dt>
                    {c.sentence && (
                      <dd className="m-0">
                        <Para inline className="text-sm leading-5 text-text-secondary" results={results} record={record}>
                          {c.sentence}
                        </Para>
                      </dd>
                    )}
                  </div>
                ))}
              </dl>
            )}
            {/* Under the summary, with the Assistant's sparkle: asking it what
                it will take to resolve what is open here. */}
            {satisfied && !onRecommend && (
              <span className="flex items-center gap-2">
                <CircleCheck size={16} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-[var(--mark-pass)]" />
                <Text className="font-medium">This satisfies your policy.</Text>
              </span>
            )}
            {onRecommend && (
              <div className="flex">
                <ActionButton variant="secondary" size="compact" onClick={onRecommend} leadingIcon={<Sparkles size={14} aria-hidden="true" />}>
                  Recommend next steps
                </ActionButton>
              </div>
            )}
          </div>}
        </Surface>
    </div>
  )
}
