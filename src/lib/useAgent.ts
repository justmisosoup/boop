import { useCallback, useEffect, useState } from 'react'

import agentStore from '../../analysis/agent.json'

import type { AssessmentWeight } from './identityScore'
import { SEED_WORKFLOW } from './library'
import { CURRENT_USER } from './user'

export type CustomerSkill = {
  id: string
  name: string
  instructions: string
  /**
   * Three things, not two.
   *
   * `workflow` is the assessment everything else hangs under. `assessment` is
   * one part of the file it builds. `context` is grounding — what to read the
   * record as — and is the customer's counterpart to Middesk's own.
   */
  kind: 'workflow' | 'assessment' | 'context'
  /**
   * How much the assessment counts, in the one-pager's two words.
   *
   * Identity, Ownership & Control and Compliance Screenings are critical;
   * Activity & Permission is high. Absent on a workflow, and on anything
   * written before this existed, which the score reads as critical.
   */
  weight?: AssessmentWeight
  /** Who wrote it. Absent on anything seeded before this was recorded. */
  createdBy?: string
  /**
   * Other assessments this one runs with.
   *
   * Layering rather than nesting: an assessment that needs another's grounding
   * says so here, and both sets of instructions are sent together. Ids, so a
   * rename does not break the link.
   */
  combines?: string[]
  /**
   * One entry per save, oldest first.
   *
   * No version number: versions are Middesk's, and a customer's skill is not
   * released — it is just edited. What a reader asks of one is when it last
   * changed and when it changed before that, which is what this answers. The
   * text of earlier versions is NOT kept.
   */
  history?: Array<{ at: string; by?: string }>
  createdAt: string
  editedAt?: string
}

type Agent = {
  skills: CustomerSkill[]
  /** The seed has been offered once. Deleting it must not bring it back. */
  seeded?: boolean
  /** Assessment ids turned off — Middesk's defaults included, which is why it
   *  is a list of ids rather than a flag on each skill. */
  disabled?: string[]
}

/**
 * The customer's assessments.
 *
 * Middesk's own skills are not here — they are defaults in the source,
 * selectable and not editable. This holds only what the customer owns, which is
 * why everything in it can be changed and nothing in `library.ts` can.
 */
/**
 * The workflow and its assessments, as written to disk.
 *
 * `/api/agent` is dev-server middleware, so a built copy has no endpoint to ask
 * and the fetch below fails into its own catch. That left a deployed prototype
 * with NO skills at all: no workflow on the composer, no assessment
 * instructions, and `standing` undefined, so the page could not say what it had
 * been analysed with. The file is the record; it is bundled as well as served.
 */
const BUNDLED_AGENT: Agent = {
  seeded: (agentStore as Agent).seeded,
  skills: ((agentStore as Agent).skills ?? []).map((x) =>
    x.kind === 'context' ? { ...x, kind: 'assessment' as const } : x
  ),
  disabled: (agentStore as Agent).disabled ?? []
}

export const useAgent = () => {
  // On screen from the first paint, and replaced by the endpoint's copy
  // wherever there is one to ask.
  const [agent, setAgent] = useState<Agent>(BUNDLED_AGENT)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let live = true
    void fetch('/api/agent')
      .then((r) => r.json())
      .then((d: Agent) => {
        if (!live) return
        // A new customer starts with the account-opening workflow written for
        // them — theirs from the first render, not a Middesk default they are
        // stuck with. Seeded once: deleting it is a decision, not a glitch.
        if (!d.seeded && (d.skills ?? []).length === 0) {
          const seeded: Agent = {
            seeded: true,
            skills: [
              {
                id: SEED_WORKFLOW.id,
                name: SEED_WORKFLOW.name,
                instructions: SEED_WORKFLOW.instructions,
                kind: 'workflow',
                // Theirs from the first render — the account-opening policy
                // is the customer's decision, and the starter is a draft of it
                // rather than something of ours they are borrowing.
                createdBy: CURRENT_USER,
                createdAt: new Date().toISOString(),
                history: [{ at: new Date().toISOString(), by: CURRENT_USER }]
              }
            ]
          }
          setAgent(seeded)
          void fetch('/api/agent', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(seeded)
          })
          return
        }
        setAgent({
          // Everything written before contexts existed was an assessment.
          skills: (d.skills ?? []).map((x) =>
            x.kind === 'context' ? { ...x, kind: 'assessment' as const } : x
          ),
          seeded: d.seeded,
          disabled: d.disabled ?? []
        })
      })
      // An unreachable endpoint means no personalization, not a broken app.
      .catch(() => undefined)
      .finally(() => live && setReady(true))
    return () => {
      live = false
    }
  }, [])

  const put = useCallback(async (next: Partial<Agent>) => {
    const r = await fetch('/api/agent', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next)
    })
    if (!r.ok) return false
    setAgent((await r.json()) as Agent)
    return true
  }, [])


  const createSkill = useCallback(
    (name: string, instructions: string, kind: 'assessment' | 'context' = 'assessment') =>
      put({
        skills: [
          ...agent.skills,
          {
            id: `skill-${Date.now()}`,
            name: name.trim(),
            instructions: instructions.trim(),
            kind,
            createdBy: CURRENT_USER,
            createdAt: new Date().toISOString(),
            history: [{ at: new Date().toISOString(), by: CURRENT_USER }]
          }
        ]
      }),
    [agent.skills, put]
  )

  const updateSkill = useCallback(
    (id: string, name: string, instructions: string, combines?: string[]) =>
      put({
        skills: agent.skills.map((s) => {
          if (s.id !== id) return s
          const at = new Date().toISOString()
          return {
            ...s,
            name: name.trim(),
            instructions: instructions.trim(),
            combines: combines ?? s.combines,
            editedAt: at,
            history: [...(s.history ?? []), { at, by: CURRENT_USER }]
          }
        })
      }),
    [agent.skills, put]
  )

  const deleteSkill = useCallback(
    (id: string) => put({ skills: agent.skills.filter((s) => s.id !== id) }),
    [agent.skills, put]
  )

  /** Turn one on or off. Off means it is not offered in the composer. */
  const setEnabled = useCallback(
    (id: string, on: boolean) =>
      put({
        disabled: on
          ? (agent.disabled ?? []).filter((x) => x !== id)
          : [...new Set([...(agent.disabled ?? []), id])]
      }),
    [agent.disabled, put]
  )

  return { ...agent, ready, createSkill, updateSkill, deleteSkill, setEnabled }
}
