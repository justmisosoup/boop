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
 * Unmapped values pass through verbatim — this expands what it knows and
 * invents nothing.
 */
const ENTITY_FORMS: Record<string, string> = {
  PLLC: 'Professional Limited Liability Company (PLLC)',
  PLLP: 'Professional Limited Liability Partnership (PLLP)',
  PC: 'Professional Corporation (PC)',
  LLC: 'Limited Liability Company (LLC)',
  LLP: 'Limited Liability Partnership (LLP)',
  LP: 'Limited Partnership (LP)',
  CORP: 'Corporation',
  CORPORATION: 'Corporation',
  INC: 'Corporation (Inc)'
}

export const entityFormLabel = <T extends string | null | undefined>(value: T): T | string =>
  value ? (ENTITY_FORMS[value.trim().toUpperCase()] ?? value) : value
