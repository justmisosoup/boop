import type { BusinessRecord } from './deriveResults'
import { entityTypeStatement } from './statements'

/**
 * Whether the business is a sole proprietorship, as the report says it: "a
 * sole proprietorship" only where a filing states it, "likely" everywhere
 * else (`entityTypeStatement`). A sole proprietorship is not formed — there
 * is no filing that creates it — so nothing says when it was.
 */
export const solePropPhrase = (record: BusinessRecord): string | undefined => {
  const said = entityTypeStatement(record)
  if (!/sole proprietorship/i.test(said)) return undefined
  return /likely/i.test(said) ? 'likely a sole proprietorship' : 'a sole proprietorship'
}

/**
 * The entity form, short, as a reviewer says it: "LLC", "PLLC",
 * "Corporation", "Trust" — the initialism where the label carries one, never
 * "professional limited liability company (PLLC)" spelled out; else the
 * label as written, capitalised.
 */
export const formWord = (label: string): string => {
  const t = label.trim()
  const m = t.match(/\(([A-Z]{2,5})\)\s*$/)
  if (m) return m[1]
  return /^[A-Z]{2,5}$/.test(t) ? t : t.charAt(0).toUpperCase() + t.slice(1)
}
