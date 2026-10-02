import * as RadixTooltip from '@radix-ui/react-tooltip'
import { ArrowUpRight, Building2, Clock, FileText, History } from 'lucide-react'
import type { ReactNode } from 'react'

import { ChatSourceChip, Surface, Text } from '@/core'

import { currentDomesticRows, formationIdentityRows, maskTin, websiteStatesName, type AttributeRow } from '../lib/attributes'
import { dbaRequirementNote, dbaRequirementOf, dbaRequirementValue } from '../lib/dbaRequirement'
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
  NOT_PROVIDED,
  registrationState,
  sameName
} from '../lib/registrationStatus'
import { dbasOf, nameStandingOf } from '../lib/businessNames'
import { priorNamesOf } from '../lib/nameHistory'
import { formatDate } from '../lib/reportLabels'
import { soleProprietorOf } from '../lib/soleProprietor'
import { stateName } from '../lib/states'
import type { BusinessRecord, Derived } from '../lib/deriveResults'
import type { Kind } from '../lib/timeline/types'
import { GROUPS, type GroupId } from '../lib/groups'
import { cn } from '../utils/twUtils'
import { AttributeCells, type AttributeCell } from './AttributeGrid'
import { attributeRowsByGroup } from './AttributesTab'
import { cellsFromRows } from './attributeCells'
import { CardHeader } from './CardHeader'
import { InsightRow } from './InsightRow'
import { InsightsDisclosure } from './InsightStack'
import { AttributeSources, SubmittedChip } from './Provenance'
import { CityStrip } from './Report/CityStrip'
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

/** FIREBIRD YARNS as Firebird Yarns, as the register spells it. */
const titleCase = (n: string) => n.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())

const TITLE: Record<Tier, string> = {
  formation: 'Formation',
  city: 'City registration',
  submitted: 'Submitted details not linked to a formation'
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

/** One row per fact: the same label and value from two producers is one row.
 *  A person is one row whatever label a producer gave them — Miette
 *  Patisserie's Meg Ray came back as "Person" from the person match and
 *  "Officer" from the website's, and read as two people. */
const dedupe = (rows: AttributeRow[]) => {
  const seen = new Set<string>()
  return rows.filter((r) => {
    const key =
      r.group === 'people' ? `people|${(r.value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')}` : `${r.label}|${r.value}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * No state filing and no city registration: what the submitted details were
 * matched against instead, from the checks that found them — never a reading
 * of what was not found beyond that it was not. Miette Patisserie: the
 * website shows the business name; nothing else matched.
 */
const submittedFoundNote = (record: BusinessRecord): string => {
  const verified = (key: string) =>
    /^verified$/i.test(record.reviewTasks.find((t) => t.key === key)?.subLabel ?? '')
  const found = [
    // Only a website states a name: a match off a social profile is not one.
    record.website?.url && verified('web_business_name_verification') ? 'the website shows the business name' : undefined,
    verified('web_person_verification') ? 'the website names the submitted person' : undefined,
    verified('web_address_verification') ? 'the website shows the submitted office address' : undefined,
    verified('address_verification') ? 'a source of record lists the submitted office address' : undefined
  ].filter((x): x is string => Boolean(x))
  const joined = found.length > 1 ? `${found.slice(0, -1).join(', ')} and ${found[found.length - 1]}` : found[0]
  return `No state filing or city registration was found for the submitted details. ${
    joined ? `${joined.charAt(0).toUpperCase()}${joined.slice(1)}.` : 'None of them were matched elsewhere.'
  }`
}

/**
 * The formation filing's standing, for the note. Where the state publishes
 * none — Delaware and New Jersey never do — the note says where and when it
 * was formed, and that the state publishes no status: how those registries
 * work, not something wrong with the business.
 */
const formationNote = (record: BusinessRecord): string | undefined => {
  const f = formationFilingOf(record)
  if (f && registrationState(f).silent) {
    const state = stateName(f.state)
    const year = /^\d{4}/.test(f.registrationDate ?? '') ? ` in ${f.registrationDate!.slice(0, 4)}` : ''
    return `Formed in ${state}${year}. ${state} does not publish filing status.`
  }
  return formationStandingNote(record)
}

/**
 * No filing anywhere, and the record classes the business a sole
 * proprietorship — from the IRS record or the name alone, never from a filing.
 * Kami Agbeti, Sara Stubbs: the entity type is all the formation holds.
 */
const classifiedSole = (record: BusinessRecord) =>
  record.registrations.length === 0 &&
  !record.formation?.state &&
  /sole/i.test(record.formation?.entityType ?? '')

/**
 * What the card says for a classified sole proprietorship: that no filing was
 * found, why none is expected, and what the IRS made of the TIN — the one
 * record that stands for the business here.
 */
const classifiedSoleNote = (record: BusinessRecord): string => {
  const tin = record.reviewTasks.find((t) => t.key === 'tin')?.subLabel ?? ''
  const irs = /^found$/i.test(tin)
    ? ' The IRS has a record of the TIN under the business name.'
    : /^not found$/i.test(tin)
      ? ' The IRS has no record of the TIN under the business name.'
      : ''
  const dba = dbaRequirementNote(record)
  return `No formation filing was found; a sole proprietorship does not file one with the state.${irs}${dba ? ` ${dba}` : ''}`
}

/**
 * The state's DBA rule as a cell in the grid: the requirement as the value,
 * who it is filed with and under what statute as its caption, and the page
 * the rule was confirmed against as its chip.
 */
const dbaRuleCell = (record: BusinessRecord): AttributeCell | undefined => {
  const d = dbaRequirementOf(record)
  if (!d) return undefined
  const r = d.rule
  const host = r.source ? new URL(r.source).hostname.replace(/^www\./, '') : undefined
  const caption = [r.office && `${r.office.replace(/^the /, '').replace(/^\w/, (c) => c.toUpperCase())}`, r.statute]
    .filter(Boolean)
    .join(' · ')
  return {
    key: 'dba-rule',
    label: `DBA requirement · ${stateName(d.state)}`,
    span: 'full',
    badge:
      r.source && host ? (
        <ChatSourceChip
          sources={[
            {
              id: `dba-rule-${d.state}`,
              label: host,
              domain: host,
              title: r.statute ?? `${stateName(d.state)} DBA rule`,
              url: r.source,
              annotation: 'Where the rule was confirmed',
              badge: <ArrowUpRight aria-label="Opens in a new tab" size={12} strokeWidth={2} className="text-text-secondary" />
            }
          ]}
        />
      ) : undefined,
    values: [
      {
        value: dbaRequirementValue(r),
        note: caption ? <span className="text-caption text-text-secondary">{caption}</span> : undefined
      }
    ]
  }
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
      : sole || (tier === 'formation' && classifiedSole(record))
        ? 'Likely sole proprietorship'
        : TITLE[tier]
}

/**
 * Not issued: the IRS holds no record of the number yet. For a business
 * formed in the last few months that is the IRS's processing delay, not a
 * finding, and the note says so — with how recently it was formed.
 */
const tinNoteOf = (record: BusinessRecord): string | undefined => {
  const tinRec = record.tin as { tin?: string; issued?: boolean } | null
  if (!tinRec?.tin || tinRec.issued !== false) return undefined
  const formedDays = record.formation?.date
    ? Math.floor((Date.now() - new Date(`${record.formation.date}T00:00:00`).getTime()) / 86_400_000)
    : undefined
  return formedDays !== undefined && formedDays <= 120
    ? `The IRS has not issued the TIN yet. The business was formed ${formedDays === 0 ? 'today' : `${formedDays} day${formedDays === 1 ? '' : 's'} ago`}, and new businesses often take a few weeks to appear in the IRS database.`
    : 'The TIN has not been issued by the IRS.'
}

/**
 * The card's sentence, as it reads under the title — for the card and for
 * the Assistant's opening message, which says it word for word.
 *
 * A formation on another record is not this business's formation until
 * someone confirms it; the note says what it is. A formation that is — a
 * domestic filing in the formation state, under the business's own name —
 * says whether it is still the filing the business stands on. With no filing,
 * what was found instead.
 */
export const formationCardSummary = (
  record: BusinessRecord,
  results: Derived[],
  groupFor: (insightId: string) => GroupId
): string | undefined => {
  const linked = domesticFilingOf(record)?.linked
  const converted = !linked ? convertedFormationOf(record) : undefined
  const domestic = formationCardFilingOf(record)
  const rows = allRows(record, results, groupFor)
  const tier: Tier =
    record.formation || domestic
      ? 'formation'
      : rows.some((r) => (r.sources ?? []).includes(CITY))
        ? 'city'
        : 'submitted'
  const strong = !linked && tier === 'formation' && formationConfirmed(record) && sameName(domestic?.name, record.name)
  // No state filing at all, and a city registration in the submitted person's own name.
  const sole = !linked && tier !== 'formation' ? soleProprietorOf(record) : undefined
  const tinNote = tinNoteOf(record)
  const note = linked
    ? linkedFormationNote(record, linked, stateName)
    : strong
      ? converted
        ? convertedFormationNote(converted)
        : [formationNote(record), registrationsNote(record, domestic?.state)].filter(Boolean).join(' ') || undefined
      : sole
        ? /* What was not found, what was, and what it suggests — generic: the
             grid under it names the owner, the DBA and the city. */
          // Not "city" or "state": a DBA is a city registration in San
          // Francisco and a fictitious name filed with the state in Florida.
          `No formation filing was found. A DBA registration ${
            nameStandingOf(record).category === 'DBA_OF_PERSON'
              ? 'lists the owner doing business as the DBA name'
              : "is in the owner's own name"
          } at the submitted office address, suggesting it is likely a sole proprietorship.${(() => {
            const dba = dbaRequirementNote(record)
            return dba ? ` ${dba}` : ''
          })()}`
        : tier === 'submitted'
          ? submittedFoundNote(record)
          : tier === 'formation' && classifiedSole(record)
            ? classifiedSoleNote(record)
            : undefined
  // Beside the IRS note the filing reads as plain fact: "is active", not "is still active".
  return [tinNote ? note?.replace(/ is still active/, ' is active') : note, tinNote].filter(Boolean).join(' ') || undefined
}

/** The tooltip the state filing tiles use, over a quiet icon button. */
const HoverTip = ({
  label,
  icon,
  onClick,
  children
}: {
  label: string
  icon: ReactNode
  onClick?: () => void
  children: ReactNode
}) => (
  <RadixTooltip.Provider>
    <RadixTooltip.Root delayDuration={200}>
      <RadixTooltip.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={onClick}
          className="ml-1.5 inline-flex translate-y-[2px] items-center text-text-secondary hover:text-text-primary"
        >
          {icon}
        </button>
      </RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side="top"
          sideOffset={6}
          collisionPadding={10}
          className="core-theme z-popover max-w-64 rounded-popover border border-border bg-popover px-3 py-2 text-caption text-popover-foreground shadow-elevation-popover"
        >
          <div className="flex flex-col">{children}</div>
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  </RadixTooltip.Provider>
)

const MARK = { 'aria-hidden': true, size: 12, strokeWidth: 2, className: 'shrink-0' } as const

/**
 * The names the legal name's filing has dropped, behind a past icon beside
 * it: Sprig's California filing was USERLEAP INC.
 */
const NameHistory = ({
  names,
  onOpen
}: {
  names: Array<{ name: string; state?: string; at: string; eventId: string }>
  /** Open the timeline on the change — the newest one. */
  onOpen?: (eventId: string) => void
}) => {
  const count = `${names.length} name change${names.length === 1 ? '' : 's'}`
  return (
    <HoverTip
      label={count}
      icon={<History aria-hidden="true" size={14} strokeWidth={2} />}
      onClick={onOpen ? () => onOpen(names[0].eventId) : undefined}
    >
      <span className="font-semibold text-foreground">Previous names</span>
      {/* One row per name, newest first, each with the date the timeline
          shows for its change. */}
      {names.map((n) => (
        // One row per change, as the timeline lists them, each with its
        // filing's state. One line each: a long name is cut short —
        // CHANGEORG INC WHICH WILL DO BUSINESS IN… — and read in full there.
        <span key={n.eventId} className="flex items-center justify-between gap-4">
          <span className="flex min-w-0 items-center gap-1">
            <History {...MARK} />
            {n.state && <span className="shrink-0 text-text-secondary">{n.state}</span>}
            <span className="truncate">{n.name}</span>
          </span>
          <span className="shrink-0 text-text-secondary">{formatDate(n.at)}</span>
        </span>
      ))}
      {/* Where they come from, under a rule as the tiles' notes are: the
          business timeline, opened on the change. */}
      {onOpen && (
        <div className="mt-1.5 border-t border-[var(--core-color-border-divider)] pt-1.5">
          <button
            type="button"
            onClick={() => onOpen(names[0].eventId)}
            className="flex items-center gap-1 text-text-secondary hover:text-text-primary"
          >
            <Clock {...MARK} />
            View timeline
          </button>
        </div>
      )}
    </HoverTip>
  )
}

/**
 * The businesses a city register lists this name as a DBA of, behind a paper
 * icon beside it: San Francisco lists Sprig Technologies Inc as Mixboard
 * Inc.'s.
 */
const ListedAsDba = ({ owners }: { owners: string[] }) => (
  <HoverTip label={`Listed as DBA for ${owners.join(', ')}`} icon={<FileText aria-hidden="true" size={14} strokeWidth={2} />}>
    <span className="font-semibold text-foreground">Listed as DBA for</span>
    {owners.map((o) => (
      <span key={o} className="flex items-center gap-1">
        <Building2 {...MARK} />
        {o}
      </span>
    ))}
  </HoverTip>
)

export const FormationCard = ({
  record,
  results,
  groupFor,
  revealed,
  onJumpToSource,
  onJumpToTimeline,
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
  /** The name history icon opens the timeline on that change, filtered to
   *  the change types given. */
  onJumpToTimeline?: (eventId: string, kinds?: Kind[]) => void
  className?: string
}) => {
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
  /* A linked formation leads the strip too: Sprig's Delaware filing is on the
     Mixboard Inc. record, and it is the filing the card stands on, so it
     sits first, before Sprig's own California registration. */
  const stripRecord: BusinessRecord = linked
    ? {
        ...record,
        registrations: [
          linked.filing,
          ...record.registrations.filter(
            (f) => !(f.state === linked.filing.state && f.fileNumber === linked.filing.fileNumber)
          )
        ]
      }
    : record
  const strip = tier === 'formation' && stripRecord.registrations.length > 0
  const COUNTED = new Set(['sos_active', 'sos_inactive', 'sos_unknown', 'sos_status', 'sos_not_found'])
  const cardRows = FORMATION_CARD_INSIGHTS.flatMap((id) =>
    results.filter(
      (r) =>
        r.insightId.split(':')[0] === id && r.state !== 'unknown' && !alreadyShown(id) && !(strip && COUNTED.has(id))
    )
  )
  /* A citation that leads to one of the card's rows opens its insights. One
     that leads to a check the grid states as a field — the status, the sub
     status, the entity type — has no row, and the grid is always out. */
  const revealsHere = cardRows.some((r) => revealed?.has(r.insightId))

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

  /* A linked formation, but a filing of the business's own under its own
     name: Sprig's California foreign registration reads SPRIG TECHNOLOGIES
     INC. That is its legal name, cited to that filing alone; the Delaware
     filing's MIXBOARD INC. is its name on filing, in the strip. */
  const ownFilings = linked ? record.registrations.filter((f) => sameName(f.name, record.name)) : []
  const legalName = ownFilings[0]?.name ?? domestic?.name ?? record.name
  const identityRows =
    ownFilings.length > 0
      ? shownRows.map((r) =>
          r.label === 'Legal name'
            ? { ...r, value: ownFilings[0].name as string, registrations: ownFilings, sources: [], source: '' }
            : r
        )
      : shownRows

  const cells = cellsFromRows(identityRows, {
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
  // Every name change on the business's filings, beside its legal name.
  const priorNames = tier === 'formation' && lead?.label === 'Legal name' ? priorNamesOf(record) : []
  /* The names the business trades under, beside its legal name: Andytown LLC
     as Andytown, Andytown Coffee Roasters. The names only — who owns them is
     the legal name beside them. Cited by whatever states them — the city
     registration or a name on file. A formation with none says so. */
  // Every trade name still open, as the dashboard lists them — a closed one
  // is history, and stays in Sources with its dates — but the legal name
  // beside it: Userleap's card reads
  // MIXBOARD INC., so Userleap Inc. is one of the names it trades under;
  // Sprig's reads its own name, so Sprig Technologies Inc is not.
  const dbas =
    tier === 'formation' ? dbasOf(record, true).filter((d) => d.open !== false && !sameName(d.name, legalName)) : []
  /* The legal name itself, where a register lists it as another business's
     DBA: San Francisco lists Sprig Technologies Inc under Mixboard Inc. It
     shows under DBA as the legal name spells it, with who lists it. */
  const listedFor = [
    ...new Set(
      (tier === 'formation' ? dbasOf(record, true) : [])
        .filter((d) => d.open !== false && sameName(d.name, legalName) && d.owner && !sameName(d.owner, legalName))
        .map((d) => d.owner as string)
    )
  ]
  const dbaEntries: Array<{ name: string; owners?: string[] }> = [
    ...(listedFor.length > 0 ? [{ name: legalName, owners: listedFor }] : []),
    ...dbas.map((d) => ({ name: d.name }))
  ]
  const dbaSources = [
    ...new Set([
      ...dbas.map((d) => (d.city ? CITY : d.source)),
      ...(listedFor.length > 0 ? [CITY] : [])
    ])
  ]
  const dbaCell: AttributeCell | undefined =
    tier === 'formation' && lead?.label === 'Legal name'
      ? {
          key: 'dba',
          label: 'Doing business as (DBA)',
          ...(dbaEntries.length > 0
            ? {
                badge: (
                  <AttributeSources
                    sources={dbaSources}
                    domesticState={domesticState}
                    onJumpToSource={onJumpToSource}
                  />
                )
              }
            : {}),
          values: [
            {
              value:
                dbaEntries.length > 0 ? (
                  dbaEntries.map((d, i) => (
                    <span key={d.name}>
                      {i > 0 && ', '}
                      {d.name}
                      {d.owners && <ListedAsDba owners={d.owners} />}
                    </span>
                  ))
                ) : (
                  <span className="text-text-secondary">None submitted</span>
                )
            }
          ]
        }
      : undefined
  /* The TIN, when the record holds one: the number obscured to its last four,
     submitted by the customer and checked against the IRS — the check's own
     row is the card's (`tin` in FORMATION_CARD_INSIGHTS). */
  const tinRec = record.tin as { tin?: string; verified?: boolean; mismatch?: boolean; issued?: boolean } | null
  /* Whom the IRS matched the number to: the business (`verified_by:
     "business"`), a person, or — unverified — nobody. */
  const verifiedBy = (record.tin as { verified_by?: string | null } | null)?.verified_by ?? null
  const tinName = (record.tin as { name?: string } | null)?.name
  const tinMatch = verifiedBy
    ? { title: tinName ?? undefined, note: /business/i.test(verifiedBy) ? 'Business name' : 'Individual' }
    : { title: 'No match on the IRS record', note: 'IRS TIN record' }
  const tinCell: AttributeCell | undefined = tinRec?.tin
    ? {
        key: 'tin',
        label: 'TIN',
        badge: (
          <span className="flex flex-wrap items-center gap-1">
            <SubmittedChip verified={Boolean(tinRec.verified) && !tinRec.mismatch} onJumpToSource={onJumpToSource} />
            <AttributeSources
              sources={['IRS TIN record']}
              // The chip stays "IRS TIN record"; its preview names whom the IRS
              // matched the number to — a business name or an individual —
              // and says so when it matched nobody.
              title={tinMatch.title}
              note={tinMatch.note}
              domesticState={record.formation?.state}
              onJumpToSource={onJumpToSource}
            />
          </span>
        ),
        values: [
          {
            value: maskTin(tinRec.tin)
          }
        ]
      }
    : undefined

  const items = [
    {
      ...lead,
      // No filing to cite, but the website states the name: Miette
      // Patisserie's site shows MIETTE PATISSERIE & CONFISERIE.
      ...(tier === 'submitted' && lead.label === 'Business name' && websiteStatesName(record, record.name)
        ? {
            badge: (
              <AttributeSources
                sources={['Website']}
                domesticState={record.formation?.state}
                onJumpToSource={onJumpToSource}
              />
            )
          }
        : {}),
      ...(dbaCell ? {} : { span: 'full' as const }),
      values: lead.values.map((v, i) => ({
        ...v,
        value: (
          <>
            <span>{v.value}</span>
            {i === 0 && priorNames.length > 0 && <NameHistory names={priorNames} onOpen={onJumpToTimeline && ((id) => onJumpToTimeline(id, ['name']))} />}
          </>
        )
      }))
    },
    ...(dbaCell ? [dbaCell] : []),
    // The formation date is the domestic filing's, and says so: with no
    // chip in the card's header, the date carries its own source.
    ...rest.map((c) =>
      c.values.some((v) => v.value === NOT_PROVIDED)
        ? {
            ...c,
            badge: undefined,
            values: c.values.map((v) =>
              v.value === NOT_PROVIDED ? { ...v, value: <span className="text-text-secondary">{NOT_PROVIDED}</span> } : v
            )
          }
        : c.label === 'Formation date' && tier === 'formation' && domestic
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
    ),
    ...(tinCell ? [tinCell] : []),
    // A sole proprietor with no filing: what the state of its office asks of a trade name.
    ...(tier === 'formation' && classifiedSole(record) ? [dbaRuleCell(record)].filter((c): c is AttributeCell => Boolean(c)) : [])
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
      <SubmittedChip verified={websiteStatesName(record, record.name)} onJumpToSource={onJumpToSource} />
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
            : []),
          ...(tinCell ? [tinCell] : []),
          ...[dbaRuleCell(record)].filter((c): c is AttributeCell => Boolean(c))
        ]
      : null

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
          domestic filing — and the filing view names every other. No sentence
          under it: that is the Assistant's opening message now
          (`formationCardSummary`), and the card leads with its grid. */}
      <CardHeader title={title} trailing={tier === 'formation' || tier === 'submitted' || soleItems ? undefined : chip} />
      <AttributeCells items={soleItems ?? items} columns={3} className="-mb-px" />
      {strip && <FilingStrip record={stripRecord} lead={converted?.now ?? domestic ?? undefined} legalName={legalName} />}
      {/* The city registrations, as the state filings are shown. */}
      {soleItems && cityReg && <CityStrip regs={record.cityRegistrations ?? []} />}
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
