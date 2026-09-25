import reportStore from '../../analysis/reports.json'

import type { StoredReport } from '../types'
import { withCityRegistrations } from './cityRegistrations'

/**
 * The reports written for this prototype, bundled.
 *
 * `/api/analyse` is dev-server middleware: it does not exist in a `vite build`,
 * so a deployed copy cannot ask a Claude Code session for a report. It carries
 * the ones already written instead, keyed by business name because a re-pull
 * mints new business ids.
 *
 * Read by the record view, which opens on the newest, and by the businesses
 * list, which scores every row off it — so the lookup lives here rather than
 * inside either.
 */
const RAW: Record<string, StoredReport[]> =
  (reportStore as unknown as { reports?: Record<string, StoredReport[]> }).reports ?? {}

/** A report's snapshot carries the city registrations the live record does —
 *  see withCityRegistrations — so the page it opens on can show them. */
const BUNDLED: Record<string, StoredReport[]> = Object.fromEntries(
  Object.entries(RAW).map(([k, list]) => [
    k,
    list.map((r) =>
      r.snapshot?.record ? { ...r, snapshot: { ...r.snapshot, record: withCityRegistrations(r.snapshot.record) } } : r
    )
  ])
)

export const reportKey = (name: string) => (name ?? '').toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * One assessment per business, for now.
 *
 * The store holds two runs of the same assessment for every business, and the
 * page grew a list, a switcher and a diff to move between them. That has been
 * set aside: a business shows its newest assessment and nothing else. The
 * older runs stay in the store, so turning this off brings them back.
 */
const ONE_ASSESSMENT_PER_BUSINESS = true

/** Every stored report for a business, oldest first — or just the newest, see above. */
export const heldReportsFor = (name: string): StoredReport[] => {
  const all = BUNDLED[reportKey(name)] ?? []
  return ONE_ASSESSMENT_PER_BUSINESS ? all.slice(-1) : all
}

/** The one the page opens on. */
export const newestReportFor = (name: string): StoredReport | null => {
  const list = heldReportsFor(name)
  return list.length > 0 ? list[list.length - 1] : null
}
