import {
  cloneElement,
  Fragment,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'
import { ArrowLeft, Check, ChevronDown, LayoutGrid, ListFilter, Table2, X } from 'lucide-react'

import {
  ActionButton,
  ChatSourceChip,
  CopyButton,
  MetaChip,
  SegmentedControl,
  SegmentedControlItem,
  Tag,
  Toolbar,
  ToolbarCount,
  ToolbarSection,
  ToolbarSeparator,
  ToolbarSpacer
} from '@/core'

import {
  maskTin,
  peopleByPerson,
  peopleRows,
  profileFields
} from '../../lib/attributes'
import type { BusinessRecord, Derived } from '../../lib/deriveResults'
import type { GroupId } from '../../lib/groups'
import { operationsOf } from '../../lib/operations'
import { REPORT_CARDS, cardFor } from '../../lib/reportCards'
import { dismissalOf, screenedOf } from '../../lib/screening'
import { capturedLabel, screenshotFor } from '../../lib/sourceScreenshots'
import { sameName } from '../../lib/registrationStatus'
import type { Kind } from '../../lib/timeline/types'
import { StatusDot } from '../StatusDot'

import { AttributeCells, type AttributeCell } from '../AttributeGrid'
import { attributeRowsByGroup } from '../AttributesTab'
import { cellsFromRows } from '../attributeCells'
import { Collapsible } from '../Collapsible'
import { cn } from '../../utils/twUtils'
import { formationParts } from '../FormationCard'
import { OtherFilings } from './OtherFilings'
import { FilingStrip, FilingsViewToggle, type FilingsLayout } from './FilingStrip'
import { GroupCard } from './GroupCard'
import { AddressViewToggle, Explained, type AddressView } from './AddressTable'
import {
  IndustryStrip,
  LicenceStrip,
  LocationsStrip,
  industryDrawn,
  licencesDrawn,
  locationsDrawn
} from './OperationsCard'
import { PeopleView, PeopleViewToggle, type PeopleViewMode } from './PeopleStrip'
import { RelatedBusinesses } from './RelatedBusinesses'
import { ResultGrid, ResultTable, type ResultRow } from './ResultTable'
import { SubmittedChip } from '../Provenance'
import { CHIP_NO_GLYPH } from '../chipStyles'
import { BankruptcyTable, LienTable, LitigationTable } from './ClaimTables'
import { WebsiteDetails } from './WebsiteDetails'
import { useScreenshotViewer } from '../ScreenshotViewer'
import { confidentRelatedOf } from '../../lib/relatedBusinesses'
import { StripExpand } from './Strip'
import { MediaScreen, PepScreen, WatchlistScreen } from './ScreeningCard'

/** The order packages a public-record search ran under, by card. */
const SEARCHES: Record<
  'liens' | 'litigation' | 'bankruptcy',
  { packages: Record<string, string>; people: RegExp }
> = {
  liens: {
    packages: {
      tax_liens: 'tax liens',
      ucc_liens: 'UCC liens',
      liens: 'liens'
    },
    people: /^people_liens|^individual_liens/
  },
  litigation: {
    packages: { litigations: 'litigations' },
    people: /^people_litigations|^individual_litigations/
  },
  bankruptcy: {
    packages: { bankruptcies: 'bankruptcies' },
    people: /^people_bankruptcies|^individual_bankruptcies/
  }
}

/** What a public-record search ran on, as the order placed it: the business
 *  name, and the submitted people where the order searched people too. */
const searchedOn = (record: BusinessRecord, kind: keyof typeof SEARCHES) => {
  const orders = (record as BusinessRecord & { orders?: Array<{ package: string }> }).orders ?? []
  const { packages, people } = SEARCHES[kind]
  const ran = [...new Set(orders.map((o) => packages[o.package]).filter(Boolean))]
  const onPeople = orders.some((o) => people.test(o.package))
  const names = onPeople
    ? record.people.filter((p) => p.submitted && p.name).map((p) => p.name)
    : []
  return { ran, names }
}

/** Under "None found": what the search ran on — the business name, and the
 *  people where the order searched people too. */
const searchedNames = (record: BusinessRecord, kind: keyof typeof SEARCHES) => [
  record.name,
  ...searchedOn(record, kind).names
]
const searchedLine = (record: BusinessRecord, kind: keyof typeof SEARCHES) => {
  const n = searchedNames(record, kind).length
  return `Searched ${n} ${n === 1 ? 'name' : 'names'}`
}

/** With nothing found, what the card says it searched: "No results for tax
 *  liens or UCC liens", from the searches the order ran. */
const noneTitleFor = (record: BusinessRecord, kind: keyof typeof SEARCHES) => {
  const all = searchedOn(record, kind).ran
  // The general search says nothing the specific ones beside it do not.
  const ran = all.length > 1 ? all.filter((r) => r !== { liens: 'liens', litigation: 'litigations', bankruptcy: 'bankruptcies' }[kind]) : all
  const fallback = { liens: 'liens', litigation: 'litigations', bankruptcy: 'bankruptcies' }[kind]
  return `No results for ${ran.length > 0 ? ran.join(' or ') : fallback}`
}

/** A grid rules itself off at the top, as a strip does. */
const Grid = ({ children }: { children: ReactNode }) => (
  <div className="border-t border-[var(--core-color-border-divider)]">{children}</div>
)

/** A group's attribute rows, as a grid: the view for a group with no drawing of its own. */
const cellsOf = (
  byGroup: ReturnType<typeof attributeRowsByGroup>,
  group: GroupId,
  record: BusinessRecord,
  onJumpToSource?: (cardId: string) => void
) =>
  cellsFromRows([...(byGroup.get(group)?.values() ?? [])], {
    domesticState: record.formation?.state,
    onJumpToSource
  })

/** A result reads before an unknown, an unknown before a no-result. */
export const STATE_RANK: Record<string, number> = {
  result: 0,
  unknown: 1,
  no_result: 2
}

/** The assessment the report is narrowed to, as the filter bar names it:
 *  the workflow's name, and the way back. */
export type ReportFocusBanner = {
  id: string
  name: string
  onClear: () => void
}

/** A name's kind, over the name — "Legal name", "Former name · Changed Apr 2022". */
const NameLabel = ({ cell, qualifier }: { cell: AttributeCell; qualifier?: string }) => (
  <span className="block text-xs text-text-secondary">
    {[cell.label, qualifier].filter(Boolean).join(' · ')}
  </span>
)

/** Under the name, the grey source chip: Submitted, or where it was found — "San Francisco". */
const NameSource = ({ cell }: { cell: AttributeCell }) =>
  cell.badge ? (
    <span className="flex flex-wrap items-center gap-1.5 text-xs text-text-secondary">
      {/* Only a component takes `plainClaim`; a plain element would put it on the DOM. */}
      {isValidElement(cell.badge) && typeof cell.badge.type !== 'string'
        ? cloneElement(cell.badge as ReactElement<{ plainClaim?: boolean }>, { plainClaim: true })
        : cell.badge}
    </span>
  ) : null

/** The name, marked as an address is: verified, or submitted with nothing to back it. */
const NameValue = ({ cell, value }: { cell: AttributeCell; value: ReactNode }) => (
  <span className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
    {value}
    {cell.submitted && (
      <span
        role="img"
        aria-label={cell.verified ? 'Verified' : 'Unverified'}
        className="flex shrink-0"
      >
        <StatusDot intent={cell.verified ? 'success' : 'warning'} />
      </span>
    )}
  </span>
)

/** The business's names as a list, as the state filings are: one row per name.
 *  The status column only appears when the customer submitted a name. */
const NamesList = ({ cells }: { cells: AttributeCell[] }) => {
  return (
    <div
      role="table"
      aria-label="Names"
      className="border-t border-[var(--core-color-border-divider)]"
    >
      {cells.flatMap((cell, c) =>
        cell.values.map((v, i) => (
          <div
            key={`${cell.key ?? cell.label ?? c}-${v.key ?? i}`}
            role="row"
            className={cn(
              'grid grid-cols-1 items-center gap-x-4 gap-y-1 bg-[image:var(--dash-rule-x)] bg-[length:100%_1px] bg-[position:left_bottom] bg-no-repeat px-4 py-3 last:bg-none'
            )}
          >
            <span role="cell" className="grid min-w-0 gap-1">
              <NameLabel cell={cell} qualifier={v.qualifier} />
              <NameValue cell={cell} value={v.value} />
              <NameSource cell={cell} />
              {(v.note ?? cell.note) && (
                <span className="text-xs text-text-secondary">{v.note ?? cell.note}</span>
              )}
            </span>
          </div>
        ))
      )}
    </div>
  )
}

type NamesView = 'table' | 'grid'

const NamesViewToggle = ({
  value,
  onChange
}: {
  value: NamesView
  onChange: (view: NamesView) => void
}) => (
  <SegmentedControl
    size="sm"
    value={value}
    onValueChange={(v) => v && onChange(v as NamesView)}
    aria-label="Names display"
  >
    <SegmentedControlItem
      value="table"
      aria-label="Table"
      className="!px-2"
      icon={<Table2 aria-hidden="true" size={14} strokeWidth={1.75} />}
    />
    <SegmentedControlItem
      value="grid"
      aria-label="Grid"
      className="!px-2"
      icon={<LayoutGrid aria-hidden="true" size={14} strokeWidth={1.75} />}
    />
  </SegmentedControl>
)

/** The TIN as a one-row table: the number, whom the IRS matched it to, and as what. */
const TinTable = ({ record }: { record: BusinessRecord }) => {
  const tin = record.tin as {
    tin?: string
    name?: string
    verified_by?: string | null
  } | null
  if (!tin?.tin) return null
  const matchedBy = tin.verified_by ?? null
  // The IRS has not issued it yet: said under the number, with why that is
  // often so for a new business.
  const notIssued = record.reviewTasks.some((t) => t.key === 'tin_issued' && /not issued/i.test(t.subLabel ?? ''))
  const cols = 'md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]'
  return (
    <div
      role="table"
      aria-label="Tax ID"
      className="border-t border-[var(--core-color-border-divider)]"
    >
      <div
        role="row"
        className={cn(
          'hidden gap-x-4 border-b border-[var(--core-color-border-divider)] px-4 py-1.5 md:grid',
          cols
        )}
      >
        {['TIN', 'Type'].map((h) => (
          <span
            key={h}
            role="columnheader"
            className="text-xs font-medium text-[var(--core-color-table-header-text)]"
          >
            {h}
          </span>
        ))}
      </div>
      <div
        role="row"
        className={cn('grid grid-cols-1 items-center gap-x-4 gap-y-1 px-4 py-3', cols)}
      >
        <span role="cell" className="min-w-0">
          {/* Over the number: the business name the IRS matched it to — or,
              unmatched, why: not yet issued, or no match. */}
          <span className="block text-caption text-text-secondary">
            {matchedBy ? (tin.name ?? '') : notIssued ? 'Not yet in the IRS database' : 'No match on the IRS record'}
          </span>
          {/* The number, with the mark a verified value carries: green where the
              IRS matched it, amber where it did not. */}
          <span className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
            {maskTin(tin.tin)}
            <span role="img" aria-label={matchedBy ? 'Verified' : 'Unverified'} className="flex shrink-0">
              <StatusDot intent={matchedBy ? 'success' : 'warning'} />
            </span>
          </span>
          {/* The customer's number: Submitted. */}
          <span className="mt-0.5 flex">
            <SubmittedChip verified={Boolean(matchedBy)} plain />
          </span>
        </span>
        <span role="cell">
          {matchedBy ? (
            <MetaChip size="compact">
              {/business/i.test(matchedBy) ? 'Business' : 'Individual'}
            </MetaChip>
          ) : (
            // No type without a match. Not yet issued: why that is usual.
            <span className="text-sm text-text-secondary">
              {notIssued
                ? 'Newly formed businesses can take several weeks to appear after their EIN is assigned.'
                : '—'}
            </span>
          )}
        </span>
      </div>
    </div>
  )
}

type WebRow = { label: string; value?: ReactNode; href?: string }

const COLS = 'md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]'

const WebLink = ({ row }: { row: WebRow }) =>
  row.href ? (
    <span className="flex min-w-0 items-center gap-1">
      <a
        href={row.href}
        target="_blank"
        rel="noreferrer"
        className="truncate text-sm font-medium text-text-primary underline-offset-2 hover:underline"
      >
        {row.href.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
      </a>
      <CopyButton value={row.href} label="Copy link" variant="quiet" />
    </span>
  ) : (
    <span className="truncate text-sm font-medium text-text-primary">{row.value}</span>
  )

type Profile = NonNullable<BusinessRecord['profiles']>[number]

const PLATFORMS: Record<string, string> = {
  bbb: 'BBB',
  facebook: 'Facebook',
  google: 'Google',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  trustpilot: 'Trustpilot',
  x: 'X',
  yelp: 'Yelp'
}
const platformOf = (p: Profile) => PLATFORMS[(p.type ?? '').toLowerCase()] ?? p.type ?? 'Profile'
/** A social profile's handle — "@Sorenson_Comm" — from the platform's own
 *  field, or the link's path where the platform puts it there. */
const SOCIAL = /^(x|twitter|instagram|tiktok|facebook|threads|youtube)$/i
const handleOf = (p: Profile): string | undefined => {
  const given = (p.metadata as { handle?: string } | null | undefined)?.handle
  if (given) return `@${given.replace(/^@/, '')}`
  if (!SOCIAL.test(p.type ?? '') || !p.url) return undefined
  try {
    const first = new URL(p.url).pathname.split('/').filter(Boolean)[0]
    return first ? `@${first.replace(/^@/, '')}` : undefined
  } catch {
    return undefined
  }
}
const titleCase = (v: string) =>
  v.charAt(0).toUpperCase() + v.slice(1).toLowerCase().replace(/_/g, ' ')

/**
 * Whether the submitted website is the business's: online, and either the
 * domain's ownership is held with high confidence or the site confirmed one of
 * the submitted details — its name, office address, email or phone.
 * kairosphysio.com: online, high-confidence ownership, the address, email and
 * phone all verified on it, though its name ("Kairos Physio") is not the legal one.
 */
const siteVerifiedOf = (record: BusinessRecord) => {
  const said = (key: string) => record.reviewTasks.find((t) => t.key === key)?.subLabel ?? ''
  const online = /online/i.test(record.website?.status ?? '') || /online/i.test(said('website_status'))
  const owned = /high confidence/i.test(said('website_url_domain_ownership'))
  const confirmed = [
    'web_business_name_verification',
    'web_address_verification',
    'web_email_address_verification',
    'web_phone_number_verification'
  ].some((k) => /^verified$/i.test(said(k)))
  return online && (owned || confirmed)
}

/** What a site's or profile's status means, on hover. */
const statusTipOf = (status: string | null | undefined, kind: 'site' | 'profile') =>
  !status
    ? undefined
    : /online|active/i.test(status)
      ? kind === 'site'
        ? 'The site was online when the business record was ordered.'
        : 'The profile was live when the business record was ordered.'
      : `The ${kind === 'site' ? 'site' : 'profile'} was ${status.toLowerCase()} when the business record was ordered.`

/** Why the submitted website reads as verified: the reasons that held. */
const siteVerifiedWhyOf = (record: BusinessRecord) => {
  const said = (key: string) => record.reviewTasks.find((t) => t.key === key)?.subLabel ?? ''
  const confirmed = [
    ['web_business_name_verification', 'business name'],
    ['web_address_verification', 'address'],
    ['web_email_address_verification', 'email'],
    ['web_phone_number_verification', 'phone']
  ]
    .filter(([k]) => /^verified$/i.test(said(k)))
    .map(([, what]) => what)
  const reasons = [
    /high confidence/i.test(said('website_url_domain_ownership')) && 'its domain ownership is high confidence',
    confirmed.length > 0 &&
      `it confirmed the submitted ${confirmed.length > 1 ? `${confirmed.slice(0, -1).join(', ')} and ${confirmed[confirmed.length - 1]}` : confirmed[0]}`
  ].filter(Boolean)
  return reasons.length > 0 ? `The submitted website belongs to the business: ${reasons.join(', and ')}.` : undefined
}

/** Where a site or profile came from, under its name: the customer's
 *  Submitted tag, or Found where Middesk discovered it. */
const Origin = ({ submitted, verified = true }: { submitted: boolean; verified?: boolean }) =>
  submitted ? (
    <SubmittedChip verified={verified} plain />
  ) : (
    // The same chip as Submitted, saying the other thing.
    <ChatSourceChip
      className={CHIP_NO_GLYPH}
      sources={[{ id: 'found', label: 'Found', title: 'Found', annotation: 'Discovered by Middesk, not submitted' }]}
    />
  )

/** A site or profile's name, with the mark a submitted value carries after it:
 *  green where verified, amber where not. Found ones carry none. */
const WebTitle = ({ text, submitted, verified }: { text: ReactNode; submitted: boolean; verified: boolean }) => (
  <span className="inline-flex items-center gap-1.5">
    {text}
    {submitted && (
      <span role="img" aria-label={verified ? 'Verified' : 'Unverified'} className="flex shrink-0">
        <StatusDot intent={verified ? 'success' : 'warning'} />
      </span>
    )}
  </span>
)

/** Whether it is up — "Online" — and, where it is, verified: the green check
 *  every verified value carries. Found goes without saying: it is listed. */
const StatusChips = ({
  status,
  verified = false,
  statusTip,
  verifiedTip
}: {
  status?: string | null
  verified?: boolean
  /** What the status means, on hover. */
  statusTip?: string
  /** Why it reads as verified, on hover. */
  verifiedTip?: string
}) => {
  const tip = (text: string | undefined, chip: ReactNode) => (text ? <Explained tip={text}>{chip}</Explained> : chip)
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {status &&
        tip(
          statusTip,
          <MetaChip size="compact" tone={/online|active/i.test(status) ? 'success' : 'warning'}>
            {titleCase(status)}
          </MetaChip>
        )}
      {verified &&
        tip(
          verifiedTip,
          <MetaChip size="compact" tone="success">
            <Check aria-hidden="true" size={12} strokeWidth={2} className="shrink-0" />
            Verified
          </MetaChip>
        )}
    </span>
  )
}

const DetailList = ({ items }: { items: Array<[string, ReactNode]> }) => (
  <dl className="m-0 grid gap-3">
    {items.map(([label, value]) => (
      <div key={label} className="grid gap-0.5">
        <dt className="text-xs text-text-secondary">{label}</dt>
        <dd className="m-0 break-words text-sm text-text-primary">{value}</dd>
      </div>
    ))}
  </dl>
)

/** One third-party profile in full, as a state's filing opens on the Registrations
 *  card: the platform's name, then what it says about the business, in cells. */
const ProfileDetails = ({ profile }: { profile: Profile }) => {
  const cell = (label: string, value: ReactNode, note?: ReactNode): AttributeCell => ({
    key: label,
    label,
    values: [{ value, note }]
  })
  const m = (profile.metadata ?? {}) as Record<string, unknown>
  // What the page says, a line each: its standing and figures, then — where
  // the platform says it — whether the account is public or private.
  const fields = profileFields(profile)
  // The kind of account is a cell of its own; the rest of what it says is Detail.
  const account = fields.find((f) => f.label === 'Account')
  const details = fields.filter((f) => f !== account)
  const bio = typeof m.biography === 'string' && m.biography.trim() ? m.biography.trim() : undefined
  const linked = Array.isArray(m.website_urls)
    ? (m.website_urls as unknown[]).filter((u): u is string => typeof u === 'string' && u.length > 0)
    : []
  const items: AttributeCell[] = [
    ...(profile.url ? [cell('Link', <WebLink row={{ label: 'Link', href: profile.url }} />)] : []),
    ...(profile.name ? [cell('Name on profile', profile.name)] : []),
    ...(account ? [cell('Account', account.value)] : []),
    ...((profile.categories ?? []).length > 0
      ? [cell('Categories', (profile.categories ?? []).join(', '))]
      : []),
    ...(linked.length > 0
      ? [
          cell(
            'Website on profile',
            <span className="flex flex-col gap-0.5">
              {linked.map((u) => (
                <WebLink key={u} row={{ label: 'Website', href: u }} />
              ))}
            </span>
          )
        ]
      : []),
    ...(bio ? [{ ...cell('Bio', bio), span: 'full' as const }] : []),
    // What the page says, in one cell, a line each — "Verified business",
    // "1,282 followers · 73 following · 26 posts", "Last post: Aug 22, 2026" —
    // as its Sources card reads it.
    ...(details.length > 0
      ? [
          {
            key: 'detail',
            label: 'Detail',
            span: 'full' as const,
            values: [
              {
                value: (
                  <span className="flex flex-col gap-0.5">
                    {details.map((f) => (
                      <span key={f.value}>{f.label ? `${f.label}: ${f.value}` : f.value}</span>
                    ))}
                  </span>
                )
              }
            ]
          }
        ]
      : []),
  ]
  return (
    <div className="min-w-0 border-t border-[var(--core-color-border-divider)]">
      <div
        className="flex min-h-12 items-center gap-2 bg-bottom bg-no-repeat px-4 py-2"
        style={{ backgroundImage: 'var(--dash-rule-x)', backgroundSize: '100% 1px' }}
      >
        <span className="text-sm font-semibold text-text-primary">{platformOf(profile)}</span>
      </div>
      <AttributeCells items={items} className="-mb-px" />
    </div>
  )
}

// The registrations table's row, so the cards' tables read and behave alike.
const rowClass = (on: boolean) =>
  cn(
    'grid w-full grid-cols-1 items-center gap-x-4 gap-y-2 bg-[image:var(--dash-rule-x)] bg-[length:100%_1px] bg-[position:left_bottom] bg-no-repeat px-4 py-3 text-left transition-colors last:bg-none hover:bg-[var(--core-color-state-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
    COLS,
    on && 'bg-[var(--core-color-surface-subtle)]'
  )
const hostOf = (href?: string | null) =>
  (href ?? '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')

type WebView = 'table' | 'grid'

/** The Web presence card's display switch: the site and profiles as a table or a grid. */
const WebViewToggle = ({ value, onChange }: { value: WebView; onChange: (view: WebView) => void }) => (
  <SegmentedControl
    size="sm"
    value={value}
    onValueChange={(v) => v && onChange(v as WebView)}
    aria-label="Web presence display"
  >
    <SegmentedControlItem
      value="table"
      aria-label="Table"
      className="!px-2"
      icon={<Table2 aria-hidden="true" size={14} strokeWidth={1.75} />}
    />
    <SegmentedControlItem
      value="grid"
      aria-label="Grid"
      className="!px-2"
      icon={<LayoutGrid aria-hidden="true" size={14} strokeWidth={1.75} />}
    />
  </SegmentedControl>
)

/**
 * Web presence as the other cards read their records: the site, then each
 * third-party profile, a row (or a cell) each — the platform over its link,
 * found and its status beside — opening to the site's full web analysis or the
 * profile's details. With neither, the card's "No results" display.
 */
const WebsiteSummary = ({
  url,
  status,
  profiles,
  analysis,
  view,
  siteVerified = false,
  siteSubmitted = false,
  siteVerifiedWhy
}: {
  url?: string | null
  status?: string | null
  profiles: Profile[]
  analysis: ReactNode
  view: WebView
  /** The site states the submitted business name. */
  siteVerified?: boolean
  /** The customer submitted the site, rather than it being found. */
  siteSubmitted?: boolean
  /** Why the submitted site reads as verified, for its chip's tooltip. */
  siteVerifiedWhy?: string
}) => {
  const rows: ResultRow[] = [
    ...(url
      ? [
          {
            key: 'site',
            caption: 'Website',
            title: <WebTitle text={hostOf(url)} submitted={siteSubmitted} verified={siteVerified} />,
            // Where it came from, under it: submitted by the customer, or found.
            sub: <Origin submitted={siteSubmitted} verified={siteVerified} />,
            // Verified where the submitted site is shown to be the business's.
            chips: (
              <StatusChips
                status={status}
                statusTip={statusTipOf(status, 'site')}
                verified={siteSubmitted && siteVerified}
                verifiedTip={siteVerifiedWhy}
              />
            ),
            cleared: false,
            detail: analysis
          }
        ]
      : profiles.length > 0
        ? // Profiles without a site: the site's absence is still a fact the card states.
          [
            {
              key: 'site',
              caption: 'Website',
              title: 'Not submitted',
              cleared: false,
              detail: <div className="px-4 py-3 text-sm text-text-secondary">No website was submitted.</div>
            }
          ]
        : []),
    ...profiles.map((p, i) => ({
      key: p.id ?? `${p.type}-${i}`,
      caption: platformOf(p),
      // The page's own name, and on a social platform its handle — not the
      // link, which is a click away in the details.
      title: (
        <WebTitle
          text={[p.name || platformOf(p), handleOf(p)].filter(Boolean).join(' · ')}
          submitted={Boolean((p as { submitted?: boolean }).submitted)}
          // A submitted profile found online is the one submitted.
          verified={/online|active/i.test(p.status ?? '')}
        />
      ),
      sub: (
        <Origin
          submitted={Boolean((p as { submitted?: boolean }).submitted)}
          verified={/online|active/i.test(p.status ?? '')}
        />
      ),
      // Verified where the platform marks the account so — a social account's
      // badge — or where the customer submitted it and it was found online.
      chips: (
        <StatusChips
          status={p.status}
          statusTip={statusTipOf(p.status, 'profile')}
          verified={
            Boolean((p.metadata as { verified?: boolean } | null | undefined)?.verified) ||
            (Boolean((p as { submitted?: boolean }).submitted) && /online|active/i.test(p.status ?? ''))
          }
          verifiedTip={
            (p.metadata as { verified?: boolean } | null | undefined)?.verified
              ? `${platformOf(p)} marks this account as verified.`
              : 'The submitted profile was found online.'
          }
        />
      ),
      cleared: false,
      detail: <ProfileDetails profile={p} />
    }))
  ]
  const noneTitle = 'No results for a website or third-party profiles'
  return view === 'grid' ? (
    <div className="border-t border-[var(--core-color-border-divider)]">
      <ResultGrid rows={rows} noneTitle={noneTitle} />
    </div>
  ) : (
    <ResultTable columns={['Platform', 'Status']} rows={rows} noneTitle={noneTitle} />
  )
}

/**
 * Narrowed to some of the cards: the way back to the whole report, as a dark
 * tab hanging over the first card — in the space above it, so the card keeps
 * its place, level with the panel beside it. Scrolled away, it pins under the report's
 * sticky head and turns its rounding over. ~/Projects/prototype's `BackTab`
 * (`report/components/Report/GroupedReport.tsx`), its offset read from the
 * head height RecordPage publishes rather than a sticky context. It sits at the
 * top of the report's column, which runs the page's full height, so it stays
 * pinned however far the page scrolls.
 */
export const BackTab = ({ onClick }: { onClick: () => void }) => {
  const sentinel = useRef<HTMLSpanElement>(null)
  const tab = useRef<HTMLButtonElement>(null)
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    // Pinned once the tab has left its place, which the sentinel keeps.
    // Capture: the page scrolls in a panel from `wide`, not the window.
    const check = () => {
      const from = sentinel.current?.getBoundingClientRect()
      const at = tab.current?.getBoundingClientRect()
      if (from && at) setStuck(at.top - from.bottom > 1)
    }
    check()
    window.addEventListener('scroll', check, true)
    window.addEventListener('resize', check)
    return () => {
      window.removeEventListener('scroll', check, true)
      window.removeEventListener('resize', check)
    }
  }, [])
  return (
    <>
      <span ref={sentinel} aria-hidden="true" className="block h-0" />
      <button
        ref={tab}
        type="button"
        onClick={() => {
          // Back to the top of the report as it opens out again. Found before
          // the tab unmounts: the page may scroll in a panel.
          let scroller = tab.current?.parentElement ?? null
          while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement
          onClick()
          requestAnimationFrame(() => (scroller ?? window).scrollTo({ top: 0, behavior: 'smooth' }))
        }}
        className={cn(
          'sticky top-[var(--report-head-h,0px)] z-[3] -mt-7 mx-3 flex h-7 w-[calc(100%-theme(spacing.6))] items-center gap-1.5 px-3 text-caption font-medium wide:top-[calc(var(--report-head-h,0px)-54px)]',
          // The inverse surface, so the way back reads apart from the cards.
          'bg-[var(--core-color-surface-inverse)] text-[var(--core-color-text-inverse)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          stuck ? 'rounded-b-card shadow-elevation-control' : 'rounded-t-card'
        )}
      >
        <ArrowLeft aria-hidden="true" size={12} strokeWidth={2} />
        Back to full report
      </button>
    </>
  )
}

/**
 * The report, by card.
 *
 * The Insights tab's grouping, in its order, one card per group — three for
 * Screening — each the card's data view, then its review tasks. What an
 * assessment made of it is the Assistant's, whose citations lead here. A card
 * the record has nothing in — no view, no rows — is not drawn.
 *
 * Focused (`only`): just the cards an assessment rests on, under a banner
 * saying which assessment and why, with the way back to the whole report.
 */
export const GroupedReport = ({
  record,
  results,
  groupFor,
  negatives,
  revealed,
  only,
  focus,
  pinned = false,
  expand,
  onJumpToSource,
  onJumpToTimeline,
  hideInsights = false
}: {
  record: BusinessRecord
  results: Derived[]
  groupFor: (insightId: string) => GroupId
  negatives?: ReadonlySet<string>
  revealed?: ReadonlySet<string>
  /** The cards to show, by id — an assessment's; absent, every card. */
  only?: ReadonlySet<string>
  /** With `only`: the assessment the report is narrowed to. */
  focus?: ReportFocusBanner
  /** The report has scrolled under the pinned head: the filter bar, when it
   *  is the lowest pinned bar, casts the shadow. */
  pinned?: boolean
  /** The card an Assistant chip just led to, opened; `n` counts the jumps. */
  expand?: { card: string; n: number }
  onJumpToSource?: (cardId: string) => void
  onJumpToTimeline?: (eventId: string, kinds?: Kind[]) => void
  /** Narrowed to an area: its insights are listed under the area, not in the cards. */
  hideInsights?: boolean
}) => {
  // The Addresses card's display — table, grid or map — chosen in its header.
  const [addressView, setAddressView] = useState<AddressView>('table')
  const [peopleView, setPeopleView] = useState<PeopleViewMode>('list')
  const [filingsView, setFilingsView] = useState<FilingsLayout>('list')
  const [namesView, setNamesView] = useState<NamesView>('table')
  const [webView, setWebView] = useState<WebView>('table')
  // The Names card's former names, folded away until asked for.
  const [showFormer, setShowFormer] = useState(false)
  const parts = useMemo(
    () => formationParts(record, results, groupFor, onJumpToSource, onJumpToTimeline),
    [record, results, groupFor, onJumpToSource, onJumpToTimeline]
  )
  // The former names, counted for the card's fold; with none, it has no fold.
  const formerCount = parts.names.find((cell) => cell.key === 'former')?.values.length ?? 0
  const namesShown = showFormer ? parts.names : parts.names.filter((cell) => cell.key !== 'former')
  // The Registrations card holds the city registrations in every view: rows, cells, map pins.
  const cityInTable = Boolean(parts.strip)
  const ops = useMemo(() => operationsOf(record), [record])
  const byGroup = useMemo(
    () => attributeRowsByGroup(record, results, groupFor),
    [record, results, groupFor]
  )
  const screens = useMemo(() => screenedOf(record), [record])

  /* The card's rows, as the Insights tab files them: flagged first — the
     record came back adverse, or the score read it against the identity —
     then a result before an unknown before a no-result. */
  const isFlagged = (r: Derived) =>
    r.reason === 'should_exist_not_found' || Boolean(negatives?.has(r.insightId))
  const rowsOf = (cardId: string) =>
    results
      .filter((r) => !r.notReported && cardFor(r.insightId, groupFor) === cardId)
      .sort(
        (a, b) =>
          Number(isFlagged(b)) - Number(isFlagged(a)) ||
          (STATE_RANK[a.state] ?? 3) - (STATE_RANK[b.state] ?? 3)
      )

  /* Every person on the record — officers and agents the filings name,
     licence holders, the people submitted — one cell each: their roles
     combined, under one spelling of their name. */
  const people = useMemo(() => peopleByPerson(peopleRows(record)), [record])

  const grid = (group: GroupId) => {
    const cells = cellsOf(byGroup, group, record, onJumpToSource)
    return cells.length > 0 ? (
      <Grid>
        <AttributeCells items={cells} columns={3} className="-mb-px" />
      </Grid>
    ) : undefined
  }

  // The web analysis's own capture of the home page; the samples only stand in without one.
  const crawled =
    (record.website?.pages ?? []).find((pg) => pg.screenshotUrl && pg.category === 'home') ??
    (record.website?.pages ?? []).find((pg) => pg.screenshotUrl)
  const capturedEpoch = crawled?.screenshotUrl?.match(/--(\d{10})\./)?.[1]
  const siteShot = crawled?.screenshotUrl
    ? {
        src: crawled.screenshotUrl,
        alt: `${record.website?.url ?? 'Website'} home page`,
        capturedAt: capturedEpoch ? new Date(Number(capturedEpoch) * 1000).toISOString() : ''
      }
    : screenshotFor(record.website?.url ?? undefined, 'Website')
  // What the crawl read off the site that other cards also show — names,
  // addresses, people — so the web analysis holds everything it found.
  const foundOnSite = cellsFromRows(
    [...byGroup.entries()]
      .filter(([group]) => group !== 'website')
      .flatMap(([, rows]) => [...rows.values()])
      .filter((row) => (row.sources ?? []).some((source) => /website/i.test(source))),
    { domesticState: record.formation?.state, onJumpToSource }
  )
  const websiteCells = cellsFromRows(
    [...(byGroup.get('website')?.values() ?? [])]
      .filter((row) => !['Site status', 'Title', 'Parked', 'Coming soon'].includes(row.label))
      .map((row) => (row.label === 'Website' ? { ...row, trailing: undefined } : row)),
    { domesticState: record.formation?.state, onJumpToSource }
  )

  const profileCells = cellsOf(byGroup, 'profiles', record, onJumpToSource)
  /* The emails and phone numbers the profiles carry, after the profiles, each
     with how it was found: one chip listing every page it was read off — the
     Instagram and Facebook profiles, the website — each linking to it. */
  const contactCells = cellsFromRows(
    [...(byGroup.get('website')?.values() ?? [])]
      .filter(
        (r) =>
          /^(email address|phone number)$/i.test(r.label) &&
          (r.refs ?? []).some((x) => x.type === 'profile')
      )
      .filter((r, i, all) => all.findIndex((x) => x.label === r.label && x.value === r.value) === i)
      .map((r) => ({
        ...r,
        sources: [
          ...(r.sources ?? []),
          ...(r.sourceUrls?.Website && !(r.sources ?? []).includes('Website') ? ['Website'] : [])
        ]
      })),
    { domesticState: record.formation?.state, onJumpToSource }
  )
  const profilesGrid =
    profileCells.length > 0 ? (
      <AttributeCells items={[...profileCells, ...contactCells]} columns={3} className="-mb-px" />
    ) : undefined
  const siteHost = (() => {
    try {
      return record.website?.url
        ? new URL(record.website.url).host.replace(/^www\./, '')
        : undefined
    } catch {
      return record.website?.url ?? undefined
    }
  })()

  const liens = record.liens ?? []
  const cases = record.litigations ?? []
  const petitions = record.bankruptcies ?? []

  /* How many of a card's things the record holds, beside its title: the
     liens, the cases, the people, the places. Only where the card is a list
     of like things — a count of the Formation card's facts, or of an
     industry's codes, would count nothing a reader is looking for. */
  const returned = (hits: Array<{ hit: { id: string } }>) => new Set(hits.map((h) => h.hit.id)).size
  const tally: Partial<Record<string, number>> = {
    people: people.length,
    address: ops.locations.length,
    // The confident ones only: "No confident matches found" counts none.
    connections: confidentRelatedOf(record).length,
    licenses: ops.stateLicences.length + (ops.licence.required ? ops.licence.found.length : 0),
    'screening-watchlist': returned(screens.watchlist.hits),
    'screening-pep': returned(screens.pep.hits),
    'screening-media': returned(screens.media.hits),
    liens: liens.length,
    litigation: cases.length,
    bankruptcy: petitions.length
  }

  /** Each card's data view, where the record holds something to draw. */
  const visual: Partial<Record<string, ReactNode>> = {
    // The names, a card of their own: Legal name, Alternative names, Former names.
    name: parts.names.some((cell) => cell.values.length > 0) ? (
      <>
      {namesView === 'table' || namesShown.reduce((n, cell) => n + cell.values.length, 0) < 2 ? (
        <NamesList cells={namesShown} />
      ) : (
        <div className="overflow-hidden border-t border-[var(--core-color-border-divider)]">
          <AttributeCells
            className="-mb-px"
            columns={2}
            items={namesShown.flatMap((cell, c) =>
              cell.values.map((v, i) => ({
                key: `${cell.key ?? c}-${v.key ?? i}`,
                label: [cell.label, v.qualifier].filter(Boolean).join(' · '),
                labelNode: <NameLabel cell={cell} qualifier={v.qualifier} />,
                values: [
                  {
                    value: (
                      <span className="grid gap-1">
                        <NameValue cell={cell} value={v.value} />
                        <NameSource cell={cell} />
                      </span>
                    ),
                    note: v.note ?? cell.note
                  }
                ]
              }))
            )}
          />
        </div>
      )}
      {/* The names it dropped, folded away under the current ones. */}
      {formerCount > 0 && (
        <div className="flex justify-start border-t border-[var(--core-color-border-divider)] px-2 py-2">
          <ActionButton variant="quiet" size="compact" onClick={() => setShowFormer(!showFormer)}>
            {showFormer
              ? `Hide former ${formerCount === 1 ? 'name' : 'names'}`
              : `Show ${formerCount} former ${formerCount === 1 ? 'name' : 'names'}`}
          </ActionButton>
        </div>
      )}
      </>
    ) : undefined,
    // The registrations: the state filings, open on the formation filing —
    // whose details are the ones the grid above them repeated.
    formation:
      parts.city || parts.dbaRule || parts.strip || parts.formation.length > 0 ? (
        <>
          {!parts.strip && parts.formation.length > 0 && (
            <Grid>
              <AttributeCells items={parts.formation} columns={3} className="-mb-px" />
            </Grid>
          )}
          {parts.strip && (
            <FilingStrip
              layout={filingsView}
              leadCells={parts.formation}
              record={parts.strip.record}
              lead={parts.strip.lead}
              legalName={parts.strip.legalName}
              // In the table and the grid, the city registrations are entries of it.
              city={cityInTable ? parts.city : undefined}
            />
          )}
          {/* The filings other than the state's, under them: city registrations
              (where the table does not hold them) and a sole proprietor's DBA
              filing, as chips like the state filings'. */}
          {(((parts.city?.length ?? 0) > 0 && !cityInTable) || parts.dbaRule) && (
            <OtherFilings city={cityInTable ? undefined : parts.city} dbaRule={parts.dbaRule} />
          )}
        </>
      ) : undefined,
    tin: parts.tin ? <TinTable record={record} /> : undefined,
    // As the Addresses card draws its places: a strip per kind, a chip per
    // person, their cell under the strip when picked.
    people:
      people.length > 0 ? (
        <PeopleView
          view={peopleView}
          people={people}
          ctx={{ domesticState: record.formation?.state, onJumpToSource }}
        />
      ) : only?.has('people') ? (
        // Asked for by name: an empty card says so, rather than an empty page.
        <div className="border-t border-[var(--core-color-border-divider)] px-4 py-3 text-sm text-text-secondary">
          No people found
        </div>
      ) : undefined,
    address: locationsDrawn(ops) ? (
      <LocationsStrip
        view={addressView}
        ops={ops}
        record={record}
        onJumpToSource={onJumpToSource}
      />
    ) : undefined,
    connections:
      (record.connections ?? []).length > 0 ? <RelatedBusinesses record={record} /> : undefined,
    // No website on the record is itself the fact the card states. With a
    website: (
      <WebsiteSummary
        view={webView}
        siteSubmitted={Boolean((record.website as { submitted?: boolean } | null | undefined)?.submitted)}
        siteVerified={siteVerifiedOf(record)}
        siteVerifiedWhy={siteVerifiedWhyOf(record)}
        url={record.website?.url}
        status={record.website?.status}
        profiles={record.profiles ?? []}
        analysis={
          <WebsiteDetails
            website={record.website}
            cells={[...websiteCells, ...foundOnSite]}
            screenshot={siteShot}
          />
        }
      />
    ),
    industry: industryDrawn(ops) ? <IndustryStrip ops={ops} /> : undefined,
    licenses: licencesDrawn(ops) ? (
      <LicenceStrip ops={ops} record={record} onJumpToSource={onJumpToSource} />
    ) : undefined,
    // Each screen its own card, as the financial records are: a search that
    // came back clear is still that search, run.
    'screening-watchlist': screens.watchlist.ran ? (
      <WatchlistScreen record={record} onJumpToSource={onJumpToSource} />
    ) : undefined,
    'screening-pep': screens.pep.ran ? (
      <PepScreen record={record} onJumpToSource={onJumpToSource} />
    ) : undefined,
    'screening-media': screens.media.ran ? (
      <MediaScreen record={record} onJumpToSource={onJumpToSource} />
    ) : undefined,
    // As the Addresses card reads its places: a row per record, the closed
    // folding under "None found" where nothing is open — and none on file is
    // itself "None found", with what was searched under it.
    liens: (
      <LienTable
        record={record}
        onJumpToSource={onJumpToSource}
        none={searchedLine(record, 'liens')}
        searched={searchedNames(record, 'liens')}
        noneTitle={noneTitleFor(record, 'liens')}
      />
    ),
    litigation: (
      <LitigationTable
        record={record}
        onJumpToSource={onJumpToSource}
        none={searchedLine(record, 'litigation')}
        searched={searchedNames(record, 'litigation')}
        noneTitle={noneTitleFor(record, 'litigation')}
      />
    ),
    bankruptcy: (
      <BankruptcyTable
        record={record}
        onJumpToSource={onJumpToSource}
        none={searchedLine(record, 'bankruptcy')}
        searched={searchedNames(record, 'bankruptcy')}
        noneTitle={noneTitleFor(record, 'bankruptcy')}
      />
    )
  }

  /* A card the record came back empty for: nothing to draw — no liens, no
     related businesses — or a screen that ran and returned no hits, or no
     website at all. It still says so, at the end of the report: what was found
     reads first. */
  // A screen counts the results still standing — every one not dismissed,
  // as its chips say (`dismissalOf`).
  const counts = (screen: 'watchlist' | 'pep' | 'media') =>
    (screens[screen].hits as Array<Parameters<typeof dismissalOf>[1]>).some(
      (h) => !dismissalOf(screen, h)
    )
  const noResults = (id: string) =>
    id === 'screening-watchlist'
      ? !counts('watchlist')
      : id === 'screening-pep'
        ? !counts('pep')
        : id === 'screening-media'
          ? !counts('media')
          : id === 'connections'
            ? confidentRelatedOf(record).length === 0
          : id === 'website'
            ? !record.website?.url && !profilesGrid
            : id === 'liens'
              ? liens.length === 0
              : id === 'litigation'
                ? cases.length === 0
                : id === 'bankruptcy'
                  ? petitions.length === 0
                  : !visual[id]

  // The cards the record draws at all, what was found first and the empty ones
  // after, each in the report's order; of those, the ones in view.
  // With the insights hidden, a card with nothing but insight rows has nothing to draw.
  const all = REPORT_CARDS.map((c) => ({ card: c, rows: rowsOf(c.id) })).filter(
    ({ card, rows }) => visual[card.id] || (!hideInsights && rows.length > 0)
  )
  const byResults = [
    ...all.filter(({ card }) => !noResults(card.id)),
    ...all.filter(({ card }) => noResults(card.id))
  ]
  /* The compliance checks read as one run: what still stands first — a hit,
     an open lien — then what was only dismissed or closed, then the checks that
     came back with nothing, each group in the run's own order (Sanctions, PEP,
     Adverse media, then Liens, Litigation, Bankruptcy). The run sits with what
     was found where any of it found something, at the end where none did. */
  const CLOSED = /closed|terminated|lapsed|released|dismissed|satisfied|discharged/i
  const standingOf = (statuses: Array<string | null | undefined>) =>
    statuses.some((st) => !CLOSED.test(st ?? '')) ? 0 : statuses.length > 0 ? 1 : 2
  const screenRank = (screen: 'watchlist' | 'pep' | 'media') =>
    counts(screen) ? 0 : screens[screen].hits.length > 0 ? 1 : 2
  const foundRank = (id: string) =>
    id === 'screening-watchlist'
      ? screenRank('watchlist')
      : id === 'screening-pep'
        ? screenRank('pep')
        : id === 'screening-media'
          ? screenRank('media')
          : id === 'liens'
            ? standingOf(liens.map((l) => l.status))
            : id === 'litigation'
              ? standingOf(cases.map((c) => c.caseStatus))
              : id === 'bankruptcy'
                ? standingOf(petitions.map((b) => b.status))
                : 0
  const COMPLIANCE = [
    'screening-watchlist',
    'screening-pep',
    'screening-media',
    'liens',
    'litigation',
    'bankruptcy'
  ]
  const inRun = ({ card }: (typeof byResults)[number]) => COMPLIANCE.includes(card.id)
  const run = byResults
    .filter(inRun)
    .sort(
      (x, y) =>
        foundRank(x.card.id) - foundRank(y.card.id) ||
        COMPLIANCE.indexOf(x.card.id) - COMPLIANCE.indexOf(y.card.id)
    )
  const at = byResults.findIndex(inRun)
  const rest = byResults.filter((x) => !inRun(x))
  const drawn = at < 0 ? byResults : [...rest.slice(0, at), ...run, ...rest.slice(at)]
  // Tax ID always reads before Registrations, whatever was found where.
  const ordered = (() => {
    const tin = drawn.findIndex(({ card }) => card.id === 'tin')
    const formation = drawn.findIndex(({ card }) => card.id === 'formation')
    if (tin < 0 || formation < 0 || tin < formation) return drawn
    const rest = drawn.filter((_, i) => i !== tin)
    return [...rest.slice(0, formation), drawn[tin], ...rest.slice(formation)]
  })()
  const shown = only ? ordered.filter(({ card }) => only.has(card.id)) : ordered

  const narrowed = Boolean(only && focus)

  return (
    <>
      {/*
       * Narrowed to one assessment: an applied filter, as Dovetail's
       * "Filtered by" pill and HubSpot's filter chips read it — the area as a
       * removable badge, the count, and the way back — and sticky so it is
       * there wherever the reader has scrolled. The sticky shell stays mounted at zero height so
       * the bar can grow in and collapse out with the house motion; it sits
       * outside the card stack so a closed bar takes no gap.
       */}
      {/* The report's scroller (RecordPage's panel, from `wide`) pads its top
          by 54px, and a sticky box pins inside that padding, so the bar pins
          54px higher, directly under the sticky report head (whose height the
          page publishes as `--report-head-h`). */}
      <div
        className={cn(
          'sticky top-[var(--report-head-h,0px)] z-[3] wide:top-[calc(var(--report-head-h,0px)-54px)]',
          // The canvas behind the bar is the report column's own width, no
          // wider: the score sits in the column beside it and must not be
          // painted over.
          'before:pointer-events-none before:absolute before:inset-x-0 before:inset-y-0 before:-z-10 before:bg-surface-canvas before:transition-shadow before:duration-fast motion-reduce:before:transition-none',
          // The lowest pinned bar casts the shadow, its bottom edge only.
          pinned &&
            narrowed &&
            'before:border-b before:border-solid before:border-[var(--core-color-border-divider)] before:shadow-elevation-control before:[clip-path:inset(0_0_-8px_0)]'
        )}
      >
        <Collapsible open={narrowed}>
          <div className="pb-4">
            <Toolbar
              role="status"
              aria-live="polite"
              // The data-table toolbar, as shadcn draws it: a neutral surface,
              // the applied filter as an outline badge, a hairline, the count
              // in muted text, and a ghost reset at the right. No tint: the
              // badge and the reset are what say "filtered".
              className="h-10 flex-nowrap gap-2 rounded-card border border-border bg-card px-2"
            >
              <ToolbarSection className="min-w-0 gap-2">
                <ListFilter
                  aria-hidden="true"
                  size={14}
                  strokeWidth={1.5}
                  className="ml-1 shrink-0 text-text-secondary"
                />
                <span className="whitespace-nowrap text-sm text-text-secondary">Filtered to</span>
                {focus && (
                  <Tag tone="default" onRemove={focus.onClear} removeLabel="Show full report">
                    {focus.name}
                  </Tag>
                )}
                <ToolbarSeparator />
                <ToolbarCount>
                  {shown.length} of {ordered.length} cards
                </ToolbarCount>
              </ToolbarSection>
              <ToolbarSpacer />
              <ActionButton
                variant="quiet"
                size="compact"
                onClick={focus?.onClear}
                leadingIcon={<X aria-hidden="true" size={14} strokeWidth={1.75} />}
              >
                Show full report
              </ActionButton>
            </Toolbar>
          </div>
        </Collapsible>
      </div>
      <div className="flex flex-col gap-4">
        {shown.map(({ card, rows }) => {
          /* The card a chip landed on opens: each strip on its first tile,
           keyed so it opens afresh each time it is led to. Narrowed to an
           area, the strips stay closed — the reader chose the area, not a
           tile, and picks which to open. */
          const open = expand?.card === card.id
          return (
            <StripExpand.Provider
              key={`${card.id}:${open ? `open-${focus?.id ?? ''}-${expand?.n ?? ''}` : ''}`}
              value={open}
            >
              <GroupCard
                id={card.id}
                title={card.label}
                count={tally[card.id]}
                visual={visual[card.id]}
                rows={rows}
                trailing={
                  card.id === 'name' &&
                  visual.name &&
                  // One name has nothing to lay out side by side.
                  namesShown.reduce((n, cell) => n + cell.values.length, 0) > 1 ? (
                    <NamesViewToggle value={namesView} onChange={setNamesView} />
                  ) : card.id === 'formation' && parts.strip ? (
                    <FilingsViewToggle value={filingsView} onChange={setFilingsView} />
                  ) : card.id === 'address' && visual.address ? (
                    <AddressViewToggle value={addressView} onChange={setAddressView} />
                  ) : card.id === 'website' && visual.website ? (
                    <WebViewToggle value={webView} onChange={setWebView} />
                  ) : card.id === 'people' && visual.people ? (
                    <PeopleViewToggle value={peopleView} onChange={setPeopleView} />
                  ) : undefined
                }
                record={record}
                negatives={negatives}
                revealed={revealed}
                onJumpToSource={onJumpToSource}
                hideInsights={hideInsights}
              />
            </StripExpand.Provider>
          )
        })}
      </div>
    </>
  )
}
