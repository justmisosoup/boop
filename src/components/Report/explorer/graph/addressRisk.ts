/**
 * Address risk derivation (mode-level, pure) — the app's address intelligence
 * (CMRA, deliverability, USPS record type, shared-location counts, property
 * type, the scored risk rating) folded into the canvas's existing risk
 * grammar: `flags` for the quiet meta line, `risk` for the interpunct ink,
 * `anomaly` for the utility foot.
 *
 * Three stances, borrowed rather than invented:
 * - PRECEDENCE is the report's (`buildVerifyRead.ts` ADDRESS_STRINGS): CMRA >
 *   vacant > undeliverable > … > residential, with the failure-tier USPS
 *   flags (PO box, private mailbox, virtual) slotted after deliverability —
 *   the plate never re-decides which fact matters most.
 * - SEVERITY comes only from the scored rollup (`rating.risk_rating`). Flags
 *   alone never fabricate a judgment: no rating → the flags print uninked.
 * - REGISTERED AGENT is context, not risk (RiskIntelligence's explicit
 *   stance, and the canvas's gray hub) — it is deliberately not a flag here.
 *
 * The `anomaly` claims the card and makes the node ESCAPE bundling (keepOut),
 * so it is reserved for `high` alone: a high-risk address stands out of the
 * fan on the map itself; a moderate one stays bundled with an inked meta.
 *
 * Ported from app/src/containers/Explorer/graph/addressRisk.ts — the derivation
 * and its fact rows. The app's two adapters (BusinessHome's `Address` record and
 * the wire's properties bag) are not ported; the prototype's record addresses are
 * read in `fromConnections.ts`. The prototype records carry no scored
 * `risk_rating`, so `risk` and the high-risk `anomaly` never set here — the flags
 * print uninked, which is this module's own stance (flags never fabricate a
 * judgment).
 */

export interface AddressRisk {
  /** compact flag copy in precedence order (the app's words: "CMRA",
   *  "Undeliverable", "101–1000 businesses", …) — empty when clean/unknown */
  flags: string[]
  risk?: 'high' | 'medium'
  anomaly?: string
}

/** normalized signals both adapters feed — every field optional; absent
 *  means unknown, and unknown never flags */
export interface AddressRiskSignals {
  cmra?: boolean
  deliverability?: 'deliverable' | 'undeliverable' | 'vacant'
  propertyType?: 'commercial' | 'residential'
  locationCount?: number
  poBox?: boolean
  privateMailbox?: boolean
  virtualAddress?: boolean
  riskRating?: 'high' | 'moderate' | 'low' | 'not_available'
}

/** shared-location bucket copy (the AddressesCard vocabulary, range-keyed);
 *  ≤ 20 businesses is normal and never flags */
const locationFlag = (n: number): string | null =>
  n > 10000
    ? '10000+ businesses'
    : n > 1000
      ? '1001–10000 businesses'
      : n > 100
        ? '101–1000 businesses'
        : n > 20
          ? '21–100 businesses'
          : null

/** the utility foot's long form per flag (the report's nouns) */
const FOOT_NOUN: Record<string, string> = {
  CMRA: 'commercial mail receiving agency',
  Vacant: 'vacant per USPS',
  Undeliverable: 'undeliverable per USPS',
  'PO box': 'PO box',
  'Private mailbox': 'private mailbox',
  'Virtual address': 'virtual address',
  Residential: 'residential property'
}

export function deriveAddressRisk(s: AddressRiskSignals): AddressRisk {
  const flags: string[] = []
  if (s.cmra) flags.push('CMRA')
  if (s.deliverability === 'vacant') flags.push('Vacant')
  if (s.deliverability === 'undeliverable') flags.push('Undeliverable')
  if (s.poBox) flags.push('PO box')
  if (s.privateMailbox) flags.push('Private mailbox')
  if (s.virtualAddress) flags.push('Virtual address')
  // failure-tier sharing (>100) slots before Residential, moderate after —
  // the report's precedence interleave
  const count = s.locationCount ?? 0
  const shared = locationFlag(count)
  if (shared && count > 100) flags.push(shared)
  if (s.propertyType === 'residential') flags.push('Residential')
  if (shared && count <= 100) flags.push(shared)

  const risk =
    s.riskRating === 'high'
      ? ('high' as const)
      : s.riskRating === 'moderate'
        ? ('medium' as const)
        : undefined

  const anomaly =
    risk === 'high'
      ? flags.length > 0
        ? `High-risk address — ${FOOT_NOUN[flags[0]] ?? `shared by ${flags[0]}`}`
        : 'High-risk address'
      : undefined

  return anomaly ? { flags, risk, anomaly } : { flags, risk }
}

/** the USPS-derived flags (AddressesCard prefixes these "USPS ·"); the
 *  location-frequency buckets and the virtual-address indicator are not USPS's
 *  words and get their own fact rows */
const USPS_FLAGS = new Set([
  'CMRA',
  'Vacant',
  'Undeliverable',
  'PO box',
  'Private mailbox',
  'Residential'
])

/** compose flags into the focus plate's fact rows, grouped by their source
 *  vocabulary — ["USPS", "CMRA · Undeliverable"], ["Type", "Virtual address"],
 *  ["Shared", "101–1000 businesses"] — order inside a row follows the flags'
 *  own precedence order */
export function flagFacts(flags: string[]): [string, string][] {
  const out: [string, string][] = []
  const usps = flags.filter(f => USPS_FLAGS.has(f))
  if (usps.length > 0) out.push(['USPS', usps.join(' · ')])
  if (flags.includes('Virtual address')) out.push(['Type', 'Virtual address'])
  const shared = flags.find(f => f.endsWith('businesses'))
  if (shared) out.push(['Shared', shared])
  return out
}

/** the KybNode fields a derivation authors — spread onto the node. Empty
 *  flags and unset severity stay ABSENT, never `[]`/`undefined` keys: the
 *  zod boundary and every downstream `n.flags?.length` check assume absence. */
export function addressRiskNodeProps(r?: AddressRisk): {
  flags?: string[]
  risk?: 'high' | 'medium'
  anomaly?: string
} {
  if (!r) return {}
  return {
    ...(r.flags.length > 0 ? { flags: r.flags } : {}),
    ...(r.risk ? { risk: r.risk } : {}),
    ...(r.anomaly ? { anomaly: r.anomaly } : {})
  }
}
