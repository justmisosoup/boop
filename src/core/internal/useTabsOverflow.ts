import React from 'react'

/**
 * Fit math for the TabsList overflow behavior: how many leading tabs fit the
 * container, reserving room for the always-present "More" trigger when any tab
 * must collapse. Pure so the boundary conditions are unit-testable without
 * layout.
 *
 * The 0.5px slack absorbs subpixel rounding from `getBoundingClientRect`-backed
 * measurements so a tab bar sitting exactly at its natural width doesn't
 * oscillate between fitting and collapsing (same hysteresis idea as
 * `useBusinessesTableLayout`).
 */
export const computeVisibleTabCount = ({
  containerWidth,
  gap,
  itemWidths,
  moreWidth,
  reserveMore = false
}: {
  /** The tab list's clientWidth. */
  containerWidth: number
  /** The list's column-gap in px. */
  gap: number
  /** Natural width of each trigger, in render order. */
  itemWidths: number[]
  /** Natural width of the "More" trigger. */
  moreWidth: number
  /**
   * The More trigger is permanently in the row (the list has fixed-in-More
   * tabs), so its width counts toward the fits-all check and is always
   * reserved — not just once something collapses.
   */
  reserveMore?: boolean
}): number => {
  const count = itemWidths.length

  // Unmeasurable container (SSR, jsdom, a drawer mid-open animating from 0):
  // show everything rather than collapsing tabs on bad data.
  if (containerWidth <= 0) return count

  const naturalWidth =
    itemWidths.reduce(
      (sum, width, index) => sum + width + (index > 0 ? gap : 0),
      0
    ) + (reserveMore ? gap + moreWidth : 0)
  if (naturalWidth <= containerWidth + 0.5) return count

  // Something must collapse: greedily keep leading tabs while they fit
  // alongside the reserved More trigger.
  let used = 0
  let visible = 0

  for (const width of itemWidths) {
    const withTab = used + (visible > 0 ? gap : 0) + width
    const withMore = withTab + gap + moreWidth

    if (withMore > containerWidth + 0.5) break

    used = withTab
    visible += 1
  }

  return visible
}

/**
 * Measures a tab list and reports how many leading triggers fit, re-measuring
 * on resize (ResizeObserver) and whenever `deps` change. Hidden triggers report
 * `offsetWidth` 0, so natural widths are cached by tab value while visible —
 * the first render shows every trigger, which seeds the cache before anything
 * collapses. Known accepted edge: a tab whose label changes *while hidden*
 * keeps its stale cached width until it is revealed again (bounded, self-heals
 * on reveal).
 */
export const useTabsOverflow = ({
  deps,
  disabled,
  listRef,
  moreRef,
  reserveMore = false,
  values
}: {
  listRef: React.RefObject<HTMLElement | null>
  moreRef: React.RefObject<HTMLElement | null>
  /**
   * Values of the auto (collapsible) triggers in render order; keys for the
   * width cache. Ordering contract with TabsList: the auto triggers are the
   * FIRST `values.length` `[role="tab"]` nodes in the list — fixed-in-More
   * triggers render after them and are never measured.
   */
  values: (string | undefined)[]
  /** Skip measuring entirely (no value context to drive the menu). */
  disabled: boolean
  /** The More trigger is permanently in the row; always reserve its width. */
  reserveMore?: boolean
  /** Caller-supplied re-measure trigger (children identity). */
  deps: React.DependencyList
}): number => {
  const [visibleCount, setVisibleCount] = React.useState(values.length)
  const widthCache = React.useRef(new Map<string, number>())

  // Track the latest values without retriggering the effect body closure.
  const valuesKey = values.join('\u0000')
  const valuesRef = React.useRef(values)
  valuesRef.current = values

  React.useLayoutEffect(() => {
    if (disabled) return

    const list = listRef.current
    if (!list) return

    const measure = () => {
      const currentValues = valuesRef.current
      // Only the leading auto triggers are measured (see the ordering
      // contract on `values`); fixed-in-More triggers stay hidden forever
      // and never participate in the fit math.
      const triggers = Array.from(
        list.querySelectorAll<HTMLElement>('[role="tab"]')
      ).slice(0, currentValues.length)

      // Visible triggers refresh the cache; hidden ones (offsetWidth 0) fall
      // back to their cached natural width.
      const itemWidths = triggers.map((trigger, index) => {
        const key = currentValues[index] ?? `__index-${index}`
        if (trigger.offsetWidth > 0) {
          widthCache.current.set(key, trigger.offsetWidth)
        }
        return widthCache.current.get(key) ?? 0
      })

      const moreElement = moreRef.current
      if (moreElement && moreElement.offsetWidth > 0) {
        widthCache.current.set('__more', moreElement.offsetWidth)
      }
      const moreWidth = widthCache.current.get('__more') ?? 0

      const gap = Number.parseFloat(getComputedStyle(list).columnGap) || 0

      const next = computeVisibleTabCount({
        containerWidth: list.clientWidth,
        gap,
        itemWidths,
        moreWidth,
        reserveMore
      })

      // Integer state with React's same-value bail keeps ResizeObserver
      // feedback loops from re-rendering.
      setVisibleCount(next)
    }

    measure()

    // `ResizeObserver` is unavailable in some non-DOM environments (and is
    // stubbed in tests); fall back to the one-shot measurement above.
    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(measure)
    observer.observe(list)
    return () => observer.disconnect()
    // `deps` re-measures on children identity changes (labels/counts render
    // into trigger widths). `visibleCount` re-measures after a collapse state
    // change so triggers that just became visible replace their cached (or
    // missing) widths with real ones; the same-value setState bail makes the
    // extra pass converge instead of looping.
  }, [
    disabled,
    listRef,
    moreRef,
    reserveMore,
    valuesKey,
    visibleCount,
    ...deps
  ])

  // When measurement is off, everything is visible.
  return disabled ? values.length : Math.min(visibleCount, values.length)
}
