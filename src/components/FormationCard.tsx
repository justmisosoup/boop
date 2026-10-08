import * as RadixTooltip from '@radix-ui/react-tooltip'
import { ArrowUpRight, Building2, FileText } from 'lucide-react'
import type { ReactNode } from 'react'

import { ChatSourceChip, Text } from '@/core'

import {
  corroborated,
  currentDomesticRows,
  formationIdentityRows,
  maskTin,
  websiteStatesName,
  type AttributeRow
} from '../lib/attributes'
import { dbaRequirementNote, dbaRequirementOf } from '../lib/dbaRequirement'
import {
  domesticFilingOf,
  formationCardFilingOf,
  linkedFormationNote
} from '../lib/linkedFormation'
import {
  convertedFormationNote,
  convertedFormationOf,
  formationConfirmed,
  formationFilingOf,
  formationStandingNote,
  NOT_PROVIDED,
  registrationState,
  article,
  sameName,
  type Registration
} from '../lib/registrationStatus'
import { entityTypeShown } from '../lib/normalise'
import { trueEntityType } from '../lib/deriveResults'
import { dbasOf, displayName, nameStandingOf } from '../lib/businessNames'
import { priorNamesOf } from '../lib/nameHistory'
import { formatDate } from '../lib/reportLabels'
import { soleProprietorOf } from '../lib/soleProprietor'
import { stateName } from '../lib/states'
import type { BusinessRecord, Derived } from '../lib/deriveResults'
import type { Kind } from '../lib/timeline/types'
import { GROUPS, type GroupId } from '../lib/groups'
import type { AttributeCell } from './AttributeGrid'
import { attributeRowsByGroup } from './AttributesTab'
import { cellsFromRows } from './attributeCells'
import { AttributeSources } from './Provenance'
import { readableUrl } from '../lib/sourceLabels'
import { cityRegistrationSources } from './SourceChip'
import { docCard, namedCard } from '../lib/sourceCards'
import { FilingStrip, StatusChip, SubStatusChip, otherStateStandings } from './Report/FilingStrip'

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
      r.group === 'people'
        ? `people|${(r.value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')}`
        : `${r.label}|${r.value}`
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
    record.website?.url && verified('web_business_name_verification')
      ? 'the website shows the business name'
      : undefined,
    verified('web_person_verification') ? 'the website names the submitted person' : undefined,
    verified('web_address_verification')
      ? 'the website shows the submitted office address'
      : undefined,
    verified('address_verification')
      ? 'a source of record lists the submitted office address'
      : undefined
  ].filter((x): x is string => Boolean(x))
  const joined =
    found.length > 1 ? `${found.slice(0, -1).join(', ')} and ${found[found.length - 1]}` : found[0]
  return `No state filing or city registration was found for the submitted details. ${
    joined
      ? `${joined.charAt(0).toUpperCase()}${joined.slice(1)}.`
      : 'None of them were matched elsewhere.'
  }`
}

/**
 * The formation filing's standing, for the note. Where the state publishes
 * none — Delaware and New Jersey never do — the note says where and when it
 * was formed, and that the state publishes no status: how those registries
 * work, not something wrong with the business.
 */
/**
 * What the formation is, in the order a reviewer checks it: what it was formed
 * as, where and when; its status; and whether the filed name is the submitted
 * one. "The formation filing is still active" said only the second of these.
 */
const formationNote = (record: BusinessRecord): string | undefined => {
  const f = formationFilingOf(record)
  if (!f) return formationStandingNote(record)
  const state = stateName(f.state)
  const type = String(
    entityTypeShown(
      record,
      trueEntityType(record) ?? f.entityType ?? record.formation?.entityType
    ) ?? ''
  )
  const noun =
    !type || /^unknown$/i.test(type)
      ? ''
      : /^[A-Z]{2}/.test(type)
        ? type
        : type.charAt(0).toLowerCase() + type.slice(1)
  const iso = f.registrationDate ?? record.formation?.date
  const when = iso ? longDate(iso) : undefined
  // "The Mala Market, LLC was formed in Tennessee as a limited liability
  // company (LLC) on September 14, 2017."
  const formed = `${displayName(record.name)} was formed in ${state}${noun ? ` as ${article(noun)} ${noun}` : ''}${when ? ` on ${when}` : ''}.`
  const status = registrationState(f).silent
    ? `${state} does not publish filing status.`
    : formationStandingNote(record)
        ?.replace(/^The formation filing is still active/, 'Its filing is active')
        .replace(/^The formation filing is no longer active/, 'Its filing is no longer active')
  const name = filedNameNote(record, f)
  // One sentence where the filing is simply standing and the name agrees:
  // "Its filing is active, and the filed name matches the one submitted."
  if (
    status &&
    /^Its filing is (no longer )?active\.$/.test(status) &&
    name === FILED_NAME_MATCHES
  ) {
    return `${formed} ${status.slice(0, -1)}, and the filed name matches the one submitted.`
  }
  return [formed, status, name].filter(Boolean).join(' ')
}

/** "September 14, 2017": a date in prose, not a cell. */
const longDate = (iso: string) => {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

const FILED_NAME_MATCHES = 'The filed name matches the one submitted.'

/** Whether the filing's name is the one the customer submitted. */
const filedNameNote = (record: BusinessRecord, f: Registration) => {
  const submitted = (record.names ?? []).find((n) => n.submitted)?.name ?? record.name
  if (!f.name) return undefined
  return sameName(f.name, submitted)
    ? FILED_NAME_MATCHES
    : `It is filed as ${f.name}, not the submitted ${submitted}.`
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
  return `No formation filing was found; as a likely sole proprietorship, it would not file one with the state.${irs}${dba ? ` ${dba}` : ''}`
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
  const caption = [
    r.office && `${r.office.replace(/^the /, '').replace(/^\w/, (c) => c.toUpperCase())}`,
    r.statute
  ]
    .filter(Boolean)
    .join(' · ')
  const s = stateName(d.state)
  /* What the record holds against what the state asks: no DBA on record,
     however California requires one for a trade name. */
  const value =
    r.requirement === 'required'
      ? d.ownName
        ? `No DBA needed: the business name is the owner's own name`
        : d.found
          ? `DBA filing found; ${s} requires one for a trade name`
          : `No DBA on record, however ${s} requires a DBA for a trade name`
      : r.requirement === 'optional'
        ? `Optional in ${s}`
        : `No DBA filing in ${s}`
  // The law, with the page it was confirmed on beside it.
  const lawChip =
    r.source && host ? (
      <ChatSourceChip
        sources={[
          {
            id: `dba-rule-${d.state}`,
            label: host,
            domain: host,
            title: r.statute ?? `${s} DBA rule`,
            url: r.source,
            annotation: 'Where the rule was confirmed',
            badge: (
              <ArrowUpRight
                aria-label="Opens in a new tab"
                size={12}
                strokeWidth={2}
                className="text-text-secondary"
              />
            )
          }
        ]}
      />
    ) : undefined
  return {
    key: 'dba-rule',
    label: `DBA requirement · ${s}`,
    span: 'full',
    values: [
      {
        value,
        note:
          caption || lawChip ? (
            <span className="flex flex-wrap items-center gap-1.5 text-caption text-text-secondary">
              {caption && <span>{caption}</span>}
              {lawChip}
            </span>
          ) : undefined
      }
    ]
  }
}

/**
 * The other registrations, in a sentence: where the business is active, and
 * that some registrations have lapsed. Counted, not listed — the strip shows
 * the states. No-status states are not mentioned: silence is the registry's.
 */
const registrationsNote = (
  record: BusinessRecord,
  formationState?: string | null
): string | undefined => {
  const s = otherStateStandings(record, formationState)
  if (s.total === 0) return undefined
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
  const active =
    s.active > 0 ? `Active in ${plural(s.active, 'other state', 'other states')}` : undefined
  const inactive =
    s.inactive > 0
      ? `${plural(s.inactive, 'registration is', 'registrations are')} inactive`
      : undefined
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
  const strong =
    !linked &&
    tier === 'formation' &&
    formationConfirmed(record) &&
    sameName(domestic?.name, record.name)
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
    ? Math.floor(
        (Date.now() - new Date(`${record.formation.date}T00:00:00`).getTime()) / 86_400_000
      )
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
  const strong =
    !linked &&
    tier === 'formation' &&
    formationConfirmed(record) &&
    sameName(domestic?.name, record.name)
  // No state filing at all, and a city registration in the submitted person's own name.
  const sole = !linked && tier !== 'formation' ? soleProprietorOf(record) : undefined
  const tinNote = tinNoteOf(record)
  const note = linked
    ? linkedFormationNote(record, linked, stateName)
    : strong
      ? converted
        ? [convertedFormationNote(converted), filedNameNote(record, converted.now)]
            .filter(Boolean)
            .join(' ')
        : [formationNote(record), registrationsNote(record, domestic?.state)]
            .filter(Boolean)
            .join(' ') || undefined
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
  return (
    [tinNote ? note?.replace(/ is still active/, ' is active') : note, tinNote]
      .filter(Boolean)
      .join(' ') || undefined
  )
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
 * Why another business is one of this one's names, behind a paper icon beside
 * it: a city register lists this business's legal name as that business's
 * DBA — San Francisco lists SPRIG TECHNOLOGIES INC. under Mixboard Inc.
 */
const ListedAsDbaOf = ({ legalName, owner }: { legalName: string; owner: string }) => (
  <HoverTip
    label={`${legalName} is listed as a DBA of ${owner}`}
    icon={<FileText aria-hidden="true" size={14} strokeWidth={2} />}
  >
    <span className="text-foreground">
      <span className="font-semibold">{legalName}</span> is listed as a DBA of
    </span>
    <span className="flex items-center gap-1">
      <Building2 {...MARK} />
      {owner}
    </span>
  </HoverTip>
)

/** What the grouped report draws from the formation record, dealt out by group. */
export type FormationParts = {
  /** Names: the legal name, with its history, and the DBAs — or a sole
   *  proprietor's DBA name and owner. */
  names: AttributeCell[]
  /** Formation: the entity type, the formation date, the domestic filing's
   *  state and standing, and a sole proprietor's DBA rule. */
  formation: AttributeCell[]
  /** The Formation card's tag: the domestic filing, or Submitted. */
  formationChip?: ReactNode
  /** Tax ID: the TIN, when the record holds one. */
  tin?: AttributeCell
  /** Registrations: the state filings strip, led by the filing the business stands on. */
  strip?: { record: BusinessRecord; lead?: Registration; legalName: string }
  /** A sole proprietor's city registrations, as the state filings are shown. */
  city?: NonNullable<BusinessRecord['cityRegistrations']>
  /** What the office's state asks of a trade name, for a sole proprietor: an
   *  "Other filings" chip, beside any city registration. */
  dbaRule?: AttributeCell
}

const NO_PARTS: FormationParts = { names: [], formation: [] }

/** The standing fields, named as the formation's own. */
const FORMATION_LABEL: Record<string, string> = {
  Status: 'Formation status',
  'Sub status': 'Formation sub status',
  'Status details': 'Formation status details'
}

/** The domestic filing's own fields, each cited to it. */
const FROM_FILING = new Set([
  'Formation date',
  'Formation state',
  'Status',
  'Sub status',
  'Status details'
])

/**
 * The formation record, read once and dealt out by group for the grouped
 * report: the Names, Formation, Tax ID and Registrations cards each take
 * their part. One reading, so the four cards cannot disagree about which
 * filing the business stands on.
 *
 * Which record there is, strongest first: the domestic Secretary of State
 * filing, a city registration, and — when the record holds nothing found —
 * what the customer submitted.
 */
export const formationParts = (
  record: BusinessRecord,
  results: Derived[],
  groupFor: (insightId: string) => GroupId,
  onJumpToSource?: (cardId: string) => void,
  onJumpToTimeline?: (eventId: string, kinds?: Kind[]) => void
): FormationParts => {
  /* No formation of its own, but one on another record that looks linked —
     Sprig's Delaware filing sits on the Mixboard Inc. record. The cards show
     that filing, and the Assistant's sentence says it was not found for this
     business and how it was linked. */
  const found = domesticFilingOf(record)
  const linked = found?.linked
  // Converted out of the state it was formed in: the cards lead with the
  // domestic filing it stands on now (Andytown's Delaware one).
  const converted = !linked ? convertedFormationOf(record) : undefined
  const domestic = formationCardFilingOf(record)
  const domesticState = linked
    ? linked.filing.state
    : converted
      ? converted.now.state
      : record.formation?.state

  // Which record there is, strongest first.
  const rows = allRows(record, results, groupFor)
  const cityRows = rows.filter((r) => (r.sources ?? []).includes(CITY))

  const tier: Tier =
    record.formation || domestic ? 'formation' : cityRows.length > 0 ? 'city' : 'submitted'

  const tierRows =
    tier === 'formation'
      ? converted
        ? currentDomesticRows(record, converted.now)
        : formationIdentityRows(linked?.record ?? record)
      : dedupe(tier === 'city' ? cityRows : rows.filter((r) => r.submitted))

  /* A linked formation leads the strip too: Sprig's Delaware filing is on the
     Mixboard Inc. record, and it is the filing the business stands on, so it
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

  /* The Formation card's tag names its filing once. A value other sources
     state too — the name 21 filings are under, the form they all declare —
     shows every source that states it, this filing included, so it reads as
     what the record agrees on rather than one filing's word. Everything else
     is the filing's alone, and the tag already cites it. */
  const isCardFiling = (f: BusinessRecord['registrations'][number]) =>
    Boolean(domestic) && f.state === domestic?.state && f.fileNumber === domestic?.fileNumber
  // A chip only where something beyond the card's own filing states the value
  // — and then only that: the tag already names the card's filing, so the
  // chip lists the OTHER sources that agree, not the one on screen again.
  const corroboratedBeyondCard = (r: AttributeRow) =>
    (r.registrations ?? []).some((f) => !isCardFiling(f)) || (r.sources ?? []).length > 0
  /* With the strip, the legal name and the entity type cite the formation
     filing themselves — first, as the formation date does — and then the
     other filings that agree: "SOS · DE +58". */
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
            ? {
                ...r,
                value: ownFilings[0].name as string,
                registrations: ownFilings,
                sources: [],
                source: ''
              }
            : r
        )
      : shownRows

  const cells = cellsFromRows(identityRows, {
    domesticState,
    onJumpToSource,
    // The source is named once, on the card's tag; only corroboration beyond it shows.
    provenance: tier === 'formation',
    // The standing row's "order a certificate" line is a reading of the
    // absence, which is what the note slot is for.
    evidence: true
  })
  if (cells.length === 0) return NO_PARTS

  /* No field is held back for the strip: the Formation card states the
     domestic filing's state and standing as fields, and the strip, on the
     Registrations card, states where every filing stands. */
  const [lead, ...rest] = cells
  // Every name change on the business's filings, beside its legal name.
  const priorNames =
    tier === 'formation' && lead?.label === 'Legal name' ? priorNamesOf(record) : []
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
    tier === 'formation'
      ? dbasOf(record, true).filter((d) => d.open !== false && !sameName(d.name, legalName))
      : []
  /* The legal name itself, where a register lists it as another business's
     DBA: San Francisco lists Sprig Technologies Inc under Mixboard Inc. It
     shows under DBA as the legal name spells it, with who lists it. */
  const listedFor = [
    ...new Set(
      (tier === 'formation' ? dbasOf(record, true) : [])
        .filter(
          (d) =>
            d.open !== false &&
            sameName(d.name, legalName) &&
            d.owner &&
            !sameName(d.owner, legalName)
        )
        .map((d) => d.owner as string)
    )
  ]
  /* Where a register lists the legal name as another business's DBA, the
     other business is the alternative name, with a tip saying which way
     round: San Francisco lists SPRIG TECHNOLOGIES INC. under Mixboard Inc. */
  // What kind of other name each is, by where it was found: a fictitious
  // business name filing, a trademark, or otherwise a DBA.
  const nameType = (source?: string) =>
    /fictitious|assumed name|\bfbn\b/i.test(source ?? '')
      ? 'FBN'
      : /trademark|uspto/i.test(source ?? '')
        ? 'Trademark'
        : 'DBA'
  const dbaEntries: Array<{ name: string; dbaOf?: boolean; type: string }> = [
    ...listedFor.map((owner) => ({ name: owner, dbaOf: true, type: 'DBA' })),
    ...dbas.map((d) => ({ name: d.name, type: nameType(d.source) }))
  ]
  // Each follows to the city registration in Sources — a chip with somewhere
  // to go is a chip that previews.
  // One chip per city; each registration is its own card in Sources, so the
  // chip follows to that city's open registration, else its newest.
  const cityCard = (chipId: string) => {
    const regs = (record.cityRegistrations ?? []).filter(
      (r) => `city-${r.city}|${r.state}` === chipId && r.refId
    )
    const open =
      regs.find((r) => !r.locationEnd && !r.businessEnd) ??
      [...regs].sort((a, b) => (b.locationStart ?? '').localeCompare(a.locationStart ?? ''))[0]
    if (open?.refId) return docCard(open.refId)
    const ref = (record.names ?? [])
      .flatMap((n) => n.sourceRefs ?? [])
      .find(
        (x) =>
          x.type === 'city_registration' &&
          `city-${(x.metadata as { city?: string }).city}|${(x.metadata as { state?: string }).state}` ===
            chipId
      )
    return ref ? docCard(ref.id) : namedCard(CITY)
  }
  const cityChips = cityRegistrationSources(record).map((c) => ({
    ...c,
    onSelect: onJumpToSource ? () => onJumpToSource(cityCard(c.id)) : undefined
  }))
  const dbaSources = [
    ...new Set([
      ...dbas.map((d) => (d.city ? CITY : d.source)),
      ...(listedFor.length > 0 ? [CITY] : [])
    ])
  ]
  // One row per kind — DBA, FBN, Trademark — each with its own names.
  const dbaCells: AttributeCell[] =
    tier === 'formation' && lead?.label === 'Legal name'
      ? ['DBA', 'FBN', 'Trademark'].flatMap((type) => {
          const entries = dbaEntries.filter((d) => d.type === type)
          if (entries.length === 0) return []
          return [
            {
              key: `dba-${type}`,
              label: type,
              // A city registration previews as a filing does: the city
              // and its standing, the name and owner it is under.
              badge: (
                <AttributeSources
                  sources={dbaSources.filter((x) => x !== CITY || cityChips.length === 0)}
                  extra={dbaSources.includes(CITY) ? cityChips : undefined}
                  domesticState={domesticState}
                  onJumpToSource={onJumpToSource}
                />
              ),
              values: entries.map((d) => ({
                key: d.name,
                value: (
                  <>
                    <span>{d.name}</span>
                    {d.dbaOf && <ListedAsDbaOf legalName={legalName} owner={d.name} />}
                  </>
                )
              }))
            }
          ]
        })
      : []
  /* The TIN, when the record holds one: the number obscured to its last four,
     submitted by the customer and checked against the IRS — the check's own
     row is the Tax ID card's. */
  const tinRec = record.tin as {
    tin?: string
    verified?: boolean
    mismatch?: boolean
    issued?: boolean
  } | null
  /* Whom the IRS matched the number to: the business (`verified_by:
     "business"`), a person, or — unverified — nobody. */
  const verifiedBy = (record.tin as { verified_by?: string | null } | null)?.verified_by ?? null
  const tinName = (record.tin as { name?: string } | null)?.name
  const tinMatch = verifiedBy
    ? {
        title: tinName ?? undefined,
        note: /business/i.test(verifiedBy) ? 'Business name' : 'Individual'
      }
    : { title: 'No match on the IRS record', note: 'IRS TIN record' }
  const tinCell: AttributeCell | undefined = tinRec?.tin
    ? {
        key: 'tin',
        label: 'TIN',
        // Its own card, so the cell takes the width.
        span: 'full',
        badge: (
          // The submitted number, and under it the IRS record: its preview
          // names whom the IRS matched the number to — a business name or an
          // individual — and says so when it matched nobody.
          <AttributeSources
            sources={['IRS TIN record']}
            submitted={{ verified: Boolean(tinRec.verified) && !tinRec.mismatch }}
            title={tinMatch.title}
            note={tinMatch.note}
            domesticState={record.formation?.state}
            onJumpToSource={onJumpToSource}
          />
        ),
        values: [
          {
            value: (
              <span className="font-medium">
                {verifiedBy && tinName ? tinName : maskTin(tinRec.tin)}
              </span>
            ),
            note: (
              <span className="text-caption text-text-secondary">
                {verifiedBy && tinName
                  ? `${maskTin(tinRec.tin)} · ${tinMatch.note}`
                  : tinMatch.title}
              </span>
            )
          }
        ]
      }
    : undefined

  // Submitted, and verified where a filing (or, with none, the website) states
  // it: the mark after the name, as a verified address or person carries.
  const leadRow = identityRows[0]
  const leadSubmitted = Boolean(leadRow?.submitted) || (tier === 'submitted' && lead.label === 'Business name')
  const leadVerified =
    tier === 'submitted' ? websiteStatesName(record, record.name) : Boolean(leadRow && corroborated(leadRow))
  const leadCell: AttributeCell = {
    ...lead,
    submitted: leadSubmitted,
    verified: leadVerified,
    // No filing to cite: the submitted name, verified where the website
    // states it — Miette Patisserie's site shows MIETTE PATISSERIE &
    // CONFISERIE.
    ...(tier === 'submitted' && lead.label === 'Business name'
      ? {
          badge: (
            <AttributeSources
              sources={websiteStatesName(record, record.name) ? ['Website'] : []}
              submitted={{ verified: websiteStatesName(record, record.name) }}
              domesticState={record.formation?.state}
              onJumpToSource={onJumpToSource}
            />
          )
        }
      : {}),
    // The names the filing dropped are a cell of their own beside it now
    // (Former names), not an icon on it.
    values: lead.values
  }
  /* The names the legal name's filing has dropped, newest first: Sprig's
     California filing was USERLEAP INC. Where it dropped none, the cell says
     so, as the DBA cell does. */
  const monthYear = (iso: string) =>
    new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric'
    })
  const formerCell: AttributeCell | undefined =
    tier === 'formation' && priorNames.length > 0
      ? {
          key: 'former',
          label: 'Former name',
          values: priorNames.map((n) => {
            // The Secretary of State whose filing carried the name, cited
            // under it as the formation fields cite theirs.
            const filing =
              record.registrations.find((r) => r.state === n.state && /^domestic$/i.test(r.jurisdiction ?? '')) ??
              record.registrations.find((r) => r.state === n.state)
            return {
              key: n.eventId,
              value: n.name,
              qualifier: n.at ? `Changed ${monthYear(n.at)}` : undefined,
              note: filing ? (
                <AttributeSources
                  sources={[]}
                  registrations={[filing]}
                  domesticState={domesticState}
                  onJumpToSource={onJumpToSource}
                />
              ) : undefined
            }
          })
        }
      : undefined
  const formationCells: AttributeCell[] = [
    // The formation date is the domestic filing's, and says so: the date
    // carries its own source.
    // The filing's own fields — when and where it was formed, and where it
    // stands — each cite the filing, as Entity type does: the SOS chip
    // confirms the value came from the state, "Not provided by state"
    // included, since that too is what the state's filing says.
    ...rest.map((c) => {
      const notProvided = c.values.some((v) => v.value === NOT_PROVIDED)
      const filingChip =
        tier === 'formation' && domestic && FROM_FILING.has(c.label ?? '') ? (
          <AttributeSources
            sources={[]}
            registrations={[domestic]}
            domesticState={domesticState}
            onJumpToSource={onJumpToSource}
          />
        ) : undefined
      // The standing as the filing's own detail in the strip states it — the
      // same chips, the same words: "Not provided by state" for Delaware.
      const asChip =
        tier === 'formation' && domestic && (c.label === 'Status' || c.label === 'Sub status')
          ? [
              {
                value:
                  c.label === 'Status' ? (
                    <StatusChip reg={domestic} />
                  ) : (
                    <SubStatusChip reg={domestic} />
                  )
              }
            ]
          : undefined
      return {
        ...c,
        ...(asChip ? { values: asChip } : {}),
        // Whose status: the formation's, as the filings strip under it states
        // every other filing's.
        label: FORMATION_LABEL[c.label ?? ''] ?? c.label,
        ...(filingChip ? { badge: filingChip } : notProvided ? { badge: undefined } : {}),
        ...(notProvided && !asChip
          ? {
              values: c.values.map((v) =>
                v.value === NOT_PROVIDED
                  ? { ...v, value: <span className="text-text-secondary">{NOT_PROVIDED}</span> }
                  : v
              )
            }
          : {})
      }
    })
  ]
  // A sole proprietor with no filing: what the state of its office asks of a
  // trade name — under Other filings, not in the grid.
  const dbaRule =
    tier === 'formation' && classifiedSole(record) ? (dbaRuleCell(record) ?? undefined) : undefined

  /* The Formation card's tag: its filing, cited once; or Submitted, verified
     where the website states the name. A city registration cites itself on
     every cell. */
  const formationChip =
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
      <AttributeSources
        sources={websiteStatesName(record, record.name) ? ['Website'] : []}
        submitted={{ verified: websiteStatesName(record, record.name) }}
        domesticState={domesticState}
        onJumpToSource={onJumpToSource}
      />
    ) : undefined

  // No state filing at all, and a city registration in the submitted person's own name.
  const sole = !linked && tier !== 'formation' ? soleProprietorOf(record) : undefined

  /*
   * A sole proprietorship, dealt out the same way.
   *
   * There is no entity apart from its owner, so what stays true is the
   * business as the owner runs it — its DBA, the owner, the form we read it
   * as, when the city first registered it — each citing its own source. What
   * repeats is the city registration and its location, as the one
   * registration view. Firebird Yarns is the case: Kathryn Bernard, doing
   * business as Firebird Yarns, San Francisco account 1089962.
   */
  const cityReg = sole
    ? ((record.cityRegistrations ?? []).find((c) => sameName(c.owner, sole.person)) ??
      record.cityRegistrations?.[0])
    : undefined
  // The registration's own reference, so its chip names the city; and the
  // site by its address.
  const cityRefs = cityReg?.refId
    ? [
        {
          id: cityReg.refId,
          type: 'city_registration',
          metadata: { city: cityReg.city, state: cityReg.state }
        }
      ]
    : []
  const siteNames = record.website?.url ? { Website: readableUrl(record.website.url) } : undefined
  const cityChip = (
    <AttributeSources
      sources={[CITY]}
      refs={cityRefs}
      domesticState={record.formation?.state}
      onJumpToSource={onJumpToSource}
    />
  )
  const longDate = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  const yearsSince = (iso: string) => {
    const y = Math.floor(
      (Date.now() - new Date(`${iso}T00:00:00`).getTime()) / (365.25 * 86_400_000)
    )
    return `${y} year${y === 1 ? '' : 's'}`
  }
  if (sole && cityReg)
    return {
      names: [
        {
          key: 'dba',
          label: 'Alternative names',
          // The name the customer submitted, verified where the city
          // registration carries it.
          badge: (
            <AttributeSources
              sources={
                websiteStatesName(record, cityReg.dba ?? record.name) ? [CITY, 'Website'] : [CITY]
              }
              refs={cityRefs}
              sourceNames={siteNames}
              submitted={
                sameName(cityReg.dba ?? record.name, record.name) ? { verified: true } : undefined
              }
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
          // The person the customer submitted, verified by the city
          // registration that names them as owner.
          badge: (
            <AttributeSources
              sources={[CITY]}
              refs={cityRefs}
              submitted={
                record.people.some((p) => p.submitted && sameName(p.name, sole.person))
                  ? { verified: true }
                  : undefined
              }
              domesticState={record.formation?.state}
              onJumpToSource={onJumpToSource}
            />
          ),
          values: [{ value: cityReg.owner ?? sole.person }]
        }
      ],
      formation: [
        // Our reading, not a filed fact — so no source chip; the Assistant's
        // sentence says what it rests on.
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
      ],
      tin: tinCell,
      city: record.cityRegistrations ?? [],
      dbaRule: dbaRuleCell(record) ?? undefined
    }

  /*
   * Nothing found at all — no state filing, no city registration, no
   * sole-proprietor reading — dealt out the way the sole proprietorship is.
   *
   * The business as the customer submitted it, verified where its website
   * states the name, and then what the record does not hold: the form it
   * takes is unknown, and no filing was found. Miette Patisserie is the case.
   * The person, address and screened-name rows the submission also carries
   * are the People, Addresses and Screening cards' own, not this one's.
   */
  if (tier === 'submitted')
    return {
      names: [
        {
          ...(cells.find((c) => c.label === 'Business name') ?? lead),
          badge: (
            <AttributeSources
              sources={websiteStatesName(record, record.name) ? ['Website'] : []}
              submitted={{ verified: websiteStatesName(record, record.name) }}
              domesticState={record.formation?.state}
              onJumpToSource={onJumpToSource}
            />
          )
        }
      ],
      formation: [
        // Our reading of an absence, not a filed fact — so no source chip,
        // and lighter, as an absence is drawn.
        {
          key: 'form',
          label: 'Entity type',
          values: [{ value: <span className="text-text-secondary">Unknown</span> }]
        },
        {
          key: 'filing',
          label: 'Formation filing',
          values: [{ value: <span className="text-text-secondary">None found</span> }]
        }
      ],
      tin: tinCell,
      city: record.cityRegistrations ?? []
    }

  return {
    names: [leadCell, ...dbaCells, ...(formerCell ? [formerCell] : [])],
    formation: formationCells,
    formationChip,
    tin: tinCell,
    strip: strip
      ? { record: stripRecord, lead: converted?.now ?? domestic ?? undefined, legalName }
      : undefined,
    // Its city registrations, under the state filings as Other filings.
    city: record.cityRegistrations ?? [],
    dbaRule
  }
}
