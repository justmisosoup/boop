/**
 * Captures of the pages a source is, keyed by the page and the attribute.
 *
 * A capture is evidence for ONE claim: the page with `hello@middesk.com`
 * selected in the Intro card proves the email, and says nothing about the
 * follower count sitting above it. So the lookup is keyed by attribute first,
 * and falls back to the page's own capture for rows that are about the page
 * itself rather than something lifted from it.
 *
 * Every capture is the whole page as it was served, at one viewport, so the
 * previews read as one set and the reader sees the page rather than a detail
 * someone chose for them. A claim's capture differs only in what is selected
 * on it — the email highlighted in the Intro card — and the full size behind
 * "View screenshot" is where that selection is read.
 *
 * Fixtures, in a prototype. A product would hold the capture on the source
 * record, taken at crawl time, showing what the extractor actually read.
 */

export type SourceScreenshot = {
  src: string
  /** Names what the capture shows — the dialog's accessible name, and the alt
   *  text on an image that carries evidence rather than decorating. */
  alt: string
  /**
   * When the page was captured, ISO-8601.
   *
   * A profile is live and a capture is not: followers move, a page goes
   * private, a business edits the email it states. Undated, the capture
   * quietly claims to be what the page says now — the one thing a screenshot
   * can never be.
   */
  capturedAt: string
  /** What the page is the site of, and which page — "Zendesk", "Home page" —
   *  for the viewer's heading. Absent, the heading is `alt`. */
  site?: string
  page?: string
  /** The live page, for the viewer's link chip. */
  href?: string
}

const pageKey = (href: string): string | undefined => {
  try {
    const u = new URL(href)
    // Google names a place in the query string; without it every Maps URL
    // keys to the same page and one business's capture answers for another.
    return `${u.host.replace(/^www\./, '')}${u.pathname.replace(/\/$/, '')}${u.search}`
  } catch {
    return undefined
  }
}

const CAPTURES: Record<string, SourceScreenshot> = {
  'facebook.com/middesk::Email address': {
    src: '/screenshots/facebook-email.png',
    alt: 'Facebook page for Middesk, with hello@middesk.com highlighted',
    capturedAt: '2026-09-14',
    site: 'Middesk',
    page: 'Facebook page',
    href: 'https://www.facebook.com/middesk'
  },
  'facebook.com/middesk': {
    src: '/screenshots/facebook-profile.png',
    alt: 'Facebook page for Middesk',
    capturedAt: '2026-09-14',
    site: 'Middesk',
    page: 'Facebook page',
    href: 'https://www.facebook.com/middesk'
  },
  'linkedin.com/company/middesk': {
    src: '/screenshots/linkedin-profile.png',
    alt: 'LinkedIn company page for Middesk',
    capturedAt: '2026-09-14',
    site: 'Middesk',
    page: 'LinkedIn page',
    href: 'https://www.linkedin.com/company/middesk'
  },
  'maps.google.com?cid=6720954453079130673': {
    src: '/screenshots/google-profile.png',
    alt: 'Google Maps listing for Middesk, Inc.',
    capturedAt: '2026-09-14',
    site: 'Middesk',
    page: 'Google Maps listing',
    href: 'https://maps.google.com/?cid=6720954453079130673'
  },
  'bbb.org/us/ca/san-francisco/profile/software-consultants/middesk-inc-1116-975336':
    {
      src: '/screenshots/bbb-profile.png',
      alt: 'BBB business profile for Middesk Inc',
      capturedAt: '2026-09-14',
      site: 'Middesk',
      page: 'BBB profile',
      href: 'https://www.bbb.org/us/ca/san-francisco/profile/software-consultants/middesk-inc-1116-975336'
    },
  'trustpilot.com/review/middesk.com': {
    src: '/screenshots/trustpilot-profile.png',
    alt: 'Trustpilot review page for middesk.com',
    capturedAt: '2026-09-14',
    site: 'Middesk',
    page: 'Trustpilot reviews',
    href: 'https://www.trustpilot.com/review/middesk.com'
  },

  // The site itself, page by page. The home capture answers both the Website
  // row and the Home page row — `http://middesk.com` and
  // `https://www.middesk.com/` are the same doorstep, and the key knows it.
  'middesk.com': {
    src: '/screenshots/middesk-home.jpg',
    alt: 'middesk.com home page',
    capturedAt: '2026-09-14',
    site: 'Middesk',
    page: 'Home page',
    href: 'https://www.middesk.com'
  },
  'middesk.com/contact': {
    src: '/screenshots/middesk-contact.jpg',
    alt: 'middesk.com contact page',
    capturedAt: '2026-09-14',
    site: 'Middesk',
    page: 'Contact page',
    href: 'https://www.middesk.com/contact'
  },
  'middesk.com/about': {
    src: '/screenshots/middesk-about.jpg',
    alt: 'middesk.com about page',
    capturedAt: '2026-09-14',
    site: 'Middesk',
    page: 'About page',
    href: 'https://www.middesk.com/about'
  },
  'middesk.com/policies/terms-and-conditions': {
    src: '/screenshots/middesk-terms.jpg',
    alt: 'middesk.com terms and conditions',
    capturedAt: '2026-09-14',
    site: 'Middesk',
    page: 'Terms and conditions',
    href: 'https://www.middesk.com/policies/terms-and-conditions'
  },
  'middesk.com/policies/privacy-policy': {
    src: '/screenshots/middesk-privacy.jpg',
    alt: 'middesk.com privacy policy',
    capturedAt: '2026-09-14',
    site: 'Middesk',
    page: 'Privacy policy',
    href: 'https://www.middesk.com/policies/privacy-policy'
  },
  'middesk.com/resource-hub': {
    src: '/screenshots/middesk-resource-hub.jpg',
    alt: 'middesk.com resource hub',
    capturedAt: '2026-09-14',
    site: 'Middesk',
    page: 'Resource hub',
    href: 'https://www.middesk.com/resource-hub'
  },
  'middesk.com/product-release-hub': {
    src: '/screenshots/middesk-product-hub.jpg',
    alt: 'middesk.com product release hub',
    capturedAt: '2026-09-14',
    site: 'Middesk',
    page: 'Product release hub',
    href: 'https://www.middesk.com/product-release-hub'
  },
  'npiregistry.cms.hhs.gov/provider-view/1477211969': {
    src: '/screenshots/npi-joshua-gee.png',
    alt: 'NPPES NPI Registry record for Dr. Joshua Y Gee DPT, NPI 1477211969',
    capturedAt: '2026-09-17',
    site: 'Joshua Y Gee',
    page: 'NPI Registry record',
    href: 'https://npiregistry.cms.hhs.gov/provider-view/1477211969'
  },
  'help.middesk.com/en': {
    src: '/screenshots/middesk-help.jpg',
    alt: 'Middesk help centre',
    capturedAt: '2026-09-14',
    site: 'Middesk',
    page: 'Help centre',
    href: 'https://help.middesk.com/en'
  },

  // The businesses' own sites, home page each, captured live with headless
  // Chrome at 1440 wide on the day the Website row's thumbnail was added —
  // what the site served then, not now.
  'expertfence.com': {
    src: '/screenshots/site-expertfence-com.jpg',
    alt: 'expertfence.com home page',
    capturedAt: '2026-10-02',
    site: 'Expert Fence',
    page: 'Home page',
    href: 'http://www.expertfence.com'
  },
  'wilkauslander.com': {
    src: '/screenshots/site-wilkauslander-com.jpg',
    alt: 'wilkauslander.com home page',
    capturedAt: '2026-10-02',
    site: 'Wilk Auslander',
    page: 'Home page',
    href: 'http://www.wilkauslander.com'
  },
  'd1propertysolutions.com': {
    src: '/screenshots/site-d1propertysolutions-com.jpg',
    alt: 'd1propertysolutions.com home page',
    capturedAt: '2026-10-02',
    site: 'District 1 Property Solutions',
    page: 'Home page',
    href: 'https://d1propertysolutions.com'
  },
  'ets-na.com': {
    src: '/screenshots/site-ets-na-com.jpg',
    alt: 'ets-na.com home page',
    capturedAt: '2026-10-02',
    site: 'Enclos Tensile Structures',
    page: 'Home page',
    href: 'https://ets-na.com'
  },
  'solawave.co': {
    src: '/screenshots/site-solawave-co.jpg',
    alt: 'solawave.co home page',
    capturedAt: '2026-10-02',
    site: 'Solawave',
    page: 'Home page',
    href: 'https://www.solawave.co'
  },
  'sprig.com': {
    src: '/screenshots/site-sprig-com.jpg',
    alt: 'sprig.com home page',
    capturedAt: '2026-10-02',
    site: 'Userleap',
    page: 'Home page',
    href: 'https://sprig.com'
  },
  'kairosphysio.com': {
    src: '/screenshots/site-kairosphysio-com.jpg',
    alt: 'kairosphysio.com home page',
    capturedAt: '2026-10-02',
    site: 'Kairos Physical Therapy',
    page: 'Home page',
    href: 'https://www.kairosphysio.com'
  },
  'andytownsf.com': {
    src: '/screenshots/site-andytownsf-com.jpg',
    alt: 'andytownsf.com home page',
    capturedAt: '2026-10-02',
    site: 'Andytown',
    page: 'Home page',
    href: 'https://andytownsf.com'
  },
  'jayleaf.com': {
    src: '/screenshots/site-jayleaf-com.jpg',
    alt: 'jayleaf.com home page',
    capturedAt: '2026-10-02',
    site: 'Jayleaf',
    page: 'Home page',
    href: 'https://www.jayleaf.com'
  },
  'gracedentalgroup.com': {
    src: '/screenshots/site-gracedentalgroup-com.jpg',
    alt: 'gracedentalgroup.com home page',
    capturedAt: '2026-10-02',
    site: 'Woo Young Lee DDS',
    page: 'Home page',
    href: 'https://gracedentalgroup.com'
  },
  'miette.com': {
    src: '/screenshots/site-miette-com.jpg',
    alt: 'miette.com home page',
    capturedAt: '2026-10-02',
    site: 'Miette Cakes',
    page: 'Home page',
    href: 'http://miette.com'
  },
  'fishmongerdon.com': {
    src: '/screenshots/site-fishmongerdon-com.jpg',
    alt: 'fishmongerdon.com home page',
    capturedAt: '2026-10-02',
    site: 'Fishmonger Don',
    page: 'Home page',
    href: 'https://fishmongerdon.com'
  },
  'sorenson.com': {
    src: '/screenshots/site-sorenson-com.jpg',
    alt: 'sorenson.com home page',
    capturedAt: '2026-10-02',
    site: 'Sorenson Communications',
    page: 'Home page',
    href: 'http://sorenson.com'
  },
  'firebirdyarns.com': {
    src: '/screenshots/site-firebirdyarns-com.jpg',
    alt: 'firebirdyarns.com home page',
    capturedAt: '2026-10-02',
    site: 'Firebird Yarns',
    page: 'Home page',
    href: 'https://firebirdyarns.com'
  },
  'supabase.com': {
    src: '/screenshots/site-supabase-com.jpg',
    alt: 'supabase.com home page',
    capturedAt: '2026-10-02',
    site: 'Supabase',
    page: 'Home page',
    href: 'https://supabase.com'
  },
  'change.org': {
    src: '/screenshots/site-change-org.jpg',
    alt: 'change.org home page',
    capturedAt: '2026-10-02',
    site: 'Change.org',
    page: 'Home page',
    href: 'https://www.change.org'
  },
  'checkr.com': {
    src: '/screenshots/site-checkr-com.jpg',
    alt: 'checkr.com home page',
    capturedAt: '2026-10-02',
    site: 'Checkr',
    page: 'Home page',
    href: 'https://checkr.com'
  },
  'zendesk.com': {
    src: '/screenshots/site-zendesk-com.jpg',
    alt: 'zendesk.com home page',
    capturedAt: '2026-10-02',
    site: 'Zendesk',
    page: 'Home page',
    href: 'https://www.zendesk.com'
  },
  'oldstuffvintagesales.com': {
    src: '/screenshots/site-oldstuffvintagesales-com.jpg',
    alt: 'oldstuffvintagesales.com home page',
    capturedAt: '2026-10-02',
    site: 'Old Stuff Vintage Sales',
    page: 'Home page',
    href: 'https://www.oldstuffvintagesales.com'
  },
  'themalamarket.com': {
    src: '/screenshots/site-themalamarket-com.jpg',
    alt: 'themalamarket.com home page',
    capturedAt: '2026-10-02',
    site: 'The Mala Market',
    page: 'Home page',
    href: 'https://themalamarket.com'
  },
  'meroxa.com': {
    src: '/screenshots/site-meroxa-com.jpg',
    alt: 'meroxa.com home page',
    capturedAt: '2026-10-02',
    site: 'Meroxa',
    page: 'Home page',
    href: 'https://meroxa.com'
  }
}

/**
 * "Captured Sep 14, 2026".
 *
 * Local date parts, or an ISO date renders as the day before west of UTC.
 * Core formats its own copy — it cannot import product code, and the string is
 * shorter than the plumbing to share it.
 */
export const capturedLabel = (iso: string): string | undefined => {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  const date = parts
    ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))
    : new Date(iso)
  if (Number.isNaN(date.getTime())) return undefined

  return `Captured ${date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })}`
}

/**
 * The capture for one row's source, or nothing.
 *
 * `label` is the attribute the row states, so the lookup prefers the capture
 * taken for that claim over the page's own.
 */
export const screenshotFor = (
  href: string | undefined,
  label: string
): SourceScreenshot | undefined => {
  const page = href && pageKey(href)
  if (!page) return undefined

  return CAPTURES[`${page}::${label}`] ?? CAPTURES[page]
}
