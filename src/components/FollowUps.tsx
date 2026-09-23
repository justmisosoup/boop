import { Text } from '@/core'

import type { AnalysisResult } from '../types'
import { cn } from '../utils/twUtils'
import { AttributeGrid, cell } from './AttributeGrid'

/**
 * The follow-ups, in priority order.
 *
 * A numbered list would imply a sequence that has to be worked through in order;
 * these are independent items that merely happen to be ranked, so they are
 * bulleted and the ranking is carried by the order alone.
 */
export const FollowUps = ({
  items,
  className
}: {
  items: NonNullable<AnalysisResult['followUps']>
  className?: string
}) => (
  /*
   * No citations here.
   *
   * A follow-up is an instruction, and the finding behind it has already been
   * made and evidenced in the assessment above. Repeating the evidence on the
   * action attached it to a sentence that is not claiming anything.
   */
  /*
   * Bulleted, now that they are the section.
   *
   * They were set flush and unbulleted while they sat under a paragraph of
   * prose, where a disc and an indent made them read as its footnotes. With the
   * prose gone there is nothing for them to hang off: the marker is what says
   * this is a list of separate things to do rather than one long instruction.
   */
  <ul className={cn('list-disc space-y-3 pl-5', className ?? 'mt-3')}>
    {items.map((f) => (
      <li key={f.text} className="pl-1">
        {/* The instruction, then why. The workflow writes each step as one
            sentence to act on and one or two behind it, and setting all of it
            bold made three lines shout where one should. The first sentence
            carries the weight; the reason reads at body weight under it. */}
        {(() => {
          const [, instruction, why] = f.text.match(/^(.*?[.!?])(?:\s+([\s\S]*))?$/) ?? [null, f.text, '']
          return (
            <Text>
              <span className="font-semibold">{instruction}</span>
              {why ? <> {why}</> : null}
            </Text>
          )
        })()}
        {/* The things the step acts on, named. A step that says "establish who
            is behind the connected businesses" is not actionable until the
            businesses are on screen. */}
        {f.entities && f.entities.length > 0 && (
          <AttributeGrid
            className="mt-2"
            items={f.entities.map((e) => cell(undefined, e.name, { key: e.name, note: e.note }))}
          />
        )}
      </li>
    ))}
  </ul>
)
