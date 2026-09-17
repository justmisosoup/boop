// Reads the catalog and fixtures and emits JSON the app imports.
// The prototype renders from the catalog — no hardcoded insight lists.
import { existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * Walk up for the directory holding `catalog/`. It sits beside the prototype,
 * and in a git worktree the prototype is nested several levels deeper, so a
 * fixed `../..` lands somewhere with no catalog in it.
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
const OUT = join(import.meta.dir, '..', 'src', 'data')
mkdirSync(OUT, { recursive: true })

const read = async (p: string) => Bun.YAML.parse(await Bun.file(p).text())

const catalog: any = await read(join(ROOT, 'catalog', 'insights.yaml'))

/**
 * Check id -> subject, flattened for the app.
 *
 * The catalog groups by subject — what a fact is about — and every check under a
 * subject belongs to it. The app groups the Insights tab by the same thing, so
 * the map is built here rather than the grouping being restated in the UI.
 */
const subjectOf: Record<string, string> = {}
/**
 * Check id + sublabel -> the outcome the product returns.
 *
 * The displayed text is the product's own message, not a sentence the prototype
 * composes. `statements.ts` used to rewrite every one of them — counting
 * registrations and asserting "matches 5 state registrations" where the check
 * had said "Match identified to the submitted Business Name". That count was a
 * reading, not a fact the API reported.
 */
const outcomeOf: Record<string, string> = {}
/** The check's own display name, so a row that returned nothing still says what it is. */
const nameOf: Record<string, string> = {}
/** Which Order package produces this check — the part the API does not return. */
const packagesOf: Record<string, string> = {}
for (const insight of catalog.insights)
  for (const check of insight.checks ?? []) {
    subjectOf[check.id] = insight.subject
    if (check.name) nameOf[check.id] = check.name
    if (check.order_packages) packagesOf[check.id] = check.order_packages
    for (const o of check.outcomes ?? [])
      if (o.outcome) outcomeOf[`${check.id}|${o.value ?? ''}`] = o.outcome
  }

const subjects = catalog.insights.map((i: any) => ({
  subject: i.subject,
  informs: i.informs ?? [],
  checks: (i.checks ?? []).map((c: any) => c.id),
  signals: i.signals ?? [],
  order_packages: i.order_packages ?? []
}))
const templates: any = await read(join(ROOT, 'catalog', 'templates.yaml'))

const fixtureFiles = readdirSync(join(ROOT, 'fixtures')).filter((f) => /^f\d+\.yaml$/.test(f)).sort()
const fixtures = []
for (const f of fixtureFiles) fixtures.push(await read(join(ROOT, 'fixtures', f)))

writeFileSync(
  join(OUT, 'catalog.json'),
  JSON.stringify({ subjects, subjectOf, outcomeOf, nameOf, packagesOf, templates }, null, 2)
)
writeFileSync(join(OUT, 'fixtures.json'), JSON.stringify(fixtures, null, 2))
console.log(
  `data: ${subjects.length} subjects, ${Object.keys(subjectOf).length} checks, ${Object.keys(outcomeOf).length} outcomes, ${templates.templates.length} templates, ${fixtures.length} fixtures`
)
