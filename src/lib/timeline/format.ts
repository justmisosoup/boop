/*
 * Ported verbatim from the dashboard: `app/src/containers/Timeline/format.ts`
 * (rebuilt in `c4379d1cd`). This file is a clone — change it upstream and
 * re-copy, the way `src/core` is handled (PARITY.md).
 *
 * Only the imports differ, and only where the prototype has no equivalent:
 *   - `pluralize` is not a dependency here — `plural()` beside this file does the one job it was used for (a count and its noun)
 *   - `STATES` is a Map in the app; `STATE_NAMES` is the record this prototype keeps
 *   - `lib/dayjs` is ported alongside
 */

import dayjs from '../dayjs'
import { STATE_NAMES } from '../states'
import { plural } from './plural'

const STATE_ABBREVIATIONS = Object.keys(STATE_NAMES)

const ENTITY_AND_ROLE_ACRONYMS = [
  'LLC',
  'LLP',
  'LP',
  'LLLP',
  'INC',
  'CORP',
  'CO',
  'LTD',
  'PC',
  'PLLC',
  'PA',
  'DBA',
  'CEO',
  'CFO',
  'COO',
  'CTO',
  'CIO',
  'CMO',
  'CRO',
  'EVP',
  'SVP',
  'VP',
  'II',
  'III',
  'IV',
  'USA',
  'US',
  'PO',
  'NE',
  'NW',
  'SE',
  'SW'
]

const KEEP_UPPER = new Set([
  ...ENTITY_AND_ROLE_ACRONYMS,
  ...STATE_ABBREVIATIONS
])

const titleWord = (word: string): string => {
  const bare = word.replace(/[^A-Z0-9&]/gi, '')
  if (!bare) return word
  if (KEEP_UPPER.has(bare.toUpperCase())) return word.toUpperCase()
  if (/\d/.test(bare))
    return /^\d+(ST|ND|RD|TH)$/i.test(bare) ? word.toLowerCase() : word
  if (bare.length === 1) return word
  return word
    .toLowerCase()
    .replace(
      /(^|[-'’(])([a-z])/g,
      (_, lead: string, letter: string) => lead + letter.toUpperCase()
    )
}

export const displayCase = (value: string): string => {
  const trimmed = value.trim()
  if (!trimmed || trimmed !== trimmed.toUpperCase()) return trimmed
  return trimmed.split(/\s+/).map(titleWord).join(' ')
}

export const formatUpdateDate = (date: Date): string =>
  dayjs(date).format('MMM D, YYYY')

export const formatUpdateTime = (date: Date): string =>
  dayjs(date).format('h:mm A')

const localDay = (iso: string): string => dayjs(iso).format('YYYY-MM-DD')

// Date-only filings carry no clock: their ISO date is the day, unshifted by zone.
export const changeDay = (iso: string, hasTime: boolean): string =>
  hasTime ? localDay(iso) : iso.slice(0, 10)

export const changeDate = (iso: string, hasTime: boolean): Date =>
  hasTime ? new Date(iso) : dayjs(iso.slice(0, 10), 'YYYY-MM-DD').toDate()

export const intervalDays = (later: Date, earlier: Date): number =>
  Math.max(0, Math.round((later.getTime() - earlier.getTime()) / 86_400_000))

export const intervalLabel = (later: Date, earlier: Date): string => {
  const days = intervalDays(later, earlier)
  if (days < 14) return plural('day', days)
  if (days < 60)
    return plural('week', Math.max(2, Math.round(days / 7)))
  if (days < 365)
    return plural('month', Math.max(2, Math.round(days / 30.4375)))
  const months = Math.round(days / 30.4375)
  const years = Math.floor(months / 12)
  const rest = months % 12
  return rest
    ? `${plural('year', years)}, ${plural('month', rest)}`
    : plural('year', years)
}

export type GapTier = 'short' | 'medium' | 'long'

export const gapTier = (days: number): GapTier =>
  days < 60 ? 'short' : days < 730 ? 'medium' : 'long'

export const gapText = (interval: string, hidesChanges: boolean): string =>
  hidesChanges ? `${interval} apart` : `${interval} without changes`

const yearSpan = (years: number[]): string => {
  if (years.length === 0) return ''
  const first = years[0]
  const last = years[years.length - 1]
  return first === last ? ` · ${first}` : ` · ${first} – ${last}`
}

export const summaryText = ({
  changes,
  filings,
  totalChanges,
  years
}: {
  changes: number
  filings: number
  totalChanges?: number
  years: number[]
}): string => {
  const partial = totalChanges !== undefined && totalChanges !== changes
  const head = partial
    ? `${changes} of ${totalChanges} changes`
    : plural('change', changes)
  return `${head} across ${plural('filing', filings)}${yearSpan(years)}`
}

export const humanizeEventType = (type: string): string => {
  const [noun, verb] = type.split('.')
  const words = [noun, verb]
    .filter(Boolean)
    .map(part => part.replace(/_/g, ' '))
  const sentence = words.join(' ')
  return sentence.charAt(0).toUpperCase() + sentence.slice(1)
}
