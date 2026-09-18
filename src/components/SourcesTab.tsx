import { useState } from 'react'

import { Heading, MutedText, Surface, Tag, Text } from '@/core'

import { PanelGroup } from './PanelGroup'

import type { AttributeRow } from '../lib/attributes'
import type { BusinessRecord, Derived, SourceRef } from '../lib/deriveResults'
import { GROUPS, type GroupId } from '../lib/groups'
import { PROFILES, SUBMITTED_CARD, namedCard, registrationCard } from '../lib/sourceCards'
import { capturedLabel, screenshotFor } from '../lib/sourceScreenshots'
import { streetViewFor } from '../lib/addressStreetViews'
import { profileName } from '../lib/attributes'
import { stateName } from '../lib/states'
import { useScreenshotViewer } from './ScreenshotViewer'

/** The tab's own group names. THEME holds the short forms used on citation
 *  chips, where "Name and formation" does not fit; a heading has the room, and
 *  the two tabs disagreeing about what a group is called is worse than long. */
const GROUP_LABEL = new Map(GROUPS.map((g) => [g.id, g.label]))
import { WEBSITE_METADATA, attributeRowsByGroup, sourceLabel } from './AttributesTab'

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
/**
 * Source types issued by one jurisdiction at a time.
 *
 * Each record carries its own state, status and identifiers, so one card per
 * type flattened several separate permits into a single unlabelled list.
 *
 * `Lien` is here because the filings themselves now arrive scoped — "Lien ·
 * Virginia" — and an unscoped `Lien` card built from a name row's source ref
 * sat beside them holding the same Virginia filing under a vaguer title.
 */
const PER_JURISDICTION = new Set(['Tax permit', 'City registration', 'Lien'])

const GOVERNMENT = new Set([
  'Tax permit',
  'City registration',
  'Form 5500',
  'Lien',
  'Court record',
  'Bankruptcy court',
  'SAM',
  'SOS document',
  'Tax exempt org'
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

/**
 * Google's own card.
 *
 * Street View is a source in its own right — a car was at the address and the
 * frame is what it saw — so it gets a card rather than living inside the
 * registries that stated the addresses. It supplies nothing the filings
 * supplied; what it gives is the one thing none of them can, which is a look
 * at the place.
 */
const STREET_VIEW_CARD = 'src:Street View'

/** One source, and everything on the record that came from it. */
type Source = {
  id: string
  label: string
  /** The filing itself, where the source IS a filing. */
  registration?: Registration
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

const add = (into: Map<GroupId, Supplied[]>, group: GroupId, item: Supplied) =>
  into.set(group, [...(into.get(group) ?? []), item])

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

        const id = registrationCard(r)
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
          Boolean(r.registeredAgent) && norm(r.registeredAgent ?? '') === norm(row.matchValue ?? row.value)

        add(get(id, `Secretary of State · ${stateName(r.state)}`, r, r.sourceUrl ?? undefined).supplied, group, {
          row,
          ref,
          role: isAgent ? 'Registered agent' : undefined
        })
      }

      for (const name of row.sources ?? []) {
        // Keyed on the LABEL, not the raw name: "Website crawl" and "Website"
        // both read as Website, so keying on the raw value made two cards with
        // the same title — the URL in one, the domain in the other.
        //
        // Profiles fold into one Web presence card: five profiles are five
        // records of one thing, and as five cards they crowded out the filings
        // while each held a single attribute.
        const named = sourceLabel(name)
        const profile = PROFILES.has(named)
        const title = profile ? 'Web presence' : named

        // Every instance, deduplicated by the API's own source id — three tax
        // permits are three records and each carries its own state and status.
        // Both sides through `sourceLabel`: `row.sources` holds the readable
        // form ("form 5500") while a ref holds the raw type ("form_5500"), so
        // comparing them directly never matched and every non-filing source
        // came out with no records at all.
        const matches = (x: SourceRef) => sourceLabel(x.type) === sourceLabel(name)
        const mine = (row.refs ?? []).filter(matches)

        // A permit is issued by ONE jurisdiction. Three of them in one card put
        // Pennsylvania's registration number a line above California's with
        // nothing saying which was which, and merged their statuses into a set.
        if (PER_JURISDICTION.has(named) && mine.length > 0) {
          const byState = new Map<string, SourceRef[]>()
          for (const x of mine) {
            const st = ((x.metadata as { state?: string })?.state ?? '').toUpperCase()
            byState.set(st, [...(byState.get(st) ?? []), x])
          }

          for (const [st, refs] of byState) {
            const scoped = st ? `${named} · ${stateName(st)}` : named
            const card = get(`src:${scoped}`, scoped, undefined, undefined, named)
            for (const x of refs)
              if (!card.refs.some((r) => r.id === x.id)) card.refs.push(x)
            add(card.supplied, group, { row, ref: refs[0] })
          }
          continue
        }

        // Created only once it is known this is not a per-jurisdiction type —
        // calling `get` first left an empty "Tax permit" shell beside the three
        // real ones, since `get` registers the card as a side effect.
        const source = get(namedCard(named), title)
        for (const x of mine) if (!source.refs.some((r) => r.id === x.id)) source.refs.push(x)

        const ref = mine[0]
        // Merged, but each row still names the profile it came from — "Web
        // presence" alone loses the only thing separating a Trustpilot review
        // page from a LinkedIn company page.
        add(source.supplied, group, { row, ref, role: profile ? named : undefined })
      }

      // Submitted is a source too — the weakest one, and the only one the
      // customer controls. Leaving it out made the tab look like everything
      // here was independently found.
      if (row.submitted) add(get(SUBMITTED_CARD, 'Submitted').supplied, group, { row, bare: true })
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

  // A filing's registered agent is a person that filing names. Most are also in
  // the record's people[] and resolve on their own; some — Delaware's agent
  // here — appear nowhere else, and leaving them only in the payload put a
  // person under a heading of dates and file numbers.
  for (const source of byId.values()) {
    const agent = source.registration?.registeredAgent
    if (!agent) continue

    const people = source.supplied.get('people') ?? []
    if (people.some(({ row }) => norm(row.matchValue ?? row.value) === norm(agent))) continue

    add(source.supplied, 'people', {
      role: 'Registered agent',
      row: {
        group: 'people',
        label: 'Registered agent',
        value: agent,
        source: '',
        sources: [],
        matchValue: agent
      }
    })
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
    // A jurisdiction-scoped source bands on its TYPE. "Lien · Virginia" and
    // "Court record · Queens County Supreme Court" are a filing office and a
    // court; matching the whole label put both in with the web pages.
    const kind = (s.kind ?? s.label).split(' · ')[0]
    return GOVERNMENT.has(kind) ? 'government' : 'web'
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

/**
 * Status and standing are two different facts.
 *
 * `status` is whether the registration is live — active, inactive, unknown.
 * `sub_status` is its standing with the state — in good standing or not, or
 * dissolved. A company can be active and NOT in good standing, which is the
 * case an analyst most needs to see, and joining the pair into one string
 * ("Active · not in good standing") buried it inside a sentence and implied one
 * fact where there are two. Delaware publishes a status and no standing at all.
 */
const BADGE = 'px-1.5 py-0 text-[11px] leading-4'

/** Status carries colour because it is the one that changes a decision. */
const STATUS_TONE: Record<string, 'success' | 'danger' | 'subtle'> = {
  active: 'success',
  inactive: 'danger'
}

/**
 * The API's own words, cased for reading — nothing renamed.
 *
 * `status` is whether the registration is live; `sub_status` is its standing
 * with the state. They are two facts and stay two fields: a company can be
 * active and NOT in good standing, which is the case worth seeing. Where the
 * API says `unknown` it is shown as Unknown, not dressed up as "not published"
 * — that would be this code claiming to know why the value is missing.
 */
const sentence = (v: string) =>
  v.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())

const status = (r: Registration) => sentence(r.status ?? 'unknown')

const standing = (r: Registration) => (r.subStatus ? sentence(r.subStatus) : 'Unknown')

const Field = ({
  label,
  lead,
  trailing,
  children
}: {
  label: string
  /** Identifiers in a column of their own, so four codes on one row and one on
   *  the next still line up against each other. */
  lead?: string
  /** Held hard right — a qualifier on the value, not part of it. */
  trailing?: string
  children: React.ReactNode
}) => (
  <div className="flex gap-2">
    <MutedText className="w-36 shrink-0 text-body font-semibold">{label}</MutedText>
    {lead !== undefined && (
      <Text size="md" className="w-44 shrink-0 break-words tabular-nums">
        {lead}
      </Text>
    )}
    <Text size="md" className="min-w-0 flex-1 break-words">
      {children}
    </Text>
    {trailing && <MutedText className="shrink-0 text-body">{trailing}</MutedText>}
  </div>
)

/** The filing's own payload, verbatim — what the API returned about it. */
const RegistrationPayload = ({ r }: { r: Registration }) => (
  // No top rule: this is the first thing in the card body, which already carries
  // one. Two rules a line apart read as an empty row above the payload.
  <div className="grid gap-1">
    {/* Identical on every filing. Each registration states its own name,
        entity type, agent and standing, so nothing here depends on whether the
        filing is the domestic one — that is what the jurisdiction chip says,
        and it is the only thing that should differ between these cards. */}
    {/* Labels are the registration object's own field names — `name`,
        `entity_type`, `sub_status`, `file_number`, `registration_date`,
        `source` — read out. Renaming them ("Filed as", "Standing", "Registry")
        put words on screen the source never used, and nothing downstream could
        be traced back to the field it came from. */}
    <Field label="Name">{r.name || 'Unknown'}</Field>
    <Field label="Entity type">{r.entityType ?? 'Unknown'}</Field>
    {/* Also on the header as a chip. It stays here because this block is the
        registration object read out, and dropping a field from it because the
        header happens to summarise it makes the record incomplete. */}
    <Field label="Jurisdiction">{r.jurisdiction ?? 'Unknown'}</Field>
    <Field label="Status">{status(r)}</Field>
    <Field label="Sub status">{standing(r)}</Field>
    {/* The registered agent is not a payload field here — they are a person on
        the record, so they appear under People with the filings that name them,
        the same as any officer. */}
    {/* Officers and addresses are not repeated here. They are the filing's raw
        arrays, and the section below lists the same people and addresses as
        attributes — with their titles, their labels, and the normalisation the
        rest of the record uses. Printing both said everything twice, the
        second time worse. */}
  </div>
)

/**
 * A non-filing source's own payload.
 *
 * Only registrations had one, so a Form 5500 card showed what it corroborated
 * and never its plan year or acknowledgement id — the record held them and the
 * screen dropped them. Keys are the API's own, read out; `labels` is excluded
 * because it is the role, already carried by the row labels above.
 */
const SourceRecords = ({ refs }: { refs: SourceRef[] }) => {
  const shown = refs
    .map((r) => Object.entries(r.metadata ?? {}).filter(([k, v]) => k !== 'labels' && v != null))
    .filter((entries) => entries.length > 0)

  if (shown.length === 0) return null

  return (
    <div className="mt-4">
      <Heading level={4}>{shown.length > 1 ? 'Records' : 'Record'}</Heading>
      {shown.map((entries, i) => (
        <div key={i} className="mt-1 grid gap-1 border-t border-solid border-border pt-2 first:border-0 first:pt-0">
          {entries.map(([k, v]) => (
            <Field key={k} label={sentence(k)}>
              {String(v)}
            </Field>
          ))}
        </div>
      ))}
    </div>
  )
}

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
      className="h-28 w-44 rounded-control border border-solid border-border bg-white object-cover object-top transition-shadow group-hover:shadow-elevation-popover"
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
    <div className="mt-4">
      <Heading level={4}>{captures.length > 1 ? 'Captures' : 'Capture'}</Heading>
      <div className="mt-2 flex flex-wrap gap-3">
        {captures.map((capture) => (
          <CaptureThumb key={capture.label + (capture.src ?? '')} capture={capture} />
        ))}
      </div>
    </div>
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

/** Where the filing sits in the registry, rather than what it says. */
const FilingDetails = ({ r }: { r: Registration }) => (
  <div className="mt-4">
    <Heading level={4}>Filing details</Heading>
    <div className="mt-1 grid gap-1">
      <Field label="File number">{r.fileNumber ?? 'Unknown'}</Field>
      <Field label="Registration date">{r.registrationDate ?? 'Unknown'}</Field>
      {r.sourceUrl && (
        <Field label="Source">
          <a
            href={r.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-[var(--core-color-border-strong)] underline-offset-2 hover:decoration-current"
          >
            {r.sourceUrl}
          </a>
        </Field>
      )}
    </div>
  </div>
)

/**
 * What the card holds, in the subtitle.
 *
 * Normally the groups — Addresses, People. But a card whose single group is
 * named after the card itself said "Industry classification · Industry
 * classification" and claimed nothing: the useful summary there is what is
 * actually inside, which is NAICS, SIC, MCC and the prohibited check.
 */
const summary = (source: Source, groups: Array<[GroupId, Supplied[]]>) => {
  const single = groups.length === 1 && GROUP_LABEL.get(groups[0][0]) === source.label
  if (!single) return groups.map(([g]) => GROUP_LABEL.get(g)).join(', ')
  return [...new Set(groups[0][1].map((item) => roleLabel(item)))].join(', ')
}

export const SourcesTab = ({
  record,
  results,
  groupFor,
  focus
}: {
  record: BusinessRecord
  results: Derived[]
  groupFor: (insightId: string) => GroupId
  /** Card id followed from an attribute's source chip — opened and flashed. */
  focus?: string | null
}) => {
  // Open by default. The tab exists to be read — collapsed, every card asked for
  // a click before it said anything, and comparing five filings meant opening
  // five. `closed` holds what the reader has chosen to put away.
  const [closed, setClosed] = useState<Set<string>>(new Set())
  const sources = sourcesFor(record, results, groupFor)
  const order = GROUPS.map((g) => g.id)

  // Four bands, strongest first. What the customer claimed, the filings that
  // constitute the entity, the government records showing it transacting, and
  // the open web that corroborates.
  const sections = (
    [
      ['submitted', 'Submitted'],
      ['registration', 'Registrations'],
      ['government', 'Government sources'],
      ['web', 'Web and public sources']
    ] as const
  )
    .map(([key, label]) => ({ key, label, items: sources.filter((s) => s.band === key) }))
    .filter((section) => section.items.length > 0)

  return (
    <div className="grid gap-[var(--core-spacing-md)]">
      {sections.map((section, si) => (
        <PanelGroup
          key={section.key}
          label={section.label}
          count={section.items.length}
          defaultOpen={si === 0}
        >
          <div className="grid gap-[var(--core-spacing-sm)]">
          {section.items.map((s) => {
        const groups = [...s.supplied.entries()].sort(
          (a, b) => order.indexOf(a[0]) - order.indexOf(b[0])
        )
        const total = groups.reduce((n, [, rows]) => n + rows.length, 0)
        // A followed card opens whatever the reader had put away: arriving at a
        // collapsed card says nothing, which is the opposite of following a
        // citation.
        const expanded = !closed.has(s.id) || s.id === focus

        return (
          <Surface
            key={s.id}
            id={`source-${s.id}`}
            variant="default"
            padding="none"
            className={`scroll-mt-6 overflow-hidden${
              s.id === focus ? ' ring-2 ring-[var(--core-color-border-strong)]' : ''
            }`}
          >
            <button
              type="button"
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--core-color-state-hover-bg)]"
              onClick={() =>
                setClosed((prev) => {
                  const next = new Set(prev)
                  if (expanded) next.add(s.id)
                  else next.delete(s.id)
                  return next
                })
              }
              aria-expanded={expanded}
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <Text size="md" className="truncate font-semibold">
                    {s.label}
                  </Text>
                  {/* Domestic or foreign belongs on the header, not buried in
                      the payload: it is the first thing that tells you what
                      weight a filing carries. The domestic filing is the one
                      the entity was formed under. */}
                  {s.registration && (
                    <>
                      <Tag tone="subtle" size="compact" className={BADGE}>
                        {jurisdiction(s.registration, record)}
                      </Tag>
                      {/* Whether the filing is live, on the header. Reading it
                          meant expanding every card; it is the other half of
                          what a filing is, beside where it was made. */}
                      <Tag
                        tone={STATUS_TONE[s.registration.status ?? 'unknown'] ?? 'subtle'}
                        size="compact"
                        className={BADGE}
                      >
                        {status(s.registration)}
                      </Tag>
                    </>
                  )}
                </span>
                <MutedText className="mt-0.5 block text-caption">
                  {total} attribute{total === 1 ? '' : 's'} · {summary(s, groups)}
                </MutedText>
              </span>
              <MutedText className="shrink-0 text-caption">{expanded ? 'Hide' : 'Show'}</MutedText>
            </button>

            {expanded && (
              <div className="border-t border-solid border-border px-4 py-3">
                {s.registration && <RegistrationPayload r={s.registration} />}

                {s.id !== STREET_VIEW_CARD &&
                  groups.map(([g, rows]) => (
                  <div key={g} className="mt-4 first:mt-0">
                    {/* A card supplying one group does not need that group
                        named — the card title already says what this is, and
                        "Industry codes" under "Industry classification" is the
                        same word twice. */}
                    {groups.length > 1 && <Heading level={4}>{GROUP_LABEL.get(g)}</Heading>}
                    <div className="mt-1 grid gap-1">
                      {/* One row with codes means every row in the group
                          reserves that column, or the rows without them slide
                          left and stop lining up with the values above. */}
                      {rows.map((item, i) => {
                        const columned = rows.some(({ row }) => row.lead !== undefined)
                        // The label names a run, not every line in it. Eleven
                        // codes under one scheme repeated "SIC" eleven times,
                        // which reads as eleven separate facts rather than one
                        // classification with eleven codes.
                        const label = roleLabel(item)
                        const repeated = i > 0 && roleLabel(rows[i - 1]) === label

                        return (
                          <Field
                            key={`${label}-${i}`}
                            label={repeated ? '' : label}
                            lead={columned ? (item.row.lead ?? '') : undefined}
                            trailing={item.row.trailing}
                          >
                            {withoutRole(supplied(item), item.role)}
                          </Field>
                        )
                      })}
                    </div>
                  </div>
                ))}

                {s.registration ? (
                  <FilingDetails r={s.registration} />
                ) : s.id === STREET_VIEW_CARD ? (
                  <StreetViewCaptures items={groups.flatMap(([, rows]) => rows)} />
                ) : (
                  <>
                    {/* Not on Submitted: the customer gave us the URL, and a
                        capture of the page they named is evidence about the
                        page, not about their having named it. */}
                    {s.id !== SUBMITTED_CARD && (
                      <SourceCaptures items={groups.flatMap(([, rows]) => rows)} />
                    )}
                    <SourceRecords refs={s.refs} />
                  </>
                )}
              </div>
            )}
          </Surface>
            )
          })}
          </div>
        </PanelGroup>
      ))}
    </div>
  )
}
