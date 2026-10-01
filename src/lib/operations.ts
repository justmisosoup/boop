import { attributesFor, dedupeAddresses, formatCodes, provenanceList, type AttributeRow } from './attributes'
import type { BusinessRecord } from './deriveResults'

/**
 * What the business does, where it does it, and whether its industry needs a
 * licence — the one reading the industry-and-locations card, its sentence and
 * the Ownership card's licence line all draw from.
 */

type Classification = NonNullable<BusinessRecord['industry']>[number]
export type Licence = NonNullable<BusinessRecord['licenses']>[number]
export type FmcsaRegistration = NonNullable<BusinessRecord['fmcsaRegistrations']>[number]
export type Location = BusinessRecord['addresses'][number] & { sourceNames: string[] }

/** The classifier's own "no answer" code. */
const INSUFFICIENT = /^insufficient data$/i

/**
 * Industries whose practice needs a licence, by lead NAICS prefix, and the
 * public register we can read for it. Health practitioners are in the NPI
 * Registry; motor carriers in FMCSA's, which the record already carries. The
 * rest are licensed by state boards with no public API: the card says the
 * licence is required and that no register was checked.
 */
export const LICENSED_INDUSTRIES: ReadonlyArray<{ prefix: string; profession: string; registry: 'NPI' | 'FMCSA' | 'none' }> = [
  { prefix: '621', profession: 'healthcare practitioner', registry: 'NPI' },
  { prefix: '484', profession: 'motor carrier', registry: 'FMCSA' },
  { prefix: '5411', profession: 'legal services', registry: 'none' },
  { prefix: '5412', profession: 'accounting', registry: 'none' },
  { prefix: '5312', profession: 'real estate brokerage', registry: 'none' },
  { prefix: '5221', profession: 'banking', registry: 'none' },
  { prefix: '5242', profession: 'insurance agency', registry: 'none' }
]

export type LicenceStanding =
  | { required: false }
  | { required: true; profession: string; registry: 'NPI'; found: Licence[] }
  | { required: true; profession: string; registry: 'FMCSA'; found: FmcsaRegistration[] }
  | { required: true; profession: string; registry: 'none'; found: [] }

export type OfficeVerdict = 'active' | 'inactive' | 'not_registered' | 'unknown'

export type Operations = {
  industry: {
    /** The highest-scored NAICS classification. */
    lead?: { name: string; code: string }
    /** What the Prohibited scheme said: a flag, "Other Non-Prohibited", or nothing. */
    prohibited: 'flagged' | 'clear' | 'unknown'
    flagged: Classification[]
    /** The classifier answered "Insufficient data". */
    insufficient: boolean
    /** The classifications, a row per scheme and category, as the table draws them. */
    table: AttributeRow[]
  }
  /** Submitted first, then every other place a source ties to the business. */
  locations: Location[]
  /** Whether the business is registered in the state of its office. */
  office?: { state: string; verdict: OfficeVerdict }
  licence: LicenceStanding
}

const isAgent = (a: BusinessRecord['addresses'][number]) => Boolean(a.isRegisteredAgent) || a.labels.includes('registered_agent')

/** The record's highest-scored NAICS classification. */
export const leadNaics = (record: BusinessRecord) => {
  const naics = (record.industry ?? []).filter((c) => (c.naicsCodes ?? []).length > 0 && c.name)
  if (naics.length === 0) return undefined
  const top = [...naics].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]
  return { name: top.name as string, code: (top.naicsCodes as string[])[0] }
}

const licenceOf = (record: BusinessRecord, code?: string): LicenceStanding => {
  const rule = code ? LICENSED_INDUSTRIES.find((l) => code.startsWith(l.prefix)) : undefined
  if (!rule) return { required: false }
  if (rule.registry === 'NPI') return { required: true, profession: rule.profession, registry: 'NPI', found: record.licenses ?? [] }
  if (rule.registry === 'FMCSA')
    return { required: true, profession: rule.profession, registry: 'FMCSA', found: record.fmcsaRegistrations ?? [] }
  return { required: true, profession: rule.profession, registry: 'none', found: [] }
}

const officeOf = (record: BusinessRecord): Operations['office'] => {
  // The submitted address, whatever it is — Supabase's is its Delaware agent's.
  const state = record.addresses.find((a) => a.submitted && a.state)?.state
  if (!state) return undefined
  const said = record.reviewTasks.find((t) => t.key === 'sos_match')?.subLabel ?? ''
  const verdict: OfficeVerdict = /active/i.test(said) && !/inactive/i.test(said)
    ? 'active'
    : /inactive/i.test(said)
      ? 'inactive'
      : /not registered/i.test(said)
        ? 'not_registered'
        : 'unknown'
  return { state, verdict }
}

export const operationsOf = (record: BusinessRecord): Operations => {
  const classes = record.industry ?? []
  const lead = leadNaics(record)
  const insufficient = Boolean(lead && INSUFFICIENT.test(lead.name))
  const flagged = classes.filter((c) => c.highRisk)
  const scheme = classes.filter((c) => /^prohibited$/i.test(c.system ?? ''))
  const prohibited: Operations['industry']['prohibited'] =
    flagged.length > 0 ? 'flagged' : scheme.some((c) => c.name && !INSUFFICIENT.test(c.name)) ? 'clear' : 'unknown'

  /* The table: the evidence rows (NAICS, SIC, MCC — the data) with the
     Prohibited scheme in front of them. The evidence leaves that scheme out
     as a judgment; the card is where the customer's prohibited list is read,
     so here it leads. */
  // Only a flag is a row worth a line in the table: "Other Non-Prohibited" at
  // 100% says nothing the tile does not, and the tile already says it.
  const prohibitedRows: AttributeRow[] = scheme
    .filter((c) => c.name && c.highRisk)
    .map((c) => ({
      label: 'Prohibited',
      value: c.name as string,
      lead: formatCodes(c.mccCodes ?? []) || undefined,
      trailing: typeof c.score === 'number' ? `${Math.round(c.score * 100)}%` : undefined,
      source: '',
      sources: []
    }))
  const table = [...prohibitedRows, ...attributesFor('industry', record).filter((r) => r.lead)]

  // Every place a source puts the business: the submitted address(es) first —
  // whatever they are, the customer gave them — then the rest, a registered
  // agent's address and anything that never parsed to a state left out.
  const places = dedupeAddresses(record.addresses.filter((a) => a.state && (a.submitted || !isAgent(a))))
  const locations: Location[] = [...places.filter((a) => a.submitted), ...places.filter((a) => !a.submitted)].map((a) => ({
    ...a,
    sourceNames: provenanceList(a)
  }))

  return {
    industry: { lead: insufficient ? undefined : lead, prohibited, flagged, insufficient, table },
    locations,
    office: officeOf(record),
    licence: licenceOf(record, lead?.code)
  }
}

/** The app's bands for how many businesses share an address. */
export const locationBand = (count: number | null | undefined): { label: string } | undefined => {
  if (!count || count < 1) return undefined
  if (count === 1) return { label: '1 business uses this location' }
  if (count <= 20) return { label: '2–20 businesses use this location' }
  if (count <= 100) return { label: '21–100 businesses use this location' }
  if (count <= 1000) return { label: '101–1000 businesses use this location' }
  if (count <= 10000) return { label: '1001–10000 businesses use this location' }
  return { label: '10000+ businesses use this location' }
}

/** The street line and the ZIP5 — a floor or suite is the same address. */
const place = (s: string) => {
  const w = (s.split(',')[0] ?? '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)
  const street: string[] = []
  for (let i = 0; i < w.length; i++) {
    if (/^(FL|FLOOR|STE|SUITE|APT|UNIT|RM|ROOM|NO)$/.test(w[i])) {
      i++
      continue
    }
    street.push(w[i])
  }
  return { street: street.join(' '), zip: (s.match(/\b(\d{5})(?:-\d{4})?\b/) ?? [])[1] }
}

/** The licences whose practice address is this one. */
export const licencesAt = (licence: LicenceStanding, address: string): Licence[] => {
  if (!licence.required || licence.registry !== 'NPI') return []
  const here = place(address)
  return licence.found.filter((l) => {
    if (!l.address) return false
    const at = place(l.address)
    return Boolean(here.street) && here.street === at.street && Boolean(here.zip) && here.zip === at.zip
  })
}
