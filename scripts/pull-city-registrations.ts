/**
 * City registrations, from the cities' own registries.
 *
 * Middesk returns a city registration only as a reference — an id, the city,
 * the state, a status and sometimes a licence type — attached to the names and
 * addresses it supplied. The registration itself is not in the API. Each city
 * below publishes its register: the name the account is held under, the name it
 * trades as, the account number, and when the business and each location opened
 * and closed. That is what a reviewer reads a city registration for, so this
 * fetches it.
 *
 *   San Francisco  Registered Business Locations (DataSF g8m3-pdis)
 *   Los Angeles    Listing of All Businesses (data.lacity.org r4uk-afju)
 *   Seattle        Active Business License Tax Certificate (data.seattle.gov wnbq-64tb)
 *   Washington DC  Basic Business Licenses (DC GIS, DCRA FeatureServer 0)
 *
 *   bun run scripts/pull-city-registrations.ts
 *
 * Writes src/data/cityRegistrations.json, keyed by normalised business name —
 * like licenses.json, and for the same reason: records.json is rewritten by
 * `bun run pull`, and a re-order mints a new business id. A registry row is
 * kept only when its street — where the business is, or where the city sends
 * its mail — matches an address Middesk tied to that city's registration on the
 * same record, so a name that merely starts the same ("Firebird Healing") is
 * never attached.
 */
import { writeFileSync, readFileSync } from 'node:fs'

type Any = any // eslint-disable-line @typescript-eslint/no-explicit-any

type Row = {
  owner: string | null
  dba: string | null
  /** Where the business is. */
  address: string
  /** Where the city sends its mail, when it says. */
  mailing: string | null
  accountNumber: string | null
  locationId: string | null
  businessStart: string | null
  businessEnd: string | null
  locationStart: string | null
  locationEnd: string | null
  naics: string | null
  licenseType: string | null
  activity: string | null
  open: boolean
  dataAsOf: string | null
  sourceUrl: string
}

type Registry = {
  city: string
  state: string
  registry: string
  title: string
  page: string
  /** Every row whose owner or trade name starts with one of these patterns. */
  search: (patterns: string[]) => Promise<Row[]>
}

const records: Any[] = JSON.parse(readFileSync('src/data/records.json', 'utf8'))

const key = (n: string) => n.toLowerCase().replace(/\s+/g, ' ').trim()
const day = (v?: string | number | null) =>
  v == null || v === '' ? null : typeof v === 'number' ? new Date(v).toISOString().slice(0, 10) : String(v).slice(0, 10)
const ymd = (v?: string | null) => (v && /^\d{8}$/.test(v) ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6)}` : day(v))
const quote = (s: string) => s.replace(/'/g, "''")
const join = (...parts: Array<string | null | undefined>) => parts.filter(Boolean).join(', ')

// "SUPABASE, INC." → SUPABASE%INC: the registries punctuate names their own
// way ("Supabase, Inc.", "CHANGE.ORG.PBC"), so the words are matched in order
// and anything may sit between them.
const pattern = (n: string) => n.toUpperCase().split(/[^A-Z0-9&]+/).filter(Boolean).join('%')

// House number and the first street word that is not a direction. The
// registries write the unit and the direction their own way ("1565 W 228TH
// STREET", "71 Stevenson St 600") where the record says "1565 W 228th St" and
// "71 Stevenson St Ste 600".
const DIRECTION = /^(n|s|e|w|ne|nw|se|sw|north|south|east|west)$/
const street = (a?: string | null) => {
  const words = (a ?? '').split(',')[0].toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)
  const name = words.slice(1).find((w) => !DIRECTION.test(w))
  return words[0] && name ? `${words[0]} ${name}` : ''
}

const socrata = async (url: string, where: string): Promise<Any[]> => {
  const res = await fetch(`${url}?$where=${encodeURIComponent(where)}&$limit=500`)
  if (!res.ok) throw new Error(`${url}: ${res.status}`)
  return res.json()
}
const likeAny = (fields: string[], patterns: string[]) =>
  patterns.flatMap((p) => fields.map((f) => `upper(${f}) like '${quote(p)}%'`)).join(' OR ')

const SF = 'https://data.sf.gov/resource/g8m3-pdis.json'
const LA = 'https://data.lacity.org/resource/r4uk-afju.json'
const SEA = 'https://data.seattle.gov/resource/wnbq-64tb.json'
const DC = 'https://maps2.dcgis.dc.gov/dcgis/rest/services/FEEDS/DCRA/FeatureServer/0/query'

const REGISTRIES: Registry[] = [
  {
    city: 'San Francisco',
    state: 'CA',
    registry: 'San Francisco business registration',
    title: 'Registered Business Locations - San Francisco (DataSF)',
    page: 'https://data.sf.gov/Economy-and-Community/Registered-Business-Locations-San-Francisco/g8m3-pdis',
    search: async (patterns) =>
      (await socrata(SF, likeAny(['ownership_name', 'dba_name'], patterns))).map((x) => ({
        owner: x.ownership_name ?? null,
        dba: x.dba_name ?? null,
        address: join(x.full_business_address, x.city, [x.state, x.business_zip].filter(Boolean).join(' ')),
        mailing: x.mailing_address_1 ? join(x.mailing_address_1, x.mail_city) : null,
        accountNumber: x.certificate_number ?? null,
        locationId: x.ttxid ?? null,
        businessStart: day(x.dba_start_date),
        businessEnd: day(x.dba_end_date),
        locationStart: day(x.location_start_date),
        locationEnd: day(x.location_end_date),
        naics: x.self_reported_naics_code ?? null,
        licenseType: null,
        activity: null,
        open: !x.dba_end_date && !x.location_end_date,
        dataAsOf: day(x.data_as_of),
        sourceUrl: `${SF}?ttxid=${encodeURIComponent(x.ttxid ?? '')}`
      }))
  },
  {
    city: 'Los Angeles',
    state: 'CA',
    registry: 'Los Angeles business tax registration',
    title: 'Listing of All Businesses - Los Angeles (data.lacity.org)',
    page: 'https://data.lacity.org/Administration-Finance/Listing-of-All-Businesses/r4uk-afju',
    search: async (patterns) =>
      (await socrata(LA, likeAny(['business_name', 'dba_name'], patterns))).map((x) => ({
        owner: x.business_name ?? null,
        dba: x.dba_name ?? null,
        address: join(x.street_address?.replace(/\s+/g, ' '), x.city, ['CA', x.zip_code].filter(Boolean).join(' ')),
        // The register puts a person's name in the mailing address when the
        // mail goes to them; only a street is an address.
        mailing: /^\d/.test(x.mailing_address ?? '') ? join(x.mailing_address, x.mailing_city) : null,
        // The location account is the business account plus the location:
        // 0000492465-0001-0 is account 0000492465, location 0001.
        accountNumber: x.location_account?.split('-')[0] ?? null,
        locationId: x.location_account ?? null,
        businessStart: null,
        businessEnd: null,
        locationStart: day(x.location_start_date),
        locationEnd: day(x.location_end_date),
        naics: x.naics ?? null,
        licenseType: null,
        activity: null,
        open: !x.location_end_date,
        dataAsOf: null,
        sourceUrl: `${LA}?location_account=${encodeURIComponent(x.location_account ?? '')}`
      }))
  },
  {
    city: 'Seattle',
    state: 'WA',
    registry: 'Seattle business license',
    title: 'Active Business License Tax Certificate - Seattle (data.seattle.gov)',
    page: 'https://data.seattle.gov/City-Business/Active-Business-License-Tax-Certificate/wnbq-64tb',
    search: async (patterns) =>
      (await socrata(SEA, likeAny(['business_legal_name', 'trade_name'], patterns))).map((x) => ({
        owner: x.business_legal_name ?? null,
        dba: x.trade_name ?? null,
        address: join(x.street_address, x.city, [x.state, x.zip].filter(Boolean).join(' ')),
        mailing: null,
        accountNumber: x.city_account_number ?? null,
        locationId: x.ubi ?? null,
        businessStart: ymd(x.license_start_date),
        businessEnd: null,
        locationStart: null,
        locationEnd: null,
        naics: x.naics_code ?? null,
        licenseType: null,
        activity: x.naics_description ?? null,
        // The register lists active certificates only.
        open: true,
        dataAsOf: null,
        sourceUrl: `${SEA}?city_account_number=${encodeURIComponent(x.city_account_number ?? '')}`
      }))
  },
  {
    city: 'Washington',
    state: 'DC',
    registry: 'District of Columbia basic business license',
    title: 'Basic Business Licenses - District of Columbia (DC GIS)',
    page: 'https://opendata.dc.gov/datasets/basic-business-licenses',
    search: async (patterns) => {
      const where = patterns
        .flatMap((p) => ['ENTITYNAME', 'ENTITYTRADENAME'].map((f) => `upper(${f}) like '${quote(p)}%'`))
        .join(' OR ')
      const params = new URLSearchParams({ where, outFields: '*', returnGeometry: 'false', f: 'json' })
      const res = await fetch(`${DC}?${params}`)
      if (!res.ok) throw new Error(`DC GIS: ${res.status}`)
      const body: Any = await res.json()
      if (body.error) throw new Error(`DC GIS: ${JSON.stringify(body.error)}`)
      return (body.features ?? []).map(({ attributes: x }: Any) => {
        const open = /^active$/i.test(x.LICENSESTATUS ?? '')
        return {
          owner: x.ENTITYNAME ?? null,
          dba: x.ENTITYTRADENAME ?? null,
          address: (x.PREMISEADDRESS ?? '').replace(/\s+/g, ' ').replace(/ ,/g, ',').replace(/, USA$/, ''),
          mailing: x.BILLINGADDRESS ? x.BILLINGADDRESS.replace(/\s+/g, ' ').replace(/, USA$/, '') : null,
          accountNumber: x.CUSTOMERNUMBER ?? null,
          locationId: null,
          businessStart: day(x.INITIALISSUEDATE),
          businessEnd: open ? null : day(x.LICENSEENDDATE),
          locationStart: day(x.LICENSESTARTDATE),
          // A licence that is still active has an end date too — when the
          // current term runs out — and that is not a closing.
          locationEnd: open ? null : day(x.LICENSEENDDATE),
          naics: null,
          licenseType: x.CATEGORYSERVICETYPE ?? null,
          activity: x.BUSINESSACTIVITY ?? null,
          open,
          dataAsOf: day(x.DATAREFRESHEDON),
          sourceUrl: `${DC}?where=${encodeURIComponent(`CUSTOMERNUMBER='${x.CUSTOMERNUMBER}'`)}&outFields=*&f=json`
        }
      })
    }
  }
]

const refsOf = (x: Any, reg: Registry) =>
  (x.sourceRefs ?? []).filter(
    (s: Any) =>
      s.type === 'city_registration' &&
      String(s.metadata?.city ?? '').toLowerCase() === reg.city.toLowerCase() &&
      String(s.metadata?.state ?? '').toUpperCase() === reg.state
  )

const squash = (n?: string | null) => (n ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')

const out: Record<string, unknown[]> = {}
const asOf: Record<string, string> = {}

for (const r of records) {
  for (const reg of REGISTRIES) {
    const addresses = (r.addresses ?? []).filter((a: Any) => refsOf(a, reg).length > 0)
    if (addresses.length === 0) continue
    const named = (r.names ?? []).filter((n: Any) => refsOf(n, reg).length > 0)
    const names = [...new Set<string>([r.name, ...named.map((n: Any) => n.name)])]

    let rows: Row[]
    try {
      rows = await reg.search(names.map(pattern).filter(Boolean))
    } catch (e) {
      console.error(`${r.name} · ${reg.city}: ${(e as Error).message}`)
      continue
    }

    const streets = new Map<string, Any>(addresses.map((a: Any) => [street(a.fullAddress), a]))
    const matched = rows.filter((x) => streets.has(street(x.address)) || streets.has(street(x.mailing)))
    if (matched.length === 0) {
      console.log(`${r.name} · ${reg.city}: none matched (${rows.length} by name)`)
      continue
    }

    // The Middesk reference this row stands behind: one on the matched address,
    // preferring the one whose name, standing and licence type agree with it.
    const pick = (x: Row) => {
      const a = streets.get(street(x.address)) ?? streets.get(street(x.mailing))
      const refs: Any[] = refsOf(a, reg)
      const nameOf = (id: string) => named.find((n: Any) => n.sourceRefs.some((s: Any) => s.id === id))?.name
      const score = (s: Any) =>
        (squash(nameOf(s.id)) && [x.owner, x.dba].some((n) => squash(n) === squash(nameOf(s.id))) ? 4 : 0) +
        (/^active$/i.test(s.metadata?.status ?? '') === x.open ? 2 : 0) +
        (x.licenseType && s.metadata?.license_type === x.licenseType ? 1 : 0)
      return [...refs].sort((p, q) => score(q) - score(p))[0]
    }

    const list = (out[key(r.name)] ??= [])
    for (const x of matched) {
      if (x.dataAsOf) asOf[reg.city] ??= x.dataAsOf
      list.push({
        refId: pick(x)?.id ?? null,
        registry: reg.registry,
        city: reg.city,
        state: reg.state,
        accountNumber: x.accountNumber,
        locationId: x.locationId,
        owner: x.owner,
        dba: x.dba,
        address: x.address,
        businessStart: x.businessStart,
        businessEnd: x.businessEnd,
        locationStart: x.locationStart,
        locationEnd: x.locationEnd,
        naics: x.naics,
        ...(x.licenseType ? { licenseType: x.licenseType } : {}),
        ...(x.activity ? { activity: x.activity } : {}),
        dataAsOf: x.dataAsOf,
        sourceUrl: x.sourceUrl
      })
    }
    console.log(`${r.name} · ${reg.city}: ${matched.length} registration(s)`)
  }
}

writeFileSync(
  'src/data/cityRegistrations.json',
  JSON.stringify(
    {
      _comment:
        "City registrations from the cities' own registries, keyed by normalised business name. Middesk supplies only a reference to a city registration; this is the registration itself. San Francisco, Los Angeles, Seattle and Washington DC publish their registers. Regenerate with `bun run scripts/pull-city-registrations.ts` after a pull.",
      sources: Object.fromEntries(
        REGISTRIES.map((g) => [g.city, { title: g.title, url: g.page, dataAsOf: asOf[g.city] ?? null }])
      ),
      registrations: out
    },
    null,
    2
  ) + '\n'
)
console.log(`wrote ${Object.keys(out).length} business(es) → src/data/cityRegistrations.json`)
