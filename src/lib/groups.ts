/**
 * Grouping, as Middesk already groups.
 *
 * Every review task carries a `category` — name, address, sos, registrations,
 * formation, people, web, website, watchlist, liens, litigations, bankruptcies,
 * adverse_media, politically_exposed_persons, business_connections, industry.
 * That is the product's own grouping, so the prototype uses it rather than an
 * invented taxonomy sitting beside it.
 *
 * Grouping is navigational only — it helps a reader find things and nothing
 * rests on it (00-MASTER-PLAN.md, standing rule 3).
 */

/** Display order, and the label for each of Middesk's categories. */
export const GROUPS = [
  // Names, then formation. They were merged when formation held three fields
  // off a summary object; now that it carries the domestic filing in full the
  // two answer different questions — what the business is called, and what it
  // legally is.
  { id: 'name', label: 'Names' },
  { id: 'formation', label: 'Formation' },
  // The domestic filing lives under Formation; these are the qualifications —
  // which is what the heading above them already implies, so it does not repeat
  // the word foreign on every row beneath it.
  { id: 'sos', label: 'Registrations' },
  { id: 'registrations', label: 'Registrations' },
  { id: 'people', label: 'People' },
  { id: 'address', label: 'Addresses' },
  { id: 'business_connections', label: 'Connections' },
  { id: 'website', label: 'Website' },
  { id: 'web', label: 'Web presence' },
  { id: 'industry', label: 'Industry classification' },
  { id: 'watchlist', label: 'Watchlist' },
  { id: 'politically_exposed_persons', label: 'Politically exposed persons' },
  { id: 'adverse_media', label: 'Adverse media' },
  { id: 'liens', label: 'Liens' },
  { id: 'litigations', label: 'Litigations' },
  { id: 'bankruptcies', label: 'Bankruptcies' },
  { id: 'other', label: 'Other' }
] as const

export type GroupId = (typeof GROUPS)[number]['id']

/** Short theme names for citation chips — a chip carries the theme, not the
 *  full insight statement, which is a sentence and cannot sit inside another. */
export const THEME: Record<GroupId, string> = {
  name: 'Names',
  formation: 'Formation',
  sos: 'Registrations',
  registrations: 'Registrations',
  address: 'Addresses',
  people: 'People',
  business_connections: 'Connections',
  website: 'Website',
  web: 'Web presence',
  industry: 'Industry',
  watchlist: 'Watchlist',
  politically_exposed_persons: 'PEP',
  adverse_media: 'Adverse media',
  liens: 'Liens',
  litigations: 'Litigations',
  bankruptcies: 'Bankruptcies',
  other: 'Other'
}

const KNOWN = new Set<string>(GROUPS.map((g) => g.id))

/**
 * Categories that read as one heading.
 *
 * Middesk splits `website` from `web`, but as insights the split does not hold:
 * "Website is reachable" and "Third-party profile is reachable" are the same
 * question asked of two pages, and as two headings the first held a single row.
 * The Attributes tab keeps them apart — there the website's own scrape and the
 * profiles found elsewhere are different bodies of data.
 */
const INSIGHT_ALIAS: Record<string, GroupId> = { website: 'web' }

/**
 * Checks whose own key places them better than their category does.
 *
 * Middesk files every `sos_*` check under one category, from before this
 * prototype split the domestic registration out as Formation. Anything about
 * the domestic filing belongs to Formation — that filing IS the formation
 * record — and their evidence rows are already stamped `formation`, so under a
 * heading reading Foreign filings they contradicted the rows beneath them.
 */
const INSIGHT_GROUP: Record<string, GroupId> = {
  sos_domestic: 'formation',
  sos_domestic_sub_status: 'formation'
}

/**
 * The category comes from the record itself. Ids fan out
 * (`location_frequency:high`), so the lookup is on the base key.
 */
export const makeGroupFor = (categoryByKey: Map<string, string>) => (insightId: string): GroupId => {
  const key = insightId.split(':')[0]
  if (INSIGHT_GROUP[key]) return INSIGHT_GROUP[key]

  const category = categoryByKey.get(key)
  if (!category) return 'other'
  return INSIGHT_ALIAS[category] ?? (KNOWN.has(category) ? (category as GroupId) : 'other')
}
