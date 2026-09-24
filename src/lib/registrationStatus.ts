import type { BusinessRecord } from './deriveResults'
import { STATUS_NOT_PUBLISHED, stateName } from './states'

/**
 * A registration's state, in the registry's three fields.
 *
 * A Secretary of State filing can say three things about where it stands: its
 * `status` (active, inactive), its `sub_status` (good standing, pending
 * inactive, dissolved) and its `status_details` — the registry's own words,
 * "Pending Admin Dissolution", "Withdrawn by Merger". Each is present only
 * when the filing states it, and nothing here invents the missing ones.
 *
 * The one normal absence: Delaware and New Jersey publish no status and no
 * details at all (see `STATUS_NOT_PUBLISHED`), so `silent` says so instead of
 * treating it as a gap.
 */
export type Registration = BusinessRecord['registrations'][number]

export type RegistrationState = {
  status?: string
  subStatus?: string
  statusDetails?: string
  /** No status because the state never publishes one. */
  silent: boolean
}

/** `GOOD_STANDING`, `ACTIVE - In Good Standing` and `dissolved` in one casing. */
const sentence = (value: string | null | undefined) =>
  value ? value.replace(/_/g, ' ').trim().toLowerCase().replace(/^./, (c) => c.toUpperCase()) : undefined

const known = (status: string | null | undefined) => (status && !/^unknown$/i.test(status) ? status : undefined)

export const registrationState = (reg: Registration): RegistrationState => ({
  status: sentence(known(reg.status)),
  subStatus: sentence(reg.subStatus),
  statusDetails: sentence(reg.statusDetails),
  silent: !known(reg.status) && STATUS_NOT_PUBLISHED.has(reg.state)
})

/** A sub status that is good news says nothing a reader has to weigh. */
export const isGoodStanding = (subStatus?: string) => Boolean(subStatus && /good standing/i.test(subStatus) && !/not/i.test(subStatus))

/** Letters only, so `ACTIVE`, `Active` and `Active-Current` compare as words. */
const words = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, ' ').trim()

/**
 * The details, when they add anything.
 *
 * Most registries restate the status in their own casing — `Active`,
 * `INACTIVE`, `Good Standing` under good standing — and saying it twice in a
 * sentence is noise. What they add when they differ is the part worth reading:
 * "Pending Admin Dissolution", "Converted Out", "Withdrawn".
 */
export const newDetails = (s: RegistrationState) => {
  if (!s.statusDetails) return undefined
  const d = words(s.statusDetails)
  const said = [s.status, s.subStatus].filter(Boolean).map((x) => words(x!))
  const restates =
    said.some((x) => x === d || d === `${x} ${x}`) ||
    (said.length > 0 && d.split(' ').every((w) => said.some((x) => x.split(' ').includes(w)) || ['and', 'in', 'current'].includes(w)))
  if (restates) return undefined
  // "Inactive - Revoked (Administrative)" under Inactive: the part after the
  // restated status is the news.
  const lead = s.status ? new RegExp(`^${s.status}\\s*[-–:/]?\\s*`, 'i') : null
  const rest = lead ? s.statusDetails.replace(lead, '') : s.statusDetails
  return rest || undefined
}

/**
 * One clause for prose: the status, then whatever the sub status and the
 * details add. "Active, pending inactive — pending admin dissolution";
 * "Inactive — withdrawn"; "status not published by Delaware".
 */
export const describeRegistration = (reg: Registration): string => {
  const s = registrationState(reg)
  if (!s.status) return s.silent ? `status not published by ${stateName(reg.state)}` : 'status not reported'
  const sub =
    s.subStatus && !isGoodStanding(s.subStatus) && words(s.subStatus) !== words(s.status)
      ? s.subStatus.toLowerCase().replace(/^not good standing$/, 'not in good standing')
      : ''
  const details = newDetails(s)
  // A dash, not parentheses: the registry's own words carry parentheses of
  // their own — "Revoked (Administrative)".
  return `${s.status}${sub ? `, ${sub}` : ''}${details ? ` — ${details.toLowerCase()}` : ''}`
}

/** The domestic filing — the one the entity was formed under. */
export const domesticOf = (record: BusinessRecord) =>
  record.registrations.find((r) => /domestic/i.test(r.jurisdiction ?? '')) ??
  record.registrations.find((r) => r.state === record.formation?.state)

/**
 * "a" or "an", by how the word is said: an Indiana LLC, an LLC, a corporation.
 * Initialisms read letter by letter, so LLC and LP take "an".
 */
export const article = (word: string) => {
  const w = word.trim()
  if (/^[A-Z]{2,5}$/.test(w)) return /^[AEFHILMNORSX]/.test(w) ? 'an' : 'a'
  return /^[aeiou]/i.test(w) && !/^(uni|use|usu|one)/i.test(w) ? 'an' : 'a'
}
