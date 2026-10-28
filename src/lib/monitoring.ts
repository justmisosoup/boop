import { createLocalStore } from './localStore'

/**
 * Monitoring: an assessment re-run on a schedule, per business. Kept in the
 * browser — the reviewer's setting, not the record — by business and card.
 */
export type Cadence = 'realtime' | 'daily' | 'weekly' | 'monthly'

export const CADENCES: Array<{ id: Cadence; label: string }> = [
  { id: 'realtime', label: 'Real time' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' }
]

const store = createLocalStore<{ cadence: Cadence }>('prototype:monitoring')

export const monitorKey = (businessId: string, cardId: string) => `${businessId}:${cardId}`
export const useMonitoring = (key: string) => store.useAll()[key]?.cadence ?? null
export const setMonitoring = (key: string, cadence: Cadence | null) => (cadence ? store.set(key, { cadence }) : store.remove(key))
