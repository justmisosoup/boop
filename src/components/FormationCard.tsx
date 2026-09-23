import { Surface } from '@/core'

import { formationIdentityRows } from '../lib/attributes'
import type { BusinessRecord } from '../lib/deriveResults'
import { cn } from '../utils/twUtils'
import { AttributeCells } from './AttributeGrid'
import { cellsFromRows } from './attributeCells'
import { CardHeader } from './CardHeader'
import { AttributeSources } from './Provenance'

/**
 * What the state says this business is, under the call.
 *
 * The report used to open with a paragraph about the business — its name in
 * 30px type and a sentence or two of prose. The name is on the fixed bar, and
 * the prose described what the report was about to assess. In its place: the
 * domestic filing's identity facts, in the same cells as every other value on
 * the report.
 *
 * The lead fact spans. The legal name is the identifying fact and the only
 * bold value, so it takes the full row; the facts under it pair up, and an odd
 * count leaves the last one the whole row rather than an orphan half.
 *
 * Cited once, in the header. Every value here is off the one filing, so a chip
 * on every cell said the same thing seven times, and a footnote under the
 * card said it in prose. The header carries the filing's own chip — `SOS · NY`,
 * the same one an attribute row shows — and it follows to the filing's card in
 * Sources the way that one does.
 */
export const FormationCard = ({
  record,
  onJumpToSource,
  className
}: {
  record: BusinessRecord
  /** The header chip opens the domestic filing's card in Sources. */
  onJumpToSource?: (cardId: string) => void
  className?: string
}) => {
  const domestic = record.registrations.find((r) => r.state === record.formation?.state)

  const cells = cellsFromRows(formationIdentityRows(record), {
    domesticState: record.formation?.state,
    onJumpToSource,
    provenance: false,
    // The standing row's "order a certificate" line is a reading of the
    // absence, which is what the note slot is for.
    evidence: true
  })
  if (cells.length === 0) return null

  const [lead, ...rest] = cells
  const items = [
    {
      ...lead,
      span: 'full' as const,
      values: lead.values.map((v) => ({
        ...v,
        value: <span className="font-semibold">{v.value}</span>
      }))
    },
    ...rest
  ]

  return (
    <Surface
      variant="card"
      padding="none"
      className={cn('overflow-hidden', className)}
      aria-label="Formation"
      role="region"
    >
      <CardHeader
        title="Formation"
        trailing={
          domestic && (
            <AttributeSources
              sources={[]}
              registrations={[domestic]}
              domesticState={record.formation?.state}
              onJumpToSource={onJumpToSource}
            />
          )
        }
      />
      <AttributeCells items={items} className="-mb-px" />
    </Surface>
  )
}
