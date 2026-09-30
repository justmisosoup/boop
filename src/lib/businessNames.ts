import type { BusinessRecord } from './deriveResults'
import { linkedFormationOf } from './linkedFormation'
import { domesticOf, sameName, type Registration } from './registrationStatus'
import { soleProprietorOf, type SoleProprietor } from './soleProprietor'
import { sourceLabel } from './sourceLabels'
import { stateName } from './states'

/**
 * What the submitted business name IS, across every kind of name on the record.
 *
 * The API's `name` check asks one question: does a Secretary of State filing
 * carry the submitted name? That stays as it is — for some customers the name
 * must resolve to a state filing. But a business trades under more than its
 * legal name. Firebird Yarns has no state filing; San Francisco registers it as
 * what Kathryn Bernard does business as. Userleap Inc. has no filing either;
 * the same register lists it as a DBA of Mixboard Inc., which has a Delaware
 * filing. A reading that only knows filings calls both of them unverified, and
 * the data that answers the question sits on the record unread.
 *
 * So the name is read the way a filing's standing is (`standingOf`): once, here,
 * into a category and an assessment, and everything that says anything about
 * the name — the insight, its flag, the score's caps, the Identity card, the
 * entity chip, the Formation card — reads this. Nothing else matches names.
 *
 * Fictitious business name filings are not modelled: no source on the record
 * carries them.
 */
export type NameCategory =
  /** The legal name on a state filing. */
  | 'MATCHES_LEGAL_NAME'
  /** A DBA of a business whose own state filing is on record. */
  | 'DBA_OF_REGISTERED_BUSINESS'
  /** A DBA of a person, with no state filing: likely a sole proprietorship. */
  | 'DBA_OF_PERSON'
  /** A DBA of a business with no filing found. */
  | 'DBA_OF_UNREGISTERED_BUSINESS'
  /** Filings exist, but none carries the name and no DBA links it to them. */
  | 'NOT_ON_ITS_FILINGS'
  /** No filing and no DBA. */
  | 'NOT_FOUND'

/** The same four words the standing table uses. */
export type NameAssessment = 'CLEAR' | 'NOTE' | 'REVIEW' | 'CONCERN'

const ASSESSMENT: Record<NameCategory, NameAssessment> = {
  MATCHES_LEGAL_NAME: 'CLEAR',
  DBA_OF_REGISTERED_BUSINESS: 'NOTE',
  DBA_OF_PERSON: 'NOTE',
  DBA_OF_UNREGISTERED_BUSINESS: 'REVIEW',
  NOT_ON_ITS_FILINGS: 'NOTE',
  NOT_FOUND: 'CONCERN'
}

/** A trade name, where it was found, and who it belongs to. */
export type Dba = {
  name: string
  /** Whose trade name it is — a person or a business, as the source spells it. */
  owner: string | null
  /** Where it was found: "San Francisco business registration", "Form 5500". */
  source: string
  /** City-register rows: which city, and the ref id its chip resolves through. */
  city?: string
  refIds?: string[]
  account?: string | null
  since?: string | null
  /** A location still open under it; undefined where the source says nothing. */
  open?: boolean
  /** When the last location under it closed, where none is open. */
  until?: string | null
}

export type NameStanding = {
  category: NameCategory
  assessment: NameAssessment
  /** The name as the customer submitted it. */
  submitted: string
  /** Filings whose name is the submitted one: the one the page stands on first. */
  legal: Registration[]
  /** Every trade name on the record. */
  dbas: Dba[]
  /** The DBA the submitted name is, when it is one. */
  matchedDba?: Dba
  /** Where the DBA's owning business is filed, for `DBA_OF_REGISTERED_BUSINESS`. */
  ownerFiling?: Registration
  /** Whether that filing is on another record in the account, found by `linkedFormationOf`. */
  ownerLinked?: boolean
  sole?: SoleProprietor
}

/** A business, not a person: an entity suffix or a word no person is called. */
const BUSINESS = /\b(LLC|L\.L\.C|PLLC|INC|INCORPORATED|CORP|CORPORATION|COMPANY|CO\.|LTD|LP|LLP|PBC|PC|HOLDINGS|GROUP|TRUST|BANK|ASSOCIATION)\b/i
export const isBusinessName = (name: string | null | undefined) => BUSINESS.test(name ?? '')

/** "WOO YOUNG LEE DDS, INC DBA GRACE DENTAL GROUP" → the owner, and the trade name. */
const TRADE_AS = /\s+(?:DBA|D\/B\/A|A\/K\/A|AKA)\s+/i

/**
 * Every trade name on the record.
 *
 * From the city register, where it has been pulled (owner, account, since), and
 * from name strings that carry one inside them, which a Form 5500 does. A DBA
 * that is its owner's own name (Checkr's city DBA is CHECKR, INC.) is not a
 * trade name and is dropped; the same name from two sources is one DBA.
 */
export const dbasOf = (
  record: BusinessRecord,
  /** Keep a trade name that is its owner's own. The Formation card drops the
   *  one that is its legal name instead: Sprig's card reads SPRIG
   *  TECHNOLOGIES INC., so its register's Mixboard Inc. is another name. */
  keepOwnerName = false
): Dba[] => {
  const out: Dba[] = []
  const add = (d: Dba) => {
    if (!d.name.trim() || (!keepOwnerName && d.owner && sameName(d.name, d.owner))) return
    const seen = out.find((x) => sameName(x.name, d.name) && (!x.owner || !d.owner || sameName(x.owner, d.owner)))
    if (seen) {
      seen.owner = seen.owner ?? d.owner
      return
    }
    out.push(d)
  }

  // One per account and trade name; open if any location under it still is.
  const regs = record.cityRegistrations ?? []
  for (const r of regs) {
    if (!r.dba) continue
    const same = regs.filter((x) => x.accountNumber === r.accountNumber && x.dba && sameName(x.dba, r.dba))
    add({
      name: r.dba,
      owner: r.owner,
      source: `${r.city} business registration`,
      city: r.city,
      refIds: [...new Set(same.map((x) => x.refId).filter((x): x is string => Boolean(x)))],
      account: r.accountNumber,
      since: same.map((x) => x.businessStart).filter(Boolean).sort()[0] ?? r.businessStart,
      open: same.some((x) => !x.locationEnd && !x.businessEnd),
      until: same.some((x) => !x.locationEnd && !x.businessEnd)
        ? undefined
        : same.map((x) => x.businessEnd ?? x.locationEnd).filter(Boolean).sort().at(-1)
    })
  }

  for (const n of record.names ?? []) {
    const [owner, trade] = n.name.split(TRADE_AS)
    if (!trade) continue
    add({ name: trade.trim(), owner: owner.trim(), source: (n.sources ?? []).map(sourceLabel)[0] ?? 'Name on file' })
  }
  return out
}

const isDomestic = (r: Registration) => /domestic/i.test(r.jurisdiction ?? '')

/** The name as submitted: the submitted name on the record, or the record's own. */
export const submittedNameOf = (record: BusinessRecord) =>
  (record.names ?? []).find((n) => n.submitted)?.name ?? record.name

/** The state filing a business trades under, by the owner's name: on this
 *  record, or on another record in the account that `linkedFormationOf` ties. */
export const filingOf = (record: BusinessRecord, owner: string): { filing: Registration; linked: boolean } | undefined => {
  const own = record.registrations.find((r) => sameName(r.name, owner))
  if (own) return { filing: own, linked: false }
  const linked = linkedFormationOf(record)
  if (linked && (sameName(linked.name, owner) || sameName(linked.record.name, owner) || sameName(linked.filing.name, owner)))
    return { filing: linked.filing, linked: true }
  return undefined
}

/** The reading of the submitted name. See `NameCategory`. */
export const nameStandingOf = (record: BusinessRecord): NameStanding => {
  const submitted = submittedNameOf(record)
  // The filing the page stands on first (Andytown's Delaware, not the California
  // one it converted out of), then domestic, then the rest.
  const standsOn = domesticOf(record)
  const rank = (r: Registration) => (r === standsOn ? 0 : isDomestic(r) ? 1 : 2)
  const legal = record.registrations.filter((r) => sameName(r.name, submitted)).sort((a, b) => rank(a) - rank(b))
  const dbas = dbasOf(record)
  const matchedDba = dbas.find((d) => sameName(d.name, submitted))
  const sole = soleProprietorOf(record)
  const base = { submitted, legal, dbas, matchedDba, sole }
  const as = (category: NameCategory, extra: Partial<NameStanding> = {}): NameStanding => ({
    category,
    assessment: ASSESSMENT[category],
    ...base,
    ...extra
  })

  if (legal.length > 0) return as('MATCHES_LEGAL_NAME')
  if (matchedDba?.owner && isBusinessName(matchedDba.owner)) {
    const found = filingOf(record, matchedDba.owner)
    return found
      ? as('DBA_OF_REGISTERED_BUSINESS', { ownerFiling: found.filing, ownerLinked: found.linked })
      : as('DBA_OF_UNREGISTERED_BUSINESS')
  }
  // A person's trade name, or one the register files under no owner at all —
  // with no state filing, that is the shape of a sole proprietor.
  if (matchedDba && record.registrations.length === 0) return as('DBA_OF_PERSON')
  if (record.registrations.length > 0) return as('NOT_ON_ITS_FILINGS')
  return as('NOT_FOUND')
}

/** This business's own trade names: owned by it, or filed with no owner. */
export const ownDbas = (n: NameStanding, record: BusinessRecord) =>
  n.dbas.filter(
    (d) =>
      // A trade name every location of which has closed is the account's
      // history, not a name it trades under: Mixboard's Userleap Inc., 2017–2021.
      d.open !== false &&
      !sameName(d.name, n.submitted) &&
      (!d.owner || sameName(d.owner, n.submitted) || record.registrations.some((r) => sameName(r.name, d.owner)))
  )

const filingText = (r: Registration) => `${stateName(r.state)} ${isDomestic(r) ? 'domestic' : 'foreign'} filing`

/**
 * One fact per insight. `submitted_name` says only what the submitted name is;
 * everything else the names establish is its own insight, below — the
 * business's other trade names, the name filed as another business's DBA, and
 * whether that business is itself filed. "Likely a sole proprietorship" is the
 * entity type's to say, and "no state filing" the `name` check's.
 */
export const nameStatement = (n: NameStanding): string => {
  switch (n.category) {
    case 'MATCHES_LEGAL_NAME':
      return `Submitted business name matches the legal name on the ${filingText(n.legal[0])}`
    // What it is a DBA of. Which business, where it is listed and the filing
    // that business points to are the evidence.
    case 'DBA_OF_REGISTERED_BUSINESS':
    case 'DBA_OF_UNREGISTERED_BUSINESS':
      return 'Submitted business name is listed as a DBA of another business entity'
    case 'DBA_OF_PERSON':
      return 'Submitted business name is listed as a DBA of an individual'
    case 'NOT_ON_ITS_FILINGS':
      return "Submitted business name matches none of this business's filings or DBAs"
    case 'NOT_FOUND':
      return 'Submitted business name matches no state filing or DBA on file'
  }
}

/** `trade_names`: this business's own trade names, other than the submitted one. */
export const tradeNamesStatement = (own: Dba[]) =>
  own.length === 1 ? 'The business has another DBA name on file' : `The business has ${own.length} other DBA names on file`

/**
 * `submitted_name_dba`: the submitted name registered as ANOTHER business's
 * trade name while it is a legal name in its own right — Sprig Technologies
 * Inc. is filed in California, and San Francisco lists it as a DBA of Mixboard
 * Inc. Where the name is not a legal name, `submitted_name` already says it.
 */
export const dbaOfAnotherOf = (n: NameStanding): Dba | undefined =>
  n.category === 'MATCHES_LEGAL_NAME' && n.matchedDba?.owner && !sameName(n.matchedDba.owner, n.submitted)
    ? n.matchedDba
    : undefined

export const dbaOfAnotherStatement = () => 'Submitted business name is listed as a DBA of another business entity'

/**
 * `dba_owner_filing`: whether the business the submitted name is a DBA of is
 * itself filed. Only for an owner that is a business; a person files nothing.
 * A filing found on a linked record is `linked_domestic`'s to say — the same
 * filing the Formation card leads with — so it is not said twice.
 */
export const dbaOwnerOf = (record: BusinessRecord, n: NameStanding) => {
  const owner = n.matchedDba?.owner
  if (!owner || !isBusinessName(owner) || sameName(owner, n.submitted)) return undefined
  const found = filingOf(record, owner)
  if (found?.linked) return undefined
  return { owner, filing: found?.filing }
}

export const dbaOwnerStatement = ({ filing }: NonNullable<ReturnType<typeof dbaOwnerOf>>) =>
  filing ? `The related business's ${filingText(filing)} is on record` : 'No state filing is on record for the related business'

/**
 * What to call the entity when no state filing says.
 *
 * A formation's entity type always wins; this is only the fallback, and it says
 * LIKELY because nothing on the record states it. Undefined when nothing on
 * file says either, which the page shows as Unknown.
 */
export const entityFallback = (record: BusinessRecord): string | undefined => {
  const n = nameStandingOf(record)
  if (n.category === 'DBA_OF_PERSON') return 'Likely sole proprietorship'
  if ((n.category === 'DBA_OF_REGISTERED_BUSINESS' || n.category === 'DBA_OF_UNREGISTERED_BUSINESS') && n.matchedDba?.owner)
    return `DBA of ${n.matchedDba.owner}`
  return undefined
}
