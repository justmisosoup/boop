import table from '../data/registrationStanding.json'
import type { BusinessRecord } from './deriveResults'
import { stateName } from './states'

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
 * details at all, so `silent` says so instead of treating it as a gap. The
 * standing table knows this — see `standingOf`.
 */
export type Registration = BusinessRecord['registrations'][number]

/**
 * What a filing's standing IS, as opposed to what it says.
 *
 * Every combination of state, status, sub status and details the registries
 * return (922 of them across 51 jurisdictions) is classified once, in
 * `src/data/registrationStanding.json`, built from the per-jurisdiction status
 * breakdown by `scripts/standing/build.py`. Georgia's "Active/Noncompliance" is
 * delinquent; Tennessee's "Active - Dissolved" is at risk; Andytown's
 * "Converted Out" is succeeded, not dissolved. A regex over the words cannot
 * know any of that, and three of them used to disagree.
 *
 * Every standing decision on the page reads this: the score's caps and the
 * flag on the sub-status row. How a filing is WORDED stays with
 * `describeRegistration`, which says the registry's own words.
 */
export type StandingCategory =
  | 'IN_GOOD_STANDING'
  | 'NOT_PUBLISHED'
  | 'DELINQUENT'
  | 'AT_RISK'
  | 'SUSPENDED'
  | 'SUCCEEDED'
  | 'TERMINATED_INVOLUNTARY'
  | 'TERMINATED_VOLUNTARY'
  | 'TERMINATED_UNSPECIFIED'
  | 'NOT_FORMED'
  | 'UNRESOLVED'

/** CLEAR stands; NOTE is a gap in what the state publishes; REVIEW has to be
 *  looked at; CONCERN is a filing the entity cannot currently stand on. */
export type StandingAssessment = 'CLEAR' | 'NOTE' | 'REVIEW' | 'CONCERN'

export type Standing = {
  category: StandingCategory
  assessment: StandingAssessment
  /** The table's classification of this combination is not yet reviewed. */
  provisional: boolean
  /** e.g. `STALE_RECORD` from an alias, `UNSEEN_STATUS` when the table has no entry. */
  flags: string[]
}

type Entry = { c: StandingCategory; a: StandingAssessment; review?: boolean; flags?: string[] }
const TABLE = table as unknown as {
  _meta: { assessment: Record<StandingCategory, StandingAssessment> }
  aliases: Record<string, { to: string; flags?: string[] }>
  entries: Record<string, Entry>
}

const part = (v: string | null | undefined) => (v && v.trim() ? v : '(none)')

/**
 * The table's reading of one filing.
 *
 * Keyed `STATE|STATUS|SUB STATUS|details`, with `(none)` for an absent field;
 * an alias resolves first (Wyoming's `INACTIVE / GOOD_STANDING / "ACTIVE"` is a
 * stale record, read as inactive). A combination the table has never seen is
 * unresolved, which is a question rather than a verdict.
 */
export const standingOf = (reg: Registration): Standing => {
  const raw = [
    part(reg.state),
    part(reg.status?.toUpperCase()),
    part(reg.subStatus?.toUpperCase()),
    part(reg.statusDetails)
  ].join('|')
  /* The details are matched as written first, then in capitals: Wyoming
     writes the same standing "ACTIVE" on one filing and "Active" on the next
     (CJG Holding's), and the second read as a combination never seen. */
  const upper = raw.split('|').slice(0, 3).concat(part(reg.statusDetails?.toUpperCase())).join('|')
  const key = TABLE.aliases[raw] || TABLE.entries[raw] ? raw : upper
  const alias = TABLE.aliases[key]
  const entry = TABLE.entries[alias?.to ?? key]
  const flags = [...(alias?.flags ?? []), ...(entry?.flags ?? [])]
  if (!entry)
    return { category: 'UNRESOLVED', assessment: TABLE._meta.assessment.UNRESOLVED, provisional: false, flags: [...flags, 'UNSEEN_STATUS'] }
  return { category: entry.c, assessment: entry.a, provisional: Boolean(entry.review), flags }
}

/** The state publishes no standing for this filing (Delaware, New Jersey). */
export const notPublished = (reg: Registration) => standingOf(reg).category === 'NOT_PUBLISHED'

/** Active, but the state has started taking it away, or says it is not in good standing. */
export const troubled = (reg: Registration) => {
  const { assessment } = standingOf(reg)
  return /^active$/i.test(reg.status ?? '') && (assessment === 'REVIEW' || assessment === 'CONCERN')
}

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
  silent: !known(reg.status) && notPublished(reg)
})

/**
 * The sub status as every surface states it — report, Attributes and Sources
 * alike. A filing without one says the state did not provide it; "Unknown"
 * claimed a value the registry never sent.
 */
export const NOT_PROVIDED = 'Not provided by state'
export const subStatusLabel = (reg: Registration) => registrationState(reg).subStatus ?? NOT_PROVIDED

/**
 * A sub status WORDED as good news, which a sentence need not repeat.
 *
 * Wording only: Tennessee's "Active - Dissolved" carries GOOD_STANDING as its
 * sub status, and whether the filing is actually in good standing is the
 * standing table's call (`standingOf`).
 */
const saysGoodStanding = (subStatus?: string) => Boolean(subStatus && /good standing/i.test(subStatus) && !/not/i.test(subStatus))

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
  if (!s.status) return s.silent ? 'status not provided by state' : 'status not reported'
  const sub =
    s.subStatus && !saysGoodStanding(s.subStatus) && words(s.subStatus) !== words(s.status)
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
 * A formation filing that converted out, and the domestic filing the business
 * converted into. Andytown was formed in California in 2012, converted to
 * Delaware in 2017, and registered back in California as a foreign LLC. The
 * Formation card leads with the Delaware filing it stands on now, and says
 * where it came from, rather than leading with a filing that no longer exists.
 *
 * Only a conversion: a later domestic filing beside an inactive formation
 * (Alliance Transfer's two New York filings) is not the same business moving,
 * and the card keeps its formation.
 */
export const convertedFormationOf = (record: BusinessRecord) => {
  const formed = formationFilingOf(record)
  const now = domesticOf(record)
  if (!formed || !now || formed === now || !/convert/i.test(formed.statusDetails ?? '')) return undefined
  // The foreign registration back in the state it left, if it has one.
  const foreign = record.registrations.find((r) => r !== formed && r.state === formed.state && !isDomestic(r))
  return { formed, now, foreign }
}

/** The subtext, in the filings' own facts: "Formed in California in 2012; that
 *  domestic filing is marked converted out. Its Delaware domestic filing was
 *  registered in 2017, and it holds an active California foreign registration."
 *  When it converted is not stated anywhere, so it is not said. */
export const convertedFormationNote = (c: NonNullable<ReturnType<typeof convertedFormationOf>>) => {
  const year = (iso?: string | null) => (iso && /^\d{4}/.test(iso) ? ` in ${iso.slice(0, 4)}` : '')
  const was = stateName(c.formed.state)
  const foreign = c.foreign
    ? `, and it holds ${/^active$/i.test(c.foreign.status ?? '') ? 'an active' : `a ${(c.foreign.status ?? '').toLowerCase() || 'reported'}`} ${was} foreign registration`
    : ''
  return `Formed in ${was}${year(c.formed.registrationDate)}; that domestic filing is marked converted out. Its ${stateName(
    c.now.state
  )} domestic filing was registered${year(c.now.registrationDate)}${foreign}.`
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
      ? "The state doesn't provide filing status, so whether the formation is still active isn't known."
      : 'The state reports no status for the formation filing.'
  if (st.status === 'Active')
    return troubled(f)
      ? `The formation filing is still active, but ${describeRegistration(f).toLowerCase().replace(/^active[,\s—-]*/, '')}.`
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
