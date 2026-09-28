/**
 * Pulls each business's timeline from the Middesk API.
 *
 * The businesses are the ones already in src/data/records.json — this does not
 * re-pull them, so it can run on its own without rewriting the records.
 * `pull-records.ts` runs it at the end, so a data refresh keeps the two in step.
 *
 *   bun run pull:timeline
 *
 * Paging follows the dashboard's (`app/src/lib/api.ts`,
 * `getBusinessTimelineEvents`): pages of 100, at most 10.
 *
 * Output: src/data/timeline.json, `{ byBusiness: { [id]: events } }`, each event
 * as the API returns it — `parse.ts` reads `data.object` and its `sources[]`,
 * so the shape is the contract.
 */
const KEY = process.env.MIDDESK_API_KEY
const BASE = process.env.MIDDESK_API_URL ?? 'https://api.middesk.com/v1'

if (!KEY) {
  console.error('No MIDDESK_API_KEY. Put it in prototype/.env.local, then re-run.')
  process.exit(1)
}

const PAGE_SIZE = 100
const MAX_PAGES = 10

const call = async (path: string) => {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${KEY}`, Accept: 'application/json' }
  })
  // Never echo the key or a response body that might contain one.
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} on ${path}`)
  return res.json()
}

type Any = Record<string, any>

const records = (await Bun.file('src/data/records.json').json()) as Any[]
const byBusiness: Record<string, Any[]> = {}

for (const r of records) {
  try {
    const page = (n: number) => call(`/businesses/${r.id}/timeline?page=${n}&per_page=${PAGE_SIZE}`)
    const first = await page(1)
    const events: Any[] = [...(first.data ?? [])]
    const pages = Math.min(Math.ceil((first.total_count ?? events.length) / PAGE_SIZE), MAX_PAGES)
    for (let n = 2; n <= pages; n++) events.push(...((await page(n)).data ?? []))
    byBusiness[r.id] = events
    console.log(`${String(events.length).padStart(4)}  ${r.name}`)
  } catch (e) {
    // A 403 is an account not entitled to it, not a business with no history —
    // leave it out rather than store an empty timeline.
    console.warn(`skipped ${r.name}: ${(e as Error).message}`)
  }
}

await Bun.write(
  'src/data/timeline.json',
  JSON.stringify(
    {
      _comment:
        'GET /v1/businesses/:id/timeline for every business in records.json, as the API returns each event. Written by scripts/pull-timeline.ts.',
      byBusiness
    },
    null,
    2
  )
)

console.log(
  `pulled ${Object.values(byBusiness).reduce((n, e) => n + e.length, 0)} events for ${Object.keys(byBusiness).length} of ${records.length} businesses → src/data/timeline.json`
)
