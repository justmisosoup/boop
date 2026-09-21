import { useCallback, useEffect, useRef, useState } from 'react'

export type RecentBusiness = { id: string; name: string }

const STORAGE_KEY_PREFIX = 'middesk:recent-businesses'
const MAX_RECENTS = 5

const storageKey = (accountId?: string) =>
  accountId ? `${STORAGE_KEY_PREFIX}:${accountId}` : STORAGE_KEY_PREFIX

const read = (accountId?: string): RecentBusiness[] => {
  try {
    const raw = localStorage.getItem(storageKey(accountId))
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed)
      ? parsed.filter(item => item?.id && item?.name).slice(0, MAX_RECENTS)
      : []
  } catch {
    return []
  }
}

/**
 * A small localStorage-backed ring of the businesses a user has recently opened
 * — used to populate the ⌘K palette's empty state so it's a useful launcher,
 * not a blank box. `record` is referentially stable (safe as a dep); call it
 * whenever a business detail loads (most-recent-first, de-duped, capped).
 * Survives reloads, scoped per account per browser.
 */
export const useRecentlyViewedBusinesses = (accountId?: string) => {
  const [recents, setRecents] = useState<RecentBusiness[]>(() =>
    read(accountId)
  )

  const accountIdRef = useRef(accountId)
  useEffect(() => {
    accountIdRef.current = accountId
    setRecents(read(accountId))
  }, [accountId])

  const record = useCallback((business: RecentBusiness) => {
    if (!business.id || !business.name) return
    setRecents(previous => {
      const next = [
        { id: business.id, name: business.name },
        ...previous.filter(item => item.id !== business.id)
      ].slice(0, MAX_RECENTS)
      try {
        localStorage.setItem(
          storageKey(accountIdRef.current),
          JSON.stringify(next)
        )
      } catch {
        // Non-fatal: recents are a convenience, not a source of truth.
      }
      return next
    })
  }, [])

  return { recents, record }
}
