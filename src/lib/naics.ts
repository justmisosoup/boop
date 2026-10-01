import type { BusinessRecord } from './deriveResults'

/**
 * The NAICS sectors — the two-digit top of the scheme, as the census names
 * them. The context roll-up names the sector the business is in, not the
 * six-digit code: "Accommodation and Food Services" is the level a policy is
 * written at.
 */
const SECTORS: Record<string, string> = {
  '11': 'Agriculture, Forestry, Fishing and Hunting',
  '21': 'Mining, Quarrying, and Oil and Gas Extraction',
  '22': 'Utilities',
  '23': 'Construction',
  '31': 'Manufacturing',
  '32': 'Manufacturing',
  '33': 'Manufacturing',
  '42': 'Wholesale Trade',
  '44': 'Retail Trade',
  '45': 'Retail Trade',
  '48': 'Transportation and Warehousing',
  '49': 'Transportation and Warehousing',
  '51': 'Information',
  '52': 'Finance and Insurance',
  '53': 'Real Estate and Rental and Leasing',
  '54': 'Professional, Scientific, and Technical Services',
  '55': 'Management of Companies and Enterprises',
  '56': 'Administrative and Support and Waste Management and Remediation Services',
  '61': 'Educational Services',
  '62': 'Health Care and Social Assistance',
  '71': 'Arts, Entertainment, and Recreation',
  '72': 'Accommodation and Food Services',
  '81': 'Other Services (except Public Administration)',
  '92': 'Public Administration'
}

/**
 * The sector of the record's highest-ranked NAICS classification.
 *
 * NAICS only: an MCC or SIC category is a different scheme, and its name is
 * not a sector a policy is written against. Highest classifier score first;
 * the census sector of its first NAICS code. Undefined when no classification carries a NAICS code.
 */
export const industrySectorOf = (record: BusinessRecord): string | undefined => {
  const naics = (record.industry ?? []).filter((c) => (c.naicsCodes ?? []).length > 0)
  if (naics.length === 0) return undefined
  const top = [...naics].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]
  // What the classification itself says — "Offices of Physical, Occupational
  // and Speech Therapists, and Audiologists" — as the Attributes panel shows
  // it. The census sector only stands in when the classification has no name.
  const code = (top.naicsCodes ?? [])[0]
  return top.name ?? SECTORS[code.slice(0, 2)] ?? undefined
}

/**
 * Six-digit NAICS titles, as the 2022 census names them — the codes the city
 * registers in `src/data/cityRegistrations.json` carry. The register gives the
 * code alone; a code not in this list is shown without a title rather than
 * guessed (477174 is not a 2022 NAICS code).
 */
const TITLES: Record<string, string> = {
  '459130': 'Sewing, Needlework, and Piece Goods Retailers',
  '513210': 'Software Publishers',
  '519190': 'All Other Information Services',
  '541511': 'Custom Computer Programming Services',
  '621210': 'Offices of Dentists'
}

/** "459130" as "459130 · Sewing, Needlework, and Piece Goods Retailers". */
export const naicsTitle = (code: string): string | undefined => TITLES[code]

