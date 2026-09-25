import { Surface } from '@/core'

import { formationIdentityRows, type AttributeRow } from '../lib/attributes'
import { linkedFormationNote, linkedFormationOf } from '../lib/linkedFormation'
import { formationConfirmed, formationFilingOf, formationStandingNote, sameName } from '../lib/registrationStatus'
import { soleProprietorOf } from '../lib/soleProprietor'
import { stateName } from '../lib/states'
import type { BusinessRecord, Derived } from '../lib/deriveResults'
import { GROUPS, type GroupId } from '../lib/groups'
import { cn } from '../utils/twUtils'
import { AttributeCells } from './AttributeGrid'
import { attributeRowsByGroup } from './AttributesTab'
import { cellsFromRows } from './attributeCells'
import { CardHeader } from './CardHeader'
import { AttributeSources, SubmittedChip } from './Provenance'

/**
 * The strongest record of who this business is, under the call.
 *
 * In order of strength: the domestic Secretary of State filing, a DBA filing,
 * a city registration, and — when the record holds nothing found — what the
 * customer submitted. One card, headed by whichever of the four it is, so a
 * reader never sees "Formation" over a business that has no formation record:
 * that card used to show the submitted name under a heading that claimed the
 * state had said it.
 *
 * The lead fact spans. The name is the identifying fact and the only bold
 * value, so it takes the full row; the facts under it pair up, and an odd
 * count leaves the last one the whole row rather than an orphan half.
 *
 * Cited once, in the header. Every value here is off the one source, so a chip
 * on every cell said the same thing seven times. The header carries the
 * source's own chip — `SOS · NY`, `City registration`, `Submitted` — and it
 * follows to that source's card in Sources the way an attribute row's does.
 */
type Tier = 'formation' | 'dba' | 'city' | 'submitted'

const TITLE: Record<Tier, string> = {
  formation: 'Formation',
  dba: 'DBA filing',
  city: 'City registration',
  submitted: 'Submitted'
}

/** As the rows name it: `provenanceList` renders source keys as labels. */
const CITY = 'City registration'

/** Every attribute row the report holds, in the Attributes tab's group order. */
const allRows = (record: BusinessRecord, results: Derived[], groupFor: (id: string) => GroupId) => {
  const byGroup = attributeRowsByGroup(record, results, groupFor)
  return GROUPS.flatMap((g) => [...(byGroup.get(g.id)?.values() ?? [])])
}

/** One row per fact: the same label and value from two producers is one row. */
const dedupe = (rows: AttributeRow[]) => {
  const seen = new Set<string>()
  return rows.filter((r) => {
    const key = `${r.label}|${r.value}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export const FormationCard = ({
  record,
  results,
  groupFor,
  onJumpToSource,
  className
}: {
  record: BusinessRecord
  /** The report's insights, which is where the record's attributes are read from. */
  results: Derived[]
  groupFor: (insightId: string) => GroupId
  /** The header chip opens the source's card in Sources. */
  onJumpToSource?: (cardId: string) => void
  className?: string
}) => {
  /* No formation of its own, but one on another record that looks linked —
     Sprig's Delaware filing sits on the Mixboard Inc. record. The card shows
     that filing, and the note says it was not found for this business and
     how it was linked. */
  const linked = linkedFormationOf(record)
  const domestic = linked?.filing ?? formationFilingOf(record)

  // Which record there is, strongest first.
  const dbaSources = new Set(
    (record.names ?? []).filter((n) => n.type === 'dba').flatMap((n) => n.sources ?? [])
  )
  const rows = allRows(record, results, groupFor)
  const cityRows = rows.filter((r) => (r.sources ?? []).includes(CITY))
  const dbaRows = rows.filter((r) => (r.sources ?? []).some((s) => dbaSources.has(s)))

  const tier: Tier =
    record.formation || domestic
      ? 'formation'
      : dbaRows.length > 0
        ? 'dba'
        : cityRows.length > 0
          ? 'city'
          : 'submitted'

  const tierRows =
    tier === 'formation'
      ? formationIdentityRows(linked?.record ?? record)
      : dedupe(tier === 'dba' ? dbaRows : tier === 'city' ? cityRows : rows.filter((r) => r.submitted))

  const cells = cellsFromRows(tierRows, {
    domesticState: linked ? linked.filing.state : record.formation?.state,
    onJumpToSource,
    // The source is named once, in the header.
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

  const chip =
    tier === 'formation' ? (
      domestic && (
        <AttributeSources
          sources={[]}
          registrations={[domestic]}
          domesticState={linked ? linked.filing.state : record.formation?.state}
          onJumpToSource={onJumpToSource}
        />
      )
    ) : tier === 'submitted' ? (
      <SubmittedChip onJumpToSource={onJumpToSource} />
    ) : (
      <AttributeSources
        sources={tier === 'city' ? [CITY] : [...dbaSources]}
        domesticState={record.formation?.state}
        onJumpToSource={onJumpToSource}
      />
    )

  /* A formation on another record is not this business's formation until
     someone confirms it; the title says what it is. A formation that is — a
     domestic filing in the formation state, under the business's own name —
     says so, and the subtext says whether it is still the filing the business
     stands on. */
  const strong =
    !linked && tier === 'formation' && formationConfirmed(record) && sameName(domestic?.name, record.name)
  // No state filing at all, and a city registration in the submitted person's own name.
  const sole = !linked && tier !== 'formation' ? soleProprietorOf(record) : undefined
  const title = linked
    ? 'Possible formation found under different business name'
    : strong
      ? 'Formation found for this business'
      : sole
        ? 'Likely sole proprietorship'
        : TITLE[tier]
  const note = linked
    ? linkedFormationNote(record, linked, stateName)
    : strong
      ? formationStandingNote(record)
      : sole
        ? sole.tradeNameOnFile
          ? `No state filing is expected: a sole proprietorship doesn't register with the Secretary of State. ${sole.city} registers the business to ${sole.person}, doing business as ${record.name}${
              sole.since ? ` since ${sole.since.slice(0, 4)}` : ''
            }${sole.account ? ` (account ${sole.account})` : ''}, at the submitted office address.`
          : `No state filing is expected: a sole proprietorship doesn't register with the Secretary of State. The ${sole.city} city registration at the submitted office address is in ${sole.person}'s own name, so ${sole.person} appears to operate ${record.name} as a sole proprietor.`
        : undefined

  return (
    <Surface
      variant="card"
      padding="none"
      className={cn('overflow-hidden', className)}
      aria-label={title}
      role="region"
    >
      <CardHeader title={title} trailing={chip} className={note ? 'border-b-0 pb-1' : undefined} />
      {note && (
        <div className="border-b border-[var(--core-color-border-divider)] px-4 pb-3">
          <span className="block text-sm leading-5 text-text-secondary">{note}</span>
        </div>
      )}
      <AttributeCells items={items} className="-mb-px" />
    </Surface>
  )
}
