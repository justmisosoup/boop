import { useEffect, useState } from 'react'

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
    setText(null)

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
