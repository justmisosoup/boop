/**
 * What the assistant would send for each business, written to disk so the
 * starter questions can be answered offline and stored (`analysis/answers.json`).
 *
 * One file per business with a held report: `analysis/questions/<key>.json`.
 * The insights are derived from the REPORT's snapshot, not the live record —
 * a question is answered against what the report read (`RecordPage.tsx`
 * reads `view.record`), and this is the same list the page POSTs. Rows the
 * record never reported are left out: they cannot be cited.
 *
 * Read by the session, which writes `<key>.answers.json` beside each; then
 * `scripts/build-answers.ts` validates and assembles the store.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { deriveResults } from '../src/lib/deriveResults'
import { heldReportFor } from '../src/lib/heldReports'
import { ALL } from '../src/lib/records'

const OUT = join(import.meta.dir, '..', 'analysis', 'questions')
mkdirSync(OUT, { recursive: true })

/** The same key the report store uses: the name, lower-cased and collapsed. */
export const reportKey = (name: string) => name.toLowerCase().replace(/\s+/g, ' ').trim()

let n = 0
for (const live of ALL) {
  const held = heldReportFor(live.name)
  if (!held) continue
  const record = held.snapshot?.record ?? live
  const results = deriveResults(record)

  const out = {
    key: reportKey(live.name),
    business: {
      id: live.id,
      name: live.name,
      entityType: record.formation?.entityType ?? null,
      state: record.formation?.state ?? null,
      formed: record.formation?.date ?? null
    },
    report: {
      name: held.name,
      at: held.at,
      headline: held.report.headline,
      sections: held.report.sections.map((s) => ({
        id: s.id,
        body: s.body,
        gaps: s.gaps ?? []
      })),
      followUps: held.report.followUps
    },
    // Only what was reported: `unknown` rows exist so the catalog is whole,
    // and citing one promises evidence the record does not hold.
    insights: results
      .filter((r) => !r.notReported && r.state !== 'unknown')
      .map((r) => ({
        id: r.insightId,
        statement: r.statement,
        state: r.state,
        reason: r.reason,
        because: r.because,
        evidence: r.evidence
      }))
  }

  writeFileSync(join(OUT, `${out.key}.json`), JSON.stringify(out, null, 2))
  n++
}

console.log(`exported ${n} businesses to analysis/questions/`)
