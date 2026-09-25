import type { BusinessRecord } from './deriveResults'

/**
 * Whether a watchlist result is actually about this business or its people.
 *
 * The screen is a fuzzy name match, and it returns names that only collide.
 * Andytown came back with MICHAEL COX on the Denied Persons List against its
 * member Michael McCrory: one shared first name, scored 90.86. Counted as a
 * hit, it capped the score at 69 and read as an unresolved sanctions match.
 *
 * A result counts only when it names someone on the record:
 *  - a person: the same surname AND the same first name as a person on the
 *    record ("ORNELAS FERREIRA, Jose Adelino" for Jose Ornelas counts;
 *    "James Lee" for JAMES LEE SORENSON does not — Lee is his middle name);
 *  - an entity: the whole name, without suffixes, is the business's or one of
 *    the names on the record (MAVERIKS is not MAVERICK GAMES).
 * Any alias the list carries is tried too.
 */

type Result = NonNullable<NonNullable<BusinessRecord['watchlist']>['lists'][number]['results']>[number]

export type HitVerdict = {
  id: string
  entityName: string
  valid: boolean
  /** Who it matched, when valid. */
  matchedTo?: string
  /** Why it is not a match, in a reviewer's words, when not. */
  reason?: string
}

const SUFFIX = /\s+(llc|inc|incorporated|corp|corporation|co|company|ltd|limited|lp|llp|pc|pllc|pbc|sa de cv|na)$/
const clean = (s: string) => {
  let n = s.toLowerCase().replace(/[.,'’]/g, (c) => (c === ',' ? ',' : '')).replace(/[^\w\s,]|_/g, ' ')
  n = n.replace(/\s+/g, ' ').trim()
  return n
}
const baseName = (s: string) => {
  let n = clean(s).replace(/,/g, ' ').replace(/\s+/g, ' ').trim()
  for (let prev = ''; prev !== n; ) [prev, n] = [n, n.replace(SUFFIX, '').trim()]
  return n
}

/** "LAST, First Middle" or "First Middle Last" → the surname tokens and the
 *  given-name tokens. Without a comma only the last word is a surname. */
const parsePerson = (name: string) => {
  const c = clean(name)
  if (c.includes(',')) {
    const [last, first] = c.split(',', 2)
    return { surnames: last.split(' ').filter(Boolean), given: (first ?? '').split(' ').filter(Boolean) }
  }
  const t = baseName(c).split(' ').filter(Boolean)
  return { surnames: t.slice(-1), given: t.slice(0, 1) }
}

const personMatch = (hit: string, person: string) => {
  const h = parsePerson(hit)
  const p = parsePerson(person)
  const surname = p.surnames[p.surnames.length - 1]
  const first = p.given[0]
  return Boolean(surname && first && h.surnames.includes(surname) && h.given.includes(first))
}

/** A listed name that could be a person's: a few words, no entity suffix. */
const personLike = (name: string) => {
  const words = baseName(name).split(' ').filter(Boolean)
  return words.length >= 2 && words.length <= 4 && baseName(name) === clean(name).replace(/,/g, '').replace(/\s+/g, ' ').trim()
}

/** What a near-miss shares with the closest person on the record. */
const nearMiss = (hit: string, people: string[]) => {
  if (!personLike(hit)) return undefined
  const h = parsePerson(hit)
  for (const person of people) {
    const p = parsePerson(person)
    const first = p.given[0]
    const surname = p.surnames[p.surnames.length - 1]
    if (first && h.given.includes(first)) return `shares a first name, not the surname, with ${person}`
    if (surname && h.surnames.includes(surname)) return `shares a surname, not the first name, with ${person}`
    const tokens = new Set([...p.given, ...p.surnames])
    if ([...h.given, ...h.surnames].some((t) => tokens.has(t))) return `shares only part of a name with ${person}`
  }
  return undefined
}

export const judgeHit = (record: BusinessRecord, r: Result): HitVerdict => {
  const entityName = r.entityName ?? 'Unnamed'
  const candidates = [entityName, ...(r.aliases ?? [])]
  const people = (record.people ?? []).map((p) => p.name).filter(Boolean)
  const entities = [record.name, ...(record.names ?? []).map((n) => n.name), ...people].filter(Boolean)

  for (const c of candidates) {
    const person = people.find((p) => personMatch(c, p))
    if (person) return { id: r.id, entityName, valid: true, matchedTo: person }
    const entity = entities.find((e) => baseName(e) === baseName(c))
    if (entity) return { id: r.id, entityName, valid: true, matchedTo: entity }
  }
  const reason = nearMiss(entityName, people) ?? 'matches no name on the record'
  return { id: r.id, entityName, valid: false, reason }
}

/** Every result the screen returned, judged. */
export const watchlistVerdicts = (record: BusinessRecord): HitVerdict[] =>
  (record.watchlist?.lists ?? []).flatMap((l) => (l.results ?? []).map((r) => judgeHit(record, r)))

/** The hits that are about this business — what the score and the summary count. */
export const validHitCount = (record: BusinessRecord): number =>
  watchlistVerdicts(record).filter((v) => v.valid).length
