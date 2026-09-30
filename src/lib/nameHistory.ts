import timeline from '../data/timeline.json'
import type { BusinessRecord } from './deriveResults'
import { sameName } from './registrationStatus'

type NameEvent = {
  id: string
  type: string
  occurred_at: string
  data: { object: { name?: string; sources?: Array<{ type?: string; metadata?: { state?: string; file_number?: string } }> } }
}

const EVENTS = (timeline as unknown as { byBusiness: Record<string, NameEvent[]> }).byBusiness

/**
 * The names the business's filings have dropped, newest first, from the
 * business timeline: Sprig's California filing was USERLEAP INC until the
 * timeline recorded its change in October 2021. Any of its filings, but only a
 * name none of them — nor the record — still carries: a name dropped and put
 * back, or dropped on one filing and kept on another, is not a former name.
 */
export const priorNamesOf = (record: BusinessRecord): Array<{ name: string; at: string; eventId: string }> => {
  const current = [...record.registrations.map((r) => r.name), ...(record.names ?? []).map((n) => n.name)]
  const out: Array<{ name: string; at: string; eventId: string }> = []
  for (const e of EVENTS[record.id] ?? []) {
    if (e.type !== 'name.deleted') continue
    if (!(e.data.object.sources ?? []).some((x) => x.type === 'registration')) continue
    const name = e.data.object.name
    if (!name || current.some((c) => sameName(c, name))) continue
    const seen = out.find((o) => sameName(o.name, name))
    // The latest time it was dropped.
    if (seen) {
      if (e.occurred_at > seen.at) Object.assign(seen, { at: e.occurred_at, eventId: e.id })
      continue
    }
    out.push({ name, at: e.occurred_at, eventId: e.id })
  }
  return out.sort((a, b) => b.at.localeCompare(a.at))
}
