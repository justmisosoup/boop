import rawRecords from '../data/records.json'
import licenseStore from '../data/licenses.json'
import { deriveResults, trueEntityType, type BusinessRecord } from './deriveResults'

/**
 * The records the prototype runs on, and the few things both the list and the
 * record view need to say about them.
 *
 * This lived at the top of `App.tsx` when there was one screen. Now that
 * `/businesses` and `/businesses/:id` both read it, it sits here so the list
 * and the record it opens are looking at the same 25 rows.
 */

/**
 * Licences, merged onto the records they belong to.
 *
 * `records.json` is rewritten wholesale by `bun run pull`, so anything found
 * by hand and written there is lost on the next pull. The store is keyed by
 * business NAME rather than id, because re-ordering the same company mints a
 * new business id every time and an id-keyed store would come back empty for
 * the business it was written for.
 */
const LICENSES = (licenseStore as { licenses: Record<string, unknown[]> }).licenses
const licenseKey = (name: string) => name.toLowerCase().replace(/\s+/g, ' ').trim()

/** Every ingested record. Nothing is synthesised — this is what `pull` wrote. */
export const ALL: BusinessRecord[] = (rawRecords as BusinessRecord[]).map((r) => {
  const found = LICENSES[licenseKey(r.name)]
  return found ? { ...r, licenses: found as BusinessRecord['licenses'] } : r
})

const BY_ID = new Map(ALL.map((r) => [r.id, r]))

export const byId = (id?: string) => (id ? BY_ID.get(id) : undefined)

// The form the filings carry, not the provider's bucket — see trueEntityType.
export const describe = (r: BusinessRecord) =>
  r.formation
    ? `${trueEntityType(r) ?? r.formation.entityType} · ${r.formation.state} · formed ${r.formation.date}`
    : 'No formation record'

/**
 * How many insights a record actually reported.
 *
 * The same number the record view's Insights tab shows — derived the same way,
 * so the list and the tab can't disagree. Deriving runs the whole catalog, so
 * results are held per record: the list asks for all 25 at once.
 */
const INSIGHT_COUNTS = new Map<string, number>()

export const insightCountOf = (r: BusinessRecord) => {
  const cached = INSIGHT_COUNTS.get(r.id)
  if (cached !== undefined) return cached
  const count = deriveResults(r).filter((x) => !x.notReported).length
  INSIGHT_COUNTS.set(r.id, count)
  return count
}
