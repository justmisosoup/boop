/**
 * How a source says its own name.
 *
 * Pure text, no JSX: the label, the readable form of a URL, its favicon, and
 * which website rows were never read off a page. They were defined inside the
 * Attributes tab, which meant the Sources tab imported a lib from a component
 * and nothing else could use them without pulling a tab in behind it.
 */

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

/**
 * The URL, minus the parts nobody reads.
 *
 * A preview titled "Facebook" under a chip labelled "Facebook" says nothing
 * twice. What is worth showing is which page it points at.
 */
export const readableUrl = (href: string) => {
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
export const faviconFor = (href: string) => {
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(href).host}&sz=64`
  } catch {
    return undefined
  }
}

/**
 * Website rows the crawl did not read off a page.
 *
 * A domain's registrar and expiry come from WHOIS, the status code from the
 * response, the title from the document head — none of them is something a
 * reader could see at the URL. Shown under a capture of the home page, each
 * would claim the page had stated it, so these say what they are instead.
 */
export const WEBSITE_METADATA = new Set(['Title', 'Domain', 'Platform', 'Category'])
