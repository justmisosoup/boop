/**
 * The analysis is run by the Claude Code session, not by an API call.
 *
 * The prototype writes the request to `analysis/pending.json`; the session reads
 * it and writes back. No API key and no separate model call — the session that
 * built the insight logic is the one interpreting its output, and can be asked to
 * refine it in conversation.
 *
 * The assessments are independent of each other and are worked at the same time,
 * one file each under `analysis/result-<id>.assessments/`. Only the
 * recommendation is serial: it reads all of them, and may not cite what none of
 * them discussed.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import type { Connect, Plugin } from 'vite'

import type {
  AnalysisDraft,
  AnalysisRequest,
  AnalysisResult,
  AnalysisVerdict,
  AssessmentFile,
  AssessmentSection
} from '../src/types'

const DIR = join(process.cwd(), 'analysis')

const readBody = async (req: Connect.IncomingMessage) => {
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(c as Buffer)
  return Buffer.concat(chunks).toString()
}

/**
 * The standing report for a business, keyed by name.
 *
 * A finished report used to live only in the browser: pressing send cleared it
 * and a reload lost it, so the work the session did survived exactly as long as
 * the tab did. Keyed by NAME rather than business id because re-ordering the
 * same company mints a new id every time — see `analysis/ledes.json`, which is
 * keyed the same way for the same reason.
 */
const REPORTS = join(DIR, 'reports.json')

const reportKey = (name: string) => name.toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * What the report was written against: the workflow's brief and every
 * assessment's, in order.
 *
 * A re-run of the same assessments over the same record would produce the same
 * report, so it is replayed rather than asked for again. Edit a brief and this
 * changes, which is the signal that the answer has to be written afresh — the
 * whole point of editing one.
 */
const briefPrint = (request: AnalysisRequest) =>
  [request.prompt, ...(request.assessments ?? []).map((a) => `${a.id}:${a.instructions}`)].join('\u0000')

const readReports = (): Record<string, unknown> => {
  if (!existsSync(REPORTS)) return {}
  try {
    return (JSON.parse(readFileSync(REPORTS, 'utf8')) as { reports?: Record<string, unknown> })
      .reports ?? {}
  } catch {
    return {}
  }
}

const keepReport = (
  name: string,
  report: unknown,
  brief: string,
  /** The assessments it was composed of — the report's own headings and order,
   *  which the page cannot recover from the sections alone. */
  policy: Array<{ id: string; name: string }>
) => {
  if (!name) return
  try {
    const reports = { ...readReports(), [reportKey(name)]: { brief, policy, report } }
    writeFileSync(
      REPORTS,
      JSON.stringify(
        {
          _comment:
            'The latest report per business, keyed by name. Written when a run completes; served on arrival so a reload or a new run does not lose the last one.',
          reports
        },
        null,
        2
      )
    )
  } catch {
    // Serving the report matters; keeping it is best effort.
  }
}

/** Where one run's assessments accumulate, one file per assessment. */
const draftDir = (id: string) => join(DIR, `result-${id}.assessments`)

/** Ids the runner owns; an assessment may not claim one. */
const RESERVED = new Set(['recommendation', 'answer'])

/** A hand-written file is easy to get wrong; a malformed one should say so
 *  rather than leave the panel waiting forever. */
const problemWithAssessment = (value: unknown, expectedId: string): string | null => {
  if (!value || typeof value !== 'object') return 'Assessment file is not an object.'
  const a = value as Partial<AssessmentFile>
  if (!Array.isArray(a.used)) return 'Assessment file is missing `used` (array of insight ids).'
  if (a.assessmentId !== expectedId)
    return `Assessment file declares \`${String(a.assessmentId)}\` but is filed under \`${expectedId}\`.`
  const section = a.section
  if (!section || typeof section !== 'object') return 'Assessment file is missing `section`.'
  if (RESERVED.has(section.id))
    return `\`${section.id}\` is the runner's, not an assessment's — the recommendation is written after every assessment has landed.`
  if (section.id !== expectedId)
    return `Section id \`${String(section.id)}\` does not match assessment \`${expectedId}\`.`
  if (!Array.isArray(section.body)) return `Section \`${section.id}\` is missing \`body\`.`
  return null
}

/**
 * Everything written so far, in the order the customer composed it.
 *
 * A file that is absent has not been written yet. A file that will not parse is
 * being written RIGHT NOW — the session is mid-flush and the poller caught it
 * between bytes. Both are "not here yet", and neither is an error: a torn read
 * used to 422 and kill the whole run, which is a race the writer cannot avoid
 * and the reader can simply wait out.
 *
 * A file that parses but is wrong IS an error, and says which assessment.
 */
const collect = (id: string, manifest: AnalysisRequest['assessments']) => {
  const dir = draftDir(id)
  const present = existsSync(dir) ? new Set(readdirSync(dir)) : new Set<string>()

  const arrived: string[] = []
  const sections: AssessmentSection[] = []
  const used: string[] = []

  for (const { id: assessmentId } of manifest) {
    const file = `${assessmentId}.json`
    if (!present.has(file)) continue

    let parsed: unknown
    try {
      parsed = JSON.parse(readFileSync(join(dir, file), 'utf8'))
    } catch {
      continue // mid-write, not malformed
    }

    const problem = problemWithAssessment(parsed, assessmentId)
    if (problem) return { error: `${problem} (analysis/result-${id}.assessments/${file})` }

    const assessment = parsed as AssessmentFile
    arrived.push(assessmentId)
    sections.push(assessment.section)
    used.push(...assessment.used)
  }

  const missing = manifest.filter((a) => !arrived.includes(a.id))
  const draft: AnalysisDraft = {
    by: 'claude-code-session',
    used: [...new Set(used)],
    sections
  }
  return { draft, arrived, missing }
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
        /**
         * Every send runs.
         *
         * A standing report used to be served back from a cache keyed on the
         * record and the prompt, so that a reload did not queue a duplicate of
         * the report that fired automatically on arrival. Nothing fires on
         * arrival any more — a run happens because someone pressed send — and
         * the cache's only remaining effect was to make pressing send a second
         * time do nothing at all.
         */
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

        /**
         * A re-run of the same briefs replays the report we already have.
         *
         * Nothing about the answer would differ, and waiting several minutes to
         * be told the same thing is not a demonstration of anything. Edit a
         * brief and the fingerprint moves, so the run goes to the session for a
         * genuinely new answer — which is what editing one is for.
         */
        const held = readReports()[reportKey(request.business.name)] as
          | { brief?: string; report?: AnalysisResult }
          | undefined
        if (held?.report && held.brief === briefPrint(request)) {
          writeFileSync(
            join(DIR, `replay-${id}.json`),
            JSON.stringify({ at: Date.now(), report: held.report }, null, 2)
          )
        }

        // The directory exists from the start, so "no files yet" is a run that
        // has been asked for, not one that was never queued.
        const assessments = request.assessments ?? []
        mkdirSync(draftDir(id), { recursive: true })

        server.config.logger.info(
          [
            '',
            `  ▶ analysis requested — ${request.business.name}`,
            `    ${request.insights.length} insights${request.pinned?.length ? `, ${request.pinned.length} pinned` : ''}`,
            ...(request.attachments?.length
              ? [`    ${request.attachments.length} attachment(s) in prototype/analysis/attachments/${id}/`]
              : []),
            `    read  prototype/analysis/pending.json`,
            ...(assessments.length
              ? [
                  '',
                  `    ${assessments.length} assessments — work these AT THE SAME TIME, one subagent each:`,
                  ...assessments.map(
                    (a) => `      ${a.name} → prototype/analysis/result-${id}.assessments/${a.id}.json`
                  ),
                  '',
                  `    then, once every one of them has landed:`,
                  `      the recommendation → prototype/analysis/result-${id}.json`
                ]
              : [`    write prototype/analysis/result-${id}.json`]),
            ''
          ].join('\n')
        )
        res.end(JSON.stringify({ id }))
        return
      }

      // Poll for the session's answer, which arrives in two stages.
      if (req.method === 'GET') {
        const params = new URL(url, 'http://localhost').searchParams
        const id = params.get('id')

        /**
         * No id: the page is asking what it already knows about this business.
         *
         * Arriving at a record used to show nothing until someone pressed send,
         * even when a report had been written minutes earlier — the result lived
         * in React state and a reload threw it away. The last completed run is
         * served back here so the work survives the tab.
         */
        if (!id) {
          const name = params.get('name') ?? ''
          // The store keeps the briefs beside the report so a re-run can tell
          // whether they moved; the page only wants the report.
          const held = name
            ? (readReports()[reportKey(name)] as
                | { report?: AnalysisResult; policy?: Array<{ id: string; name: string }> }
                | undefined)
            : undefined
          res.end(
            JSON.stringify({ stored: held?.report ?? null, policy: held?.policy ?? [] })
          )
          return
        }

        const fail = (error: string) => {
          res.statusCode = 422
          res.end(JSON.stringify({ error }))
        }

        // The manifest says what this run is composed of. Without it there is no
        // way to tell an assessment still being worked from one never written.
        const requestPath = join(DIR, `request-${id}.json`)
        if (!existsSync(requestPath)) {
          res.end(JSON.stringify({ pending: true }))
          return
        }
        // The whole request, not just the manifest: completing a run also has
        // to know which business to file the report under, and what briefs it
        // was written against.
        let asked: AnalysisRequest
        try {
          asked = JSON.parse(readFileSync(requestPath, 'utf8')) as AnalysisRequest
        } catch {
          res.end(JSON.stringify({ pending: true }))
          return
        }
        const manifest = asked.assessments ?? []

        /**
         * A replay reveals itself at the pace a run would.
         *
         * Handing the whole report back on the first poll would be correct and
         * would read as a cache — the sections are meant to arrive, and the
         * arriving is most of what the screen is for. One section per beat, the
         * verdict after the last of them, which is the shape of a real run.
         */
        const replayPath = join(DIR, `replay-${id}.json`)
        if (existsSync(replayPath)) {
          try {
            const { at, report } = JSON.parse(readFileSync(replayPath, 'utf8')) as {
              at: number
              report: AnalysisResult
            }
            const BEAT = 900
            const body = report.sections.filter((x) => x.id !== 'recommendation')
            // `1 +` so the first section is there on the first poll. Counting
            // from zero meant a beat of nothing, and with the poll interval on
            // top the page sat empty for two and a half seconds before anything
            // happened — which reads as broken rather than as working.
            const shown = Math.min(body.length, 1 + Math.floor((Date.now() - at) / BEAT))
            const arrived = body.slice(0, shown).map((x) => x.id)

            if (shown < body.length || Date.now() - at < BEAT * (body.length + 1)) {
              res.end(
                JSON.stringify({
                  stage: 'assessments',
                  draft: { by: report.by, used: report.used, sections: body.slice(0, shown) },
                  arrived
                })
              )
              return
            }
            res.end(JSON.stringify(report))
            return
          } catch {
            // A replay that will not parse is simply not a replay; fall through
            // to the ordinary handoff rather than failing the run.
          }
        }

        const collected = collect(id, manifest)
        if ('error' in collected) return fail(collected.error)
        const { draft, arrived, missing } = collected

        const verdictPath = join(DIR, `result-${id}.json`)
        let rawVerdict: unknown
        if (existsSync(verdictPath)) {
          try {
            rawVerdict = JSON.parse(readFileSync(verdictPath, 'utf8'))
          } catch {
            rawVerdict = undefined // mid-write
          }
        }

        // Assessments still landing. The UI renders the ones that have and keeps
        // waiting — the sequence being visible rather than asserted. `arrived`
        // is what lights each step, so a slow assessment holds only its own row.
        if (rawVerdict === undefined || missing.length > 0) {
          if (rawVerdict !== undefined && missing.length > 0) {
            // A verdict against an incomplete report is the failure this product
            // exists to prevent. Name what is absent rather than serve it.
            return fail(
              `The recommendation is written but ${missing.length} assessment(s) never landed: ${missing
                .map((a) => `\`${a.name}\``)
                .join(', ')}. A recommendation may only be written once every assessment it rests on is on disk.`
            )
          }
          res.end(JSON.stringify({ stage: 'assessments', draft, arrived }))
          return
        }

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
        // Written on completion, not on demand: the moment a report is whole is
        // the only moment we can be sure it is worth keeping.
        keepReport(
          asked.business?.name ?? '',
          merged,
          briefPrint(asked),
          (asked.assessments ?? []).map(({ id, name }) => ({ id, name }))
        )

        res.end(JSON.stringify(merged))
        return
      }

      next()
    })
  }
})
