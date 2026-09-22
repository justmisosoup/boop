import { type RefObject, useLayoutEffect, useState } from 'react'

/** The rendered width of `ref`'s element, kept current through ResizeObserver. */
export const useElementWidth = (ref: RefObject<HTMLElement | null>): number => {
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () => setWidth(element.getBoundingClientRect().width)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])

  return width
}
