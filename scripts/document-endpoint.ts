/**
 * A business's documents — the Articles, a Certificate of Good Standing, the
 * filings document retrieval finds — as files the report can show.
 *
 *   GET /documents/<documentId>.pdf?b=<businessId>   the document itself
 *   GET /documents/<documentId>.png?b=<businessId>   its first page, as an image
 *   GET /documents/<documentId>.json?b=<businessId>  its page count, every page
 *                                                    made as /documents/<id>-p<n>.png
 *   POST /api/document-upload                        an analyst's own PDF, kept as
 *                                                    upload-<uuid>; its id back
 *
 * The record keeps a document's name and type, not its file: the API's
 * download URL is signed and expires. So the first time one is asked for, the
 * dev server reads the business from the live API (a GET, nothing written
 * there), downloads the PDF from its fresh URL, renders page one with
 * `pdftoppm`, and keeps both in `public/documents/` — which the build serves
 * as static files, once they are committed.
 */
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'

import type { Plugin } from 'vite'

const run = promisify(execFile)
const DIR = join(process.cwd(), 'public/documents')
const BASE = () => process.env.MIDDESK_API_URL ?? 'https://api.middesk.com/v1'

type ApiDocument = { id: string; download_url?: string }

/** The document's PDF, kept; fetched fresh from the API the first time. */
const ensurePdf = async (businessId: string, documentId: string) => {
  const pdf = join(DIR, `${documentId}.pdf`)
  if (existsSync(pdf)) return pdf
  const key = process.env.MIDDESK_API_KEY
  if (!key) throw new Error('No MIDDESK_API_KEY in prototype/.env.local.')
  const res = await fetch(`${BASE()}/businesses/${businessId}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' }
  })
  if (!res.ok) throw new Error(`The business could not be read (${res.status}).`)
  const business = (await res.json()) as { documents?: ApiDocument[] }
  const url = business.documents?.find((d) => d.id === documentId)?.download_url
  if (!url) throw new Error('The business has no such document.')
  const file = await fetch(url)
  if (!file.ok) throw new Error(`The document could not be downloaded (${file.status}).`)
  mkdirSync(DIR, { recursive: true })
  writeFileSync(pdf, Buffer.from(await file.arrayBuffer()))
  return pdf
}

/** Page one, as a PNG beside the PDF. */
const ensurePng = async (businessId: string, documentId: string) => {
  const png = join(DIR, `${documentId}.png`)
  if (existsSync(png)) return png
  const pdf = await ensurePdf(businessId, documentId)
  // -singlefile writes <out>.png rather than <out>-1.png.
  await run('pdftoppm', ['-png', '-r', '110', '-f', '1', '-l', '1', '-singlefile', pdf, join(DIR, documentId)])
  return png
}

/** Every page as a PNG — `<id>-p<n>.png` — for the viewer; their count back. */
const ensurePages = async (businessId: string, documentId: string) => {
  const meta = join(DIR, `${documentId}.json`)
  if (existsSync(meta)) return meta
  const pdf = await ensurePdf(businessId, documentId)
  const { stdout } = await run('pdfinfo', [pdf])
  const pages = Number(/Pages:\s+(\d+)/.exec(stdout)?.[1] ?? 1)
  // pdftoppm numbers the pages it writes (`<prefix>-1.png`, `-01` past nine); renamed to a fixed form.
  await run('pdftoppm', ['-png', '-r', '110', pdf, join(DIR, `${documentId}-page`)])
  for (const f of readdirSync(DIR).filter((f) => f.startsWith(`${documentId}-page-`))) {
    const n = Number(/-(\d+)\.png$/.exec(f)?.[1])
    renameSync(join(DIR, f), join(DIR, `${documentId}-p${n}.png`))
  }
  writeFileSync(meta, JSON.stringify({ pages }))
  return meta
}

export const documentPlugin = (): Plugin => ({
  name: 'business-documents',
  configureServer(server) {
    // An analyst's own document, uploaded: kept beside the retrieved ones as
    // `upload-<uuid>.pdf`, read and drawn the same way from then on.
    server.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url ?? '/', 'http://localhost')
      if (url.pathname !== '/api/document-upload' || req.method !== 'POST') return next()
      const chunks: Buffer[] = []
      for await (const chunk of req) chunks.push(chunk as Buffer)
      const id = `upload-${randomUUID()}`
      mkdirSync(DIR, { recursive: true })
      writeFileSync(join(DIR, `${id}.pdf`), Buffer.concat(chunks))
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ id }))
    })
    server.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url ?? '/', 'http://localhost')
      // A page of the viewer: kept once the document's pages are made.
      const page = /^\/documents\/([\w-]+)-p(\d+)\.png$/.exec(url.pathname)
      if (page) {
        const file = join(DIR, `${page[1]}-p${page[2]}.png`)
        if (!existsSync(file)) return next()
        res.setHeader('Content-Type', 'image/png')
        res.end(readFileSync(file))
        return
      }
      const match = /^\/documents\/([\w-]+)\.(pdf|png|json)$/.exec(url.pathname)
      const businessId = url.searchParams.get('b')
      if (!match) return next()
      const kept = join(DIR, `${match[1]}.${match[2]}`)
      if (!existsSync(kept) && !businessId) return next()
      try {
        // Served from here, kept or fetched: Vite's list of public files is
        // taken at start-up and does not know a file kept since.
        const file = existsSync(kept)
          ? kept
          : match[2] === 'pdf'
            ? await ensurePdf(businessId!, match[1])
            : match[2] === 'json'
              ? await ensurePages(businessId!, match[1])
              : await ensurePng(businessId!, match[1])
        res.setHeader('Content-Type', { pdf: 'application/pdf', png: 'image/png', json: 'application/json' }[match[2] as 'pdf'])
        res.end(readFileSync(file))
      } catch (e) {
        res.statusCode = 502
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: (e as Error).message }))
      }
    })
  }
})
