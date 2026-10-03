import { CircleAlert, CircleCheck } from 'lucide-react'

import { ChatSourceChip, type ChatSourceData } from '@/core'

import type { AttributeRow } from '../lib/attributes'
import type { BusinessRecord, SourceRef } from '../lib/deriveResults'
import { stateName } from '../lib/states'
import { PROFILES, SUBMITTED_CARD, namedCard, registrationCard } from '../lib/sourceCards'
import { WEBSITE_METADATA, faviconFor, readableUrl, sourceLabel } from '../lib/sourceLabels'
import { screenshotFor } from '../lib/sourceScreenshots'
import { streetViewFor } from '../lib/addressStreetViews'
import { CHIP_CLAIM, CHIP_NO_GLYPH, CHIP_UNVERIFIED } from './chipStyles'
import { useScreenshotViewer } from './ScreenshotViewer'
import { registrationSources } from './SourceChip'

/**
 * Where a value came from, and what stands behind it.
 *
 * One place for every chip the report cites a value with, so the Attributes
 * tab, the Sources tab and an insight's evidence all cite the same way. They
 * lived in `AttributesTab` and were imported back out of it, which made the tab
 * a dependency of anything that wanted to name a source.
 */

/**
 * The customer's own claim, and whether a source of record agreed.
 *
 * One element, beside the label. It was two — a tick or a bang next to the
 * label, and a "Submitted" chip on the line below — which split one fact across
 * two places and made the reader join them up. The glyph rides the chip's own
 * icon slot, so the mark and the word it qualifies are the same object: what
 * the customer said, and how it stood up.
 *
 * Rendered as a source because that is what it is — the weakest one, and the
 * only one that is not independent. The hover says which of the two happened,
 * where the tooltip on the old mark used to.
 */
/** Sources named once per kind: "SOS: AR, AZ, CA · IRS", not "SOS · AR · SOS ·
 *  AZ · …" thirteen times. */
const sourceList = (sources: string[]) => {
  const kinds = new Map<string, string[]>()
  for (const x of sources) {
    const [kind, where] = x.split(' · ')
    kinds.set(kind, [...(kinds.get(kind) ?? []), ...(where ? [where] : [])])
  }
  return [...kinds.entries()].map(([kind, where]) => (where.length > 0 ? `${kind}: ${where.join(', ')}` : kind)).join(' · ')
}

/** The customer's claim as a source: the first entry of the chip it sits in.
 *  `listed` is how many sources follow it in that chip, which are the ways it
 *  was verified, so they are not named a second time in its own line. */
const submittedSource = ({
  verified,
  by,
  listed = 0,
  onJumpToSource
}: {
  verified?: boolean
  by?: string[]
  listed?: number
  onJumpToSource?: (cardId: string) => void
}): ChatSourceData => {
  return {
    id: 'submitted',
    // No domain: the chip reads "Submitted", and the list row is one line.
    label: 'Submitted',
    title: verified ? 'Submitted · Verified' : 'Submitted · Not verified',
    // Which ones, where they are not listed under it: the filings and records
    // that state the value.
    snippet: verified && listed === 0 && by && by.length > 0 ? sourceList(by) : undefined,
    onSelect: onJumpToSource ? () => onJumpToSource(SUBMITTED_CARD) : undefined,
    // No class on the glyph: it takes the chip's own colour, so the mark and
    // the word are one object rather than two greys.
    icon: verified ? <CircleCheck aria-hidden="true" className="size-3" /> : <CircleAlert aria-hidden="true" className="size-3" />
  }
}

export const SubmittedChip = ({
  verified,
  by,
  sources = [],
  onJumpToSource
}: {
  verified?: boolean
  /** The sources that verify it, named in the preview: how it is verified,
   *  rather than that it is. */
  by?: string[]
  /** The source chips' own entries for those sources, listed under the claim
   *  in this one chip — "Submitted +2" — rather than as a second chip beside it. */
  sources?: ChatSourceData[]
  onJumpToSource?: (cardId: string) => void
}) => (
  <ChatSourceChip
    // Not verified: the warning tone, with the exclamation mark.
    className={verified ? CHIP_CLAIM : CHIP_UNVERIFIED}
    // Under the claim, each source as the place it is from over what it is —
    // "San Francisco" over "City Registration", "firebirdyarns.com" over
    // "Website" — with no host repeated on the second line.
    sources={[
      submittedSource({ verified, by, listed: sources.length, onJumpToSource }),
      ...sources.map((x) => (x.url ? x : { ...x, domain: undefined }))
    ]}
  />
)

/**
 * What stands at the address, from Google.
 *
 * Its own chip rather than another entry in the row's source list: a chip
 * citing several sources collapses into a list, and a list cannot show a
 * photograph — which is the whole value of this source. Beside the filings,
 * because that is what it is. The registry states an address; Google shows the
 * doorway, and on a registered-agent address or a quiet headquarters that is
 * the question a reviewer is actually asking.
 */
export const StreetViewChip = ({ address }: { address: string }) => {
  const { open: openScreenshot } = useScreenshotViewer()
  const frame = streetViewFor(address)
  if (!frame) return null

  return (
    <ChatSourceChip
      sources={[
        {
          id: 'street-view',
          label: 'Google',
          domain: 'Google',
          title: frame.alt,
          url: frame.url,
          // The month the car drove it, not the month we read it: a 2015 frame
          // of a 2026 address is exactly what a reviewer must not miss.
          annotation: frame.imageryDate
            ? `Street View · ${frame.imageryDate}`
            : 'No Street View imagery',
          icon: (
            <img
              src={faviconFor('https://maps.google.com')}
              alt=""
              className="size-3 rounded-xxs"
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.visibility = 'hidden'
              }}
            />
          ),
          screenshot: frame.src
            ? {
                src: frame.src,
                alt: frame.alt,
                capturedAt: frame.capturedAt,
                onOpen: () =>
                  openScreenshot({
                    src: frame.src as string,
                    alt: frame.alt,
                    capturedAt: frame.capturedAt
                  })
              }
            : undefined
        }
      ]}
    />
  )
}

/**
 * A record source as the dashboard's Sources cards name it: the card's title,
 * and its subtitle saying where the record is from. `BusinessHome/Sources/*Card`.
 * Sources with no card there keep their own name.
 */
const APP_CARD: Record<
  string,
  { title: string; subtitle?: (m: { city?: string; state?: string }) => string | undefined; place?: boolean }
> = {
  // The city alone, as a reader names it — Washington keeps its DC.
  'City registration': {
    title: 'City Registration',
    place: true,
    subtitle: (m) => (m.city ? (m.state === 'DC' ? `${m.city}, DC` : m.city) : undefined)
  },
  Lien: { title: 'Lien Filing', place: true, subtitle: (m) => (m.state ? stateName(m.state) : undefined) },
  'SEC filing': { title: 'SEC EDGAR Filings' },
  'Tax permit': { title: 'Sales Tax Permit', place: true, subtitle: (m) => (m.state ? stateName(m.state) : undefined) },
  'Form 5500': { title: 'Form 5500', subtitle: () => 'Internal Revenue Service' },
  SAM: { title: 'SAM Entity Registration' },
  'SBA entity v2': { title: 'Small Business Profile', subtitle: () => 'Small Business Administration' },
  'FMCSA registration': { title: 'Federal Motor Carrier Safety Administration', subtitle: () => 'Department of Transportation' },
  'NPI record': { title: 'National Provider Identifier', subtitle: () => 'National Plan and Provider Enumeration System' },
  'EPA FRS facility': { title: 'EPA FRS Facility' }
}

/** The prefix a court record's source carries (`attributes.ts`, litigations). */
const COURT = 'Court record · '

/** One entry per record the card would show — per city, per state — as the
 *  dashboard's cards are one per record. Empty for a source with no card. */
const appEntries = (name: string, refs: SourceRef[], sourceNames?: Record<string, string>) => {
  const card = APP_CARD[sourceLabel(name)]
  if (!card) return []
  const subtitles = new Set<string | undefined>()
  for (const ref of refs) {
    if (sourceLabel(ref.type) !== sourceLabel(name)) continue
    const m = (ref.metadata ?? {}) as { city?: string; state?: string }
    subtitles.add(card.subtitle?.({ city: m.city, state: m.state?.toUpperCase() }))
  }
  if (subtitles.size === 0) subtitles.add(card.subtitle?.({}))
  // A record from a place leads with the place — "San Francisco, California"
  // over "City Registration" — so a list of them reads as where they are. One
  // with no place — an SEC or EPA record — leads with the business name it
  // carries, as the record states it, over what kind of record it is.
  const entity = sourceNames?.[sourceLabel(name)]
  return [...subtitles].map((subtitle) =>
    card.place && subtitle
      ? { title: subtitle, subtitle: card.title }
      : !card.subtitle && entity
        ? { title: entity, subtitle: card.title }
        : { title: card.title, subtitle }
  )
}

export const AttributeSources = ({
  sources,
  links,
  registrations,
  refs,
  sourceNames,
  domesticState,
  href,
  note,
  title,
  label,
  extra,
  submitted,
  urls,
  onJumpToSource
}: {
  sources: string[]
  /** Each source's own page, by source label: its chip links there. */
  urls?: Record<string, string>
  /** The customer submitted this value: the chip leads with the claim —
   *  "Submitted +2" — and lists these sources under it as how it was
   *  verified. One chip, not a Submitted chip beside a source chip. */
  submitted?: { verified: boolean; by?: string[] }
  /** Records from registers the row's sources never name — a licence from
   *  the NPI Registry at this address — folded into the same chip, after the
   *  rest: one provenance, not a second citation beside it. */
  extra?: ChatSourceData[]
  /** The record's own source objects, so a record source can say where it is
   *  from and its status rather than only its kind. */
  refs?: SourceRef[]
  /** The business name each source carries, by source label. */
  sourceNames?: Record<string, string>
  /** Distinct pages behind one row, each with its own destination. */
  links?: AttributeRow['links']
  /** Where the value comes from. Leads the chip, ahead of what corroborates it. */
  registrations?: BusinessRecord['registrations']
  domesticState?: string | null
  href?: string
  note?: string
  title?: string
  /** The attribute this row states. Selects the capture taken for that claim —
   *  the page with the email selected, not the page it sat on. */
  label?: string
  onJumpToSource?: (cardId: string) => void
}) => {
  const { open: openScreenshot } = useScreenshotViewer()

  // The source that IS the page at `href` — the Facebook chip on a row whose
  // value was lifted from facebook.com, not the website crawl sitting beside
  // it. Both the capture and the outbound link hang off this: a capture is of
  // ONE page, and so is a link.
  const isThePage = (name: string) =>
    (PROFILES.has(name) && (href ?? '').toLowerCase().includes(name.toLowerCase())) ||
    // A profile row's one chip: the profile is the page.
    (name === 'Third-party profiles' && Boolean(href))

  // The crawl is the page's source too, on rows that ARE a page: Privacy page,
  // Contact page, and the site itself, which is its home page.
  const isMetadata = WEBSITE_METADATA.has(label ?? '')
  const showsPage = (source: string) =>
    isThePage(source) || (source === 'Website' && !isMetadata)

  const capture = screenshotFor(href, label ?? '')

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
          url: l.url,
          annotation: l.note ?? 'Adverse media',
          snippet: l.agency ? `Agency: ${l.agency}` : undefined
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
  if (sources.length === 0 && origin.length === 0 && !extra?.length && !submitted) return null

  // A source with a `url` becomes a link chip — the same affordance every other
  // source chip has, rather than an underlined word in the value.
  const data: ChatSourceData[] = sources
    .filter((name) => !(submitted && /^submitted$/i.test(sourceLabel(name))))
    .flatMap((name): ChatSourceData | ChatSourceData[] => {
    // A record — a city registration, a tax permit, a lien, an SEC filing —
    // named as the dashboard's Sources card for it is: the card's title, and
    // its subtitle saying where the record is from.
    // A source with its own page for this value — the Instagram profile an
    // email was read off — links to that page, named by it.
    const own = urls?.[sourceLabel(name)]
    if (own)
      return {
        id: `${name}:${own}`,
        label: sourceLabel(name),
        domain: sourceLabel(name),
        title: readableUrl(own),
        url: own,
        icon: (
          <img
            src={faviconFor(own)}
            alt=""
            className="size-3 rounded-xxs"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.visibility = 'hidden'
            }}
          />
        )
      }

    const cards = appEntries(name, refs ?? [], sourceNames)
    if (cards.length > 0)
      return cards.map((c, i): ChatSourceData => ({
        id: `${name}:${c.subtitle ?? i}`,
        // A city registration's chip is its city — "San Francisco" — as a
        // filing's is its state.
        label: sourceLabel(name) === 'City registration' && c.subtitle === 'City Registration' ? c.title : sourceLabel(name),
        title: c.title,
        annotation: c.subtitle,
        onSelect: onJumpToSource ? () => onJumpToSource(namedCard(sourceLabel(name))) : undefined
      }))

    // A page chip goes to the page. Sent to its card in the Sources tab, the
    // LinkedIn chip on a LinkedIn row — and the Privacy page chip on a privacy
    // policy — led away from the one thing the reader wanted. Metadata is the
    // other way round: the registrar and the status code live on the crawl's
    // record, not at the URL, so those chips still follow to it.
    const linksOut = showsPage(sourceLabel(name)) && Boolean(href)

    // A court record's chip names the court — "Albany County Supreme Court" —
    // and says what it is under it.
    const court = name.startsWith(COURT) ? name.slice(COURT.length) : undefined
    if (court)
      return {
        id: name,
        label: court,
        domain: court,
        title: court,
        annotation: 'Court record',
        onSelect: onJumpToSource ? () => onJumpToSource(namedCard(sourceLabel(name))) : undefined
      }

    // A record source with no page of its own is named by what it carries —
    // the site by its address — rather than "Website" over "Website".
    const carried = sourceNames?.[sourceLabel(name)]
    return {
      id: name,
      label: sourceLabel(name),
      domain: href ? sourceLabel(name) : (carried ?? sourceLabel(name)),
      // Headline, then host. The link is an affordance in the preview's foot
      // now ("View site"): printed in full it was an address nobody reads,
      // wrapped over three lines.
      title: title ?? (href ? readableUrl(href) : (carried ?? sourceLabel(name))),
      icon: href ? (
        <img
          src={faviconFor(href)}
          alt=""
          className="size-3 rounded-xxs"
          loading="lazy"
          // A host with no favicon should leave the chip clean rather than show
          // a broken-image glyph.
          onError={(e) => {
            e.currentTarget.style.visibility = 'hidden'
          }}
        />
      ) : undefined,
      url: linksOut ? href : undefined,
      // Same rule as the filings: where the source is a record rather than a
      // page, the destination is its card in the Sources tab.
      onSelect:
        !linksOut && onJumpToSource
          ? () => onJumpToSource(namedCard(sourceLabel(name)))
          : undefined,
        // What the source is, never the bare word "Source".
        annotation: note ?? (isMetadata ? 'Website metadata' : href ? undefined : sourceLabel(name)),
      // Hung on every source in the row, a Facebook capture would have appeared
      // under the website crawl's chip as though the crawl had taken it.
      screenshot:
        capture && showsPage(sourceLabel(name))
          ? { ...capture, onOpen: () => openScreenshot(capture) }
          : undefined
    }
  })

  // One chip, origin first: the domestic filing the value comes from, then
  // every other record it is attested in. Two chips side by side read as two
  // unrelated citations rather than one provenance.
  const all = [...origin, ...data, ...(extra ?? [])]
  if (submitted)
    return <SubmittedChip verified={submitted.verified} by={submitted.by} sources={all} onJumpToSource={onJumpToSource} />
  return <ChatSourceChip className={href ? undefined : CHIP_NO_GLYPH} sources={all} />
}

/**
 * Everything that attests one row, as one line.
 *
 * Who supplied it, what corroborates it, and — at an address — what stands
 * there. It was assembled inline in the Attributes tab and pushed hard right
 * with `ml-auto`; in a cell there is no right edge to push against, because the
 * right edge is the next cell. So it reads as what it is: a note under the
 * value, in the order a reviewer asks it — the claim, then the record.
 */
export const RowProvenance = ({
  row,
  domesticState,
  submitted,
  onJumpToSource
}: {
  row: AttributeRow
  domesticState?: string | null
  /** The row is the customer's claim: its sources are listed under it. */
  submitted?: { verified: boolean; by?: string[] }
  onJumpToSource?: (cardId: string) => void
}) => {
  // `source` is the single-source form some producers still use; the chip
  // cluster has always read both, and a row that lost it read as unsourced.
  const sources = row.sources ?? (row.source ? [row.source] : [])

  const chips = (
    <>
      {row.group === 'address' && <StreetViewChip address={row.matchValue ?? row.value} />}
      <AttributeSources
        sources={sources}
        links={row.links}
        registrations={row.registrations}
        refs={row.refs}
        sourceNames={row.sourceNames}
        domesticState={domesticState}
        href={row.href}
        note={row.sourceNote}
        title={row.sourceTitle}
        label={row.label}
        urls={row.sourceUrls}
        submitted={submitted}
        onJumpToSource={onJumpToSource}
      />
    </>
  )

  return <span className="flex flex-wrap items-center gap-1.5">{chips}</span>
}
