import { useEffect, useState } from 'react'

/**
 * The width at which the page has room for three columns.
 *
 * One number, here. It is `wide` in `tailwind.config.cjs`, and the CSS uses
 * that; this is the JS copy, for the one decision CSS cannot make — whether the
 * chat's scrolling log is MOUNTED. Everything else about the column (its width,
 * the report's inset) is done in CSS with `wide:` variants, so a resize can
 * never leave the two a frame out of step.
 */
export const WIDE = 1104

/** True once the window is wide enough for the chat to have its own column. */
export const useWide = () => {
  const [wide, setWide] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(`(min-width: ${WIDE}px)`).matches
  )

  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${WIDE}px)`)
    const read = () => setWide(query.matches)
    read()
    query.addEventListener('change', read)
    return () => query.removeEventListener('change', read)
  }, [])

  return wide
}
