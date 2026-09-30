import { Surface, Text } from '@/core'

import { currentDomesticRows, formationIdentityRows, websiteStatesName, type AttributeRow } from '../lib/attributes'
import { FORMATION_CARD_INSIGHTS } from '../lib/identitySections'
import { FORMATION_CARD_ID } from '../lib/needsReview'
import { negativesFor } from '../lib/identityScore'
import { domesticFilingOf, formationCardFilingOf, linkedFormationNote } from '../lib/linkedFormation'
import {
  convertedFormationNote,
  convertedFormationOf,
  formationConfirmed,
  formationFilingOf,
  formationStandingNote,
  registrationState,
  sameName
} from '../lib/registrationStatus'
import { nameStandingOf } from '../lib/businessNames'
import { soleProprietorOf } from '../lib/soleProprietor'
import { stateName } from '../lib/states'
import type { BusinessRecord, Derived } from '../lib/deriveResults'
import { GROUPS, type GroupId } from '../lib/groups'
import { cn } from '../utils/twUtils'
import { AttributeCells, type AttributeCell } from './AttributeGrid'
import { attributeRowsByGroup } from './AttributesTab'
import { cellsFromRows } from './attributeCells'
import { CardHeader } from './CardHeader'
import { InsightRow } from './InsightRow'
import { InsightsDisclosure } from './InsightStack'
import { AttributeSources, SubmittedChip } from './Provenance'
import { FilingStrip, otherStateStandings } from './Report/FilingStrip'

/**
 * The strongest record of who this business is, under the call.
 *
 * In order of strength: the domestic Secretary of State filing, a city
 * registration, and — when the record holds nothing found — what the customer
 * submitted. One card, headed by whichever of the three it is, so a
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
type Tier = 'formation' | 'city' | 'submitted'

const TITLE: Record<Tier, string> = {
  formation: 'Formation',
  city: 'City registration',
  submitted: 'Submitted'
}

/** The fields other sources state as well as the card's filing. */
const CORROBORATED = new Set(['Legal name', 'Entity type'])

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

/**
 * The formation filing's standing, for the note — except where the state
 * publishes none. Delaware and New Jersey never do; that is how those
 * registries work, not something to say about the business.
 */
const formationNote = (record: BusinessRecord): string | undefined => {
  const f = formationFilingOf(record)
  return f && registrationState(f).silent ? undefined : formationStandingNote(record)
}

/**
 * The other registrations, in a sentence: where the business is active, and
 * that some registrations have lapsed. Counted, not listed — the strip shows
 * the states. No-status states are not mentioned: silence is the registry's.
 */
const registrationsNote = (record: BusinessRecord, formationState?: string | null): string | undefined => {
  const s = otherStateStandings(record, formationState)
  if (s.total === 0) return undefined
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
  const active = s.active > 0 ? `Active in ${plural(s.active, 'other state', 'other states')}` : undefined
  const inactive =
    s.inactive > 0 ? `${plural(s.inactive, 'registration is', 'registrations are')} inactive` : undefined
  if (active && inactive) return `${active}; ${inactive}.`
  if (active) return `${active}.`
  return inactive ? `${inactive[0].toUpperCase()}${inactive.slice(1)}.` : undefined
}

/**
 * The card's title, as it reads on the page — for the Needs review card,
 * which names this card by its header. The same reading the component makes:
 * a linked formation, a confirmed one, a likely sole proprietorship, or the
 * tier's plain name.
 */
export const formationCardTitle = (
  record: BusinessRecord,
  results: Derived[],
  groupFor: (insightId: string) => GroupId
): string => {
  const linked = domesticFilingOf(record)?.linked
  const domestic = formationCardFilingOf(record)
  const rows = allRows(record, results, groupFor)
  const tier: Tier =
    record.formation || domestic
      ? 'formation'
      : rows.some((r) => (r.sources ?? []).includes(CITY))
        ? 'city'
        : 'submitted'
  const strong = !linked && tier === 'formation' && formationConfirmed(record) && sameName(domestic?.name, record.name)
  const sole = !linked && tier !== 'formation' ? soleProprietorOf(record) : undefined
  // The formation, and where else it is registered — counted, not listed:
  // the strip under the title shows which states.
  const others = strong ? otherStateStandings(record, domestic?.state).total : 0
  return linked
    ? 'Possible formation found under different business name'
    : strong
      ? others > 0
        ? `Formation found and registered in ${others} other state${others === 1 ? '' : 's'}`
        : 'Formation found for this business'
      : sole
        ? 'Likely sole proprietorship'
        : TITLE[tier]
}

export const FormationCard = ({
  record,
  results,
  groupFor,
  revealed,
  onJumpToSource,
  className
}: {
  record: BusinessRecord
  /** The report's insights, which is where the record's attributes are read from. */
  results: Derived[]
  groupFor: (insightId: string) => GroupId
  /** Insight ids an assistant citation has just led to: their rows open. */
  revealed?: ReadonlySet<string>
  /** The header chip opens the source's card in Sources. */
  onJumpToSource?: (cardId: string) => void
  className?: string
}) => {
  // The card's insights sit behind "Show insights" (`InsightsDisclosure`); a
  // citation that leads to one of them opens the list.
  const revealsHere = [...(revealed ?? [])].some((id) =>
    (FORMATION_CARD_INSIGHTS as ReadonlyArray<string>).includes(id.split(':')[0])
  )
  /* No formation of its own, but one on another record that looks linked —
     Sprig's Delaware filing sits on the Mixboard Inc. record. The card shows
     that filing, and the note says it was not found for this business and
     how it was linked. */
  const found = domesticFilingOf(record)
  const linked = found?.linked
  // Converted out of the state it was formed in: the card leads with the
  // domestic filing it stands on now (Andytown's Delaware one).
  const converted = !linked ? convertedFormationOf(record) : undefined
  const domestic = formationCardFilingOf(record)
  const domesticState = linked ? linked.filing.state : converted ? converted.now.state : record.formation?.state

  // Which record there is, strongest first.
  const rows = allRows(record, results, groupFor)
  const cityRows = rows.filter((r) => (r.sources ?? []).includes(CITY))

  const tier: Tier = record.formation || domestic ? 'formation' : cityRows.length > 0 ? 'city' : 'submitted'

  const tierRows =
    tier === 'formation'
      ? converted
        ? currentDomesticRows(record, converted.now)
        : formationIdentityRows(linked?.record ?? record)
      : dedupe(tier === 'city' ? cityRows : rows.filter((r) => r.submitted))

  /* Which filing `sos_domestic` and its sub-status speak to: the formation
     filing. Where that is the grid's own filing, or the former filing the
     converted-out row shows, the row repeats what is on the card. */
  const formationFiling = formationFilingOf(record)
  const alreadyShown = (id: string) =>
    (id === 'entity_type' && tierRows.some((r) => r.label === 'Entity type')) ||
    (id === 'linked_domestic' && Boolean(linked)) ||
    (id === 'sos_domestic' &&
      Boolean(formationFiling) &&
      (formationFiling === domestic || formationFiling === converted?.formed)) ||
    // The grid states the sub status as a field, published or not.
    (id === 'sos_domestic_sub_status' && tier === 'formation')
  const negatives = negativesFor(record, results)
  /* The filings strip carries what the count rows said — how many filings
     are active, inactive, or silent — so those rows give way to it. The
     insights stay in the data and in the Insights panel; only this card's
     way of showing them changes. */
  const strip = tier === 'formation' && record.registrations.length > 0
  const COUNTED = new Set(['sos_active', 'sos_inactive', 'sos_unknown', 'sos_status', 'sos_not_found'])
  const cardRows = FORMATION_CARD_INSIGHTS.flatMap((id) =>
    results.filter(
      (r) =>
        r.insightId.split(':')[0] === id && r.state !== 'unknown' && !alreadyShown(id) && !(strip && COUNTED.has(id))
    )
  )

  /* The header names the card's filing once. A value other sources state too —
     the name 21 filings are under, the form they all declare — shows every source that states it, this filing included, so it
     reads as what the record agrees on rather than one filing's word. Everything
     else is the filing's alone, and the header already cites it. */
  const isCardFiling = (f: BusinessRecord['registrations'][number]) =>
    Boolean(domestic) && f.state === domestic?.state && f.fileNumber === domestic?.fileNumber
  // A chip only where something beyond the card's own filing states the value
  // — and then only that: the header already names the card's filing, so the
  // chip lists the OTHER sources that agree, not the one on screen again.
  const corroboratedBeyondCard = (r: AttributeRow) =>
    (r.registrations ?? []).some((f) => !isCardFiling(f)) || (r.sources ?? []).length > 0
  /* With the strip, no header names the formation filing, so the legal name
     and the entity type cite it themselves — first, as the formation date
     does — and then the other filings that agree: "SOS · DE +58". */
  const withFormation = (r: AttributeRow): AttributeRow => ({
    ...r,
    registrations: [
      ...(domestic ? [domestic] : []),
      ...(r.registrations ?? []).filter((f) => !isCardFiling(f))
    ]
  })
  const shownRows =
    tier === 'formation'
      ? tierRows.map((r) =>
          strip && CORROBORATED.has(r.label)
            ? withFormation(r)
            : CORROBORATED.has(r.label) && corroboratedBeyondCard(r)
            ? {
                ...r,
                registrations: (r.registrations ?? []).filter((f) => !isCardFiling(f))
              }
            : { ...r, sources: [], source: '', registrations: undefined }
        )
      : tierRows

  const cells = cellsFromRows(shownRows, {
    domesticState,
    onJumpToSource,
    // The source is named once, in the header; only corroboration beyond it shows.
    provenance: tier === 'formation',
    // The standing row's "order a certificate" line is a reading of the
    // absence, which is what the note slot is for.
    evidence: true
  })
  if (cells.length === 0) return null

  /* With the strip, the grid is who the entity is — name, form, when it was
     formed — and the strip, which leads with the formation filing, is where
     every filing stands. The state, status and sub status here said again
     what the strip's view says for the formation filing. */
  const FILING_FIELDS = new Set(['Formation state', 'Status', 'Sub status', 'Status details'])
  const shownCells = strip ? cells.filter((c) => !FILING_FIELDS.has(c.label ?? '')) : cells
  const [lead, ...rest] = shownCells
  const items = [
    {
      ...lead,
      span: 'full' as const,
      values: lead.values.map((v) => ({
        ...v,
        value: <span className="font-semibold">{v.value}</span>
      }))
    },
    // The formation date is the domestic filing's, and says so: with no
    // chip in the card's header, the date carries its own source.
    ...rest.map((c) =>
      c.label === 'Formation date' && tier === 'formation' && domestic
        ? {
            ...c,
            badge: (
              <AttributeSources
                sources={[]}
                registrations={[domestic]}
                domesticState={domesticState}
                onJumpToSource={onJumpToSource}
              />
            )
          }
        : c
    )
  ]

  const chip =
    tier === 'formation' ? (
      domestic && (
        <AttributeSources
          sources={[]}
          registrations={[domestic]}
          domesticState={domesticState}
          onJumpToSource={onJumpToSource}
        />
      )
    ) : tier === 'submitted' ? (
      <SubmittedChip onJumpToSource={onJumpToSource} />
    ) : (
      <AttributeSources sources={[CITY]} domesticState={record.formation?.state} onJumpToSource={onJumpToSource} />
    )

  /* A formation on another record is not this business's formation until
     someone confirms it; the title says what it is. A formation that is — a
     domestic filing in the formation state, under the business's own name —
     says so, and the subtext says whether it is still the filing the business
     stands on. */
  const strong = !linked && tier === 'formation' && formationConfirmed(record) && sameName(domestic?.name, record.name)
  // No state filing at all, and a city registration in the submitted person's own name.
  const sole = !linked && tier !== 'formation' ? soleProprietorOf(record) : undefined
  const title = formationCardTitle(record, results, groupFor)
  const note = linked
    ? linkedFormationNote(record, linked, stateName)
    : strong
      ? converted
        ? convertedFormationNote(converted)
        : [formationNote(record), registrationsNote(record, domestic?.state)].filter(Boolean).join(' ') || undefined
      : sole
        ? nameStandingOf(record).category === 'DBA_OF_PERSON'
          ? `No state filing is expected: a sole proprietorship doesn't register with the Secretary of State. ${sole.city} registers the business to ${sole.person}, doing business as ${record.name}${
              sole.since ? ` since ${sole.since.slice(0, 4)}` : ''
            }${sole.account ? ` (account ${sole.account})` : ''}, at the submitted office address.`
          : `No state filing is expected: a sole proprietorship doesn't register with the Secretary of State. The ${sole.city} city registration at the submitted office address is in ${sole.person}'s own name, so ${sole.person} appears to operate ${record.name} as a sole proprietor.`
        : undefined

  /*
   * A sole proprietorship, split the way the Formation card is.
   *
   * There is no entity apart from its owner, so what stays true is the
   * business as the owner runs it — its DBA, the owner, the form we read it
   * as, when the city first registered it — each citing its own source. What
   * repeats is the city registration and its location, below, as the one
   * registration view. Firebird Yarns is the case: Kathryn Bernard, doing
   * business as Firebird Yarns, San Francisco account 1089962.
   */
  const cityReg = sole
    ? ((record.cityRegistrations ?? []).find((c) => sameName(c.owner, sole.person)) ?? record.cityRegistrations?.[0])
    : undefined
  const cityChip = (
    <AttributeSources sources={[CITY]} domesticState={record.formation?.state} onJumpToSource={onJumpToSource} />
  )
  const longDate = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  const yearsSince = (iso: string) => {
    const y = Math.floor((Date.now() - new Date(`${iso}T00:00:00`).getTime()) / (365.25 * 86_400_000))
    return `${y} year${y === 1 ? '' : 's'}`
  }
  const soleItems: AttributeCell[] | null =
    sole && cityReg
      ? [
          {
            key: 'dba',
            label: 'DBA name',
            badge: (
              <AttributeSources
                sources={websiteStatesName(record, cityReg.dba ?? record.name) ? [CITY, 'Website'] : [CITY]}
                domesticState={record.formation?.state}
                onJumpToSource={onJumpToSource}
              />
            ),
            values: [
              {
                value: <span className="font-semibold">{cityReg.dba ?? record.name}</span>
              }
            ]
          },
          {
            key: 'owner',
            label: 'Owner',
            badge: cityChip,
            submitted: record.people.some((p) => p.submitted && sameName(p.name, sole.person)),
            verified: true,
            values: [{ value: cityReg.owner ?? sole.person }]
          },
          // Our reading, not a filed fact — so no source chip; the note above
          // says what it rests on.
          {
            key: 'form',
            label: 'Entity type',
            values: [{ value: 'Likely sole proprietorship' }]
          },
          ...(cityReg.businessStart
            ? [
                {
                  key: 'since',
                  label: 'City registration date',
                  badge: cityChip,
                  values: [
                    {
                      value: longDate(cityReg.businessStart),
                      qualifier: `${yearsSince(cityReg.businessStart)} old`
                    }
                  ]
                }
              ]
            : [])
        ]
      : null
  const soleRegistration: AttributeCell[] =
    sole && cityReg
      ? [
          ...(cityReg.accountNumber
            ? [
                {
                  key: 'acct',
                  label: 'Account number',
                  values: [{ value: cityReg.accountNumber }]
                }
              ]
            : []),
          ...(cityReg.locationId
            ? [
                {
                  key: 'loc',
                  label: 'Location ID',
                  values: [{ value: cityReg.locationId }]
                }
              ]
            : []),
          {
            key: 'addr',
            label: 'Address',
            span: 'full' as const,
            values: [{ value: cityReg.address }]
          },
          ...(cityReg.locationStart
            ? [
                {
                  key: 'ls',
                  label: 'Location start',
                  values: [{ value: longDate(cityReg.locationStart) }]
                }
              ]
            : []),
          {
            key: 'le',
            label: 'Location end',
            values: [
              {
                value: cityReg.locationEnd ? longDate(cityReg.locationEnd) : 'Open'
              }
            ]
          },
          ...(cityReg.naics
            ? [
                {
                  key: 'naics',
                  label: 'NAICS',
                  values: [{ value: cityReg.naics }]
                }
              ]
            : [])
        ]
      : []

  return (
    <Surface
      id={FORMATION_CARD_ID}
      variant="card"
      padding="none"
      className={cn('scroll-mt-6 overflow-hidden', className)}
      aria-label={title}
      role="region"
    >
      {/* No source chip in a formation card's header: each field names its own
          — the name and form their corroborating filings, the date the
          domestic filing — and the filing view names every other. */}
      <CardHeader
        title={title}
        trailing={tier === 'formation' || soleItems ? undefined : chip}
        className={note ? 'border-b-0 pb-1' : undefined}
      />
      {note && (
        <div className="border-b border-[var(--core-color-border-divider)] px-4 pb-3">
          <span className="block text-sm leading-5 text-text-secondary">{note}</span>
        </div>
      )}
      <AttributeCells items={soleItems ?? items} className="-mb-px" />
      {strip && <FilingStrip record={record} lead={converted?.now ?? domestic ?? undefined} />}
      {/* The one registration view, as a single state filing shows it. */}
      {soleItems && cityReg && (
        <div className="border-t border-[var(--core-color-border-divider)]">
          <div className="px-4 pt-3">
            <Text size="sm" className="font-semibold">
              {cityReg.registry}
            </Text>
          </div>
          <AttributeCells items={soleRegistration} className="-mb-px" />
        </div>
      )}
      {/* The record's own insights about its filings, under the filing they
          are about: the lead filing's standing, a former domestic filing, the
          other filings and their statuses, whether it is registered where its
          office is, what it operates as. A row the card already shows — the
          entity type in the grid, a linked filing its note describes — is not
          repeated. */}
      <InsightsDisclosure
        open={revealsHere}
        rows={cardRows.map((r) => (
          <InsightRow
            key={r.insightId}
            result={r}
            record={record}
            negative={negatives.has(r.insightId)}
            reveal={revealed?.has(r.insightId)}
            onJumpToSource={onJumpToSource}
          />
        ))}
      />
    </Surface>
  )
}
