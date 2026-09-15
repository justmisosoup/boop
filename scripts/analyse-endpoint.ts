/**
 * The analysis is run by the Claude Code session, not by an API call.
 *
 * The prototype writes the request to `analysis/pending.json`; the session reads
 * it, writes `analysis/result-<id>.json`, and the UI polls for it. No API key and
 * no separate model call — the session that built the insight logic is the one
 * interpreting its output, and can be asked to refine it in conversation.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import type { Connect, Plugin } from 'vite'

import type {
  AnalysisDraft,
  AnalysisRequest,
  AnalysisResult,
  AnalysisVerdict,
  AssessmentSection,
  AssessmentSectionId
} from '../src/types'

const DIR = join(process.cwd(), 'analysis')

const readBody = async (req: Connect.IncomingMessage) => {
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(c as Buffer)
  return Buffer.concat(chunks).toString()
}

/** What the standing report was run against. A reload re-pulls nothing, so the
 *  same record must reuse its answer rather than queue a second identical run and
 *  orphan the first — but a record that has genuinely changed must re-run. */
const fingerprint = (insights: AnalysisRequest['insights']) =>
  createHash('sha1')
    .update(insights.map((i) => `${i.id}|${i.state}|${i.reason ?? ''}|${i.statement}`).join('\n'))
    .digest('hex')
    .slice(0, 12)

const cachePath = (businessId: string) => join(DIR, `report-${businessId}.json`)

/** The id of the report already standing for this exact record — answered, or
 *  still outstanding. Returning an outstanding id lets a reload rejoin the run
 *  in flight instead of queueing a duplicate beside it. */
const cachedReport = (businessId: string, print: string): string | null => {
  const path = cachePath(businessId)
  if (!existsSync(path)) return null
  try {
    const { id, fingerprint: was } = JSON.parse(readFileSync(path, 'utf8')) as {
      id?: string
      fingerprint?: string
    }
    return id !== undefined && was === print ? id : null
  } catch {
    return null
  }
}

const SECTION_IDS: AssessmentSectionId[] = [
  'description',
  'identity',
  'ownership',
  'activity',
  'compliance',
  'recommendation',
  'answer'
]

/** A hand-written file is easy to get wrong; a malformed one should say so
 *  rather than leave the panel waiting forever. */
const problemWithDraft = (value: unknown): string | null => {
  if (!value || typeof value !== 'object') return 'Assessments file is not an object.'
  const d = value as Partial<AnalysisDraft>
  if (!Array.isArray(d.used)) return 'Assessments file is missing `used` (array of insight ids).'
  if (!Array.isArray(d.sections) || d.sections.length === 0)
    return 'Assessments file is missing `sections` (see analysis/README.md).'
  for (const section of d.sections) {
    if (!SECTION_IDS.includes(section?.id))
      return `Unknown section id \`${String(section?.id)}\` — expected one of ${SECTION_IDS.join(', ')}.`
    if (section.id === 'recommendation')
      return 'The assessments file must not contain a `recommendation` section — it goes in the verdict file, written after.'
    if (!Array.isArray(section.body)) return `Section \`${section.id}\` is missing \`body\`.`
  }
  return null
}

const citesOf = (sections: AssessmentSection[]) =>
  new Set(
    sections.flatMap((s) => [
      ...s.body.flatMap((b) => b.cites ?? []),
      ...(s.gaps ?? []).flatMap((g) => g.cites ?? [])
    ])
  )

/**
 * The verdict is checked against the assessments it claims to rest on.
 *
 * Sequence alone proves little — the recommendation could still be written from
 * the record directly and merely saved second. Requiring every id it cites to
 * already appear in an assessment is what makes it a reading OF them: a
 * conclusion reaching past its own argument fails rather than renders.
 */
const problemWithVerdict = (value: unknown, draft: AnalysisDraft): string | null => {
  if (!value || typeof value !== 'object') return 'Verdict file is not an object.'
  const v = value as Partial<AnalysisVerdict>
  if (typeof v.headline !== 'string' || !v.headline.trim()) return 'Verdict is missing `headline`.'
  if (!v.recommendation || v.recommendation.id !== 'recommendation')
    return 'Verdict is missing a `recommendation` section.'
  if (!Array.isArray(v.recommendation.body)) return 'The recommendation is missing `body`.'
  if (!Array.isArray(v.followUps)) return 'Verdict is missing `followUps` (priority-ordered).'

  // Every gap is either closed by a step or explicitly written off. A check
  // that ran at all is one the policy probably asks for, so an unaccounted gap
  // is an omission, not a judgement.
  const closed = new Set(v.followUps.flatMap((f) => f.closes ?? []))
  const open = draft.sections
    .flatMap((section) => section.gaps ?? [])
    .filter((g) => !g.noAction && !closed.has(g.id))
  if (open.length > 0)
    return `No follow-up closes: ${open.map((g) => `\`${g.id}\``).join(', ')}. Close each with a follow-up (\`closes\`) or say why it needs none (\`noAction\`).`

  const available = citesOf(draft.sections)
  const reaching = [
    ...citesOf([v.recommendation]),
    ...v.followUps.flatMap((f) => f.cites ?? [])
  ].filter((id) => !available.has(id))

  if (reaching.length > 0)
    return `The recommendation cites ${[...new Set(reaching)].join(', ')}, which no assessment discusses. A verdict may only rest on its own assessments.`

  return null
}

export const analysePlugin = (): Plugin => ({
  name: 'analyse-via-session',
  configureServer(server) {
    mkdirSync(DIR, { recursive: true })

    server.middlewares.use(async (req, res, next) => {
      const url = req.url ?? ''
      if (!url.startsWith('/api/analyse')) return next()
      res.setHeader('Content-Type', 'application/json')

      // Queue a request for the session to pick up.
      if (req.method === 'POST') {
        const body = JSON.parse(await readBody(req)) as Omit<AnalysisRequest, 'id' | 'requestedAt'> & {
          attachments?: Array<{ name: string; type: string; size: number; dataBase64: string }>
        }
        // A standing report already answered for this record is served straight
        // back; the client polls by id and gets it on the first tick.
        if (body.kind === 'report') {
          const hit = cachedReport(body.businessId, fingerprint(body.insights))
          if (hit) {
            const answered = existsSync(join(DIR, `result-${hit}.json`))
            server.config.logger.info(
              answered
                ? `  ↻ analysis reused — ${body.business.name} (analysis/result-${hit}.json)`
                : `  ⋯ analysis already outstanding — ${body.business.name} (write analysis/result-${hit}.json)`
            )
            res.end(JSON.stringify({ id: hit }))
            return
          }
        }

        const id = `${Date.now()}`

        // Attachments land on disk so the session can open them directly; the
        // base64 payload is not kept in the request file.
        const attachments = (body.attachments ?? []).map((a) => {
          const safe = a.name.replace(/[^\w.\- ]+/g, '_')
          const dir = join(DIR, 'attachments', id)
          mkdirSync(dir, { recursive: true })
          const full = join(dir, safe)
          writeFileSync(full, Buffer.from(a.dataBase64, 'base64'))
          return {
            name: a.name,
            type: a.type,
            size: a.size,
            path: `analysis/attachments/${id}/${safe}`
          }
        })

        const request: AnalysisRequest = {
          id,
          requestedAt: new Date().toISOString(),
          ...body,
          attachments
        }

        writeFileSync(join(DIR, 'pending.json'), JSON.stringify(request, null, 2))
        writeFileSync(join(DIR, `request-${id}.json`), JSON.stringify(request, null, 2))
        if (request.kind === 'report') {
          writeFileSync(
            cachePath(request.businessId),
            JSON.stringify({ id, fingerprint: fingerprint(request.insights) }, null, 2)
          )
        }

        server.config.logger.info(
          [
            '',
            `  ▶ analysis requested — ${request.business.name}`,
            `    ${request.insights.length} insights${request.pinned?.length ? `, ${request.pinned.length} pinned` : ''}`,
            ...(request.attachments?.length
              ? [`    ${request.attachments.length} attachment(s) in prototype/analysis/attachments/${id}/`]
              : []),
            `    read  prototype/analysis/pending.json`,
            `    write prototype/analysis/result-${id}.json`,
            ''
          ].join('\n')
        )
        res.end(JSON.stringify({ id }))
        return
      }

      // Poll for the session's answer, which arrives in two stages.
      if (req.method === 'GET') {
        const id = new URL(url, 'http://localhost').searchParams.get('id')
        if (!id) {
          res.end(JSON.stringify({ pending: true }))
          return
        }

        const read = (suffix: string) => {
          const path = join(DIR, `result-${id}${suffix}.json`)
          if (!existsSync(path)) return undefined
          try {
            return JSON.parse(readFileSync(path, 'utf8')) as unknown
          } catch {
            return `result-${id}${suffix}.json is not valid JSON.`
          }
        }

        const fail = (error: string) => {
          res.statusCode = 422
          res.end(JSON.stringify({ error }))
        }

        const rawDraft = read('.assessments')
        if (rawDraft === undefined) {
          res.end(JSON.stringify({ pending: true }))
          return
        }
        if (typeof rawDraft === 'string') return fail(rawDraft)

        const draftProblem = problemWithDraft(rawDraft)
        if (draftProblem) return fail(`${draftProblem} (analysis/result-${id}.assessments.json)`)
        const draft = rawDraft as AnalysisDraft

        const rawVerdict = read('')
        // Assessments written, verdict not yet. The UI renders what exists and
        // keeps waiting — which is the sequence being visible, not asserted.
        if (rawVerdict === undefined) {
          res.end(JSON.stringify({ stage: 'assessments', draft }))
          return
        }
        if (typeof rawVerdict === 'string') return fail(rawVerdict)

        const verdictProblem = problemWithVerdict(rawVerdict, draft)
        if (verdictProblem) return fail(`${verdictProblem} (analysis/result-${id}.json)`)
        const verdict = rawVerdict as AnalysisVerdict

        const merged: AnalysisResult = {
          by: draft.by,
          used: draft.used,
          headline: verdict.headline,
          sections: [...draft.sections, verdict.recommendation],
          followUps: verdict.followUps
        }
        res.end(JSON.stringify(merged))
        return
      }

      next()
    })
  }
})
