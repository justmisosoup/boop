import { CircleAlert, CircleCheck } from 'lucide-react'

import { ChatSourceChip, type ChatSourceData } from '@/core'

import type { AttributeRow } from '../lib/attributes'
import type { BusinessRecord } from '../lib/deriveResults'
import { PROFILES, SUBMITTED_CARD, namedCard, registrationCard } from '../lib/sourceCards'
import { WEBSITE_METADATA, faviconFor, readableUrl, sourceLabel } from '../lib/sourceLabels'
import { screenshotFor } from '../lib/sourceScreenshots'
import { streetViewFor } from '../lib/addressStreetViews'
import { CHIP_CLAIM, CHIP_NO_GLYPH } from './chipStyles'
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
export const SubmittedChip = ({
  verified,
  onJumpToSource
}: {
  verified?: boolean
  onJumpToSource?: (cardId: string) => void
}) => (
  <ChatSourceChip
    className={CHIP_CLAIM}
    sources={[
      {
        id: 'submitted',
        label: 'Submitted',
        domain: 'Submitted',
        title: verified ? 'Submitted, verified' : 'Submitted, not verified',
        onSelect: onJumpToSource ? () => onJumpToSource(SUBMITTED_CARD) : undefined,
        // One word, on the byline beside "Submitted": the preview cuts anything
        // longer mid-word, and the chips to the right of this one are the
        // sources that did the verifying.
        annotation: verified ? 'Verified' : 'Not verified',
        // No colour on either glyph. Green and amber would rank this cell
        // against the ones beside it, and the report does not grade values —
        // the shape says which of the two things happened.
        // No class on the glyph: it takes the chip's own colour, so the mark
        // and the word are one object rather than two greys.
        icon: verified ? (
          <CircleCheck aria-hidden="true" className="size-3" />
        ) : (
          <CircleAlert aria-hidden="true" className="size-3" />
        )
      }
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

export const AttributeSources = ({
  sources,
  links,
  registrations,
  domesticState,
  href,
  note,
  title,
  label,
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
    PROFILES.has(name) && (href ?? '').toLowerCase().includes(name.toLowerCase())

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
  const data: ChatSourceData[] = sources.map((name) => {
    // A page chip goes to the page. Sent to its card in the Sources tab, the
    // LinkedIn chip on a LinkedIn row — and the Privacy page chip on a privacy
    // policy — led away from the one thing the reader wanted. Metadata is the
    // other way round: the registrar and the status code live on the crawl's
    // record, not at the URL, so those chips still follow to it.
    const linksOut = showsPage(sourceLabel(name)) && Boolean(href)

    return {
      id: name,
      label: sourceLabel(name),
      domain: sourceLabel(name),
      // Headline, then host. The link is an affordance in the preview's foot
      // now ("View site"): printed in full it was an address nobody reads,
      // wrapped over three lines.
      title: title ?? (href ? readableUrl(href) : sourceLabel(name)),
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
        annotation: note ?? (isMetadata ? 'Website metadata' : 'Source'),
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
  return (
    <ChatSourceChip
      className={href ? undefined : CHIP_NO_GLYPH}
      sources={[...origin, ...data]}
    />
  )
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
  onJumpToSource
}: {
  row: AttributeRow
  domesticState?: string | null
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
        domesticState={domesticState}
        href={row.href}
        note={row.sourceNote}
        title={row.sourceTitle}
        label={row.label}
        onJumpToSource={onJumpToSource}
      />
    </>
  )

  return <span className="flex flex-wrap items-center gap-1.5">{chips}</span>
}
