import { useEffect, useState } from 'react'

import ledeStore from '../../analysis/ledes.json'

/**
 * The ledes written for this prototype, bundled.
 *
 * `/api/lede` is dev-server middleware and does not exist in a build, so a
 * deployed copy has to carry what was written rather than ask for it. The store
 * is keyed by business name because a re-pull mints new business ids.
 */
const BUNDLED: Record<string, { text?: string }> =
  (ledeStore as { ledes?: Record<string, { text?: string }> }).ledes ?? {}

const bundledLede = (name: string) =>
  BUNDLED[name.toLowerCase().replace(/\s+/g, ' ').trim()]?.text ?? null

/**
 * The business's own description, authored separately from any run.
 *
 * Nothing an assessment says can change it — it is not a section of a result,
 * it is a fact about the company that has to read the same whichever assessment
 * is running.
 */
export const useLede = (businessId: string, name: string) => {
  const [text, setText] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    // What was written for this business, if anything. A deployed build has no
    // endpoint to ask, so this is the whole answer there; in dev it just means
    // the lede is on screen before the first poll returns.
    setText(bundledLede(name))

    // Arriving asks for one; the poll keeps asking until it is written.
    const ask = () =>
      fetch(`/api/lede?businessId=${encodeURIComponent(businessId)}&name=${encodeURIComponent(name)}`)
        .then((r) => r.json())
        .then((d: { text: string | null }) => {
          if (!live || !d.text) return false
          setText(d.text)
          return true
        })
        // No lede is a header without a description, not a broken page.
        .catch(() => false)

    void ask()
    const poll = setInterval(() => void ask().then((got) => got && clearInterval(poll)), 2000)

    return () => {
      live = false
      clearInterval(poll)
    }
  }, [businessId, name])

  return text
}
