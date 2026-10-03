import { useMemo, type ReactNode } from 'react'
import { Globe, Users } from 'lucide-react'

import { ActionButton, MetaChip, Surface } from '@/core'

import { attributesFor, peopleByPerson, peopleRows } from '../../lib/attributes'
import type { BusinessRecord, Derived } from '../../lib/deriveResults'
import type { GroupId } from '../../lib/groups'
import { operationsOf } from '../../lib/operations'
import { REPORT_CARDS, cardFor } from '../../lib/reportCards'
import { dismissalOf, screenedOf } from '../../lib/screening'
import { screenshotFor } from '../../lib/sourceScreenshots'
import type { Kind } from '../../lib/timeline/types'
import { AttributeCells } from '../AttributeGrid'
import { attributeRowsByGroup } from '../AttributesTab'
import { cellsFromRows } from '../attributeCells'
import { CardHeader } from '../CardHeader'
import { formationParts } from '../FormationCard'
import { Para } from '../ReportBody'
import { useScreenshotViewer } from '../ScreenshotViewer'
import { OtherFilings } from './OtherFilings'
import { KindStrip } from './ClaimsStrips'
import { FilingStrip } from './FilingStrip'
import { GroupCard } from './GroupCard'
import { IndustryStrip, LicenceStrip, LocationsStrip, industryDrawn, licencesDrawn, locationsDrawn } from './OperationsCard'
import { PeopleStrips } from './PeopleStrip'
import { RelatedBusinesses } from './RelatedBusinesses'
import { Strip, StripExpand } from './Strip'
import { MediaScreen, PepScreen, WatchlistScreen } from './ScreeningCard'

/** The order packages a public-record search ran under, by card. */
const SEARCHES: Record<'liens' | 'litigation' | 'bankruptcy', { packages: Record<string, string>; people: RegExp }> = {
  liens: { packages: { tax_liens: 'tax liens', ucc_liens: 'UCC liens', liens: 'liens' }, people: /^people_liens|^individual_liens/ },
  litigation: { packages: { litigations: 'litigations' }, people: /^people_litigations|^individual_litigations/ },
  bankruptcy: { packages: { bankruptcies: 'bankruptcies' }, people: /^people_bankruptcies|^individual_bankruptcies/ }
}

/** What a public-record search ran on, as the order placed it: the business
 *  name, and the submitted people where the order searched people too. */
const searchedOn = (record: BusinessRecord, kind: keyof typeof SEARCHES) => {
  const orders = (record as BusinessRecord & { orders?: Array<{ package: string }> }).orders ?? []
  const { packages, people } = SEARCHES[kind]
  const ran = [...new Set(orders.map((o) => packages[o.package]).filter(Boolean))]
  const onPeople = orders.some((o) => people.test(o.package))
  const names = onPeople ? record.people.filter((p) => p.submitted && p.name).map((p) => p.name) : []
  return { ran, names }
}

/** A public record with nothing on file: the strip's label over a plain chip
 *  saying so — "No liens" — that opens nothing, and what the search ran on,
 *  per the order: the business name, and the people where they were searched. */
const NoneOnFile = ({ label, text, record, kind }: { label: string; text: string; record: BusinessRecord; kind: keyof typeof SEARCHES }) => {
  const { ran, names } = searchedOn(record, kind)
  return (
    <div>
      <Strip
        label={label}
        tiles={[{ key: 'none', static: true, chip: <MetaChip tone="neutral" size="compact">{text}</MetaChip> }]}
        aside={
          <span className="text-caption text-text-secondary">
            Searched the business name{names.length > 0 ? ` and ${names.length === 1 ? names[0] : `${names.length} people`}` : ''}
            {ran.length > 1 ? ` · ${ran.join(' and ')}` : ''}
          </span>
        }
        detail={() => null}
      />
    </div>
  )
}

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
  expand,
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
  /** The card an Assistant chip just led to, opened; `n` counts the jumps. */
  expand?: { card: string; n: number }
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
  const { open: openScreenshot } = useScreenshotViewer()

  /* The card's rows, as the Insights tab files them: flagged first — the
     record came back adverse, or the score read it against the identity —
     then a result before an unknown before a no-result. */
  const isFlagged = (r: Derived) => r.reason === 'should_exist_not_found' || Boolean(negatives?.has(r.insightId))
  const rowsOf = (cardId: string) =>
    results
      .filter((r) => !r.notReported && cardFor(r.insightId, groupFor) === cardId)
      .sort((a, b) => Number(isFlagged(b)) - Number(isFlagged(a)) || (STATE_RANK[a.state] ?? 3) - (STATE_RANK[b.state] ?? 3))

  /* Every person on the record — officers and agents the filings name,
     licence holders, the people submitted — one cell each: their roles
     combined, under one spelling of their name. */
  const people = useMemo(() => peopleByPerson(peopleRows(record)), [record])

  const grid = (group: GroupId) => {
    const cells = cellsOf(byGroup, group, record, onJumpToSource)
    return cells.length > 0 ? (
      <Grid>
        <AttributeCells items={cells} columns={3} className="-mb-px" />
      </Grid>
    ) : undefined
  }

  const siteShot = screenshotFor(record.website?.url ?? undefined, 'Website')
  const websiteCells = cellsOf(byGroup, 'website', record, onJumpToSource).map((c) =>
    siteShot && c.label === 'Website'
      ? {
          ...c,
          aside: (
            <button
              type="button"
              onClick={() => openScreenshot(siteShot)}
              aria-label={`View screenshot: ${siteShot.alt}`}
              title="View screenshot"
              className="block h-20 w-32 shrink-0 overflow-hidden rounded-control border border-solid border-border transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <img src={siteShot.src} alt="" className="size-full object-cover object-top" />
            </button>
          )
        }
      : c
  )

  const profileCells = cellsOf(byGroup, 'profiles', record, onJumpToSource)
  /* The emails and phone numbers the profiles carry, after the profiles, each
     with how it was found: one chip listing every page it was read off — the
     Instagram and Facebook profiles, the website — each linking to it. */
  const contactCells = cellsFromRows(
    [...(byGroup.get('website')?.values() ?? [])]
      .filter((r) => /^(email address|phone number)$/i.test(r.label) && (r.refs ?? []).some((x) => x.type === 'profile'))
      .filter((r, i, all) => all.findIndex((x) => x.label === r.label && x.value === r.value) === i)
      .map((r) => ({
        ...r,
        sources: [...(r.sources ?? []), ...(r.sourceUrls?.Website && !(r.sources ?? []).includes('Website') ? ['Website'] : [])]
      })),
    { domesticState: record.formation?.state, onJumpToSource }
  )
  const profilesGrid =
    profileCells.length > 0 ? (
      <AttributeCells items={[...profileCells, ...contactCells]} columns={3} className="-mb-px" />
    ) : undefined
  const siteHost = (() => {
    try {
      return record.website?.url ? new URL(record.website.url).host.replace(/^www\./, '') : undefined
    } catch {
      return record.website?.url ?? undefined
    }
  })()

  const liens = record.liens ?? []
  const cases = record.litigations ?? []
  const petitions = record.bankruptcies ?? []

  /** Each card's data view, where the record holds something to draw. */
  const visual: Partial<Record<string, ReactNode>> = {
    // The formation and its registrations, one card: the formation grid, then
    // the state filings strip.
    // The names, the formation and its registrations, one card: Legal name,
    // Doing business as and Former names leading the formation grid, then the
    // state filings strip.
    formation:
      parts.names.length > 0 || parts.formation.length > 0 || parts.city || parts.dbaRule || parts.strip ? (
        <>
          {parts.names.length + parts.formation.length > 0 && (
            <Grid>
              <AttributeCells items={[...parts.names, ...parts.formation]} columns={3} className="-mb-px" />
            </Grid>
          )}
          {parts.strip && <FilingStrip record={parts.strip.record} lead={parts.strip.lead} legalName={parts.strip.legalName} />}
          {/* The filings other than the state's, under them: city registrations
              and a sole proprietor's DBA filing, as chips like the state filings'. */}
          {((parts.city?.length ?? 0) > 0 || parts.dbaRule) && <OtherFilings city={parts.city} dbaRule={parts.dbaRule} />}
        </>
      ) : undefined,
    tin: parts.tin ? (
      <Grid>
        <AttributeCells items={[parts.tin]} columns={3} className="-mb-px" />
      </Grid>
    ) : undefined,
    // As the Addresses card draws its places: a strip per kind, a chip per
    // person, their cell under the strip when picked.
    people:
      people.length > 0 ? (
        <PeopleStrips people={people} ctx={{ domesticState: record.formation?.state, onJumpToSource }} />
      ) : undefined,
    address: locationsDrawn(ops) ? <LocationsStrip ops={ops} record={record} onJumpToSource={onJumpToSource} /> : undefined,
    connections: (record.connections ?? []).length > 0 ? <RelatedBusinesses record={record} /> : undefined,
    // No website on the record is itself the fact the card states. With a
    // capture of the site, the Website row carries it as a thumbnail in its
    // far corner; clicking it shows the whole page.
    // Web presence: the site and the business's third-party profiles, as the
    // Addresses card draws its places — a chip for the site, by its address,
    // and one rolling up the profiles; each opens its cells. No website is
    // itself a fact, stated as a chip that opens nothing.
    website: (
      <div>
        <Strip
          label="Online"
          tiles={[
            siteHost
              ? {
                  key: 'site',
                  chip: (
                    <MetaChip tone={record.website?.submitted ? 'success' : 'neutral'} size="compact">
                      <Globe aria-hidden="true" size={12} strokeWidth={2} />
                      {siteHost}
                    </MetaChip>
                  )
                }
              : {
                  key: 'site',
                  static: true,
                  chip: (
                    <MetaChip tone="neutral" size="compact">
                      No website submitted
                    </MetaChip>
                  )
                },
            ...(profileCells.length > 0
              ? [
                  {
                    key: 'profiles',
                    chip: (
                      <MetaChip tone="neutral" size="compact">
                        <Users aria-hidden="true" size={12} strokeWidth={2} />
                        Third-party profiles
                        <span className="tabular-nums text-text-secondary">{profileCells.length}</span>
                      </MetaChip>
                    )
                  }
                ]
              : [])
          ]}
          detail={(key) =>
            key === 'site' ? <AttributeCells items={websiteCells} columns={3} className="-mb-px" /> : profilesGrid
          }
        />
      </div>
    ),
    industry: industryDrawn(ops) ? <IndustryStrip ops={ops} /> : undefined,
    licenses: licencesDrawn(ops) ? <LicenceStrip ops={ops} record={record} onJumpToSource={onJumpToSource} /> : undefined,
    // Each screen its own card, as the financial records are: a search that
    // came back clear is still that search, run.
    'screening-watchlist': screens.watchlist.ran ? <WatchlistScreen record={record} onJumpToSource={onJumpToSource} /> : undefined,
    'screening-pep': screens.pep.ran ? <PepScreen record={record} onJumpToSource={onJumpToSource} /> : undefined,
    'screening-media': screens.media.ran ? <MediaScreen record={record} onJumpToSource={onJumpToSource} /> : undefined,
    // None on file is itself the fact, said in the strip's place.
    liens:
      liens.length > 0 ? (
        <KindStrip label="Liens" rows={attributesFor('liens', record)} statusOf={(i) => liens[i]?.status} onJumpToSource={onJumpToSource} />
      ) : (
        <NoneOnFile label="Liens" text="No liens" record={record} kind="liens" />
      ),
    litigation:
      cases.length > 0 ? (
        <KindStrip label="Litigations" rows={attributesFor('litigations', record)} statusOf={(i) => cases[i]?.caseStatus} onJumpToSource={onJumpToSource} />
      ) : (
        <NoneOnFile label="Litigations" text="No litigations" record={record} kind="litigation" />
      ),
    bankruptcy:
      petitions.length > 0 ? (
        <KindStrip label="Bankruptcies" rows={attributesFor('bankruptcies', record)} statusOf={(i) => petitions[i]?.status} onJumpToSource={onJumpToSource} />
      ) : (
        <NoneOnFile label="Bankruptcies" text="No bankruptcies" record={record} kind="bankruptcy" />
      )
  }

  /* A card the record came back empty for: nothing to draw — no liens, no
     related businesses — or a screen that ran and returned no hits, or no
     website at all. It still says so, at the end of the report: what was found
     reads first. */
  // A screen counts the results still standing — every one not dismissed,
  // as its chips say (`dismissalOf`).
  const counts = (screen: 'watchlist' | 'pep' | 'media') =>
    (screens[screen].hits as Array<Parameters<typeof dismissalOf>[1]>).some((h) => !dismissalOf(screen, h))
  const noResults = (id: string) =>
    id === 'screening-watchlist'
      ? !counts('watchlist')
      : id === 'screening-pep'
        ? !counts('pep')
        : id === 'screening-media'
          ? !counts('media')
          : id === 'website'
            ? !record.website?.url && !profilesGrid
            : id === 'liens'
              ? liens.length === 0
              : id === 'litigation'
                ? cases.length === 0
                : id === 'bankruptcy'
                  ? petitions.length === 0
            : !visual[id]

  // The cards the record draws at all, what was found first and the empty ones
  // after, each in the report's order; of those, the ones in view.
  const all = REPORT_CARDS.map((c) => ({ card: c, rows: rowsOf(c.id) })).filter(({ card, rows }) => visual[card.id] || rows.length > 0)
  const byResults = [...all.filter(({ card }) => !noResults(card.id)), ...all.filter(({ card }) => noResults(card.id))]
  /* The compliance checks read as one run, in a fixed order: Sanctions, PEP,
     Adverse media, then Liens, Litigation, Bankruptcy — the screens above the
     public record. The run sits with what was found where any of it found
     something, at the end where none did. */
  const COMPLIANCE = ['screening-watchlist', 'screening-pep', 'screening-media', 'liens', 'litigation', 'bankruptcy']
  const inRun = ({ card }: (typeof byResults)[number]) => COMPLIANCE.includes(card.id)
  const run = byResults.filter(inRun).sort((x, y) => COMPLIANCE.indexOf(x.card.id) - COMPLIANCE.indexOf(y.card.id))
  const at = byResults.findIndex(inRun)
  const rest = byResults.filter((x) => !inRun(x))
  const drawn = at < 0 ? byResults : [...rest.slice(0, at), ...run, ...rest.slice(at)]
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
      {shown.map(({ card, rows }) => {
        /* Led here from the Assistant — narrowed to an assessment, or the card
           a chip landed on — its data opens: each strip on its first tile.
           Keyed on it, so the card opens afresh each time it is led to. */
        const open = Boolean(only) || expand?.card === card.id
        return (
          <StripExpand.Provider key={`${card.id}:${open ? `open-${focus?.title ?? ''}-${expand?.n ?? ''}` : ''}`} value={open}>
            <GroupCard
              id={card.id}
              title={card.label}
              visual={visual[card.id]}
              rows={rows}
              record={record}
              negatives={negatives}
              revealed={revealed}
              onJumpToSource={onJumpToSource}
            />
          </StripExpand.Provider>
        )
      })}
    </div>
  )
}
