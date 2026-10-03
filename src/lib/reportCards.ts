import { GROUPS, type GroupId } from './groups'

/**
 * The report's cards: the Insights tab's groups, in its order, with one
 * group drawn as several cards where its checks are different searches —
 * Screening is three (sanctions and watchlists, PEP, adverse media), the
 * way Liens, Litigation and Bankruptcy are three — and with two groups drawn
 * as one where they are one record: Formation and Registrations. An assessment's citations
 * resolve to cards, so the Assistant's chips name the cards the report draws.
 */
export type ReportCard = {
  id: string
  group: GroupId
  label: string
  /** The insight keys this card takes from its group; absent, the whole group. */
  keys?: ReadonlyArray<string>
}

const SCREENS: ReadonlyArray<ReportCard> = [
  { id: 'screening-watchlist', group: 'screening', label: 'Sanctions & watchlists', keys: ['watchlist'] },
  { id: 'screening-pep', group: 'screening', label: 'Politically exposed persons', keys: ['politically_exposed_persons'] },
  { id: 'screening-media', group: 'screening', label: 'Adverse media', keys: ['adverse_media'] }
]

/**
 * Groups drawn as part of another's card: the names are the formation's — the
 * legal name, the names it trades under, the ones it dropped — and the state
 * registrations are its filings in other states, so all three read on one
 * card: the names and formation grid, then the filings strip. The business's
 * third-party profiles are its web presence, as its site is: one card.
 */
const MERGED_INTO: Partial<Record<GroupId, GroupId>> = { name: 'formation', registration: 'formation', profiles: 'website' }
const LABELS: Partial<Record<GroupId, string>> = { formation: 'Formation & registrations', website: 'Web presence' }

export const REPORT_CARDS: ReadonlyArray<ReportCard> = GROUPS.flatMap((g) =>
  g.id === 'screening' ? SCREENS : MERGED_INTO[g.id] ? [] : [{ id: g.id, group: g.id, label: LABELS[g.id] ?? g.label }]
)

const BY_ID = new Map(REPORT_CARDS.map((c) => [c.id, c]))

export const cardById = (id: string): ReportCard | undefined => BY_ID.get(id)

/** A card's element id on the page. Not `group-{id}`: the Insights panel owns that. */
export const cardAnchor = (cardId: string) => `report-group-${cardId}`

/** The card an insight belongs to: by key where its group is split, else its group. */
export const cardFor = (insightId: string, groupFor: (insightId: string) => GroupId): string => {
  const group = groupFor(insightId)
  if (MERGED_INTO[group]) return MERGED_INTO[group]!
  if (group !== 'screening') return group
  const key = insightId.split(':')[0]
  return SCREENS.find((c) => c.keys?.includes(key))?.id ?? SCREENS[0].id
}

/** Where a card sits in the report, for ordering chips the way the cards read. */
export const cardIndex = (id: string) => REPORT_CARDS.findIndex((c) => c.id === id)
