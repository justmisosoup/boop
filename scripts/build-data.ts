// Reads the catalog and fixtures and emits JSON the app imports.
// The prototype renders from the catalog — no hardcoded insight lists.
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..', '..')
const OUT = join(import.meta.dir, '..', 'src', 'data')
mkdirSync(OUT, { recursive: true })

const read = async (p: string) => Bun.YAML.parse(await Bun.file(p).text())

const insights: any = await read(join(ROOT, 'catalog', 'insights.yaml'))
const templates: any = await read(join(ROOT, 'catalog', 'templates.yaml'))

const fixtureFiles = readdirSync(join(ROOT, 'fixtures')).filter((f) => /^f\d+\.yaml$/.test(f)).sort()
const fixtures = []
for (const f of fixtureFiles) fixtures.push(await read(join(ROOT, 'fixtures', f)))

writeFileSync(join(OUT, 'catalog.json'), JSON.stringify({ insights, templates }, null, 2))
writeFileSync(join(OUT, 'fixtures.json'), JSON.stringify(fixtures, null, 2))
console.log(`data: ${insights.insights.length} insights, ${templates.templates.length} templates, ${fixtures.length} fixtures`)
