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
import { entityFallback } from './businessNames'
import { trueEntityType, type BusinessRecord } from './deriveResults'
import { watchlistVerdicts } from './watchlist'

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

/** The website checks, by sub-label, each naming the website as its source. */
const within = (message?: string | null) => {
  const miles = /within ([\d.]+) miles/i.exec(message ?? '')?.[1]
  return miles
    ? `The website shows an address within ${miles} miles of the submitted office address`
    : 'The website shows an address near the submitted office address'
}
const WEB: Record<string, Record<string, string | ((message?: string | null) => string)>> = {
  web_business_name_verification: {
    verified: 'The website shows the submitted business name',
    similar_match: 'The website shows a name similar to the submitted business name',
    mismatch: 'The website shows a different name from the submitted business name',
    unverified: "The website doesn't show a business name"
  },
  web_person_verification: {
    verified: 'The website names the submitted person',
    mismatch: 'The website names people different from the submitted people',
    unverified: "The website doesn't name the submitted person"
  },
  web_address_verification: {
    verified: 'The website shows the submitted office address',
    approximate_match: within,
    similar_match: 'The website shows an address similar to the submitted office address',
    incomplete_match: 'The website shows a partial match to the submitted office address',
    mismatch: 'The website shows a different address from the submitted office address',
    unverified: "The website doesn't show the submitted office address"
  },
  web_phone_number_verification: {
    verified: 'The website shows the submitted phone number',
    mismatch: 'The website shows a different phone number from the submitted one',
    unverified: "The website doesn't show the submitted phone number"
  },
  web_email_address_verification: {
    verified: 'The website shows the submitted email address',
    mismatch: 'The website shows a different email address from the submitted one',
    unverified: "The website doesn't show the submitted email address"
  }
}

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
  /**
   * A screen that returned only names that are not matches. The provider says
   * "1 Watchlists hit(s) have been identified" for Andytown's MICHAEL COX, who
   * is not its member Michael McCrory — the row says what came back and why it
   * does not count.
   */
  if (key === 'watchlist') {
    const verdicts = watchlistVerdicts(record)
    // Which names came back, and why each is not a match, are the evidence's.
    if (verdicts.length > 0 && verdicts.every((v) => !v.valid)) return 'No valid watchlist hits'
  }

  if (key === 'entity_type') {
    const form = trueEntityType(record)
    if (form && form !== record.formation?.entityType) return `Entity type is a ${form}`
    // No state filing to say it: Firebird Yarns is a DBA of a person with no
    // filing, so likely a sole proprietorship, not "unknown". That it is a DBA
    // is `submitted_name`'s to say, not this row's.
    if (!form && entityFallback(record) === 'Likely sole proprietorship') return 'Entity type is likely a sole proprietorship'
  }

  /*
   * The industry row states the classification, not the risk label.
   *
   * The provider's sentence for a Prohibited-scheme match — "This business
   * may operate in the 'High-Risk Businesses' industry" — is a curated rule
   * over the classifications, one of the judgments the brief puts out of
   * scope; "likely does not operate in a high risk industry" is the same rule
   * the other way. What the lookup found is the NAICS classification, and
   * that is what the row says. The codes are the evidence's.
   */
  if (key === 'industry') {
    const naics = (record.industry ?? [])
      .filter((c) => /^naics$/i.test(c.system ?? '') && c.name)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    if (naics.length === 0) return 'No industry classification on record'
    return `Industry classified as ${naics[0].name}`
  }

  // `business_connections` keeps the product's own count — "2 connections
  // found". Which businesses they are is the evidence's: a statement names no
  // entity.

  /*
   * The website checks. The source's sentences — "Match identified to the
   * submitted person" — never say where the match was found, and they are
   * the same words the filing checks use: Userleap's page read "Unable to
   * identify a match to the submitted person" and "Match identified to the
   * submitted person" one above the other, the second from its website. Each
   * says it is the website. Keyed on the exact sub-label: a pattern read
   * "Unverified" as a match.
   */
  const web = WEB[key]?.[(subLabel ?? '').toLowerCase().replace(/\s+/g, '_')]
  if (web) return typeof web === 'function' ? web(message) : web

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
