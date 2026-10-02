import { useEffect } from 'react'

import type { PortfolioAnswer } from '../types'
import { createLocalStore } from './localStore'
import { portfolioSnapshot } from './portfolio'

/** One question about the whole list, and its answer once it lands. */
export type PortfolioTurn = {
  id: string
  typed: string
  /** When it was asked. */
  at: string
  answer?: PortfolioAnswer
  answeredAt?: string
  error?: string
}

/** The list conversation, in this browser. One thread; "New conversation" clears it. */
const store = createLocalStore<PortfolioTurn[]>('prototype.portfolio.v1')
const THREAD = 'thread'

/** The brief a list question is answered under. The full spec is
 *  `analysis/README.md`, "List questions". */
const BRIEF = [
  'Answer a question about every business in the list, from the snapshot alone.',
  'Each paragraph cites the businesses it rests on by `id`. Name what you counted and how.',
  'Use the status words: Approve, Reject, Request information, Not assessed.'
].join(' ')

const turnsNow = () => store.get(THREAD) ?? []
const update = (id: string, patch: Partial<PortfolioTurn>) =>
  store.set(
    THREAD,
    turnsNow().map((t) => (t.id === id ? { ...t, ...patch } : t))
  )

/**
 * The Assistant on the businesses list: questions about every business at
 * once, answered by the session beside the prototype from a snapshot of the
 * list (`portfolioSnapshot`), polled until the answer lands.
 */
export const usePortfolioAssistant = () => {
  const turns = store.useAll()[THREAD] ?? []
  const pending = turns.find((t) => !t.answer && !t.error)

  const ask = async (typed: string) => {
    const at = new Date().toISOString()
    try {
      const r = await fetch('/api/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'portfolio', prompt: `${BRIEF}\n\n${typed}`, typed, businesses: portfolioSnapshot() })
      })
      const { id } = (await r.json()) as { id: string }
      store.set(THREAD, [...turnsNow(), { id, typed, at }])
    } catch {
      // No session to ask — the deployed build has no endpoint.
      store.set(THREAD, [
        ...turnsNow(),
        { id: `offline-${Date.now()}`, typed, at, error: 'The assistant is not connected here, so nothing can answer this.' }
      ])
    }
  }

  useEffect(() => {
    if (!pending) return
    const tick = async () => {
      try {
        const r = await fetch(`/api/analyse?id=${pending.id}`)
        const data = (await r.json()) as { pending?: true; portfolio?: PortfolioAnswer; error?: string }
        if (data.portfolio) update(pending.id, { answer: data.portfolio, answeredAt: new Date().toISOString() })
        else if (data.error) update(pending.id, { error: data.error })
      } catch {
        // The session may be mid-write; keep polling.
      }
    }
    const interval = setInterval(tick, 1500)
    void tick()
    return () => clearInterval(interval)
  }, [pending?.id])

  /** Ask a failed question again, in its place. */
  const retry = (id: string) => {
    const turn = turnsNow().find((t) => t.id === id)
    if (!turn) return
    store.set(
      THREAD,
      turnsNow().filter((t) => t.id !== id)
    )
    void ask(turn.typed)
  }

  return { turns, pending, ask, retry, clear: () => store.remove(THREAD) }
}
