import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  type AuthoredInsight,
  deleteInsight,
  loadInsights,
  saveInsight
} from './customInsights'
import { deriveAuthoredAll } from './deriveAuthored'
import type { BusinessRecord } from './deriveResults'

/**
 * The authored insights, and their results for one record.
 *
 * Loaded once and shared, so the Insights tab and the Catalog show the same
 * set — and so an insight written in either surface appears in both without a
 * reload.
 */
export const useAuthoredInsights = (record: BusinessRecord | undefined) => {
  const [insights, setInsights] = useState<AuthoredInsight[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let live = true
    loadInsights()
      .then((loaded) => live && setInsights(loaded))
      .catch((cause: Error) => live && setError(cause.message))

    return () => {
      live = false
    }
  }, [])

  const save = useCallback(async (insight: AuthoredInsight) => {
    setSaving(true)
    setError(null)
    try {
      setInsights(await saveInsight(insight))
    } catch (cause) {
      setError((cause as Error).message)
      throw cause
    } finally {
      setSaving(false)
    }
  }, [])

  const remove = useCallback(async (id: string) => {
    setError(null)
    try {
      setInsights(await deleteInsight(id))
    } catch (cause) {
      setError((cause as Error).message)
    }
  }, [])

  /** Run against the record, so authored rows sit beside the built-in ones. */
  const results = useMemo(
    () => deriveAuthoredAll(insights ?? [], record),
    [insights, record]
  )

  return { insights, results, error, saving, save, remove }
}
