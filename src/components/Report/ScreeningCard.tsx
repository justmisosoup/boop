import { useMemo, type ReactNode } from 'react'
import { ArrowUpRight, Check, Minus, TriangleAlert } from 'lucide-react'

import { ChatSourceChip, ChatSources, MetaChip } from '@/core'

import { AttributeCells } from '../AttributeGrid'
import { Strip } from './Strip'

import type { BusinessRecord } from '../../lib/deriveResults'
import { SCREENS, screeningOf, type Dismissal, type Finding } from '../../lib/screening'
import { cn } from '../../utils/twUtils'

const icon = { 'aria-hidden': true, size: 12, strokeWidth: 2, className: 'shrink-0' } as const

/**
 * An adverse-media result's articles, as the source chip: it reads
 * "Articles +8", and opens to every article — its headline, its outlet —
 * each opening in a new tab.
 */
const ArticlesChip = ({ list }: { list: NonNullable<Finding['articles']> }) => (
  // "Articles · 4", each publication's own mark stacked on the trigger; each
  // row the headline, its publication under it, and the out-arrow: it opens
  // the article elsewhere.
  <ChatSources
    label="Articles"
    sources={list.map((a, i) => ({
      id: `${a.url ?? a.title}-${i}`,
      label: a.source ?? a.title,
      domain: a.source ?? undefined,
      title: a.title,
      url: a.url ?? undefined,
      badge: a.url ? (
        <ArrowUpRight aria-label="Opens in a new tab" size={12} strokeWidth={2} className="text-text-secondary" />
      ) : undefined
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

type Row = (Finding & { hit: true }) | (Dismissal & { hit: false })

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
      // Why it counts or not — the strip already names the screen.
      left: (
        <span className="flex min-w-0 flex-col gap-0.5">
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

  /* One strip per screen — sanctions and watchlists, PEP, adverse media — as
     the record's filings, locations and classifications are shown: a tile
     per name the screen ran on, red where it hit, grey with a dash where
     every result was dismissed, grey with a check where nothing came back.
     Opening a tile shows that name's results on that screen. The first hit
     opens from the start. */
  const names = [...new Set([...groups.map((g) => g.lead.against), ...s.clean.map((c) => c.name)])]
  const strips = SCREENS.map((screen) => {
    const tiles = names.flatMap((name) => {
      const g = groups.find((x) => x.lead.against === name && x.lead.screen === screen.id)
      const ran = Boolean(g) || s.clean.some((c) => c.name === name && c.screens.includes(screen.id))
      if (!ran) return []
      const hits = g ? g.results.filter((r) => r.hit).length : 0
      const state: 'hit' | 'dismissed' | 'clear' = hits > 0 ? 'hit' : g ? 'dismissed' : 'clear'
      return [{ key: `${screen.id}|${name}`, name, state, hits, group: g }]
    })
    return { screen, tiles }
  }).filter((x) => x.tiles.length > 0)
  if (strips.length === 0) return null

  /* Under each screen, the three outcomes as tiles — hits, dismissed, no
     results — each counted, each opening to the names in that state: the
     name, its chip, what came back and why it counts or not. Hits open from
     the start. */
  const STATES: Array<{ id: 'hit' | 'dismissed' | 'clear'; label: string; tone: 'danger' | 'neutral'; mark: ReactNode }> = [
    { id: 'hit', label: 'Hits', tone: 'danger', mark: <TriangleAlert {...icon} /> },
    { id: 'dismissed', label: 'Dismissed', tone: 'neutral', mark: <Minus {...icon} /> },
    { id: 'clear', label: 'No results', tone: 'neutral', mark: <Check {...icon} /> }
  ]
  return (
    <div className="border-b border-[var(--core-color-border-divider)]">
      {strips.map(({ screen, tiles }) => {
        const states = STATES.filter((st) => tiles.some((t) => t.state === st.id))
        return (
          <Strip
            key={screen.id}
            label={screen.label}
            open={tiles.some((t) => t.state === 'hit') ? `${screen.id}|hit` : undefined}
            tiles={states.map((st) => {
              const n = tiles.filter((t) => t.state === st.id).length
              return {
                key: `${screen.id}|${st.id}`,
                chip: (
                  <MetaChip tone={st.tone} size="compact">
                    {st.mark}
                    {st.id === 'hit' ? (n === 1 ? '1 hit' : `${n} hits`) : st.label}
                    {st.id !== 'hit' && <span className="tabular-nums text-text-secondary">{n}</span>}
                  </MetaChip>
                )
              }
            })}
            detail={(key) => {
              const state = key.split('|')[1]
              const here = tiles.filter((t) => t.state === state)
              return (
                <AttributeCells
                  className="-mb-px"
                  items={here.map((t) => {
                    if (!t.group)
                      return { key: t.key, label: t.name, span: 'full' as const, values: [{ value: <span className="text-text-secondary">No results</span> }] }
                    const row = screenRow(t.group, t.state === 'hit')
                    return {
                      key: t.key,
                      label: t.name,
                      span: 'full' as const,
                      badge: t.state === 'hit' ? <HitChip count={t.hits} /> : <DismissedChip />,
                      // What came back, then why it counts or not.
                      values: [{ value: row.right, note: row.left }]
                    }
                  })}
                />
              )
            }}
          />
        )
      })}
    </div>
  )
}
