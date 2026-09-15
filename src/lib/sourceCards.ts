import type { BusinessRecord } from './deriveResults'

/**
 * The identity of a card in the Sources tab.
 *
 * An attribute's source chip follows to the card that supplied it, so both tabs
 * have to name a source the same way. Derived here rather than in either tab:
 * when the naming lived inside SourcesTab, a chip could only guess at it.
 */

/** Third-party profiles, folded into one Web presence source. */
export const PROFILES = new Set(['Google', 'LinkedIn', 'Facebook', 'BBB', 'Trustpilot', 'Yelp', 'Profile'])

export const SUBMITTED_CARD = 'src:submitted'

export const registrationCard = (r: BusinessRecord['registrations'][number]) =>
  `reg:${r.state}:${r.fileNumber ?? r.name ?? ''}`

/** `label` is the normalised source name — `sourceLabel()`, not the raw type. */
export const namedCard = (label: string) => `src:${PROFILES.has(label) ? 'Web presence' : label}`
