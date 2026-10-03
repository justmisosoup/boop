import { useMemo, useState, type ReactElement, type ReactNode } from 'react'
import { ArrowUpRight, Building2, Check, Circle, CircleMinus, CirclePlus, TriangleAlert, User } from 'lucide-react'

import { ChatSourceChip, MetaChip, type ChatSourceData } from '@/core'

import type { BusinessRecord } from '../../lib/deriveResults'
import { filingsListing, provenanceList } from '../../lib/attributes'
import { dismissalOf, screenedOf, screeningOf, type MediaHit, type PepHit, type Screen, type ScreenedName, type WatchlistHit } from '../../lib/screening'
import { Strip } from './Strip'
import { AttributeSources } from '../Provenance'
import { cn } from '../../utils/twUtils'
import { AttributeCells, type AttributeCell } from '../AttributeGrid'

const icon = { 'aria-hidden': true, size: 12, strokeWidth: 2, className: 'shrink-0' } as const
const out = <ArrowUpRight aria-label="Opens in a new tab" size={12} strokeWidth={2} className="text-text-secondary" />

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

/** References that point at a filing: the registration itself, and a parsed
 *  SOS document, which carries the state and file number of the filing it was
 *  read from. */
const FILING_REFS = new Set(['registration', 'parsed_sos_document'])

/** The record's own source names that are not the filing chip's or the submission's. */
const OTHER_SOURCES = (who: ScreenedName, documentsMatched: boolean) =>
  provenanceList({ sources: who.sources }).filter(
    (n) =>
      !/^(state registration|registration|submitted by the customer|submitted)$/i.test(n) &&
      !(documentsMatched && /^(sos document|parsed sos document)$/i.test(n))
  )

/**
 * Where the record holds the name, as a source chip beside it: the filings
 * that name it ("SOS · VA") — a parsed SOS document as the very filing it was
 * read from — then any other record ("Form 5500"). The same chip every other
 * cell carries; nothing when the name is only the customer's.
 */
const Seen = ({ who, record, onJumpToSource }: { who: ScreenedName; record: BusinessRecord; onJumpToSource?: (cardId: string) => void }) => {
  const filingOf = (r: { metadata?: Record<string, unknown> }) => {
    const m = (r.metadata ?? {}) as { state?: string; file_number?: string }
    return record.registrations.find((g) => g.state === m.state && (!m.file_number || g.fileNumber === m.file_number))
  }
  const refs = who.refs ?? []
  const byRef = refs.filter((r) => FILING_REFS.has(r.type)).map(filingOf)
  const documentsMatched = refs.some((r) => r.type === 'parsed_sos_document' && filingOf(r))
  const byName = who.kind === 'person' ? filingsListing(record, who.name, 'officers') : []
  const filings = [...new Set([...byRef, ...byName].filter((g): g is BusinessRecord['registrations'][number] => Boolean(g)))]
  const others = OTHER_SOURCES(who, documentsMatched)
  if (filings.length === 0 && others.length === 0) return null
  return (
    <AttributeSources
      sources={others}
      registrations={filings}
      domesticState={record.formation?.state}
      refs={refs
        .filter((r) => r.type !== 'registration' && !(r.type === 'parsed_sos_document' && filingOf(r)))
        .map((r) => ({ ...r, metadata: r.metadata ?? {} }))}
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
          // The list's chip on the List cell: the entry, the list and the
          // agency, each opening at the source.
          text('list', 'List', [hit.list.title, hit.list.agency].filter(Boolean).join(' · '), {
            badge: sources.length > 0 ? <ChatSourceChip sources={sources} /> : undefined
          }),
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

/**
 * An article's sentiment as a mark, not a word: negative a minus in a red
 * circle, positive a plus in a green one, neutral an empty grey circle. The
 * word stays as its accessible name.
 */
const Sentiment = ({ value }: { value?: string | null }) => {
  const v = (value ?? 'neutral').toLowerCase()
  const label = words(v)
  const props = { size: 16, strokeWidth: 2, role: 'img', 'aria-label': label } as const
  if (v === 'negative') return <CircleMinus {...props} className="text-[var(--core-color-text-danger)]"><title>{label}</title></CircleMinus>
  if (v === 'positive') return <CirclePlus {...props} className="text-[var(--core-color-text-success)]"><title>{label}</title></CirclePlus>
  return <Circle {...props} className="text-text-secondary"><title>{label}</title></Circle>
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
          <span role="columnheader" className={HEAD}>Level</span>
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
            {/* The sentiment heads the risks: its mark, then each risk the article raises. */}
            {/* Each risk the article raises on its own line, its sentiment mark
                at the head of every line and its level in a column of its own,
                level and risk on one row of a subgrid so a wrapped risk keeps
                its level beside it. A neutral article — no sentiment, no
                risks — says so in words and carries no mark. */}
            <span role="cell" className="col-span-2 grid grid-cols-subgrid content-start gap-y-1 py-3">
              {(it.risks && it.risks.length > 0 ? it.risks.map((r) => ({ key: r.name, text: words(r.name), level: r.confidence })) : [{ key: 'none', text: 'None listed', level: null }]).map(
                (line) => (
                  <span key={line.key} className="contents">
                    <span className="flex items-start gap-2 px-4 text-sm leading-snug text-text-secondary">
                      {/^(negative|positive)$/i.test(it.sentiment ?? '') && line.key !== 'none' && (
                        <span className="mt-px shrink-0">
                          <Sentiment value={it.sentiment} />
                        </span>
                      )}
                      <span>{line.text}</span>
                    </span>
                    <span className="whitespace-nowrap px-4 text-sm leading-snug text-text-secondary">{line.level ? words(line.level) : ''}</span>
                  </span>
                )
              )}
            </span>
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
type ScreenProps = { record: BusinessRecord; onJumpToSource?: (cardId: string) => void }

/** A name as the screens compare it. */
const nameKey = (n: string) => n.toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * One screen as chips, as the Addresses card draws its places: the results
 * still standing (Hits), the ones dismissed with the reason (`dismissalOf`:
 * excluded on the platform, or another name than the one screened), and the names
 * that came back with nothing (No results) — each only where there is one,
 * each opening to its results. Hits open from the start. The counts are the
 * card's only numbers: a separate tally of names screened read against them.
 */
const ScreenStrip = <H extends ScreenedName & { hit: { id: string; status?: string | null; entityName?: string | null; name?: string | null; aliases?: string[] | null } }>({
  screen,
  hits,
  record,
  block
}: {
  screen: Screen
  hits: H[]
  record: BusinessRecord
  block: (h: H, i: number) => ReactNode
}) => {
  const review = useMemo(() => screeningOf(record), [record])
  const reasonOf = (h: H) => dismissalOf(screen, h)
  const counted = hits.filter((h) => !reasonOf(h))
  const dismissed = hits.filter((h) => reasonOf(h))
  const clean = review.clean.filter((c) => c.screens.includes(screen))
  const tiles = [
    counted.length > 0 && {
      key: 'hits',
      chip: (
        <MetaChip tone="danger" size="compact">
          <TriangleAlert {...icon} />
          Hits
          <span className="tabular-nums">{counted.length}</span>
        </MetaChip>
      )
    },
    dismissed.length > 0 && {
      key: 'dismissed',
      chip: (
        <MetaChip tone="neutral" size="compact">
          <CircleMinus {...icon} />
          Dismissed
          <span className="tabular-nums text-text-secondary">{dismissed.length}</span>
        </MetaChip>
      )
    },
    clean.length > 0 && {
      key: 'clean',
      chip: (
        <MetaChip tone="neutral" size="compact">
          <Check {...icon} />
          No results
          <span className="tabular-nums text-text-secondary">{clean.length}</span>
        </MetaChip>
      )
    }
  ].filter((t): t is { key: string; chip: ReactElement } => Boolean(t))
  if (tiles.length === 0) return null
  return (
    <div>
      <Strip
        label="Results"
        tiles={tiles}
        open={counted.length > 0 ? 'hits' : undefined}
        detail={(key) =>
          key === 'hits' ? (
            <>{counted.map(block)}</>
          ) : key === 'dismissed' ? (
            <>
              {dismissed.map((h, i) => (
                <div key={`${h.hit.id}-${i}`}>
                  {/* Why it was dismissed, over the result itself. */}
                  <div className="border-b border-[var(--core-color-border-divider)] px-4 py-2 text-caption text-text-secondary">
                    Dismissed: {reasonOf(h)}
                  </div>
                  {block(h, i)}
                </div>
              ))}
            </>
          ) : (
            <AttributeCells
              className="-mb-px"
              columns={3}
              items={clean.map((c, i) => ({
                key: `${c.name}-${i}`,
                label: c.kind === 'person' ? 'Person' : 'Business name',
                values: [{ value: c.name }]
              }))}
            />
          )
        }
      />
    </div>
  )
}

/** Sanctions and watchlists: the names screened, the lists, every hit. */
export const WatchlistScreen = ({ record, onJumpToSource }: ScreenProps) => {
  const s = useMemo(() => screenedOf(record), [record])
  const ctx: BlockContext = { record, onJumpToSource }
  if (!s.watchlist.ran) return null
  return (
    <ScreenStrip
      screen="watchlist"
      record={record}
      hits={s.watchlist.hits}
      block={(h, i) => <WatchlistBlock key={`${h.hit.id}-${i}`} who={h} hit={h.hit} ctx={ctx} />}
    />
  )
}

/** Politically exposed persons: the people screened, every hit. */
export const PepScreen = ({ record, onJumpToSource }: ScreenProps) => {
  const s = useMemo(() => screenedOf(record), [record])
  const ctx: BlockContext = { record, onJumpToSource }
  if (!s.pep.ran) return null
  return (
    <ScreenStrip
      screen="pep"
      record={record}
      hits={s.pep.hits}
      block={(h, i) => <PepBlock key={`${h.hit.id}-${i}`} who={h} hit={h.hit} ctx={ctx} />}
    />
  )
}

/** Adverse media: the names screened, every article matched. */
export const MediaScreen = ({ record, onJumpToSource }: ScreenProps) => {
  const s = useMemo(() => screenedOf(record), [record])
  const ctx: BlockContext = { record, onJumpToSource }
  if (!s.media.ran) return null
  return (
    <ScreenStrip
      screen="media"
      record={record}
      hits={s.media.hits}
      block={(h, i) => <MediaBlock key={`${h.hit.id}-${i}`} who={h} hit={h.hit} ctx={ctx} />}
    />
  )
}

/** The three screens as one body, for anything that still wants them together. */
export const ScreeningResults = ({ record, onJumpToSource }: ScreenProps) => {
  const s = useMemo(() => screenedOf(record), [record])
  if (!s.watchlist.ran && !s.pep.ran && !s.media.ran) return null
  return (
    <div className="border-b border-[var(--core-color-border-divider)]">
      <WatchlistScreen record={record} onJumpToSource={onJumpToSource} />
      <PepScreen record={record} onJumpToSource={onJumpToSource} />
      <MediaScreen record={record} onJumpToSource={onJumpToSource} />
    </div>
  )
}
