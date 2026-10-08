import type { ReactNode } from 'react'

import { filingAge, longDate } from '../../lib/attributes'
import type { BusinessRecord } from '../../lib/deriveResults'
import { capturedLabel, type SourceScreenshot } from '../../lib/sourceScreenshots'
import { AttributeCells, type AttributeCell } from '../AttributeGrid'
import { useScreenshotViewer } from '../ScreenshotViewer'

// Every email, every phone number, every page the crawl walked, and any other
// repeated label (People, Business name) — each one row.
// The home page is the site itself, already shown above.
const HOME_PAGE = /\bhome\b/i

const GROUPS: Array<[RegExp, string]> = [
  [/e-?mail/i, 'Email addresses'],
  [/phone/i, 'Phone numbers']
]
// Any page the crawl walked; each sorts by its own URL into policies or the rest.
const PAGE =
  /\b(pages?|links?|urls?|terms|privacy|polic(y|ies)|refund|returns?|shipping|cookies?|about|company|contact|faq|careers?|blog|news(room)?|help|support|press|team)\b/i
const POLICY = /terms|privacy|polic|refund|return|shipping|cookie|legal/i

const condense = (cells: AttributeCell[]): AttributeCell[] => {
  const merged = new Map<string, AttributeCell>()
  const out: AttributeCell[] = []
  const add = (cell: AttributeCell, label: string, values: AttributeCell['values']) => {
    const existing = merged.get(label)
    if (existing) {
      existing.values = [...existing.values, ...values]
      return
    }
    const next: AttributeCell = {
      ...cell,
      key: label,
      label,
      labelNode: undefined,
      values: [...values]
    }
    merged.set(label, next)
    out.push(next)
  }
  for (const cell of cells) {
    if (HOME_PAGE.test(cell.label ?? '')) continue
    if (PAGE.test(cell.label ?? '')) {
      const policies = cell.values.filter(
        (v) => POLICY.test(String(v.value)) || POLICY.test(cell.label ?? '')
      )
      const company = cell.values.filter((v) => !policies.includes(v))
      if (policies.length) add(cell, 'Policy links', policies)
      if (company.length) add(cell, 'Company links', company)
      continue
    }
    // Grouped kinds take one name; any other label repeated is one row too.
    const label = GROUPS.find(([test]) => test.test(cell.label ?? ''))?.[1] ?? cell.label ?? ''
    add(cell, label, cell.values)
  }
  return out
}

export const WebsiteDetails = ({
  website,
  cells,
  screenshot
}: {
  website?: BusinessRecord['website']
  cells: AttributeCell[]
  screenshot?: SourceScreenshot
}) => {
  const { open } = useScreenshotViewer()
  const site = cells.find((cell) => cell.label === 'Website')
  // The domain's dates read with the site above, not as a row of their own.
  const rest = condense(cells.filter((cell) => cell !== site && cell.label !== 'Domain'))
  const age = filingAge(website?.domainCreated)?.replace(/\s*old$/, '')
  const cell = (label: string, value: ReactNode, note?: ReactNode): AttributeCell => ({
    key: label,
    label,
    values: [{ value, note }]
  })
  const items: AttributeCell[] = [
    ...(site ? [site] : website?.url ? [cell('Website', website.url)] : []),
    ...(website?.domainCreated
      ? [
          cell(
            'Registered',
            `${longDate(website.domainCreated.slice(0, 10)) ?? website.domainCreated}${age ? ` (${age})` : ''}`
          )
        ]
      : []),
    ...(website?.domainExpires
      ? [cell('Expires', longDate(website.domainExpires.slice(0, 10)) ?? website.domainExpires)]
      : []),
    ...(website?.registrar ? [cell('Registrar', website.registrar)] : []),
    cell(
      'Screenshot',
      screenshot ? (
        <button
          type="button"
          aria-label={`View screenshot: ${screenshot.alt}`}
          onClick={() => open(screenshot)}
          className="block h-24 w-36 overflow-hidden rounded-control border border-border transition-opacity duration-fast hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <img
            src={screenshot.src}
            alt=""
            className="block h-full w-full object-cover object-top"
          />
        </button>
      ) : (
        <span className="text-text-secondary">No image</span>
      ),
      screenshot ? capturedLabel(screenshot.capturedAt) : undefined
    ),
    ...rest
  ]

  // As a state's filing opens on the Registrations card: its name, then its cells.
  return (
    <div
      data-website-details
      className="min-w-0 border-t border-[var(--core-color-border-divider)]"
    >
      <div
        className="flex min-h-12 items-center gap-2 bg-bottom bg-no-repeat px-4 py-2"
        style={{ backgroundImage: 'var(--dash-rule-x)', backgroundSize: '100% 1px' }}
      >
        <span className="text-sm font-semibold text-text-primary">Website</span>
      </div>
      <AttributeCells items={items} className="-mb-px" />
    </div>
  )
}
