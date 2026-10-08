import { useState } from 'react'
import { Check, CircleAlert, Landmark, LayoutGrid, List, Table2, UserRound } from 'lucide-react'

import {
  ActionButton,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  MetaChip,
  SegmentedControl,
  SegmentedControlItem
} from '@/core'

import { StatusDot } from '../StatusDot'

import { corroborated, filedName, verifiedBy, type AttributeRow } from '../../lib/attributes'
import { RowProvenance, SubmittedChip } from '../Provenance'
import { sourceLabel } from '../../lib/sourceLabels'
import { AttributeCells } from '../AttributeGrid'
import { cellsFromRows, type CellContext } from '../attributeCells'
import { Strip } from './Strip'
import { cn } from '../../utils/twUtils'

const icon = { 'aria-hidden': true, size: 12, strokeWidth: 2 } as const
/** The mark before a record's line, as the filing preview draws its own. */
const mark = {
  'aria-hidden': true,
  size: 12,
  strokeWidth: 1.5,
  className: 'shrink-0'
} as const

/** Every record that names the person: each filing by its state, then the
 *  other registers by name. What `verifiedBy` lists, plus the sources that
 *  name without attesting — a found officer is named by a Form 5500 or a
 *  screening result as much as by a filing. */
const namedBy = (r: AttributeRow): string[] => {
  const filings = (r.registrations ?? []).map((f) => (f.state ? `SOS · ${f.state}` : 'SOS'))
  const others = [...(r.sources ?? []), ...(r.source ? [r.source] : [])]
    .filter((x) => x && x !== 'Submitted' && x !== 'registration')
    .map(sourceLabel)
  return [...new Set([...filings, ...others])]
}

/** Who someone is to the business, as the strip they sit in. */
const KINDS: Array<{ label: string; holds: (row: AttributeRow) => boolean }> = [
  { label: 'Owners', holds: (r) => /owner/i.test(r.label) },
  { label: 'Officers', holds: (r) => r.label === 'Officer' },
  {
    label: 'Registered agents',
    holds: (r) => /registered agent/i.test(r.label) && !/owner/i.test(r.label)
  },
  {
    label: 'People',
    holds: (r) => r.label !== 'Officer' && !/registered agent|owner/i.test(r.label)
  }
]

/**
 * The people on the record as tiles, as the Addresses card draws its places:
 * one strip per kind — officers, registered agents, the people submitted —
 * one chip per person: green with a check where the customer submitted them
 * and a source verifies it, the warning tone where nothing does.
 * Closed until a chip is picked; the picked one opens their cell under the
 * strip — the name, their titles, every source that names them.
 */
export const PeopleStrips = ({ people, ctx }: { people: AttributeRow[]; ctx: CellContext }) => {
  const strips = new Map(
    KINDS.map(({ label, holds }) => [label, kindStrip(label, people.filter(holds), ctx)])
  )
  // Registered agents beside the officers, a dashed rule between, as the
  // grid's cells divide; either alone takes the row.
  const pair = ['Registered agents', 'Officers'].map((label) => strips.get(label)).filter(Boolean)
  return (
    <div>
      {strips.get('Owners')}
      {pair.length > 1 ? (
        <div className="grid md:grid-cols-2">
          <div className="min-w-0 md:bg-[image:var(--dash-rule-y)] md:bg-[length:1px_100%] md:bg-[position:right_top] md:bg-no-repeat">
            {pair[0]}
          </div>
          <div className="min-w-0">{pair[1]}</div>
        </div>
      ) : (
        pair[0]
      )}
      {strips.get('People')}
    </div>
  )
}

const kindStrip = (label: string, rows: AttributeRow[], ctx: CellContext) => {
  if (rows.length === 0) return null
  const keyOf = (r: AttributeRow, i: number) => `${r.value}-${i}`
  return (
    <Strip
      key={label}
      label={label}
      tiles={rows.map((r, i) => ({
        key: keyOf(r, i),
        // Pointed at, the chip says who they are: their titles, or what
        // they are to the business, and whether the customer submitted them.
        chip: (
          <HoverCard openDelay={300}>
            <HoverCardTrigger asChild>
              <span className="flex">
                {/* Submitted and verified: green, a check. Submitted and not
                        verified: the warning tone, an exclamation mark — as the
                        Submitted chip on their cell reads. */}
                <MetaChip
                  tone={!r.submitted ? 'neutral' : corroborated(r) ? 'success' : 'warning'}
                  size="compact"
                >
                  {r.submitted &&
                    (corroborated(r) ? <Check {...icon} /> : <CircleAlert {...icon} />)}
                  {filedName(r.value)}
                </MetaChip>
              </span>
            </HoverCardTrigger>
            <HoverCardContent side="top" className="w-64 p-3">
              {/* As a cell reads: the claim's chip over the value, then the
                      titles, then every record that names them, one per line —
                      the filings by state, the registers by name. */}
              {r.submitted && (
                <span className="mb-1.5 flex">
                  <SubmittedChip
                    verified={corroborated(r)}
                    by={verifiedBy(r)}
                    onJumpToSource={ctx.onJumpToSource}
                  />
                </span>
              )}
              <span className="block text-sm font-medium text-foreground">
                {filedName(r.value)}
              </span>
              <span className="mt-0.5 block text-caption text-text-secondary">
                {r.titles?.length ? r.titles.join(' · ') : r.label}
              </span>
              {/* As the filing preview lists what a filing is: a hairline,
                      then one line per record with its mark. */}
              {namedBy(r).length > 0 ? (
                <ul className="m-0 mt-1.5 flex list-none flex-col gap-0.5 border-t border-[var(--core-color-border-divider)] p-0 pt-1.5 text-caption text-text-secondary">
                  {namedBy(r).map((source) => (
                    <li key={source} className="flex items-center gap-1.5">
                      <Landmark {...mark} />
                      {source}
                    </li>
                  ))}
                </ul>
              ) : (
                r.submitted && (
                  <span className="mt-1.5 block text-caption text-text-secondary">
                    No source names them
                  </span>
                )
              )}
            </HoverCardContent>
          </HoverCard>
        )
      }))}
      detail={(key) => {
        const i = rows.findIndex((r, j) => keyOf(r, j) === key)
        // Opened on its own, every title is stated.
        return i < 0 ? null : (
          <AttributeCells
            className="-mb-px"
            items={cellsFromRows([rows[i]], { ...ctx, allTitles: true })}
          />
        )
      }}
    />
  )
}

export type PeopleViewMode = 'list' | 'grid'

/** The People card's display switch: the same people as a list or a grid. */
export const PeopleViewToggle = ({
  value,
  onChange
}: {
  value: PeopleViewMode
  onChange: (view: PeopleViewMode) => void
}) => (
  <SegmentedControl
    size="sm"
    value={value}
    onValueChange={(v) => v && onChange(v as PeopleViewMode)}
    aria-label="People display"
  >
    <SegmentedControlItem
      value="list"
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

/** What the person is to the business, as one chip. */
const roleOf = (r: AttributeRow) =>
  /owner/i.test(r.label)
    ? 'Owner'
    : /registered agent/i.test(r.label)
      ? 'Registered agent'
      : r.label === 'Officer'
        ? 'Officer'
        : r.label

/** The people folded away under the submitted, verified ones: the ones found. */
const ShowFoundPeople = ({
  total,
  shown,
  expanded,
  onToggle
}: {
  total: number
  shown: number
  expanded: boolean
  onToggle: () => void
}) => {
  const found = total - shown
  if (found <= 0) return null
  const noun = found === 1 ? 'person' : 'people'
  return (
    <div
      className={cn(
        'flex justify-start px-2 py-2',
        // Nothing above it while folded: the card's own rule is the top edge.
        (shown > 0 || expanded) && 'border-t border-[var(--core-color-border-divider)]'
      )}
    >
      <ActionButton variant="quiet" size="compact" onClick={onToggle}>
        {expanded ? `Hide found ${noun}` : `Show ${found} found ${noun}`}
      </ActionButton>
    </div>
  )
}

const PersonRow = ({ r, ctx }: { r: AttributeRow; ctx: CellContext }) => {
  const Icon = /registered agent/i.test(r.label) ? Landmark : UserRound
  // Their titles as the filings give them; with none, what they are to the business.
  const roles = r.titles?.length ? r.titles : [roleOf(r)]
  return (
    <div className="grid grid-cols-1 items-start gap-x-4 gap-y-2 bg-[image:var(--dash-rule-x)] bg-[length:100%_1px] bg-[position:left_bottom] bg-no-repeat px-4 py-3 last:bg-none md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-0">
          {/* What they are to the business, over the name. */}
          <span className="block text-caption text-text-secondary">{roleOf(r)}</span>
          <div className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-text-primary">
            <span className="truncate">{filedName(r.value)}</span>
            {r.submitted && (
              <span
                role="img"
                aria-label={corroborated(r) ? 'Verified' : 'Unverified'}
                className="flex shrink-0"
              >
                <StatusDot intent={corroborated(r) ? 'success' : 'warning'} />
              </span>
            )}
          </div>
          {/* Who attests them, under the name: Submitted, and the records that name them. */}
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-caption text-text-secondary">
            <RowProvenance
              row={r}
              domesticState={ctx.domesticState}
              submitted={r.submitted ? { verified: corroborated(r), by: verifiedBy(r) } : undefined}
              plainClaim
              onJumpToSource={ctx.onJumpToSource}
            />
          </span>
        </div>
      </div>
      {/* Every title the records give them, one chip each. */}
      <span className="flex flex-wrap items-center gap-1.5">
        {roles.map((role) => (
          <MetaChip key={role} tone="neutral" size="compact">
            {role}
          </MetaChip>
        ))}
      </span>
    </div>
  )
}

/**
 * Everyone on the record, as the viewer chose to see them: a list — the name,
 * the records that name them and their titles, their role — or the grid of
 * their cells. Everyone submitted shows — or, with no one submitted, the first
 * person found — and the rest of those found fold away.
 */
export const PeopleView = ({
  people,
  ctx,
  view = 'list'
}: {
  people: AttributeRow[]
  ctx: CellContext
  view?: PeopleViewMode
}) => {
  const [expanded, setExpanded] = useState(false)
  // Everyone submitted always shows — the verified first, then the rest —
  // and with no one submitted, the first person found: the card is never
  // only a fold.
  const submitted = people.filter((r) => r.submitted)
  const lead = submitted.length || (people.length > 0 ? 1 : 0)
  const rows = [
    ...submitted.filter((r) => corroborated(r)),
    ...submitted.filter((r) => !corroborated(r)),
    ...people.filter((r) => !r.submitted)
  ]
  if (rows.length === 0) return null
  const shown = expanded ? rows : rows.slice(0, lead)

  if (view === 'grid') {
    return (
      <div className="border-t border-[var(--core-color-border-divider)]">
        {shown.length > 0 && (
          <div className="overflow-hidden">
            <AttributeCells
              className="-mb-px"
              columns={2}
              items={cellsFromRows(shown, { ...ctx, allTitles: true })}
            />
          </div>
        )}
        <ShowFoundPeople
          total={rows.length}
          shown={lead}
          expanded={expanded}
          onToggle={() => setExpanded(!expanded)}
        />
      </div>
    )
  }

  return (
    <div className="border-t border-[var(--core-color-border-divider)]">
      {shown.length > 0 && (
      <div className="hidden gap-x-4 border-b border-[var(--core-color-border-divider)] px-4 py-2.5 md:grid md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <span className="text-caption font-medium uppercase tracking-wide text-text-secondary">
          People
        </span>
        <span className="text-caption font-medium uppercase tracking-wide text-text-secondary">
          Roles
        </span>
      </div>
      )}
      {shown.map((r, i) => (
        <PersonRow key={`${r.value}-${i}`} r={r} ctx={ctx} />
      ))}
      <ShowFoundPeople
        total={rows.length}
        shown={lead}
        expanded={expanded}
        onToggle={() => setExpanded(!expanded)}
      />
    </div>
  )
}
