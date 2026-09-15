/**
 * Captures of the pages a source is, keyed by the page and the attribute.
 *
 * A capture is evidence for ONE claim: the crop that shows `hello@middesk.com`
 * highlighted in the Intro card proves the email, and says nothing about the
 * follower count on the same page. So the lookup is keyed by attribute first,
 * and falls back to the page's own capture for rows that are about the page
 * itself rather than something lifted from it.
 *
 * Fixtures, in a prototype. A product would hold the capture on the source
 * record, taken at crawl time, with the crop the extractor actually read.
 */

export type SourceScreenshot = {
  src: string
  /** Names what the capture shows — the dialog's accessible name, and the
   *  alt text on a thumbnail that carries the evidence rather than decorating. */
  alt: string
}

const pageKey = (href: string): string | undefined => {
  try {
    const u = new URL(href)
    return `${u.host.replace(/^www\./, '')}${u.pathname.replace(/\/$/, '')}`
  } catch {
    return undefined
  }
}

const CAPTURES: Record<string, SourceScreenshot> = {
  'facebook.com/middesk::Email address': {
    src: '/screenshots/facebook-email.png',
    alt: 'Facebook page for Middesk, with hello@middesk.com highlighted'
  },
  'facebook.com/middesk': {
    src: '/screenshots/facebook-profile.png',
    alt: 'Facebook page for Middesk'
  }
}

/**
 * The capture for one row's source, or nothing.
 *
 * `label` is the attribute the row states, so the lookup prefers a crop taken
 * for that claim over the whole-page capture.
 */
export const screenshotFor = (
  href: string | undefined,
  label: string
): SourceScreenshot | undefined => {
  const page = href && pageKey(href)
  if (!page) return undefined

  return CAPTURES[`${page}::${label}`] ?? CAPTURES[page]
}
