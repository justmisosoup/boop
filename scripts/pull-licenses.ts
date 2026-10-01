/**
 * Professional licences, from the registry that publishes them.
 *
 * No check in the catalog reaches a licence, and a business whose industry
 * is a licensed profession is only as real as the licence behind it. The NPI
 * Registry (CMS) is the public register for healthcare providers — every
 * practitioner's NPI, credential, taxonomy and the state licence number the
 * taxonomy was certified under. That is what a reviewer reads a licence for,
 * so this fetches it.
 *
 *   bun run scripts/pull-licenses.ts
 *
 * Writes src/data/licenses.json, keyed by normalised business name — like
 * cityRegistrations.json, and for the same reason: records.json is rewritten
 * by `bun run pull`, and a re-order mints a new business id. Only records
 * whose lead NAICS is a health-practitioner office (621) are looked up, only
 * the people the customer SUBMITTED are searched, and a result is kept only
 * when the registry's practice address is the submitted office (street and
 * ZIP5), so a namesake elsewhere is never attached.
 */
import { readFileSync, writeFileSync } from 'node:fs'

type Any = any // eslint-disable-line @typescript-eslint/no-explicit-any

const API = 'https://npiregistry.cms.hhs.gov/api/?version=2.1'
const VIEW = 'https://npiregistry.cms.hhs.gov/provider-view/'

const records: Any[] = JSON.parse(readFileSync('src/data/records.json', 'utf8'))

const key = (n: string) => n.toLowerCase().replace(/\s+/g, ' ').trim()
const words = (s: string) => s.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)
/** The street line and the ZIP5; a floor or suite is the same address. */
const place = (s: string) => {
  const w = words(s.split(',')[0] ?? '')
  const street: string[] = []
  for (let i = 0; i < w.length; i++) {
    if (/^(FL|FLOOR|STE|SUITE|APT|UNIT|RM|ROOM|NO|#)$/.test(w[i])) {
      i++
      continue
    }
    street.push(w[i])
  }
  return { street: street.join(' '), zip: (s.match(/\b(\d{5})(?:-?\d{4})?\b/) ?? [])[1] }
}
const ENTITY = /\b(LLC|L\.L\.C|PLLC|INC|CORP|CORPORATION|COMPANY|CO\.|LTD|LP|LLP|TRUST|HOLDINGS)\b/i

/** The record's highest-scored NAICS classification. */
const leadNaics = (r: Any): string | undefined =>
  (r.industry ?? [])
    .filter((c: Any) => (c.naicsCodes ?? []).length > 0)
    .sort((a: Any, b: Any) => (b.score ?? 0) - (a.score ?? 0))[0]?.naicsCodes?.[0]

const day = (s?: string | null) => (s ? s.slice(0, 10) : null)
const cap = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())

const out: Record<string, unknown[]> = {}

for (const r of records) {
  if (!(leadNaics(r) ?? '').startsWith('621')) continue
  const offices = (r.addresses ?? []).filter((a: Any) => a.submitted && !a.isRegisteredAgent && a.state)
  const people = (r.people ?? []).filter((p: Any) => p.submitted && p.name && !ENTITY.test(p.name))
  const found: unknown[] = []

  for (const p of people) {
    const parts = words(p.name)
    if (parts.length < 2) continue
    const last = parts.at(-1) as string
    const first = parts.slice(0, -1).join(' ')
    for (const state of [...new Set(offices.map((a: Any) => a.state as string))]) {
      const q = new URLSearchParams({ first_name: first, last_name: last, state, limit: '10' })
      const res = await fetch(`${API}&${q}`)
      if (!res.ok) {
        console.error(`${r.name}: NPI ${res.status}`)
        continue
      }
      const data: Any = await res.json()
      for (const x of data.results ?? []) {
        const loc = (x.addresses ?? []).find((a: Any) => a.address_purpose === 'LOCATION') ?? x.addresses?.[0]
        if (!loc) continue
        const line = `${loc.address_1}${loc.address_2 ? ` ${loc.address_2}` : ''}, ${cap(loc.city)}, ${loc.state} ${loc.postal_code}`
        const lic = place(line)
        const office = offices.find((a: Any) => {
          const sub = place(a.fullAddress)
          return sub.street && sub.street === lic.street && sub.zip && sub.zip === lic.zip
        })
        if (!office) continue
        const tax = (x.taxonomies ?? []).find((t: Any) => t.primary) ?? x.taxonomies?.[0]
        const b = x.basic ?? {}
        const zip = String(loc.postal_code ?? '')
        found.push({
          id: `npi-${x.number}`,
          registry: 'NPI Registry',
          number: String(x.number),
          holder: [b.first_name, b.middle_name, b.last_name].filter(Boolean).join(' '),
          credential: b.credential ?? null,
          profession: tax?.desc ?? null,
          taxonomyCode: tax?.code ?? null,
          licenseState: tax?.state ?? null,
          licenseNumber: tax?.license ?? null,
          status: b.status === 'A' ? 'Active' : (b.status ?? 'Unknown'),
          enumeratedAt: day(b.enumeration_date),
          lastUpdated: day(b.last_updated),
          address: `${cap(loc.address_1)}, ${cap(loc.city)}, ${loc.state} ${zip.length === 9 ? `${zip.slice(0, 5)}-${zip.slice(5)}` : zip}`,
          phone: loc.telephone_number ?? null,
          sourceUrl: `${VIEW}${x.number}`
        })
      }
    }
  }
  if (found.length > 0) {
    out[key(r.name)] = found
    console.log(`${r.name}: ${found.length} licence(s)`)
  } else console.log(`${r.name}: none found`)
}

writeFileSync(
  'src/data/licenses.json',
  JSON.stringify(
    {
      _comment:
        'Professional licences from the NPI Registry (CMS), keyed by normalised business name. Kept out of records.json because `bun run pull` rewrites it, and keyed by name because a re-order mints a new business id. Only businesses whose lead NAICS is a health-practitioner office (621) are looked up, only submitted people are searched, and a record is kept only when its practice address is the submitted office. Regenerate with `bun run scripts/pull-licenses.ts`.',
      source: { title: 'NPI Registry (CMS National Plan and Provider Enumeration System)', url: 'https://npiregistry.cms.hhs.gov/' },
      pulledAt: new Date().toISOString().slice(0, 10),
      licenses: out
    },
    null,
    2
  ) + '\n'
)
console.log(`wrote ${Object.keys(out).length} business(es) → src/data/licenses.json`)
