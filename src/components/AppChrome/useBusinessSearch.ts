import { useEffect, useState } from 'react'

import { ALL } from '@/lib/records'

/** A single typeahead result, shaped like the app's `/autocomplete/search`. */
export type BusinessSearchResult = {
  id: string
  name: string
  tin?: string | null
  /** When the business was added — rendered as a relative "2 months ago". */
  created_date?: string | null
  status?: string | null
}

const DEBOUNCE_MS = 300
const MIN_CHARS = 2

/**
 * Live business search for the ⌘K palette.
 *
 * Ported from `app/src/components/AppChrome/useBusinessSearch.ts` with the
 * same contract — debounced, race-safe, `loading` set on the keystroke rather
 * than when the request fires, which is what makes the skeleton feel instant.
 * The app dispatches to `/autocomplete/search`; the prototype has no API, so
 * the same debounce runs over the 25 ingested records. Matching is on name,
 * as the autocomplete endpoint's is — a partial like "zend" finds "ZENDESK".
 */
export const useBusinessSearch = (query: string) => {
  const [results, setResults] = useState<BusinessSearchResult[]>([])
  const [loading, setLoading] = useState(false)

  const trimmed = query.trim()

  useEffect(() => {
    if (trimmed.length < MIN_CHARS) {
      setResults([])
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)

    const timer = setTimeout(() => {
      if (!active) return
      const q = trimmed.toLowerCase()
      setResults(
        ALL.filter((record) => record.name.toLowerCase().includes(q)).map(
          (record) => ({
            id: record.id,
            name: record.name,
            created_date: record.createdAt,
            status: record.status
          })
        )
      )
      setLoading(false)
    }, DEBOUNCE_MS)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [trimmed])

  return { loading, results }
}
