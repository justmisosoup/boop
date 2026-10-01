/**
 * Queue a standing report for businesses that have none, exactly as pressing
 * Run on the page does — the same prompt, the same manifest, the same insight
 * list and snapshot — but from the terminal, so a batch of new records can be
 * worked by the session without opening each page.
 *
 *   bun run scripts/queue-reports.ts            # every record with no held report
 *   bun run scripts/queue-reports.ts <id> <id>  # these records
 *
 * Writes analysis/request-<id>.json and analysis/snapshot-<id>.json per
 * business (what the endpoint's POST writes), and prints the ids. The session
 * then writes result-<id>.assessments/*.json and result-<id>.json, and a GET
 * to /api/analyse?id=<id> on the dev server validates and keeps the report.
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import agent from '../analysis/agent.json'
import { deriveResults, presented } from '../src/lib/deriveResults'
import { heldReportFor } from '../src/lib/heldReports'
import { composeAssessment } from '../src/lib/library'
import { ALL } from '../src/lib/records'

const DIR = join(import.meta.dir, '..', 'analysis')
const args = process.argv.slice(2)
const standing = (agent as any).skills.find((s: any) => s.kind === 'workflow')
if (!standing) throw new Error('No workflow skill in analysis/agent.json')
const composed = composeAssessment(standing, (agent as any).skills, (agent as any).disabled ?? [])

const targets = args.length > 0 ? ALL.filter((r) => args.includes(r.id)) : ALL.filter((r) => !heldReportFor(r.name))

let n = 0
for (const record of targets) {
  const results = presented(record, deriveResults(record))
  const id = `${Date.now() + n}`
  const request = {
    id,
    requestedAt: new Date().toISOString(),
    businessId: record.id,
    business: {
      name: record.name,
      entityType: record.formation?.entityType,
      state: record.formation?.state,
      formed: record.formation?.date
    },
    kind: 'report',
    prompt: composed.prompt,
    skills: [standing.name],
    assessments: composed.assessments,
    insights: results.map((r) => ({
      id: r.insightId,
      statement: r.statement,
      state: r.state,
      reason: r.reason,
      because: r.because,
      evidence: r.evidence
    })),
    attachments: [],
    history: [],
    typed: ''
  }
  writeFileSync(join(DIR, `snapshot-${id}.json`), JSON.stringify({ recordId: record.id, record, results }))
  writeFileSync(join(DIR, `request-${id}.json`), JSON.stringify(request, null, 2))
  console.log(`${id}\t${record.id}\t${record.name}\t${results.length} insights`)
  n++
}
console.log(`queued ${n} run(s)`)
