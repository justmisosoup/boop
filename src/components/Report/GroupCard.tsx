import type { ReactNode } from 'react'

import { Surface } from '@/core'

import type { BusinessRecord, Derived } from '../../lib/deriveResults'
import type { GroupId } from '../../lib/groups'
import { cardAnchor } from '../../lib/reportCards'
import { CardHeader } from '../CardHeader'
import { InsightRow } from '../InsightRow'
import { InsightsDisclosure } from '../InsightStack'

/** A group's card id — the same id, where the group is one card. */
export const groupAnchor = (group: GroupId) => cardAnchor(group)

/**
 * One group of the report: the Insights tab's grouping, as a card.
 *
 * The group's name, the data view it is tied to — the grid, the strip — and,
 * at the foot, its review tasks: the group's own insight rows, behind
 * "Insights", flagged rows first. The rows stay mounted when closed, so an
 * assistant citation can land on one. A group with no view and no rows is
 * not a card: a frame around a name is a frame.
 *
 * The view rules itself off at the top — a strip draws its own rule, a grid
 * is wrapped in one — so the header draws none.
 */
export const GroupCard = ({
  id,
  title,
  trailing,
  visual,
  rows,
  record,
  negatives,
  revealed,
  onJumpToSource
}: {
  /** The report card's id (`REPORT_CARDS`). */
  id: string
  title: ReactNode
  /** The identifying tag at the header's edge: the Formation card's filing. */
  trailing?: ReactNode
  /** The group's data view. Absent where the record holds nothing to draw. */
  visual?: ReactNode
  /** The group's insight rows, in the order to show them. */
  rows: Derived[]
  record: BusinessRecord
  /** Insight ids the assessment score read as a point against the identity. */
  negatives?: ReadonlySet<string>
  /** Insight ids a citation has just led to: their rows open. */
  revealed?: ReadonlySet<string>
  onJumpToSource?: (cardId: string) => void
}) => {
  if (!visual && rows.length === 0) return null
  return (
    <Surface
      id={cardAnchor(id)}
      variant="card"
      padding="none"
      className="scroll-mt-6 overflow-hidden"
      role="region"
      aria-label={typeof title === 'string' ? title : undefined}
    >
      <CardHeader title={title} trailing={trailing} className="border-b-0" />
      {visual}
      <InsightsDisclosure
        open={rows.some((r) => revealed?.has(r.insightId))}
        rows={rows.map((r) => (
          <InsightRow
            key={r.insightId}
            result={r}
            record={record}
            negative={negatives?.has(r.insightId)}
            reveal={revealed?.has(r.insightId)}
            onJumpToSource={onJumpToSource}
          />
        ))}
      />
    </Surface>
  )
}
