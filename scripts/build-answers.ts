/**
 * Assembles `analysis/answers.json` — the assistant's stored answers to its
 * starter questions, one set per business — from the session's
 * `analysis/questions/<key>.answers.json` files.
 *
 * Validated the way the endpoint validates a live answer: every starter
 * present, a headline, a non-empty body, and every cite an insight the record
 * actually reported (`<key>.json`, written by `scripts/export-questions.ts`).
 * A bad file fails the build by name rather than shipping a chip that opens
 * on nothing.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { STARTERS } from '../src/components/Assistant/starters'
import type { AnalysisResult, AssessmentSection } from '../src/types'

const DIR = join(import.meta.dir, '..', 'analysis', 'questions')
const OUT = join(import.meta.dir, '..', 'analysis', 'answers.json')

type Answer = {
  headline: string
  answer: AssessmentSection
  followUps?: AnalysisResult['followUps']
}

export type StoredAnswer = {
  question: string
  durationMs: number
  at: string
  result: AnalysisResult
}

const problems: string[] = []
const answers: Record<string, Record<string, StoredAnswer>> = {}

const files = readdirSync(DIR).filter((f) => f.endsWith('.answers.json'))
for (const file of files) {
  const key = file.replace(/\.answers\.json$/, '')
  const questionsPath = join(DIR, `${key}.json`)
  if (!existsSync(questionsPath)) {
    problems.push(`${file}: no ${key}.json beside it (run \`bun run questions\`).`)
    continue
  }
  const asked = JSON.parse(readFileSync(questionsPath, 'utf8')) as {
    insights: Array<{ id: string }>
    report: { at: string }
  }
  const known = new Set(asked.insights.map((i) => i.id))

  let parsed: Record<string, Answer>
  try {
    parsed = JSON.parse(readFileSync(join(DIR, file), 'utf8'))
  } catch (e) {
    problems.push(`${file}: not valid JSON (${e instanceof Error ? e.message : String(e)}).`)
    continue
  }

  const set: Record<string, StoredAnswer> = {}
  for (const starter of STARTERS) {
    const a = parsed[starter.id]
    if (!a) {
      problems.push(`${file}: missing \`${starter.id}\`.`)
      continue
    }
    if (typeof a.headline !== 'string' || !a.headline.trim()) problems.push(`${file} ${starter.id}: missing headline.`)
    const body = a.answer?.body
    if (!Array.isArray(body) || body.length === 0 || body.some((b) => typeof b.text !== 'string' || !b.text.trim())) {
      problems.push(`${file} ${starter.id}: \`answer.body\` must be one or more paragraphs with text.`)
      continue
    }
    const cites = body.flatMap((b) => b.cites ?? [])
    const reaching = [...new Set(cites.filter((c) => !known.has(c)))]
    if (reaching.length > 0)
      problems.push(`${file} ${starter.id}: cites ${reaching.join(', ')}, which this record did not report.`)

    set[starter.id] = {
      question: starter.label,
      // A written answer takes a moment to read as one: the panel shows the
      // working turn for this long before the answer lands.
      durationMs: 1800,
      at: asked.report.at,
      result: {
        by: 'claude-code-session',
        used: [...new Set(cites)],
        headline: a.headline,
        sections: [{ ...a.answer, id: 'answer' }],
        followUps: a.followUps ?? []
      }
    }
  }
  answers[key] = set
}

if (problems.length > 0) {
  console.error(problems.map((p) => `  ✗ ${p}`).join('\n'))
  process.exit(1)
}

writeFileSync(
  OUT,
  JSON.stringify(
    {
      _comment:
        'The assistant’s answers to its starter questions, one set per business, keyed by name like reports.json. Written by scripts/build-answers.ts from analysis/questions/*.answers.json; served by src/lib/heldAnswers.ts.',
      version: 1,
      answers
    },
    null,
    0
  )
)

const count = Object.values(answers).reduce((n, set) => n + Object.keys(set).length, 0)
console.log(`answers.json: ${Object.keys(answers).length} businesses, ${count} answers`)
