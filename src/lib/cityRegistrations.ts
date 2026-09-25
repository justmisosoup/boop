import store from '../data/cityRegistrations.json'
import type { BusinessRecord } from './deriveResults'

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
export const CITY_REGISTRY_SOURCE = (store as unknown as { source: { title: string; url: string } }).source

const nameKey = (name: string) => (name ?? '').toLowerCase().replace(/\s+/g, ' ').trim()

export const withCityRegistrations = (record: BusinessRecord): BusinessRecord => {
  const found = BY_NAME[nameKey(record.name)]
  return found && !record.cityRegistrations ? { ...record, cityRegistrations: found } : record
}
