import { useSyncExternalStore } from 'react'

/**
 * A small keyed store that survives a reload.
 *
 * What a reviewer does on this prototype — records a decision, orders a check —
 * is not on the record and must not be written into `records.json`, which
 * `bun run pull` rewrites wholesale. It is kept in the browser instead, under
 * one key per store, and read through `useSyncExternalStore` so every view of
 * it — the card, the list — updates in the same render.
 */
export const createLocalStore = <T,>(key: string) => {
  const read = (): Record<string, T> => {
    try {
      return JSON.parse(window.localStorage.getItem(key) ?? '{}') as Record<string, T>
    } catch {
      return {}
    }
  }
  let state: Record<string, T> = typeof window === 'undefined' ? {} : read()
  const listeners = new Set<() => void>()
  const emit = () => {
    try {
      window.localStorage.setItem(key, JSON.stringify(state))
    } catch {
      // A private window or blocked storage: the store still works for the session.
    }
    listeners.forEach((l) => l())
  }
  const subscribe = (l: () => void) => {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }
  const snapshot = () => state

  return {
    /** Every entry, reactively. */
    useAll: () => useSyncExternalStore(subscribe, snapshot, snapshot),
    get: (id: string): T | null => state[id] ?? null,
    set: (id: string, value: T) => {
      state = { ...state, [id]: value }
      emit()
    },
    remove: (id: string) => {
      const next = { ...state }
      delete next[id]
      state = next
      emit()
    }
  }
}
