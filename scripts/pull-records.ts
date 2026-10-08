/**
 * Pulls REAL businesses from the Middesk API into the prototype.
 *
 * The key is read from prototype/.env.local (gitignored) and never leaves this
 * script — a build-time pull, so nothing is bundled into client code and no key
 * reaches the browser.
 *
 *   bun run pull                 # first page of the account
 *   bun run pull "apex"          # search by name
 *   bun run pull --id <uuid>     # one business
 *   bun run pull --limit 40      # more records
 *
 * Output: src/data/records.json, normalised into the shape src/lib/deriveResults
 * reads. The API's own field names are preserved in the normaliser below so the
 * mapping is auditable.
 */
import { type Any, fetchFull, normalise } from './lib/business'

const KEY = process.env.MIDDESK_API_KEY
const BASE = process.env.MIDDESK_API_URL ?? 'https://api.middesk.com/v1'

if (!KEY) {
  console.error('No MIDDESK_API_KEY. Put it in prototype/.env.local, then re-run.')
  process.exit(1)
}

const call = async (path: string) => {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${KEY}`, Accept: 'application/json' }
  })
  // Never echo the key or a response body that might contain one.
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} on ${path}`)
  return res.json()
}


const args = process.argv.slice(2)
const limitArg = args.indexOf('--limit')
const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : 25

let summaries: Any[] = []

if (args[0] === '--id' && args[1]) {
  summaries = [{ id: args[1] }]
} else {
  const q = args[0] && !args[0].startsWith('--') ? `&q=${encodeURIComponent(args[0])}` : ''
  // Over-fetch a little so that records without review tasks can be dropped and
  // still leave `limit` of them. The API serves at most 50 a page (100 is a
  // 422), so the over-fetch pages in fifties.
  const want = limit * 2
  for (let page = 1; summaries.length < want; page++) {
    const got = await call(`/businesses?per_page=50&page=${page}${q}`)
    const rows: Any[] = got.data ?? got.businesses ?? []
    summaries.push(...rows)
    if (rows.length < 50) break
  }
}

// The list endpoint returns summaries; addresses, registrations and people come
// from the per-business endpoint.
const full: Any[] = []
for (const s of summaries) {
  try {
    full.push(await fetchFull(s.id, call))
  } catch (e) {
    console.warn(`skipped ${s.id}: ${(e as Error).message}`)
  }
}

// Latest first, always. The account grows; the prototype should show what was
// added most recently rather than whatever the page happens to return.
const records = full
  .map(normalise)
  .filter((r) => r.reviewTasks.length > 0)
  .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
  .slice(0, limit)
await Bun.write('src/data/records.json', JSON.stringify(records, null, 2))

console.log(
  `pulled ${records.length} record(s) with ${records.reduce((n, r) => n + r.reviewTasks.length, 0)} review tasks → src/data/records.json`
)

// The timeline for the same businesses, so the two files never disagree.
await import('./pull-timeline.ts')
