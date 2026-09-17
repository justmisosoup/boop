import { useEffect, useState } from 'react'

/**
 * Who is signed in.
 *
 * There is no auth in the prototype, so this stands in for the session. It is
 * here rather than inline so that the one place authorship comes from is
 * obvious when a real session replaces it.
 */
export const CURRENT_USER = 'Sara Menefee'

/** "just now", "1 min ago", "2 hours ago", "3 days ago". */
export const ago = (iso?: string) => {
  if (!iso) return 'never'
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

/**
 * Who owns a skill and when it last changed — "Sara Menefee · Updated 1 min
 * ago".
 *
 * One line for both, because they answer the same question: whose is this and
 * is it current. `editedAt` when there is one, else when it was written.
 */
export const authorLine = (skill: {
  createdBy?: string
  createdAt: string
  editedAt?: string
}) => `${skill.createdBy ?? 'Unknown'} · Updated ${ago(skill.editedAt ?? skill.createdAt)}`

/**
 * Re-renders on a timer so a relative time stays true.
 *
 * `ago()` is computed at render, so without this a label written "just now"
 * still said "just now" ten minutes later — the one thing a timestamp exists
 * to rule out. Thirty seconds is fine for a scale that counts in minutes.
 */
export const useTicking = (intervalMs = 30_000) => {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
}
