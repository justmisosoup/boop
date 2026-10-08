/**
 * Orders a report from the Middesk API — the dev server's side of `/order`.
 *
 *   POST /api/order            places the order; returns { id }
 *   POST /api/order?dryRun=1   returns the request it would send, sends nothing
 *   GET  /api/order?id=<id>    pulls the business again; { complete } once
 *                              every order has finished
 *
 * The business is pulled into src/data/records.json the moment it is created —
 * at the top, nothing else rewritten — so it is in the list straight away, and
 * pulled again on each GET while its orders run, so the record fills in.
 *
 * The page sends the business's details and the workflows chosen. Which
 * packages run is worked out here, from the workflows' insights — the page
 * never names one. The key is read server-side (vite.config.ts) and never
 * leaves this file; neither does an API response body.
 *
 * `src/data/orderedWorkflows.json` keeps, per business ordered, the workflows
 * it was ordered with and the insights they include: the report shows those.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import type { Connect, Plugin } from 'vite'

import {
  combineConfigs,
  expandConfig,
  validateConfig,
  validateInputs,
  type BusinessInputBody
} from '../src/lib/customOrders/catalog'
import type { CustomOrderConfig, CustomOrderError } from '../src/lib/customOrders/types'
import type { OrderedAssessment, OrderedBusiness } from '../src/lib/orderedWorkflows'

/** As `ORDERING_CAP_MS` in src/lib/orderedWorkflows.ts. */
const ORDERING_CAP_MS = 10 * 60 * 1000
import { type Any, fetchFull, normalise } from './lib/business'

const ROOT = process.cwd()
const RECORDS = join(ROOT, 'src/data/records.json')
const ORDERED = join(ROOT, 'src/data/orderedWorkflows.json')
const TIMELINE = join(ROOT, 'src/data/timeline.json')

const BASE = () => process.env.MIDDESK_API_URL ?? 'https://api.middesk.com/v1'

/** An API failure, with the API's own messages and never its body otherwise. */
class ApiError extends Error {
  constructor(
    public status: number,
    public errors: CustomOrderError[]
  ) {
    super(errors.map((e) => e.message).join(' '))
  }
}

const call = async (path: string, init?: { method: string; body: unknown }) => {
  const key = process.env.MIDDESK_API_KEY
  if (!key) throw new ApiError(500, [{ message: 'No MIDDESK_API_KEY in prototype/.env.local.' }])
  const res = await fetch(`${BASE()}${path}`, {
    method: init?.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
      ...(init && { 'Content-Type': 'application/json' })
    },
    ...(init && { body: JSON.stringify(init.body) })
  })
  if (!res.ok) {
    // The API's error messages are safe to show; nothing else from the body is.
    let errors: CustomOrderError[] = [{ message: `${res.status} ${res.statusText}` }]
    try {
      const body = (await res.json()) as Any
      const listed = (body.errors ?? []) as Any[]
      const messages = listed.map((e) => String(e.message ?? e)).filter(Boolean)
      if (messages.length) errors = messages.map((message) => ({ message }))
      else if (typeof body.message === 'string') errors = [{ message: body.message }]
    } catch {
      /* not JSON */
    }
    throw new ApiError(res.status, errors)
  }
  return res.json() as Promise<Any>
}

export type OrderedWorkflows = Record<string, OrderedBusiness>

const readJson = <T>(path: string, fallback: T): T => {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T
  } catch {
    return fallback
  }
}

const writeOrdered = (next: OrderedWorkflows) => writeFileSync(ORDERED, `${JSON.stringify(next, null, 2)}\n`)

const readBody = async (req: Connect.IncomingMessage) => {
  let raw = ''
  for await (const chunk of req) raw += chunk
  return raw
}

type OrderRequest = {
  /** Add the custom orders to a business already ingested, rather than create one. */
  businessId?: string
  body: BusinessInputBody
  /** For an existing business: the details the reader changed, sent as a PATCH first. */
  patch?: BusinessInputBody
  workflows: { id: string; name: string; config: CustomOrderConfig }[]
}

/** What the order sends: the business's details and the orders its workflows need. */
const compose = (request: OrderRequest) => {
  const config = combineConfigs(request.workflows.map((w) => w.config))
  const expanded = expandConfig(config)
  // `product`: the API's name for it; `package` is deprecated. An existing
  // business has already been verified, so what the orders depend on is not
  // ordered again.
  const orders = expanded.orders
    .filter((o) => !(request.businessId && expanded.dependencies.includes(o.package)))
    .map((o) => ({
    product: o.package,
    ...(o.subproducts.length > 0 && { subproducts: o.subproducts })
  }))
  return { config, expanded, orders }
}

/** Every order finished: nothing left pending or running. */
const finished = (business: Any) => {
  const orders = (business.orders ?? []) as Any[]
  return orders.length > 0 && orders.every((o) => !/pending|progress|processing|queued|running/i.test(String(o.status ?? '')))
}

/**
 * The one record, at the top of records.json; nothing else rewritten. Written
 * only when it changed — each write reloads the page.
 */
const land = (record: Any) => {
  const records = readJson<Any[]>(RECORDS, [])
  const current = records.find((r) => r.id === record.id)
  if (current && JSON.stringify(current) === JSON.stringify(record)) return
  writeFileSync(RECORDS, JSON.stringify([record, ...records.filter((r) => r.id !== record.id)], null, 2))
}

/**
 * The business's timeline, as `pull-timeline.ts` pulls every business's: its
 * entry in timeline.json, nothing else rewritten, and only when it changed. A
 * business ordered here has one from the start rather than waiting for the
 * next full pull.
 */
const pullTimeline = async (id: string) => {
  const PAGE_SIZE = 100
  const page = (n: number) => call(`/businesses/${id}/timeline?page=${n}&per_page=${PAGE_SIZE}`)
  const first = await page(1)
  const events: Any[] = [...(first.data ?? [])]
  const pages = Math.min(Math.ceil((first.total_count ?? events.length) / PAGE_SIZE), 10)
  for (let n = 2; n <= pages; n++) events.push(...((await page(n)).data ?? []))
  const file = readJson<{ _comment?: string; byBusiness: Record<string, Any[]> }>(TIMELINE, { byBusiness: {} })
  if (JSON.stringify(file.byBusiness[id] ?? null) === JSON.stringify(events)) return
  file.byBusiness[id] = events
  writeFileSync(TIMELINE, JSON.stringify(file, null, 2))
}

/** Pull the business and put it in the list; true once its orders are done. */
const pull = async (id: string) => {
  const business = await fetchFull(id, (path) => call(path))
  land(normalise(business))
  try {
    await pullTimeline(id)
  } catch {
    /* not entitled, or none yet: the record still lands */
  }
  return { business, status: String(business.status ?? 'pending'), complete: finished(business) }
}

/** An order the API still has running. */
const RUNNING = /pending|progress|processing|queued|running/i
/** Orders placed for an assessment land just before it is recorded. */
const SLACK_MS = 10 * 60 * 1000

/**
 * One assessment's orders have finished: every product it needs has an order
 * placed around when it was run, and none of those is still running. Read per
 * assessment, so one waiting on Liens does not hold another whose verification
 * is already back.
 */
const assessmentDone = (a: OrderedAssessment, business: Any) => {
  const own = expandConfig(combineConfigs([{ packages: [], insight_groups: a.insight_groups, status_overrides: [] }]))
  const products = own.orders.map((o) => o.package).filter((p) => !own.dependencies.includes(p))
  const since = Date.parse(a.orderedAt) - SLACK_MS
  const orders = ((business.orders ?? []) as Any[]).filter(
    (o) => Date.parse(String(o.created_at ?? o.createdAt ?? '')) >= since
  )
  return products.every((p) => {
    const mine = orders.filter((o) => (o.product ?? o.package) === p)
    return mine.length > 0 && mine.every((o) => !RUNNING.test(String(o.status ?? '')))
  })
}

/**
 * Pull a business whose assessments are still running, and mark each one done
 * as its own orders finish. The record is rewritten only when it changed, and
 * each write reloads an open page with the cards filled in.
 */
const check = async (id: string) => {
  const { business, status } = await pull(id)
  const ordered = readJson<OrderedWorkflows>(ORDERED, {})
  const open = ordered[id]?.assessments.filter((a) => !a.completedAt) ?? []
  // Done when its orders finish — or once it has waited past the cap, so an
  // order the API is slow on never leaves it "Ordering".
  const done = open.filter((a) => assessmentDone(a, business) || Date.now() - Date.parse(a.orderedAt) > ORDERING_CAP_MS)
  if (done.length > 0) {
    const at = new Date().toISOString()
    done.forEach((a) => (a.completedAt = at))
    writeOrdered(ordered)
  }
  return { status, complete: open.length === done.length }
}

/** How often the dev server checks on running assessments by itself. */
const WATCH_MS = 20_000

export const orderPlugin = (): Plugin => ({
  name: 'order-endpoint',
  configureServer(server) {
    // Running assessments settle on their own, whether or not a page is open
    // to ask: every 20s, each business with one still running is checked.
    let busy = false
    const timer = setInterval(async () => {
      if (busy || !process.env.MIDDESK_API_KEY) return
      busy = true
      try {
        const ordered = readJson<OrderedWorkflows>(ORDERED, {})
        const running = Object.keys(ordered).filter((id) => ordered[id].assessments.some((a) => !a.completedAt))
        for (const id of running) {
          try {
            await check(id)
          } catch {
            /* the next pass tries again */
          }
        }
      } finally {
        busy = false
      }
    }, WATCH_MS)
    server.httpServer?.once('close', () => clearInterval(timer))

    server.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url ?? '/', 'http://localhost')
      if (url.pathname !== '/api/order') return next()
      res.setHeader('Content-Type', 'application/json')
      const fail = (status: number, errors: CustomOrderError[]) => {
        res.statusCode = status
        res.end(JSON.stringify({ errors }))
      }

      try {
        if (req.method === 'POST') {
          const request = JSON.parse(await readBody(req)) as OrderRequest
          if (!request.workflows?.length) return fail(422, [{ message: 'Choose at least one assessment.' }])
          const { config, expanded, orders } = compose(request)
          const problems = [
            ...validateConfig(config),
            // An existing business already has its details on file.
            ...(request.businessId ? [] : validateInputs(config, request.body))
          ]
          if (problems.length) return fail(422, problems)

          const apiRequest = request.businessId
            ? [
                ...(request.patch && Object.keys(request.patch).length > 0
                  ? [{ method: 'PATCH', path: `/businesses/${request.businessId}`, body: request.patch }]
                  : []),
                ...orders.map((order) => ({ method: 'POST', path: `/businesses/${request.businessId}/orders`, body: order }))
              ]
            : [{ method: 'POST', path: '/businesses', body: { ...request.body, orders } }]

          if (url.searchParams.get('dryRun')) {
            res.end(JSON.stringify({ dryRun: true, requests: apiRequest, insights: expanded.insights }))
            return
          }

          let id = request.businessId
          for (const r of apiRequest) {
            const created = await call(r.path, { method: r.method, body: r.body })
            id ??= created.id
          }
          if (!id) return fail(502, [{ message: 'The API did not return a business id.' }])

          // One assessment per custom order: each reads its own insights.
          const now = new Date().toISOString()
          const stamp = Date.now().toString(36)
          const added: OrderedAssessment[] = request.workflows.map((w, i) => {
            const own = expandConfig(combineConfigs([w.config]))
            return {
              id: `a-${stamp}-${i}`,
              customOrderId: w.id,
              name: w.name,
              insight_groups: w.config.insight_groups,
              insights: own.insights,
              orderedAt: now
            }
          })
          const ordered = readJson<OrderedWorkflows>(ORDERED, {})
          ordered[id] = {
            name: ordered[id]?.name ?? request.body.name ?? '',
            assessments: [...(ordered[id]?.assessments ?? []), ...added]
          }
          writeOrdered(ordered)
          // Into the list now, whatever the orders' state; the GETs fill it in.
          try {
            await pull(id)
          } catch {
            /* the list's poll pulls it on its next pass */
          }
          res.end(JSON.stringify({ id }))
          return
        }

        if (req.method === 'GET') {
          const id = url.searchParams.get('id')
          if (!id) return fail(400, [{ message: 'An id is required.' }])
          res.end(JSON.stringify(await check(id)))
          return
        }

        next()
      } catch (e) {
        if (e instanceof ApiError) return fail(e.status >= 500 ? 502 : e.status, e.errors)
        fail(500, [{ message: (e as Error).message }])
      }
    })
  }
})
