// Ported verbatim from app/src/containers/Explorer/graph/entrance.ts
import type { XY } from './layout'

/** The settle-in's timing, in one place. */
export const ENTRANCE = {
  /** ms between one ring of neighbors and the next */
  step: 110,
  /** ms between siblings on the same ring */
  stagger: 26,
  /** no mark waits longer than this, however large the map */
  cap: 1100,
  /** ms a mark takes to arrive */
  duration: 380,
  /** ms a line leads the mark it reaches */
  edgeLead: 80,
  /** ms a nameplate follows its mark */
  labelLag: 120,
  /** ms after the last mark before region words fade in */
  regionsAfter: 200
} as const

export type EntranceTiming = {
  step: number
  stagger: number
  cap: number
}

type NodeLike = { id: string }
type EdgeLike = { from: string; to: string }

const clockwise = (origin: XY, p: XY): number => {
  const angle = Math.atan2(p.y - origin.y, p.x - origin.x) + Math.PI / 2

  return angle < 0 ? angle + Math.PI * 2 : angle
}

/**
 * Delay per entering node. Settled marks still on the map are the sources and
 * get none; with none left, the origin is.
 */
export function entranceDelays({
  nodes,
  edges,
  posOf,
  origin,
  seen,
  timing = ENTRANCE
}: {
  nodes: readonly NodeLike[]
  edges: readonly EdgeLike[]
  posOf: Record<string, XY>
  origin: string | null
  seen: ReadonlySet<string>
  timing?: EntranceTiming
}): Map<string, number> {
  const ids = new Set(nodes.map(node => node.id))
  const adjacency = new Map<string, string[]>()
  for (const edge of edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) continue
    adjacency.set(edge.from, [...(adjacency.get(edge.from) ?? []), edge.to])
    adjacency.set(edge.to, [...(adjacency.get(edge.to) ?? []), edge.from])
  }

  const settled = nodes.filter(node => seen.has(node.id)).map(node => node.id)
  const sources =
    settled.length > 0
      ? settled
      : [origin && ids.has(origin) ? origin : nodes[0]?.id].filter(
          (id): id is string => Boolean(id)
        )

  const depth = new Map<string, number>()
  for (const id of sources) depth.set(id, 0)
  const queue = [...sources]
  while (queue.length > 0) {
    const id = queue.shift() as string
    const next = (depth.get(id) ?? 0) + 1
    for (const neighbor of adjacency.get(id) ?? []) {
      if (depth.has(neighbor)) continue
      depth.set(neighbor, next)
      queue.push(neighbor)
    }
  }

  let deepest = 0
  for (const value of depth.values()) deepest = Math.max(deepest, value)
  for (const node of nodes) {
    if (!depth.has(node.id)) depth.set(node.id, deepest + 1)
  }

  const anchor = posOf[sources[0] ?? ''] ?? { x: 0, y: 0 }
  const rings = new Map<number, string[]>()
  for (const node of nodes) {
    if (seen.has(node.id)) continue
    const ring = depth.get(node.id) ?? 0
    rings.set(ring, [...(rings.get(ring) ?? []), node.id])
  }

  const delays = new Map<string, number>()
  for (const [ring, members] of rings) {
    const ordered = [...members].sort(
      (a, b) =>
        clockwise(anchor, posOf[a] ?? anchor) -
        clockwise(anchor, posOf[b] ?? anchor)
    )
    const stagger = Math.min(
      timing.stagger,
      (timing.step * 0.9) / Math.max(1, ordered.length - 1)
    )
    ordered.forEach((id, rank) => {
      delays.set(
        id,
        Math.min(timing.cap, Math.round(ring * timing.step + rank * stagger))
      )
    })
  }

  return delays
}

export function edgeEntrance(
  delays: ReadonlyMap<string, number>,
  edge: EdgeLike,
  lead: number = ENTRANCE.edgeLead
): number | undefined {
  const a = delays.get(edge.from)
  const b = delays.get(edge.to)

  if (a === undefined && b === undefined) return undefined

  return Math.max(0, Math.max(a ?? 0, b ?? 0) - lead)
}

export const entranceSpan = (delays: ReadonlyMap<string, number>): number =>
  Math.max(0, ...delays.values())
