import reportStore from '../../analysis/reports.json'

import type { StoredReport } from '../types'

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
const BUNDLED: Record<string, StoredReport[]> =
  (reportStore as unknown as { reports?: Record<string, StoredReport[]> }).reports ?? {}

export const reportKey = (name: string) => (name ?? '').toLowerCase().replace(/\s+/g, ' ').trim()

/** Every stored report for a business, oldest first. */
export const heldReportsFor = (name: string): StoredReport[] => BUNDLED[reportKey(name)] ?? []

/** The one the page opens on. */
export const newestReportFor = (name: string): StoredReport | null => {
  const list = heldReportsFor(name)
  return list.length > 0 ? list[list.length - 1] : null
}
