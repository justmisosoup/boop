import timeline from '../data/timeline.json'
import type { BusinessRecord } from './deriveResults'

type NameEvent = {
  id: string
  type: string
  occurred_at: string
  data: { object: { name?: string; sources?: Array<{ type?: string; metadata?: { state?: string; file_number?: string } }> } }
}

const EVENTS = (timeline as unknown as { byBusiness: Record<string, NameEvent[]> }).byBusiness

/**
 * Every name change the business timeline records on the business's filings,
 * newest first — one per change, as the timeline lists them: the name the
 * filing dropped, in which state, and when. Sprig's California filing dropped
 * USERLEAP INC in October 2021; Change.org's filings made four changes across
 * California, New York and D.C.
 */
export const priorNamesOf = (
  record: BusinessRecord
): Array<{ name: string; state?: string; at: string; eventId: string }> =>
  (EVENTS[record.id] ?? [])
    .filter((e) => e.type === 'name.deleted' && e.data.object.name)
    .flatMap((e) => {
      const filing = (e.data.object.sources ?? []).find((x) => x.type === 'registration')
      return filing
        ? [{ name: e.data.object.name as string, state: filing.metadata?.state, at: e.occurred_at, eventId: e.id }]
        : []
    })
    .sort((a, b) => b.at.localeCompare(a.at))
