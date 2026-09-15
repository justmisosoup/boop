import { ChatSourceChip, Heading, MutedText, Surface, Text, type ChatSourceData } from '@/core'

import { attributesFor, type AttributeRow } from '../lib/attributes'
import { FOREIGN_STATUS_ORDER } from '../lib/attributes'
import type { BusinessRecord, Derived } from '../lib/deriveResults'
import { GROUPS, type GroupId } from '../lib/groups'
import { CHIP_NO_GLYPH } from './chipStyles'
import { registrationSources } from './SourceChip'
import { SUBMITTED_CARD, namedCard, registrationCard } from '../lib/sourceCards'

/**
 * Source labels, normalised.
 *
 * The API returns raw keys — `sales_tax_permit`, `sam_entity_extract`,
 * `form_5500` — in one casing, and the derivation layer adds prose names like
 * "State registration" in another. Both ended up on chips side by side. Every
 * label here is Sentence case with acronyms left alone, and anything unmapped
 * is normalised the same way rather than printed as a key.
 */
const SHORT: Record<string, string> = {
  'Submitted by the customer': 'Submitted',
  'State registration': 'Registration',
  'Adverse media screening': 'Adverse media',
  'Watchlist screening': 'Watchlist',
  'Third-party profile': 'Profile',
  'Website crawl': 'Website',
  'Public records': 'Public records',
  'Middesk connections': 'Connections',
  'Source not stated': 'Not stated',
  registration: 'State registration',
  parsed_sos_document: 'SOS document',
  sales_tax_permit: 'Tax permit',
  city_registration: 'City registration',
  sam_entity_extract: 'SAM',
  form_5500: 'Form 5500',
  tax_exempt_organization: 'Tax exempt org',
  watchlist_result: 'Watchlist',
  adverse_media_screening_result: 'Adverse media',
  politically_exposed_person_result: 'PEP',
  lien: 'Lien'
}

const ACRONYMS = new Set(['sos', 'pep', 'sam', 'tin', 'ucc', 'naics', 'mcc', 'dba', 'irs', 'bbb'])

export const sourceLabel = (name: string) => {
  const mapped = SHORT[name] ?? SHORT[name.replace(/ /g, '_').toLowerCase()]
  if (mapped) return mapped

  return name
    .replace(/_/g, ' ')
    .trim()
    .split(/\s+/)
    .map((raw, i) => {
      // A word that arrived already capitalised knows better than this function
      // does — "BBB" and "LinkedIn" must survive it.
      if (raw.length > 1 && raw !== raw.toLowerCase()) return raw
      const w = raw.toLowerCase()
      return ACRONYMS.has(w) ? w.toUpperCase() : i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w
    })
    .join(' ')
}

/** The customer's own claim, rendered as a source because that is what it is —
 *  the weakest one, and the only one that is not independent. */
export const SubmittedChip = ({ onJumpToSource }: { onJumpToSource?: (cardId: string) => void }) => (
  <ChatSourceChip
    className={CHIP_NO_GLYPH}
    sources={[
      {
        id: 'submitted',
        label: 'Submitted',
        domain: 'Submitted',
        title: 'Submitted',
        onSelect: onJumpToSource ? () => onJumpToSource(SUBMITTED_CARD) : undefined,
        annotation: 'Supplied with the application'
      }
    ]}
  />
)

/**
 * The URL, minus the parts nobody reads.
 *
 * A preview titled "Facebook" under a chip labelled "Facebook" says nothing
 * twice. What is worth showing is which page it points at.
 */
const readableUrl = (href: string) => {
  try {
    const u = new URL(href)
    const path = u.pathname.replace(/\/$/, '')
    return `${u.host.replace(/^www\./, '')}${path}`
  } catch {
    return href
  }
}

/**
 * The site's own favicon, so a profile chip is recognisable before it is read.
 *
 * Fetched from Google's favicon service, which means the profile hosts on a
 * record are disclosed to Google. Acceptable for a prototype; a product would
 * proxy this or store the icon with the profile.
 */
const faviconFor = (href: string) => {
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(href).host}&sz=64`
  } catch {
    return undefined
  }
}

/** Nothing corroborates it. Said in the same shape as a source, because that
 *  is the slot a reader scans — an empty one reads as "not loaded yet". */
const NoSourceChip = () => (
  <ChatSourceChip
    className={CHIP_NO_GLYPH}
    sources={[
      {
        id: 'no-source',
        label: 'No source',
        domain: 'No source',
        title: 'No source',
        annotation: 'Nothing on the record attests this value'
      }
    ]}
  />
)

export const AttributeSources = ({
  sources,
  links,
  registrations,
  domesticState,
  href,
  note,
  title,
  onJumpToSource
}: {
  sources: string[]
  /** Distinct pages behind one row, each with its own destination. */
  links?: AttributeRow['links']
  /** Where the value comes from. Leads the chip, ahead of what corroborates it. */
  registrations?: BusinessRecord['registrations']
  domesticState?: string | null
  href?: string
  note?: string
  title?: string
  onJumpToSource?: (cardId: string) => void
}) => {
  // Each article on its own destination. These are the pages themselves, not
  // records in the Sources tab, so they link out.
  if (links?.length)
    return (
      <ChatSourceChip
        sources={links.map((l, i) => ({
          id: `${l.label}-${i}`,
          label: l.label,
          domain: l.label,
          title: l.title ?? l.label,
          snippet: l.url,
          url: l.url,
          annotation: l.note ?? 'Adverse media'
        }))}
      />
    )

  // Domestic first, matching `registrationSources` — the chip data and the
  // filings it was built from have to stay index-aligned for `onSelect` to
  // follow to the right card.
  const filings = registrations?.length
    ? [
        ...registrations.filter((r) => r.state === domesticState),
        ...registrations.filter((r) => r.state !== domesticState)
      ]
    : []
  const origin = registrationSources(filings, domesticState).map((r, i) => ({
    ...r,
    // The chip follows to the filing's card in Sources, where the whole payload
    // is, rather than out to the registry's own page. The record is what the
    // reader is working from; the registry is a footnote on it.
    url: undefined,
    onSelect: onJumpToSource ? () => onJumpToSource(registrationCard(filings[i])) : undefined
  }))
  if (sources.length === 0 && origin.length === 0) return null

  // A source with a `url` becomes a link chip — the same affordance every other
  // source chip has, rather than an underlined word in the value.
  const data: ChatSourceData[] = sources.map((name) => ({
    id: name,
    label: sourceLabel(name),
    domain: sourceLabel(name),
    // Headline, then host, then the full link. Titling the preview with the
    // URL put the same string on two lines of a three-line card.
    title: title ?? (href ? readableUrl(href) : sourceLabel(name)),
    snippet: href,
    icon: href ? (
      <img
        src={faviconFor(href)}
        alt=""
        className="size-3 rounded-[2px]"
        loading="lazy"
        // A host with no favicon should leave the chip clean rather than show
        // a broken-image glyph.
        onError={(e) => {
          e.currentTarget.style.visibility = 'hidden'
        }}
      />
    ) : undefined,
    // Same rule as the filings: the destination is the source's card in the
    // Sources tab. The site it was found on stays in the preview.
    onSelect: onJumpToSource ? () => onJumpToSource(namedCard(sourceLabel(name))) : undefined,
    annotation: note ?? 'Source'
  }))

  // One chip, origin first: the domestic filing the value comes from, then
  // every other record it is attested in. Two chips side by side read as two
  // unrelated citations rather than one provenance.
  return (
    <ChatSourceChip
      className={href ? undefined : CHIP_NO_GLYPH}
      sources={[...origin, ...data]}
    />
  )
}

/**
 * Attributes, grouped as Middesk groups them and deduplicated.
 *
 * A row is filed under ITS OWN group, falling back to the insight's only when it
 * does not claim one. Grouping everything by the asking insight put the address
 * a lien was filed at under Web presence, because a website check had cited it —
 * the row followed the question rather than the fact.
 *
 * Keyed on the THING, not on how a row renders it or on which check asked. An
 * address is its address and a person is their name, so the same address found
 * in five places is one row with five sources, and someone who is both the
 * submitted contact and an officer on a filing is one person, not two rows
 * differing only by the label the asking check gave them.
 *
 * Rows with no identity of their own fall back to label plus value.
 *
 * The tab count uses this same function, so the number on the tab and the rows
 * underneath cannot disagree.
 */
/**
 * Reading order within a group, where insertion order would be arbitrary.
 *
 * Rows arrive in whatever sequence the insights happened to be derived in, so
 * the legal name could land after the formation date. Anything unlisted keeps
 * its position behind the named rows.
 */
const ROW_ORDER: Partial<Record<GroupId, string[]>> = {
  name: ['Legal name', 'DBA', 'Name on file'],
  formation: [
    'Entity type',
    'Formation state',
    'Formation date',
    'Status',
    'Sub status',
    'File number',
    'Registered agent'
  ],
  // Grouped by field, not by filing. Each insight contributes the filings it is
  // about — sos_inactive the Illinois one, sos_unknown the New Jersey one — so
  // left in producer order the rows arrive filing by filing and Status appears
  // four times, separated by file numbers. Ordered here, the statuses read as
  // the list they are and each names the filing it belongs to.
  sos: ['Status', 'Sub status', 'Registration date'],
  // The agent's address is the agent's, not the company's. Interleaved by
  // whichever check happened to surface it first, four of them sat between the
  // addresses the business actually operates from.
  address: ['Address', 'Registered agent address']
}

const ordered = (group: GroupId, rows: AttributeRow[]): AttributeRow[] => {
  const order = ROW_ORDER[group]
  if (!order) return rows

  const rank = (r: AttributeRow) => {
    const i = order.indexOf(r.label)
    return i === -1 ? order.length : i
  }
  // Within Status, the vocabulary's own order rather than the order the filings
  // happened to arrive in.
  const value = (r: AttributeRow) =>
    r.label === 'Status' ? FOREIGN_STATUS_ORDER.indexOf(r.value.toLowerCase()) : 0

  return [...rows].sort((a, b) => rank(a) - rank(b) || value(a) - value(b))
}

export const attributeRowsByGroup = (
  record: BusinessRecord,
  results: Derived[],
  groupFor: (insightId: string) => GroupId
): Map<GroupId, Map<string, AttributeRow>> => {
  const byGroup = new Map<GroupId, Map<string, AttributeRow>>()

  for (const r of results) {
    const asked = groupFor(r.insightId)
    for (const a of attributesFor(r.insightId, record)) {
      // Attributes are what was FOUND. The articles behind an adverse-media
      // match, and anything else marked detail, are evidence for an insight —
      // they belong under it when it is expanded, not as facts about the
      // business alongside its addresses and officers.
      if (a.detail) continue

      const group = a.group ?? asked
      const rows = byGroup.get(group) ?? new Map<string, AttributeRow>()
      const key = a.matchValue ?? `${a.label}::${a.value}`
      const seen = rows.get(key)

      rows.set(
        key,
        seen
          ? {
              ...seen,
              // The fuller rendering wins: one producer may know the property
              // type or the registered-agent flag where another does not.
              value: a.value.length > seen.value.length ? a.value : seen.value,
              sources: [...new Set([...(seen.sources ?? []), ...(a.sources ?? [])])],
              submitted: seen.submitted || a.submitted,
              // Union, not first-wins: a value four filings agree on carries
              // all four, so the chip reads "SOS · CA +3" rather than naming
              // one and silently dropping the corroboration.
              registrations:
                seen.registrations || a.registrations
                  ? [
                      ...(seen.registrations ?? []),
                      ...(a.registrations ?? []).filter(
                        (r) =>
                          !(seen.registrations ?? []).some(
                            (x) => x.state === r.state && x.fileNumber === r.fileNumber
                          )
                      )
                    ]
                  : undefined
            }
          : a
      )
      byGroup.set(group, rows)
    }
  }

  return byGroup
}

export const countAttributes = (
  record: BusinessRecord,
  results: Derived[],
  groupFor: (insightId: string) => GroupId
): number => {
  let n = 0
  for (const rows of attributeRowsByGroup(record, results, groupFor).values()) n += rows.size
  return n
}

/**
 * The layer beneath the insights: the addresses, registrations, people and
 * filings the statements were built from.
 */
export const AttributesTab = ({
  record,
  results,
  groupFor,
  onJumpToSource
}: {
  record: BusinessRecord
  results: Derived[]
  groupFor: (insightId: string) => GroupId
  /** Follow a source chip to that source's card in the Sources tab. */
  onJumpToSource?: (cardId: string) => void
}) => {
  const byGroup = attributeRowsByGroup(record, results, groupFor)

  const groups = GROUPS.map((g) => ({
    ...g,
    // Only the groups with a declared order are reordered. Elsewhere the
    // producer's order is the meaningful one — a filing's fields follow the
    // filing they belong to.
    rows: ordered(g.id, [...(byGroup.get(g.id)?.values() ?? [])])
  })).filter((g) => g.rows.length > 0)

  return (
    <>
      {groups.map((group) => (
        <section key={group.id} className="grid gap-[var(--core-spacing-sm)]">
          <div className="flex items-baseline gap-2">
            <Heading level={3}>{group.label}</Heading>
            <MutedText className="text-caption">{group.rows.length}</MutedText>
          </div>

          <Surface variant="default" padding="none" className="overflow-hidden">
            <div className="divide-y divide-solid divide-border">
              {group.rows.map((a, i) => {
                // Rows carrying an identifier (industry codes) are columned, so
                // "7389, 7374, 7379" lines up against "541511" instead of being
                // buried mid-sentence — and the label heads its run rather than
                // repeating on every line. Same treatment as the Sources tab;
                // they are the same rows.
                const columned = group.rows.some((r) => r.lead !== undefined)
                const repeated = i > 0 && group.rows[i - 1].label === a.label

                return (
                <div key={`${a.label}-${i}`} className="px-4 py-2.5">
                  <div className="flex items-baseline gap-2">
                    {columned ? (
                      <>
                        <MutedText className="w-24 shrink-0 text-body font-semibold">
                          {repeated ? '' : a.label}
                        </MutedText>
                        <Text size="md" className="w-44 shrink-0 break-words tabular-nums">
                          {a.lead ?? ''}
                        </Text>
                        <Text size="md" className="min-w-0 flex-1 break-words">
                          {a.value}
                          {a.qualifier && (
                            <MutedText className="ml-2 text-body">{a.qualifier}</MutedText>
                          )}
                        </Text>
                      </>
                    ) : (
                      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                        <MutedText className="text-body font-semibold">
                          {a.label}
                          {a.value ? ':' : ''}
                        </MutedText>
                        {a.value && <Text size="md">{a.value}</Text>}
                        {/* The age reads against the date it qualifies. At the
                            right edge it read against the sources column, as
                            though it were something a filing had stated. */}
                        {a.qualifier && <MutedText className="text-body">{a.qualifier}</MutedText>}
                      </div>
                    )}
                    {/* Who supplied it, held to the right edge away from the
                        source chips below. The customer telling us something is
                        not a source corroborating it, and the two sat a word
                        apart while meaning opposite things. */}
                    {/* Provenance in one right-hand cluster: who supplied it,
                        then every source it was found in. A value that was
                        submitted AND corroborated shows both, because the fact
                        that they agree is the point. */}
                    <span className="ml-auto flex shrink-0 items-center gap-1.5">
                      {a.trailing && <MutedText className="text-body">{a.trailing}</MutedText>}
                      {a.submitted && <SubmittedChip onJumpToSource={onJumpToSource} />}
                      {/* Submitted and nothing else. Said plainly, because an
                          absent chip reads as "not rendered yet" rather than
                          "nobody else attests this" — and that difference is
                          the whole point of the column. */}
                      {a.submitted &&
                        (a.sources ?? []).length === 0 &&
                        !a.registrations &&
                        !a.links?.length && <NoSourceChip />}
                      <AttributeSources
                        sources={a.sources ?? (a.source ? [a.source] : [])}
                        links={a.links}
                        registrations={a.registrations}
                        domesticState={record.formation?.state}
                        href={a.href}
                        note={a.sourceNote}
                        title={a.sourceTitle}
                        onJumpToSource={onJumpToSource}
                      />
                    </span>
                  </div>
                </div>
                )
              })}
            </div>
          </Surface>
        </section>
      ))}
    </>
  )
}
