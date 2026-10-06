/**
 * Re-fetches ONLY the liens of every record in src/data/records.json, and of
 * every report snapshot in analysis/reports.json that holds the same record.
 *
 * The full pull (`bun run pull`) rewrites every record wholesale. This patch
 * exists for the case where the lien mapping gained fields — party addresses,
 * the collateral type, the updated date — and the rest of the data should
 * stay exactly as it is. Each record's `liens` is replaced with the API's,
 * mapped by the same `mapLien` the pull uses; nothing else in the file moves.
 * The report page reads a report's snapshot of the record, not the record
 * itself, so the snapshots are patched from the same fetch.
 *
 *   bun run patch:liens
 *
 * The key is read from prototype/.env.local, as the pull reads it, and never
 * echoed.
 */
import { mapLien } from './lib/lien'

const KEY = process.env.MIDDESK_API_KEY
const BASE = process.env.MIDDESK_API_URL ?? 'https://api.middesk.com/v1'

if (!KEY) {
  console.error('No MIDDESK_API_KEY. Put it in prototype/.env.local, then re-run.')
  process.exit(1)
}

type Any = Record<string, any>

const call = async (path: string) => {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${KEY}`, Accept: 'application/json' }
  })
  // Never echo the key or a response body that might contain one.
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} on ${path}`)
  return res.json() as Promise<Any>
}

const FILE = 'src/data/records.json'
const REPORTS = 'analysis/reports.json'
const records: Any[] = await Bun.file(FILE).json()
/** The fresh liens by business id, for the snapshots. */
const freshById = new Map<string, Any[]>()

let patched = 0
let liens = 0
let withAddress = 0
let withCollateralType = 0
let withUpdated = 0

for (const record of records) {
  if (!Array.isArray(record.liens) || record.liens.length === 0) continue
  const business = await call(`/businesses/${record.id}`)
  const fresh = ((business.liens ?? []) as Any[]).map(mapLien)
  record.liens = fresh
  freshById.set(record.id, fresh)
  patched += 1
  liens += fresh.length
  for (const l of fresh) {
    if ([...l.debtors, ...l.securedParties].some((p) => p.addresses.length > 0)) withAddress += 1
    if (l.collateralType) withCollateralType += 1
    if (l.updatedDate) withUpdated += 1
  }
  console.log(`${record.name}: ${fresh.length} lien(s)`)
}

await Bun.write(FILE, JSON.stringify(records, null, 2))

// The snapshots: `reports.<business name>[]`, each with the record it was
// written from. Only the liens move; the results and the rest of the record
// stay as the report read them.
const store: Any = await Bun.file(REPORTS).json()
let snapshots = 0
for (const list of Object.values((store.reports ?? {}) as Record<string, Any[]>)) {
  for (const report of list) {
    const rec = report?.snapshot?.record
    const fresh = rec && freshById.get(rec.id ?? report.snapshot.recordId)
    if (!fresh || !Array.isArray(rec.liens)) continue
    rec.liens = fresh
    snapshots += 1
  }
}
// Compact, as the app writes it: one line, so the file keeps its own shape.
await Bun.write(REPORTS, JSON.stringify(store))
console.log(`patched the liens of ${snapshots} report snapshot(s) → ${REPORTS}`)
console.log(
  `patched ${patched} record(s), ${liens} lien(s): ${withAddress} with a party address, ${withCollateralType} with a collateral type, ${withUpdated} with an updated date → ${FILE}`
)
