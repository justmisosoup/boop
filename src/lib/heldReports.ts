import reportStore from '../../analysis/reports.json'
import liveRecords from '../data/records.json'

import type { StoredReport } from '../types'
import { withCityRegistrations, withLicenses } from './cityRegistrations'
import { presented, type BusinessRecord } from './deriveResults'

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
/**
 * What a snapshot written before these were pulled does not carry: each
 * filing's officers as the filing states them (copied from the SAME filing on
 * the live record, by state and file number), the business's FMCSA records and
 * documents, and who each PEP result is. Nothing inferred.
 */
const withOfficerRoles = (record: BusinessRecord): BusinessRecord => {
  const live = (liveRecords as unknown as BusinessRecord[]).find((x) => reportKey(x.name) === reportKey(record.name))
  if (!live) return record
  return {
    ...record,
    // Pulled after most reports were written, from the same business record.
    fmcsaRegistrations: record.fmcsaRegistrations ?? live.fmcsaRegistrations,
    documents: record.documents ?? live.documents,
    // Each profile's own name and page details, from the same page on the live
    // record (by URL).
    profiles: (record.profiles ?? []).map((p) =>
      p.metadata ? p : { ...p, ...((live.profiles ?? []).find((x) => x.url === p.url) ?? {}) }
    ),
    // Who each PEP result is — born, citizenship, roles — pulled after the
    // reports were written, from the same result on the live record (by id).
    pep: record.pep
      ? {
          ...record.pep,
          results: record.pep.results.map((r) => ({
            ...((live.pep?.results ?? []).find((x) => x.id === r.id) ?? {}),
            ...r,
            url: r.url ?? (live.pep?.results ?? []).find((x) => x.id === r.id)?.url ?? null
          }))
        }
      : record.pep,
    // The connections with each shared person's titles, pulled after the
    // reports were written. A snapshot's own list named people as strings.
    connections: (live.connections ?? record.connections)?.map((c) => ({
      ...c,
      people: (c.people ?? []).map((p) => (typeof p === 'string' ? { name: p as string } : p)),
      businesses: (c.businesses ?? []).map((b) => (typeof b === 'string' ? { name: b as string } : b))
    })),
    registrations: record.registrations.map((r) => {
      if (r.officerRoles) return r
      const same = live.registrations.find((x) => x.state === r.state && x.fileNumber === r.fileNumber)
      return same?.officerRoles ? { ...r, officerRoles: same.officerRoles } : r
    })
  }
}

export const heldReportFor = (name: string): StoredReport | null => {
  const r = (RAW[reportKey(name)] ?? []).at(-1)
  if (!r) return null
  if (!r.snapshot?.record) return r
  const record = withOfficerRoles(withLicenses(withCityRegistrations(r.snapshot.record)))
  // The snapshot's rows were derived when the report was written; what the
  // page shows of them follows today's rules.
  return { ...r, snapshot: { ...r.snapshot, record, results: presented(record, r.snapshot.results) } }
}
