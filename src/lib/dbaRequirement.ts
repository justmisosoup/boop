import rules from '../data/dbaRules.json'
import { submittedNameOf } from './businessNames'
import type { BusinessRecord } from './deriveResults'
import { sameName } from './registrationStatus'
import { stateName } from './states'

/**
 * What a state asks of a sole proprietor trading under a name other than
 * their own — a DBA, an assumed name, a fictitious business name, a trade name
 * — read from the state of the submitted address.
 *
 * The rules are `src/data/dbaRules.json`: one row per state and DC, each
 * checked against the statute or the agency's own page, with the source kept
 * beside it. Sole proprietors only: an LLC's or a corporation's DBA rules are
 * often different and are not modelled.
 *
 * Explanation only. Nothing here moves a score or a cap: the card says what
 * the state requires and whether that filing could be seen, and the reader
 * weighs it.
 */
export type DbaRule = {
  name: string
  requirement: 'required' | 'optional' | 'none'
  level: 'state' | 'county' | 'municipal' | 'state_and_county' | 'none'
  /** Who it is filed with, as the sentence says it: "the county clerk". */
  office: string | null
  /** What is filed, with its article: "an assumed business name certificate". */
  term: string | null
  /** What counts as the owner's own name, so that no filing is needed. */
  ownNameRule: string | null
  statute: string | null
  source: string | null
  publication: boolean
  renewalYears: number | null
  confidence: 'high' | 'medium' | 'low'
  verifiedOn: string | null
  /** Whether Middesk's DBA search covers the state (`source/documents/01-formation-identity.md`). */
  coverage: 'searchable' | 'not_searchable' | 'unknown'
  notes: string
}

const RULES = (rules as unknown as { states: Record<string, DbaRule> }).states

export type DbaRequirement = {
  state: string
  rule: DbaRule
  /** The business name is a person's on the record, word for word: no DBA is
   *  needed anywhere. A surname alone is not enough — states disagree on it. */
  ownName: boolean
  /** A DBA search ran on this record. None has in this account. */
  searched: boolean
  /** A DBA filing on the record carries the submitted name. */
  found: boolean
}

/** Every DBA-filing reference on the record. */
const dbaRefs = (record: BusinessRecord) =>
  [...(record.names ?? []), ...record.addresses, ...record.people].flatMap((x) =>
    (x.sourceRefs ?? []).filter((r) => r.type === 'dba_registration')
  )

/** The rule for the submitted address's state, and what the record says against it. */
export const dbaRequirementOf = (record: BusinessRecord): DbaRequirement | undefined => {
  const state = record.addresses.find((a) => a.submitted && a.state)?.state?.toUpperCase()
  const rule = state ? RULES[state] : undefined
  if (!state || !rule) return undefined
  const submitted = submittedNameOf(record)
  const refs = dbaRefs(record)
  return {
    state,
    rule,
    ownName: record.people.some((p) => sameName(p.name, submitted)),
    // The record's orders are on the pulled JSON, not on its type.
    searched:
      refs.length > 0 ||
      ((record as { orders?: Array<{ package?: string }> }).orders ?? []).some((o) => /dba/i.test(o.package ?? '')),
    found: (record.names ?? []).some(
      (n) => sameName(n.name, submitted) && (n.sourceRefs ?? []).some((r) => r.type === 'dba_registration')
    )
  }
}

/**
 * The state's rule in one sentence, and whether the filing could be seen.
 *
 * Own name is said only on a word-for-word match to a person on the record;
 * otherwise the rule is stated with its condition — "trading under a name
 * other than their own" — because the record does not say whose name it is.
 */
export const dbaRequirementNote = (record: BusinessRecord): string | undefined => {
  const d = dbaRequirementOf(record)
  if (!d) return undefined
  const s = stateName(d.state)
  const r = d.rule
  if (r.requirement === 'none') return `${s} has no DBA filing for sole proprietors.`
  if (d.ownName) return `The business name is the owner's own name, so ${s} requires no DBA filing.`
  if (r.requirement === 'optional')
    return `${s} doesn't require a sole proprietor to register a trade name${r.office ? `; registering with ${r.office} is optional` : ''}.`
  const tail = d.found
    ? `a ${s} DBA filing carries the business name`
    : d.searched
      ? `none was found in ${s} DBA filings`
      : r.coverage === 'not_searchable'
        ? `Middesk doesn't search ${s} DBA filings`
        : `DBA filings weren't searched for this business`
  // A rule the research could not confirm keeps its condition and drops the detail.
  if (r.confidence === 'low' || !r.term || !r.office)
    return `In ${s}, a sole proprietor trading under a name other than their own may need to file a DBA; ${tail}.`
  return `In ${s}, a sole proprietor trading under a name other than their own files ${r.term} with ${r.office}; ${tail}.`
}

/** The rule as the card's grid states it: the requirement, in three words. */
export const dbaRequirementValue = (r: DbaRule) =>
  r.requirement === 'required' ? 'Required for a trade name' : r.requirement === 'optional' ? 'Optional' : 'No filing'
