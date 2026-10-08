import {
  cloneElement,
  Fragment,
  isValidElement,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'
import { ChevronDown, LayoutGrid, ListFilter, Table2, X } from 'lucide-react'

import {
  ActionButton,
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
import { AddressViewToggle, type AddressView } from './AddressTable'
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
import { BankruptcyTable, LienTable, LitigationTable } from './ClaimTables'
import { WebsiteDetails } from './WebsiteDetails'
import { useScreenshotViewer } from '../ScreenshotViewer'
import { relatedBusinessesOf } from '../../lib/relatedBusinesses'
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
          'hidden gap-x-4 border-b border-[var(--core-color-border-divider)] px-4 py-2.5 md:grid',
          cols
        )}
      >
        {['TIN', 'Type'].map((h) => (
          <span
            key={h}
            role="columnheader"
            className="text-caption font-medium uppercase tracking-wide text-text-secondary"
          >
            {h}
          </span>
        ))}
      </div>
      <div
        role="row"
        className={cn('grid grid-cols-1 items-center gap-x-4 gap-y-1 px-4 py-3', cols)}
      >
        <span role="cell" className="grid min-w-0 gap-1">
          <span className="text-sm font-medium text-text-primary">{maskTin(tin.tin)}</span>
          <span className="text-xs text-text-secondary">
            {matchedBy
              ? (tin.name ?? '—')
              : notIssued
                ? 'Not yet in the IRS database. Newly formed businesses can take several weeks to appear after their EIN is assigned.'
                : 'No match on the IRS record'}
          </span>
        </span>
        <span role="cell">
          {matchedBy ? (
            <MetaChip size="compact">
              {/business/i.test(matchedBy) ? 'Business' : 'Individual'}
            </MetaChip>
          ) : (
            <span className="text-sm text-text-secondary">—</span>
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

const StatusChips = ({ status }: { status?: string | null }) => (
  <span className="flex flex-wrap items-center gap-1.5">
    <MetaChip size="compact">Found</MetaChip>
    {status && (
      <MetaChip size="compact" tone={/online|active/i.test(status) ? 'success' : 'warning'}>
        {titleCase(status)}
      </MetaChip>
    )}
  </span>
)

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
  const { open } = useScreenshotViewer()
  const shot = screenshotFor(profile.url ?? undefined, platformOf(profile))
  const cell = (label: string, value: ReactNode, note?: ReactNode): AttributeCell => ({
    key: label,
    label,
    values: [{ value, note }]
  })
  // The platform's id and the handle (already in the link) are plumbing.
  const meta = Object.entries(profile.metadata ?? {}).filter(
    ([k, v]) =>
      !['external_id', 'handle'].includes(k) &&
      v !== null &&
      v !== '' &&
      (typeof v !== 'object' || Array.isArray(v))
  )
  const items: AttributeCell[] = [
    ...(profile.url ? [cell('Link', <WebLink row={{ label: 'Link', href: profile.url }} />)] : []),
    ...(profile.name ? [cell('Name on profile', profile.name)] : []),
    ...profileFields(profile).map((f) => cell(f.label ?? 'Detail', f.value)),
    ...((profile.categories ?? []).length > 0
      ? [cell('Categories', (profile.categories ?? []).join(', '))]
      : []),
    cell(
      'Screenshot',
      shot ? (
        <button
          type="button"
          aria-label={`View screenshot: ${shot.alt}`}
          onClick={() => open(shot)}
          className="block h-24 w-36 overflow-hidden rounded-control border border-border transition-opacity duration-fast hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <img src={shot.src} alt="" className="block h-full w-full object-cover object-top" />
        </button>
      ) : (
        <span className="text-text-secondary">No image</span>
      ),
      shot ? capturedLabel(shot.capturedAt) : undefined
    ),
    ...meta.map(([k, v]) => cell(titleCase(k), Array.isArray(v) ? v.join(', ') : String(v)))
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
  view
}: {
  url?: string | null
  status?: string | null
  profiles: Profile[]
  analysis: ReactNode
  view: WebView
}) => {
  const rows: ResultRow[] = [
    ...(url
      ? [{ key: 'site', caption: 'Website', title: hostOf(url), chips: <StatusChips status={status} />, cleared: false, detail: analysis }]
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
      title: [p.name || platformOf(p), handleOf(p)].filter(Boolean).join(' · '),
      chips: <StatusChips status={p.status} />,
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
    connections: relatedBusinessesOf(record).length,
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
  /* The compliance checks read as one run, in a fixed order: Sanctions, PEP,
     Adverse media, then Liens, Litigation, Bankruptcy — the screens above the
     public record. The run sits with what was found where any of it found
     something, at the end where none did. */
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
    .sort((x, y) => COMPLIANCE.indexOf(x.card.id) - COMPLIANCE.indexOf(y.card.id))
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
