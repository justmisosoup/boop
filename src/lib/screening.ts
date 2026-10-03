import type { BusinessRecord } from './deriveResults'
import { stateName } from './states'
import { baseName, judgeHit, personMatch } from './watchlist'

/**
 * The compliance screens — sanctions and watchlists, politically exposed
 * persons, adverse media — as findings about the business and the people the
 * customer submitted, and everything else the screens returned, dismissed
 * with the reason.
 *
 * The screens are fuzzy name searches run against every name on the record,
 * found ones included, and most of what comes back is about someone else.
 * Sorenson's came back on DAVID JOHNSON and NATHAN RUSSELL, names off its
 * filings and a Form 5500, and on WITHDRAWN — the Illinois filing's status
 * word read as a person, which drew forty articles. A finding is a result on
 * the business or a submitted person that names them; the rest is dismissed.
 */

export type Screen = 'watchlist' | 'pep' | 'media'

export const SCREENS: ReadonlyArray<{ id: Screen; label: string; peopleOnly?: boolean }> = [
  { id: 'watchlist', label: 'Sanctions & watchlists' },
  // A politically exposed person is a person: the screen runs on people only.
  { id: 'pep', label: 'Politically exposed persons', peopleOnly: true },
  { id: 'media', label: 'Adverse media' }
]

/** Whether a screen runs on this subject: PEP on people, the others on both. */
export const screens = (screen: Screen, subject: Subject) =>
  !(SCREENS.find((x) => x.id === screen)?.peopleOnly && subject.kind === 'business')

export type Subject = { key: string; name: string; kind: 'business' | 'person'; submitted: boolean }

/** One result the screen returned, against the name it was screened on. */
export type Match = {
  id: string
  screen: Screen
  /** The name the list, the PEP source or the articles carry. */
  matched: string
  /** The list, or where the articles came from. */
  source?: string
  /** Who a PEP result is, as the provider ties it to the person: born,
   *  citizenship, what they hold or held. The facts a reviewer clears it on. */
  person?: { dob?: string | null; birthPlace?: string | null; citizenship?: string | null; roles: string[]; hitType?: string | null }
  /** A watchlist's full name and agency: "Specially Designated Nationals", OFAC. */
  list?: { title?: string | null; agency?: string | null }
  url?: string | null
  /** The risk categories an article set carries. */
  categories?: string[]
  /** How many articles. */
  count?: number
  /** What the articles are about: each topic the provider flagged, how many
   *  articles carry it, and its highest confidence across them. */
  topics?: Array<{
    name: string
    articles: number
    confidence: 'high' | 'moderate' | 'low' | null
    /** The articles that carry it. */
    items: Array<{ title: string; url?: string | null; source?: string | null }>
  }>
  /** The articles themselves, each with its link. */
  articles?: Array<{ title: string; url?: string | null; source?: string | null }>
  /** Whether any headline names the business. */
  namesBusiness?: boolean
  /** The name on the record the screen ran it against. */
  against: string
}

/** A hit, and why it counts: whom it names. */
export type Finding = Match & { subject: string; reason: string }
export type Dismissal = Match & { reason: string }

/** A name the screens ran on that returned nothing, and which screens. */
export type Clean = { name: string; kind: Subject['kind']; screens: Screen[] }

export type Screening = {
  subjects: Subject[]
  /** Every other name screened that came back with nothing — the dashboard
   *  lists every business name and every person, results or not. */
  clean: Clean[]
  findings: Finding[]
  dismissed: Dismissal[]
  /** How many watchlists were searched. */
  lists: number
}

const REF: Record<Screen, string> = {
  watchlist: 'watchlist_result',
  pep: 'politically_exposed_person_result',
  media: 'adverse_media_screening_result'
}

/** A filing's own words, read as a person's name by the parse. */
const STATUS_WORDS = new Set(['withdrawn', 'dissolved', 'vacant', 'none', 'resigned', 'deceased', 'unknown', 'not yet elected'])

type Holder = {
  name: string
  submitted?: boolean
  /** One of the business's own names, not a person. */
  entity?: boolean
  sourceRefs?: Array<{ id: string; type: string; metadata?: Record<string, unknown> }> }

const nameKeyOf = (s: string) => baseName(s)

/** The name-match confidence at which the articles are taken to be about the name. */
export const MEDIA_MATCH = 0.9

const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const RANK = { high: 3, moderate: 2, low: 1 } as const
type Confidence = keyof typeof RANK

/** Each topic across a result's articles, strongest first. */
type Item = {
  title?: string | null
  url?: string | null
  sourceName?: string | null
  risks?: Array<{ name: string; confidence?: string | null }>
}
const topicsOf = (items: Item[]) => {
  const by = new Map<
    string,
    { articles: number; confidence: Confidence | null; items: Array<{ title: string; url?: string | null; source?: string | null }> }
  >()
  for (const item of items)
    for (const name of new Set((item.risks ?? []).map((r) => r.name))) {
      const best = (item.risks ?? [])
        .filter((r) => r.name === name)
        .map((r) => (r.confidence ?? '').toLowerCase())
        .filter((c): c is Confidence => c in RANK)
        .sort((a, b) => RANK[b] - RANK[a])[0]
      const t = by.get(name) ?? { articles: 0, confidence: null, items: [] }
      t.articles += 1
      t.items.push({ title: item.title ?? item.sourceName ?? 'Untitled', url: item.url, source: item.sourceName })
      if (best && (!t.confidence || RANK[best] > RANK[t.confidence])) t.confidence = best
      by.set(name, t)
    }
  return [...by]
    .map(([name, t]) => ({ name: sentence(name.replace(/_/g, ' ')), ...t }))
    .sort((a, b) => (RANK[b.confidence ?? 'low'] ?? 0) - (RANK[a.confidence ?? 'low'] ?? 0) || b.articles - a.articles)
}

export const screeningOf = (record: BusinessRecord): Screening => {
  const business = (record.names ?? []).find((n) => n.submitted)?.name ?? record.name
  const businessNames = new Set([record.name, ...(record.names ?? []).map((n) => n.name)].map(nameKeyOf))
  const submittedPeople = record.people.filter((p) => p.submitted)

  const subjects: Subject[] = [
    { key: 'business', name: business, kind: 'business', submitted: true },
    ...submittedPeople
      .filter((p, i, all) => all.findIndex((q) => nameKeyOf(q.name) === nameKeyOf(p.name)) === i)
      .map((p) => ({
        key: `person:${nameKeyOf(p.name)}`,
        name: p.name,
        // A submitted "person" can be an entity — SCI HOLDINGS LLC.
        kind: (baseName(p.name) !== p.name.toLowerCase().replace(/[.,]/g, '').trim() ? 'business' : 'person') as Subject['kind'],
        submitted: true
      }))
  ]
  /** The subject a name on the record is: one of the business's own names,
   *  or a submitted person. A found name is none. */
  const subjectOf = (h: Holder): Subject | undefined => {
    const k = nameKeyOf(h.name)
    if (h.entity && businessNames.has(k)) return subjects[0]
    return h.submitted ? subjects.find((s) => s.key === `person:${k}`) : undefined
  }

  // Who each result was returned against: the names carrying its id.
  const holders: Holder[] = [...(record.names ?? []).map((n) => ({ ...n, entity: true })), ...record.people]
  const heldBy = (screen: Screen, id: string) =>
    holders.filter((h) => (h.sourceRefs ?? []).some((r) => r.type === REF[screen] && r.id === id))

  /** Why a result on a found name does not count: where the name came from. */
  const foundReason = (h: Holder) => {
    const refs = (h.sourceRefs ?? []).filter((r) => !r.type.endsWith('_result'))
    const filing = refs.find((r) => r.type === 'registration')
    if (STATUS_WORDS.has(h.name.trim().toLowerCase())) {
      const st = (filing?.metadata as { state?: string } | undefined)?.state
      return `Not a person; text from the ${st ? `${stateName(st)} ` : ''}filing`
    }
    if (filing) return 'Named on a state filing, not submitted'
    if (refs.some((r) => r.type === 'form_5500')) return 'Named on a Form 5500, not submitted'
    return 'Not submitted'
  }

  const findings: Finding[] = []
  const dismissed: Dismissal[] = []
  const place = (
    m: Omit<Match, 'against'>,
    held: Holder[],
    judge: (subject: Subject) => string | undefined,
    /** Why a hit counts — whom it names. */
    counts: (subject: Subject) => string,
    /** Why it is no match whoever it was run against — the watchlist's own
     *  reading of a near miss, a weak name match. It leads. */
    invalid?: string
  ) => {
    // A result nothing on the record carries was run against the business.
    const on: Holder[] = held.length > 0 ? held : [{ name: business, entity: true }]
    for (const h of on) {
      const subject = subjectOf(h)
      const base = { ...m, against: h.name }
      if (STATUS_WORDS.has(h.name.trim().toLowerCase())) {
        dismissed.push({ ...base, reason: foundReason(h) })
        continue
      }
      if (invalid) {
        dismissed.push({ ...base, reason: invalid })
        continue
      }
      if (!subject) {
        dismissed.push({ ...base, reason: foundReason(h) })
        continue
      }
      const why = judge(subject)
      if (why) dismissed.push({ ...base, reason: why })
      else findings.push({ ...base, subject: subject.key, reason: counts(subject) })
    }
  }

  for (const list of record.watchlist?.lists ?? [])
    for (const r of list.results ?? []) {
      const verdict = judgeHit(record, r)
      const source = [list.agencyAbbr, list.abbr].filter(Boolean).join(' ') || list.title || undefined
      place(
        {
          id: r.id,
          screen: 'watchlist',
          matched: r.entityName ?? 'Unnamed',
          source,
          url: r.url,
          list: { title: list.title, agency: list.agency }
        },
        heldBy('watchlist', r.id),
        (subject) => {
          // Valid, but to someone other than this subject.
          return verdict.matchedTo && nameKeyOf(verdict.matchedTo) !== nameKeyOf(subject.name) &&
            !(subject.key === 'business' && businessNames.has(nameKeyOf(verdict.matchedTo)))
            ? `Matches ${verdict.matchedTo}, not submitted`
            : undefined
        },
        (subject) => `Name matches ${verdict.matchedTo ?? subject.name}`,
        verdict.valid ? undefined : sentence(verdict.reason ?? 'not a match')
      )
    }

  for (const r of record.pep?.results ?? [])
    place(
      {
        id: r.id,
        screen: 'pep',
        matched: r.name ?? 'Unnamed',
        source: 'PEP provider',
        url: r.url ?? r.sourceUrls?.[0] ?? null,
        person: {
          dob: r.dob,
          birthPlace: r.birthPlace,
          citizenship: r.citizenship,
          roles: r.professionalHistory ?? [],
          hitType: r.hitType
        }
      },
      heldBy('pep', r.id),
      (subject) =>
      subject.kind !== 'person'
        ? 'PEP screens people, not businesses'
        : personMatch(r.name ?? '', subject.name)
          ? undefined
          : `Name differs from ${subject.name}`,
      (subject) => `Name matches ${subject.name}`
    )

  for (const r of record.adverseMedia?.results ?? []) {
    if (r.items.length === 0) continue
    const categories = [
      ...new Set(r.items.flatMap((i) => (i.risks ?? []).map((x) => x.name.replace(/_/g, ' '))))
    ]
    const sources = [...new Set(r.items.map((i) => i.sourceName).filter((x): x is string => Boolean(x)))]
    const namesBusiness = r.items.some((i) => nameKeyOf(i.title ?? '').includes(nameKeyOf(business)))
    place(
      {
        id: r.id,
        screen: 'media',
        matched: `${r.items.length} ${r.items.length === 1 ? 'article' : 'articles'}`,
        source: sources.slice(0, 2).join(', ') + (sources.length > 2 ? ` +${sources.length - 2}` : ''),
        url: r.items[0]?.url,
        categories,
        count: r.items.length,
        topics: topicsOf(r.items),
        articles: r.items.map((i) => ({ title: i.title ?? i.sourceName ?? 'Untitled', url: i.url, source: i.sourceName })),
        namesBusiness
      },
      heldBy('media', r.id),
      () => undefined,
      () => `Name match ${Math.round((r.matchScore ?? 0) * 100)}%`,
      /* The provider's own confidence that the articles are about the name.
         Nearly every article set carries a risk category, so the categories
         do not separate anything; the name match does. At 90% and over it is
         the same line the score's adverse-media cap reads. */
      (r.matchScore ?? 0) >= MEDIA_MATCH ? undefined : `Weak name match (${Math.round((r.matchScore ?? 0) * 100)}%)`
    )
  }

  // Each name as the record spells it: SORENSON COMMUNICATIONS, INC. is a
  // name of its own beside the LLC, as the dashboard lists them.
  const wholeName = (n: string) => n.toLowerCase().replace(/\s+/g, ' ').trim()
  /* Everyone the screens ran on: every business name and every person on the
     record, as the dashboard's screening cards list them. PEP runs on people
     only. A name with no result on a screen is clean on it. */
  const isEntity = (name: string) => baseName(name) !== name.toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim()
  const everyone = [
    ...[record.name, ...(record.names ?? []).map((n) => n.name)].map((name) => ({ name, kind: 'business' as const })),
    ...record.people.map((p) => ({ name: p.name, kind: (isEntity(p.name) ? 'business' : 'person') as Subject['kind'] }))
  ].filter((x, i, all) => x.name && all.findIndex((y) => wholeName(y.name) === wholeName(x.name)) === i)
  const returned = [...findings, ...dismissed]
  const clean: Clean[] = everyone
    .map((x) => ({
      ...x,
      screens: SCREENS.filter((sc) => !(sc.peopleOnly && x.kind === 'business'))
        .map((sc) => sc.id)
        .filter((sc) => !returned.some((r) => r.screen === sc && wholeName(r.against) === wholeName(x.name)))
    }))
    .filter((x) => x.screens.length > 0)

  return { subjects, clean, findings, dismissed, lists: (record.watchlist?.lists ?? []).length }
}

/** A subject's findings on one screen. */
export const findingsFor = (s: Screening, subject: string, screen: Screen) =>
  s.findings.filter((f) => f.subject === subject && f.screen === screen)

/**
 * The screens as the platform reports them: every result each screen
 * returned, tied to the name it was run on, and what was screened. No
 * dismissals — a result is a hit, and the analyst dispositions it.
 */
export type WatchlistHit = NonNullable<NonNullable<BusinessRecord['watchlist']>['lists'][number]['results']>[number] & {
  list: { title: string | null; abbr: string | null; agency: string | null; agencyAbbr: string | null; organization: string | null }
}
export type PepHit = NonNullable<BusinessRecord['pep']>['results'][number]
export type MediaHit = NonNullable<BusinessRecord['adverseMedia']>['results'][number]

/** The name a result was run on: who it is to the record. */
export type ScreenedName = {
  name: string
  kind: 'business' | 'person'
  submitted: boolean
  /** Where the record holds the name — its sources and their references, so
   *  the card can chip them as every other cell chips its sources. */
  sources?: string[]
  refs?: Array<{ id: string; type: string; metadata?: Record<string, unknown> }>
}
export type Screened = {
  watchlist: { hits: Array<ScreenedName & { hit: WatchlistHit }>; names: string[]; lists: number; ran: boolean }
  pep: { hits: Array<ScreenedName & { hit: PepHit }>; names: string[]; ran: boolean }
  media: { hits: Array<ScreenedName & { hit: MediaHit }>; names: string[]; ran: boolean }
}

export const screenedOf = (record: BusinessRecord): Screened => {
  const business = (record.names ?? []).find((n) => n.submitted)?.name ?? record.name
  const businessNames = [...new Set([record.name, ...(record.names ?? []).map((n) => n.name).filter(Boolean)])]
  const people = [...new Set(record.people.filter((p) => p.submitted && p.name).map((p) => p.name))]
  const holders: Holder[] = [...(record.names ?? []).map((n) => ({ ...n, entity: true })), ...record.people]
  // Who a result was returned against: the names carrying its id; else the
  // business. Each with what it is to the record — a business name or a
  // person, submitted by the customer or found on a filing.
  const namesFor = (screen: Screen, id: string): ScreenedName[] => {
    const held = holders.filter((h) => (h.sourceRefs ?? []).some((r) => r.type === REF[screen] && r.id === id))
    const seen = new Set<string>()
    const out: ScreenedName[] = []
    const own = holders.find((h) => h.entity && h.name === business) ?? ({ name: business, entity: true, submitted: true } as Holder)
    for (const h of held.length > 0 ? held : [own]) {
      if (seen.has(h.name)) continue
      seen.add(h.name)
      out.push({
        name: h.name,
        kind: h.entity ? 'business' : 'person',
        submitted: Boolean(h.submitted),
        sources: (h as Holder & { sources?: string[] }).sources,
        refs: (h.sourceRefs ?? []).filter((r) => !r.type.endsWith('_result'))
      })
    }
    return out
  }

  const watchlistHits = (record.watchlist?.lists ?? []).flatMap((l) =>
    (l.results ?? []).flatMap((r) =>
      namesFor('watchlist', r.id).map((who) => ({
        ...who,
        hit: { ...r, list: { title: l.title, abbr: l.abbr, agency: l.agency, agencyAbbr: l.agencyAbbr, organization: l.organization } }
      }))
    )
  )
  const pepHits = (record.pep?.results ?? []).flatMap((r) => namesFor('pep', r.id).map((who) => ({ ...who, hit: r })))
  const mediaHits = (record.adverseMedia?.results ?? []).flatMap((r) => namesFor('media', r.id).map((who) => ({ ...who, hit: r })))

  return {
    watchlist: { hits: watchlistHits, names: [...businessNames, ...people], lists: (record.watchlist?.lists ?? []).length, ran: Boolean(record.watchlist) },
    pep: { hits: pepHits, names: people, ran: Boolean(record.pep) },
    media: { hits: mediaHits, names: [...businessNames, ...people], ran: Boolean(record.adverseMedia) }
  }
}

/**
 * Why a screening result is dismissed, if it is: the platform excluded it, or
 * the name on the result is not the name it was screened against — a
 * watchlist entry under another name (U.S. CONNECT, LLC drew CONNECT TELECOM
 * GENERAL TRADING LLC), a politically exposed person who is someone else.
 * Adverse media is dismissed where the provider's name match falls under 90%.
 * One rule, read by the screening cards and the Assistant's summary alike.
 */
export const dismissalOf = (
  screen: Screen,
  h: ScreenedName & {
    hit: { status?: string | null; entityName?: string | null; name?: string | null; aliases?: string[] | null; matchScore?: number | null }
  }
): string | undefined => {
  if (/^excluded$/i.test(h.hit.status ?? '')) return 'Excluded on the platform'
  if (screen === 'watchlist') {
    const listed = h.hit.entityName ?? ''
    const names = [listed, ...(h.hit.aliases ?? [])]
    // The same words in any order: a list writes "RODRIGUEZ, Manuel" for
    // Manuel Rodriguez.
    const words = (n: string) => baseName(n).split(' ').filter(Boolean).sort().join(' ')
    return names.some((n) => n && words(n) === words(h.name)) ? undefined : `${listed || 'The entry'} does not match ${h.name}`
  }
  if (screen === 'pep') {
    const listed = h.hit.name ?? ''
    return h.kind === 'person' && personMatch(listed, h.name) ? undefined : `${listed || 'The person'} does not match ${h.name}`
  }
  // The provider's own confidence that the articles are about the name: under
  // the line the score's adverse-media cap reads, they are about someone else
  // — KATHRYN BERNARD's 87% were about the actress Kathryn Bernardo.
  if (screen === 'media' && typeof h.hit.matchScore === 'number' && h.hit.matchScore < MEDIA_MATCH) {
    const pct = Math.round(h.hit.matchScore * 100)
    return `${/^(8|11|18)/.test(String(pct)) ? 'an' : 'a'} ${pct}% name match, not an exact one`
  }
  return undefined
}
