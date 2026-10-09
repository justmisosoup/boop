/**
 * Address display + footprint helpers (mode-level, pure).
 *
 * Ported from app/src/containers/Explorer/graph/address.ts — only the state
 * lookup is local (the app's constants/constants does not exist here).
 *
 * The canvas receives addresses as ONE preformatted label — "85 2nd St Ste 710
 * · San Francisco, CA" (the ` · ` seam is authored by `shortAddress` on the
 * demo path and by the backend on the live one). Everything here derives from
 * that string and degrades to identity when it doesn't parse: no interpunct →
 * one display line; no recognizable state tail → sorts last, absent from the
 * footprint. Raw strings are never mutated in the graph — casing is applied at
 * DISPLAY composition only, so the panel and facts keep the record as filed.
 */
import { STATE_NAMES } from '../../../../lib/states'

/** the app's `getStateByAbbr` (constants/constants), over the prototype's own
 *  state table (src/lib/states.ts) — the same `{ abbr, name }` or undefined */
export const getStateByAbbr = (
  abbr: string | null
): { abbr: string; name: string } | undefined =>
  abbr && STATE_NAMES[abbr] ? { abbr, name: STATE_NAMES[abbr] } : undefined

/** compass points + the two caps-forever abbreviations of address English.
 *  Two-letter STATE codes are deliberately absent: mid-street "CT"/"LN" are
 *  suffixes (Court, Lane), not Connecticut — the state tail is protected
 *  positionally by `caseLocality`, never lexically. */
const KEEP_CAPS = new Set([
  'N',
  'S',
  'E',
  'W',
  'NE',
  'NW',
  'SE',
  'SW',
  'PO',
  'US'
])

const ORDINAL = /^(\d+)(ST|ND|RD|TH)$/
/** letters only, apostrophe (straight or typographic) / hyphen-joined runs
 *  allowed (O'FARRELL, O’FARRELL, WINSTON-SALEM) */
const ALPHA_RUNS = /^[A-Z]+(?:['’-][A-Z]+)*$/

const titleRun = (w: string): string =>
  w.replace(/[A-Z]+/g, run => run.charAt(0) + run.slice(1).toLowerCase())

/**
 * Display-case one USPS-uppercase token. The guards make this idempotent and
 * safe on live data of unknown provenance: a token with any lowercase already
 * chose its casing and passes through; digit-letter mixes that aren't
 * ordinals ("I-95", "200-B", "3M") are left alone — the only transforms are
 * the two we can assert ("82ND" → "82nd", "FRANCISCO" → "Francisco").
 * "MCLEAN" → "Mclean" is an accepted miss: Mc/Mac heuristics mangle more
 * names (Macy, Mach) than they fix.
 */
const caseWord = (token: string): string => {
  const m = token.match(/^([^A-Za-z0-9]*)([A-Za-z0-9'’-]*)([^A-Za-z0-9]*)$/)
  if (!m) return token
  const [, pre, core, post] = m
  if (!core || /[a-z]/.test(core)) return token
  if (!/[A-Z]/.test(core)) return token
  const ord = core.match(ORDINAL)
  if (ord) return pre + ord[1] + ord[2].toLowerCase() + post
  if (KEEP_CAPS.has(core) || core.length === 1) return token
  if (ALPHA_RUNS.test(core)) return pre + titleRun(core) + post
  return token
}

/** display-case a whole USPS-uppercase segment, word by word */
export const addressCase = (s: string): string =>
  s.split(' ').map(caseWord).join(' ')

/** the ", CA" / ", CA 94103-1234" tail — capture group 1 is the state code */
const STATE_TAIL = /,\s*([A-Z]{2})(?:\s+\d{5}(?:-\d{4})?)?\s*$/

/**
 * The US state a display label ends in, validated against the app's state
 * vocabulary (`AbrvState` via `getStateByAbbr`) — `null` when the tail isn't
 * a real code. Works on split ("San Francisco, CA") and unsplit
 * ("1 Main St · Cambridge, MA 02138") labels alike.
 */
export function stateOfAddressName(name: string): string | null {
  const m = name.match(STATE_TAIL)
  if (!m) return null
  return getStateByAbbr(m[1]) ? m[1] : null
}

/** the street/locality separator — `shortAddress` (fromBusiness) composes
 *  with it and `splitAddressName` parses it: one constant, or the round-trip
 *  silently breaks and every demo address falls back to one line */
export const ADDRESS_SEAM = ' · '

/** street/locality halves of a seam-joined label, or null unsplit */
export function splitAddressName(
  name: string
): { street: string; locality: string } | null {
  const at = name.indexOf(ADDRESS_SEAM)
  if (at < 0) return null
  const street = name.slice(0, at).trim()
  const locality = name.slice(at + ADDRESS_SEAM.length).trim()
  if (!street || !locality) return null
  return { street, locality }
}

/** case a locality, protecting the state+ZIP tail verbatim ("BROOKLYN, NY" →
 *  "Brooklyn, NY") — the tail is position-validated, so a street-suffix "CT"
 *  elsewhere in the string still cases normally */
const caseLocality = (s: string): string => {
  const m = s.match(STATE_TAIL)
  if (!m || !getStateByAbbr(m[1])) return addressCase(s)
  const at = m.index ?? 0
  return addressCase(s.slice(0, at)) + s.slice(at)
}

/**
 * An address label's display lines: street over locality when the interpunct
 * seam exists, the (tail-protected) cased whole otherwise — the one-line
 * fallback is exactly today's rendering, so an unparseable live label loses
 * nothing.
 */
export function addressDisplayLines(name: string): {
  name: string
  sub?: string
} {
  const split = splitAddressName(name)
  if (!split) return { name: caseLocality(name) }
  return { name: addressCase(split.street), sub: caseLocality(split.locality) }
}

/** the minimal node shape the fan-order + footprint helpers read */
interface AddressLikeNode {
  id: string
  kind: string
  name: string
}

/**
 * Fan order for a bundle's members: identity unless EVERY member is an
 * address (mixed bundles keep their authored order); address fans group by
 * state — groups ordered by member count (desc) then code (alpha), members
 * stable within a group, unknown-state members last in original order. One
 * law rides on this: fan arc order == footprint caption order == region-label
 * order.
 */
export function orderAddressMembers<N extends AddressLikeNode>(
  members: N[]
): N[] {
  if (members.length < 2 || members.some(m => m.kind !== 'address'))
    return members
  const groups = new Map<string, N[]>()
  const unknown: N[] = []
  for (const m of members) {
    const st = stateOfAddressName(m.name)
    if (!st) {
      unknown.push(m)
      continue
    }
    const g = groups.get(st)
    if (g) g.push(m)
    else groups.set(st, [m])
  }
  const ordered = [...groups.entries()].sort(
    ([aCode, a], [bCode, b]) => b.length - a.length || (aCode < bCode ? -1 : 1)
  )
  return [...ordered.flatMap(([, g]) => g), ...unknown]
}

/**
 * The hub's footprint caption from its members' labels, in fan order:
 * distinct state codes joined ("CA, NY, NJ, DE, WY") up to five, the count
 * beyond ("6 states"), empty when no member names a state (the caption then
 * stays suppressed — a footprint the data can't support is never asserted).
 */
export function footprintSummary(memberNames: string[]): string {
  const seen: string[] = []
  for (const name of memberNames) {
    const st = stateOfAddressName(name)
    if (st && !seen.includes(st)) seen.push(st)
  }
  if (seen.length === 0) return ''
  if (seen.length === 1) return seen[0]
  if (seen.length <= 5) return seen.join(', ')
  return `${seen.length} states`
}
