import type { BusinessRecord, Bankruptcy, Lien, Litigation, SourceRef } from './deriveResults'
import { priorNameRecords } from './cityRegistrations'
import { sameName } from './registrationStatus'
import { sourceLabel } from './sourceLabels'
import { docCard, namedCard, registrationCard } from './sourceCards'
export { kindLabel } from './sourceCards'

/**
 * Every source document on a record, one entry each.
 *
 * The Sources tab used to be built from the attribute rows: a card existed only
 * once some row cited it, and it was keyed by the source's label. So a filing
 * no address row carried had no card at all — 27 of them across 20 records —
 * and two Form 5500s, nine tax permits or ten court cases each became one card
 * per label. This lists the documents first, from the record itself; the tab
 * makes a card for each and only then files the rows under them.
 *
 * A document the API gives an id is carded by that id (`docCard`), whatever
 * its kind: a source reference's id is the lien's, the carrier record's or the
 * screening result's own id, so the reference and the document land on the same
 * card. A filing has no id of its own and keeps `registrationCard`.
 */
type Registration = BusinessRecord['registrations'][number]
type Fmcsa = NonNullable<BusinessRecord['fmcsaRegistrations']>[number]
type Licence = NonNullable<BusinessRecord['licenses']>[number]
type Document = NonNullable<BusinessRecord['documents']>[number]
type WatchlistResult = NonNullable<NonNullable<BusinessRecord['watchlist']>['lists'][number]['results']>[number]
type WatchlistList = NonNullable<BusinessRecord['watchlist']>['lists'][number]
type PepResult = NonNullable<BusinessRecord['pep']>['results'][number]
type MediaResult = NonNullable<BusinessRecord['adverseMedia']>['results'][number]

/** The dashboard's source types (`BusinessHome/Sources`), plus the prototype's own. */
export type SourceKind =
  | 'registration'
  | 'city_registration'
  | 'sales_tax_permit'
  | 'form_5500'
  | 'sam_entity_extract'
  | 'sec_filing'
  | 'epa_frs_facility'
  | 'sba_entity_v2'
  | 'npi_record'
  | 'parsed_sos_document'
  | 'historical_registration'
  | 'jurisdiction_registration'
  | 'professional_license'
  | 'lien'
  | 'litigation'
  | 'bankruptcy'
  | 'fmcsa_registration'
  | 'license'
  | 'watchlist_result'
  | 'pep_result'
  | 'adverse_media_result'
  | 'screen'
  | 'industry'
  | 'document'
  | 'website'
  | 'profiles'
  | 'tin'
  | 'other'

export type SourceDoc = {
  card: string
  kind: SourceKind
  /**
   * The name a row's `sources` calls this kind of record, through
   * `sourceLabel` and before any " · jurisdiction": "Tax permit", "Lien",
   * "Court record". A row that names the kind but carries no reference is
   * filed here only when the record holds exactly one document of it.
   */
  answers: string
  ref?: SourceRef
  registration?: Registration
  lien?: Lien
  litigation?: Litigation
  bankruptcy?: Bankruptcy
  fmcsa?: Fmcsa
  license?: Licence
  watchlist?: { list: WatchlistList; result: WatchlistResult }
  pep?: PepResult
  media?: MediaResult
  /** A city registration's own register rows (`cityRegistrations.json`). */
  city?: NonNullable<BusinessRecord['cityRegistrations']>
  /** A screen that ran and returned nothing. */
  screen?: 'watchlist' | 'pep' | 'media'
  /** The record's own documents (PDFs) filed with this source. */
  documents: Document[]
}

/** Reference types that are not documents of their own here. */
const NOT_A_DOCUMENT = new Set(['registration'])

/** A reference type, as the kind of document it stands for. */
const KIND_OF_REF: Record<string, SourceKind> = {
  city_registration: 'city_registration',
  sales_tax_permit: 'sales_tax_permit',
  form_5500: 'form_5500',
  sam_entity_extract: 'sam_entity_extract',
  sec_filing: 'sec_filing',
  'epa frs facility': 'epa_frs_facility',
  sba_entity_v2: 'sba_entity_v2',
  npi_record: 'npi_record',
  parsed_sos_document: 'parsed_sos_document',
  historical_registration: 'historical_registration',
  jurisdiction_registration: 'jurisdiction_registration',
  professional_license: 'professional_license',
  lien: 'lien',
  fmcsa_registration: 'fmcsa_registration',
  watchlist_result: 'watchlist_result',
  politically_exposed_person_result: 'pep_result',
  adverse_media_screening_result: 'adverse_media_result'
}

/** Labels a row's `sources` uses for a kind, where they are not `sourceLabel(type)`. */
const ANSWERS: Partial<Record<SourceKind, string>> = {
  litigation: 'Court record',
  bankruptcy: 'Bankruptcy court',
  pep_result: 'PEP',
  adverse_media_result: 'Adverse media',
  watchlist_result: 'Watchlist'
}

/** Every reference on the record, once each, by id. */
export const recordRefs = (record: BusinessRecord): SourceRef[] => {
  const seen = new Map<string, SourceRef>()
  for (const item of [...(record.names ?? []), ...(record.addresses ?? []), ...(record.people ?? [])])
    for (const ref of (item as { sourceRefs?: SourceRef[] }).sourceRefs ?? [])
      if (!seen.has(ref.id)) seen.set(ref.id, ref)
  return [...seen.values()]
}

/** The filing a `registration` reference points at: by state and file number
 *  where the reference states one, else by state and the name it was filed under. */
const filingOfRef = (record: BusinessRecord, ref: SourceRef) => {
  const m = (ref.metadata ?? {}) as { state?: string; file_number?: string; name?: string }
  const inState = record.registrations.filter((r) => r.state === m.state)
  // California's register prefixes a corporation's number ("C2988384"); the
  // filing carries it bare ("2988384").
  const bare = (n?: string | null) => (n ?? '').replace(/^[A-Z]+(?=\d)/i, '')
  const byNumber = m.file_number ? inState.find((r) => r.fileNumber === m.file_number || bare(r.fileNumber) === bare(m.file_number)) : undefined
  return byNumber ?? inState.find((r) => m.name && sameName(r.name, m.name)) ?? (inState.length === 1 ? inState[0] : undefined)
}

/** A filing's card, made unique where two filings share a state and number. */
const filingCards = (record: BusinessRecord) => {
  const cards = new Map<Registration, string>()
  const used = new Map<string, number>()
  for (const r of record.registrations) {
    const base = registrationCard(r)
    const n = used.get(base) ?? 0
    used.set(base, n + 1)
    cards.set(r, n === 0 ? base : `${base}#${n + 1}`)
  }
  return cards
}

export const filingCardOf = (record: BusinessRecord, r: Registration) => filingCards(record).get(r) ?? registrationCard(r)

/** Whether a screen ran: the report's own rule (`screenedOf`). */
const ran = (record: BusinessRecord, screen: 'watchlist' | 'pep' | 'media') =>
  Boolean(screen === 'watchlist' ? record.watchlist : screen === 'pep' ? record.pep : record.adverseMedia)

export const sourceDocuments = (record: BusinessRecord): SourceDoc[] => {
  const docs: SourceDoc[] = []
  const byCard = new Map<string, SourceDoc>()
  const push = (d: Omit<SourceDoc, 'documents' | 'answers'> & { answers?: string }) => {
    if (byCard.has(d.card)) return byCard.get(d.card)!
    const made: SourceDoc = { ...d, answers: d.answers ?? ANSWERS[d.kind] ?? sourceLabel(d.kind), documents: [] }
    docs.push(made)
    byCard.set(d.card, made)
    return made
  }

  // The state filings.
  const filings = filingCards(record)
  for (const r of record.registrations) push({ card: filings.get(r)!, kind: 'registration', answers: 'Registration', registration: r })

  // The records the API holds whole.
  for (const l of record.liens ?? []) push({ card: docCard(l.id), kind: 'lien', answers: 'Lien', lien: l })
  for (const c of record.litigations ?? []) push({ card: docCard(c.id), kind: 'litigation', litigation: c })
  for (const b of record.bankruptcies ?? []) push({ card: docCard(b.id), kind: 'bankruptcy', bankruptcy: b })
  for (const f of record.fmcsaRegistrations ?? [])
    push({ card: docCard(f.id), kind: 'fmcsa_registration', answers: 'FMCSA registration', fmcsa: f })
  for (const l of record.licenses ?? []) push({ card: docCard(l.id), kind: 'license', answers: l.registry, license: l })

  // The screens: a card per result, and one for a screen that came back empty.
  for (const list of record.watchlist?.lists ?? [])
    for (const result of list.results ?? []) push({ card: docCard(result.id), kind: 'watchlist_result', watchlist: { list, result } })
  for (const p of record.pep?.results ?? []) push({ card: docCard(p.id), kind: 'pep_result', pep: p })
  for (const m of record.adverseMedia?.results ?? []) push({ card: docCard(m.id), kind: 'adverse_media_result', media: m })
  const results = {
    watchlist: (record.watchlist?.lists ?? []).some((l) => (l.results ?? []).length > 0),
    pep: (record.pep?.results ?? []).length > 0,
    media: (record.adverseMedia?.results ?? []).length > 0
  }
  for (const screen of ['watchlist', 'pep', 'media'] as const)
    if (!results[screen] && ran(record, screen)) push({ card: `screen:${screen}`, kind: 'screen', answers: `screen:${screen}`, screen })

  // Every other document the record cites by reference.
  for (const ref of recordRefs(record)) {
    if (NOT_A_DOCUMENT.has(ref.type)) continue
    const card = docCard(ref.id)
    const known = byCard.get(card)
    if (known) {
      known.ref ??= ref
      continue
    }
    push({ card, kind: KIND_OF_REF[ref.type] ?? 'other', answers: sourceLabel(ref.type), ref })
  }

  // City registrations under a name the business has dropped: Sprig's Userleap
  // Inc. registration is on the Userleap record, and is Sprig's history too.
  for (const prior of priorNameRecords(record))
    for (const c of prior.cityRegistrations ?? [])
      if (c.refId && !byCard.has(docCard(c.refId)))
        push({
          card: docCard(c.refId),
          kind: 'city_registration',
          ref: { id: c.refId, type: 'city_registration', metadata: { city: c.city, state: c.state } }
        })

  // Each city registration with the register's rows behind it.
  const registers = [record, ...priorNameRecords(record)].flatMap((r) => r.cityRegistrations ?? [])
  for (const d of docs)
    if (d.kind === 'city_registration' && d.ref) {
      const rows = registers.filter((c, i, all) => c.refId === d.ref!.id && all.findIndex((x) => x.refId === c.refId && x.locationId === c.locationId) === i)
      if (rows.length > 0) d.city = rows
    }

  // Middesk's own reads of the business, one card each.
  if ((record.industry ?? []).length > 0) push({ card: namedCard('Industry classification'), kind: 'industry', answers: 'Industry classification' })
  if (record.website?.url) push({ card: namedCard('Website'), kind: 'website', answers: 'Website' })
  if ((record.profiles ?? []).length > 0) push({ card: namedCard('Third-party profiles'), kind: 'profiles', answers: 'Web presence' })
  if ((record.tin as { tin?: string } | null)?.tin) push({ card: namedCard('IRS TIN record'), kind: 'tin', answers: 'IRS TIN record' })

  // The PDFs, on the record they were filed with.
  const refs = recordRefs(record)
  for (const d of record.documents ?? []) {
    const src = d.source
    let parent: SourceDoc | undefined
    if (src?.type === 'registration') {
      const ref = refs.find((x) => x.id === src.id) ?? src
      const filing = filingOfRef(record, ref)
      parent = filing ? byCard.get(filings.get(filing)!) : undefined
    } else if (src) parent = byCard.get(docCard(src.id))
    ;(parent ?? push({ card: docCard(d.id), kind: 'document', answers: 'Document' })).documents.push(d)
  }

  return docs
}
