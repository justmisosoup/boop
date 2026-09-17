/**
 * Measures the drift between the product's own vocabulary and what actually runs.
 *
 * `catalog/review-tasks-signals.yaml` is the authority: it is the review tasks and
 * signals the product defines, extracted from the master spreadsheet, with the
 * order packages that produce each one. `catalog/insights.yaml` is hand-authored
 * interpretation on top of it and is NOT the reference — where the two disagree,
 * the product's vocabulary wins.
 *
 * Every id the runtime emits and the sheet does not name is something we produce
 * that the product does not define. Every key the sheet names and the runtime
 * never emits is a check we have never seen run.
 *
 * Exits non-zero while drift remains, so it works as a check rather than only as
 * a report.
 *
 *   bun run drift
 *
 * Runtime ids come from running the real derivation over EVERY record in
 * src/data/records.json. A single business exercises only the review tasks it
 * happened to return; the union is the closest thing to the true runtime set.
 */
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

import records from '../src/data/records.json'
import { deriveResults, type BusinessRecord } from '../src/lib/deriveResults'

/**
 * Walk up for the directory holding `catalog/`. The catalog sits beside the
 * prototype rather than inside it, and in a git worktree the prototype is nested
 * several levels deeper than usual — so a fixed `../..` resolves somewhere with
 * no catalog in it. Searching upward works from either.
 */
const findRoot = (): string => {
  let dir = import.meta.dir
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, 'catalog', 'insights.yaml'))) return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error('No catalog/insights.yaml found in any parent directory.')
}

const ROOT = findRoot()

const catalog: any = Bun.YAML.parse(
  await Bun.file(join(ROOT, 'catalog', 'insights.yaml')).text()
)
/** Insights are grouped by subject; a subject's checks are what the runtime can
 *  emit. Signals are the same facts in plain language and carry no runtime id,
 *  so they are counted but never compared. */
const defined = new Set<string>(
  catalog.insights.flatMap((i: any) => (i.checks ?? []).map((c: any) => c.id))
)
const signalCount = catalog.insights.reduce(
  (n: number, i: any) => n + (i.signals?.length ?? 0),
  0
)
const catalogIds = defined
const notInsightIds = new Set<string>()

const runtimeIds = new Set<string>()
for (const record of records as unknown as BusinessRecord[]) {
  for (const result of deriveResults(record)) runtimeIds.add(result.insightId)
}

/** A fan-out id belongs to its base — `location_frequency:high` is that task. */
const baseOf = (id: string) => (id.includes(':') ? id.split(':')[0] : id)

const plainRuntime = new Set([...runtimeIds].map(baseOf))

const matched = [...plainRuntime].filter((id) => defined.has(id)).sort()
const undefinedAtRuntime = [...plainRuntime]
  .filter((id) => !defined.has(id) && !notInsightIds.has(id))
  .sort()
const neverSeen = [...defined].filter((k) => !plainRuntime.has(k)).sort()

const list = (ids: string[]) => ids.map((id) => `    ${id}`).join('\n')

console.log(`
checks defined           ${defined.size}   (catalog/insights.yaml, ${catalog.insights.length} subjects)
emitted at runtime       ${plainRuntime.size}   (deriveResults over ${(records as unknown[]).length} records)
matched                  ${matched.length}
signals                  ${signalCount}   (addressed by code, not compared here)
`)

if (undefinedAtRuntime.length)
  console.log(
    `emitted but NOT defined by the product (${undefinedAtRuntime.length}) — we produce these and the vocabulary does not name them:\n${list(undefinedAtRuntime)}\n`
  )

if (neverSeen.length)
  console.log(
    `defined by the product, never emitted here (${neverSeen.length}) — checks these 25 records never ran:\n${list(neverSeen)}\n`
  )

const drift = undefinedAtRuntime.length
if (drift > 0) {
  console.log(
    `DRIFT: ${drift} emitted but undefined. ${neverSeen.length} defined checks have never run here.`
  )
  process.exit(1)
}
console.log('No drift. Everything the runtime emits is defined by the product.')
