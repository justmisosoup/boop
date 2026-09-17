import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import type { Plugin } from 'vite'

/**
 * The customer's assessments, on disk.
 *
 * Holds what they have written: the assessment that runs and the parts under
 * it. Middesk's own skills are not here
 * — they are defaults in the source, selectable and not editable, and a
 * customer's file can neither shadow nor remove one.
 *
 * Absent until something is saved, so the file existing means someone changed
 * something rather than that the app has run.
 */
const DIR = join(process.cwd(), 'analysis')
const FILE = join(DIR, 'agent.json')

type Skill = {
  id: string
  name: string
  instructions: string
  kind?: 'workflow' | 'context'
  createdBy?: string
  combines?: string[]
  history?: Array<{ at: string; by?: string }>
  createdAt: string
  editedAt?: string
}

type Stored = {
  skills: Skill[]
  /** The starter workflow has been offered once. */
  seeded?: boolean
  /** Assessment ids turned off. One list for both kinds, because a Middesk
   *  default is not in `skills` and still has to be switchable. */
  disabled?: string[]
}

const EMPTY: Stored = { skills: [] }

const read = (): Stored => {
  if (!existsSync(FILE)) return EMPTY
  try {
    const parsed = JSON.parse(readFileSync(FILE, 'utf8')) as Partial<Stored>
    return {
      seeded: parsed.seeded,
      disabled: Array.isArray(parsed.disabled) ? parsed.disabled : [],
      skills: Array.isArray(parsed.skills) ? parsed.skills : []
    }
  } catch {
    // A hand-edited file that no longer parses falls back to empty rather than
    // breaking every run on the machine.
    return EMPTY
  }
}

const write = (next: Stored) => {
  mkdirSync(DIR, { recursive: true })
  writeFileSync(FILE, JSON.stringify(next, null, 2))
}

export const skillsPlugin = (): Plugin => ({
  name: 'agent-personalization',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (!(req.url ?? '').startsWith('/api/agent')) return next()
      res.setHeader('Content-Type', 'application/json')

      if (req.method === 'GET') return res.end(JSON.stringify(read()))

      if (req.method === 'PUT') {
        const chunks: Buffer[] = []
        for await (const c of req) chunks.push(c as Buffer)
        const body = JSON.parse(Buffer.concat(chunks).toString()) as Partial<Stored>
        const current = read()
        const stored: Stored = {
          seeded: body.seeded ?? current.seeded,
          disabled: body.disabled ?? current.disabled,
          skills: body.skills ?? current.skills
        }
        write(stored)
        server.config.logger.info('  ✎ agent personalization saved — analysis/agent.json')
        return res.end(JSON.stringify(stored))
      }

      next()
    })
  }
})
