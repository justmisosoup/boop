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
  AssessmentSection,
  StoredReport
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
 * same company mints a new id every time.
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

/** Every business's report, keyed by name. */
const readReports = (): Record<string, StoredReport[]> => {
  if (!existsSync(REPORTS)) return {}
  try {
    return (JSON.parse(readFileSync(REPORTS, 'utf8')) as { reports?: Record<string, StoredReport[]> }).reports ?? {}
  } catch {
    return {}
  }
}

/** The one a re-run is compared against, and the one the page opens on. */
const newestReport = (key: string): StoredReport | null => {
  const list = readReports()[key] ?? []
  return list.length > 0 ? list[list.length - 1] : null
}

/** What the page was reading when the run was asked, kept beside the run. */
const snapshotPath = (id: string) => join(DIR, `snapshot-${id}.json`)

const readSnapshot = (id: string): StoredReport['snapshot'] => {
  if (!existsSync(snapshotPath(id))) return null
  try {
    return JSON.parse(readFileSync(snapshotPath(id), 'utf8')) as StoredReport['snapshot']
  } catch {
    return null
  }
}

const STORE_COMMENT =
  'One report per business, keyed by name: what it concluded and the snapshot it read. A new run replaces it; git keeps the history. Written when a run completes.'

/**
 * One report per business.
 *
 * A finished report replaces the business's report — the page shows one, and
 * older runs are git's history, not the bundle's. A question is filed INTO the
 * report it was asked of: it was answered against that report's snapshot, and
 * it belongs with it. (Before the `kind` branch, a typed follow-up overwrote
 * the business's report with a single `answer` section and an empty policy.)
 */
const keepReport = (asked: AnalysisRequest, report: AnalysisResult) => {
  const key = reportKey(asked.business?.name ?? '')
  if (!key) return
  try {
    const store = readReports()
    const list = [...(store[key] ?? [])]

    if (asked.kind === 'question') {
      const at = list.findIndex((r) => r.id === asked.reportId)
      // A question against a report we do not hold has nowhere to go. Dropping
      // it is better than inventing a report around it.
      if (at === -1) return
      // Filed once. The page polls until the answer lands and any poll after
      // that — or a second reader of the same id — would file it again.
      if (list[at].questions.some((q) => q.id === asked.id)) return
      list[at] = {
        ...list[at],
        questions: [
          ...list[at].questions,
          {
            id: asked.id,
            at: asked.requestedAt,
            prompt: asked.prompt,
            typed: asked.typed,
            skills: asked.skills,
            threadId: asked.threadId,
            result: report
          }
        ]
      }
    } else {
      list.splice(0, list.length, {
        id: asked.id,
        name: asked.skills?.[0] ?? 'Assessment',
        at: asked.requestedAt,
        brief: briefPrint(asked),
        policy: (asked.assessments ?? []).map(({ id, name }) => ({ id, name })),
        report,
        snapshot: readSnapshot(asked.id),
        questions: []
      })
    }

    // Unindented: with a snapshot on every report this is not a file anyone
    // reads by hand, and indentation roughly doubles it.
    writeFileSync(
      REPORTS,
      JSON.stringify({ _comment: STORE_COMMENT, version: 2, reports: { ...store, [key]: list } })
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

/** A cited id reads by its key: `license:npi-…` is `license`. */
const keyOf = (id: string) => id.split(':')[0]

/**
 * A section may cite only the insights its assessment reads.
 *
 * A card shows every row its section cites, so a citation is a claim that the
 * row is evidence for that area's question. `name` cited under Activity &
 * Permission, because a sentence mentioned the name, put "Match identified to
 * the submitted business name" on a card about the line of work. The scope is
 * the assessment's own, from the manifest; a request written before scopes
 * existed carries none and is not checked.
 */
const outsideScope = (a: AssessmentFile, scope?: string[]): string[] => {
  if (!scope) return []
  const allowed = new Set(scope)
  const cited = [
    ...a.used,
    ...a.section.body.flatMap((b) => b.cites ?? []),
    ...(a.section.gaps ?? []).flatMap((g) => g.cites ?? [])
  ]
  return [...new Set(cited.filter((id) => !allowed.has(keyOf(id))))]
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

  for (const { id: assessmentId, name, insightIds } of manifest) {
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
    const reaching = outsideScope(assessment, insightIds)
    if (reaching.length > 0)
      return {
        error: `\`${name}\` cites ${reaching.join(', ')}, which it does not read. A card shows every row its section cites, so an assessment may cite only its own insights: ${insightIds!.join(', ')}. (analysis/result-${id}.assessments/${file})`
      }
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

/**
 * A typed question's answer file: `{ headline, answer, followUps?, suggestions? }`.
 *
 * `answer` is the one section (README: id `answer`); `recommendation` is
 * accepted in its place for a file written to the report's shape.
 */
type QuestionAnswer = {
  headline: string
  answer?: AssessmentSection
  recommendation?: AssessmentSection
  followUps?: AnalysisVerdict['followUps']
  suggestions?: string[]
}

const problemWithAnswer = (value: unknown, asked: AnalysisRequest): string | null => {
  if (!value || typeof value !== 'object') return 'Answer file is not an object.'
  const v = value as Partial<QuestionAnswer>
  if (typeof v.headline !== 'string' || !v.headline.trim()) return 'Answer is missing `headline`.'
  const section = v.answer ?? v.recommendation
  if (!section || !Array.isArray(section.body)) return 'Answer is missing an `answer` section with `body`.'
  const known = new Set(asked.insights.map((i) => i.id))
  const reaching = [...citesOf([section])].filter((id) => !known.has(id))
  if (reaching.length > 0)
    return `The answer cites ${reaching.join(', ')}, which is not on this record. An answer may only cite the insights it was given.`
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

        /**
         * The snapshot goes to a file of its own, like an attachment.
         *
         * It is the record and every insight derived from it — 60KB the session
         * already has in `insights`, and `pending.json` is a file a session
         * reads by hand. It is read back when the report is kept.
         */
        const { snapshot, ...asked } = body
        if (snapshot) writeFileSync(snapshotPath(id), JSON.stringify(snapshot))

        const request: AnalysisRequest = {
          id,
          requestedAt: new Date().toISOString(),
          ...asked,
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
        const held = newestReport(reportKey(request.business.name))
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
            `    ${request.insights.length} insights`,
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

        // The page reads its report from the bundle; this answers runs only.
        if (!id) {
          res.statusCode = 400
          res.end(JSON.stringify({ error: 'An id is required.' }))
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

        /**
         * A question is answered whole, in one section.
         *
         * It has no assessments, so the report's rule — a verdict may only
         * cite what an assessment discussed — has nothing to check against and
         * refused every citation. A question's answer may cite any insight the
         * request carried: those are what it was asked to read.
         */
        if (asked.kind === 'question') {
          const problem = problemWithAnswer(rawVerdict, asked)
          if (problem) return fail(`${problem} (analysis/result-${id}.json)`)
          const answer = rawVerdict as QuestionAnswer
          const section: AssessmentSection = { ...(answer.answer ?? answer.recommendation!), id: 'answer' }
          const merged: AnalysisResult = {
            by: 'claude-code-session',
            used: [...new Set(citesOf([section]))],
            headline: answer.headline,
            sections: [section],
            followUps: answer.followUps ?? [],
            ...(Array.isArray(answer.suggestions) ? { suggestions: answer.suggestions } : {})
          }
          keepReport(asked, merged)
          res.end(JSON.stringify(merged))
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
          followUps: verdict.followUps,
          // What to ask next, when the session offered it. Optional, so an
          // older result without it still merges.
          ...(Array.isArray(verdict.suggestions) ? { suggestions: verdict.suggestions } : {})
        }
        // Written on completion, not on demand: the moment a report is whole is
        // the only moment we can be sure it is worth keeping.
        keepReport(asked, merged)

        res.end(JSON.stringify(merged))
        return
      }

      next()
    })
  }
})
