/**
 * The piecewise time scale the strip is built on.
 *
 * The app uses `scaleTime` from `@visx/scale` (d3 underneath), which this
 * prototype does not carry. What it asks of it is small and exact: map two or
 * three domain dates onto two or three pixel stops, clamp at both ends, and
 * invert. That is linear interpolation per segment, so it is written out rather
 * than pulled in — the shelf, the ticks and every consumer stay the app's.
 */
export type TimeScale = {
  (date: Date): number
  invert: (px: number) => Date
  domain: Date[]
  range: number[]
}

export const piecewiseTime = (domain: Date[], range: number[]): TimeScale => {
  const stops = domain.map((d) => d.getTime())

  const at = (date: Date) => {
    const t = date.getTime()
    if (t <= stops[0]) return range[0]
    const last = stops.length - 1
    if (t >= stops[last]) return range[last]
    for (let i = 0; i < last; i += 1) {
      if (t <= stops[i + 1]) {
        const span = stops[i + 1] - stops[i] || 1
        return range[i] + ((t - stops[i]) / span) * (range[i + 1] - range[i])
      }
    }
    return range[last]
  }

  const scale = at as TimeScale
  scale.domain = domain
  scale.range = range
  scale.invert = (px: number) => {
    if (px <= range[0]) return new Date(stops[0])
    const last = range.length - 1
    if (px >= range[last]) return new Date(stops[last])
    for (let i = 0; i < last; i += 1) {
      if (px <= range[i + 1]) {
        const span = range[i + 1] - range[i] || 1
        return new Date(stops[i] + ((px - range[i]) / span) * (stops[i + 1] - stops[i]))
      }
    }
    return new Date(stops[last])
  }
  return scale
}
