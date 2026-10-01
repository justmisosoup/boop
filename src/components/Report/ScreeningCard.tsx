import { useMemo, useState, type ReactNode } from 'react'
import { Check, ChevronDown, Minus, TriangleAlert } from 'lucide-react'

import { ChatSourceChip, MetaChip } from '@/core'

import type { BusinessRecord } from '../../lib/deriveResults'
import { SCREENS, screeningOf, type Dismissal, type Finding, type Screen } from '../../lib/screening'
import { cn } from '../../utils/twUtils'

const icon = { 'aria-hidden': true, size: 12, strokeWidth: 2, className: 'shrink-0' } as const

const screenLabel = (id: Finding['screen']) => SCREENS.find((s) => s.id === id)?.label ?? id

/**
 * An adverse-media result's articles, as the source chip: it reads
 * "Articles +8", and opens to every article — its headline, its outlet —
 * each opening in a new tab.
 */
const ArticlesChip = ({ list }: { list: NonNullable<Finding['articles']> }) => (
  <ChatSourceChip
    sources={list.map((a, i) => ({
      id: `${a.url ?? a.title}-${i}`,
      label: a.title,
      domain: 'Articles',
      title: a.title,
      url: a.url ?? undefined,
      annotation: a.source ?? 'Adverse media'
    }))}
  />
)

const CONFIDENCE: Array<{ id: 'high' | 'moderate' | 'low' | null; label: string }> = [
  { id: 'high', label: 'High confidence' },
  { id: 'moderate', label: 'Medium confidence' },
  { id: 'low', label: 'Low confidence' },
  { id: null, label: 'No confidence given' }
]

/**
 * What the articles are about, theme by theme, grouped by the provider's
 * confidence — high, medium, low — each theme followed by the articles that
 * raise it, as their source chip. The group's name rides on its first theme,
 * so a row folded to one line still says which group it opens on.
 */
const topicLines = (m: Finding | Dismissal): ReactNode[] =>
  m.topics && m.topics.length > 0
    ? CONFIDENCE.flatMap((c) =>
        (m.topics ?? [])
          .filter((t) => t.confidence === c.id)
          .map((t, i) => (
            <span key={`${c.label}-${t.name}`} className={cn('flex flex-col', i === 0 && 'mt-1 first:mt-0')}>
              {i === 0 && <span className="text-caption text-text-secondary">{c.label}</span>}
              <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <span>{t.name}</span>
                <ArticlesChip list={t.items} />
              </span>
            </span>
          ))
      )
    : [
        <span key="none" className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <span className="text-text-secondary">No topic flagged</span>
          {m.articles && <ArticlesChip list={m.articles} />}
        </span>
      ]

/** A row's lines, all of them. */
const RowList = ({ lines }: { lines: ReactNode[] }) => <span className="flex flex-col gap-1">{lines}</span>

/** The watchlist a hit is on, as a source chip opening the list. */
const ListChip = ({ m }: { m: Finding | Dismissal }) => (
  <ChatSourceChip
    sources={[
      {
        id: `${m.id}-list`,
        label: m.source ?? m.list?.title ?? 'Watchlist',
        domain: m.source ?? undefined,
        title: m.list?.title ?? m.source ?? 'Watchlist',
        url: m.url ?? undefined,
        annotation: m.list?.agency ?? 'Watchlist'
      }
    ]}
  />
)

/** A PEP result's source, as a chip — a link where the provider gave one. */
const PepChip = ({ m }: { m: Finding | Dismissal }) => (
  <ChatSourceChip
    sources={[
      {
        id: `${m.id}-pep`,
        label: 'PEP',
        domain: 'PEP',
        title: m.matched,
        url: m.url ?? undefined,
        annotation: m.source ?? 'PEP provider'
      }
    ]}
  />
)

/** "1963-08-21" as Aug 21 1963; "1950-00-00" as 1950. */
const born = (dob: string) => {
  const [y, m, d] = dob.split('-').map(Number)
  if (!m) return String(y)
  const month = new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'short' })
  return d ? `${month} ${d} ${y}` : `${month} ${y}`
}

/** Who a PEP result is: born, where, citizenship, and the roles behind the
 *  listing — what tells a reviewer whether it is the person on the record. */
const PepFacts = ({ p }: { p: NonNullable<Finding['person']> }) => {
  const id = [
    p.dob && `Born ${born(p.dob)}`,
    p.birthPlace && p.birthPlace,
    p.citizenship && p.citizenship
  ].filter(Boolean)
  return (
    <span className="flex flex-col text-caption text-text-secondary">
      {id.length > 0 && <span>{id.join(' · ')}</span>}
      {p.roles.length > 0 && <span>{p.roles.slice(0, 2).join(' · ')}{p.roles.length > 2 ? ` +${p.roles.length - 2}` : ''}</span>}
      {p.hitType === 'association' && <span>Listed as an associate, not the person</span>}
    </span>
  )
}

/** The two columns: who and why on the left, what came back on the right. */
const COLS = 'sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]'

type Row = (Finding & { hit: true }) | (Dismissal & { hit: false })

/** One person, or one business name: a header — the name, its status — then
 *  a row per screen: the screen and why on the left, its results on the right. */
type Person = { key: string; name: string; status?: ReactNode; screens: Array<{ key: string; left: ReactNode; right: ReactNode }> }

/** A cell closing a name's block: a solid rule under it in place of the dash. */
const SOLID_END = '![background-image:none] border-b border-[var(--core-color-border-divider)]'
/** The same, keeping the dashed rule between the two columns. */
const SOLID_END_COLUMN = '![background-image:var(--dash-rule-y)] border-b border-[var(--core-color-border-divider)]'

const Cell = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <div className={cn('attribute-cell min-w-0 break-words px-4 py-3 text-sm text-text-primary', className)}>{children}</div>
)

/** One name's block: its header, which opens and closes its screen rows. */
const PersonRows = ({ p, defaultOpen = true }: { p: Person; defaultOpen?: boolean }) => {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="contents">
      {/* A name's block ends on the card's solid rule: here when closed. */}
      <Cell className={cn('sm:col-span-2', !open && SOLID_END)}>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <span className="min-w-0 font-medium">{p.name}</span>
          {/* Its status, then the dropdown, at the row's far right. */}
          <span className="flex shrink-0 items-center gap-2">
            {p.status}
            <ChevronDown
              aria-hidden="true"
              size={14}
              strokeWidth={2}
              className={cn('shrink-0 text-text-secondary transition-transform', open && 'rotate-180')}
            />
          </span>
        </button>
      </Cell>
      {/* Each name's own column heads, over its own rows. */}
      {open && p.screens.length > 0 && (
        <div className="hidden sm:contents">
          {['Screened', 'Results'].map((h) => (
            <span key={h} className="attribute-cell px-4 pb-1.5 pt-2 text-caption text-text-secondary">
              {h}
            </span>
          ))}
        </div>
      )}
      {open &&
        p.screens.map((sc, i) => {
          // …and under its last row when open.
          const last = i === p.screens.length - 1
          return (
            <div key={sc.key} className="contents">
              <Cell className={cn('max-sm:[background-image:none] max-sm:pb-0', last && SOLID_END_COLUMN)}>{sc.left}</Cell>
              <Cell className={cn(last && SOLID_END_COLUMN)}>{sc.right}</Cell>
            </div>
          )
        })}
    </div>
  )
}

const Table = ({ people, closed }: { people: Person[]; closed?: boolean }) => (
  <>
    {/* Under its last row the card's solid rule, not the cells' dashed one. */}
    <div className={cn('-mb-px -mr-px grid grid-cols-1', COLS)}>
      {people.map((p) => (
        <PersonRows key={p.key} p={p} defaultOpen={!closed} />
      ))}
    </div>
  </>
)

const HitChip = ({ count = 1 }: { count?: number }) => (
  <MetaChip tone="warning" size="compact">
    <TriangleAlert {...icon} />
    {count} {count === 1 ? 'hit' : 'hits'}
  </MetaChip>
)
const DismissedChip = () => (
  <MetaChip tone="neutral" size="compact">
    <Minus {...icon} />
    Dismissed
  </MetaChip>
)
/**
 * The compliance screens, as the dashboard's screening cards list them —
 * every business name and every person screened.
 *
 * One block per name: its status, then a row per screen — the screen and why
 * it counts or not on the left, what it returned on the right, each result
 * with its source as a chip. Only the hits are in view (`screeningOf`); the
 * dismissed, then every name with nothing back, are behind one line.
 */
export const ScreeningResults = ({ record }: { record: BusinessRecord }) => {
  const s = useMemo(() => screeningOf(record), [record])
  const all: Row[] = [
    ...s.findings.map((f) => ({ ...f, hit: true as const })),
    ...s.dismissed.map((d) => ({ ...d, hit: false as const }))
  ]
  if (all.length === 0 && s.clean.length === 0) return null

  /* By name and screen: the PEP screen's three results for David Johnson
     are one screen row listing the three names. Each outcome is said once,
     however many results share it. */
  const groups: Array<{ key: string; lead: Row; results: Row[] }> = []
  for (const r of all) {
    const key = `${r.against}|${r.screen}`
    const g = groups.find((x) => x.key === key)
    if (g) g.results.push(r)
    else groups.push({ key, lead: r, results: [r] })
  }

  const screenRow = ({ key, lead: r, results }: (typeof groups)[number], rowHit: boolean) => {
    const outcomes = [...new Map(results.map((x) => [`${x.hit}|${x.reason}`, x])).values()]
    return {
      key,
      // The screen, and why it counts or not. The status is the name's.
      left: (
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-caption font-medium text-text-secondary">{screenLabel(r.screen)}</span>
          {outcomes.map((x) => (
            <span key={`${x.hit}|${x.reason}`} className="text-caption text-text-secondary">
              {x.reason}
            </span>
          ))}
        </span>
      ),
      right: (
        // What it returned.
        <span className="flex min-w-0 flex-col gap-1">
        <RowList
          lines={results.flatMap((x) =>
            x.topics || x.articles
              ? topicLines(x)
              : [
                  // Each result with its source beside it, and for a PEP who
                  // the listed person is.
                  <span key={x.id} className="flex flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                      <span>{x.matched}</span>
                      {x.list ? <ListChip m={x} /> : x.screen === 'pep' ? <PepChip m={x} /> : null}
                    </span>
                    {x.person && <PepFacts p={x.person} />}
                  </span>
                ]
          )}
        />
        </span>
      )
    }
  }

  /* One block per name: everything the screens returned on Manuel
     Rodriguez — the watchlists, PEP, adverse media — under his name. The
     status is the name's: a hit if any screen hit. */
  const names = [...new Set(groups.map((g) => g.lead.against))]
  const isHit = (name: string) => groups.some((g) => g.lead.against === name && g.results.some((r) => r.hit))
  // A screen that came back with nothing, as a row under the name it ran on.
  const noResults = (screen: Screen) => ({
    key: screen,
    left: <span className="text-caption font-medium text-text-secondary">{screenLabel(screen)}</span>,
    right: <span className="text-text-secondary">No results</span>
  })
  /* In view, only what hit: a name's hit screens. Its dismissed screens —
     Michael McCrory's watchlist near miss — go below with the rest. */
  const groupHit = (g: (typeof groups)[number]) => g.results.some((r) => r.hit)
  const personFor = (name: string, hit: boolean): Person => ({
    key: `${hit ? 'hit' : 'dismissed'}|${name}`,
    name,
    // Every hit on the name, counted — the card's title is their sum.
    status: hit ? <HitChip count={s.findings.filter((f) => f.against === name).length} /> : <DismissedChip />,
    screens: groups.filter((g) => g.lead.against === name && groupHit(g) === hit).map((g) => screenRow(g, hit))
  })
  const hits = names.filter(isHit).map((n) => personFor(n, true))
  const dismissed = names
    .filter((n) => groups.some((g) => g.lead.against === n && !groupHit(g)))
    .map((n) => personFor(n, false))

  /* Every screen that came back with nothing, under the name it ran on —
     Jose Ornelas's PEP and adverse media too, though his watchlist hit is
     above: the hits are only what hit. Each a row reading no results. */
  const clean: Person[] = s.clean.map((c) => ({
      key: `clean|${c.name}`,
      name: c.name,
      status: (
        <MetaChip tone="success" size="compact">
          <Check {...icon} />
          Clear
        </MetaChip>
      ),
      screens: c.screens.map(noResults)
    }))

  return <ScreeningViews hits={hits} dismissed={dismissed} clean={clean} />
}

/**
 * The hits in view, each name open; under them what was dismissed, each name
 * closed. The names with nothing back matter less, so they sit last, behind
 * one dropdown, closed.
 */
const ScreeningViews = ({ hits, dismissed, clean }: { hits: Person[]; dismissed: Person[]; clean: Person[] }) => {
  const [cleanOpen, setCleanOpen] = useState(false)
  const shown = hits.length > 0 || dismissed.length > 0
  if (!shown && clean.length === 0) return null
  return (
    <div className="border-t border-[var(--core-color-border-divider)]">
      {hits.length > 0 && <Table people={hits} />}
      {dismissed.length > 0 && (
        <div className={cn(hits.length > 0 && 'border-t border-[var(--core-color-border-divider)]')}>
          <Table people={dismissed} closed />
        </div>
      )}
      {clean.length > 0 && (
        <>
          <button
            type="button"
            aria-expanded={cleanOpen}
            onClick={() => setCleanOpen((v) => !v)}
            className={cn(
              'flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring',
              shown && 'border-t border-[var(--core-color-border-divider)]'
            )}
          >
            {clean.length} screened, no results
            <ChevronDown
              aria-hidden="true"
              size={14}
              strokeWidth={2}
              className={cn('shrink-0 transition-transform', cleanOpen && 'rotate-180')}
            />
          </button>
          {cleanOpen && (
            <div className="border-t border-[var(--core-color-border-divider)]">
              <Table people={clean} closed />
            </div>
          )}
        </>
      )}
    </div>
  )
}

