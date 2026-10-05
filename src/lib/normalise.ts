import type { BusinessRecord } from './deriveResults'

/**
 * An entity form, spelled out.
 *
 * `PLLC` is four letters that decide how a file is handled — a licensed
 * professional practice whose members must each hold a licence in the
 * profession — and a reviewer who does not already know the abbreviation
 * cannot read that off it. The same is true one step down for `LLP` and `PC`.
 *
 * The abbreviation stays, in the parenthesis: it is what the filing says, what
 * a policy is keyed on, and what the reviewer will type into the next system.
 * Spelling it out adds the meaning without replacing the token.
 *
 * Unmapped values pass through in sentence case — this expands what it knows
 * and invents nothing.
 */
const ENTITY_FORMS: Record<string, string> = {
  PLLC: 'Professional limited liability company (PLLC)',
  PLLP: 'Professional limited liability partnership (PLLP)',
  PC: 'Professional corporation (PC)',
  LLC: 'Limited liability company (LLC)',
  LLP: 'Limited liability partnership (LLP)',
  LP: 'Limited partnership (LP)',
  CORP: 'Corporation',
  CORPORATION: 'Corporation',
  INC: 'Corporation (Inc)'
}

/**
 * Sentence case, as every entity type reads: the filings write CORPORATION and
 * SOLE PROPRIETORSHIP in capitals, and the report does not shout them. A short
 * initialism (LLC, PC) is an abbreviation and stays as it is.
 */
const sentenceCase = (v: string) => {
  const t = v.trim()
  if (/^[A-Z]{1,5}$/.test(t)) return t
  const lower = t.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

export const entityFormLabel = <T extends string | null | undefined>(value: T): T | string =>
  value ? (ENTITY_FORMS[value.trim().toUpperCase()] ?? sentenceCase(value)) : value

const SOLE = /sole\s*propriet/i

/** A filing states the business is a sole proprietorship — the only thing that
 *  makes it one here rather than a likely one. */
export const soleProprietorshipFiled = (record: Pick<BusinessRecord, 'registrations'>) =>
  record.registrations.some((r) => SOLE.test(r.entityType ?? ''))

/**
 * The entity type as the report states it.
 *
 * "Sole proprietorship" only where a filing — usually the Secretary of State's
 * — says so. The submitted entity type, even one the API marks verified, is not
 * a document stating it: Kami Agbeti's SOLE PROPRIETORSHIP is the customer's
 * word, read against the absence of any filing. Everywhere else it is likely.
 */
export const entityTypeShown = <T extends string | null | undefined>(
  record: Pick<BusinessRecord, 'registrations'>,
  value: T
): T | string => (value && SOLE.test(value) && !soleProprietorshipFiled(record) ? 'Likely sole proprietorship' : entityFormLabel(value))
