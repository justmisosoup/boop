import type { ChatThinkingStep } from '@/core'

/**
 * What a run works through, as the thinking block lists it.
 *
 * Four steps, the way Kha's assistant names them, each true of this pipeline:
 * the report is read from the snapshot, the insights are handed to the session,
 * the session writes the answer, and the endpoint refuses a citation outside
 * the record before serving it (`scripts/analyse-endpoint.ts`). The durations
 * are the run's: everything but the writing is instant.
 */
export const stepsFor = (
  phase: 'working' | 'done' | 'failed',
  insightCount: number,
  durationMs: number
): ChatThinkingStep[] => {
  const done = phase === 'done'
  const failed = phase === 'failed'
  return [
    { id: 'read', label: 'Report read', description: '<1s', status: 'complete' },
    {
      id: 'insights',
      label: 'Insights organized',
      description: `${insightCount} insight${insightCount === 1 ? '' : 's'}`,
      status: 'complete'
    },
    {
      id: 'answer',
      label: 'Answer written',
      description: done ? formatDuration(durationMs) : undefined,
      status: done ? 'complete' : failed ? 'error' : 'active'
    },
    {
      id: 'cites',
      label: 'Citations checked',
      description: done ? '<1s' : undefined,
      status: done ? 'complete' : failed ? 'skipped' : 'pending'
    }
  ]
}

/** "28s", "1m 12s". Under a second reads as one. */
export const formatDuration = (ms: number) => {
  const s = Math.max(1, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rest = s % 60
  return rest === 0 ? `${m}m` : `${m}m ${rest}s`
}
