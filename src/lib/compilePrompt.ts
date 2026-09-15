/**
 * Turns what the author wrote into the structure that runs.
 *
 * Deterministic, and local. The `@` / `/` references are drawn from the
 * vocabulary in the first place, so the prompt already names real things —
 * there is nothing here a model needs to guess at, and making the author wait
 * on a round trip to be told what they just picked would be worse than useless.
 * Prose without references still compiles, by matching the same labels and
 * their common aliases.
 *
 * What it cannot map it records rather than drops. "Matches the website" is a
 * real request that resolves to a precomputed flag rather than to a name
 * comparison, and the author should be told that, not silently given an
 * insight that reads the wrong thing.
 */
import { ADJACENT_NAME_SIGNALS, type Jurisdiction, NAME_SOURCES } from './vocabulary'
import type { CompiledName, CompiledSource, Unsupported } from './customInsights'

export type Compilation = { compiled: CompiledName; unsupported: Unsupported[] }

/** How a name comparison can read. Longest phrases first so "does not match"
 *  is seen before "match". */
const RELATIONS: Array<{ test: RegExp; id: CompiledName['relation'] }> = [
  { test: /\b(does\s*n[o']?t\s*match|doesn't\s*match|no\s*match|mismatch|fails?\s*to\s*match|differs?)\b/, id: 'no_match' },
  { test: /\b(similar|close|fuzzy|partial|approximate|roughly)\b/, id: 'similar_match' },
  { test: /\b(exactly\s*matches?|exact\s*match|identical)\b/, id: 'exact_match' },
  { test: /\b(matches?|match(ing|es)?\s*(with|to|on)?)\b/, id: 'exact_match' }
]

/**
 * Other ways an author names a source.
 *
 * Kept beside the catalog labels rather than folded into them: the label is
 * what the product calls the source, and these are what people call it.
 */
const ALIASES: Record<string, string[]> = {
  sos_registrations: ['sos', 'secretary of state', 'state registration', 'state registrations', 'sos registration'],
  global_registrations: ['global registration', 'international registration', 'canada', 'canadian'],
  dba_registration: ['dba filing', 'dba filings', 'fbn', 'fictitious business name', 'assumed name'],
  city_registration: ['city registration', 'city filing', 'municipal'],
  jurisdiction_registration: ['jurisdiction registration'],
  st_permit: ['state tax permit', 'sales tax permit', 'tax permit'],
  tax_exempt_organization: ['tax exempt', 'tax-exempt', '501c3', 'nonprofit registry'],
  ptin_holder: ['ptin'],
  professional_license: ['professional licence', 'professional license', 'licence', 'license'],
  npi_record: ['npi'],
  fmcsa_registration: ['fmcsa', 'motor carrier'],
  sba_entity_v2: ['sba'],
  sam_entity_extract: ['sam', 'sam.gov', 'sam entity'],
  sec_filing: ['sec', 'sec filing', 'edgar'],
  form_5500: ['form 5500', '5500'],
  lien: ['lien', 'liens', 'ucc'],
  generic_verification_source: ['other verification', 'any verification source'],
  website: ['website', 'web site', 'their site', 'the site'],
  profile: ['social profile', 'social profiles', 'linkedin', 'facebook', 'yelp']
}

const JURISDICTION_WORDS: Array<{ test: RegExp; id: Jurisdiction }> = [
  { test: /\bdomestic\b/, id: 'DOMESTIC' },
  { test: /\bforeign\b/, id: 'FOREIGN' },
  { test: /\bhome\b/, id: 'HOME' },
  { test: /\bextra[-\s]?provincial\b/, id: 'EXTRA_PROVINCIAL' }
]

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Everything that could name a source, longest first.
 *
 * Matched on WORD BOUNDARIES, not as substrings. "sam" is inside "same",
 * "lien" is inside "client", and "sec" is inside "secretary of state" — so a
 * substring scan turns "the same name" into a SAM entity extract and
 * "Secretary of State" into an SEC filing as well as an SOS registration.
 */
const NEEDLES = NAME_SOURCES.flatMap((source) => [
  { id: source.id, text: source.label.toLowerCase() },
  ...(ALIASES[source.id] ?? []).map((alias) => ({ id: source.id, text: alias }))
])
  .sort((a, b) => b.text.length - a.text.length)
  .map((needle) => ({ ...needle, pattern: new RegExp(`\\b${escape(needle.text)}\\b`) }))

const normalise = (value: string) => value.toLowerCase().replace(/\s+/g, ' ')

/**
 * The jurisdictions named for one source.
 *
 * Read from the window just after the mention — "SOS registration (Domestic)"
 * and "SOS registration, domestic or foreign" both scope that source, whereas
 * a "domestic" thirty words away is about something else.
 */
const jurisdictionsNear = (text: string, from: number, source: { id: string }) => {
  const definition = NAME_SOURCES.find((s) => s.id === source.id)
  if (!definition?.jurisdictions) return undefined
  const window = text.slice(from, from + 60)
  const found = JURISDICTION_WORDS.filter(
    ({ test, id }) => test.test(window) && definition.jurisdictions?.includes(id)
  ).map(({ id }) => id)

  return found.length > 0 ? found : undefined
}

const findSources = (text: string): { sources: CompiledSource[]; matchedWebsite: boolean } => {
  const seen = new Map<string, CompiledSource>()
  let matchedWebsite = false

  for (const needle of NEEDLES) {
    const found = needle.pattern.exec(text)
    if (!found) continue
    const at = found.index
    if (needle.id === 'website') {
      matchedWebsite = true
      continue
    }
    if (seen.has(needle.id)) continue
    const jurisdictions = jurisdictionsNear(text, at + needle.text.length, needle)
    seen.set(needle.id, { id: needle.id, ...(jurisdictions ? { jurisdictions } : {}) })
  }

  return { sources: [...seen.values()], matchedWebsite }
}

/**
 * The states a name comparison can report.
 *
 * All three, always — the insight reports whichever obtains rather than
 * pass/fail against the one the author happened to name. That is what having
 * several states means.
 */
const STATES = ['match', 'similar match', 'no match']

export const compilePrompt = (prompt: string): Compilation => {
  const text = normalise(prompt)
  const unsupported: Unsupported[] = []

  const nameType: CompiledName['subject']['nameType'] =
    /\b(dba|fbn|fictitious|assumed name)\b/.test(text) ? 'dba' : 'legal'

  const relation = RELATIONS.find(({ test }) => test.test(text))?.id ?? 'exact_match'

  const { sources, matchedWebsite } = findSources(text)

  if (matchedWebsite) {
    const signal = ADJACENT_NAME_SIGNALS[0]
    unsupported.push({ asked: 'the website', why: signal.why })
  }

  // "any source" and naming none both mean every source that carries a name.
  // Left empty rather than expanded, so the insight keeps meaning "any" if the
  // catalog later adds one.
  return {
    compiled: {
      attribute: 'name',
      subject: { nameType, side: 'submitted' },
      relation,
      sources,
      states: STATES
    },
    unsupported
  }
}
