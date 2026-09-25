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

const baseNumber = (r: Registration) => (r.fileNumber ?? '').split('-')[0]
const newestFirst = (a: Registration, b: Registration) =>
  (b.registrationDate ?? '').localeCompare(a.registrationDate ?? '')
const isDomestic = (r: Registration) => /domestic/i.test(r.jurisdiction ?? '')
const isForeign = (r: Registration) => /foreign/i.test(r.jurisdiction ?? '')

/** A name without its punctuation or trailing entity suffixes, so ALLIANCE
 *  TRANSFER, Alliance Transfer Inc. and ALLIANCE TRANSFER CORP. are one name. */
// Spelled-out suffixes first: "Limited Liability Company" is LLC, not "Limited Liability" plus "Company".
const SUFFIX =
  /\s+(limited liability company|limited liability partnership|limited partnership|professional corporation|llc|inc|incorporated|corp|corporation|co|company|ltd|limited|lp|llp|lllp|pc|pllc|pbc)$/
/** Whether two names are the same business name, suffixes and punctuation aside. */
export const sameName = (a: string | null | undefined, b: string | null | undefined) => baseName(a) === baseName(b)

const baseName = (s: string | null | undefined) => {
  let n = (s ?? '').toLowerCase().replace(/[.,'’]/g, '').replace(/[^\w\s]|_/g, ' ').replace(/\s+/g, ' ').trim()
  for (let prev = ''; prev !== n; ) [prev, n] = [n, n.replace(SUFFIX, '').trim()]
  return n
}

/**
 * The business's own DOMESTIC filings, newest first.
 *
 * A DOMESTIC row with a FOREIGN twin — same state, same base file number — is
 * not a formation: Utah lists Checkr as 12328450-0142 (DOMESTIC, expired) and
 * 12328450-0143 (FOREIGN, active), and Checkr is a Delaware corporation.
 *
 * Only filings under the business's own name count, when any do. Alliance
 * Transfer's record carries ALLIANCE TRANSFER (1976), ALLIANCE TRANSFER CORP.
 * (1995) and ALLIANCE ENTERPRISES IV, INC. (2007) — the last is a related
 * corporation, not the applicant's history.
 */
const ownDomestic = (record: BusinessRecord): Registration[] => {
  const regs = record.registrations
  const twin = (r: Registration) =>
    regs.some((f) => isForeign(f) && f.state === r.state && !!baseNumber(f) && baseNumber(f) === baseNumber(r))
  const domestic = regs.filter((r) => isDomestic(r) && !twin(r)).sort(newestFirst)
  const named = domestic.filter((r) => baseName(r.name) === baseName(record.name))
  return named.length > 0 ? named : domestic
}

/**
 * The domestic filing the entity stands on now.
 *
 * An active one in the formation state wins. Otherwise the most recent one
 * does, in any state: Andytown's California filing is "Converted Out", and it
 * has been a Delaware LLC since 2017-02-07. Its formation is still the
 * California filing — see formationFilingOf.
 */
export const domesticOf = (record: BusinessRecord) => {
  const formed = record.formation?.state
  const own = ownDomestic(record)
  return (
    own.find((r) => r.state === formed && r.status?.toLowerCase() === 'active') ??
    own[0] ??
    record.registrations.find((r) => r.state === formed)
  )
}

/**
 * Whether the formation is confirmed: a domestic filing in the formation
 * state is on the record. Middesk also derives a formation from a foreign
 * filing's stated home state — Sprig's "Delaware, 2019-09-05" is its
 * California foreign filing, with no Delaware filing behind it — and that is
 * not something to state as fact.
 */
export const formationConfirmed = (record: BusinessRecord) =>
  Boolean(record.formation && record.registrations.some((r) => isDomestic(r) && r.state === record.formation?.state))

/**
 * The filing the business was formed under: the one the formation names, by
 * state AND date. By state alone, Alliance Transfer's 1976 formation read the
 * name and status of a 2007 corporation that happens to be in New York too.
 */
export const formationFilingOf = (record: BusinessRecord) => {
  const f = record.formation
  if (!f) return undefined
  const inState = record.registrations.filter((r) => r.state === f.state)
  return (
    inState.find((r) => r.registrationDate === f.date) ??
    inState.find((r) => isDomestic(r)) ??
    inState[0]
  )
}

/**
 * Whether the formation filing is still the one the business stands on, for
 * the Formation card's subtext: still active, not published, no longer active
 * — or no longer active because the business appears to have moved to a newer
 * domestic registration (Andytown: formed in California, in Delaware since 2017).
 */
export const formationStandingNote = (record: BusinessRecord): string | undefined => {
  const f = formationFilingOf(record)
  if (!f) return undefined
  const d = domesticOf(record)
  const st = registrationState(f)
  const year = (iso?: string | null) => (iso && /^\d{4}/.test(iso) ? iso.slice(0, 4) : '')
  // "inactive — expired" says "inactive" twice beside "no longer active"; keep what follows it.
  const ended = (x: Registration) => {
    const why = describeRegistration(x).toLowerCase().replace(/^inactive[,\s—-]*/, '').trim()
    return why ? ` (${why})` : ''
  }
  const live = (x: Registration) => registrationState(x).status === 'Active'
  if (d && d !== f) {
    const converted = /convert/i.test(f.statusDetails ?? '')
    const when = year(d.registrationDate)
    return d.state !== f.state
      ? `The formation filing is no longer active${converted ? '; it converted out' : ''}. The business appears to have moved to a newer ${stateName(
          d.state
        )} domestic registration${when ? ` in ${when}` : ''}.`
      : live(d)
        ? `The formation filing is no longer active${ended(f)}. The business appears to have moved to a newer ${stateName(
            d.state
          )} domestic registration${when ? ` from ${when}` : ''}, which is active.`
        : `The formation filing is no longer active${ended(f)}, and a later ${stateName(d.state)} domestic registration${
            when ? ` from ${when}` : ''
          } is also inactive${ended(d)}.`
  }
  if (!st.status)
    return st.silent
      ? `${stateName(f.state)} doesn't publish filing status, so whether the formation is still active isn't known.`
      : 'The state reports no status for the formation filing.'
  if (st.status === 'Active')
    return st.subStatus && !isGoodStanding(st.subStatus)
      ? `The formation filing is still active, but ${describeRegistration(f).toLowerCase().replace(/^active,?\s*/, '')}.`
      : 'The formation filing is still active.'
  return `The formation filing is no longer active${ended(f)}.`
}

/**
 * "a" or "an", by how the word is said: an Indiana LLC, an LLC, a corporation.
 * Initialisms read letter by letter, so LLC and LP take "an".
 */
export const article = (word: string) => {
  const w = word.trim()
  if (/^[A-Z]{2,5}$/.test(w)) return /^[AEFHILMNORSX]/.test(w) ? 'an' : 'a'
  return /^[aeiou]/i.test(w) && !/^(uni|use|usu|one)/i.test(w) ? 'an' : 'a'
}
