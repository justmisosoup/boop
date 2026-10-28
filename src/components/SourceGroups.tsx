import type { ReactNode } from 'react'
import { AtSign, ClipboardList, FileText, FolderOpen, Gavel, Globe, Landmark, Receipt, ScrollText } from 'lucide-react'

import { SUBMITTED_CARD } from '../lib/sourceCards'
import { appTypeOf, type Source } from './SourcesTab'

/**
 * The kinds of source a business's record comes from, each its own place in
 * the side panel's rail: the filings with the states, the licences and
 * permits, the court and lien records, the web, and the rest. Only the kinds
 * a business has are drawn. Screening results, the industry classification,
 * related businesses and USPS are not sources of the record — checks run
 * against it, readings of it, or matches found from it — so they are none of
 * these.
 */
export type SourceGroup = { id: string; label: string; icon: ReactNode; types: ReadonlyArray<string> }

const icon = (Icon: typeof Landmark) => <Icon aria-hidden="true" size={16} strokeWidth={1.5} />

/** What the customer submitted: the first of the business's sources. */
const SUBMITTED_GROUP: SourceGroup = { id: 'submitted', label: 'Submitted', icon: icon(ClipboardList), types: [] }

export const SOURCE_GROUPS: ReadonlyArray<SourceGroup> = [
  SUBMITTED_GROUP,
  {
    id: 'registrations',
    label: 'Registrations',
    icon: icon(Landmark),
    types: ['registration', 'parsed_sos_document', 'historical_registration', 'jurisdiction_registration', 'city_registration']
  },
  {
    id: 'licenses',
    label: 'Licenses & permits',
    icon: icon(ScrollText),
    types: ['fmcsa_registration', 'professional_license', 'license', 'sales_tax_permit', 'npi_record', 'sam_entity_extract', 'sba_entity_v2', 'epa_frs_facility']
  },
  { id: 'court', label: 'Liens, court & bankruptcy', icon: icon(Gavel), types: ['lien', 'litigation', 'bankruptcy'] },
  // The business's own site, then each third-party profile as a source of its own.
  { id: 'website', label: 'Website', icon: icon(Globe), types: ['website'] },
  { id: 'web', label: 'Web & profiles', icon: icon(AtSign), types: ['profiles'] },
  // The IRS's own records: the TIN match, and the benefit-plan returns filed with it.
  { id: 'irs', label: 'IRS', icon: icon(Receipt), types: ['tin', 'form_5500'] },
  { id: 'documents', label: 'Documents', icon: icon(FileText), types: ['document'] }
]

/** Everything no other kind takes: the prototype's own sources. */
export const OTHER_GROUP: SourceGroup = { id: 'other', label: 'Other', icon: icon(FolderOpen), types: [] }

/** Screening results and the industry classification: checks run against the
 *  record, or a reading of it, not sources of it. */
const SCREENING = ['watchlist_result', 'pep_result', 'adverse_media_result', 'screen', 'industry']
/** Not sources either: the businesses it is connected to, found by matching,
 *  and USPS, which checks an address rather than recording the business. */
const NOT_SOURCES = ['Related businesses', 'USPS']

/** The kind a source is, by its type; what no kind names is Other's. A
 *  screening result is no kind. */
export const sourceGroupOf = (s: Source): SourceGroup | undefined => {
  if (s.id === SUBMITTED_CARD) return SUBMITTED_GROUP
  const type = appTypeOf(s)
  if (SCREENING.includes(type) || NOT_SOURCES.includes((s.kind ?? s.label).split(' · ')[0])) return undefined
  return SOURCE_GROUPS.find((g) => g.types.includes(type)) ?? OTHER_GROUP
}

/** The kinds a business has sources of, in the rail's order. */
export const sourceGroupsIn = (sources: Source[]): SourceGroup[] => {
  const present = new Set(sources.map((s) => sourceGroupOf(s)?.id))
  return [...SOURCE_GROUPS, OTHER_GROUP].filter((g) => present.has(g.id))
}
