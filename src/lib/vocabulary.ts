/**
 * What an insight can be written about.
 *
 * The vocabulary is what the PRODUCT can supply, not what the record in front
 * of you happens to carry. `business_name_verification` in the catalog already
 * declares the sources that render a business name — 19 of them, two default
 * and seventeen opt-in — and that is the authoritative list. Deriving it from
 * `records.json` instead would silently shrink the vocabulary to the eight
 * source types these particular 25 records exhibit, so a source nobody has
 * ordered yet would look like it does not exist.
 *
 * The loaded record is still useful, as annotation: seeing which sources are
 * actually present, and how often, helps an author write an insight that will
 * return something. That is a hint, never a filter.
 *
 * Scope is Names for now: the legal business name, and DBAs / FBNs.
 */
import catalog from '../data/catalog.json'
import type { BusinessRecord } from './deriveResults'

export type NameType = 'legal' | 'dba'

export type Jurisdiction = 'DOMESTIC' | 'FOREIGN' | 'HOME' | 'EXTRA_PROVINCIAL'

export const JURISDICTION_LABEL: Record<Jurisdiction, string> = {
  DOMESTIC: 'Domestic',
  FOREIGN: 'Foreign',
  HOME: 'Home (Canada)',
  EXTRA_PROVINCIAL: 'Extra-provincial (Canada)'
}

export type NameSource = {
  /** The catalog's id. Authoritative — this is what a definition stores. */
  id: string
  label: string
  /** Ordered by default, or only on an opt-in package. */
  availability: 'default' | 'opt_in'
  /** Offered only where the source distinguishes them. */
  jurisdictions?: readonly Jurisdiction[]
  /**
   * `sourceRefs[].type` values this shows up as on a record.
   *
   * The catalog and the record do not agree on spelling — the catalog says
   * `sos_registrations` and `st_permit`, the record says `registration` and
   * `sales_tax_permit`. Encoded rather than normalised away, because both
   * vocabularies are real and each is authoritative for its own side.
   */
  recordTypes: readonly string[]
}

const LABELS: Record<string, string> = {
  sos_registrations: 'SOS registration',
  global_registrations: 'Global registration',
  dba_registration: 'DBA filing',
  city_registration: 'City registration',
  jurisdiction_registration: 'Jurisdiction registration',
  st_permit: 'State tax permit',
  tax_exempt_organization: 'Tax-exempt organisation',
  ptin_holder: 'PTIN holder',
  professional_license: 'Professional licence',
  npi_record: 'NPI record',
  fmcsa_registration: 'FMCSA registration',
  sba_entity_v2: 'SBA record',
  sam_entity_extract: 'SAM entity extract',
  sec_filing: 'SEC filing',
  form_5500: 'Form 5500',
  lien: 'Lien',
  generic_verification_source: 'Other verification source',
  website: 'Website',
  profile: 'Social profile'
}

/** Where the catalog id and the record's own spelling diverge. */
const RECORD_TYPES: Record<string, readonly string[]> = {
  sos_registrations: ['registration'],
  global_registrations: ['registration'],
  st_permit: ['sales_tax_permit']
}

const US_JURISDICTIONS: readonly Jurisdiction[] = ['DOMESTIC', 'FOREIGN']
const INTL_JURISDICTIONS: readonly Jurisdiction[] = ['HOME', 'EXTRA_PROVINCIAL']

const humanize = (id: string) =>
  LABELS[id] ?? id.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())

type CatalogInsight = {
  id: string
  sources?: { default?: string[]; opt_in?: string[] }
}

const CATALOG = (catalog as { insights: { insights: CatalogInsight[] } }).insights.insights

/**
 * The sources that carry a business name, as the catalog declares them.
 *
 * Read off `business_name_verification` rather than restated here, so adding a
 * source to that entry in `insights.yaml` widens the authoring vocabulary too.
 */
export const NAME_SOURCES: readonly NameSource[] = (() => {
  const entry = CATALOG.find((insight) => insight.id === 'business_name_verification')
  const build = (id: string, availability: NameSource['availability']): NameSource => ({
    id,
    label: humanize(id),
    availability,
    recordTypes: RECORD_TYPES[id] ?? [id],
    ...(id === 'sos_registrations'
      ? { jurisdictions: US_JURISDICTIONS }
      : id === 'global_registrations'
        ? { jurisdictions: INTL_JURISDICTIONS }
        : {})
  })

  return [
    ...(entry?.sources?.default ?? []).map((id) => build(id, 'default')),
    ...(entry?.sources?.opt_in ?? []).map((id) => build(id, 'opt_in'))
  ]
})()

export const nameSource = (id: string) => NAME_SOURCES.find((source) => source.id === id)

/**
 * How often each source actually carries a name on one record.
 *
 * Annotation only. A source with no observations here is still offerable — it
 * may simply not have been ordered for this business.
 */
export const observedNameSources = (record: BusinessRecord | undefined) => {
  /** Keyed `type` or `type:JURISDICTION`, so the two registration sources split. */
  const counts = new Map<string, number>()
  const undeclared = new Set<string>()
  if (!record) return { counts, undeclared: [] as string[] }

  const declared = new Set(NAME_SOURCES.flatMap((source) => source.recordTypes))

  for (const name of record.names ?? []) {
    for (const ref of name.sourceRefs ?? []) {
      if (!declared.has(ref.type)) undeclared.add(ref.type)
      const bump = (key: string) => counts.set(key, (counts.get(key) ?? 0) + 1)
      bump(ref.type)
      const jurisdiction = (ref.metadata as { jurisdiction?: string } | undefined)?.jurisdiction
      if (jurisdiction) bump(`${ref.type}:${jurisdiction}`)
    }
  }

  return { counts, undeclared: [...undeclared] }
}

/**
 * Observations for one catalog source.
 *
 * `sos_registrations` and `global_registrations` both appear on the record as
 * `registration`, so counting by type alone would credit each with all of
 * them. Where a source declares jurisdictions, only refs carrying one of those
 * count toward it.
 */
export const observedCount = (
  source: NameSource,
  observed: ReturnType<typeof observedNameSources>
) =>
  source.recordTypes.reduce((total, type) => {
    if (!source.jurisdictions) return total + (observed.counts.get(type) ?? 0)

    return (
      total +
      source.jurisdictions.reduce(
        (sum, jurisdiction) => sum + (observed.counts.get(`${type}:${jurisdiction}`) ?? 0),
        0
      )
    )
  }, 0)

/**
 * Signals that speak to a name but are NOT a name to compare against.
 *
 * The catalog lists `website` among the name sources, but on the record the
 * website exposes a precomputed `businessNameMatch` flag and no names array.
 * An author asking to "match the website" is asking for something real; it
 * just resolves to reading that flag rather than to a comparison. Named here
 * so the compiler can say which, instead of inventing a website name source.
 */
export const ADJACENT_NAME_SIGNALS = [
  {
    id: 'website.businessNameMatch',
    label: 'Website business-name match',
    why: 'On the record the website carries a precomputed match flag, not a name to compare against.'
  }
] as const

/** The three readings a name comparison can take. */
export const NAME_RELATIONS = [
  { id: 'exact_match', label: 'matches' },
  { id: 'similar_match', label: 'is a similar match to' },
  { id: 'no_match', label: 'does not match' }
] as const

export type NameRelation = (typeof NAME_RELATIONS)[number]['id']

export const relationLabel = (id: string) =>
  NAME_RELATIONS.find((relation) => relation.id === id)?.label ?? id
