import { useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import * as RadixTooltip from '@radix-ui/react-tooltip'
import {
  Building2,
  Check,
  CircleOff,
  ClockAlert,
  History,
  MapPin,
  Minus,
  ShieldCheck,
  X
} from 'lucide-react'

import {
  ActionButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  MetaChip,
  MutedText,
  Text,
  type MetaChipTone
} from '@/core'

import type { BusinessRecord } from '../../lib/deriveResults'
import { formatDate } from '../../lib/reportLabels'
import {
  NOT_PROVIDED,
  newDetails,
  registrationState,
  subStatusLabel,
  type Registration
} from '../../lib/registrationStatus'
import { stateName } from '../../lib/states'
import { cn } from '../../utils/twUtils'
import { canonicalRole, nameKey } from '../../lib/attributes'
import { AttributeCells, type AttributeCell } from '../AttributeGrid'
import { Collapsible } from '../Collapsible'
import { SubmittedChip } from '../Provenance'

type Kind = 'active' | 'inactive' | 'none'

/** Active, inactive, or nothing published — the three a filing can say. */
const kindOf = (reg: Registration): Kind =>
  /^active$/i.test(reg.status ?? '') ? 'active' : /^inactive$/i.test(reg.status ?? '') ? 'inactive' : 'none'

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

/** The selected tile, inverted: its tone's strong colour as the fill and the
 *  card's colour as the text, so the one open reads at a glance among twenty
 *  tinted ones. A ring around a chip in a grid of chips read as a focus
 *  outline, not a choice. */
const selectedStyle = (tone: MetaChipTone) =>
  ({
    '--core-badge-bg': `var(--core-color-status-${tone}-fg)`,
    '--core-badge-border': `var(--core-color-status-${tone}-fg)`,
    '--core-badge-fg': 'var(--core-color-surface-card)'
  }) as CSSProperties

/** Absence is not a chip (PARITY.md): a state that publishes no status keeps
 *  the chip's geometry but drops its fill for a dashed outline — the
 *  `StateMark` ring's grammar, one level up. */
const ABSENT = '!bg-transparent !border-dashed !border-[var(--core-color-border-strong)] !text-text-secondary'

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
const chipIcon = { 'aria-hidden': true, size: 12, strokeWidth: 2, className: 'shrink-0' } as const
const StatusChip = ({ reg }: { reg: Registration }) => {
  const kind = kindOf(reg)
  const st = registrationState(reg)
  return (
    <MetaChip tone={TONE[kind]} size="compact" className={cn(kind === 'none' && ABSENT)}>
      {kind === 'active' ? (
        <Check {...chipIcon} />
      ) : kind === 'inactive' ? (
        <X {...chipIcon} />
      ) : (
        <Minus {...chipIcon} />
      )}
      {st.status ?? 'Not published by the state'}
    </MetaChip>
  )
}
const SubStatusChip = ({ reg }: { reg: Registration }) => {
  const sub = registrationState(reg).subStatus
  const good = Boolean(sub && /good standing/i.test(sub) && !/not/i.test(sub))
  const tone: MetaChipTone = !sub ? 'neutral' : good ? 'success' : /pending/i.test(sub) ? 'warning' : 'danger'
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
    (f.officerRoles ?? []).length > 0 ? (f.officerRoles ?? []) : (f.officers ?? []).map((name) => ({ name, roles: [] }))
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
const TileTooltip = ({ group, isLead, office }: { group: StateGroup; isLead: boolean; office: boolean }) => {
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
  const mark = { 'aria-hidden': true, size: 12, strokeWidth: 2, className: 'shrink-0' } as const
  const statusIcon =
    group.kind === 'active' ? <Check {...mark} /> : group.kind === 'inactive' ? <X {...mark} /> : <Minus {...mark} />
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
    ) : undefined
  const line = (icon: ReactNode, text: string) => (
    <span className="flex items-center gap-1">
      {icon ?? <span aria-hidden="true" className="w-3 shrink-0" />}
      {text}
    </span>
  )
  const notes: Array<{ text: string; icon?: ReactNode }> = [
    ...(isLead ? [{ text: 'Formation filing', icon: <Building2 {...mark} /> }] : []),
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
      {details && line(undefined, details)}
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
    if (r.state && r.state !== formationState) byState.set(r.state, [...(byState.get(r.state) ?? []), r])
  const out = { active: 0, inactive: 0, none: 0, total: byState.size }
  for (const [state, filings] of byState) out[groupOf(state, filings).kind] += 1
  return out
}

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
  className
}: {
  record: BusinessRecord
  /** The formation filing the card is about. It leads the strip. */
  lead?: Registration
  className?: string
}) => {
  const groups = useMemo<StateGroup[]>(() => {
    const byState = new Map<string, Registration[]>()
    for (const r of record.registrations) {
      if (!r.state) continue
      byState.set(r.state, [...(byState.get(r.state) ?? []), r])
    }
    /* The formation filing's state leads, then the states that publish no
       status — Delaware, New Jersey, Wyoming — together, beside it, then the
       lapsed registrations, the ones to look at, then the active. */
    const rank = (g: StateGroup) =>
      lead && g.state === lead.state ? -1 : g.kind === 'none' ? 0 : g.kind === 'inactive' ? 1 : 2
    return [...byState.entries()]
      .map(([state, filings]) => groupOf(state, filings))
      .sort((a, b) => rank(a) - rank(b) || a.state.localeCompare(b.state))
  }, [record.registrations, lead])
  // Where the business says it is: the submitted office address's state.
  // Whether it is registered there is Activity & Permission's to judge; the
  // strip only marks the tile.
  const officeState = record.addresses.find((a) => a.submitted && a.state)?.state ?? undefined

  // Nothing picked yet means the formation filing: its details are what the
  // card opens on. Derived, not seeded, so a lead that arrives a render late
  // (or a record switched in place) still opens on its own formation.
  const [picked, setSelected] = useState<string | undefined>(undefined)
  // Clicking the open state again closes its details; any state reopens them.
  const [collapsed, setCollapsed] = useState(false)
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

  // Every state, always: no status filter. The tiles' tones and order, the
  // card's title and note, and each tile's tooltip already say how they stand.
  const visible = groups
  const current = groups.find((g) => g.state === selected) ?? groups[0]

  /** Arrow keys walk the strip, as a radio group does. */
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const step =
      e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = (i + step + visible.length) % visible.length
    setSelected(visible[next].state)
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
    return sameDay ? `${day} · ${/^domestic$/i.test(f.jurisdiction ?? '') ? 'Domestic' : 'Foreign'}` : day
  }
  // The formation state opens on the formation filing, even where a later
  // filing there is the current one (Alliance Transfer's New York).
  const leadIndex = lead ? filings.indexOf(lead) : -1
  const chosenKey =
    filingPick && filingPick.state === current.state
      ? filingPick.key
      : leadIndex >= 0
        ? keyOf(filings[leadIndex], leadIndex)
        : keyOf(filings[0], 0)
  const shownFiling = filings.find((f, i) => keyOf(f, i) === chosenKey) ?? filings[0]
  // The people the customer submitted, to mark where a filing names one.
  const submittedPeople = new Set(record.people.filter((p) => p.submitted).map((p) => nameKey(p.name)))
  // The addresses the customer submitted, to mark where a filing lists one.
  const submitted = new Set(record.addresses.filter((a) => a.submitted).map((a) => addressKey(a.fullAddress)))
  // What the record knows about each address, read under it the way an
  // officer's roles are: a registered agent's, the property type, a mail drop.
  // Every filing address is on the record; the filing itself types none.
  const addressFacts = new Map(
    record.addresses.map((a) => [
      addressKey(a.fullAddress),
      [
        a.isRegisteredAgent || (a.labels ?? []).includes('registered_agent') ? 'Registered agent' : undefined,
        a.cmra ? 'Mail drop (CMRA)' : undefined,
        a.propertyType ? a.propertyType.charAt(0) + a.propertyType.slice(1).toLowerCase() : undefined
      ]
        .filter(Boolean)
        .join(' · ') || undefined
    ])
  )
  // The legal name the card states: the formation filing's, else the record's.
  const legalName = lead?.name ?? record.name
  const cells: AttributeCell[] = [shownFiling].flatMap((f) => {
    const s = registrationState(f)
    // A filing under another spelling of the name — Sorenson's Idaho filings
    // read SORENSON COMMUNICATIONS, INC beside an LLC — says so, first, as the
    // name the registry holds. The same name, however punctuated, is not
    // repeated.
    const variant = f.name && nameKey(f.name) !== nameKey(legalName) ? f.name : undefined
    return [
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
          f.registeredAgent && submittedPeople.has(nameKey(f.registeredAgent)) ? <SubmittedChip verified /> : undefined,
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
                <CellList key={`${f.state}-${f.fileNumber}-o`} items={officersOf(f, submittedPeople)} />
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

  return (
    <div className={cn('border-t border-[var(--core-color-border-divider)]', className)}>
      <div className="px-4 pt-3">
        {/* A label, as the grid's cells are labelled: the section is named,
            not headed. */}
        <Text tone="secondary" size="sm" className="leading-snug">
          State filings
        </Text>
      </div>

      <RadixTooltip.Provider>
        <div
          role="radiogroup"
          aria-label="State filings"
          // A wrapping row, not a grid of fixed columns: a tile carrying the
          // formation mark, the office pin and a filing count is wider than
          // one column, and a column clipped it. Each tile is at least 56px.
          className="flex flex-wrap gap-1.5 px-4 py-3"
        >
          {visible.map((g, i) => {
            const isLead = Boolean(lead && g.state === lead.state)
            const isCurrent = g.state === current.state
            const on = isCurrent && !collapsed
            const standing = [WORD[g.kind], g.current.subStatus ? subStatusLabel(g.current).toLowerCase() : null]
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
                      'flex min-w-14 rounded-control transition-shadow duration-fast motion-reduce:transition-none',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                    )}
                  >
                    <MetaChip
                      tone={TONE[g.kind]}
                      size="compact"
                      className={cn('w-full justify-center font-mono', g.kind === 'none' && !on && ABSENT)}
                      style={on ? selectedStyle(TONE[g.kind]) : undefined}
                    >
                      {isLead ? (
                        <Building2 aria-hidden="true" size={12} strokeWidth={2} className="shrink-0" />
                      ) : (
                        <Icon reg={g.current} kind={g.kind} />
                      )}
                      {g.state}
                      {g.state === officeState && (
                        <MapPin aria-hidden="true" size={11} strokeWidth={2} className="shrink-0" />
                      )}
                      {/* A state with history keeps its count: the other filings are
                      in its dropdown. */}
                      {g.others.length > 0 && <sup className="text-[9px] leading-none">{g.others.length + 1}</sup>}
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
          })}
        </div>
      </RadixTooltip.Provider>

      {/* The selected state's filings, one block each, in the report's cells. */}
      <Collapsible open={!collapsed}>
        <div id={detailId} className="border-t border-[var(--core-color-border-divider)]">
          {/* Sized to the filings button, so a state without one keeps the same
            header height and the grid below does not jump. Ruled off from the
            cells by the grid's own dashed rule (`--dash-rule-x`). */}
          <div
            className="flex min-h-12 items-center gap-2 bg-bottom bg-no-repeat px-4 py-2"
            style={{ backgroundImage: 'var(--dash-rule-x)', backgroundSize: '100% 1px' }}
          >
            {/* The state at the default size: it names the filing below. */}
            <Text className="font-semibold">{stateName(current.state)}</Text>
            {/* Only the formation filing is labelled, with the formation tile's
              own building mark. Which of a state's filings is open is the
              filings menu's to say. */}
            {shownFiling === lead && (
              <span className="flex items-center gap-1 text-text-secondary">
                <Building2 aria-hidden="true" size={12} strokeWidth={2} className="shrink-0" />
                <MutedText className="text-caption">Formation</MutedText>
              </span>
            )}
            {/* The current filing leads; every other version is one pick away,
              at the header's far edge, behind the history button. A light check
              marks the one shown. */}
            {/* Only where there is more than one version to pick from. */}
            {filings.length > 1 && (
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
                      {filings.length} filing{filings.length === 1 ? '' : 's'}
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
          </div>
          {/* Its last rule hangs under the next band's solid one (`AttributeCells`). */}
          <AttributeCells items={cells} className="-mb-px" />
        </div>
      </Collapsible>
    </div>
  )
}
