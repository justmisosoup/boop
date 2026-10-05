/**
 * The Sources and report audit, over every business the prototype holds.
 *
 *   bun run scripts/audit-sources.ts            a table per business, failures listed
 *   bun run scripts/audit-sources.ts --quiet    failures only
 *
 * Reads exactly what the record page reads: the business's newest report's
 * snapshot where it has one, else the live record, each with its licences and
 * city registrations merged (`ALL`, `heldReportFor`). Four checks:
 *
 * 1. Documents → cards. Every source document on the record (`sourceDocuments`)
 *    has its own card in Sources, and no card stands for two documents.
 * 2. Data coverage. Every filing, lien, case, petition, carrier record, licence,
 *    screening result and attached document is on a card.
 * 3. Chips. Every source a report row cites resolves to a card by exact id —
 *    no falling back to the first card of a type.
 * 4. Insights → report. Every insight the record returned lands on a card the
 *    report draws. Signals, and the composites, threshold and retired checks
 *    `deriveResults` filters out, are not insights here.
 *
 * Exits non-zero on any failure.
 */
import { plugin } from 'bun'

// The page's components import SVGs through Vite's svgr and stylesheets
// through Vite; neither means anything outside the browser, and nothing
// audited here draws. Stubbed before anything that imports them loads.
plugin({
  name: 'audit-stubs',
  setup(build) {
    build.onLoad({ filter: /\.svg$/ }, () => ({ contents: 'export const ReactComponent = () => null; export default ""', loader: 'js' }))
    build.onLoad({ filter: /\.css$/ }, () => ({ contents: 'export default {}', loader: 'js' }))
  }
})

const { ALL } = await import('../src/lib/records')
const { heldReportFor } = await import('../src/lib/heldReports')
const { deriveResults } = await import('../src/lib/deriveResults')
const { makeGroupFor } = await import('../src/lib/groups')
const { REPORT_CARDS, cardFor } = await import('../src/lib/reportCards')
const { sourcesFor } = await import('../src/components/SourcesTab')
const { attributeRowsByGroup } = await import('../src/components/AttributesTab')
const { sourceDocuments } = await import('../src/lib/sourceInventory')
const { SINGLETON_CARDS: SINGLETONS, sourceChipCards } = await import('../src/lib/sourceCards')
type BusinessRecord = import('../src/lib/deriveResults').BusinessRecord
type Derived = import('../src/lib/deriveResults').Derived

const quiet = process.argv.includes('--quiet')

type Finding = { business: string; check: string; detail: string }
const findings: Finding[] = []
const table: Array<Record<string, string | number>> = []

for (const live of ALL) {
  const held = heldReportFor(live.name)
  const record: BusinessRecord = held?.snapshot?.record ?? live
  const results: Derived[] = held?.snapshot?.results ?? deriveResults(live)
  const groupFor = makeGroupFor(new Map())
  const fail = (check: string, detail: string) => findings.push({ business: live.name, check, detail })

  const sources = sourcesFor(record, results, groupFor)
  const ids = new Set(sources.map((s) => s.id))
  const resolves = (id: string) => ids.has(id) || sources.some((s) => (s.aliases ?? []).includes(id))

  // 1 and 2. Every document its own card.
  const docs = sourceDocuments(record)
  for (const d of docs) if (!ids.has(d.card)) fail('document has no card', `${d.kind} ${d.card}`)
  const seen = new Map<string, number>()
  for (const d of docs) seen.set(d.card, (seen.get(d.card) ?? 0) + 1)
  for (const [card, n] of seen) if (n > 1) fail('card holds several documents', `${card} ×${n}`)
  for (const s of sources)
    if (!s.doc && !SINGLETONS.has(s.id) && !s.id.startsWith('reg:')) fail('card with no document behind it', `${s.id} "${s.label}"`)

  // 3. Chips.
  const byGroup = attributeRowsByGroup(record, results, groupFor)
  for (const [group, rows] of byGroup) {
    if (group === 'screening' || group === 'registration') continue
    for (const row of rows.values())
      for (const name of row.sources ?? [])
        for (const id of sourceChipCards(name, row.refs ?? []))
          if (id && !resolves(id)) fail('chip resolves to no card', `${group} · ${row.label} · "${name}" → ${id}`)
  }

  // 4. Insights.
  const drawn = new Set(REPORT_CARDS.map((c) => c.id))
  const shown = results.filter((r) => !r.notReported && !r.insightId.startsWith('signal:'))
  for (const r of shown) {
    const card = cardFor(r.insightId, groupFor)
    if (!drawn.has(card) || card === 'other') fail('insight on no report card', `${r.insightId} → ${card}`)
  }

  const count = (kind: string) => docs.filter((d) => d.kind === kind).length
  table.push({
    business: live.name.slice(0, 32),
    cards: sources.length,
    filings: count('registration'),
    city: count('city_registration'),
    permits: count('sales_tax_permit'),
    liens: count('lien'),
    cases: count('litigation'),
    screening: count('watchlist_result') + count('pep_result') + count('adverse_media_result'),
    documents: docs.reduce((n, d) => n + d.documents.length, 0),
    insights: shown.length,
    failures: findings.filter((f) => f.business === live.name).length
  })
}

if (!quiet) console.table(table)

const byCheck = new Map<string, Finding[]>()
for (const f of findings) byCheck.set(f.check, [...(byCheck.get(f.check) ?? []), f])
for (const [check, list] of byCheck) {
  console.log(`\n${check} — ${list.length}`)
  for (const f of list) console.log(`  ${f.business}: ${f.detail}`)
}
console.log(`\n${ALL.length} businesses, ${findings.length} failures`)
process.exit(findings.length > 0 ? 1 : 0)
