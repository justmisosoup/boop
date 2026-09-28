import reportStore from '../../analysis/reports.json'

import type { StoredReport } from '../types'
import { withCityRegistrations } from './cityRegistrations'
import { presented } from './deriveResults'

/**
 * The reports written for this prototype, bundled — one per business.
 *
 * `/api/analyse` is dev-server middleware: it does not exist in a `vite build`,
 * so a deployed copy cannot ask a Claude Code session for a report. It carries
 * the ones already written instead, keyed by business name because a re-pull
 * mints new business ids.
 *
 * Read by the record view and by the businesses list, which scores every row
 * off it — so the lookup lives here rather than inside either.
 */
const RAW: Record<string, StoredReport[]> =
  (reportStore as unknown as { reports?: Record<string, StoredReport[]> }).reports ?? {}

export const reportKey = (name: string) => (name ?? '').toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * The business's report, or null.
 *
 * Its snapshot carries the city registrations the live record does — see
 * withCityRegistrations — so the page it opens on can show them. The store is
 * a list per business for the endpoint's sake; the page reads the newest.
 */
export const heldReportFor = (name: string): StoredReport | null => {
  const r = (RAW[reportKey(name)] ?? []).at(-1)
  if (!r) return null
  if (!r.snapshot?.record) return r
  const record = withCityRegistrations(r.snapshot.record)
  // The snapshot's rows were derived when the report was written; what the
  // page shows of them follows today's rules.
  return { ...r, snapshot: { ...r.snapshot, record, results: presented(record, r.snapshot.results) } }
}
