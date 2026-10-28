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
import { ArrowLeft, Check, ChevronDown, Download, LayoutGrid, Maximize2, Table2, Waypoints, X } from 'lucide-react'

import {
  ActionButton,
  ActionLink,
  ChatSourceChip,
  CopyButton,
  Dialog,
  Text,
  IconActionButton,
  Heading,
  MetaChip,
  SegmentedControl,
  SegmentedControlItem,
  Skeleton,
  DateTime,
  Input,
  Surface
} from '@/core'

import {
  longDate,
  maskTin,
  peopleByPerson,
  peopleRows,
  profileFields
} from '../../lib/attributes'
import type { BusinessRecord, Derived } from '../../lib/deriveResults'
import type { GroupId } from '../../lib/groups'
import { operationsOf } from '../../lib/operations'
import { REPORT_CARDS, cardAnchor, cardFor } from '../../lib/reportCards'
import { filingCardOf } from '../../lib/sourceInventory'
import { docCard, namedCard } from '../../lib/sourceCards'
import { dismissalOf, screenedOf } from '../../lib/screening'
import { capturedLabel, screenshotFor } from '../../lib/sourceScreenshots'
import { faviconFor } from '../../lib/sourceLabels'
import { registrationState, sameName } from '../../lib/registrationStatus'
import { stateName } from '../../lib/states'
import { CURRENT_USER } from '../../lib/user'
import { formatDate } from '../../lib/reportLabels'
import type { Kind } from '../../lib/timeline/types'
import { StatusDot } from '../StatusDot'

import { AttributeCells, type AttributeCell } from '../AttributeGrid'
import { attributeRowsByGroup } from '../AttributesTab'
import { cellsFromRows } from '../attributeCells'
import { cn } from '../../utils/twUtils'
import { formationParts } from '../FormationCard'
import { OtherFilings } from './OtherFilings'
import { FilingStrip, RegistrationFilterControl, RegistrationViewToggle, registrationCounts, type FilingsLayout, type RegistrationFilter } from './FilingStrip'
import { BusinessDetailsCard } from './BusinessDetailsCard'
import { GroupCard } from './GroupCard'
import { CardHeader } from '../CardHeader'
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
import { ConnectionsGraph } from './explorer/ConnectionsGraph'
import {
  defaultProvenance,
  ProvenanceControl,
  ResultGrid,
  ResultTable,
  StatusControl,
  type Provenance,
  type ResultRow,
  type StatusFilter
} from './ResultTable'
import { SubmittedChip } from '../Provenance'
import { CHIP_NO_GLYPH } from '../chipStyles'
import { BankruptcyTable, LienTable, LitigationTable, claimCounts } from './ClaimTables'
import { WebsiteDetails } from './WebsiteDetails'
import { useScreenshotViewer } from '../ScreenshotViewer'
import { confidentRelatedOf } from '../../lib/relatedBusinesses'
import { ShowAllRows, StripExpand } from './Strip'
import { missingInputs } from '../../lib/assessmentContext'
import { MediaScreen, PepScreen, WatchlistScreen, screenCounts } from './ScreeningCard'

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

/** Over the name, its kind, with its chip beside it: Verified, or where a
 *  found name is from. A submitted name not verified keeps its chip under. */
const NameHead = ({ cell, qualifier }: { cell: AttributeCell; qualifier?: string }) => (
  <span className="flex flex-wrap items-center gap-1.5">
    <NameLabel cell={cell} qualifier={qualifier} />
    {(!cell.submitted || cell.verified) && <NameSource cell={cell} />}
  </span>
)

/** A former name's head: "Former name", the filing that carried it beside it. */
const FormerHead = ({ cell, source }: { cell: AttributeCell; source?: ReactNode }) => (
  <span className="flex flex-wrap items-center gap-1.5">
    <NameLabel cell={cell} />
    {source}
  </span>
)

/** The name, marked as an address is: verified, or submitted with nothing to back it. */
const NameValue = ({ cell, value }: { cell: AttributeCell; value: ReactNode }) => (
  <span className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
    {value}
    {/* Verified, the Verified chip under it says so; only the amber mark stays. */}
    {cell.submitted && !cell.verified && (
      <span role="img" aria-label="Unverified" className="flex shrink-0">
        <StatusDot intent="warning" />
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
            {cell.key === 'former' ? (
              // A former name: its kind with its history chip beside it — the
              // change on the timeline, dated on hover — then the name.
              <span role="cell" className="grid min-w-0 gap-1">
                <FormerHead cell={cell} source={v.note} />
                <NameValue cell={cell} value={v.value} />
              </span>
            ) : (
              <span role="cell" className="grid min-w-0 gap-1">
                <NameHead cell={cell} qualifier={v.qualifier} />
                <NameValue cell={cell} value={v.value} />
                {cell.submitted && !cell.verified && <NameSource cell={cell} />}
                {(v.note ?? cell.note) && (
                  <span className="text-xs text-text-secondary">{v.note ?? cell.note}</span>
                )}
              </span>
            )}
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
          {/* Matched, the Verified chip beside it. */}
          <span className="flex flex-wrap items-center gap-1.5 text-caption text-text-secondary">
            {matchedBy ? (tin.name ?? '') : notIssued ? 'Not yet in the IRS database' : 'No match on the IRS record'}
            {matchedBy && <SubmittedChip verified />}
          </span>
          {/* The number, with the mark a verified value carries: green where the
              IRS matched it, amber where it did not. */}
          <span className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
            {maskTin(tin.tin)}
            {!matchedBy && (
              <span role="img" aria-label="Unverified" className="flex shrink-0">
                <StatusDot intent="warning" />
              </span>
            )}
          </span>
          {/* The customer's number, unmatched: Submitted. */}
          {!matchedBy && (
            <span className="mt-0.5 flex">
              <SubmittedChip plain />
            </span>
          )}
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

/**
 * No TIN submitted: the TIN Match assessment can't be read yet. The field as
 * the table would hold it, with what the assessment needs — absence as a
 * plain sentence, no chip.
 */
/** TIN Match's two ways to a TIN: Middesk finds it, or the reader submits it. */
export type TinActions = {
  /** When Middesk was asked to find it; absent, not asked. */
  requestedAt?: string
  onRequest: () => void
  onCancelRequest: () => void
  /** The TIN typed, nine digits: TIN Match is ordered with it. */
  onSubmit: (tin: string) => void
}

const TinMissing = ({ record, actions }: { record: BusinessRecord; actions?: TinActions }) => {
  const [typed, setTyped] = useState('')
  const digits = typed.replace(/\D/g, '')
  const valid = digits.length === 9
  return (
    <div role="table" aria-label="Tax ID" className="border-t border-[var(--core-color-border-divider)]">
      <div role="row" className="grid grid-cols-1 gap-y-3 px-4 py-3">
        <span role="cell" className="flex min-w-0 flex-col">
          <span className="text-caption text-text-secondary">TIN</span>
          <span className="text-sm text-text-primary">Not submitted</span>
          {actions?.requestedAt ? (
            <span className="mt-0.5 text-sm text-text-secondary">
              Middesk is finding the TIN — asked <DateTime relative>{actions.requestedAt}</DateTime>. TIN Match runs once it is found.
            </span>
          ) : (
            <span className="mt-0.5 text-sm text-text-secondary">{missingInputs('tin', record).join(' ')}</span>
          )}
        </span>
        {actions && (
          <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
            {/* Submit it: nine digits, the dash optional; it orders TIN Match with it. */}
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (valid) actions.onSubmit(digits)
              }}
            >
              <label className="flex flex-col gap-1">
                <span className="text-caption text-text-secondary">Submit the TIN</span>
                <Input
                  aria-invalid={typed.length > 0 && !valid}
                  className="w-40 tabular-nums"
                  inputMode="numeric"
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="12-3456789"
                  value={typed}
                />
              </label>
              <ActionButton disabled={!valid} size="compact" type="submit" variant="primary">
                Submit
              </ActionButton>
            </form>
            {/* Or let Middesk find it. */}
            {actions.requestedAt ? (
              <ActionButton onClick={actions.onCancelRequest} size="compact" variant="quiet">
                Cancel request
              </ActionButton>
            ) : (
              <ActionButton onClick={actions.onRequest} size="compact" variant="secondary">
                Let Middesk find it
              </ActionButton>
            )}
          </div>
        )}
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

/** The submitted website as a profile's source: the profile is the site's
 *  own — it names the site's domain as its website — so the site is where it
 *  came from, and the chip goes to it. */
const SiteSource = ({ url }: { url: string }) => (
  <ChatSourceChip
    sources={[
      {
        id: `site:${url}`,
        label: hostOf(url),
        domain: hostOf(url),
        title: hostOf(url),
        annotation: 'Submitted website',
        url,
        icon: (
          <img
            src={faviconFor(url)}
            alt=""
            className="size-3 rounded-xxs"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.visibility = 'hidden'
            }}
          />
        )
      }
    ]}
  />
)

/** Does the profile name this site as its website? The record keeps no list of
 *  the profiles a site links to, so the profile's own link back is the tie. */
const namesSite = (p: Profile, url: string) => {
  const m = (p.metadata ?? {}) as { website?: string; website_urls?: string[] }
  const domain = (u: string) => hostOf(u).split('/')[0].toLowerCase()
  return [m.website, ...(m.website_urls ?? [])].some((u) => Boolean(u) && domain(u!) === domain(url))
}

/** Over a site or profile, its kind, with where it came from beside it:
 *  Verified, the submitted site it hangs off, or Found. A submitted value not
 *  verified keeps its Submitted chip under the name. */
const WebCaption = ({ text, chip }: { text: ReactNode; chip?: ReactNode }) =>
  chip ? (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {text}
      {chip}
    </span>
  ) : (
    text
  )

const FoundChip = () => <Origin submitted={false} />

/** A site or profile's name, with the mark a submitted value carries after it:
 *  green where verified, amber where not. Found ones carry none. */
const WebTitle = ({ text, submitted, verified }: { text: ReactNode; submitted: boolean; verified: boolean }) => (
  <span className="inline-flex items-center gap-1.5">
    {text}
    {submitted && !verified && (
      <span role="img" aria-label="Unverified" className="flex shrink-0">
        <StatusDot intent="warning" />
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
          <MetaChip size="compact" tone={/online|active/i.test(status) ? 'success' : 'danger'}>
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

/** The results cards with a header filter, and their words for standing and cleared. */
const STATUS_CARDS: Record<string, { standing: string; cleared: string }> = {
  liens: { standing: 'Open', cleared: 'Closed' },
  litigation: { standing: 'Open', cleared: 'Closed' },
  bankruptcy: { standing: 'Open', cleared: 'Closed' },
  'screening-watchlist': { standing: 'Hits', cleared: 'Dismissed' },
  'screening-pep': { standing: 'Hits', cleared: 'Dismissed' },
  'screening-media': { standing: 'Hits', cleared: 'Dismissed' }
}

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
            caption: (
              <WebCaption
                text="Website"
                chip={!siteSubmitted ? <FoundChip /> : siteVerified ? <SubmittedChip verified /> : undefined}
              />
            ),
            title: <WebTitle text={hostOf(url)} submitted={siteSubmitted} verified={siteVerified} />,
            // Submitted and not verified: the Submitted chip, under it.
            sub: siteSubmitted && !siteVerified ? <Origin submitted verified={false} /> : undefined,
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
      // Beside it, where it came from: Verified; the submitted site that names
      // it; or Found, where nothing it can be linked to does.
      caption: (
        <WebCaption
          text={platformOf(p)}
          chip={
            (p as { submitted?: boolean }).submitted ? (
              /online|active/i.test(p.status ?? '') ? <SubmittedChip verified /> : undefined
            ) : url && siteSubmitted && namesSite(p, url) ? (
              <SiteSource url={url} />
            ) : (
              <FoundChip />
            )
          }
        />
      ),
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
      sub:
        (p as { submitted?: boolean }).submitted && !/online|active/i.test(p.status ?? '') ? (
          <Origin submitted verified={false} />
        ) : undefined,
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
      {/* The first few; the rest under "Show N more". */}
      <ResultGrid rows={rows} noneTitle={noneTitle} top={2} />
    </div>
  ) : (
    <ResultTable columns={['Platform', 'Status']} rows={rows} noneTitle={noneTitle} top={2} />
  )
}

type RegistrationDocument = NonNullable<BusinessRecord['documents']>[number]

/** "Domestic · California · Converted out": the filing a document came from,
 *  found by its state and name and the status the API gave the source. */
const filingCaption = (record: BusinessRecord, meta?: { state?: string; status?: string; name?: string }) => {
  if (!meta?.state) return ''
  const inState = record.registrations.filter((r) => r.state === meta.state)
  const reg =
    inState.find((r) => (r.status ?? '').toLowerCase() === (meta.status ?? '').toLowerCase() && (!meta.name || sameName(r.name, meta.name))) ??
    inState.find((r) => !meta.name || sameName(r.name, meta.name)) ??
    inState[0]
  if (!reg) return stateName(meta.state)
  const kind = /domestic/i.test(reg.jurisdiction ?? '') ? 'Domestic' : /foreign/i.test(reg.jurisdiction ?? '') ? 'Foreign' : ''
  const st = registrationState(reg)
  const standing = st.statusDetails && st.statusDetails !== st.status ? st.statusDetails : st.status
  return [kind, stateName(meta.state), standing].filter(Boolean).join(' · ')
}

/** A document's file, through the dev server's document endpoint. */
const docFile = (businessId: string, id: string, ext: 'pdf' | 'png') => `/documents/${id}.${ext}?b=${businessId}`

/**
 * A document, read in full: every page as an image, one under another, in a
 * dialog over the report — the in-app browser has no PDF viewer, and a link
 * to the PDF only downloads it. The file itself is the header's, top right.
 */
const DocumentViewer = ({
  businessId,
  doc,
  titleOf,
  onClose
}: {
  businessId: string
  doc: RegistrationDocument | null
  titleOf: (d: RegistrationDocument) => string
  onClose: () => void
}) => {
  const [pages, setPages] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)
  // The document being closed stays drawn while the dialog animates out:
  // cleared at once, its pages had no document to draw from, and the page
  // threw — blacking out the screen.
  const [shown, setShown] = useState(doc)
  useEffect(() => {
    if (doc) setShown(doc)
  }, [doc])
  const title = shown ? titleOf(shown) : ''
  useEffect(() => {
    if (!doc) return
    setPages(null)
    setFailed(false)
    fetch(`/documents/${doc.id}.json?b=${businessId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((m: { pages: number }) => setPages(m.pages))
      .catch(() => setFailed(true))
  }, [doc, businessId])
  return (
    <Dialog isOpen={Boolean(doc)} onClose={onClose} showHeader={false} size="lg" title={title}>
      {/* The dialog's own header, with the file at the top right beside the
          close: the core header's title area doesn't stretch to hold it. */}
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div className="grid min-w-0 gap-1">
          <Heading className="text-lg leading-7" level={2}>
            {title}
          </Heading>
          {shown?.filingDate && <Text tone="secondary">Filed {longDate(shown.filingDate.slice(0, 10))}</Text>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {shown && (
            <ActionLink download={shown.filename ?? undefined} href={docFile(businessId, shown.id, 'pdf')} leadingIcon={<Download aria-hidden="true" size={14} />} size="compact" variant="secondary">
              Download PDF
            </ActionLink>
          )}
          <IconActionButton aria-label="Close" onClick={onClose} type="button" variant="quiet">
            <X aria-hidden="true" size={16} strokeWidth={1.75} />
          </IconActionButton>
        </div>
      </div>
      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto bg-[var(--core-color-surface-subtle)] p-4">
        {failed ? (
          <p className="m-0 text-sm text-text-secondary">This document couldn't be shown. Download it to read it.</p>
        ) : pages === null ? (
          <Skeleton className="h-[640px] w-full" />
        ) : (
          shown &&
          Array.from({ length: pages }, (_, i) => (
            <img
              key={i}
              alt={`Page ${i + 1} of ${pages}`}
              className="block w-full rounded-control border border-border bg-card shadow-elevation-card"
              src={`/documents/${shown.id}-p${i + 1}.png`}
            />
          ))
        )}
      </div>
    </Dialog>
  )
}

/** A document's first page, and the way to the file. Fetched once through the
 *  dev server's document endpoint (`scripts/document-endpoint.ts`), then kept. */
const DocumentPreview = ({ businessId, doc, onView }: { businessId: string; doc: RegistrationDocument; onView: () => void }) => {
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const file = (ext: 'pdf' | 'png') => docFile(businessId, doc.id, ext)
  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      {/* The file first, then its first page. */}
      <div className="flex flex-wrap items-center gap-2">
        <ActionLink download={doc.filename ?? undefined} href={file('pdf')} leadingIcon={<Download aria-hidden="true" size={14} />} size="compact" variant="secondary">
          Download PDF
        </ActionLink>
        <ActionButton leadingIcon={<Maximize2 aria-hidden="true" size={14} />} onClick={onView} size="compact" type="button" variant="quiet">
          View
        </ActionButton>
      </div>
      {state !== 'failed' ? (
        <button
          aria-label="View the document"
          className="relative block max-h-[420px] w-full overflow-hidden rounded-control border border-border bg-card text-left"
          onClick={onView}
          type="button"
        >
          {state === 'loading' && <Skeleton className="h-[320px] w-full rounded-none" />}
          <img
            alt={`First page of ${doc.filename ?? 'the document'}`}
            className={cn('block w-full', state === 'loading' && 'hidden')}
            onError={() => setState('failed')}
            onLoad={() => setState('ready')}
            src={file('png')}
          />
          {/* The page runs on below the fold; the file has it all. */}
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--core-color-surface-card)] to-transparent" />
        </button>
      ) : (
        <span className="text-sm text-text-secondary">No preview could be made for this document.</span>
      )}
    </div>
  )
}

/**
 * The Secretary of State documents on the record — the Articles (initial
 * filing), a Certificate of Good Standing, amendments: what document
 * retrieval finds. A lien's own filings stay with the Liens card. The other
 * table cards' table: what it is, the filing it came from above, when it was
 * filed under; a row opens to its first page and the download.
 * The analyst's own uploads follow, kept by the dev server like the rest.
 */
const DocumentsCard = ({
  record,
  retrieved,
  uploads,
  withheld = false
}: {
  record: BusinessRecord
  retrieved: ReadonlySet<string>
  /** Held back until retrieved: only the ones a step brought are shown. */
  withheld?: boolean
  uploads: Array<{ id: string; name: string; from?: 'analyst' | 'applicant'; at?: string; email?: string }>
}) => {
  const [viewing, setViewing] = useState<RegistrationDocument | null>(null)
  const typeOf = (d: RegistrationDocument) => {
    const t = (d.documentType ?? 'Document').replace(/_/g, ' ')
    return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
  }
  const docs = (record.documents ?? [])
    .filter((d) => d.source?.type === 'registration' && (!withheld || retrieved.has(d.id)))
    .sort((a, b) => (b.filingDate ?? '').localeCompare(a.filingDate ?? ''))
  const rows: ResultRow[] = [
    ...docs.map((d) => {
      const meta = (d.source as { metadata?: { state?: string; status?: string } } | null)?.metadata
      return {
        key: d.id,
        // The filing it came from, as the Registrations card names it — which
        // California filing, and its standing in the registry's own words.
        caption: filingCaption(record, meta),
        title: typeOf(d),
        // Under its name, when it was filed — not the file's name.
        sub: (
          <>
            {d.filingDate ? `Filed ${longDate(d.filingDate.slice(0, 10))}` : 'Filing date not stated'}
            {retrieved.has(d.id) && <span>· Retrieved by the document agent</span>}
          </>
        ),
        cleared: false,
        // View and Download are in the expansion, over the first page.
        detail: <DocumentPreview businessId={record.id} doc={d} onView={() => setViewing(d)} />
      }
    }),
    // The analyst's own: kept files, viewed and downloaded like any other.
    ...uploads.map((u) => {
      const doc: RegistrationDocument = {
        id: u.id,
        documentType: u.name.replace(/\.pdf$/i, ''),
        filename: u.name,
        contentType: 'application/pdf',
        filingDate: null,
        source: null,
        createdAt: null
      }
      return {
        key: u.id,
        caption: u.from === 'applicant' ? 'Provided by applicant' : 'Uploaded',
        title: u.name,
        sub: (
          <>
            {u.from === 'applicant'
              ? `Provided${u.at ? ` ${formatDate(u.at)}` : ''} by ${u.email ?? 'the applicant'}`
              : `Uploaded${u.at ? ` ${formatDate(u.at)}` : ''} by ${CURRENT_USER}`}
          </>
        ),
        cleared: false,
        detail: <DocumentPreview businessId={record.id} doc={doc} onView={() => setViewing(doc)} />
      }
    })
  ]
  if (rows.length === 0) return null
  return (
    <Surface id={cardAnchor('documents')} variant="card" padding="none" className="scroll-mt-6 overflow-hidden" role="region" aria-label={`Documents, ${rows.length}`}>
      <CardHeader
        className="border-b-0"
        title={
          <>
            Documents <span className="tabular-nums text-text-secondary">{rows.length}</span>
          </>
        }
      />
      <ResultTable columns={['Document', '']} rows={rows} />
      <DocumentViewer businessId={record.id} doc={viewing} onClose={() => setViewing(null)} titleOf={typeOf} />
    </Surface>
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
  view,
  tinActions,
  onJumpToSource,
  onJumpToTimeline,
  documents,
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
  /** An insight just followed: its card, and the header filter that shows
   *  what it found — Inactive filings, Open liens, Hits. `n` counts the asks. */
  view?: { card: string; filter?: RegistrationFilter | StatusFilter; lead?: boolean; n: number }
  /** No TIN on file: TIN Match's two ways to one. */
  tinActions?: TinActions
  onJumpToSource?: (cardId: string) => void
  onJumpToTimeline?: (eventId: string, kinds?: Kind[]) => void
  /** Narrowed to an area: its insights are listed under the area, not in the cards. */
  hideInsights?: boolean
  /** Documents a next step retrieved (by id), and the analyst's uploads. */
  documents?: { retrieved: ReadonlySet<string>; withheld?: boolean; uploads: Array<{ id: string; name: string; from?: 'analyst' | 'applicant'; at?: string; email?: string }> }
}) => {
  // The Addresses card's display — table, grid or map — chosen in its header.
  const [addressView, setAddressView] = useState<AddressView>('table')
  const [peopleView, setPeopleView] = useState<PeopleViewMode>('list')
  // The map over the list: one view. The header filters it and switches the map.
  const filingsView: FilingsLayout = 'list'
  const [regFilter, setRegFilter] = useState<RegistrationFilter>('all')
  // The list alone by default; the map is one click away in the header.
  const [regMap, setRegMap] = useState(false)
  const [namesView, setNamesView] = useState<NamesView>('table')
  const statusCountsOf = (card: string) =>
    card === 'liens' || card === 'litigation' || card === 'bankruptcy'
      ? claimCounts(record, card, searchedNames(record, card))
      : screenCounts(record, card.replace('screening-', '') as 'watchlist' | 'pep' | 'media')
  // Related businesses: the list alone by default; the graph over it when switched on.
  const [relGraph, setRelGraph] = useState(false)
  // A related business picked, in the list or on the graph: the graph narrows to it.
  const [relPick, setRelPick] = useState<string | null>(null)
  const pickRelated = (id: string | null) => {
    setRelPick(id)
    if (id) setRelGraph(true)
  }
  // The results cards' header filters — All, Open, Closed; All, Hits, Dismissed — by card.
  const [statusBy, setStatusBy] = useState<Record<string, StatusFilter>>({})
  const statusOf = (card: string) => statusBy[card] ?? 'all'
  // An insight, followed: its card's header filter set to what it found.
  // The registrations narrowed to the domestic filing alone — an insight about it, followed.
  const [regLeadOnly, setRegLeadOnly] = useState(false)
  const pickRegFilter = (next: RegistrationFilter) => {
    setRegFilter(next)
    setRegLeadOnly(false)
  }
  useEffect(() => {
    if (view?.card === 'formation') setRegLeadOnly(Boolean(view.lead))
    if (!view?.filter) return
    if (view.card === 'formation') setRegFilter(view.filter as RegistrationFilter)
    else if (STATUS_CARDS[view.card]) setStatusBy((by) => ({ ...by, [view.card]: view.filter as StatusFilter }))
  }, [view])
  // Web presence is a table only: no grid, no switch.
  const webView: WebView = 'table'
  // The Names and People cards' filter: whose — submitted, found, or former.
  const [namesWho, setNamesWho] = useState<Provenance>()
  const [peopleWho, setPeopleWho] = useState<Provenance>()
  const parts = useMemo(
    () => formationParts(record, results, groupFor, onJumpToSource, onJumpToTimeline),
    [record, results, groupFor, onJumpToSource, onJumpToTimeline]
  )
  // The names by whose they are: the submitted one, and every other name the
  // records found — former names among them. Counted by name, not by row.
  const nameCells = {
    submitted: parts.names.filter((cell) => cell.key !== 'former' && cell.submitted),
    found: parts.names.filter((cell) => cell.key === 'former' || !cell.submitted)
  }
  const nameCounts = {
    submitted: nameCells.submitted.reduce((n, c) => n + c.values.length, 0),
    found: nameCells.found.reduce((n, c) => n + c.values.length, 0)
  }
  const namesFilter = namesWho ?? defaultProvenance()
  const namesShown = namesFilter === 'submitted' || namesFilter === 'found' ? nameCells[namesFilter] : parts.names
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
  const peopleCounts = {
    submitted: people.filter((r) => r.submitted).length,
    found: people.filter((r) => !r.submitted).length
  }
  const peopleFilter = peopleWho ?? defaultProvenance()

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
    // Every related business the list holds, likely and possibly alike.
    connections: (record.connections ?? []).length,
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
              cell.values.map((v, i) =>
                cell.key === 'former'
                  ? {
                      // As in the table: kind and its history chip, then the name.
                      key: `${cell.key}-${v.key ?? i}`,
                      label: cell.label,
                      labelNode: <FormerHead cell={cell} source={v.note} />,
                      values: [{ value: <NameValue cell={cell} value={v.value} /> }]
                    }
                  : {
                      key: `${cell.key ?? c}-${v.key ?? i}`,
                      label: [cell.label, v.qualifier].filter(Boolean).join(' · '),
                      labelNode: <NameHead cell={cell} qualifier={v.qualifier} />,
                      values: [
                        {
                          value: (
                            <span className="grid gap-1">
                              <NameValue cell={cell} value={v.value} />
                              {cell.submitted && !cell.verified && <NameSource cell={cell} />}
                            </span>
                          ),
                          note: v.note ?? cell.note
                        }
                      ]
                    }
              )
            )}
          />
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
              kindFilter={regFilter}
              onKindFilter={pickRegFilter}
              leadOnly={regLeadOnly}
              onShowAll={() => setRegLeadOnly(false)}
              showMap={regMap}
              // A filing's row opens its Secretary of State card in Sources.
              onOpenFiling={onJumpToSource ? (r) => onJumpToSource(filingCardOf(parts.strip!.record, r)) : undefined}
              // A city's row opens its registration's card: the open one's record,
              // else the latest; with no record behind it, the city registrations' card.
              onOpenCity={
                onJumpToSource
                  ? (here) => {
                      const withRef = here.filter((r) => r.refId)
                      const pick =
                        withRef.find((r) => !r.locationEnd && !r.businessEnd) ??
                        [...withRef].sort((a, b) => (b.locationStart ?? '').localeCompare(a.locationStart ?? ''))[0]
                      onJumpToSource(pick?.refId ? docCard(pick.refId) : namedCard('City registration'))
                    }
                  : undefined
              }
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
    // Not submitted, the card still stands: its assessment says what it needs.
    tin: parts.tin ? <TinTable record={record} /> : missingInputs('tin', record).length ? <TinMissing actions={tinActions} record={record} /> : undefined,
    // As the Addresses card draws its places: a strip per kind, a chip per
    // person, their cell under the strip when picked.
    people:
      people.length > 0 ? (
        <PeopleView
          view={peopleView}
          who={peopleFilter}
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
      (record.connections ?? []).length > 0 ? (
        <>
          {/* The relationship graph over the list, in the card, as the
              Registrations map sits over its table. */}
          {relGraph && (
            <div className="border-t border-[var(--core-color-border-divider)] px-4 py-3">
              <ConnectionsGraph
                record={record}
                only={relPick}
                onShowAll={() => setRelPick(null)}
                onSelectBusiness={(c) => c.id && pickRelated(c.id)}
              />
            </div>
          )}
          <RelatedBusinesses record={record} selected={relPick} onSelect={pickRelated} />
        </>
      ) : undefined,
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
      <WatchlistScreen record={record} onJumpToSource={onJumpToSource} status={statusOf('screening-watchlist')} />
    ) : undefined,
    'screening-pep': screens.pep.ran ? (
      <PepScreen record={record} onJumpToSource={onJumpToSource} status={statusOf('screening-pep')} />
    ) : undefined,
    'screening-media': screens.media.ran ? (
      <MediaScreen record={record} onJumpToSource={onJumpToSource} status={statusOf('screening-media')} />
    ) : undefined,
    // As the Addresses card reads its places: a row per record, the closed
    // folding under "None found" where nothing is open — and none on file is
    // itself "None found", with what was searched under it.
    liens: (
      <LienTable
        status={statusOf('liens')}
        record={record}
        onJumpToSource={onJumpToSource}
        none={searchedLine(record, 'liens')}
        searched={searchedNames(record, 'liens')}
        noneTitle={noneTitleFor(record, 'liens')}
      />
    ),
    litigation: (
      <LitigationTable
        status={statusOf('litigation')}
        record={record}
        onJumpToSource={onJumpToSource}
        none={searchedLine(record, 'litigation')}
        searched={searchedNames(record, 'litigation')}
        noneTitle={noneTitleFor(record, 'litigation')}
      />
    ),
    bankruptcy: (
      <BankruptcyTable
        status={statusOf('bankruptcy')}
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
  /* The screens read as one run at the report's head: what still stands
     first — a hit — then what was only dismissed, then what came back clear,
     each in the run's own order (Sanctions, PEP, Adverse media). */
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
  // The screens, first in the report (`REPORT_CARDS`), read with any hit first;
  // liens, litigation and bankruptcy keep their place further down.
  const COMPLIANCE = ['screening-watchlist', 'screening-pep', 'screening-media']
  const inRun = ({ card }: (typeof byResults)[number]) => COMPLIANCE.includes(card.id)
  const run = byResults
    .filter(inRun)
    .sort(
      (x, y) =>
        foundRank(x.card.id) - foundRank(y.card.id) ||
        COMPLIANCE.indexOf(x.card.id) - COMPLIANCE.indexOf(y.card.id)
    )
  const rest = byResults.filter((x) => !inRun(x))
  // Always first, found or clear: a clean screen is itself the answer.
  const drawn = [...run, ...rest]
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
  const docsCard = (
    <DocumentsCard record={record} retrieved={documents?.retrieved ?? new Set()} uploads={documents?.uploads ?? []} withheld={documents?.withheld} />
  )

  return (
    <>
      {/* Narrowed to some of its cards: a tab on the first card, in the
          Assistant's midnight, as its box's context tab is drawn — top corners
          rounded, its foot laid over the card's top rule so the two read as
          one shape. It widens the report back. Above its card only (z 1),
          under the page's pinned head (z 5) as the report scrolls. */}
      {narrowed && focus && (
        <button
          className={cn(
            'relative z-[1] -mb-0.5 ml-3 flex w-fit items-center gap-1.5 rounded-t-card border border-b-0 border-solid px-2.5 pb-1.5 pt-1 text-caption leading-4',
            'border-[var(--core-color-interactive-default)] bg-[var(--core-color-interactive-default)] text-[var(--core-color-text-inverse)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          )}
          onClick={focus.onClear}
          type="button"
        >
          Show full report
          <X aria-hidden="true" className="opacity-80" size={12} strokeWidth={1.75} />
        </button>
      )}
      <div className="flex flex-col gap-4">
        {/* The business at a glance, over the cards — as the dashboard's
            Business details card heads its page. Only on the whole report and
            on an assessment that reads the business's identity. */}
        {(!only || only.has('name') || only.has('formation')) && <BusinessDetailsCard onJumpToSource={onJumpToSource} record={record} results={results} />}
        {shown.map(({ card, rows }) => {
          /* The card a chip landed on opens: each strip on its first tile,
           keyed so it opens afresh each time it is led to. Narrowed to an
           area, the strips stay closed — the reader chose the area, not a
           tile, and picks which to open. */
          const open = expand?.card === card.id
          return (
            <Fragment key={card.id}>
            <StripExpand.Provider
              key={`${card.id}:${open ? `open-${focus?.id ?? ''}-${expand?.n ?? ''}` : ''}`}
              value={open}
            >
              {/* Followed to from an insight: everything it found, unfolded. */}
              <ShowAllRows.Provider value={open && view?.card === card.id}>
              <GroupCard
                id={card.id}
                title={card.label}
                count={tally[card.id]}
                visual={visual[card.id]}
                rows={rows}
                // The view — table or grid, list, map or graph — at the header's edge.
                trailing={
                  card.id === 'name' &&
                  visual.name &&
                  // One name in all has nothing to lay out side by side; the toggle
                  // stays put as the filter changes.
                  nameCounts.submitted + nameCounts.found > 1 ? (
                    <NamesViewToggle value={namesView} onChange={setNamesView} />
                  ) : card.id === 'formation' && parts.strip ? (
                    <RegistrationViewToggle showMap={regMap} onShowMap={setRegMap} />
                  ) : card.id === 'address' && visual.address ? (
                    <AddressViewToggle value={addressView} onChange={setAddressView} />
                  ) : card.id === 'connections' && (record.connections ?? []).length > 0 ? (
                    // The view, list first: the list alone, or the graph over it.
                    <SegmentedControl
                      size="sm"
                      aria-label="Related businesses display"
                      value={relGraph ? 'graph' : 'list'}
                      onValueChange={(v) => v && setRelGraph(v === 'graph')}
                    >
                      <SegmentedControlItem
                        value="list"
                        aria-label="List only"
                        className="!px-2"
                        icon={<Table2 aria-hidden="true" size={14} strokeWidth={1.75} />}
                      />
                      <SegmentedControlItem
                        value="graph"
                        aria-label="Graph and list"
                        className="!px-2"
                        icon={<Waypoints aria-hidden="true" size={14} strokeWidth={1.75} />}
                      />
                    </SegmentedControl>
                  ) : card.id === 'people' && visual.people ? (
                    <PeopleViewToggle value={peopleView} onChange={setPeopleView} />
                  ) : undefined
                }
                // The filter — which of them to show — under the title.
                controls={
                  card.id === 'name' && parts.names.length > 0 ? (
                    <ProvenanceControl counts={nameCounts} label="names" onChange={setNamesWho} value={namesFilter} />
                  ) : card.id === 'people' && people.length > 0 ? (
                    <ProvenanceControl counts={peopleCounts} label="people" onChange={setPeopleWho} value={peopleFilter} />
                  ) : card.id === 'formation' && parts.strip ? (
                    <RegistrationFilterControl
                      counts={registrationCounts(parts.strip.record, parts.strip.lead, parts.city)}
                      value={regFilter}
                      onChange={pickRegFilter}
                    />
                  ) : STATUS_CARDS[card.id] && statusCountsOf(card.id).all > 0 ? (
                    // With results, which: All, then Open and Closed, or Hits and Dismissed.
                    <StatusControl
                      counts={statusCountsOf(card.id)}
                      labels={STATUS_CARDS[card.id]}
                      value={statusOf(card.id)}
                      onChange={(v) => setStatusBy((by) => ({ ...by, [card.id]: v }))}
                    />
                  ) : undefined
                }
                record={record}
                negatives={negatives}
                revealed={revealed}
                onJumpToSource={onJumpToSource}
                hideInsights={hideInsights}
              />
              </ShowAllRows.Provider>
            </StripExpand.Provider>
            {/* Documents a next step retrieved or the analyst added, under the filings they settle. */}
            {card.id === 'formation' && docsCard}
            </Fragment>
          )
        })}
        {/* No Registrations card in this assessment: shown only once a step brought documents. */}
        {!shown.some(({ card }) => card.id === 'formation') && (documents?.retrieved.size || documents?.uploads.length) ? docsCard : null}
      </div>
    </>
  )
}
