/**
 * `analysis/reports.json` v1 → v2, run once by hand.
 *
 * v1 kept one report per business, as a bare object, with no record of when it
 * was written or what it was reading. v2 keeps a list, and every report carries
 * the record and the insight list it saw — so an earlier report still opens
 * against its own data rather than against whatever the last `bun run pull`
 * fetched.
 *
 * The snapshot for a report written before snapshots existed has to be
 * reconstructed, and the only honest reconstruction is today's record: it is
 * the one that report was written from, unless a pull has moved under it since.
 * `at` is the one invented value — the store has no timestamp anywhere — and
 * comes from the file's own modification time.
 *
 *   bun run scripts/migrate-reports.ts
 */
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { deriveResults } from '../src/lib/deriveResults'
import { ALL } from '../src/lib/records'
import type { StoredReport } from '../src/types'

const REPORTS = join(import.meta.dir ?? process.cwd(), '..', 'analysis', 'reports.json')

const key = (name: string) => name.toLowerCase().replace(/\s+/g, ' ').trim()

const STORE_COMMENT =
  'Every report a business has, oldest first, keyed by name. A report carries what it concluded and what it was reading, so an earlier one still opens against what it saw. Written when a run completes.'

const store = JSON.parse(readFileSync(REPORTS, 'utf8')) as {
  version?: number
  reports?: Record<string, unknown>
}

if (store.version === 2) {
  console.log('Already v2 — nothing to do.')
  process.exit(0)
}

const at = statSync(REPORTS).mtime.toISOString()
const out: Record<string, StoredReport[]> = {}

for (const [name, value] of Object.entries(store.reports ?? {})) {
  const held = value as {
    brief?: string
    policy?: StoredReport['policy']
    report: StoredReport['report']
  }
  const record = ALL.find((r) => key(r.name) === name)
  if (!record) console.warn(`No record for "${name}" — kept without a snapshot.`)

  out[name] = [
    {
      id: `held:${name}`,
      at,
      brief: held.brief ?? '',
      policy: held.policy ?? [],
      report: held.report,
      snapshot: record
        ? { recordId: record.id, record, results: deriveResults(record) }
        : null,
      questions: []
    }
  ]
  console.log(
    `${name}: ${record ? `${deriveResults(record).length} insights snapshotted` : 'no snapshot'}`
  )
}

writeFileSync(REPORTS, JSON.stringify({ _comment: STORE_COMMENT, version: 2, reports: out }))
console.log(`Wrote ${REPORTS} at version 2, dated ${at}.`)
