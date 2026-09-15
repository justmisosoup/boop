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
    capturedAt: '2026-09-14'
  },
  'facebook.com/middesk': {
    src: '/screenshots/facebook-profile.png',
    alt: 'Facebook page for Middesk',
    capturedAt: '2026-09-14'
  },
  'linkedin.com/company/middesk': {
    src: '/screenshots/linkedin-profile.png',
    alt: 'LinkedIn company page for Middesk',
    capturedAt: '2026-09-14'
  },
  'maps.google.com?cid=6720954453079130673': {
    src: '/screenshots/google-profile.png',
    alt: 'Google Maps listing for Middesk, Inc.',
    capturedAt: '2026-09-14'
  },
  'bbb.org/us/ca/san-francisco/profile/software-consultants/middesk-inc-1116-975336':
    {
      src: '/screenshots/bbb-profile.png',
      alt: 'BBB business profile for Middesk Inc',
      capturedAt: '2026-09-14'
    },
  'trustpilot.com/review/middesk.com': {
    src: '/screenshots/trustpilot-profile.png',
    alt: 'Trustpilot review page for middesk.com',
    capturedAt: '2026-09-14'
  },

  // The site itself, page by page. The home capture answers both the Website
  // row and the Home page row — `http://middesk.com` and
  // `https://www.middesk.com/` are the same doorstep, and the key knows it.
  'middesk.com': {
    src: '/screenshots/middesk-home.jpg',
    alt: 'middesk.com home page',
    capturedAt: '2026-09-14'
  },
  'middesk.com/contact': {
    src: '/screenshots/middesk-contact.jpg',
    alt: 'middesk.com contact page',
    capturedAt: '2026-09-14'
  },
  'middesk.com/about': {
    src: '/screenshots/middesk-about.jpg',
    alt: 'middesk.com about page',
    capturedAt: '2026-09-14'
  },
  'middesk.com/policies/terms-and-conditions': {
    src: '/screenshots/middesk-terms.jpg',
    alt: 'middesk.com terms and conditions',
    capturedAt: '2026-09-14'
  },
  'middesk.com/policies/privacy-policy': {
    src: '/screenshots/middesk-privacy.jpg',
    alt: 'middesk.com privacy policy',
    capturedAt: '2026-09-14'
  },
  'middesk.com/resource-hub': {
    src: '/screenshots/middesk-resource-hub.jpg',
    alt: 'middesk.com resource hub',
    capturedAt: '2026-09-14'
  },
  'middesk.com/product-release-hub': {
    src: '/screenshots/middesk-product-hub.jpg',
    alt: 'middesk.com product release hub',
    capturedAt: '2026-09-14'
  },
  'help.middesk.com/en': {
    src: '/screenshots/middesk-help.jpg',
    alt: 'Middesk help centre',
    capturedAt: '2026-09-14'
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
