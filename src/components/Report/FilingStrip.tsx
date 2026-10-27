import {
  Fragment,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode
} from 'react'
import * as RadixTooltip from '@radix-ui/react-tooltip'
import {
  Check,
  CircleOff,
  FilePenLine,
  ClockAlert,
  History,
  MapPin,
  Minus,
  ShieldCheck,
  X,
  List,
  Map as MapIcon,
  Landmark,
  Table2,
  ChevronDown
} from 'lucide-react'

import {
  ActionButton,
  IconActionButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  MetaChip,
  MutedText,
  Text,
  type MetaChipTone,
  SegmentedControl,
  SegmentedControlItem
} from '@/core'

import type { BusinessRecord } from '../../lib/deriveResults'
import { formatDate } from '../../lib/reportLabels'
import {
  NOT_PROVIDED,
  newDetails,
  registrationState,
  subStatusLabel,
  troubled,
  type Registration
} from '../../lib/registrationStatus'
import { stateName } from '../../lib/states'
import { cityLngLat } from '../../lib/cityCoordinates'
import { cn } from '../../utils/twUtils'
import { StripExpand } from './Strip'
import { canonicalRole, nameKey } from '../../lib/attributes'
import { AttributeCells, type AttributeCell } from '../AttributeGrid'
import { Collapsible } from '../Collapsible'
import { FormationIcon } from './FormationIcon'
import { StateFilingsMap } from './StateFilingsMap'
import { SubmittedChip } from '../Provenance'
import {
  CityRegistrationCell,
  CityRegistrationDetail,
  CityRegistrationRow,
  CityTooltip,
  cityName,
  isOpen,
  registrationsOf,
  SourceDataMark
} from './CityStrip'

type Kind = 'active' | 'inactive' | 'none'

/** Active, inactive, or nothing published — the three a filing can say. */
const kindOf = (reg: Registration): Kind =>
  /^active$/i.test(reg.status ?? '')
    ? 'active'
    : /^inactive$/i.test(reg.status ?? '')
      ? 'inactive'
      : 'none'

const WORD: Record<Kind, string> = {
  active: 'Active',
  inactive: 'Inactive',
  none: 'No status published'
}

/** The chip's tone, by the semantic prop — the chip maps the colour. A
 *  state's tone is its current filing's: other filings beside it are its
 *  history, not a disagreement. */
const TONE: Record<Kind, MetaChipTone> = {
  active: 'success',
  inactive: 'danger',
  none: 'neutral'
}

/** A filing's tone: its status's, except an active filing the state has
 *  started taking away — Indiana's "Pending Admin Dissolution" under a
 *  pending inactive sub status — which reads red, not green. The standing
 *  table decides, not the words (`troubled`). */
const toneOf = (reg: Registration): MetaChipTone => (troubled(reg) ? 'danger' : TONE[kindOf(reg)])

/** The selected tile, inverted: its tone's strong colour as the fill and the
 *  card's colour as the text, so the one open reads at a glance among twenty
 *  tinted ones. A ring around a chip in a grid of chips read as a focus
 *  outline, not a choice. */
export const selectedStyle = (tone: MetaChipTone) =>
  ({
    '--core-badge-bg': `var(--core-color-status-${tone}-fg)`,
    '--core-badge-border': `var(--core-color-status-${tone}-fg)`,
    '--core-badge-fg': 'var(--core-color-surface-card)'
  }) as CSSProperties

/** Absence is not a chip (PARITY.md): a state that publishes no status keeps
 *  the chip's geometry but drops its fill for a dashed outline — the
 *  `StateMark` ring's grammar, one level up. */
const ABSENT =
  '!bg-transparent !border-dashed !border-[var(--core-color-border-strong)] !text-text-secondary'

/** The sub status, as an icon where there is one to say; else the status's. */
const Icon = ({ reg, kind }: { reg?: Registration; kind: Kind }) => {
  const sub = (reg?.subStatus ?? '').toUpperCase()
  const props = {
    'aria-hidden': true,
    size: 12,
    strokeWidth: 2,
    className: 'shrink-0'
  } as const
  if (sub === 'GOOD_STANDING') return <ShieldCheck {...props} />
  if (sub === 'DISSOLVED') return <CircleOff {...props} />
  if (sub === 'PENDING_INACTIVE') return <ClockAlert {...props} />
  if (kind === 'active') return <Check {...props} />
  if (kind === 'inactive') return <X {...props} />
  return <Minus {...props} />
}

/** The most recently registered of a state's filings is marked "(Latest)"
 *  after its date — a fact of the dates, where "current" or "past" would be
 *  a reading the record does not make. It need not be the one that leads:
 *  Change.org's active California filing is from 2006, a terminated one 2010. */
const VersionTag = ({ latest }: { latest: boolean }) =>
  latest ? <span className="text-text-secondary">(Latest)</span> : null

/**
 * A state's filings: the one that stands now, and the rest.
 *
 * `current` is the active filing (the newest, if several), else the newest
 * whatever its status. Everything else is `others`, newest first. In every
 * state that holds more than one, the others read as history: Checkr's Utah
 * domestic expired the day its foreign filing was made; Zendesk's revoked
 * registrations sit behind the ones it re-filed.
 */
type StateGroup = {
  state: string
  current: Registration
  others: Registration[]
  kind: Kind
}

const byNewest = (a: Registration, b: Registration) =>
  (b.registrationDate ?? '').localeCompare(a.registrationDate ?? '')

/** One filing listed twice — Zendesk's Alabama `409355` and `000409355`, the
 *  same date — is one filing: the same date and the same number once its
 *  leading zeros go. */
const dedupe = (filings: Registration[]): Registration[] => {
  const seen = new Set<string>()
  return filings.filter((f) => {
    const k = `${f.registrationDate ?? ''}|${(f.fileNumber ?? '').replace(/^0+/, '') || f.fileNumber}`
    if (!f.fileNumber || !seen.has(k)) {
      seen.add(k)
      return true
    }
    return false
  })
}

// The formation filing is not forced current: its details are pinned above
// the strip, and Alliance Transfer's New York tile reads as its active 2007
// filing, not the 1976 formation that lapsed.
const groupOf = (state: string, all: Registration[]): StateGroup => {
  const filings = [...dedupe(all)].sort(byNewest)
  const current = filings.find((f) => kindOf(f) === 'active') ?? filings[0]
  return {
    state,
    current,
    others: filings.filter((f) => f !== current),
    kind: kindOf(current)
  }
}

/**
 * The filing's status and sub status as chips, in the tiles' own grammar:
 * the tone and the icon a tile carries, with the words. A state that
 * publishes neither keeps the dashed outline and the dash — it is said, not
 * dropped. The status details stay text: they are the registry's own words.
 */
const chipIcon = {
  'aria-hidden': true,
  size: 12,
  strokeWidth: 2,
  className: 'shrink-0'
} as const
export const StatusChip = ({ reg }: { reg: Registration }) => {
  const kind = kindOf(reg)
  const st = registrationState(reg)
  return (
    <MetaChip tone={toneOf(reg)} size="compact" className={cn(kind === 'none' && ABSENT)}>
      {kind === 'active' ? (
        <Check {...chipIcon} />
      ) : kind === 'inactive' ? (
        <X {...chipIcon} />
      ) : (
        <Minus {...chipIcon} />
      )}
      {st.status ?? NOT_PROVIDED}
    </MetaChip>
  )
}
export const SubStatusChip = ({ reg }: { reg: Registration }) => {
  const sub = registrationState(reg).subStatus
  const good = Boolean(sub && /good standing/i.test(sub) && !/not/i.test(sub))
  const tone: MetaChipTone = !sub
    ? 'neutral'
    : good
      ? 'success'
      : 'danger'
  return (
    <MetaChip tone={tone} size="compact" className={cn(!sub && ABSENT)}>
      {!sub ? (
        <Minus {...chipIcon} />
      ) : good ? (
        <ShieldCheck {...chipIcon} />
      ) : /pending/i.test(sub) ? (
        <ClockAlert {...chipIcon} />
      ) : /dissolv/i.test(sub) ? (
        <CircleOff {...chipIcon} />
      ) : (
        <X {...chipIcon} />
      )}
      {subStatusLabel(reg)}
    </MetaChip>
  )
}

/** A list the filing carries none of, in the grey an absent value takes. */
const NONE_LISTED = <span className="text-text-secondary">None listed</span>

type ListItem = { primary: string; secondary?: string; submitted?: boolean }

/** An address, compared as the same place however it is written: case,
 *  punctuation and the ZIP+4 extension aside. */
const addressKey = (a: string) =>
  a
    .toLowerCase()
    .replace(/(\d{5})-\d{4}/, '$1')
    .replace(/[^a-z0-9]/g, '')

/** A filing's officers, once each, with their roles as the filing states
 *  them — one name per role (`canonicalRole`). */
const officersOf = (f: Registration, submittedPeople: Set<string>): ListItem[] => {
  // A filing repeats a person once per role — Checkr's Utah filing lists
  // Daniel Yanisse as director, president and chief executive in three rows.
  // One person is one line, their roles together under the name.
  const byName = new Map<string, { name: string; roles: string[] }>()
  const rows =
    (f.officerRoles ?? []).length > 0
      ? (f.officerRoles ?? [])
      : (f.officers ?? []).map((name) => ({ name, roles: [] }))
  for (const o of rows) {
    const k = nameKey(o.name)
    const entry = byName.get(k) ?? { name: o.name, roles: [] }
    entry.roles.push(...o.roles.map(canonicalRole))
    byName.set(k, entry)
  }
  return [...byName.values()].map((o) => ({
    primary: o.name,
    secondary: o.roles.length ? [...new Set(o.roles)].join(', ') : undefined,
    submitted: submittedPeople.has(nameKey(o.name))
  }))
}

/**
 * A run of values in one grid cell — a filing's officers, its addresses —
 * every one shown, each with its role or kind of address under it.
 */
const CellList = ({ items }: { items: ListItem[] }) => {
  const line = (it: ListItem) => (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span>{it.primary}</span>
      {(it.secondary || it.submitted) && (
        <span className="flex flex-wrap items-center gap-1">
          {it.secondary && <MutedText className="text-caption">{it.secondary}</MutedText>}
          {it.submitted && <SubmittedChip verified />}
        </span>
      )}
    </span>
  )
  if (items.length === 1) return line(items[0])
  return (
    <ul className="flex flex-col gap-2">
      {items.map((it, i) => (
        <li key={`${it.primary}-${i}`}>{line(it)}</li>
      ))}
    </ul>
  )
}

/**
 * A tile's tooltip: the state and how it stands, the sub status, the details
 * where they add anything, then what is remarkable about it — the submitted
 * address state, the formation filing, other filings.
 *
 * Built on the Radix primitive with the popover's tokens, as `MenuContent`
 * is: core's `Tooltip` still draws its colours from the legacy palette.
 */
export const TileTooltip = ({
  group,
  isLead,
  office
}: {
  group: StateGroup
  isLead: boolean
  office: boolean
}) => {
  const st = registrationState(group.current)
  const sub = st.subStatus
  const subLine = sub
    ? /good standing/i.test(sub) && !/not/i.test(sub)
      ? `In ${sub.toLowerCase()}`
      : sub
    : 'Sub status not provided by state'
  const details = newDetails(st)
  // Each line carries the mark it explains on the tile, where it has one:
  // the status its check, cross or dash; the sub status its shield, clock or
  // circle.
  const mark = {
    'aria-hidden': true,
    size: 12,
    strokeWidth: 2,
    className: 'shrink-0'
  } as const
  const statusIcon =
    group.kind === 'active' ? (
      <Check {...mark} />
    ) : group.kind === 'inactive' ? (
      <X {...mark} />
    ) : (
      <Minus {...mark} />
    )
  const code = (sub ?? '').toUpperCase()
  const subIcon =
    code === 'GOOD_STANDING' || (/good standing/i.test(sub ?? '') && !/not/i.test(sub ?? '')) ? (
      <ShieldCheck {...mark} />
    ) : /pending/i.test(sub ?? '') ? (
      <ClockAlert {...mark} />
    ) : /dissolv/i.test(sub ?? '') ? (
      <CircleOff {...mark} />
    ) : !sub ? (
      // Not provided by state: the tile's dash for absence.
      <Minus {...mark} />
    ) : (
      // Any other sub status the state gives — "Not good standing" — is a
      // standing it has not got: the cross.
      <X {...mark} />
    )
  const line = (icon: ReactNode, text: string) => (
    <span className="flex items-center gap-1">
      {icon ?? <span aria-hidden="true" className="w-3 shrink-0" />}
      {text}
    </span>
  )
  const notes: Array<{ text: string; icon?: ReactNode }> = [
    ...(isLead ? [{ text: 'Formation filing', icon: <FormationIcon {...mark} /> }] : []),
    ...(office ? [{ text: 'Submitted address state', icon: <MapPin {...mark} /> }] : [])
  ]
  return (
    <div className="flex flex-col">
      {/* The state, and how many filings it holds — the current one and its
          other filings, which the details' "filings" menu lists. */}
      <span className="flex items-baseline justify-between gap-4">
        <span className="font-semibold text-foreground">{stateName(group.state)}</span>
        <span className="text-text-secondary">
          {group.others.length + 1} filing{group.others.length === 0 ? '' : 's'}
        </span>
      </span>
      {line(statusIcon, WORD[group.kind])}
      {line(subIcon, subLine)}
      {/* The registry's own words: a page and a pen. */}
      {details &&
        line(<FilePenLine {...mark} />, details.charAt(0).toUpperCase() + details.slice(1))}
      {notes.length > 0 && (
        <div className="mt-1.5 flex flex-col border-t border-[var(--core-color-border-divider)] pt-1.5 text-text-secondary">
          {notes.map((n) => (
            <span key={n.text} className="flex items-center gap-1">
              {n.icon}
              {n.text}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * How the registrations beyond the formation state stand, by state: each
 * state counted once, by its current filing (`groupOf`). The Formation card's
 * title and note summarise the strip with it rather than list the states.
 */
export const otherStateStandings = (
  record: BusinessRecord,
  formationState?: string | null
): Record<Kind, number> & { total: number } => {
  const byState = new Map<string, Registration[]>()
  for (const r of record.registrations)
    if (r.state && r.state !== formationState)
      byState.set(r.state, [...(byState.get(r.state) ?? []), r])
  const out = { active: 0, inactive: 0, none: 0, total: byState.size }
  for (const [state, filings] of byState) out[groupOf(state, filings).kind] += 1
  return out
}

/**
 * The strip's tiles, in order: the formation filing's state leads, then the
 * states that publish no status — Delaware, New Jersey, Wyoming — together,
 * beside it, then the lapsed registrations, the ones to look at, then the
 * active. Exported for the audit that renders every tooltip.
 */
export const stateGroupsOf = (record: BusinessRecord, lead?: Registration): StateGroup[] => {
  const byState = new Map<string, Registration[]>()
  for (const r of record.registrations) {
    if (!r.state) continue
    byState.set(r.state, [...(byState.get(r.state) ?? []), r])
  }
  const rank = (g: StateGroup) =>
    lead && g.state === lead.state ? -1 : g.kind === 'none' ? 0 : g.kind === 'inactive' ? 1 : 2
  return [...byState.entries()]
    .map(([state, filings]) => groupOf(state, filings))
    .sort((a, b) => rank(a) - rank(b) || a.state.localeCompare(b.state))
}

/** Over a filing's name, in the table: domestic or foreign. The register is
 *  in the name itself — "Utah Secretary of State" — so not repeated here. */
const kindLine = (r: Registration) => {
  const jurisdiction = (r.jurisdiction ?? '').toLowerCase()
  return jurisdiction === 'domestic' ? 'Domestic' : jurisdiction === 'foreign' ? 'Foreign' : ''
}
/** Under it, when it was filed. */
const filedDate = (r: Registration) =>
  r.registrationDate
    ? `Filed ${new Date(`${r.registrationDate.slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
    : ''

/** Under a filing's state: whether it is domestic or foreign, and when it was filed. */
const filedLine = (r: Registration) => {
  const jurisdiction = (r.jurisdiction ?? '').toLowerCase()
  return [
    jurisdiction === 'domestic' ? 'Domestic' : jurisdiction === 'foreign' ? 'Foreign' : null,
    r.registrationDate
      ? `Filed ${new Date(`${r.registrationDate.slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
      : null
  ]
    .filter(Boolean)
    .join(' · ')
}

export type FilingsLayout = 'strip' | 'list' | 'map'

/** A state filing's row and cell name the register, not just the state: "Utah Secretary of State". */
const registryName = (state: string) => `${stateName(state)} Secretary of State`

/** Each state's square on a tile map of the country: [state, column, row]. */
const TILE_MAP: ReadonlyArray<readonly [string, number, number]> = [
  ['AK', 0, 0],
  ['ME', 10, 0],
  ['VT', 9, 1],
  ['NH', 10, 1],
  ['WA', 0, 2],
  ['ID', 1, 2],
  ['MT', 2, 2],
  ['ND', 3, 2],
  ['MN', 4, 2],
  ['IL', 5, 2],
  ['WI', 6, 2],
  ['MI', 7, 2],
  ['NY', 8, 2],
  ['RI', 9, 2],
  ['MA', 10, 2],
  ['OR', 0, 3],
  ['NV', 1, 3],
  ['WY', 2, 3],
  ['SD', 3, 3],
  ['IA', 4, 3],
  ['IN', 5, 3],
  ['OH', 6, 3],
  ['PA', 7, 3],
  ['NJ', 8, 3],
  ['CT', 9, 3],
  ['CA', 0, 4],
  ['UT', 1, 4],
  ['CO', 2, 4],
  ['NE', 3, 4],
  ['MO', 4, 4],
  ['KY', 5, 4],
  ['WV', 6, 4],
  ['VA', 7, 4],
  ['MD', 8, 4],
  ['DE', 9, 4],
  ['AZ', 1, 5],
  ['NM', 2, 5],
  ['KS', 3, 5],
  ['AR', 4, 5],
  ['TN', 5, 5],
  ['NC', 6, 5],
  ['SC', 7, 5],
  ['DC', 8, 5],
  ['OK', 3, 6],
  ['LA', 4, 6],
  ['MS', 5, 6],
  ['AL', 6, 6],
  ['GA', 7, 6],
  ['HI', 0, 7],
  ['TX', 3, 7],
  ['FL', 8, 7]
]
const TILE_STATES = new Set(TILE_MAP.map(([state]) => state))

/**
 * Every state filing, as a strip: a bar of how they stand, then one tile per
 * state, then the selected state's filings.
 *
 * It replaces three count rows — "36 of 51 filings are active" and its two
 * siblings — that each opened a list of fifty. The tiles say the same thing
 * at a glance: the state code, tinted by status, with the sub status as the
 * icon where the registry published one. A state with more than one filing
 * reads as its current filing (`StateGroup`) — Florida's active 2017
 * re-registration, not the 2011 one it let lapse — with its count, and the
 * other filings behind the dropdown in its details. None is dropped.
 *
 * The formation filing leads and is selected: it is what the card is about,
 * so its details are open by default. Delaware publishes no status, so it
 * reads exactly as New Jersey does — dashed, a dash — which is what absence
 * looks like everywhere on the report.
 */
export const FilingStrip = ({
  record,
  lead,
  legalName: cardLegalName,
  className,
  layout = 'strip',
  leadCells,
  city,
  kindFilter = 'all',
  onKindFilter,
  onOpenFiling,
  onOpenCity,
  showMap = true
}: {
  /** Which registrations the list shows — the header's control. */
  kindFilter?: RegistrationFilter
  onKindFilter?: (next: RegistrationFilter) => void
  /** The map over the list — the header's switch. */
  showMap?: boolean
  record: BusinessRecord
  /** The formation filing the card is about. It leads the strip. */
  lead?: Registration
  /** `map`: the states in their shapes; `list`: a row per state. Each opens
   *  on the formation filing, its details beside it.
   *  `strip`: a wrapping row of tiles, closed until one is picked. */
  layout?: FilingsLayout
  /** The formation facts the card states — entity type, formation state and
   *  date, with their sources — to lead the formation filing's details. */
  leadCells?: AttributeCell[]
  /** The business's city registrations: rows of the list, under the state
   *  filings, each opening to its own details. */
  city?: NonNullable<BusinessRecord['cityRegistrations']>
  /** The legal name the card states, where it is not the lead filing's —
   *  Sprig's own, over Mixboard Inc.'s linked Delaware filing. */
  legalName?: string
  className?: string
  /** Given, a filing's row in the table and the grid opens that filing in
   *  Sources rather than its details under the row. */
  onOpenFiling?: (r: Registration) => void
  /** Given, a city registration's row and cell open it in Sources too. */
  onOpenCity?: (here: NonNullable<BusinessRecord['cityRegistrations']>) => void
}) => {
  const groups = useMemo(() => stateGroupsOf(record, lead), [record, lead])
  // Where the business says it is: the submitted office address's state.
  // Whether it is registered there is Activity & Permission's to judge; the
  // strip only marks the tile.
  const officeState = record.addresses.find((a) => a.submitted && a.state)?.state ?? undefined

  // Nothing picked yet means the formation filing: its details are what the
  // card opens on. Derived, not seeded, so a lead that arrives a render late
  // (or a record switched in place) still opens on its own formation.
  const [picked, setSelected] = useState<string | undefined>(undefined)
  // Closed until a state is picked: the tiles are the summary, a state's
  // details are on demand. Clicking the open state again closes them.
  // Led here from the Assistant, the lead filing is open from the start.
  // The one strip that does not open on its first result — Sara, 2026-10-05.
  const expandedByLink = useContext(StripExpand)
  // Past the top two registrations, the rest fold under "Show more".
  const [showMore, setShowMore] = useState(false)
  // A state picked on the map: the list is that state's registrations — its
  // filings and its city registrations — none opened.
  const [stateOnly, setStateOnly] = useState<string | null>(null)
  // A city zoomed into on the map, `state|city`: the list is that city's registrations.
  const [zoomCity, setZoomCity] = useState<string | null>(null)
  // A city registration's pin, picked: the list is that registration alone, open.
  const [pinOnly, setPinOnly] = useState<string | null>(null)
  // The header's filter or map switch changed: the list starts over from the
  // top two. A city zoomed into stays — the filter narrows its pins — unless
  // the map is put away.
  useEffect(() => {
    setShowMore(false)
    setPinOnly(null)
    setStateOnly(null)
    setOpenCity(null)
  }, [kindFilter, showMap])
  useEffect(() => {
    if (!showMap) setZoomCity(null)
  }, [showMap])
  // The city registration open under its row, by its key.
  const [openCity, setOpenCity] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(!expandedByLink)
  const selected = picked ?? lead?.state ?? groups[0]?.state
  // Which of a state's filings is open, where it holds more than one. None
  // picked is its current filing.
  const [filingPick, setFilingPick] = useState<{
    state: string
    key: string
  } | null>(null)
  const tiles = useRef<Array<HTMLButtonElement | null>>([])
  const detailId = useId()

  if (groups.length === 0) return null

  // Every state, always: no status filter. In the order a reviewer looks:
  // the formation filing, the states the customer submitted, the active
  // filings, then the rest, newest first — not the alphabet.
  const submittedStates = new Set(
    record.addresses.filter((a) => a.submitted && a.state).map((a) => a.state as string)
  )
  const rank = (g: StateGroup) =>
    lead && g.state === lead.state
      ? 0
      : submittedStates.has(g.state)
        ? 1
        : g.kind === 'active'
          ? 2
          : 3
  const visible = [...groups].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (b.current.registrationDate ?? '').localeCompare(a.current.registrationDate ?? '')
  )
  const current = groups.find((g) => g.state === selected) ?? groups[0]

  /* State filings, then city registrations, as one list, inactive ones too:
     each led by the formation filing — what the card is about — then those
     that pertain to the submitted address (its state, or a city registration
     at it), then the newest filed. The top two show; the rest fold under
     "Show more". */
  const cities = registrationsOf(city ?? [])
  const tileStates = visible
  const streetKey = (a: string) => a.split(',')[0].toLowerCase().replace(/[^a-z0-9]/g, '')
  const submittedStreets = new Set(
    record.addresses.filter((a) => a.submitted).map((a) => streetKey(a.fullAddress))
  )
  const cityStarted = (here: (typeof cities)[number][1]) =>
    here.map((r) => r.businessStart ?? r.locationStart ?? '').sort().reverse()[0] ?? ''
  /* A row per filing: a state that holds two — Checkr's Utah, its expired
     domestic and the foreign filing made that day — shows both, side by side,
     the standing one first. `state` is the filing as a group of one; `fkey`
     is the key its state's details pick it by; `group` its whole state. */
  type Item = { key: string; state?: StateGroup; fkey?: string; group?: StateGroup; city?: (typeof cities)[number] }
  const items: Item[] = [
    ...visible.flatMap((g) => {
      const all = [g.current, ...g.others]
      const keyed = all.map((f, i) => ({ f, fkey: f.fileNumber ?? `${g.state}-${i}` }))
      // The formation filing leads its state's rows.
      const ordered = [...keyed.filter(({ f }) => f === lead), ...keyed.filter(({ f }) => f !== lead)]
      return ordered.map(({ f, fkey }) => ({
        key: `${g.state}-${fkey}`,
        state: { state: g.state, current: f, others: [], kind: kindOf(f) },
        fkey,
        group: g
      }))
    }),
    ...cities.map((c) => ({ key: `city-${c[0]}`, city: c }))
  ]
  const ranked: Item[] = items
    .map((item, at) => {
      // Ranked by the state, so its filings stay together; `at` keeps their order.
      const lead_ = Boolean(item.state && lead && item.state.state === lead.state)
      const pertains = item.state
        ? submittedStates.has(item.state.state)
        : item.city![1].some((r) => submittedStreets.has(streetKey(r.address)))
      const date = item.group ? (item.group.current.registrationDate ?? '') : cityStarted(item.city![1])
      return { item, at, sos: item.state ? 0 : 1, rank: lead_ ? 0 : pertains ? 1 : 2, date, state: item.state?.state ?? '' }
    })
    // The Secretary of State filings over the city registrations; within each,
    // the formation filing, then what pertains to the submitted address, then newest.
    .sort(
      (a, b) =>
        a.sos - b.sos ||
        a.rank - b.rank ||
        b.date.localeCompare(a.date) ||
        a.state.localeCompare(b.state) ||
        a.at - b.at
    )
    .map(({ item }) => item)
  /** A filing's row is open when its state's details show that filing. */
  const rowOn = (item: Item) =>
    !collapsed && item.state!.state === current.state && chosenKey === item.fkey
  /** Opens a filing's details under its row, or closes them. */
  const toggleRow = (item: Item) => {
    setOpenCity(null)
    if (rowOn(item)) return setCollapsed(true)
    setSelected(item.state!.state)
    setFilingPick({ state: item.state!.state, key: item.fkey! })
    setCollapsed(false)
  }
  const TOP = 2
  // A city registration counts with the filings: open is active, closed inactive.
  const kindOfItem = (i: Item): Kind => (i.state ? i.state.kind : i.city![1].some(isOpen) ? 'active' : 'inactive')
  const kindOk = (i: Item) => kindFilter === 'all' || kindOfItem(i) === kindFilter
  // The header's filter holds everywhere — a state or city picked on the map too.
  const filtered = ranked.filter(kindOk)
  // Zoomed into a city: its registrations the filter keeps — none kept, the
  // map is back on the country, and so is the list.
  const cityKept = zoomCity
    ? filtered.filter((i) => i.city && `${i.city[1][0].state}|${cityName(i.city[1][0])}` === zoomCity)
    : []
  const inCity = cityKept.length ? cityKept : undefined
  const gridItems = pinOnly
    ? ranked.filter((i) => i.key === pinOnly)
    : stateOnly
      ? // The state's registrations: its Secretary of State filings and its cities'.
        filtered.filter((i) => i.state?.state === stateOnly || i.city?.[1][0].state === stateOnly)
      : (inCity ?? (showMore ? filtered : filtered.slice(0, TOP)))
  // Narrowed to a state, a city or a pin: the button backs out of it, map and
  // list, to every registration — "Show more" from a state, "Show all" from a city.
  const backOut = () => {
    setPinOnly(null)
    setStateOnly(null)
    setZoomCity(null)
    setOpenCity(null)
    onKindFilter?.('all')
    setShowMore(true)
  }
  const moreToggle =
    pinOnly || stateOnly || inCity ? (
      <div className="flex justify-start border-t border-[var(--core-color-border-divider)] px-2 py-2">
        <ActionButton variant="quiet" size="compact" onClick={backOut}>
          {/* How many more the full list holds. */}
          {stateOnly ? `Show ${ranked.length - gridItems.length} more` : 'Show all'}
        </ActionButton>
      </div>
    ) : filtered.length > TOP ? (
      <div className="flex justify-start border-t border-[var(--core-color-border-divider)] px-2 py-2">
        <ActionButton variant="quiet" size="compact" onClick={() => setShowMore(!showMore)}>
          {showMore ? 'Show less' : `Show ${filtered.length - TOP} more`}
        </ActionButton>
      </div>
    ) : null

  /** Arrow keys walk the strip, as a radio group does. */
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const step =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0
    if (!step) return
    e.preventDefault()
    const next = (i + step + tileStates.length) % tileStates.length
    setSelected(tileStates[next].state)
    setCollapsed(false)
    tiles.current[next]?.focus()
  }

  // The selected state's filings: the current one, then its others, newest first.
  const filings = [current.current, ...current.others]
  const keyOf = (f: Registration, i: number) => f.fileNumber ?? `${current.state}-${i}`
  // The newest by registration date — only where one is strictly newest.
  // Checkr's two Utah filings share a day; calling either the latest would
  // be a guess.
  const latestKey = (() => {
    const dates = filings.map((f) => f.registrationDate ?? '')
    const max = dates.reduce((a, b) => (b > a ? b : a), '')
    const at = dates.filter((d) => d === max).length === 1 && max ? dates.indexOf(max) : -1
    return at >= 0 ? keyOf(filings[at], at) : undefined
  })()
  // Named by the month it was filed; the day, number and status are in the cells.
  // Where two share a month, the day; where they share the day too, which
  // kind of filing each is.
  const monthOf = (f: Registration) =>
    f.registrationDate
      ? new Date(`${f.registrationDate.slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric'
        })
      : 'Undated'
  const versionLabel = (f: Registration) => {
    const month = monthOf(f)
    if (filings.filter((g) => monthOf(g) === month).length < 2 || !f.registrationDate) return month
    const day = formatDate(f.registrationDate)
    const sameDay = filings.filter((g) => g.registrationDate === f.registrationDate).length > 1
    return sameDay
      ? `${day} · ${/^domestic$/i.test(f.jurisdiction ?? '') ? 'Domestic' : 'Foreign'}`
      : day
  }
  // Every state opens on the filing we read as standing now — the active
  // one, else the newest — the formation state included: Alliance Transfer's
  // New York opens on its active 2007 filing, and the 1976 formation filing
  // is one pick away in the menu, labelled Formation when shown.
  const chosenKey =
    filingPick && filingPick.state === current.state ? filingPick.key : keyOf(filings[0], 0)
  const shownFiling = filings.find((f, i) => keyOf(f, i) === chosenKey) ?? filings[0]
  // The people the customer submitted, to mark where a filing names one.
  const submittedPeople = new Set(
    record.people.filter((p) => p.submitted).map((p) => nameKey(p.name))
  )
  // The addresses the customer submitted, to mark where a filing lists one.
  const submitted = new Set(
    record.addresses.filter((a) => a.submitted).map((a) => addressKey(a.fullAddress))
  )
  // What the record knows about each address, read under it the way an
  // officer's roles are: a registered agent's, the property type, a mail drop.
  // Every filing address is on the record; the filing itself types none.
  const addressFacts = new Map(
    record.addresses.map((a) => [
      addressKey(a.fullAddress),
      [
        a.isRegisteredAgent || (a.labels ?? []).includes('registered_agent')
          ? 'Registered agent'
          : undefined,
        a.cmra ? 'Mail drop (CMRA)' : undefined,
        a.propertyType
          ? a.propertyType.charAt(0) + a.propertyType.slice(1).toLowerCase()
          : undefined
      ]
        .filter(Boolean)
        .join(' · ') || undefined
    ])
  )
  // The legal name the card states: the formation filing's, else the record's.
  const legalName = cardLegalName ?? lead?.name ?? record.name
  const cells: AttributeCell[] = [shownFiling].flatMap((f) => {
    const s = registrationState(f)
    // A filing under another spelling of the name — Sorenson's Idaho filings
    // read SORENSON COMMUNICATIONS, INC beside an LLC — says so, first, as the
    // name the registry holds. The same name, however punctuated, is not
    // repeated.
    const variant = f.name && nameKey(f.name) !== nameKey(legalName) ? f.name : undefined
    // The formation filing leads with the card's formation facts; its status
    // cells are the filing's own, below. Any other filing, its entity type.
    const facts: AttributeCell[] =
      f === lead && leadCells?.length
        ? leadCells.filter((c) => !/^formation (sub )?status/i.test(c.label ?? ''))
        : f.entityType
          ? [
              {
                key: `${f.fileNumber}-e`,
                label: 'Entity type',
                values: [{ value: f.entityType }]
              }
            ]
          : []
    return [
      ...facts,
      ...(variant
        ? [
            {
              key: `${f.fileNumber}-name`,
              label: 'Name on filing',
              span: 'full' as const,
              values: [{ value: variant }]
            }
          ]
        : []),
      // The header names the state; the cell says which kind of filing it is.
      {
        key: `${f.fileNumber}-j`,
        label: 'Jurisdiction',
        values: [
          {
            value: /^domestic$/i.test(f.jurisdiction ?? '') ? 'Domestic' : 'Foreign'
          }
        ]
      },
      {
        key: `${f.fileNumber}-s`,
        label: 'Status',
        values: [{ value: <StatusChip reg={f} /> }]
      },
      {
        key: `${f.fileNumber}-ss`,
        label: 'Sub status',
        values: [{ value: <SubStatusChip reg={f} /> }]
      },
      // Stated whatever it is: a registry that gives no details says so,
      // rather than leaving the cell out.
      {
        key: `${f.fileNumber}-d`,
        label: 'Status details',
        // Absent, in the secondary colour: said, but a step quieter than a value.
        values: [
          {
            value: s.statusDetails ?? <span className="text-text-secondary">{NOT_PROVIDED}</span>
          }
        ]
      },
      // The agent, on a row of its own, before the lists and the number.
      // These three are always cells, so the grid keeps its shape: a filing
      // that lists none says so, in the grey an absent value takes.
      {
        key: `${f.fileNumber}-a`,
        label: 'Registered agent',
        span: 'full' as const,
        // Meroxa's agent is DeVaris Brown, the person the customer submitted.
        badge:
          f.registeredAgent && submittedPeople.has(nameKey(f.registeredAgent)) ? (
            <SubmittedChip verified />
          ) : undefined,
        values: [{ value: f.registeredAgent || NONE_LISTED }]
      },
      // Who and where the filing lists, each closed to a count in its cell.
      {
        key: `${f.state}-${f.fileNumber}-o`,
        label: 'Officers',
        values: [
          {
            value:
              officersOf(f, submittedPeople).length > 0 ? (
                <CellList
                  key={`${f.state}-${f.fileNumber}-o`}
                  items={officersOf(f, submittedPeople)}
                />
              ) : (
                NONE_LISTED
              )
          }
        ]
      },
      {
        key: `${f.state}-${f.fileNumber}-ad`,
        label: 'Addresses',
        values: [
          {
            value:
              (f.addresses ?? []).length > 0 ? (
                <CellList
                  key={`${f.state}-${f.fileNumber}-ad`}
                  items={(f.addresses ?? []).map((a) => ({
                    primary: a,
                    secondary: addressFacts.get(addressKey(a)),
                    submitted: submitted.has(addressKey(a))
                  }))}
                />
              ) : (
                NONE_LISTED
              )
          }
        ]
      },
      ...(f.fileNumber
        ? [
            {
              key: `${f.fileNumber}-n`,
              label: 'File number',
              values: [{ value: f.fileNumber }]
            }
          ]
        : []),
      // Every filing's own date, the formation filing's included: the card's
      // Formation date says when the entity was formed, this says when this
      // filing was made.
      {
        key: `${f.fileNumber}-r`,
        label: 'Registered',
        values: [
          {
            value: f.registrationDate ? (
              formatDate(f.registrationDate)
            ) : (
              <span className="text-text-secondary">{NOT_PROVIDED}</span>
            )
          }
        ]
      }
    ]
  })

  /** Picks a state, or closes its details when it is the open one. */
  // With the map or list, the details fly out in a side panel that lists
  // every filing, so the reader can step through them there.
  const pick = (state: string) => {
    if (state === current.state && !collapsed) return setCollapsed(true)
    setSelected(state)
    setCollapsed(false)
  }
  const labelFor = (g: (typeof visible)[number]) => {
    const standing = [
      WORD[g.kind],
      g.current.subStatus ? subStatusLabel(g.current).toLowerCase() : null
    ]
      .filter(Boolean)
      .join(', ')
    const label = `${stateName(g.state)}${g.state === officeState ? ' (submitted office state)' : ''}: ${standing}${
      g.others.length ? `; ${g.others.length + 1} filings` : ''
    }`
    return lead && g.state === lead.state ? `Formation filing, ${label}` : label
  }

  const tileFor = (g: (typeof visible)[number], i: number, square = false) => {
    const isLead = Boolean(lead && g.state === lead.state)
    const isCurrent = g.state === current.state
    const on = isCurrent && !collapsed
    const standing = [
      WORD[g.kind],
      g.current.subStatus ? subStatusLabel(g.current).toLowerCase() : null
    ]
      .filter(Boolean)
      .join(', ')
    const label = `${stateName(g.state)}${g.state === officeState ? ' (submitted office state)' : ''}: ${standing}${
      g.others.length ? `; ${g.others.length + 1} filings` : ''
    }`
    return (
      <RadixTooltip.Root key={g.state} delayDuration={200}>
        <RadixTooltip.Trigger asChild>
          <button
            ref={(el) => {
              tiles.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-controls={detailId}
            aria-label={isLead ? `Formation filing, ${label}` : label}
            tabIndex={isCurrent ? 0 : -1}
            onClick={() => {
              if (on) return setCollapsed(true)
              setSelected(g.state)
              setCollapsed(false)
            }}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              'flex rounded-control transition-shadow duration-fast motion-reduce:transition-none',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              square ? 'aspect-square w-full' : 'min-w-14'
            )}
          >
            <MetaChip
              tone={toneOf(g.current)}
              size="compact"
              className={cn(
                'w-full justify-center font-mono',
                square && 'h-full flex-col gap-0.5 !rounded-control px-0',
                g.kind === 'none' && !on && ABSENT
              )}
              style={on ? selectedStyle(toneOf(g.current)) : undefined}
            >
              {isLead ? (
                <FormationIcon aria-hidden="true" size={12} strokeWidth={2} className="shrink-0" />
              ) : (
                <Icon reg={g.current} kind={g.kind} />
              )}
              {g.state}
              {g.state === officeState && (
                <MapPin aria-hidden="true" size={11} strokeWidth={2} className="shrink-0" />
              )}
              {/* A state with history keeps its count: the other filings are
              in its dropdown. */}
              {g.others.length > 0 && (
                <sup className="text-[9px] leading-none">{g.others.length + 1}</sup>
              )}
            </MetaChip>
          </button>
        </RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side="top"
            sideOffset={6}
            collisionPadding={10}
            className="core-theme z-popover max-w-64 rounded-popover border border-border bg-popover px-3 py-2 text-caption text-popover-foreground shadow-elevation-popover"
          >
            <TileTooltip group={g} isLead={isLead} office={g.state === officeState} />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    )
  }

  // The map's hover preview, on the table rows and grid cards too.
  const withStateTip = (g: (typeof visible)[number], element: ReactElement, key: string = g.state) => (
    <RadixTooltip.Root key={key} delayDuration={200}>
      <RadixTooltip.Trigger asChild>{element}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side="top"
          sideOffset={6}
          collisionPadding={10}
          className="core-theme z-popover max-w-64 rounded-popover border border-border bg-popover px-3 py-2 text-caption text-popover-foreground shadow-elevation-popover"
        >
          <TileTooltip
            group={g}
            isLead={Boolean(lead && g.state === lead.state)}
            office={g.state === officeState}
          />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  )

  // A state's filings, in the report's cells: under the picked row in the table,
  // under the strip or the map otherwise.
  const detailPanel = (
    <Collapsible open={!collapsed}>
      <div id={detailId} className={cn('border-t border-[var(--core-color-border-divider)]')}>
        {/* Sized to the filings button, so a state without one keeps the same
      header height and the grid below does not jump. Ruled off from the
      cells by the grid's own dashed rule (`--dash-rule-x`). */}
        <div
          className="flex min-h-12 items-center gap-2 bg-bottom bg-no-repeat px-4 py-2"
          style={{
            backgroundImage: 'var(--dash-rule-x)',
            backgroundSize: '100% 1px'
          }}
        >
          {/* The state at the default size: it names the filing below. */}
          <Text className="font-semibold">{stateName(current.state)}</Text>
          {/* Only the formation filing is labelled, with the formation tile's
        own building mark. Which of a state's filings is open is the
        filings menu's to say. */}
          {shownFiling === lead && (
            <span className="flex items-center gap-1 text-text-secondary">
              <FormationIcon aria-hidden="true" size={12} strokeWidth={2} className="shrink-0" />
              <MutedText className="text-caption">Formation</MutedText>
            </span>
          )}
          {/* The current filing leads; every other version is one pick away,
        at the header's far edge, behind the history button. A light check
        marks the one shown. */}
          {/* Only where there is more than one version to pick from. */}
          {/* In the table each filing is its own row; elsewhere, a menu. */}
          {filings.length > 1 && layout !== 'list' && (
            <div className="ml-auto">
              <Menu>
                <MenuTrigger asChild>
                  {/* A history button, as a repository counts its commits: the
                count of every version, not the one open — the header
                says which that is. */}
                  <ActionButton
                    aria-label={`${stateName(current.state)}: ${filings.length} filing${filings.length === 1 ? '' : 's'}`}
                    variant="quiet"
                    size="compact"
                    leadingIcon={<History aria-hidden="true" className="size-4" />}
                  >
                    {filings.length} filing
                    {filings.length === 1 ? '' : 's'}
                  </ActionButton>
                </MenuTrigger>
                <MenuContent align="end" className="z-popover min-w-48">
                  {filings.map((f, i) => (
                    <MenuItem
                      key={keyOf(f, i)}
                      aria-current={keyOf(f, i) === chosenKey ? 'true' : undefined}
                      onSelect={() =>
                        setFilingPick({
                          state: current.state,
                          key: keyOf(f, i)
                        })
                      }
                    >
                      <span className="flex w-full items-center gap-1.5">
                        {versionLabel(f)}
                        <VersionTag latest={keyOf(f, i) === latestKey} />
                        {/* The one shown: a light check, not a checkbox. */}
                        {keyOf(f, i) === chosenKey && (
                          <Check
                            aria-hidden="true"
                            size={14}
                            strokeWidth={2}
                            className="ml-auto shrink-0 text-text-secondary"
                          />
                        )}
                      </span>
                    </MenuItem>
                  ))}
                </MenuContent>
              </Menu>
            </div>
          )}
          {/* Closes the details; in the table the row itself toggles them. */}
          {layout !== 'list' && (
            <IconActionButton
              aria-label="Close filing details"
              className={filings.length > 1 ? undefined : 'ml-auto'}
              onClick={() => setCollapsed(true)}
              variant="quiet"
            >
              <X aria-hidden="true" />
            </IconActionButton>
          )}
        </div>
        {/* Its last rule hangs under the next band's solid one (`AttributeCells`). */}
        <AttributeCells items={cells} columns={undefined} className="-mb-px" />
      </div>
    </Collapsible>
  )

  /** The country, every state filed in and every city registered in. Picked
   *  from here, a registration leads the list, open; zoomed into a city, the
   *  list is that city's registrations. */
  // A filter, or the map switched off, backs out of what the map narrowed to.
  const clearMapNarrowing = () => {
    setPinOnly(null)
    setStateOnly(null)
    setZoomCity(null)
    setOpenCity(null)
  }
  const mapView = (
    // A rule under the map, between it and the list's header.
    <div className="flex flex-col items-center gap-2 border-b border-[var(--core-color-border-divider)] px-4 py-3">
      <StateFilingsMap
        // The map follows the header's filter: only the states and cities it keeps.
        filings={visible.filter((g) => kindFilter === 'all' || g.kind === kindFilter).map((g) => ({
          state: g.state,
          tone: toneOf(g.current),
          label: labelFor(g),
          tooltip: (
            <TileTooltip
              group={g}
              isLead={Boolean(lead && g.state === lead.state)}
              office={g.state === officeState}
            />
          )
        }))}
        // A state picked on the map is a filter, drawn selected; nothing opens.
        selected={stateOnly ?? current.state}
        open={Boolean(stateOnly) || !collapsed}
        onPick={(state) => {
          setOpenCity(null)
          setPinOnly(null)
          setZoomCity(null)
          setCollapsed(true)
          // Picked again, the filter comes off.
          setStateOnly(stateOnly === state ? null : state)
          setSelected(state)
        }}
        zoom={zoomCity}
        onZoom={(c) => {
          setZoomCity(c)
          setPinOnly(null)
          setStateOnly(null)
          setOpenCity(null)
        }}
        cities={cities
          .filter(([, here]) => kindFilter === 'all' || (here.some(isOpen) ? 'active' : 'inactive') === kindFilter)
          .map(([k, here]) => {
          const active = here.some(isOpen)
          return {
            key: k,
            state: here[0].state,
            city: cityName(here[0]),
            address: here[0].address?.replace(/,\s*[^,]+,\s*[A-Z]{2}\s*\d{5}.*$/, '') ?? undefined,
            active,
            // Each address it covers, open if any of its rows there is.
            places: [...new Set(here.map((r) => r.address))].map((addr) => {
              const at = here.filter((r) => r.address === addr)
              return {
                address: addr.replace(/,\s*[^,]+,\s*[A-Z]{2}\s*\d{5}.*$/, ''),
                point: at.find((r) => r.lngLat)?.lngLat,
                active: at.some(isOpen)
              }
            }),
            lngLat: cityLngLat(here[0].city, here[0].state),
            tone: active ? 'success' : 'danger',
            label: `City registration, ${cityName(here[0])}: ${active ? 'active' : 'inactive'}`,
            tooltip: <CityTooltip here={here} />,
            open: openCity === k,
            onPick: () => {
              // The pin's registration alone, open; "Show all" backs out.
              setCollapsed(true)
              setStateOnly(null)
              setPinOnly(`city-${k}`)
              setOpenCity(k)
            }
          }
        })}
      />
      {/* Filings outside the fifty states and DC, after the map. */}
      {visible.some((g) => !TILE_STATES.has(g.state)) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {visible.map((g, i) => (TILE_STATES.has(g.state) ? null : tileFor(g, i)))}
        </div>
      )}
    </div>
  )

  return (
    // Over the grid's last dashed rule above it: the line between is solid.
    <div
      className={cn(
        'relative -mt-px border-t border-[var(--core-color-border-divider)] bg-card',
        className
      )}
    >
      <div>
        <div className="min-w-0">
          <RadixTooltip.Provider>
            {layout === 'map' ? (
              mapView
            ) : layout === 'strip' ? (
              <div className="grid grid-cols-1 md:grid-cols-2">
                {/* The state filings, then the city registrations, two to a row;
                    a picked cell's details open under its row. */}
                {gridItems
                  .reduce<(typeof gridItems)[]>(
                    (rows, item, i) =>
                      i % 2 === 0
                        ? [...rows, [item]]
                        : [...rows.slice(0, -1), [...rows[rows.length - 1], item]],
                    []
                  )
                  .map((pair) => (
                    <Fragment key={pair[0].key}>
                      {pair.map((item, i) => {
                        if (item.city) {
                          const [k, here] = item.city
                          return (
                            <CityRegistrationCell
                              key={item.key}
                              here={here}
                              open={openCity === k}
                              onOpen={onOpenCity ? () => onOpenCity(here) : undefined}
                              // An orphaned cell takes the whole row, as the Addresses grid's does.
                              className={cn(i === 1 && 'md:border-l', pair.length === 1 && 'md:col-span-2')}
                              onToggle={() => {
                                setCollapsed(true)
                                setOpenCity(openCity === k ? null : k)
                              }}
                            />
                          )
                        }
                        const g = item.state!
                        const on = rowOn(item)
                        return withStateTip(
                          g,
                          <button
                            key={item.key}
                            type="button"
                            aria-expanded={onOpenFiling ? undefined : on}
                            aria-controls={onOpenFiling ? undefined : detailId}
                            // The filing's source, where there is one to open; else its details here.
                            onClick={() => (onOpenFiling ? onOpenFiling(g.current) : toggleRow(item))}
                            className={cn(
                              'grid gap-1 border-t border-[var(--core-color-border-divider)] px-4 py-3 text-left transition-colors hover:bg-[var(--core-color-state-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                              i === 1 && 'md:border-l',
                              pair.length === 1 && 'md:col-span-2',
                              on && 'bg-[var(--core-color-surface-subtle)]'
                            )}
                          >
                            <span className="text-caption text-text-secondary">
                              {filedLine(g.current) || stateName(g.state)}
                            </span>
                            <span className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
                              {registryName(g.state)}
                              {/* The submitted office's state, marked as the table marks it. */}
                              {g.state === officeState && (
                                <MapPin
                                  aria-label="Submitted office state"
                                  size={12}
                                  strokeWidth={2}
                                  className="shrink-0 text-text-secondary"
                                />
                              )}
                            </span>
                            <span className="flex flex-wrap items-center gap-1.5">
                              <MetaChip tone={toneOf(g.current)} size="compact">
                                <Icon reg={g.current} kind={g.kind} />
                                {WORD[g.kind]}
                              </MetaChip>
                              <SubStatusChip reg={g.current} />
                            </span>
                          </button>
                        )
                      })}
                      {/* The picked cell's details, under its row. */}
                      {pair.some((item) => item.state && item.state.state === current.state) && (
                        <div className="md:col-span-2">{detailPanel}</div>
                      )}
                      {pair.map(
                        (item) =>
                          item.city &&
                          openCity === item.city[0] && (
                            <div key={`${item.key}-detail`} className="md:col-span-2">
                              <CityRegistrationDetail here={item.city[1]} />
                            </div>
                          )
                      )}
                    </Fragment>
                  ))}
              </div>
            ) : layout === 'list' ? (
              <>
              {/* The map over the list, unless switched off in the card's header. */}
              {showMap && mapView}
              <div role="radiogroup" aria-label="State filings">
                <div className="hidden grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-x-4 border-b border-[var(--core-color-border-divider)] px-4 py-1.5 md:grid">
                  {[cities.length > 0 ? 'Registration' : 'State', 'Status'].map((h) => (
                    <span
                      key={h}
                      className="text-xs font-medium text-[var(--core-color-table-header-text)]"
                    >
                      {h}
                    </span>
                  ))}
                </div>
                {gridItems.map((item) => {
                  // A city registration, as a row of its own.
                  if (item.city) {
                    const [k, here] = item.city
                    return (
                      <CityRegistrationRow
                        key={k}
                        here={here}
                        open={openCity === k}
                        onOpen={onOpenCity ? () => onOpenCity(here) : undefined}
                        onToggle={() => setOpenCity(openCity === k ? null : k)}
                      />
                    )
                  }
                  const g = item.state!
                  const on = rowOn(item)
                  const isLead = Boolean(lead && g.state === lead.state)
                  const RowIcon = isLead ? FormationIcon : Landmark
                  // Domestic or foreign over the register itself — "Utah Secretary of
                  // State" — and when it was filed under it.
                  const kind = kindLine(g.current)
                  const filed = filedDate(g.current)
                  return (
                    <Fragment key={item.key}>
                      {withStateTip(
                        g,
                        <button
                          key={item.key}
                          type="button"
                          role={onOpenFiling ? undefined : 'radio'}
                          aria-checked={onOpenFiling ? undefined : on}
                          aria-controls={onOpenFiling ? undefined : detailId}
                          aria-label={onOpenFiling ? `${labelFor(g)}. Open in Sources` : labelFor(g)}
                          // The filing's source, where there is one to open; else its details here.
                          onClick={() => (onOpenFiling ? onOpenFiling(g.current) : toggleRow(item))}
                          className={cn(
                            'grid w-full grid-cols-1 items-center gap-x-4 gap-y-2 bg-[image:var(--dash-rule-x)] bg-[length:100%_1px] bg-[position:left_bottom] bg-no-repeat px-4 py-3 text-left transition-colors last:bg-none hover:bg-[var(--core-color-state-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]',
                            on && 'bg-[var(--core-color-surface-subtle)]'
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <span className="min-w-0">
                              {kind && <span className="block text-caption text-text-secondary">{kind}</span>}
                              <span className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
                                {registryName(g.state)}
                                {g.others.length > 0 && (
                                  <span
                                    role="img"
                                    aria-label={`${g.others.length + 1} filings`}
                                    className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-[var(--core-color-chip-bg)] text-[10px] font-semibold leading-none text-text-secondary"
                                  >
                                    {g.others.length + 1}
                                  </span>
                                )}
                                {g.state === officeState && (
                                  <MapPin
                                    aria-label="Submitted office state"
                                    size={12}
                                    strokeWidth={2}
                                    className="shrink-0 text-text-secondary"
                                  />
                                )}
                              </span>
                              {filed && <span className="block text-caption text-text-secondary">{filed}</span>}
                            </span>
                          </span>
                          <span className="flex flex-wrap items-center gap-1.5">
                            <MetaChip tone={toneOf(g.current)} size="compact">
                              <Icon reg={g.current} kind={g.kind} />
                              {WORD[g.kind]}
                            </MetaChip>
                            <SubStatusChip reg={g.current} />
                            {/* Opening in Sources: the Sources mark, as the side rail draws it. Opening here: the chevron. */}
                            {onOpenFiling ? (
                              <SourceDataMark />
                            ) : (
                              <ChevronDown
                                aria-hidden="true"
                                size={16}
                                strokeWidth={1.75}
                                className={cn(
                                  'ml-auto shrink-0 text-text-secondary transition-transform duration-fast motion-reduce:transition-none',
                                  on && 'rotate-180'
                                )}
                              />
                            )}
                          </span>
                        </button>
                      )}
                      {/* In the table, a state's details open right under its row. */}
                      {on && !onOpenFiling && detailPanel}
                    </Fragment>
                  )
                })}
                {moreToggle}
              </div>
              </>
            ) : (
              <div
                role="radiogroup"
                aria-label="State filings"
                // A wrapping row, not a grid of fixed columns: a tile carrying the
                // formation mark, the office pin and a filing count is wider than
                // one column, and a column clipped it. Each tile is at least 56px.
                className="flex flex-wrap gap-1.5 px-4 py-3"
              >
                {tileStates.map((g, i) => tileFor(g, i))}
              </div>
            )}
            {layout === 'strip' && moreToggle}
          </RadixTooltip.Provider>
        </div>

        {/* The selected state's filings, one block each, in the report's cells. */}
        {layout === 'map' && detailPanel}
        {/* A pinned city registration's details, under the map. */}
        {layout === 'map' &&
          cities
            .filter(([k]) => k === openCity)
            .map(([k, here]) => <CityRegistrationDetail key={k} here={here} titled />)}
      </div>
    </div>
  )
}

/** The Registrations card's display switch: the state filings as a list or a map. */
export type RegistrationFilter = 'all' | Kind

/** How a business's registrations stand, for the header's filter: the state
 *  filings by kind, and the city registrations with them — open is active,
 *  closed inactive. */
export const registrationCounts = (
  record: BusinessRecord,
  lead: Registration | undefined,
  city: NonNullable<BusinessRecord['cityRegistrations']> | undefined
): Record<RegistrationFilter, number> => {
  // Every filing, as the table lists them: a state holding two counts two.
  const filings = stateGroupsOf(record, lead).flatMap((g) => [g.current, ...g.others])
  const cities = registrationsOf(city ?? [])
  const openCities = cities.filter(([, here]) => here.some(isOpen)).length
  const of = (k: Kind) => filings.filter((f) => kindOf(f) === k).length
  return {
    all: filings.length + cities.length,
    active: of('active') + openCities,
    inactive: of('inactive') + cities.length - openCities,
    none: of('none')
  }
}

/** The Registrations card's filter, under its title: All, Active, Inactive,
 *  No status, each counted. */
export const RegistrationFilterControl = ({
  counts,
  value,
  onChange
}: {
  counts: Record<RegistrationFilter, number>
  value: RegistrationFilter
  onChange: (next: RegistrationFilter) => void
}) => (
  <SegmentedControl
    size="sm"
    aria-label="Filter registrations"
    value={value}
    onValueChange={(v) => v && onChange(v as RegistrationFilter)}
  >
    {(
      [
        ['all', 'All'],
        ['active', 'Active'],
        ['inactive', 'Inactive'],
        ['none', 'No status']
      ] as const
    )
      // All four, always — a count of 0 says as much as any other.
      .map(([v, label]) => (
        <SegmentedControlItem key={v} value={v}>
          {label}
          <span className="ml-1 tabular-nums text-text-secondary">{counts[v]}</span>
        </SegmentedControlItem>
      ))}
  </SegmentedControl>
)

/** The Registrations card's view, at its header's edge as the other cards'
 *  are: the map over the list, or the list alone. */
export const RegistrationViewToggle = ({ showMap, onShowMap }: { showMap: boolean; onShowMap: (on: boolean) => void }) => (
  <SegmentedControl
    size="sm"
    aria-label="Registrations display"
    value={showMap ? 'map' : 'list'}
    onValueChange={(v) => v && onShowMap(v === 'map')}
  >
    {/* The table first: it is what the card opens on. */}
    <SegmentedControlItem
      value="list"
      aria-label="List only"
      className="!px-2"
      icon={<Table2 aria-hidden="true" size={14} strokeWidth={1.75} />}
    />
    <SegmentedControlItem
      value="map"
      aria-label="Map and list"
      className="!px-2"
      icon={<MapIcon aria-hidden="true" size={14} strokeWidth={1.75} />}
    />
  </SegmentedControl>
)

export const FilingsViewToggle = ({
  value,
  onChange
}: {
  value: FilingsLayout
  onChange: (view: FilingsLayout) => void
}) => (
  <SegmentedControl
    size="sm"
    value={value}
    onValueChange={(v) => v && onChange(v as FilingsLayout)}
    aria-label="State filings display"
  >
    <SegmentedControlItem
      value="list"
      aria-label="Table"
      className="!px-2"
      icon={<Table2 aria-hidden="true" size={14} strokeWidth={1.75} />}
    />
    <SegmentedControlItem
      value="map"
      aria-label="Map"
      className="!px-2"
      icon={<MapIcon aria-hidden="true" size={14} strokeWidth={1.75} />}
    />
  </SegmentedControl>
)
