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
import { type Any, fetchFull, normalise } from './lib/business'

const ROOT = process.cwd()
const RECORDS = join(ROOT, 'src/data/records.json')
const ORDERED = join(ROOT, 'src/data/orderedWorkflows.json')

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

export type OrderedWorkflows = Record<
  string,
  {
    name: string
    workflows: { id: string; name: string }[]
    insight_groups: string[]
    insights: string[]
    report_sections: string[]
    orderedAt: string
    /** Set once every order has finished and the record was pulled after. */
    completedAt?: string
  }
>

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
  /** Add the workflows to a business already ingested, rather than create one. */
  businessId?: string
  body: BusinessInputBody
  workflows: { id: string; name: string; config: CustomOrderConfig }[]
}

/** What the order sends: the business's details and the orders its workflows need. */
const compose = (request: OrderRequest) => {
  const config = combineConfigs(request.workflows.map((w) => w.config))
  const expanded = expandConfig(config)
  const orders = expanded.orders.map((o) => ({
    package: o.package,
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

/** Pull the business and put it in the list; true once its orders are done. */
const pull = async (id: string) => {
  const business = await fetchFull(id, (path) => call(path))
  land(normalise(business))
  return { status: String(business.status ?? 'pending'), complete: finished(business) }
}

export const orderPlugin = (): Plugin => ({
  name: 'order-endpoint',
  configureServer(server) {
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
          if (!request.workflows?.length) return fail(422, [{ message: 'Choose at least one custom order.' }])
          const { config, expanded, orders } = compose(request)
          const problems = [
            ...validateConfig(config),
            // An existing business already has its details on file.
            ...(request.businessId ? [] : validateInputs(config, request.body))
          ]
          if (problems.length) return fail(422, problems)

          const apiRequest = request.businessId
            ? orders.map((order) => ({ method: 'POST', path: `/businesses/${request.businessId}/orders`, body: order }))
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

          const ordered = readJson<OrderedWorkflows>(ORDERED, {})
          const prior = ordered[id]
          const workflows = [...(prior?.workflows ?? []), ...request.workflows.map(({ id, name }) => ({ id, name }))]
          ordered[id] = {
            name: request.body.name ?? prior?.name ?? '',
            workflows: workflows.filter((w, i) => workflows.findIndex((x) => x.id === w.id) === i),
            insight_groups: [...new Set([...(prior?.insight_groups ?? []), ...config.insight_groups])],
            insights: [...new Set([...(prior?.insights ?? []), ...expanded.insights])],
            report_sections: [...new Set([...(prior?.report_sections ?? []), ...expanded.report_sections])],
            orderedAt: new Date().toISOString()
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
          const { status, complete } = await pull(id)
          const ordered = readJson<OrderedWorkflows>(ORDERED, {})
          if (complete && ordered[id] && !ordered[id].completedAt) {
            ordered[id].completedAt = new Date().toISOString()
            writeOrdered(ordered)
          }
          res.end(JSON.stringify({ status, complete }))
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
