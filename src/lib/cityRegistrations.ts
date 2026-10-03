import licenseStore from '../data/licenses.json'
import store from '../data/cityRegistrations.json'
import rawRecords from '../data/records.json'
import timeline from '../data/timeline.json'
import type { BusinessRecord } from './deriveResults'
import { sameName } from './registrationStatus'

/**
 * City registrations, merged onto the records they belong to.
 *
 * Kept out of records.json for the reason licences are: `bun run pull`
 * rewrites it wholesale, and a re-order mints a new business id — so the store
 * is keyed by business name and merged here, onto the live records and onto
 * every report's snapshot, so the page and the score read the same thing.
 */
type CityRegistration = NonNullable<BusinessRecord['cityRegistrations']>[number]

const BY_NAME = (store as unknown as { registrations: Record<string, CityRegistration[]> }).registrations

const nameKey = (name: string) => (name ?? '').toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * Only the locations that name this business, as its trade name or as their
 * owner. The register is per account, and one account can hold a company's
 * whole history: San Francisco's 1080965 is Mixboard Inc.'s, and was Mixboard,
 * then Userleap, then Sprig. Sprig's record gets its two Sprig Technologies
 * locations, Userleap's its Userleap one, Mixboard's — the owner — all four.
 */
// The registers punctuate names their own way: Los Angeles holds Change.org as
// "CHANGE.ORG.PBC", the record says "CHANGE.ORG, PBC".
const squash = (n: string | null | undefined) => (n ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
const same = (a: string | null | undefined, b: string | null | undefined) =>
  sameName(a, b) || (Boolean(squash(a)) && squash(a) === squash(b))

const namesIt = (record: BusinessRecord, r: CityRegistration) =>
  same(r.dba, record.name) ||
  same(r.owner, record.name) ||
  // A licence held under a name Middesk tied to that very registration, with no
  // trade name of its own: Washington DC's salesperson licences for Expert
  // Fence were issued to EXERT FENCE INC. A row that trades as another
  // business's name stays out — Sprig is not Userleap's DBA.
  (!r.dba &&
    (record.names ?? []).some(
      (n) => (n.sourceRefs ?? []).some((x) => x.id === r.refId) && same(n.name, r.owner)
    ))

export const withCityRegistrations = (record: BusinessRecord): BusinessRecord => {
  // A report's snapshot can already carry the whole account from before this
  // filter; it is filtered the same way.
  const found = (record.cityRegistrations ?? BY_NAME[nameKey(record.name)])?.filter((r) => namesIt(record, r))
  return found ? { ...record, cityRegistrations: found } : record
}

type NameEvent = { type: string; data: { object: { object?: string; name?: string; sources?: Array<{ type?: string }> } } }

/**
 * The business under a name it has since dropped, where another record in the
 * account carries that name. The timeline says when a filing's name changed:
 * Sprig's California filing was USERLEAP INC until October 2021. The Userleap
 * INC record holds the city registration under that name, so Sprig's Sources
 * show it too, as its own card.
 */
export const priorNameRecords = (record: BusinessRecord): BusinessRecord[] => {
  const events = ((timeline as unknown as { byBusiness: Record<string, NameEvent[]> }).byBusiness[record.id] ?? [])
  const prior = events
    .filter((e) => e.type === 'name.deleted' && (e.data.object.sources ?? []).some((x) => x.type === 'registration'))
    .map((e) => e.data.object.name)
    .filter((n): n is string => Boolean(n) && !sameName(n, record.name))
  return (rawRecords as unknown as BusinessRecord[])
    .filter((r) => r.id !== record.id && prior.some((n) => sameName(n, r.name)))
    .map(withCityRegistrations)
}

/**
 * Licences, merged onto the records they belong to — the live record and
 * every report's snapshot alike, so the card and the sentence read the same
 * thing wherever the record came from. Keyed by name for the same reason the
 * registrations are: `bun run pull` rewrites records.json and mints new ids.
 */
const LICENSES = (licenseStore as { licenses: Record<string, unknown[]> }).licenses
export const withLicenses = (r: BusinessRecord): BusinessRecord => {
  const found = LICENSES[nameKey(r.name)]
  return found ? { ...r, licenses: found as BusinessRecord['licenses'] } : r
}
