import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import type { Plugin } from 'vite'

/**
 * The lede, on its own.
 *
 * It answers "what is this company?" so that everything below it means
 * something. That is a fact about the business, not a finding about it, and it
 * has to be true whichever assessment happens to be running — so it is authored
 * once per business and served from here rather than written as a section of a
 * run. An assessment cannot reach it, which is the point: an instruction added
 * to one ("say HELLO at the top") used to rewrite the first paragraph of the
 * page.
 *
 * Arriving at a business asks for one if it does not have it yet — no send
 * required, because a description is not a finding and nobody should have to
 * request it. Written once and served verbatim from then on, so the same
 * business reads the same way every time.
 *
 * `analysis/lede-<businessId>.json` — `{ text, sources? }`.
 */
const DIR = join(process.cwd(), 'analysis')

/** Ledes that survive a re-pull, keyed by business name. */
const STORE = join(DIR, 'ledes.json')

const ledeKey = (name: string) => name.toLowerCase().replace(/\s+/g, ' ').trim()

const ledeByName = (name: string): { text: string; sources?: unknown } | null => {
  if (!name || !existsSync(STORE)) return null
  try {
    const { ledes } = JSON.parse(readFileSync(STORE, 'utf8')) as {
      ledes?: Record<string, { text: string; sources?: unknown }>
    }
    return ledes?.[ledeKey(name)] ?? null
  } catch {
    return null
  }
}

export const ledePlugin = (): Plugin => ({
  name: 'business-lede',
  configureServer(server) {
    mkdirSync(DIR, { recursive: true })

    server.middlewares.use((req, res, next) => {
      const url = req.url ?? ''
      if (!url.startsWith('/api/lede')) return next()
      res.setHeader('Content-Type', 'application/json')

      const businessId = new URL(url, 'http://localhost').searchParams.get('businessId')
      if (!businessId) return res.end(JSON.stringify({ text: null }))

      const name = new URL(url, 'http://localhost').searchParams.get('name') ?? ''
      const path = join(DIR, `lede-${businessId}.json`)

      if (existsSync(path)) {
        try {
          return res.end(readFileSync(path, 'utf8'))
        } catch {
          return res.end(JSON.stringify({ text: null }))
        }
      }

      /**
       * A lede outlives the business id it was written for.
       *
       * Re-ordering the same company mints a new business id, and keyed on the
       * id alone the lede came back empty for a business that already had one —
       * so the page asked for it again, and the skeleton reappeared on a record
       * nothing had changed about. The store is keyed by name, which is what
       * stays the same. A hit is copied to the id file so the fast path serves
       * it from then on.
       */
      const stored = ledeByName(name)
      if (stored) {
        try {
          writeFileSync(path, JSON.stringify(stored, null, 2))
        } catch {
          // Serving it matters; caching it does not.
        }
        return res.end(JSON.stringify(stored))
      }

      // Ask for it once, then keep answering `pending` until it lands.
      const asked = join(DIR, `lede-request-${businessId}.json`)
      if (!existsSync(asked)) {
        writeFileSync(asked, JSON.stringify({ businessId, name, askedAt: new Date().toISOString() }, null, 2))
        server.config.logger.info(
          `\n  ▶ lede requested — ${name || businessId}\n    write prototype/analysis/lede-${businessId}.json\n`
        )
      }

      return res.end(JSON.stringify({ text: null, pending: true }))
    })
  }
})
