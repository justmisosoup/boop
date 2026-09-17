import React from 'react'

/**
 * Reports whether the referenced element's content is being clipped — i.e. its
 * `scrollWidth` exceeds its `clientWidth`. Unlike a character-count heuristic,
 * this reflects the *actual* rendered width, so it stays correct as the element
 * (or its column) grows and shrinks.
 *
 * Re-measures on mount, whenever the element resizes (via `ResizeObserver`), and
 * whenever a value in `deps` changes (pass the rendered text so a content change
 * that doesn't change the box size is still caught).
 */
export const useIsOverflowing = (
  ref: React.RefObject<HTMLElement | null>,
  deps: React.DependencyList = []
): boolean => {
  const [isOverflowing, setIsOverflowing] = React.useState(false)

  React.useEffect(() => {
    const element = ref.current
    if (!element) return

    const measure = () =>
      setIsOverflowing(element.scrollWidth > element.clientWidth)

    measure()

    // `ResizeObserver` is unavailable in some non-DOM environments (and is
    // stubbed in tests); fall back to the one-shot measurement above.
    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
    // `deps` is the caller-supplied re-measure trigger (e.g. the rendered text).
  }, [ref, ...deps])

  return isOverflowing
}
