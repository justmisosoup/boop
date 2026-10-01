import { useId, useMemo, useState, type ReactNode } from 'react'
import { ArrowUpRight, Building2, ChevronDown, TriangleAlert, User } from 'lucide-react'

import { ChatSourceChip, MetaChip, type ChatSourceData } from '@/core'

import type { BusinessRecord } from '../../lib/deriveResults'
import { filingsListing, provenanceList } from '../../lib/attributes'
import { screenedOf, type MediaHit, type PepHit, type ScreenedName, type WatchlistHit } from '../../lib/screening'
import { AttributeSources } from '../Provenance'
import { cn } from '../../utils/twUtils'
import { AttributeCells, type AttributeCell } from '../AttributeGrid'
import { Collapsible } from '../Collapsible'

const icon = { 'aria-hidden': true, size: 12, strokeWidth: 2, className: 'shrink-0' } as const
const out = <ArrowUpRight aria-label="Opens in a new tab" size={12} strokeWidth={2} className="text-text-secondary" />

const HitChip = ({ count }: { count: number }) => (
  <MetaChip tone="danger" size="compact">
    <TriangleAlert {...icon} />
    {count} {count === 1 ? 'hit' : 'hits'}
  </MetaChip>
)

/** "1963-08-21" as Aug 21 1963; "1950-00-00" as 1950. */
const born = (dob: string) => {
  const [y, m, d] = dob.split('-').map(Number)
  if (!m) return String(y)
  const month = new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'short' })
  return d ? `${month} ${d} ${y}` : `${month} ${y}`
}
const pct = (score: number | null | undefined, outOf: 1 | 100) =>
  typeof score === 'number' ? `${Math.round(outOf === 1 ? score * 100 : score)}%` : undefined
const words = (s: string) => s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '')
  } catch {
    return 'Source'
  }
}

/**
 * One screen as a row: the screen's name, its count, and on the right what
 * was screened — then, open, its results in the platform's own shape.
 * A screen with hits opens from the start; a clean one is its one line.
 */
const ScreenRow = ({ label, hits, coverage, ran, children }: { label: string; hits: number; coverage: string; ran: boolean; children?: ReactNode }) => {
  const [open, setOpen] = useState(hits > 0)
  const id = useId()
  const openable = hits > 0
  return (
    <div className="border-t border-[var(--core-color-border-divider)]">
      <button
        type="button"
        aria-expanded={openable ? open : undefined}
        aria-controls={openable ? id : undefined}
        onClick={() => openable && setOpen((v) => !v)}
        disabled={!openable}
        className={cn(
          'flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring',
          openable && 'hover:bg-[var(--core-color-list-item-hover-bg)]'
        )}
      >
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <span>{label}</span>
          {hits > 0 ? <HitChip count={hits} /> : <span className="text-text-secondary">{ran ? 'No hits' : 'Not screened'}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-3">
          <span className="text-caption text-text-secondary">{coverage}</span>
          {openable && (
            <ChevronDown aria-hidden="true" size={14} strokeWidth={2} className={cn('shrink-0 text-text-secondary transition-transform', open && 'rotate-180')} />
          )}
        </span>
      </button>
      {openable && (
        <Collapsible open={open} id={id}>
          <div className="border-t border-[var(--core-color-border-divider)]">{children}</div>
        </Collapsible>
      )}
    </div>
  )
}

/** The record's own source names that are not the filing chip's or the submission's. */
const OTHER_SOURCES = (who: ScreenedName) =>
  provenanceList({ sources: who.sources }).filter((n) => !/^(state registration|registration|submitted by the customer|submitted)$/i.test(n))

/**
 * Where the record holds the name, as a source chip beside it: the filings
 * that name it ("SOS · VA"), then any other record ("SOS document", "Form
 * 5500"). The same chip every other cell carries; nothing when the name is
 * only the customer's.
 */
const Seen = ({ who, record, onJumpToSource }: { who: ScreenedName; record: BusinessRecord; onJumpToSource?: (cardId: string) => void }) => {
  const byRef = (who.refs ?? [])
    .filter((r) => r.type === 'registration')
    .map((r) => {
      const m = (r.metadata ?? {}) as { state?: string; file_number?: string }
      return record.registrations.find((g) => g.state === m.state && (!m.file_number || g.fileNumber === m.file_number))
    })
    .filter((g): g is BusinessRecord['registrations'][number] => Boolean(g))
  const byName = who.kind === 'person' ? filingsListing(record, who.name, 'officers') : []
  const filings = [...new Set([...byRef, ...byName])]
  const others = OTHER_SOURCES(who)
  if (filings.length === 0 && others.length === 0) return null
  return (
    <AttributeSources
      sources={others}
      registrations={filings}
      domesticState={record.formation?.state}
      refs={(who.refs ?? []).filter((r) => r.type !== 'registration').map((r) => ({ ...r, metadata: r.metadata ?? {} }))}
      onJumpToSource={onJumpToSource}
    />
  )
}

/**
 * Whom the result is for, as the block's heading: the name screened in the
 * card's own weight on a quiet band with where the record holds it beside
 * it, and on the right the result's own facts — its match score, its list.
 */
const NameRow = ({
  who,
  record,
  onJumpToSource,
  children
}: {
  who: ScreenedName
  record: BusinessRecord
  onJumpToSource?: (cardId: string) => void
  children?: ReactNode
}) => (
  <div className="flex items-center justify-between gap-3 border-b border-[var(--core-color-border-divider)] bg-[var(--core-color-bg-secondary)] px-4 py-2.5">
    <span className="flex min-w-0 flex-wrap items-center gap-2">
      {who.kind === 'person' ? (
        <User aria-hidden="true" size={14} strokeWidth={2} className="shrink-0 text-text-secondary" />
      ) : (
        <Building2 aria-hidden="true" size={14} strokeWidth={2} className="shrink-0 text-text-secondary" />
      )}
      <span className="text-sm font-semibold leading-5 text-text-primary">{who.name}</span>
      <Seen who={who} record={record} onJumpToSource={onJumpToSource} />
    </span>
    <span className="flex shrink-0 flex-wrap items-center justify-end gap-x-2 gap-y-1 text-caption text-text-secondary">{children}</span>
  </div>
)

type BlockContext = { record: BusinessRecord; onJumpToSource?: (cardId: string) => void }

const cells = (items: Array<AttributeCell | false | null | undefined>) => items.filter((c): c is AttributeCell => Boolean(c))
const text = (key: string, label: string, value: ReactNode | null | undefined, extra?: Partial<AttributeCell>): AttributeCell | false =>
  value ? { key, label, values: [{ value }], ...extra } : false
const lines = (xs: string[] | undefined) => (xs && xs.length > 0 ? xs.join(', ') : undefined)

/** A watchlist hit as the list carries it: the entry, with its list's chip. */
const WatchlistBlock = ({ who, hit, ctx }: { who: ScreenedName; hit: WatchlistHit; ctx: BlockContext }) => {
  const listLabel = [hit.list.agencyAbbr, hit.list.abbr].filter(Boolean).join(' · ') || hit.list.title || 'Watchlist'
  const sources: ChatSourceData[] = []
  if (hit.url) sources.push({ id: `${hit.id}-entry`, label: listLabel, domain: listLabel, title: hit.entityName ?? 'Listed entity', url: hit.url, annotation: hit.list.title ?? 'Entry', badge: out })
  if (hit.agencyListUrl && hit.agencyListUrl !== hit.url)
    sources.push({ id: `${hit.id}-list`, label: hit.list.abbr ?? 'List', domain: hit.list.abbr ?? undefined, title: hit.list.title ?? 'List', url: hit.agencyListUrl, annotation: hit.list.agency ?? 'List', badge: out })
  if (hit.agencyInfoUrl && hit.agencyInfoUrl !== hit.url)
    sources.push({ id: `${hit.id}-agency`, label: hit.list.agencyAbbr ?? 'Agency', domain: hit.list.agencyAbbr ?? undefined, title: hit.list.agency ?? 'Agency', url: hit.agencyInfoUrl, annotation: hit.list.organization ?? 'Agency', badge: out })
  return (
    <div className="border-b border-[var(--core-color-border-divider)] last:border-b-0">
      <NameRow who={who} record={ctx.record} onJumpToSource={ctx.onJumpToSource}>
        {pct(hit.score, 100) && <span>Match score {pct(hit.score, 100)}</span>}
        {sources.length > 0 && <ChatSourceChip sources={sources} />}
      </NameRow>
      <AttributeCells
        className="-mb-px"
        items={cells([
          {
            key: 'entity',
            label: 'Listed entity',
            span: 'full',
            values: [
              {
                value: hit.entityName ?? 'Unnamed entry',
                note: hit.aliases && hit.aliases.length > 0 ? <span className="text-caption text-text-secondary">Also as {hit.aliases.join('; ')}</span> : undefined
              }
            ]
          },
          text('list', 'List', [hit.list.title, hit.list.agency].filter(Boolean).join(' · ')),
          text('address', 'Address', lines(hit.addresses)),
          text('listed', 'Listed', hit.listedAt ? born(hit.listedAt.slice(0, 10)) : undefined),
          hit.status && !/^included$/i.test(hit.status) ? text('status', 'Status', words(hit.status)) : false
        ])}
      />
    </div>
  )
}

/** A PEP result as the provider carries it: who the listed person is. */
const PepBlock = ({ who, hit, ctx }: { who: ScreenedName; hit: PepHit; ctx: BlockContext }) => {
  const urls = hit.sourceUrls && hit.sourceUrls.length > 0 ? hit.sourceUrls : hit.url ? [hit.url] : []
  const type = hit.hitType === 'association' ? 'Association' : hit.hitType === 'direct_alias' ? 'Direct hit (alias)' : hit.hitType === 'direct' ? 'Direct hit' : undefined
  const sub = type
  return (
    <div className="border-b border-[var(--core-color-border-divider)] last:border-b-0">
      <NameRow who={who} record={ctx.record} onJumpToSource={ctx.onJumpToSource}>
        {pct(hit.score, 1) && <span>Match score {pct(hit.score, 1)}</span>}
        {urls.length > 0 && (
          <ChatSourceChip
            sources={urls.map((u, i) => ({ id: `${hit.id}-src-${i}`, label: 'PEP', domain: 'PEP', title: hit.name ?? 'Listed person', url: u, annotation: host(u), badge: out }))}
          />
        )}
      </NameRow>
      <AttributeCells
        className="-mb-px"
        items={cells([
          {
            key: 'name',
            label: 'Listed person',
            span: 'full',
            values: [{ value: hit.name ?? 'Unnamed', note: sub ? <span className="text-caption text-text-secondary">{sub}</span> : undefined }]
          },
          text('dob', 'Date of birth', hit.dob ? born(hit.dob) : undefined),
          text('birthplace', 'Birth place', hit.birthPlace),
          text('citizenship', 'Citizenship', hit.citizenship),
          text('birthname', 'Birth name', hit.birthName),
          text('history', 'Professional history', lines(hit.professionalHistory), { span: 'full' }),
          text('employers', 'Employers', lines(hit.employers)),
          text('memberships', 'Memberships', lines(hit.memberships)),
          text('aliases', 'Aliases', lines(hit.aliases)),
          text('stakeholders', 'Stakeholders', lines(hit.stakeholders), { span: 'full' })
        ])}
      />
    </div>
  )
}

const SHOW = 5
const HEAD = 'px-4 pb-2 pt-3 text-caption leading-snug text-text-secondary'
const CELL = 'px-4 py-3 text-sm leading-snug'

/** An adverse-media result: the match, then its articles as a compact table. */
const MediaBlock = ({ who, hit, ctx }: { who: ScreenedName; hit: MediaHit; ctx: BlockContext }) => {
  const [all, setAll] = useState(false)
  const items = all ? hit.items : hit.items.slice(0, SHOW)
  const more = hit.items.length - SHOW
  return (
    <div className="border-b border-[var(--core-color-border-divider)] last:border-b-0">
      <NameRow who={who} record={ctx.record} onJumpToSource={ctx.onJumpToSource}>
        <span>
          {[typeof hit.matchScore === 'number' && `Match score ${pct(hit.matchScore, 1)}`, `${hit.items.length} ${hit.items.length === 1 ? 'article' : 'articles'}`]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </NameRow>
      <div role="table" className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
        <div role="row" className="contents">
          <span role="columnheader" className={HEAD}>Article</span>
          <span role="columnheader" className={HEAD}>Risks</span>
          <span role="columnheader" className={HEAD}>Sentiment</span>
        </div>
        {items.map((it, i) => (
          <div role="row" key={`${it.url ?? it.title}-${i}`} className="contents">
            <div aria-hidden="true" className="col-span-full h-px bg-[var(--core-color-border-divider)]" />
            <span role="cell" className={cn(CELL, 'flex flex-col gap-0.5 break-words')}>
              {it.url ? (
                <a href={it.url} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 hover:underline">
                  <span>{it.title ?? it.sourceName ?? 'Untitled'}</span>
                  {out}
                </a>
              ) : (
                <span>{it.title ?? it.sourceName ?? 'Untitled'}</span>
              )}
              {it.sourceName && it.title && <span className="text-caption text-text-secondary">{it.sourceName}</span>}
            </span>
            <span role="cell" className={cn(CELL, 'flex flex-col gap-0.5 text-text-secondary')}>
              {it.risks && it.risks.length > 0
                ? it.risks.map((r, j) => (
                    <span key={j}>
                      {words(r.name)}
                      {r.confidence && <span className="text-caption"> · {r.confidence}</span>}
                    </span>
                  ))
                : '—'}
            </span>
            <span role="cell" className={cn(CELL, 'text-text-secondary')}>{it.sentiment ? words(it.sentiment) : 'Neutral'}</span>
          </div>
        ))}
      </div>
      {more > 0 && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="w-full border-t border-[var(--core-color-border-divider)] px-4 py-2 text-left text-caption text-text-secondary hover:text-text-primary"
        >
          {all ? 'Show fewer' : `Show ${more} more`}
        </button>
      )}
    </div>
  )
}

/**
 * The compliance screens, as the platform reports them: one row per screen —
 * sanctions and watchlists, politically exposed persons, adverse media — each
 * saying how many results came back and what was screened, and opening to
 * every result in that screen's own shape. Nothing is dismissed here; the
 * analyst dispositions.
 */
export const ScreeningResults = ({ record, onJumpToSource }: { record: BusinessRecord; onJumpToSource?: (cardId: string) => void }) => {
  const s = useMemo(() => screenedOf(record), [record])
  const ctx: BlockContext = { record, onJumpToSource }
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
  if (!s.watchlist.ran && !s.pep.ran && !s.media.ran) return null
  return (
    <div className="border-b border-[var(--core-color-border-divider)]">
      <ScreenRow
        label="Sanctions & watchlists"
        hits={s.watchlist.hits.length}
        ran={s.watchlist.ran}
        coverage={[count(s.watchlist.names.length, 'name', 'names'), s.watchlist.lists > 0 && count(s.watchlist.lists, 'list', 'lists')].filter(Boolean).join(' · ')}
      >
        {s.watchlist.hits.map((h, i) => (
          <WatchlistBlock key={`${h.hit.id}-${i}`} who={h} hit={h.hit} ctx={ctx} />
        ))}
      </ScreenRow>
      <ScreenRow
        label="Politically exposed persons"
        hits={s.pep.hits.length}
        ran={s.pep.ran}
        coverage={s.pep.names.length > 0 ? count(s.pep.names.length, 'person', 'people') : 'No people submitted'}
      >
        {s.pep.hits.map((h, i) => (
          <PepBlock key={`${h.hit.id}-${i}`} who={h} hit={h.hit} ctx={ctx} />
        ))}
      </ScreenRow>
      <ScreenRow label="Adverse media" hits={s.media.hits.length} ran={s.media.ran} coverage={count(s.media.names.length, 'name', 'names')}>
        {s.media.hits.map((h, i) => (
          <MediaBlock key={`${h.hit.id}-${i}`} who={h} hit={h.hit} ctx={ctx} />
        ))}
      </ScreenRow>
    </div>
  )
}
