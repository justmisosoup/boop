import { useMemo, type ReactNode } from 'react'

import { ActionButton, Surface } from '@/core'

import { attributesFor, peopleRows } from '../../lib/attributes'
import type { BusinessRecord, Derived } from '../../lib/deriveResults'
import type { GroupId } from '../../lib/groups'
import { operationsOf } from '../../lib/operations'
import { REPORT_CARDS, cardFor } from '../../lib/reportCards'
import { screenedOf } from '../../lib/screening'
import type { Kind } from '../../lib/timeline/types'
import { AttributeCells } from '../AttributeGrid'
import { attributeRowsByGroup } from '../AttributesTab'
import { cellsFromRows } from '../attributeCells'
import { CardHeader } from '../CardHeader'
import { formationParts } from '../FormationCard'
import { Para } from '../ReportBody'
import { CityStrip } from './CityStrip'
import { KindStrip } from './ClaimsStrips'
import { FilingStrip } from './FilingStrip'
import { GroupCard } from './GroupCard'
import { IndustryStrip, LicenceStrip, LocationsStrip, industryDrawn, licencesDrawn, locationsDrawn } from './OperationsCard'
import { RelatedBusinesses } from './RelatedBusinesses'
import { MediaScreen, PepScreen, WatchlistScreen } from './ScreeningCard'

/** A grid rules itself off at the top, as a strip does. */
const Grid = ({ children }: { children: ReactNode }) => (
  <div className="border-t border-[var(--core-color-border-divider)]">{children}</div>
)

/** A group's attribute rows, as a grid: the view for a group with no drawing of its own. */
const cellsOf = (
  byGroup: ReturnType<typeof attributeRowsByGroup>,
  group: GroupId,
  record: BusinessRecord,
  onJumpToSource?: (cardId: string) => void
) => cellsFromRows([...(byGroup.get(group)?.values() ?? [])], { domesticState: record.formation?.state, onJumpToSource })

/** A result reads before an unknown, an unknown before a no-result. */
const STATE_RANK: Record<string, number> = { result: 0, unknown: 1, no_result: 2 }

/** The assessment the report is narrowed to, as the banner says it. */
export type ReportFocusBanner = { title: string; sentence?: string; onClear: () => void }

/**
 * The report, by card.
 *
 * The Insights tab's grouping, in its order, one card per group — three for
 * Screening — each the card's data view, then its review tasks. What an
 * assessment made of it is the Assistant's, whose citations lead here. A card
 * the record has nothing in — no view, no rows — is not drawn.
 *
 * Focused (`only`): just the cards an assessment rests on, under a banner
 * saying which assessment and why, with the way back to the whole report.
 */
export const GroupedReport = ({
  record,
  results,
  groupFor,
  negatives,
  revealed,
  only,
  focus,
  onJumpToSource,
  onJumpToTimeline
}: {
  record: BusinessRecord
  results: Derived[]
  groupFor: (insightId: string) => GroupId
  negatives?: ReadonlySet<string>
  revealed?: ReadonlySet<string>
  /** The cards to show, by id — an assessment's; absent, every card. */
  only?: ReadonlySet<string>
  /** With `only`: the assessment the report is narrowed to. */
  focus?: ReportFocusBanner
  onJumpToSource?: (cardId: string) => void
  onJumpToTimeline?: (eventId: string, kinds?: Kind[]) => void
}) => {
  const parts = useMemo(
    () => formationParts(record, results, groupFor, onJumpToSource, onJumpToTimeline),
    [record, results, groupFor, onJumpToSource, onJumpToTimeline]
  )
  const ops = useMemo(() => operationsOf(record), [record])
  const byGroup = useMemo(() => attributeRowsByGroup(record, results, groupFor), [record, results, groupFor])
  const screens = useMemo(() => screenedOf(record), [record])

  /* The card's rows, as the Insights tab files them: flagged first — the
     record came back adverse, or the score read it against the identity —
     then a result before an unknown before a no-result. */
  const isFlagged = (r: Derived) => r.reason === 'should_exist_not_found' || Boolean(negatives?.has(r.insightId))
  const rowsOf = (cardId: string) =>
    results
      .filter((r) => !r.notReported && cardFor(r.insightId, groupFor) === cardId)
      .sort((a, b) => Number(isFlagged(b)) - Number(isFlagged(a)) || (STATE_RANK[a.state] ?? 3) - (STATE_RANK[b.state] ?? 3))

  /* Every person on the record — officers and agents the filings name,
     licence holders, the people submitted — one row per role, roles kept
     together so a role with several names is one cell. */
  const people = useMemo(() => {
    const rows = peopleRows(record)
    const order = [...new Set(rows.map((r) => r.label))]
    return [...rows].sort((x, y) => order.indexOf(x.label) - order.indexOf(y.label))
  }, [record])
  const peopleCells = cellsFromRows(people, { domesticState: record.formation?.state, onJumpToSource })

  const grid = (group: GroupId) => {
    const cells = cellsOf(byGroup, group, record, onJumpToSource)
    return cells.length > 0 ? (
      <Grid>
        <AttributeCells items={cells} columns={3} className="-mb-px" />
      </Grid>
    ) : undefined
  }

  const liens = record.liens ?? []
  const cases = record.litigations ?? []
  const petitions = record.bankruptcies ?? []

  /** Each card's data view, where the record holds something to draw. */
  const visual: Partial<Record<string, ReactNode>> = {
    name:
      parts.names.length > 0 ? (
        <Grid>
          <AttributeCells items={parts.names} columns={3} className="-mb-px" />
        </Grid>
      ) : undefined,
    formation:
      parts.formation.length > 0 || parts.city ? (
        <>
          {parts.formation.length > 0 && (
            <Grid>
              <AttributeCells items={parts.formation} columns={3} className="-mb-px" />
            </Grid>
          )}
          {/* A sole proprietor's city registrations, as the state filings are shown. */}
          {parts.city && <CityStrip regs={parts.city} />}
        </>
      ) : undefined,
    registration: parts.strip ? (
      <FilingStrip record={parts.strip.record} lead={parts.strip.lead} legalName={parts.strip.legalName} />
    ) : undefined,
    tin: parts.tin ? (
      <Grid>
        <AttributeCells items={[parts.tin]} columns={3} className="-mb-px" />
      </Grid>
    ) : undefined,
    people:
      peopleCells.length > 0 ? (
        <Grid>
          <AttributeCells items={peopleCells} columns={3} className="-mb-px" />
        </Grid>
      ) : undefined,
    address: locationsDrawn(ops) ? <LocationsStrip ops={ops} record={record} onJumpToSource={onJumpToSource} /> : undefined,
    connections: (record.connections ?? []).length > 0 ? <RelatedBusinesses record={record} /> : undefined,
    // No website on the record is itself the fact the card states.
    website:
      grid('website') ??
      (!record.website?.url ? (
        <Grid>
          <AttributeCells
            items={[{ key: 'website', label: 'Website', span: 'full', values: [{ value: <span className="text-text-secondary">No website submitted</span> }] }]}
            columns={3}
            className="-mb-px"
          />
        </Grid>
      ) : undefined),
    profiles: grid('profiles'),
    industry: industryDrawn(ops) ? <IndustryStrip ops={ops} /> : undefined,
    licenses: licencesDrawn(ops) ? <LicenceStrip ops={ops} record={record} onJumpToSource={onJumpToSource} /> : undefined,
    // Each screen its own card, as the financial records are: a search that
    // came back clear is still that search, run.
    'screening-watchlist': screens.watchlist.ran ? <WatchlistScreen record={record} onJumpToSource={onJumpToSource} /> : undefined,
    'screening-pep': screens.pep.ran ? <PepScreen record={record} onJumpToSource={onJumpToSource} /> : undefined,
    'screening-media': screens.media.ran ? <MediaScreen record={record} onJumpToSource={onJumpToSource} /> : undefined,
    liens:
      liens.length > 0 ? (
        <KindStrip label="Liens" rows={attributesFor('liens', record)} statusOf={(i) => liens[i]?.status} onJumpToSource={onJumpToSource} />
      ) : undefined,
    litigation:
      cases.length > 0 ? (
        <KindStrip label="Litigations" rows={attributesFor('litigations', record)} statusOf={(i) => cases[i]?.caseStatus} onJumpToSource={onJumpToSource} />
      ) : undefined,
    bankruptcy:
      petitions.length > 0 ? (
        <KindStrip label="Bankruptcies" rows={attributesFor('bankruptcies', record)} statusOf={(i) => petitions[i]?.status} onJumpToSource={onJumpToSource} />
      ) : undefined
  }

  // The cards the record draws at all, and of those, the ones in view.
  const drawn = REPORT_CARDS.map((c) => ({ card: c, rows: rowsOf(c.id) })).filter(({ card, rows }) => visual[card.id] || rows.length > 0)
  const shown = only ? drawn.filter(({ card }) => only.has(card.id)) : drawn

  return (
    <div className="flex flex-col gap-4">
      {/* Narrowed to one assessment: which, why, and the way back. */}
      {only && focus && (
        <Surface variant="card" padding="none" className="overflow-hidden" role="status">
          <CardHeader
            title={focus.title}
            trailing={
              <ActionButton variant="secondary" size="compact" onClick={focus.onClear}>
                Full report
              </ActionButton>
            }
            className="border-b-0 pb-1"
          />
          {focus.sentence && (
            <div className="px-4 pb-3">
              <Para inline className="text-sm leading-5 text-text-secondary" results={results} record={record}>
                {focus.sentence}
              </Para>
            </div>
          )}
        </Surface>
      )}
      {shown.map(({ card, rows }) => (
        <GroupCard
          key={card.id}
          id={card.id}
          title={card.label}
          trailing={card.id === 'formation' ? parts.formationChip : undefined}
          visual={visual[card.id]}
          rows={rows}
          record={record}
          negatives={negatives}
          revealed={revealed}
          onJumpToSource={onJumpToSource}
        />
      ))}
    </div>
  )
}
