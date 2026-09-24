import type { Derived } from './deriveResults'

/**
 * What changed between two readings of one business.
 *
 * A report is a snapshot; the identity moves on. The difference is what a
 * reviewer opening an old report needs to know before they trust it, and what
 * the reports menu says about a re-run. Compared by insight id, on the things
 * a row shows — state, statement, reason — so a change in wording that says
 * the same thing still counts, because the reviewer would read it as one.
 */
export type InsightChange = {
  id: string
  kind: 'added' | 'removed' | 'changed'
  before?: Derived
  after?: Derived
}

const shown = (r: Derived) => `${r.state}|${r.statement}|${r.reason ?? ''}|${r.because ?? ''}`

export const changedInsights = (
  before: Derived[] | undefined | null,
  after: Derived[] | undefined | null
): InsightChange[] => {
  if (!before || !after) return []
  const a = new Map(before.filter((r) => !r.notReported).map((r) => [r.insightId, r]))
  const b = new Map(after.filter((r) => !r.notReported).map((r) => [r.insightId, r]))
  const out: InsightChange[] = []
  for (const [id, r] of b) {
    const p = a.get(id)
    if (!p) out.push({ id, kind: 'added', after: r })
    else if (shown(p) !== shown(r)) out.push({ id, kind: 'changed', before: p, after: r })
  }
  for (const [id, r] of a) if (!b.has(id)) out.push({ id, kind: 'removed', before: r })
  return out
}
