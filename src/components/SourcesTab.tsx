import { Fragment, useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { MutedText, Surface, Tag, Text } from '@/core'

import { cn } from '../utils/twUtils'


import type { AttributeRow } from '../lib/attributes'
import type { BusinessRecord, Derived, SourceRef } from '../lib/deriveResults'
import { GROUPS, type GroupId } from '../lib/groups'
import { NOT_A_CARD, PROFILES, STREET_VIEW_CARD, SUBMITTED_CARD, docCard, kindLabel, namedCard } from '../lib/sourceCards'
import { filingCardOf, sourceDocuments, type SourceDoc, type SourceKind } from '../lib/sourceInventory'
import { capturedLabel, screenshotFor } from '../lib/sourceScreenshots'
import { streetViewFor } from '../lib/addressStreetViews'
import { attributesFor, filedName, longDate, maskTin, roleLabel as filedRole } from '../lib/attributes'
import { NOT_PROVIDED, registrationState } from '../lib/registrationStatus'
import { entityFormLabel } from '../lib/normalise'
import { formationCardFilingOf } from '../lib/linkedFormation'
import { STATE_NAMES, stateName } from '../lib/states'
import { useScreenshotViewer } from './ScreenshotViewer'
import { Collapsible } from './Collapsible'
import { registerTail, submittedUnder } from './Report/OperationsCard'
import { StatusChip } from './Report/ClaimsStrips'
import { bankruptcySections } from './Report/bankruptcySections'
import { LienSections, lienStatusKind } from './Report/lienSections'
import { litigationSections } from './Report/litigationSections'
import { RecordSections as RecordGrids } from './Report/recordSections'
import { ConnectionSections } from './ConnectionSections'
import { relatedBusinessesOf } from '../lib/relatedBusinesses'
import { priorNameRecords } from '../lib/cityRegistrations'
import { sameName } from '../lib/registrationStatus'
import { cityRegistrationCells } from './Report/CityStrip'
import { MediaBlock, PepBlock, WatchlistBlock } from './Report/ScreeningCard'
import { IndustryTable } from './IndustryTable'
import { screenedOf } from '../lib/screening'

/** The tab's own group names. THEME holds the short forms used on citation
 *  chips, where "Name and formation" does not fit; a heading has the room, and
 *  the two tabs disagreeing about what a group is called is worse than long. */
const GROUP_LABEL = new Map(GROUPS.map((g) => [g.id, g.label]))
import { attributeRowsByGroup } from './AttributesTab'
import { AttributeCells, cell } from './AttributeGrid'
import { cellsFromRows } from './attributeCells'
import { CardLabelRow } from './CardLabel'
import { WEBSITE_METADATA, sourceLabel } from '../lib/sourceLabels'

type Registration = BusinessRecord['registrations'][number]

/** A value, and the role it played for the source now being read. */
type Supplied = {
  row: AttributeRow
  ref?: SourceRef
  role?: string
  /** Show only the value itself, without anything other sources added to it. */
  bare?: boolean
}

const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * What the value WAS to this source.
 *
 * The same address is a mailing address on one filing and the registered
 * agent's on another — the role lives in that source's own `metadata.labels`,
 * not on the address. Labelling every row "Address" threw away the one thing
 * the source was saying about it.
 */
const ROLE: Record<string, string> = {
  mailing: 'Mailing address',
  physical: 'Physical address',
  registered_agent: 'Registered agent address',
  primary: 'Primary address',
  headquarters: 'Headquarters address'
}

const roleLabel = ({ row, ref, role }: Supplied) => {
  if (role) return role
  const labels = (ref?.metadata?.labels as string[] | undefined) ?? []
  const named = labels.map((l) => ROLE[l]).filter(Boolean)
  return named.length > 0 ? named.join(' · ') : row.label
}

/** The value, without the role the label now carries. */
const withoutRole = (value: string, role?: string) =>
  role ? value.replace(new RegExp(`\\s*[—-]\\s*${role}\\s*$`, 'i'), '') : value


/**
 * Government records that are not the entity's own registration.
 *
 * A tax permit, a city licence, a Form 5500 and a federal contractor extract
 * are all government-issued, but none of them is the filing that constitutes
 * the company. Registrations say the entity exists; these say it has been
 * transacting — a different question, and worth reading as its own set.
 */
const GOVERNMENT = new Set<SourceKind>([
  'sales_tax_permit',
  'city_registration',
  'form_5500',
  'lien',
  'litigation',
  'bankruptcy',
  'sam_entity_extract',
  'sec_filing',
  'sba_entity_v2',
  'npi_record',
  'parsed_sos_document',
  'historical_registration',
  'jurisdiction_registration',
  'professional_license',
  'fmcsa_registration',
  'license',
  'epa_frs_facility'
])

/**
 * Groups that no source "supplies".
 *
 * The screening groups hold check outcomes, not record attributes. The SOS
 * group holds a roll-up of the filings themselves — "Unknown registrations (2)"
 * is a count across the record with no value of its own, so listing it under
 * one filing read as that filing having supplied a number about its siblings.
 * A filing's own payload is already printed above.
 */
const NOT_SUPPLIED = new Set<GroupId>(['screening', 'registration'])

/*
 * Google's own card, `STREET_VIEW_CARD`. Street View is a source in its own
 * right — a car was at the address and the frame is what it saw — so it gets a
 * card rather than living inside the registries that stated the addresses. It
 * supplies nothing the filings supplied; what it gives is the one thing none
 * of them can, which is a look at the place.
 */

/** One source, and everything on the record that came from it. */
export type Source = {
  id: string
  label: string
  /** The filing itself, where the source IS a filing. */
  registration?: Registration
  /** The FMCSA's carrier record, where the source is the FMCSA. */
  fmcsa?: NonNullable<BusinessRecord['fmcsaRegistrations']>
  /** The one document this card stands for (`sourceDocuments`). Absent on a
   *  card that is no document: Submitted, Street View, USPS, Related businesses. */
  doc?: SourceDoc
  /** Other ids a chip may follow here by: a kind's name, where this is the
   *  record's only document of that kind ("src:Tax permit"). */
  aliases?: string[]
  /** Every instance of this source on the record, metadata intact. A business
   *  can hold three sales tax permits; they are three records, not one. */
  refs: SourceRef[]
  url?: string
  /** What it supplied, by attribute group. */
  supplied: Map<GroupId, Supplied[]>
  /** Which band of evidence this is. */
  band?: 'submitted' | 'registration' | 'government' | 'web'
  /** The source TYPE, before a jurisdiction was appended to the title. Banding
   *  reads this: "Tax permit · Pennsylvania" is not in the government set, and
   *  the thing it is an instance of is. */
  kind?: string
}

/** A row a city registration states itself (`cityRegistrationRows`). */
const registers = (row: AttributeRow) => (row.matchValue ?? '').startsWith('city:')

const add = (into: Map<GroupId, Supplied[]>, group: GroupId, item: Supplied) => {
  const list = into.get(group) ?? []
  const same = (row: AttributeRow) => norm(row.value) === norm(item.row.value)
  // One address once per card: a submitted address and the registration's
  // own reading of it are the same line on that registration.
  if (group === 'address' && list.some(({ row }) => same(row))) return
  /* A name the registration states itself is its own row, under its own
     label: Mixboard Inc. as the Business name, Firebird Yarns as the DBA.
     The record's name row, cited to the same registration, says it again. */
  if (group === 'name') {
    if (!registers(item.row) && list.some(({ row }) => registers(row) && same(row))) return
    if (registers(item.row)) {
      into.set(group, [...list.filter(({ row }) => registers(row) || !same(row)), item])
      return
    }
  }
  into.set(group, [...list, item])
}

/**
 * The record inverted: by source rather than by attribute.
 *
 * The Attributes tab answers "where did this value come from". This answers the
 * other direction — "what did this source give us" — which is the question
 * behind trusting or discounting a whole source at once. A registry that is out
 * of date taints everything it supplied, and that set is invisible while
 * provenance is only ever read one attribute at a time.
 */
export const sourcesFor = (
  record: BusinessRecord,
  results: Derived[],
  groupFor: (insightId: string) => GroupId
): Source[] => {
  const byId = new Map<string, Source>()

  const get = (
    id: string,
    label: string,
    registration?: Registration,
    url?: string,
    kind?: string
  ) => {
    const existing = byId.get(id)
    if (existing) return existing
    const made: Source = { id, label, kind, registration, url, refs: [], supplied: new Map() }
    byId.set(id, made)
    return made
  }

  /*
   * The documents first, each its own card, from the record itself. Cards used
   * to be made only once a row cited a source, and keyed by its label — so a
   * filing no address row carried had no card, and two Form 5500s or ten court
   * cases were one card each. Rows are filed under these below.
   */
  const docs = sourceDocuments(record)
  for (const d of docs) {
    const card = get(
      d.card,
      d.registration ? `Secretary of State · ${stateName(d.registration.state)}` : d.answers,
      d.registration,
      d.registration?.sourceUrl ?? undefined,
      d.kind
    )
    card.doc = d
    if (d.ref) card.refs.push(d.ref)
    if (d.fmcsa) card.fmcsa = [d.fmcsa]
  }

  /*
   * A kind the record holds one document of answers to its name too: a row
   * that cites "Website" or "Form 5500" with no reference can only mean that
   * one. Where there are several, the reference decides and nothing guesses.
   */
  const ofKind = new Map<string, SourceDoc[]>()
  for (const d of docs) {
    const k = d.answers.toLowerCase()
    ofKind.set(k, [...(ofKind.get(k) ?? []), d])
  }
  for (const [k, list] of ofKind)
    if (list.length === 1 && !list[0].registration) {
      const card = byId.get(list[0].card)!
      const alias = namedCard(sourceLabel(list[0].answers))
      if (alias !== card.id) card.aliases = [...(card.aliases ?? []), alias]
      void k
    }

  const byGroup = attributeRowsByGroup(record, results, groupFor)

  for (const [group, rows] of byGroup) {
    // Screening groups hold check RESULTS, not record attributes. The names in
    // them are the same names the Name and People groups already supply, so
    // counting them here inflated every source and listed Watchlist, PEP and
    // Adverse media as things a source had provided.
    if (NOT_SUPPLIED.has(group)) continue

    for (const row of rows.values()) {
      // A filing is a source in its own right, with its own payload.
      for (const r of row.registrations ?? []) {
        // A filing's own payload already states its name, entity type and
        // standing. The Names and Formation groups are that same filing read
        // out — Formation literally IS the domestic registration — so listing
        // them underneath printed the card's own contents a second time.
        if (group === 'name' || group === 'formation') continue
        // Its people are the filing's own list, read below — not the record's
        // people[], which folds a member and an agent whose names look alike
        // into one person.
        if (group === 'people') continue

        const id = filingCardOf(record, r)
        // The ref for THIS filing, so the row can be labelled by the role it
        // played on it rather than by its role in general.
        const ref = (row.refs ?? []).find(
          (x) =>
            x.type === 'registration' &&
            (x.metadata as { state?: string }).state === r.state
        )
        // The role on THIS filing: its registered agent is a registered agent
        // here even where another filing lists them as an officer.
        const isAgent =
          row.label === 'Registered agent' &&
          Boolean(r.registeredAgent) && norm(r.registeredAgent ?? '') === norm(row.matchValue ?? row.value)

        add(get(id, `Secretary of State · ${stateName(r.state)}`, r, r.sourceUrl ?? undefined).supplied, group, {
          row,
          ref,
          role: isAgent ? 'Registered agent' : undefined
        })
      }

      // Every other document the row cites, by the reference's own id: three
      // tax permits are three records, each with its own state and status,
      // and each is its own card.
      const placed = new Set<string>()
      for (const x of row.refs ?? []) {
        if (x.type === 'registration') continue
        const card = byId.get(docCard(x.id))
        if (!card) continue
        add(card.supplied, group, { row, ref: x })
        placed.add(kindLabel(x.type).toLowerCase())
      }

      for (const name of row.sources ?? []) {
        // Keyed on the LABEL, not the raw name: "Website crawl" and "Website"
        // both read as Website, so keying on the raw value made two cards with
        // the same title — the URL in one, the domain in the other.
        const named = sourceLabel(name)
        if (NOT_A_CARD.test(named)) continue
        const kind = kindLabel(name).toLowerCase()
        if (placed.has(kind)) continue

        // A kind with documents of its own: the one there is, or — where there
        // are several and the row names none of them — none of them.
        const own = ofKind.get(kind)
        if (own && own.length > 0) {
          if (own.length === 1) add(byId.get(own[0].card)!.supplied, group, { row })
          continue
        }

        // A source that is no one document: USPS, the related businesses.
        // Profiles fold into the one profiles card.
        const title = PROFILES.has(named) ? 'Web presence' : named
        add(get(namedCard(named), title).supplied, group, { row })
      }

      // Submitted is a source too — the weakest one, and the only one the
      // customer controls. Leaving it out made the tab look like everything
      // here was independently found.
      // A person the customer submitted is a name and nothing more: the API's
      // `submitted.people` carries names only. "Registered agent" and "Manager"
      // came off the filings, and on this card they read as the customer's
      // claim. One entry per person, whatever roles the filings gave them.
      if (row.submitted) {
        const card = get(SUBMITTED_CARD, 'Submitted')
        if (group === 'people') {
          const who = norm(row.matchValue ?? row.value)
          if (!(card.supplied.get('people') ?? []).some(({ row: r }) => norm(r.matchValue ?? r.value) === who))
            add(card.supplied, group, { row: { ...row, trailing: undefined }, role: 'Person', bare: true })
        } else add(card.supplied, group, { row, bare: true })
      }
    }
  }

  // Every address Google was asked about — including the one it holds nothing
  // for. A card that silently omits the address with no coverage claims a
  // completeness it does not have.
  const looked = [...(byGroup.get('address')?.values() ?? [])].filter((row) =>
    streetViewFor(row.matchValue ?? row.value)
  )
  if (looked.length > 0) {
    const card = get(STREET_VIEW_CARD, 'Street View')
    for (const row of looked) add(card.supplied, 'address', { row, role: row.label, bare: true })
  }

  // A filing's people, as the filing names them: each officer under its role
  // ("Member"; "Officer" where none is given), then its registered agent. The
  // dashboard's SOS card reads them the same way. Two entries whose names look
  // alike stay two entries — the filing lists them separately.
  for (const source of byId.values()) {
    const r = source.registration
    if (!r) continue
    const person = (label: string, value: string, matchValue: string, trailing?: string): AttributeRow => ({
      group: 'people',
      label,
      value,
      trailing,
      source: '',
      sources: [],
      matchValue
    })
    // "Officer", the name as filed, and its roles under it — the dashboard's
    // own SOS card. A name the filing lists several times is one cell with its
    // roles together, each once, in the filing's order: Checkr's Utah filing
    // names Daniel Yanisse five times across four roles. Grouped on the name
    // as written, ignoring only case and punctuation — never a look-alike.
    const byName = new Map<string, { name: string; roles: string[] }>()
    for (const o of r.officerRoles ?? []) {
      if (!o.name) continue
      const entry = byName.get(norm(o.name)) ?? { name: o.name, roles: [] }
      for (const raw of o.roles.length ? o.roles : [''])
        if (!entry.roles.includes(filedRole(raw))) entry.roles.push(filedRole(raw))
      byName.set(norm(o.name), entry)
    }
    for (const { name, roles } of byName.values()) {
      // "Officer" says nothing beside a real role, and is no role at all alone.
      const named = roles.filter((x) => x !== 'Officer')
      add(source.supplied, 'people', {
        row: person('Officer', filedName(name), name, named.length ? named.join(', ') : undefined),
        role: 'Officer'
      })
    }
    if (r.registeredAgent)
      add(source.supplied, 'people', { row: person('Registered agent', r.registeredAgent, r.registeredAgent), role: 'Registered agent' })

    // A filing's addresses, as the filing lists them — every one, not only
    // the ones an insight happened to cite to it: Kairos PT's New York filing
    // carries Bayside and Little Neck beside the submitted office, and the
    // card said only the office. Each under the role the filing gave it
    // (mailing, physical), read from the record's reference to this filing.
    for (const filed of r.addresses ?? []) {
      const known = record.addresses.find((a) => norm(a.fullAddress) === norm(filed))
      const ref = known?.sourceRefs?.find(
        (x) => x.type === 'registration' && (x.metadata as { state?: string }).state === r.state
      )
      add(source.supplied, 'address', {
        row: { group: 'address', label: 'Address', value: known?.fullAddress ?? filed, source: '', sources: [], matchValue: known?.fullAddress ?? filed },
        ref,
        bare: true
      })
    }
  }

  // The IRS's own record of the TIN: the number the customer submitted, the
  // name the IRS holds against it, and what the IRS said — the same sentence
  // the assessment shows. The card read only the masked number, which named
  // the source without saying what it returned.
  const tin = record.tin as { tin?: string; name?: string } | null
  if (tin?.tin) {
    const card = get(namedCard('IRS TIN record'), 'IRS TIN record')
    const held = card.supplied.get('tin') ?? []
    const has = (label: string) => held.some(({ row }) => row.label === label)
    const fact = (label: string, value: string): Supplied => ({
      row: { group: 'tin', label, value, source: '', sources: [] },
      bare: true
    })
    // The customer's number: marked Submitted, as the report's TIN reads.
    if (!has('TIN')) {
      const number = fact('TIN', maskTin(tin.tin))
      add(card.supplied, 'tin', { ...number, row: { ...number.row, submitted: true } })
    }
    if (tin.name && !has('IRS name')) add(card.supplied, 'tin', fact('IRS name', tin.name))
    // Issuance first where the IRS has not issued the number: that is why
    // there is no record for the combination, and the second sentence reads
    // as its consequence.
    for (const id of ['tin_issued', 'tin']) {
      // Only what the IRS returned: a check the record never reported carries
      // a placeholder sentence, not a result.
      const said = results.find((r) => r.insightId === id && !r.notReported)?.statement
      if (said && !held.some(({ row }) => row.value === said))
        add(card.supplied, 'tin', fact('IRS result', said))
    }
  }

  const count = (s: Source) => [...s.supplied.values()].reduce((n, rows) => n + rows.length, 0)

  // Filings first and together, domestic at their head. They are one body of
  // evidence and reading them as a set is the point — interleaving them with
  // tax permits by attribute count broke the comparison, and the domestic
  // filing is where that comparison starts.
  const rank = (s: Source) => {
    if (s.id === SUBMITTED_CARD) return 0
    if (!s.registration) return 3
    return jurisdiction(s.registration, record) === 'Domestic' ? 1 : 2
  }

  /** Which band of the tab a source belongs to. */
  const band = (s: Source): Source['band'] => {
    if (s.id === 'src:submitted') return 'submitted'
    if (s.registration) return 'registration'
    // A source bands on the KIND of document it is: a lien and a court case
    // are a filing office's and a court's, not web pages.
    return s.doc && GOVERNMENT.has(s.doc.kind) ? 'government' : 'web'
  }

  // Within the filings, oldest first: the order they were registered in is the
  // shape of the company's expansion, and reading it by attribute count told
  // you nothing except which registry published the most fields.
  const filed = (s: Source) => s.registration?.registrationDate ?? ''

  // Street View sits at the foot of its band. It is the only source here that
  // is about the addresses rather than the business's own pages, and ordered
  // by attribute count it outranked the crawl that found the site.
  const trailing = (s: Source) => (s.id === STREET_VIEW_CARD ? 1 : 0)

  return [...byId.values()]
    .map((s) => ({ ...s, band: band(s) }))
    .sort(
    (a, b) =>
      rank(a) - rank(b) ||
      trailing(a) - trailing(b) ||
      (a.registration && b.registration
        ? filed(a).localeCompare(filed(b))
        : count(b) - count(a)) ||
      a.label.localeCompare(b.label)
  )
}

/**
 * What the source actually gave us.
 *
 * An address row's display value carries facts computed across the whole record
 * — how many businesses share the location, the property type, whether it is a
 * registered agent. A filing supplied the address; it did not supply the
 * location count. `matchValue` is the bare value the row is identified by,
 * which is the part a source can be credited with.
 */
const supplied = ({ row, bare }: Supplied) => {
  // A title is not part of a name. The customer submitted "Kyle Mack"; CHIEF
  // EXECUTIVE OFFICER, GOVERNOR, PRESIDENT came off three state registrations,
  // and appending it to the submitted row credited the customer with telling us
  // something they never did.
  //
  // Only where `matchValue` is the value itself. On a name row it is an
  // identity key (`legal:middeskinc`) built for deduplication, and printing it
  // put a slug on screen where a company name belongs.
  const identity = row.matchOn && (bare || row.matchOn === 'address') ? row.matchValue : undefined
  return identity || row.value || '—'
}

/** The API states it; where it does not, the formation state decides. */
const jurisdiction = (r: Registration, record: BusinessRecord) => {
  const stated = r.jurisdiction?.toLowerCase()
  if (stated === 'domestic' || stated === 'foreign')
    return stated === 'domestic' ? 'Domestic' : 'Foreign'
  return r.state && r.state === record.formation?.state ? 'Domestic' : 'Foreign'
}

/** The API's own words, cased for reading — nothing renamed. */
/** The compact Tag's padding, shared by the status and summary tags. */
const BADGE = 'px-1.5 py-0 text-xs leading-4'

const sentence = (v: string) =>
  v.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())

/**
 * The captures behind a card's pages.
 *
 * The hover preview on a chip is a pointer affordance and reaches neither
 * touch nor a screen reader; this is where the same evidence has a permanent
 * home — and where five profiles sit side by side rather than one hover at a
 * time. Thumbnails, because the question here is which pages we hold; each
 * expands to the page itself.
 */
type Capture = { label: string; alt: string; src?: string; capturedAt: string; note?: string }

/** One capture, as a thumbnail that expands. Shared by the page captures and
 *  the Street View frames — same evidence, same affordance. */
const CaptureThumb = ({ capture }: { capture: Capture }) => {
  const { open } = useScreenshotViewer()
  const { src, alt, label, capturedAt, note } = capture

  const frame = src ? (
    <img
      alt={alt}
      src={src}
      loading="lazy"
      // Anchored to the top of the page, not its middle: a page says who it is
      // at its head, and five centred crops are five bodies of text.
      className="h-28 w-44 rounded-control border border-solid border-border bg-card object-cover object-top transition-shadow group-hover:shadow-elevation-popover"
    />
  ) : (
    // Nothing to show, said as a tile. Dropped from the strip, the address
    // would look like one nobody checked.
    <div className="flex h-28 w-44 items-center justify-center rounded-control border border-dashed border-border px-2 text-center">
      <MutedText className="text-caption">No imagery</MutedText>
    </div>
  )

  if (!src) {
    return (
      <div className="grid w-44 gap-1">
        {frame}
        <Text size="sm" className="line-clamp-2 font-medium">
          {label}
        </Text>
        <MutedText className="block text-caption">{note ?? ''}</MutedText>
      </div>
    )
  }

  return (
    <button
      type="button"
      className="group grid w-44 gap-1 rounded-control text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => open({ src, alt, capturedAt })}
    >
      {frame}
      <Text size="sm" className="line-clamp-2 font-medium">
        {label}
      </Text>
      <MutedText className="block text-caption">{note ?? capturedLabel(capturedAt)}</MutedText>
    </button>
  )
}

const CaptureStrip = ({ captures }: { captures: Capture[] }) => {
  if (captures.length === 0) return null

  return (
    <>
      <CardLabelRow as="h4">{captures.length > 1 ? 'Captures' : 'Capture'}</CardLabelRow>
      {/* Outside the grid: a 176x112 thumbnail is not a label over a value, and
          a cell tall enough to hold one would drag every cell beside it. */}
      <div className="flex flex-wrap gap-3 border-b border-[var(--core-color-border-divider)] px-4 py-3">
        {captures.map((capture) => (
          <CaptureThumb key={capture.label + (capture.src ?? '')} capture={capture} />
        ))}
      </div>
    </>
  )
}

const SourceCaptures = ({ items }: { items: Supplied[] }) => {
  // Off the rows, not the card's `refs`: a profile's ref is typed `profile`
  // and never matches the brand the card folded it under, so the Web presence
  // card holds none of them. The row is where the page's own URL survived.
  const captures = new Map<string, Capture>()
  for (const item of items) {
    // Metadata rows carry the site's own URL as a fallback href, so the home
    // page arrived under "Domain ID" — a registrar fact labelling a capture of
    // a page that never stated it. Only rows that ARE a page contribute one.
    if (WEBSITE_METADATA.has(item.row.label)) continue

    const shot = item.row.href ? screenshotFor(item.row.href, '') : undefined
    if (!shot || captures.has(shot.src)) continue

    captures.set(shot.src, { ...shot, label: item.role ?? item.row.label })
  }

  return <CaptureStrip captures={[...captures.values()]} />
}

/**
 * The frames, one per address Google was asked about.
 *
 * Dated by the imagery, not by our reading of it: the strip's job is to show
 * that a 2015 frame and a 2025 frame are not the same kind of evidence.
 */
const StreetViewCaptures = ({ items }: { items: Supplied[] }) => {
  // One frame per doorway, named by the first address to reach it: the
  // submitted spelling, not whichever filing wrote a suite number.
  const captures = new Map<string, Capture>()
  for (const item of items) {
    const address = item.row.matchValue ?? item.row.value
    const frame = streetViewFor(address)
    if (!frame) continue

    const key = frame.src ?? address
    if (captures.has(key)) continue

    captures.set(key, {
      label: address,
      alt: frame.alt,
      src: frame.src,
      capturedAt: frame.capturedAt,
      note: frame.imageryDate ? `Street View · ${frame.imageryDate}` : 'No coverage'
    })
  }

  return <CaptureStrip captures={[...captures.values()]} />
}

/** A source's supplied groups, in the order the groups are laid out. */
const ORDER = GROUPS.map((g) => g.id)
export const sourceGroups = (source: Source): Array<[GroupId, Supplied[]]> =>
  [...source.supplied.entries()].sort((a, b) => ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]))

/**
 * The dashboard's Sources tab, copied: its source types, its order, its card
 * titles and subtitles, and its section names (`BusinessHome/Sources`).
 *
 * The prototype holds a filing's whole payload, so a Secretary of State card
 * reads section for section as the app's does. Every other source it holds
 * only as metadata on the values it is cited for — so those cards use the app's
 * titles and section names over what the record has, and show no field the
 * record does not.
 */
const APP_ORDER = [
  'registration',
  'fmcsa_registration',
  'professional_license',
  'license',
  'sales_tax_permit',
  'sec_filing',
  'sam_entity_extract',
  'sba_entity_v2',
  'ptin_holder',
  'city_registration',
  'dba_registration',
  'food_and_beverage',
  'npi_record',
  'poi_record',
  'form_5500',
  'tax_exempt_organization',
  'parsed_sos_document',
  'historical_registration',
  'jurisdiction_registration',
  'epa_frs_facility',
  'tin',
  'website',
  'profiles',
  'industry',
  'lien',
  'litigation',
  'bankruptcy',
  'watchlist_result',
  'pep_result',
  'adverse_media_result',
  'screen',
  'document',
  'generic_verification_source'
]

/** A card that is no document of its own, by the name it was filed under. */
const TYPE_OF_LABEL: Record<string, string> = {
  Website: 'website',
  'Web presence': 'profiles'
}

export const appTypeOf = (s: Source): string =>
  s.registration
    ? 'registration'
    : s.doc && s.doc.kind !== 'other'
      ? s.doc.kind
      : (TYPE_OF_LABEL[(s.kind ?? s.label).split(' · ')[0]] ?? 'generic_verification_source')

type Meta = {
  state?: string
  city?: string
  status?: string
  plan_year?: string | number
  ack_id?: string
  dot_number?: string
  uei?: string
  id?: string
  name?: string
  file_number?: string
  filing_date?: string
  document_type?: string
  license_type?: string
  license_number?: string
  jurisdiction?: { name?: string; state?: string; tax_type?: string }
  source_data?: Array<{ name: string; value: unknown }>
  source_data_link?: string
}
const metas = (s: Source) => s.refs.map((r) => (r.metadata ?? {}) as Meta)
const unique = <T,>(xs: T[]) => [...new Set(xs)]
/** The state a record is from: its own metadata, else the jurisdiction its
 *  card was scoped to ("Lien · Delaware"). */
const stateOf = (s: Source) => {
  const stated = [s.doc?.lien?.state ?? undefined, ...metas(s).map((m) => m.state)].map((x) => x?.toUpperCase()).find(Boolean)
  if (stated) return stated
  const scoped = s.label.split(' · ')[1]
  return scoped ? Object.keys(STATE_NAMES).find((code) => STATE_NAMES[code].toLowerCase() === scoped.toLowerCase()) : undefined
}
/** Where a record is, where nothing else on its title tells it from its
 *  siblings: nine California permits differ only by the address each lists. */
const addressOf = (s: Source) => {
  const row = (s.supplied.get('address') ?? [])[0]?.row
  return row ? (row.matchValue ?? row.value) : undefined
}

/** A city registration by what the register calls it: its trade name or owner,
 *  its account, and whether it is open. */
const cityTitleOf = (s: Source) => {
  const rows = s.doc?.city ?? []
  if (rows.length === 0) return undefined
  const first = rows[0]
  const open = rows.some((r) => !r.locationEnd && !r.businessEnd)
  return joined(first.dba ?? first.owner, first.accountNumber && `Account ${first.accountNumber}`, open ? 'Open' : 'Closed')
}

const citiesOf = (s: Source) =>
  unique(metas(s).filter((m) => m.city && m.state).map((m) => `${m.city}, ${stateName((m.state as string).toUpperCase())}`))

/** The words a status is stated in, for a subtitle. */
const statusWord = (v?: string | null) => (v ? sentence(v) : undefined)
const joined = (...xs: Array<string | null | undefined | false>) => xs.filter(Boolean).join(' · ') || undefined

/** The app's card title and subtitle for this source. A subtitle says which
 *  one this is: three permits, two plan years or ten cases each read apart. */
export const appHeader = (s: Source): { title: string; subtitle?: string } => {
  const st = stateOf(s)
  const m = metas(s)[0] ?? {}
  const d = s.doc
  switch (appTypeOf(s)) {
    case 'registration':
      return { title: 'Secretary of State', subtitle: joined(stateName(s.registration!.state), s.registration!.fileNumber) }
    case 'sales_tax_permit':
      return { title: 'Sales Tax Permit', subtitle: joined(st && stateName(st), statusWord(m.status), addressOf(s)) }
    case 'city_registration':
      return { title: 'City Registration', subtitle: joined(citiesOf(s).join(' · ') || (st ? stateName(st) : undefined), cityTitleOf(s)) }
    case 'lien':
      return { title: 'Lien Filing', subtitle: joined(st && stateName(st), d?.lien?.fileNumber && `File ${d.lien.fileNumber}`) }
    case 'litigation':
      return { title: 'Court record', subtitle: joined(d?.litigation?.court ?? d?.litigation?.courtState, d?.litigation?.caseNumber && `Case ${d.litigation.caseNumber}`) }
    case 'bankruptcy':
      return { title: 'Bankruptcy petition', subtitle: joined(d?.bankruptcy?.court ?? d?.bankruptcy?.courtState, d?.bankruptcy?.caseNumber && `Case ${d.bankruptcy.caseNumber}`) }
    case 'sec_filing':
      return { title: 'SEC EDGAR Filings', subtitle: addressOf(s) }
    case 'form_5500':
      return { title: 'Form 5500', subtitle: joined('Internal Revenue Service', m.plan_year ? `Plan year ${m.plan_year}` : undefined, m.ack_id && `ACK ${m.ack_id}`) }
    case 'sam_entity_extract':
      return { title: 'SAM Entity Registration', subtitle: addressOf(s) }
    case 'sba_entity_v2':
      return { title: 'Small Business Profile', subtitle: 'Small Business Administration' }
    case 'fmcsa_registration':
      return { title: 'Federal Motor Carrier Safety Administration', subtitle: joined('Department of Transportation', d?.fmcsa?.dotNumber && `USDOT ${d.fmcsa.dotNumber}`) }
    case 'npi_record':
      return { title: 'National Provider Identifier', subtitle: joined('National Plan and Provider Enumeration System', m.id) }
    case 'professional_license':
      return { title: 'Professional License', subtitle: joined(st && stateName(st), m.license_number) }
    case 'license':
      return { title: d?.license?.registry ?? 'Licence', subtitle: joined(d?.license?.holder, d?.license?.number) }
    case 'parsed_sos_document':
      return { title: 'SOS Document', subtitle: joined(st && stateName(st), m.file_number) }
    case 'historical_registration':
      return { title: 'Historical Registration', subtitle: joined(st && stateName(st), m.file_number) }
    case 'jurisdiction_registration':
      return { title: 'Jurisdiction Registration', subtitle: m.jurisdiction?.name }
    case 'epa_frs_facility':
      return { title: 'EPA FRS Facility', subtitle: addressOf(s) }
    case 'watchlist_result':
      return { title: 'Watchlist result', subtitle: joined(d?.watchlist?.list.title, d?.watchlist?.result.entityName) }
    case 'pep_result':
      return { title: 'Politically exposed person result', subtitle: d?.pep?.name ?? undefined }
    case 'adverse_media_result':
      return { title: 'Adverse media result', subtitle: `${d?.media?.items.length ?? 0} ${(d?.media?.items.length ?? 0) === 1 ? 'article' : 'articles'}` }
    case 'screen':
      return { title: SCREEN_TITLE[d!.screen!], subtitle: 'No results · Screened' }
    case 'industry':
      return { title: 'Industry classification', subtitle: 'Middesk' }
    case 'tin':
      return { title: 'IRS TIN record', subtitle: 'Internal Revenue Service' }
    case 'document':
      return { title: 'Document', subtitle: d?.documents[0]?.filename ?? undefined }
    case 'website':
      return { title: 'Website' }
    case 'profiles':
      return { title: 'Third-party profiles' }
    default:
      if (s.id === SUBMITTED_CARD) return { title: 'Submitted' }
      return { title: s.label }
  }
}

const SCREEN_TITLE = { watchlist: 'Sanctions & watchlists', pep: 'Politically exposed persons', media: 'Adverse media' } as const

/** The app's name for the section a card's own details sit under. */
const DETAILS: Record<string, string> = {
  sales_tax_permit: 'Taxpayer details',
  lien: 'Lien details',
  sba_entity_v2: 'Entity details',
  litigation: 'Case details',
  bankruptcy: 'Petition details',
  npi_record: 'Provider details',
  professional_license: 'License details',
  jurisdiction_registration: 'Jurisdiction details',
  parsed_sos_document: 'Document details',
  form_5500: 'Filing details'
}

/** A value from a registry's own list, one cell per value. */
const valuesOf = (v: unknown): string[] =>
  Array.isArray(v) ? v.flatMap(valuesOf) : v === null || v === undefined || v === '' ? [] : [String(v)]

/** Fields the record's metadata holds for a source, under the app's labels,
 *  one field per cell. Each card is one document, so one reference. */
const metaCells = (s: Source, record?: BusinessRecord) => {
  const m = metas(s)[0] ?? {}
  // The state's own register, where the record holds a filing there.
  const sos = record?.registrations.find((r) => r.state === m.state?.toUpperCase() && r.sourceUrl)?.sourceUrl
  const st = m.state ? stateName(m.state.toUpperCase()) : undefined
  const sosLink = sos && st ? [cell('Record', <RecordLink href={sos}>{`${st} Secretary of State website`}</RecordLink>, { span: 'full' as const })] : []
  switch (appTypeOf(s)) {
    case 'sales_tax_permit':
      return [...(st ? [cell('State', st)] : []), ...(m.status ? [cell('Status', sentence(m.status))] : [])]
    case 'form_5500':
      return [
        ...(m.plan_year ? [cell('Plan Year', String(m.plan_year))] : []),
        ...(m.ack_id ? [cell('ACK ID', String(m.ack_id))] : []),
        // The dashboard's own link: EFAST2's search, where the ACK ID finds it.
        cell('Record', <RecordLink href="https://www.efast.dol.gov/5500Search">EFAST2 Form 5500 search</RecordLink>, { span: 'full' as const })
      ]
    case 'sba_entity_v2':
      return [
        ...(m.name ? [cell('Business name', m.name)] : []),
        ...(m.uei ? [cell('Unique Entity Identifier (UEI)', String(m.uei))] : [])
      ]
    case 'npi_record':
      return [
        ...(m.source_data ?? []).flatMap((f) => valuesOf(f.value).map((v) => cell(f.name, v))),
        ...(m.source_data_link ? [cell('Record', <RecordLink href={m.source_data_link}>NPI Registry</RecordLink>)] : [])
      ]
    case 'parsed_sos_document':
      return [
        ...(st ? [cell('State', st)] : []),
        ...(m.document_type ? [cell('Document type', m.document_type)] : []),
        ...(m.file_number ? [cell('File number', m.file_number)] : []),
        ...(m.filing_date ? [cell('Filed date', longDate(m.filing_date) ?? m.filing_date)] : []),
        ...sosLink
      ]
    case 'historical_registration':
      return [...(st ? [cell('State', st)] : []), ...(m.file_number ? [cell('File number', m.file_number)] : []), ...sosLink]
    // A licence's link and capture close its card (`registerTail`), as on the report.
    case 'license':
      return []
    case 'website':
      return record?.website?.url ? [cell('Record', <RecordLink href={record.website.url}>{record.website.url}</RecordLink>, { span: 'full' as const })] : []
    case 'professional_license':
      return [
        ...(st ? [cell('State', st)] : []),
        ...(m.license_type ? [cell('License type', sentence(m.license_type))] : []),
        ...(m.license_number ? [cell('License number', m.license_number)] : []),
        ...(m.status ? [cell('Status', sentence(m.status))] : [])
      ]
    case 'jurisdiction_registration':
      return [
        ...(m.jurisdiction?.name ? [cell('Jurisdiction', m.jurisdiction.name)] : []),
        ...(m.jurisdiction?.state ? [cell('State', stateName(m.jurisdiction.state))] : []),
        ...(m.jurisdiction?.tax_type ? [cell('Tax type', m.jurisdiction.tax_type)] : [])
      ]
    case 'lien':
      // A lien the record cites without holding the filing: its state is all there is.
      return s.doc?.lien ? [] : st ? [cell('State', st)] : []
    default:
      return []
  }
}

const RecordLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    className="underline decoration-[var(--core-color-border-strong)] underline-offset-2 hover:decoration-current"
  >
    {children}
  </a>
)

/** Active green, inactive or dissolved red, nothing stated grey — the app's MetaTag. */
const toneOf = (status?: string | null) =>
  !status || /^unknown$/i.test(status) ? ('subtle' as const) : /^active$/i.test(status) ? ('success' as const) : ('danger' as const)

const StatusTagCell = ({ label, status }: { label: string; status?: string | null }) => (
  <Tag tone={toneOf(status)} size="compact" className={BADGE}>
    {label}
  </Tag>
)

/** A filing, section for section as the app's `SOSRegistrationCard` reads it. */
const RegistrationSections = ({ s }: { s: Source }) => {
  const r = s.registration!
  const st = registrationState(r)
  const people = s.supplied.get('people') ?? []
  const addresses = s.supplied.get('address') ?? []
  return (
    <>
      <CardLabelRow as="h4">Status details</CardLabelRow>
      <AttributeCells
        items={[
          cell('Jurisdiction', r.jurisdiction ? sentence(r.jurisdiction) : NOT_PROVIDED),
          cell('Status', <StatusTagCell label={st.status ?? NOT_PROVIDED} status={st.status} />),
          cell('Sub-status', st.subStatus ? <StatusTagCell label={st.subStatus} status={st.status} /> : NOT_PROVIDED),
          ...(st.statusDetails ? [cell('Status details', st.statusDetails)] : [])
        ]}
      />
      <CardLabelRow as="h4">Entity details</CardLabelRow>
      <AttributeCells
        items={[
          cell('Business name', r.name || NOT_PROVIDED),
          cell('Entity type', entityFormLabel(r.entityType) ?? NOT_PROVIDED)
        ]}
      />
      {addresses.length > 0 && (
        <>
          <CardLabelRow as="h4">Addresses</CardLabelRow>
          <SuppliedCells rows={addresses} />
        </>
      )}
      {people.length > 0 && (
        <>
          <CardLabelRow as="h4">People</CardLabelRow>
          <SuppliedCells rows={people} />
        </>
      )}
      <CardLabelRow as="h4">Filing details</CardLabelRow>
      <AttributeCells
        items={[
          cell('Filed date', longDate(r.registrationDate) ?? NOT_PROVIDED),
          cell('File number', r.fileNumber ?? NOT_PROVIDED),
          ...(r.sourceUrl
            ? [
                cell(
                  'Record',
                  <a
                    href={r.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-[var(--core-color-border-strong)] underline-offset-2 hover:decoration-current"
                  >
                    {`${stateName(r.state)} Secretary of State website`}
                  </a>,
                  { span: 'full' as const }
                )
              ]
            : [])
        ]}
      />
    </>
  )
}

/** A carrier record, as the app's `FMCSARegistrationCard` reads it. */
const FmcsaSections = ({ s }: { s: Source }) => (
  <>
    {(s.fmcsa ?? []).map((f) => (
      <Fragment key={f.id}>
        <CardLabelRow as="h4">Registration details</CardLabelRow>
        <AttributeCells
          items={[
            cell('Business name', f.legalName ?? NOT_PROVIDED),
            ...(f.dbaName ? [cell('DBA name', f.dbaName)] : []),
            cell('USDOT number', f.dotNumber ?? NOT_PROVIDED),
            ...(f.sourceUrl
              ? [
                  cell(
                    'Record',
                    <a
                      href={f.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline decoration-[var(--core-color-border-strong)] underline-offset-2 hover:decoration-current"
                    >
                      FMCSA website
                    </a>
                  )
                ]
              : [])
          ]}
        />
        {f.addresses.length > 0 && (
          <>
            <CardLabelRow as="h4">Addresses</CardLabelRow>
            <AttributeCells items={f.addresses.map((a) => cell('Address', a))} />
          </>
        )}
      </Fragment>
    ))}
  </>
)

/** Values a source is cited for, labelled by the role they played for it. */
/** One cell per value, two to a row: a filing's addresses and officers are each
 *  their own entry, not one list under a single label. */
const SuppliedCells = ({ rows }: { rows: Supplied[] }) => {
  const cells = cellsFromRows(
      // A profile here is its page — site and link. What the page says (its
      // followers, ratings, activity) is the Attributes panel's.
      rows.map((item) => (item.row.pageUrl ? { ...item.row, fields: undefined } : item.row)),
      {
        labelFor: (_, i) => roleLabel(rows[i]),
        // A profile's page is linked here, on its source, not in Attributes.
        valueFor: (row, i) =>
          row.pageUrl ? (
            <a
              href={row.pageUrl}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-[var(--core-color-border-strong)] underline-offset-2 hover:decoration-current"
            >
              {row.pageUrl}
            </a>
          ) : (
            withoutRole(supplied(rows[i]), rows[i].role)
          ),
        // The card IS the source. A chip on every value would cite the card to itself.
        provenance: false
      }
    )
  // But a value the customer submitted still says so, under it, as it does on
  // the report — the practice address an NPI record shares with the submitted office.
  const marked =
    cells.length === rows.length ? cells.map((c, i) => submittedUnder(c, rows[i].row.submitted)) : cells
  return <AttributeCells items={marked} />
}

/**
 * One entry per person, the roles the record gives them under it.
 *
 * A record that names Ali Hamidi as registered agent, CEO, CFO, secretary and
 * CTO is one person with five roles, not five people; five cells said the
 * name five times and the reader counted them. Grouped on the name as written
 * (case and punctuation aside), never a look-alike. Labelled "Officer" where
 * any role is an office; a name given only as registered agent keeps that.
 */
const onePerPerson = (rows: Supplied[]): Supplied[] => {
  const byName = new Map<string, { first: Supplied; name: string; roles: string[] }>()
  for (const item of rows) {
    const name = withoutRole(supplied(item), roleLabel(item))
    const key = norm(name)
    const entry = byName.get(key) ?? { first: item, name, roles: [] }
    const role = roleLabel(item)
    if (role && !entry.roles.includes(role)) entry.roles.push(role)
    byName.set(key, entry)
  }
  return [...byName.values()].map(({ first, name, roles }) => {
    const label = roles.length === 1 ? roles[0] : roles.every((r) => /registered agent/i.test(r)) ? 'Registered agent' : 'Officer'
    return {
      ...first,
      role: label,
      row: {
        ...first.row,
        label,
        value: name,
        matchValue: name,
        // Every role once, in the record's order — the label alone says nothing.
        trailing: roles.length > 1 ? roles.join(', ') : undefined
      }
    }
  })
}

/**
 * The registration a city registration card stands for, read out of the city's
 * own register — the same cells the report shows under Other filings. Its
 * registrations are the record's, and those under a name it has dropped.
 */
const cityRegistrationOf = (s: Source, record?: BusinessRecord) => {
  if (!record || appTypeOf(s) !== 'city_registration') return []
  const ids = new Set(s.refs.map((x) => x.id))
  return [record, ...priorNameRecords(record)]
    .flatMap((r) => r.cityRegistrations ?? [])
    .filter((r, i, all) => r.refId && ids.has(r.refId) && all.findIndex((x) => x.locationId === r.locationId && x.refId === r.refId) === i)
}

/** Any other source, under the app's section names for it. */
const RecordSections = ({ s, record, skip }: { s: Source; record?: BusinessRecord; skip?: GroupId[] }) => {
  const groups = sourceGroups(s).filter(([g]) => !skip?.includes(g))
  const regs = cityRegistrationOf(s, record)
  // The register's own cells already name the business and its owner.
  const names = regs.length > 0 ? [] : (s.supplied.get('name') ?? [])
  // The Submitted card already holds one entry per person.
  const people = (s.id === SUBMITTED_CARD ? (s.supplied.get('people') ?? []) : onePerPerson(s.supplied.get('people') ?? [])).filter(
    ({ row }) => !regs.some((r) => sameName(r.owner, row.matchValue ?? row.value))
  )
  const addresses = s.supplied.get('address') ?? []
  const rest = groups.filter(([g]) => g !== 'name' && g !== 'people' && g !== 'address')
  const details = metaCells(s, record)
  const type = appTypeOf(s)
  return (
    <>
      {regs.length > 0 && (
        <>
          <CardLabelRow as="h4">Registration details</CardLabelRow>
          <AttributeCells items={cityRegistrationCells(regs, regs[0].city)} />
        </>
      )}
      {(names.length > 0 || details.length > 0) && type !== 'profiles' && (
        <>
          <CardLabelRow as="h4">
            {s.id === SUBMITTED_CARD ? 'Business details' : ROW_KEY[type] ? 'Names' : type === 'website' ? 'Site' : (DETAILS[type] ?? 'Registration details')}
          </CardLabelRow>
          {names.length > 0 && (
            <AttributeCells
              items={cellsFromRows(
                names.map((item) => item.row),
                {
                  labelFor: (row) => (/dba|doing business/i.test(row.label) ? 'Doing business as' : 'Business name'),
                  valueFor: (_, i) => supplied(names[i]),
                  provenance: false
                }
              )}
            />
          )}
          {details.length > 0 && <AttributeCells items={details} />}
        </>
      )}
      {rest.map(([g, rows]) => (
        <Fragment key={g}>
          {/* Not repeated under a card already titled by it. */}
          {GROUP_LABEL.get(g) !== appHeader(s).title && <CardLabelRow as="h4">{GROUP_LABEL.get(g)}</CardLabelRow>}
          <SuppliedCells rows={rows} />
        </Fragment>
      ))}
      {people.length > 0 && (
        <>
          <CardLabelRow as="h4">People</CardLabelRow>
          <SuppliedCells rows={people} />
        </>
      )}
      {addresses.length > 0 && (
        <>
          <CardLabelRow as="h4">Addresses</CardLabelRow>
          <SuppliedCells rows={addresses} />
        </>
      )}
    </>
  )
}

const SCREEN_RESULTS = new Set(['watchlist_result', 'pep_result', 'adverse_media_result'])

/** The record kinds read out as one row each, as the report's strips read them. */
const ROW_KEY: Record<string, string> = { lien: 'liens', litigation: 'litigations', bankruptcy: 'bankruptcies' }

const docIdOf = (d?: SourceDoc) => d?.lien?.id ?? d?.litigation?.id ?? d?.bankruptcy?.id

/**
 * A lien, a court case or a petition, as the report reads it: the same row
 * (`attributesFor`), with every field the filing carries under it — the
 * debtors, the parties, the collateral, the judgments — and the filing
 * office's own page.
 */
const RecordRowSection = ({ s, record }: { s: Source; record: BusinessRecord }) => {
  const type = appTypeOf(s)
  const id = docIdOf(s.doc)
  const rows = attributesFor(ROW_KEY[type], record).filter((r) => r.docId === id)
  if (rows.length === 0) return null
  const href = s.doc?.lien?.url
  const lien = s.doc?.lien
  // A lien draws the same sections the report's lien block does — filing
  // information, secured parties, debtors — with its status as the first
  // cell (the report's band carries the chip) and the filing office's page
  // as the last.
  const statusCell = (status: string | null | undefined) =>
    cell('Status', lienStatusKind(status) ? <StatusChip status={status} /> : status && !/^unknown$/i.test(status) ? sentence(status) : 'Not stated')
  const sectionHeading = (label: string) => <CardLabelRow as="h4">{label}</CardLabelRow>
  // A court case and a petition draw their sections the same way: the status
  // first, then the dashboard's arrangement of the record.
  const litigation = s.doc?.litigation
  if (litigation)
    return <RecordGrids sections={litigationSections(litigation, { lead: [statusCell(litigation.caseStatus)] })} heading={sectionHeading} />
  const bankruptcy = s.doc?.bankruptcy
  if (bankruptcy)
    return <RecordGrids sections={bankruptcySections(bankruptcy, { lead: [statusCell(bankruptcy.status)] })} heading={sectionHeading} />
  if (lien) {
    const kind = lienStatusKind(lien.status)
    return (
      <LienSections
        lien={lien}
        heading={(label) => <CardLabelRow as="h4">{label}</CardLabelRow>}
        extra={{
          lead: [cell('Status', kind ? <StatusChip status={lien.status} /> : lien.status ? sentence(lien.status) : 'Not stated')],
          trail: href ? [cell('Record', <RecordLink href={href}>Filing office website</RecordLink>, { span: 'full' as const })] : []
        }}
      />
    )
  }
  return (
    <>
      <CardLabelRow as="h4">{DETAILS[type] ?? 'Details'}</CardLabelRow>
      <AttributeCells
        items={[
          ...cellsFromRows(rows, { provenance: false }),
          ...(href ? [cell('Record', <RecordLink href={href}>Filing office website</RecordLink>, { span: 'full' as const })] : [])
        ]}
      />
    </>
  )
}

/** The record's own PDFs filed with this source: a lien's initial filing and
 *  amendments, a filing's certificate of good standing. */
const DocumentsSection = ({ docs }: { docs: SourceDoc['documents'] }) =>
  docs.length === 0 ? null : (
    <>
      <CardLabelRow as="h4">Documents</CardLabelRow>
      <AttributeCells
        items={docs.map((d) =>
          cell(d.documentType ? sentence(d.documentType) : 'Document', d.filename ?? 'Unnamed file', {
            note: d.filingDate ? `Filed ${longDate(d.filingDate.slice(0, 10)) ?? d.filingDate}` : undefined
          })
        )}
      />
    </>
  )

/** One screening result, as the report's screening card draws it. */
const ScreeningSection = ({ s, record }: { s: Source; record: BusinessRecord }) => {
  const sc = screenedOf(record)
  const d = s.doc!
  const ctx = { record }
  if (d.kind === 'watchlist_result')
    return <>{sc.watchlist.hits.filter((h) => h.hit.id === d.watchlist!.result.id).map((h, i) => <WatchlistBlock key={i} who={h} hit={h.hit} ctx={ctx} />)}</>
  if (d.kind === 'pep_result')
    return <>{sc.pep.hits.filter((h) => h.hit.id === d.pep!.id).map((h, i) => <PepBlock key={i} who={h} hit={h.hit} ctx={ctx} />)}</>
  return <>{sc.media.hits.filter((h) => h.hit.id === d.media!.id).map((h, i) => <MediaBlock key={i} who={h} hit={h.hit} ctx={ctx} />)}</>
}

/** A screen that ran and returned nothing: what it searched. */
const EmptyScreenSection = ({ s, record }: { s: Source; record: BusinessRecord }) => {
  const screen = s.doc!.screen!
  const sc = screenedOf(record)[screen]
  const lists = screen === 'watchlist' ? (record.watchlist?.lists ?? []) : []
  return (
    <>
      <CardLabelRow as="h4">Names screened</CardLabelRow>
      {sc.names.length > 0 ? (
        <AttributeCells items={sc.names.map((n) => cell(screen === 'pep' ? 'Person' : 'Name', n))} />
      ) : (
        // PEP runs on every person on the record, submitted or found.
        <MutedText className="block px-4 py-3">No people on the record</MutedText>
      )}
      {lists.length > 0 && (
        <>
          <CardLabelRow as="h4">Lists searched</CardLabelRow>
          <AttributeCells items={lists.map((l) => cell(l.agencyAbbr ?? l.agency ?? 'List', l.title ?? l.abbr ?? 'Untitled list'))} />
        </>
      )}
    </>
  )
}

/** Middesk's classification, as the Attributes tab and the insight draw it. */
const IndustrySection = ({ record }: { record: BusinessRecord }) => (
  <>
    <CardLabelRow as="h4">Classifications</CardLabelRow>
    <IndustryTable rows={attributesFor('industry', record)} />
  </>
)

/**
 * Every profile, in full: the page's name for the business, the page, its
 * status, and what it says — the same rows as the report's Web presence card
 * (`attributesFor`), so the two read alike. One per page.
 */
const ProfilesSection = ({ record }: { record: BusinessRecord }) => {
  const rows = attributesFor('profile', record).filter((r) => r.pageUrl || r.docId)
  if (rows.length === 0) return null
  return (
    <>
      <CardLabelRow as="h4">Profiles</CardLabelRow>
      <AttributeCells
        items={cellsFromRows(
          rows.map((r) => ({
            ...r,
            fields: [...(r.sourceNote ? [{ label: 'Status', value: r.sourceNote }] : []), ...(r.fields ?? [])]
          })),
          {
            provenance: false,
            // The page's name for the business, opening the page itself.
            valueFor: (r) => (r.pageUrl ? <RecordLink href={r.pageUrl}>{r.value}</RecordLink> : r.value)
          }
        )}
      />
    </>
  )
}

/**
 * One source, as the app's card for it: its title, the subtitle saying where it
 * is from, and its sections.
 *
 * Collapsed to its title until opened. Following a source to it — a chip, a
 * summary tag — opens it, and it stays open once read.
 */
export const SourceDetail = ({
  source: s,
  record,
  focused = false
}: {
  source: Source
  record?: BusinessRecord
  /** Followed here from an attribute's chip — ringed for a moment, and opened. */
  focused?: boolean
}) => {
  const { title, subtitle } = appHeader(s)
  const all = sourceGroups(s).flatMap(([, rows]) => rows)
  const [open, setOpen] = useState(focused)
  useEffect(() => {
    if (focused) setOpen(true)
  }, [focused])
  const bodyId = `source-body-${s.id}`

  return (
    <Surface
      id={`source-${s.id}`}
      variant="card"
      padding="none"
      className={cn('overflow-hidden', focused && 'ring-2 ring-ring')}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full items-start gap-2 px-4 py-3 text-left transition-colors duration-fast hover:bg-[var(--core-color-list-item-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none',
          open && 'border-b border-[var(--core-color-border-divider)]'
        )}
      >
        <span className="min-w-0 flex-1">
          <Text size="md" className="block truncate font-semibold">
            {title}
          </Text>
          {subtitle && <MutedText className="mt-0.5 block text-caption">{subtitle}</MutedText>}
        </span>
        <ChevronDown
          aria-hidden="true"
          size={14}
          strokeWidth={2}
          className={cn(
            'mt-1 shrink-0 text-[var(--core-color-text-secondary)] transition-transform duration-standard ease-emphasized motion-reduce:transition-none',
            !open && '-rotate-90'
          )}
        />
      </button>

      <Collapsible open={open} id={bodyId}>
        <div className="-mb-px">
          {s.registration ? (
            <>
              <RegistrationSections s={s} />
              <DocumentsSection docs={s.doc?.documents ?? []} />
            </>
          ) : s.fmcsa ? (
            <FmcsaSections s={s} />
          ) : s.id === STREET_VIEW_CARD ? (
            <StreetViewCaptures items={all} />
          ) : s.id === namedCard('Related businesses') && relatedBusinessesOf(record!).length > 0 ? (
            // Each related business, opening to the people and addresses it shares.
            <ConnectionSections record={record!} />
          ) : record && SCREEN_RESULTS.has(appTypeOf(s)) ? (
            <ScreeningSection s={s} record={record} />
          ) : record && appTypeOf(s) === 'screen' ? (
            <EmptyScreenSection s={s} record={record} />
          ) : record && appTypeOf(s) === 'industry' ? (
            <IndustrySection record={record} />
          ) : (
            <>
              {record && ROW_KEY[appTypeOf(s)] && <RecordRowSection s={s} record={record} />}
              {record && appTypeOf(s) === 'profiles' && <ProfilesSection record={record} />}
              <RecordSections
                s={s}
                record={record}
                // The record's own row is drawn above; filed again under its group it said everything twice.
                skip={appTypeOf(s) === 'profiles' ? ['profiles'] : ROW_KEY[appTypeOf(s)] ? ['liens', 'litigation', 'bankruptcy'] : undefined}
              />
              <DocumentsSection docs={s.doc?.documents ?? []} />
              {appTypeOf(s) === 'license' && s.doc?.license ? (
                // The register's link and the capture of its page, side by side
                // at the foot, as the report's licence record ends.
                <AttributeCells
                  items={registerTail(s.doc.license.id, s.doc.license.sourceUrl, s.doc.license.registry || 'NPI Registry')}
                />
              ) : (
                s.id !== SUBMITTED_CARD && <SourceCaptures items={all} />
              )}
            </>
          )}
        </div>
      </Collapsible>
    </Surface>
  )
}

/** The app's order: its source types, and within the filings the primary
 *  domestic filing first, then active, then inactive (`buildSourceData`). */
export const appOrderedSources = (sources: Source[], record: BusinessRecord) => {
  const primary = formationCardFilingOf(record)
  const rank = (s: Source) => {
    const i = APP_ORDER.indexOf(appTypeOf(s))
    return i === -1 ? APP_ORDER.length : i
  }
  const filing = (s: Source) => {
    const r = s.registration
    if (!r) return 0
    if (primary && r.state === primary.state && r.fileNumber === primary.fileNumber) return 0
    return /^active$/i.test(r.status ?? '') ? 1 : /^inactive$/i.test(r.status ?? '') ? 2 : 3
  }
  const last = (s: Source) => (s.id === STREET_VIEW_CARD ? 1 : 0)
  return sources
    .filter((s) => s.id !== SUBMITTED_CARD)
    .sort((a, b) => rank(a) - rank(b) || filing(a) - filing(b) || last(a) - last(b))
}

/** One summary tag, following to its card. */
const SummaryTag = ({ label, tone, onJump }: { label: string; tone: 'success' | 'warning' | 'danger' | 'subtle'; onJump: () => void }) => (
  <button type="button" onClick={onJump} className="rounded-pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
    <Tag tone={tone} size="compact" className={BADGE}>
      {label}
    </Tag>
  </button>
)

const SummaryRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid gap-1.5 px-4 py-3 [&+&]:border-t [&+&]:border-[var(--core-color-border-divider)]">
    <Text size="sm" className="font-semibold">
      {label}
    </Text>
    <div className="flex flex-wrap gap-1.5">{children}</div>
  </div>
)

/**
 * The app's two summary cards: authoritative sources, a row per type with a
 * tag per record, then alternative sources — the website and its profiles.
 * Each tag follows to its card.
 */
export const SourcesSummary = ({
  sources,
  record,
  onJump
}: {
  sources: Source[]
  record: BusinessRecord
  onJump: (sourceId: string) => void
}) => {
  const of = (type: string) => sources.filter((s) => appTypeOf(s) === type)
  const tags = (type: string, label: (s: Source) => string[], tone: (s: Source) => 'success' | 'warning' | 'danger' | 'subtle' = () => 'success') =>
    of(type).flatMap((s) => label(s).map((l, i) => <SummaryTag key={`${s.id}:${i}`} label={l} tone={tone(s)} onJump={() => onJump(s.id)} />))

  const rows: Array<[string, React.ReactNode[]]> = [
    [
      'Secretary of State filings',
      tags(
        'registration',
        (s) => [
          `${s.registration!.state} · ${jurisdiction(s.registration!, record) === 'Domestic' ? 'Formation state · ' : ''}${
            registrationState(s.registration!).status ?? NOT_PROVIDED
          }`
        ],
        (s) => toneOf(registrationState(s.registration!).status)
      )
    ],
    ['FMCSA registrations', tags('fmcsa_registration', (s) => [s.doc?.fmcsa?.dotNumber ? `DOT ${s.doc.fmcsa.dotNumber}` : 'DOT'])],
    ['Professional licenses', tags('professional_license', (s) => [stateOf(s) ?? 'License'])],
    ['Licenses', tags('license', (s) => [s.doc?.license ? `${s.doc.license.registry} · ${s.doc.license.number}` : 'License'])],
    ['Sales tax permits', tags('sales_tax_permit', (s) => [stateOf(s) ?? 'Sales tax permit'], (s) => toneOf(metas(s)[0]?.status))],
    ['NPI records', tags('npi_record', (s) => [metas(s)[0]?.id ? `NPI ${metas(s)[0].id}` : 'NPI'])],
    ['Form 5500 filings', tags('form_5500', (s) => [`IRS · ${metas(s)[0]?.plan_year ?? ''}`.trim()], () => 'subtle')],
    ['SEC EDGAR Filings', tags('sec_filing', () => ['SEC'])],
    [
      'City Registrations',
      tags(
        'city_registration',
        (s) => [unique(metas(s).filter((m) => m.city).map((m) => `${m.city}, ${m.state?.toUpperCase()}`))[0] ?? 'City registration'],
        // Active green, closed grey: a closed city registration is history.
        (s) => (metas(s).some((m) => /^active$/i.test(m.status ?? '')) ? 'success' : 'subtle')
      )
    ],
    ['SAM Entity Registration', tags('sam_entity_extract', () => ['SAM Registration'], () => 'subtle')],
    ['Small Business Administration records', tags('sba_entity_v2', () => ['SBA Profile'])],
    ['SOS documents', tags('parsed_sos_document', (s) => [stateOf(s) ?? 'SOS document'], () => 'subtle')],
    ['Historical registrations', tags('historical_registration', (s) => [stateOf(s) ?? 'Historical'], () => 'subtle')],
    ['Jurisdiction registrations', tags('jurisdiction_registration', (s) => [metas(s)[0]?.jurisdiction?.name ?? 'Jurisdiction'])],
    ['EPA facilities', tags('epa_frs_facility', () => ['EPA FRS'], () => 'subtle')],
    // Open is the report's amber, not red: a live lien is a fact to read, not a verdict.
    ['Lien filing', tags('lien', (s) => [stateOf(s) ?? 'Lien'], (s) => (/open/i.test(s.doc?.lien?.status ?? '') ? 'warning' : 'subtle'))],
    ['Court records', tags('litigation', (s) => [s.doc?.litigation?.caseNumber ?? s.doc?.litigation?.court ?? 'Case'], (s) => (/open/i.test(s.doc?.litigation?.caseStatus ?? '') ? 'warning' : 'subtle'))],
    ['Bankruptcy petitions', tags('bankruptcy', (s) => [s.doc?.bankruptcy?.chapter ? `Chapter ${s.doc.bankruptcy.chapter}` : 'Petition'], (s) => (/open/i.test(s.doc?.bankruptcy?.status ?? '') ? 'warning' : 'subtle'))],
    ['Screening results', [
      ...tags('watchlist_result', (s) => [s.doc?.watchlist?.list.abbr ?? 'Watchlist'], () => 'danger'),
      ...tags('pep_result', () => ['PEP'], () => 'danger'),
      ...tags('adverse_media_result', () => ['Adverse media'], () => 'danger'),
      ...tags('screen', (s) => [`${SCREEN_TITLE[s.doc!.screen!]} · No results · Screened`], () => 'subtle')
    ]],
    ['Documents', tags('document', (s) => [s.doc?.documents[0]?.documentType ?? 'Document'], () => 'subtle')],
    // Not a type the dashboard has: the prototype's own sources.
    ['Other sources', [...tags('tin', () => ['IRS TIN record'], () => 'subtle'), ...tags('generic_verification_source', (s) => [appHeader(s).title], () => 'subtle')]]
  ]
  const authoritative = rows.filter(([, t]) => t.length > 0)
  const alternative = [...of('website'), ...of('profiles'), ...of('industry')].map((s) => (
    <SummaryTag key={s.id} label={appHeader(s).title} tone="success" onJump={() => onJump(s.id)} />
  ))

  const card = (title: string, body: React.ReactNode) => (
    <Surface variant="card" padding="none" className="overflow-hidden">
      <div className="border-b border-[var(--core-color-border-divider)] px-4 py-3">
        <Text size="md" className="font-semibold">
          {title}
        </Text>
      </div>
      {body}
    </Surface>
  )

  return (
    <>
      {card(
        'Authoritative sources',
        authoritative.length > 0 ? (
          authoritative.map(([label, t]) => (
            <SummaryRow key={label} label={label}>
              {t}
            </SummaryRow>
          ))
        ) : (
          <MutedText className="block px-4 py-3">No authoritative sources found</MutedText>
        )
      )}
      {card(
        'Alternative sources',
        alternative.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 px-4 py-3">{alternative}</div>
        ) : (
          <MutedText className="block px-4 py-3">No alternative sources found</MutedText>
        )
      )}
    </>
  )
}
