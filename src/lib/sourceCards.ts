import type { BusinessRecord, SourceRef } from './deriveResults'
import { sourceLabel } from './sourceLabels'

/**
 * The identity of a card in the Sources tab.
 *
 * An attribute's source chip follows to the card that supplied it, so both tabs
 * have to name a source the same way. Derived here rather than in either tab:
 * when the naming lived inside SourcesTab, a chip could only guess at it.
 */

/** Third-party profiles, folded into one Web presence source. */
export const PROFILES = new Set(['Third-party profiles', 'Google', 'LinkedIn', 'Facebook', 'Instagram', 'TikTok', 'X', 'BBB', 'Trustpilot', 'Yelp', 'Profile'])

export const SUBMITTED_CARD = 'src:submitted'

export const registrationCard = (r: BusinessRecord['registrations'][number]) =>
  `reg:${r.state}:${r.fileNumber ?? r.name ?? ''}`

/** `label` is the normalised source name — `sourceLabel()`, not the raw type. */
export const namedCard = (label: string) => `src:${PROFILES.has(label) ? 'Web presence' : label}`

/**
 * A document the API gives an id — a lien, a court case, a carrier record, a
 * screening result, a tax permit, a city registration — one card each. A source
 * reference carries the same id as the document it points at, so a row citing
 * the reference and the document itself land on one card.
 */
export const docCard = (id: string) => `doc:${id}`

/** Cards that stand for no one document: the customer's submission, the
 *  pictures Google holds of the addresses, USPS's reading of them, and the
 *  businesses Middesk connects to this one. */
export const STREET_VIEW_CARD = 'src:Street View'
export const SINGLETON_CARDS = new Set([SUBMITTED_CARD, STREET_VIEW_CARD, 'src:USPS', 'src:Related businesses'])

/** The kind a source name stands for: "Lien · Virginia" is a Lien. */
export const kindLabel = (name: string) => sourceLabel(name).split(' · ')[0]

/** Names that are never a card of their own: the customer's claim has its
 *  chip, and a filing's is the filing's (`registrationCard`). */
export const NOT_A_CARD = /^(submitted|registration|state registration|not stated)$/i

/**
 * The cards a row's source chip follows to: the document behind each of the
 * row's references of that kind — three tax permits are three cards — else the
 * source by name, which the Sources tab answers to only where the record holds
 * one document of that kind.
 */
/** References whose source is one card however many of them there are: a
 *  filing's is its filing's card, and the crawl's every page is the Website. */
const ONE_CARD_REFS = new Set(['registration', 'website', 'profile'])

export const sourceChipCards = (name: string, refs: ReadonlyArray<SourceRef> = []): string[] => {
  const label = sourceLabel(name)
  if (NOT_A_CARD.test(label)) return []
  const kind = kindLabel(name).toLowerCase()
  const mine = refs.filter((r) => !ONE_CARD_REFS.has(r.type) && kindLabel(r.type).toLowerCase() === kind)
  return mine.length > 0 ? [...new Set(mine.map((r) => docCard(r.id)))] : [namedCard(label)]
}
