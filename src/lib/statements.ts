/**
 * The statement is the product's outcome, not ours.
 *
 * This file used to compose every insight's sentence — counting registrations
 * and writing "Submitted business name matches 5 state registrations" where the
 * check had returned "Match identified to the submitted Business Name". That
 * count was a reading. Deciding which fact is the salient one is the assessment
 * layer's job, and doing it here put an interpretation where a fact belonged.
 *
 * Now the outcome comes from `catalog/insights.yaml`, keyed by check id and the
 * sublabel the API returned. Where the catalog has no text for a sublabel the
 * API's own message is used, and failing that the sublabel itself — never an
 * invented sentence.
 */
import catalog from '../data/catalog.json'
import { trueEntityType, type BusinessRecord } from './deriveResults'

const OUTCOME = (catalog as { outcomeOf: Record<string, string> }).outcomeOf

/**
 * Outcome messages carry interpolation the API fills in — "{n} of {total}
 * filings are Active", "#{approximate_miles_radius} miles". Rendered raw they
 * read as templates, so a message still holding a placeholder is not used; the
 * message the record itself carried is better evidence than a template.
 */
const isTemplate = (text: string) => /[#$]?\{[^}]+\}/.test(text)

/**
 * Sentence case, applied to the product's own wording.
 *
 * The API writes its messages in Title Case — "The business is Active in the
 * state of the submitted Office Address". Read down a list of sixty they are
 * shouting, and the capitals imply a significance the words do not carry:
 * `Active` is not a proper noun and neither is `Office Address`.
 *
 * Only casing changes. No word is added, removed or reordered, so the sentence
 * is still the product's. Acronyms, entity types and anything fully upper-case
 * are left alone, as are the placeholders a message may still hold.
 */
const KEEP = new Set([
  'USPS', 'IRS', 'SOS', 'TIN', 'DBA', 'PEP', 'KYC', 'PPP', 'CMRA', 'UCC', 'URL',
  'OFAC', 'NAICS', 'MCC', 'LLC', 'CORPORATION', 'NON', 'PROFIT', 'SG'
])

export const sentenceCase = (text: string): string =>
  text.replace(/\b[A-Z][a-zA-Z]*\b/g, (word, index: number) => {
    if (index === 0) return word
    if (KEEP.has(word) || word === word.toUpperCase()) return word
    // Only the ones the product capitalised for emphasis, not proper nouns it
    // did not write — a state name arrives inside a placeholder, not as a word.
    return word.toLowerCase()
  })

/**
 * What the check reported.
 *
 * `message` is what this record's own review task carried, which is the same
 * sentence with its placeholders filled. It is preferred over the catalog's
 * template for exactly that reason.
 */
export const statementFor = (
  key: string,
  subLabel: string,
  record: BusinessRecord,
  message?: string | null
): string => {
  /**
   * The one place the product's own sentence is corrected rather than repeated.
   *
   * `entity_type` reports the provider's bucket, and its taxonomy has no value
   * for a professional entity — so a PLLC arrives as "Entity type is a LLC".
   * The registered name is the entity's own, and it says PLLC. Saying LLC here
   * is not a softer way of saying the same thing: it loses the fact that
   * membership is restricted to licensed practitioners, which is what a policy
   * reading this row needs in order to ask for licensure at all.
   */
  if (key === 'entity_type') {
    const form = trueEntityType(record)
    if (form && form !== record.formation?.entityType) return `Entity type is a ${form}`
  }

  /**
   * The other place. `business_connections` reports a count — "2 connections
   * found" — and a count of businesses is not something a reviewer can act on
   * or follow. Where the record carries the connections themselves, the row
   * names them: the same fact, with the part that matters left in.
   */
  if (key === 'business_connections') {
    const names = (record.connections ?? []).map((c) => c.name).filter(Boolean)
    if (names.length > 0)
      return `${names.length} ${names.length === 1 ? 'connection' : 'connections'} found: ${names.join(', ')}`
  }

  /*
   * The website name check. The source's sentence — "We identified a name we
   * believe is different from the submitted business name" — never says
   * where the name was found, and in an Identity card beside filing matches
   * it read as a registry finding. It is the website.
   */
  if (key === 'web_business_name_verification') {
    if (/mismatch/i.test(subLabel ?? '')) return 'The website shows a different name from the submitted business name'
    if (/match|verified/i.test(subLabel ?? '')) return 'The website shows the submitted business name'
  }

  if (message) return sentenceCase(message)

  // Nothing to key the catalog with. A sub-label is on every review task in
  // `records.json` today, but that file is rewritten wholesale by `bun run
  // pull` — a row with nothing to say should say nothing, not take the page's
  // derivation down with it.
  if (!subLabel) return ''

  const fromCatalog =
    OUTCOME[`${key}|${subLabel}`] ??
    OUTCOME[`${key}|${subLabel.toLowerCase().replace(/\s+/g, '_')}`]
  if (fromCatalog && !isTemplate(fromCatalog)) return sentenceCase(fromCatalog)

  return subLabel
}

/**
 * Address frequency fans out to one insight per band.
 *
 * The bands are the product's own — the `location_frequency` signals name
 * 1–20, 21–100 and over 100 — so the split is not ours. Only the grouping of a
 * record's addresses into those bands happens here.
 */
export const frequencyBand = (n: number): 'low' | 'moderate' | 'high' =>
  n > 100 ? 'high' : n >= 21 ? 'moderate' : 'low'

export const addressFrequencyInsights = (record: BusinessRecord) =>
  (['low', 'moderate', 'high'] as const).flatMap((band) => {
    const addresses = record.addresses.filter(
      (a) => typeof a.locationCount === 'number' && frequencyBand(a.locationCount) === band
    )
    if (addresses.length === 0) return []
    return [
      {
        band,
        addresses,
        statement:
          OUTCOME[`location_frequency|${band}`] ??
          `${addresses.length} ${addresses.length === 1 ? 'address' : 'addresses'} in the ${band} band`
      }
    ]
  })
