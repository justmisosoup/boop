/**
 * City registrations, from the city's own registry.
 *
 * Middesk returns a city registration only as a reference — an id, the city,
 * the state and a status — attached to the names and addresses it supplied.
 * The registration itself is not in the API. San Francisco publishes its
 * register (Registered Business Locations, DataSF g8m3-pdis): the ownership
 * name, the DBA it trades as, the business account number, and when the
 * business and each location opened and closed. That is what a reviewer
 * reads a city registration for, so this fetches it.
 *
 *   bun run scripts/pull-city-registrations.ts
 *
 * Writes src/data/cityRegistrations.json, keyed by normalised business name —
 * like licenses.json, and for the same reason: records.json is rewritten by
 * `bun run pull`, and a re-order mints a new business id. A registry row is
 * kept only when its street matches an address Middesk tied to a San
 * Francisco city registration on the same record, so a name that merely
 * starts the same ("Firebird Healing") is never attached.
 */
import { readFileSync, writeFileSync } from 'node:fs'

type Any = any // eslint-disable-line @typescript-eslint/no-explicit-any

const DATASET = 'https://data.sf.gov/resource/g8m3-pdis.json'
const PAGE = 'https://data.sf.gov/Economy-and-Community/Registered-Business-Locations-San-Francisco/g8m3-pdis'

const records: Any[] = JSON.parse(readFileSync('src/data/records.json', 'utf8'))

const key = (n: string) => n.toLowerCase().replace(/\s+/g, ' ').trim()
// House number and street name only. The registry writes the unit its own way
// ("1759 Chestnut St Apt C", "71 Stevenson St 600") where the record says
// "1759 Chestnut St # C" and "71 Stevenson St Ste 600".
const street = (a: string) =>
  (a ?? '')
    .split(',')[0]
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .join(' ')
// The registry spells "Mixboard Inc" where the record says "MIXBOARD INC.".
const base = (n: string) => n.toUpperCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim()
const quote = (s: string) => s.replace(/'/g, "''")
const day = (iso?: string | null) => (iso ? iso.slice(0, 10) : null)

const sfRefs = (x: Any) =>
  (x.sourceRefs ?? []).filter(
    (s: Any) => s.type === 'city_registration' && /san francisco/i.test(String(s.metadata?.city ?? ''))
  )

const out: Record<string, unknown[]> = {}
let asOf = ''

for (const r of records) {
  const addresses = (r.addresses ?? []).filter((a: Any) => sfRefs(a).length > 0)
  if (addresses.length === 0) continue
  const names = new Set<string>([r.name, ...(r.names ?? []).filter((n: Any) => sfRefs(n).length > 0).map((n: Any) => n.name)])

  const where = [...names]
    .map((n) => `upper(ownership_name) like '${quote(base(n))}%' OR upper(dba_name) like '${quote(base(n))}%'`)
    .join(' OR ')
  const res = await fetch(`${DATASET}?$where=${encodeURIComponent(where)}&$limit=200`)
  if (!res.ok) {
    console.error(`${r.name}: DataSF ${res.status}`)
    continue
  }
  const rows: Any[] = await res.json()

  const byStreet = new Map(addresses.map((a: Any) => [street(a.fullAddress), a]))
  const matched = rows.filter((x) => byStreet.has(street(x.full_business_address)))
  if (matched.length === 0) continue

  out[key(r.name)] = matched.map((x) => {
    const a: Any = byStreet.get(street(x.full_business_address))
    const ref = sfRefs(a)[0]
    asOf = asOf || day(x.data_as_of) || ''
    return {
      refId: ref?.id ?? null,
      registry: 'San Francisco business registration',
      city: 'San Francisco',
      state: 'CA',
      accountNumber: x.certificate_number ?? null,
      locationId: x.ttxid ?? null,
      owner: x.ownership_name ?? null,
      dba: x.dba_name ?? null,
      address: [x.full_business_address, x.city, [x.state, x.business_zip].filter(Boolean).join(' ')].filter(Boolean).join(', '),
      businessStart: day(x.dba_start_date),
      businessEnd: day(x.dba_end_date),
      locationStart: day(x.location_start_date),
      locationEnd: day(x.location_end_date),
      naics: x.self_reported_naics_code ?? null,
      dataAsOf: day(x.data_as_of),
      sourceUrl: `${DATASET}?ttxid=${encodeURIComponent(x.ttxid ?? '')}`
    }
  })
  console.log(`${r.name}: ${matched.length} registration(s)`)
}

writeFileSync(
  'src/data/cityRegistrations.json',
  JSON.stringify(
    {
      _comment:
        "City registrations from the city's own registry, keyed by normalised business name. Middesk supplies only a reference to a city registration; this is the registration itself. San Francisco only: its register is public (DataSF g8m3-pdis). Regenerate with `bun run scripts/pull-city-registrations.ts` after a pull.",
      source: { title: 'Registered Business Locations - San Francisco (DataSF)', url: PAGE },
      dataAsOf: asOf || null,
      registrations: out
    },
    null,
    2
  ) + '\n'
)
console.log(`wrote ${Object.keys(out).length} business(es) → src/data/cityRegistrations.json`)
