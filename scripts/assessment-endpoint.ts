/**
 * One assessment's summary, written by the session — the dev server's side of
 * an Assessment card's Generate / Regenerate.
 *
 *   POST /api/assessment-summary          queues one; returns { id }
 *   GET  /api/assessment-summary?id=<id>  { pending: true } until the session
 *                                         has written it; then it is checked,
 *                                         kept, and { kept: true }
 *
 * The report run (`analyse-endpoint.ts`) keeps one report per business and a
 * run replaces it. An assessment's summary is its own: regenerating one leaves
 * every other assessment's alone. Kept in `analysis/assessments.json`, keyed by
 * business id, then assessment id.
 *
 * The result is drafted on the spot from the request's own insights
 * (`draftSummary`), so nothing waits on a session. A session can still
 * overwrite `analysis/assessment-result-<id>.json` with better prose before
 * it is kept:
 *
 *   { "assessmentId": "<id>",
 *     "section": { "id": "<id>", "body": [ { "text": "…", "cites": ["<insight id>", …] } ] } }
 *
 * The first paragraph is the card's summary — one or two sentences on what the
 * assessment found, in the voice of the report's own sections. Cite only the
 * insights the request lists.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import type { Connect, Plugin } from 'vite'

const DIR = join(process.cwd(), 'analysis')
const STORE = join(DIR, 'assessments.json')

type Paragraph = { text: string; cites?: string[] }
/** `steps`: the next steps' why, as the session words them — the steps themselves are chosen by rule. */
type StepWhy = { id: string; why: string }
export type KeptSummary = { at: string; requestId: string; section: { id: string; body: Paragraph[] }; steps?: StepWhy[] }
export type SummaryStore = Record<string, Record<string, KeptSummary>>

type SummaryRequest = {
  id: string
  requestedAt: string
  businessId: string
  business: { name: string }
  assessment: { id: string; name: string; instructions: string; insightIds: string[] }
  insights: Array<{ id: string; statement: string; state: string; reason?: string }>
  /** The next steps the rules chose (`src/lib/nextSteps.ts`), each with its
   *  deterministic why. The session may reword a why; it may not add a step
   *  or drop one. */
  steps?: Array<{ id: string; label: string; why: string }>
}

const readJson = <T>(path: string, fallback: T): T => {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T
  } catch {
    return fallback
  }
}

const readBody = async (req: Connect.IncomingMessage) => {
  let raw = ''
  for await (const chunk of req) raw += chunk
  return raw
}

/**
 * The summary, written straight away from the assessment's own insights —
 * what each one states, the findings first — so a card never waits on anyone.
 * Deterministic: the same insights give the same sentences, and every
 * sentence cites the insight it came from.
 */
const draftSummary = (
  request: SummaryRequest
): { assessmentId: string; section: { id: string; body: Paragraph[] }; steps: StepWhy[] } => {
  const RANK: Record<string, number> = { result: 0, no_result: 1, unknown: 2 }
  const sentence = (text: string) => {
    const t = text.trim().replace(/\s+/g, ' ')
    return /[.!?]$/.test(t) ? t : `${t}.`
  }
  const read = [...request.insights]
    .filter((i) => i.statement?.trim())
    .sort((a, b) => (RANK[a.state] ?? 3) - (RANK[b.state] ?? 3))
  // Every check the assessment asked for that came back — findings first —
  // so a check it asked for (people verification) is never left out.
  const lead = read.filter((i) => i.state === 'result').length ? read.filter((i) => i.state === 'result') : read.slice(0, 3)
  const body: Paragraph[] = lead.length
    ? [{ text: lead.map((i) => sentence(i.statement)).join(' '), cites: lead.map((i) => i.id) }]
    : [{ text: `Nothing ${request.assessment.name} reads could be found for ${request.business.name} yet.`, cites: [] }]
  // The steps' whys as the rules wrote them, until the session rewords them.
  const steps = (request.steps ?? []).map(({ id, why }) => ({ id, why }))
  return { assessmentId: request.assessment.id, section: { id: request.assessment.id, body }, steps }
}

const requestPath = (id: string) => join(DIR, `assessment-request-${id}.json`)
const resultPath = (id: string) => join(DIR, `assessment-result-${id}.json`)

/** What is wrong with a result, or null. */
const problemWith = (
  result: { assessmentId?: string; section?: { id?: string; body?: Paragraph[] }; steps?: StepWhy[] },
  request: SummaryRequest
) => {
  // The steps are the rules'; only their whys are the session's to write.
  const asked = new Set((request.steps ?? []).map((st) => st.id))
  const invented = (result.steps ?? []).filter((st) => !asked.has(st.id)).map((st) => st.id)
  if (invented.length) return `Steps ${invented.join(', ')} weren't asked for: only the given steps' whys can be written.`
  if ((result.steps ?? []).some((st) => typeof st.why !== 'string' || !st.why.trim())) return 'Each step needs a `why`.'
  if (result.assessmentId !== request.assessment.id) return '`assessmentId` must be the request\'s assessment id.'
  if (result.section?.id !== request.assessment.id) return '`section.id` must be the request\'s assessment id.'
  const body = result.section?.body ?? []
  if (body.length === 0 || body.some((p) => typeof p?.text !== 'string' || !p.text.trim()))
    return 'The section needs at least one paragraph, each with `text`.'
  const keys = new Set(request.assessment.insightIds.map((i) => i.split(':')[0]))
  const outside = body.flatMap((p) => p.cites ?? []).filter((c) => !keys.has(c.split(':')[0]))
  if (outside.length > 0) return `It cites ${outside.join(', ')}, which this assessment does not include.`
  return null
}

export const assessmentPlugin = (): Plugin => ({
  name: 'assessment-summary',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url ?? '/', 'http://localhost')
      if (url.pathname !== '/api/assessment-summary') return next()
      res.setHeader('Content-Type', 'application/json')

      if (req.method === 'POST') {
        const body = JSON.parse(await readBody(req)) as Omit<SummaryRequest, 'id' | 'requestedAt'>
        // Unique even when a page asks for several in the same millisecond.
        const id = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`
        const request: SummaryRequest = { id, requestedAt: new Date().toISOString(), ...body }
        writeFileSync(requestPath(id), JSON.stringify(request, null, 2))
        // Written now, from its insights: the next poll keeps it.
        writeFileSync(resultPath(id), JSON.stringify(draftSummary(request), null, 2))
        res.end(JSON.stringify({ id }))
        return
      }

      if (req.method === 'GET') {
        const id = url.searchParams.get('id')
        if (!id || !existsSync(requestPath(id))) {
          res.statusCode = 404
          res.end(JSON.stringify({ error: 'No such request.' }))
          return
        }
        // Asked before results were drafted on request: draft it now.
        if (!existsSync(resultPath(id))) {
          const asked = readJson<SummaryRequest | null>(requestPath(id), null)
          if (asked) writeFileSync(resultPath(id), JSON.stringify(draftSummary(asked), null, 2))
        }
        const request = readJson<SummaryRequest>(requestPath(id), null as unknown as SummaryRequest)
        const result = readJson<{ assessmentId?: string; section?: { id: string; body: Paragraph[] }; steps?: StepWhy[] } | null>(resultPath(id), null)
        // Half-written: the session is still on it.
        if (!result) {
          res.end(JSON.stringify({ pending: true }))
          return
        }
        const problem = problemWith(result, request)
        if (problem) {
          res.statusCode = 422
          res.end(JSON.stringify({ error: problem }))
          return
        }
        const store = readJson<SummaryStore>(STORE, {})
        const kept = store[request.businessId]?.[request.assessment.id]
        // Already kept from this request: a repeat poll changes nothing.
        if (kept?.requestId !== id) {
          store[request.businessId] = {
            ...(store[request.businessId] ?? {}),
            [request.assessment.id]: {
              at: new Date().toISOString(),
              requestId: id,
              section: result.section!,
              ...(result.steps?.length ? { steps: result.steps } : {})
            }
          }
          writeFileSync(STORE, `${JSON.stringify(store, null, 2)}\n`)
        }
        res.end(JSON.stringify({ kept: true, assessmentId: request.assessment.id }))
        return
      }

      next()
    })
  }
})
