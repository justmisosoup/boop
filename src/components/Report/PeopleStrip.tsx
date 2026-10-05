import { Check, CircleAlert, Landmark } from 'lucide-react'

import { HoverCard, HoverCardContent, HoverCardTrigger, MetaChip } from '@/core'

import { corroborated, filedName, verifiedBy, type AttributeRow } from '../../lib/attributes'
import { SubmittedChip } from '../Provenance'
import { sourceLabel } from '../../lib/sourceLabels'
import { AttributeCells } from '../AttributeGrid'
import { cellsFromRows, type CellContext } from '../attributeCells'
import { Strip } from './Strip'

const icon = { 'aria-hidden': true, size: 12, strokeWidth: 2 } as const
/** The mark before a record's line, as the filing preview draws its own. */
const mark = { 'aria-hidden': true, size: 12, strokeWidth: 1.5, className: 'shrink-0' } as const

/** Every record that names the person: each filing by its state, then the
 *  other registers by name. What `verifiedBy` lists, plus the sources that
 *  name without attesting — a found officer is named by a Form 5500 or a
 *  screening result as much as by a filing. */
const namedBy = (r: AttributeRow): string[] => {
  const filings = (r.registrations ?? []).map((f) => (f.state ? `SOS · ${f.state}` : 'SOS'))
  const others = [...(r.sources ?? []), ...(r.source ? [r.source] : [])]
    .filter((x) => x && x !== 'Submitted' && x !== 'registration')
    .map(sourceLabel)
  return [...new Set([...filings, ...others])]
}

/** Who someone is to the business, as the strip they sit in. */
const KINDS: Array<{ label: string; holds: (row: AttributeRow) => boolean }> = [
  { label: 'Owners', holds: (r) => /owner/i.test(r.label) },
  { label: 'Officers', holds: (r) => r.label === 'Officer' },
  { label: 'Registered agents', holds: (r) => /registered agent/i.test(r.label) && !/owner/i.test(r.label) },
  { label: 'People', holds: (r) => r.label !== 'Officer' && !/registered agent|owner/i.test(r.label) }
]

/**
 * The people on the record as tiles, as the Addresses card draws its places:
 * one strip per kind — officers, registered agents, the people submitted —
 * one chip per person: green with a check where the customer submitted them
 * and a source verifies it, the warning tone where nothing does.
 * Closed until a chip is picked; the picked one opens their cell under the
 * strip — the name, their titles, every source that names them.
 */
export const PeopleStrips = ({ people, ctx }: { people: AttributeRow[]; ctx: CellContext }) => (
  <div>
    {KINDS.map(({ label, holds }) => {
      const rows = people.filter(holds)
      if (rows.length === 0) return null
      const keyOf = (r: AttributeRow, i: number) => `${r.value}-${i}`
      return (
        <Strip
          key={label}
          label={label}
          tiles={rows.map((r, i) => ({
            key: keyOf(r, i),
            // Pointed at, the chip says who they are: their titles, or what
            // they are to the business, and whether the customer submitted them.
            chip: (
              <HoverCard openDelay={300}>
                <HoverCardTrigger asChild>
                  <span className="flex">
                    {/* Submitted and verified: green, a check. Submitted and not
                        verified: the warning tone, an exclamation mark — as the
                        Submitted chip on their cell reads. */}
                    <MetaChip tone={!r.submitted ? 'neutral' : corroborated(r) ? 'success' : 'warning'} size="compact">
                      {r.submitted && (corroborated(r) ? <Check {...icon} /> : <CircleAlert {...icon} />)}
                      {filedName(r.value)}
                    </MetaChip>
                  </span>
                </HoverCardTrigger>
                <HoverCardContent side="top" className="w-64 p-3">
                  {/* As a cell reads: the claim's chip over the value, then the
                      titles, then every record that names them, one per line —
                      the filings by state, the registers by name. */}
                  {r.submitted && (
                    <span className="mb-1.5 flex">
                      <SubmittedChip verified={corroborated(r)} by={verifiedBy(r)} onJumpToSource={ctx.onJumpToSource} />
                    </span>
                  )}
                  <span className="block text-sm font-medium text-foreground">{filedName(r.value)}</span>
                  <span className="mt-0.5 block text-caption text-text-secondary">
                    {r.titles?.length ? r.titles.join(' · ') : r.label}
                  </span>
                  {/* As the filing preview lists what a filing is: a hairline,
                      then one line per record with its mark. */}
                  {namedBy(r).length > 0 ? (
                    <ul className="m-0 mt-1.5 flex list-none flex-col gap-0.5 border-t border-[var(--core-color-border-divider)] p-0 pt-1.5 text-caption text-text-secondary">
                      {namedBy(r).map((source) => (
                        <li key={source} className="flex items-center gap-1.5">
                          <Landmark {...mark} />
                          {source}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    r.submitted && <span className="mt-1.5 block text-caption text-text-secondary">No source names them</span>
                  )}
                </HoverCardContent>
              </HoverCard>
            )
          }))}
          detail={(key) => {
            const i = rows.findIndex((r, j) => keyOf(r, j) === key)
            // Opened on its own, every title is stated.
            return i < 0 ? null : <AttributeCells className="-mb-px" items={cellsFromRows([rows[i]], { ...ctx, allTitles: true })} />
          }}
        />
      )
    })}
  </div>
)
