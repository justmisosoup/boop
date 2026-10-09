// Ported verbatim from app/src/containers/Explorer/graph/layout.ts
/**
 * Graph kernel — layout calm-makers. Pure, data-agnostic functions lifted from
 * the Explorer's proven layout: the 76px grid snap (nearest-free-cell) that makes
 * a force layout read as *composed* rather than simulated, and the octilinear
 * edge routing (0/45/90° with one rounded bend, calm-by-length opacity, parallel
 * strands). Every graph mode runs its OWN force sim for its topology, then feeds
 * the raw positions through these to inherit the air + the transit-map feel.
 *
 * This is where the "fun, calm" of the Relationships graph actually lives.
 */

export interface XY {
  x: number
  y: number
}

/* ------------------------------------------------------------------ */
/* Grid snap — every node to a modular cell; collisions resolve to the */
/* nearest free cell, deterministically. Same input → same picture.    */
/* ------------------------------------------------------------------ */

export interface GridConfig {
  /** cell size in px (Explorer: 76) */
  unit?: number
  /** pre-scale applied before snapping (Explorer: 0.86 — tightens the field) */
  scale?: number
  /** how far to search for a free cell before giving up */
  maxRing?: number
}

/** Snap raw positions to a modular grid, one node per cell, nearest free cell on
 *  collision. Iterates keys in insertion order, so the result is deterministic. */
export function snapToGrid(
  pts: Record<string, XY>,
  cfg: GridConfig = {}
): Record<string, XY> {
  const unit = cfg.unit ?? 76
  const scale = cfg.scale ?? 0.86
  const n = Object.keys(pts).length
  // the search must be able to place EVERY node even if all n collide on one
  // cell — a fixed cap silently stacked marks past ring 24 (review finding)
  const maxRing = cfg.maxRing ?? Math.max(24, Math.ceil(Math.sqrt(n)) + 4)
  const occupied = new Set<string>()
  const key = (cx: number, cy: number) => `${cx}|${cy}`

  // walk only the ring PERIMETER (O(ring) per ring, not O(ring²)) — cells
  // ordered by true distance then x,y for determinism
  const nearestFree = (cx: number, cy: number): [number, number] => {
    if (!occupied.has(key(cx, cy))) return [cx, cy]
    for (let ring = 1; ring <= maxRing; ring++) {
      const cands: [number, number][] = []
      for (let dx = -ring; dx <= ring; dx++) {
        cands.push([cx + dx, cy - ring], [cx + dx, cy + ring])
      }
      for (let dy = -ring + 1; dy <= ring - 1; dy++) {
        cands.push([cx - ring, cy + dy], [cx + ring, cy + dy])
      }
      cands.sort((a, b) => {
        const da = (a[0] - cx) ** 2 + (a[1] - cy) ** 2
        const db = (b[0] - cx) ** 2 + (b[1] - cy) ** 2
        return da - db || a[0] - b[0] || a[1] - b[1]
      })
      for (const [x, y] of cands) if (!occupied.has(key(x, y))) return [x, y]
    }
    return [cx, cy]
  }

  const out: Record<string, XY> = {}
  for (const id of Object.keys(pts)) {
    const p = pts[id]
    const gx = Math.round((p.x * scale) / unit)
    const gy = Math.round((p.y * scale) / unit)
    const [cx, cy] = nearestFree(gx, gy)
    occupied.add(key(cx, cy))
    out[id] = { x: cx * unit, y: cy * unit }
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Octilinear edge geometry — the transit-map line discipline.         */
/* ------------------------------------------------------------------ */

export interface Anchor {
  x: number
  y: number
  a: number
}
export interface EdgeGeo {
  d: string
  len: number
  /** rest opacity — long cross-map lines fade the most */
  oRest: number
  /** midpoint of the labeled segment + its a→b direction */
  mx: number
  my: number
  angle: number
  /** points inset from each endpoint along the touching segment (for chips) */
  aAnchor: Anchor
  bAnchor: Anchor
}

export interface EdgeInput {
  id: string
  from: string
  to: string
}

export interface OctiConfig {
  elbowR?: number
  /** perpendicular offset between two cited edges on the same pair */
  strandOffset?: number
  /** rest opacity as a function of length */
  oRest?: (len: number) => number
  /** corridor lanes — fan same-bearing edges into parallel tracks */
  lanes?: boolean
  laneGap?: number
}

const DEFAULT_OREST = (len: number) =>
  len < 280 ? 0.15 : len < 640 ? 0.09 : 0.045

/* ------------------------------------------------------------------ */
/* Corridor lanes — the shared-bearing fix.                            */
/* ------------------------------------------------------------------ */

/** The octilinear construction quantizes every departure to 8 bearings (the
 *  first leg out of `from` is an exact 45° diagonal, the leg into `to` an
 *  exact axis), so edges to DIFFERENT destinations leave a busy node on
 *  literally the same pixels. corridorLanes gives each (node, bearing)
 *  corridor's edges a small perpendicular lane — parallel tracks, transit
 *  style — ordered so the edge that peels off earliest sits outermost on the
 *  side it peels toward (no braiding at the split; `side` IS the sign of the
 *  exit's projection on the corridor normal). Same-pair duplicates share a
 *  lane: lanes separate DESTINATIONS, the strand spread separates DUPLICATES
 *  within one. Normals live in the node's outward frame, so both ends of a
 *  corridor agree regardless of each edge's authored from→to orientation.
 *  Deterministic: buckets follow the boundary's id-sorted edge order and
 *  every sort carries a total tiebreak. */
export interface LaneVec {
  a: XY
  b: XY
}

interface CorridorEntry {
  edgeId: string
  pk: string
  end: 'a' | 'b'
  /** which side of the corridor the line peels toward (0 = straight through) */
  side: number
  /** distance travelled in the corridor before the peel */
  divergeLen: number
}

export function corridorLanes(
  edges: EdgeInput[],
  posOf: Record<string, XY>,
  laneGap: number
): Record<string, LaneVec> {
  const pairKeyOf = (e: EdgeInput) =>
    e.from < e.to ? `${e.from}|${e.to}` : `${e.to}|${e.from}`

  // octant keys come out exact — grid-snapped inputs, exact-diagonal legs —
  // so sign-normalized components need no epsilon
  const corridors = new Map<string, { out: XY; entries: CorridorEntry[] }>()
  const push = (nodeId: string, out: XY, entry: CorridorEntry) => {
    const key = `${nodeId}|${out.x},${out.y}`
    let c = corridors.get(key)
    if (!c) {
      c = { out, entries: [] }
      corridors.set(key, c)
    }
    c.entries.push(entry)
  }

  for (const e of edges) {
    const a = posOf[e.from]
    const b = posOf[e.to]
    if (!a || !b) continue
    const dx = b.x - a.x
    const dy = b.y - a.y
    const adx = Math.abs(dx)
    const ady = Math.abs(dy)
    if (adx === 0 && ady === 0) continue
    const sx = Math.sign(dx) || 1
    const sy = Math.sign(dy) || 1
    const pk = pairKeyOf(e)
    if (adx === ady || adx === 0 || ady === 0) {
      // straight: one segment, each end sits in the reversed corridor
      const len = Math.hypot(dx, dy)
      const out = { x: Math.sign(dx), y: Math.sign(dy) }
      const base = { edgeId: e.id, pk, side: 0, divergeLen: len }
      push(e.from, out, { ...base, end: 'a' })
      push(e.to, { x: -out.x, y: -out.y }, { ...base, end: 'b' })
    } else {
      // elbow: diagonal leg out of `from`, axis leg into `to` (the construction)
      const cross = (o: XY, x2: XY) => Math.sign(o.x * x2.y - o.y * x2.x)
      const outA = { x: sx, y: sy }
      const exitA = adx > ady ? { x: sx, y: 0 } : { x: 0, y: sy }
      const outB = adx > ady ? { x: -sx, y: 0 } : { x: 0, y: -sy }
      const exitB = { x: -sx, y: -sy }
      push(e.from, outA, {
        edgeId: e.id,
        pk,
        end: 'a',
        side: cross(outA, exitA),
        divergeLen: Math.min(adx, ady) * Math.SQRT2
      })
      push(e.to, outB, {
        edgeId: e.id,
        pk,
        end: 'b',
        side: cross(outB, exitB),
        divergeLen: Math.abs(adx - ady)
      })
    }
  }

  const lanes: Record<string, LaneVec> = {}
  const vecOf = (id: string): LaneVec =>
    (lanes[id] ??= { a: { x: 0, y: 0 }, b: { x: 0, y: 0 } })

  for (const { out, entries } of corridors.values()) {
    // one lane per destination (pair group) — strands share it
    const groups = new Map<string, CorridorEntry[]>()
    for (const en of entries) {
      const g = groups.get(en.pk)
      if (g) g.push(en)
      else groups.set(en.pk, [en])
    }
    if (groups.size < 2) continue

    const ordered = [...groups.entries()].sort(([pkX, [x]], [pkY, [y]]) => {
      if (x.side !== y.side) return x.side - y.side
      if (x.divergeLen !== y.divergeLen)
        // anti-braiding: the earliest peeler sits OUTERMOST on its side —
        // ascending on the negative side, mirrored on the positive
        return x.side > 0
          ? y.divergeLen - x.divergeLen
          : x.divergeLen - y.divergeLen
      return pkX < pkY ? -1 : 1
    })

    const nl = Math.hypot(out.x, out.y)
    const n = { x: -out.y / nl, y: out.x / nl }
    ordered.forEach(([, group], i) => {
      const off = (i - (ordered.length - 1) / 2) * laneGap
      if (off === 0) return // the center lane IS the center line (absent = zero)
      for (const en of group) {
        const slot = en.end === 'a' ? vecOf(en.edgeId).a : vecOf(en.edgeId).b
        slot.x = n.x * off
        slot.y = n.y * off
      }
    })
  }
  return lanes
}

export function octilinearGeometry(
  edges: EdgeInput[],
  posOf: Record<string, XY>,
  cfg: OctiConfig = {}
): Record<string, EdgeGeo> {
  const ELBOW_R = cfg.elbowR ?? 11
  const STRAND = cfg.strandOffset ?? 18
  const oRestFn = cfg.oRest ?? DEFAULT_OREST
  const laneVecs = cfg.lanes
    ? corridorLanes(edges, posOf, cfg.laneGap ?? 6)
    : null

  const pairKey = (e: EdgeInput) =>
    e.from < e.to ? `${e.from}|${e.to}` : `${e.to}|${e.from}`
  const strandCount: Record<string, number> = {}
  const strandSeq: Record<string, number> = {}
  for (const e of edges)
    strandCount[pairKey(e)] = (strandCount[pairKey(e)] ?? 0) + 1

  const geo: Record<string, EdgeGeo> = {}
  for (const e of edges) {
    const a0 = posOf[e.from]
    const b0 = posOf[e.to]
    if (!a0 || !b0) continue
    const pk = pairKey(e)
    const strand = strandSeq[pk] ?? 0
    strandSeq[pk] = strand + 1
    let a = a0
    let b = b0
    if (strandCount[pk] > 1) {
      const ddx = b0.x - a0.x
      const ddy = b0.y - a0.y
      const dl = Math.hypot(ddx, ddy) || 1
      // the spread follows the NORMALIZED pair orientation, not each edge's
      // authored from→to — duplicates authored in opposite directions must
      // land on opposite sides, not flip normals and stay coincident
      const flip = e.from < e.to ? 1 : -1
      const off = (strand - (strandCount[pk] - 1) / 2) * STRAND * flip
      a = { x: a0.x + (-ddy / dl) * off, y: a0.y + (ddx / dl) * off }
      b = { x: b0.x + (-ddy / dl) * off, y: b0.y + (ddx / dl) * off }
    }
    const lv = laneVecs?.[e.id]
    if (lv && (lv.a.x || lv.a.y || lv.b.x || lv.b.y)) {
      const odx = Math.abs(b0.x - a0.x)
      const ody = Math.abs(b0.y - a0.y)
      if (odx === ody || odx === 0 || ody === 0) {
        // straights translate RIGIDLY by the dominant end's lane: shifting one
        // end re-routes an axis-straight back onto the shared center line via
        // a tiny stub, re-coinciding with its corridor mates. Cost: a straight
        // straddling two contended corridors under-separates in the losing one.
        const v =
          lv.a.x * lv.a.x + lv.a.y * lv.a.y >= lv.b.x * lv.b.x + lv.b.y * lv.b.y
            ? lv.a
            : lv.b
        a = { x: a.x + v.x, y: a.y + v.y }
        b = { x: b.x + v.x, y: b.y + v.y }
      } else {
        // elbows shift per end: the first leg re-quantizes to the same exact
        // diagonal, so corridor mates become parallel tracks at laneGap
        a = { x: a.x + lv.a.x, y: a.y + lv.a.y }
        b = { x: b.x + lv.b.x, y: b.y + lv.b.y }
      }
    }
    const dx = b.x - a.x
    const dy = b.y - a.y
    const adx = Math.abs(dx)
    const ady = Math.abs(dy)
    const sx = Math.sign(dx) || 1
    const sy = Math.sign(dy) || 1
    const len = Math.hypot(dx, dy) || 1
    const anchorAt = (pt: XY, u: XY, segLen: number): Anchor => {
      const inset = Math.min(58, segLen * 0.42)
      return {
        x: pt.x + u.x * inset,
        y: pt.y + u.y * inset,
        a: Math.atan2(u.y, u.x)
      }
    }
    let d: string
    let mid: XY
    let seg: XY
    let aAnchor: Anchor
    let bAnchor: Anchor
    if (adx === ady || adx === 0 || ady === 0) {
      d = `M ${a.x} ${a.y} L ${b.x} ${b.y}`
      mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      seg = { x: dx, y: dy }
      const u = { x: dx / len, y: dy / len }
      aAnchor = anchorAt(a, u, len)
      bAnchor = anchorAt(b, { x: -u.x, y: -u.y }, len)
    } else {
      const elbow =
        adx > ady
          ? { x: a.x + sx * ady, y: b.y }
          : { x: b.x, y: a.y + sy * adx }
      const v1 = { x: elbow.x - a.x, y: elbow.y - a.y }
      const v2 = { x: b.x - elbow.x, y: b.y - elbow.y }
      const l1 = Math.hypot(v1.x, v1.y) || 1
      const l2 = Math.hypot(v2.x, v2.y) || 1
      const r = Math.min(ELBOW_R, l1 / 2, l2 / 2)
      const p1 = { x: elbow.x - (v1.x / l1) * r, y: elbow.y - (v1.y / l1) * r }
      const p2 = { x: elbow.x + (v2.x / l2) * r, y: elbow.y + (v2.y / l2) * r }
      d = `M ${a.x} ${a.y} L ${p1.x} ${p1.y} Q ${elbow.x} ${elbow.y} ${p2.x} ${p2.y} L ${b.x} ${b.y}`
      mid =
        l1 >= l2
          ? { x: a.x + v1.x / 2, y: a.y + v1.y / 2 }
          : { x: elbow.x + v2.x / 2, y: elbow.y + v2.y / 2 }
      seg = l1 >= l2 ? v1 : v2
      aAnchor = anchorAt(a, { x: v1.x / l1, y: v1.y / l1 }, l1)
      bAnchor = anchorAt(b, { x: -v2.x / l2, y: -v2.y / l2 }, l2)
    }
    geo[e.id] = {
      d,
      len,
      oRest: oRestFn(len),
      mx: mid.x,
      my: mid.y,
      angle: Math.atan2(seg.y, seg.x),
      aAnchor,
      bAnchor
    }
  }
  return geo
}

/* ------------------------------------------------------------------ */
/* Arc geometry — the cross-link register.                             */
/* ------------------------------------------------------------------ */

/** Cross-links (a shared address between branches, a corporate-family tie, a
 *  second industry) draw as gentle quadratic ARCS — a deliberate second
 *  geometry, distinct from the octilinear tree limbs, that reads as "network
 *  truth over taxonomy". Three redundant cues separate them from
 *  limbs: curved vs octilinear, dotted vs solid (the mode's dash), whisper vs
 *  full alpha (the mode's opacity). Below ~50–100 cross-links, simple arcs
 *  beat any bundling (bundling provably increases ambiguity). */
export function arcGeometry(
  edges: EdgeInput[],
  posOf: Record<string, XY>,
  cfg: { bow?: number; oRest?: (len: number) => number } = {}
): Record<string, EdgeGeo> {
  const bowFrac = cfg.bow ?? 0.16
  const oRestFn = cfg.oRest ?? (() => 0.15)
  const geo: Record<string, EdgeGeo> = {}
  for (const e of edges) {
    const a = posOf[e.from]
    const b = posOf[e.to]
    if (!a || !b) continue
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    // bow perpendicular to the chord, AWAY from the world origin (the tree
    // root) so arcs swing around the trunk instead of crossing it
    const perp = { x: -dy / len, y: dx / len }
    const sign = perp.x * mid.x + perp.y * mid.y >= 0 ? 1 : -1
    const bow = Math.min(240, Math.max(48, len * bowFrac)) * sign
    const c = { x: mid.x + perp.x * bow, y: mid.y + perp.y * bow }
    // quadratic point + tangent at parameter t
    const at = (t: number) => ({
      x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x,
      y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y
    })
    const tangentAt = (t: number) => {
      const tx = 2 * (1 - t) * (c.x - a.x) + 2 * t * (b.x - c.x)
      const ty = 2 * (1 - t) * (c.y - a.y) + 2 * t * (b.y - c.y)
      return Math.atan2(ty, tx)
    }
    const m = at(0.5)
    const pa = at(0.12)
    const pb = at(0.88)
    geo[e.id] = {
      d: `M ${a.x} ${a.y} Q ${c.x} ${c.y} ${b.x} ${b.y}`,
      len,
      oRest: oRestFn(len),
      mx: m.x,
      my: m.y,
      angle: tangentAt(0.5),
      aAnchor: { x: pa.x, y: pa.y, a: tangentAt(0.12) },
      bAnchor: { x: pb.x, y: pb.y, a: tangentAt(0.88) + Math.PI }
    }
  }
  return geo
}

/* ------------------------------------------------------------------ */
/* Bounds — for the camera.                                            */
/* ------------------------------------------------------------------ */

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}
export function boundsOf(
  ids: string[],
  posOf: Record<string, XY>,
  margin = 120
): Bounds {
  const ps = ids.map(id => posOf[id]).filter(Boolean)
  if (!ps.length) return { x: -200, y: -200, width: 400, height: 400 }
  const xs = ps.map(p => p.x)
  const ys = ps.map(p => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  return {
    x: minX - margin,
    y: minY - margin,
    width: maxX - minX + margin * 2,
    height: maxY - minY + margin * 2
  }
}

/**
 * Make room for a floating companion (a docked chat over the canvas's
 * lower-left) WITHOUT shrinking the map: shift the frame left by half the band
 * it covers, so a fit centres the subject in the visible remainder instead of
 * underneath the companion.
 *
 * Width and height are deliberately untouched — the fit's zoom is therefore
 * exactly what it would have been, and the map TRANSLATES rather than shrinks.
 * (Fitting fully clear of a 464px companion costs ~45% of the zoom; the far
 * periphery sliding off reads better, and the emphasis ladder already fogs it.)
 *
 * `padScale` is the zoom factor the caller's fit lands on (RF's `fitBounds`
 * padding), so the px→flow conversion matches the frame it will be fitted at.
 *
 * `minZoom`/`maxZoom` are the camera's own limits. The predicted zoom must be
 * clamped to them or the conversion disagrees with the fit that follows: a
 * two-node graph wants zoom 6 but the camera saturates at 1.7, and an inset
 * divided by 6 shifts the frame ~3.5× too little — the subject stays under
 * the companion on exactly the small graphs where it's most visible.
 *
 * `keepVisible` (a world x-span — the focus PLATE's edges) makes the shift
 * SUBJECT-AWARE: the half-band heuristic centres the box, which strands a
 * focus that sits off the box's own centre — either under the companion (a
 * left-of-centre subject barely moves clear) or off the stage seam (a
 * right-of-centre subject is pushed past the edge). The far periphery
 * sliding off stays the accepted cost; the span that must not slide is the
 * card the fly-to exists to show. Shift at least until the span clears the
 * band, and never so far its right edge leaves the window.
 */
export function insetFraming(
  b: Bounds,
  opts: {
    insetLeft: number
    availW: number
    availH: number
    padScale: number
    minZoom?: number
    maxZoom?: number
    keepVisible?: { left: number; right: number }
  }
): Bounds {
  const { insetLeft, availW, availH, padScale } = opts
  if (insetLeft <= 0 || b.width <= 0 || b.height <= 0) return b
  const raw = Math.min(availW / b.width, availH / b.height) * padScale
  if (!Number.isFinite(raw) || raw <= 0) return b
  const zoom = Math.min(
    Math.max(raw, opts.minZoom ?? raw),
    opts.maxZoom ?? Number.POSITIVE_INFINITY
  )
  if (zoom <= 0) return b
  let shift = insetLeft / 2 / zoom
  if (opts.keepVisible) {
    // after shifting by s, world x lands on screen at
    // (x − (center − s)) · zoom + availW/2 — solve both constraints for s:
    const center = b.x + b.width / 2
    // the span's left edge clears the covered band…
    const min = center - opts.keepVisible.left + (insetLeft - availW / 2) / zoom
    // …and its right edge stays inside the window
    const max = center + availW / (2 * zoom) - opts.keepVisible.right
    // a span wider than the remainder can't satisfy both — the right edge
    // (the stage seam) wins, matching the pre-shift fallback of 0
    shift = Math.min(Math.max(shift, min), Math.max(0, max))
  }
  return { ...b, x: b.x - shift }
}

/* ------------------------------------------------------------------ */
/* Radial-tree ego layout — branches from the focus, grid-snapped.     */
/* ------------------------------------------------------------------ */

/** Lay a graph out as a radial tree around a focus: the focus at the center, each
 *  subtree owning an angular wedge so a node's children fan out NEAR it (branches
 *  from the center, not scattered concentric rings). Depth sets the radius; the wedge
 *  keeps each branch together. Disconnected / beyond-depth nodes ring the outside so
 *  nothing is lost. Raw positions are de-collided onto the grid by `snapToGrid`.
 *  Generic over node/edge types so any graph feature can share it. */
export function egoRingLayout<N extends { id: string }, E>(
  focusId: string | null,
  nodes: N[],
  adj: Record<string, { node: N; edge: E }[]>,
  cfg: {
    ringStep?: number
    maxDepth?: number
    minArc?: number
    /** false = return raw (un-snapped) positions, for composing a two-level layout */
    snap?: boolean
    /** the angular wedge (degrees) the focus's tree may occupy — default the full
     *  circle. A bundle's local tree passes an OUTWARD wedge (away from the root)
     *  so branches grow outward like a tree, never back toward the center. */
    wedge?: [number, number]
    /** per-depth sibling arc (px) — deeper tiers rest as small rings and may sit
     *  tighter; default: minArc at depth 1, 0.7 × minArc beyond. */
    minArcAt?: (depth: number) => number
  } = {}
): Record<string, XY> {
  const ringStep = cfg.ringStep ?? 240
  const maxDepth = cfg.maxDepth ?? 4
  // the minimum arc (px) to keep between siblings on a ring. A ring's radius grows
  // so its children never pack closer than this — a high fan-out (e.g. a business
  // with 28 direct ties) spreads OUTWARD to where it fits instead of overlapping at
  // a fixed radius. This is what keeps the air as neighborhoods scale.
  const minArc = cfg.minArc ?? 168
  const minArcAt =
    cfg.minArcAt ??
    ((d: number) => (d <= 1 ? minArc : Math.round(minArc * 0.7)))
  const [w0, w1] = cfg.wedge ?? [0, 360]
  const raw: Record<string, XY> = {}
  const seen = new Set<string>()
  const polar = (r: number, deg: number): XY => {
    const a = ((deg - 90) * Math.PI) / 180
    return { x: Math.cos(a) * r, y: Math.sin(a) * r }
  }
  // DISCOVERY pass: claim each node for the branch that reaches it first (the same
  // pre-order the old inline walk used) and measure every subtree, so wedges can be
  // allocated by WEIGHT — a heavy branch earns proportionally more arc, which is
  // what keeps deep clusters from cramping while light branches stay snug.
  const childrenOf = new Map<string, string[]>()
  const sizeOf = new Map<string, number>()
  const discover = (id: string, depth: number): number => {
    const kids: string[] = []
    if (depth < maxDepth) {
      for (const { node } of adj[id] ?? []) {
        if (!seen.has(node.id)) {
          seen.add(node.id)
          kids.push(node.id)
        }
      }
    }
    childrenOf.set(id, kids)
    let size = 1
    for (const k of kids) size += discover(k, depth + 1)
    sizeOf.set(id, size)
    return size
  }
  // PLACEMENT pass: a node sits at its wedge's midpoint; its children share a ring
  // whose radius is the larger of one ring-step out and what their count needs to
  // hold the tier's arc apart, each child's sub-wedge sized by its subtree weight.
  const place = (
    id: string,
    depth: number,
    radius: number,
    a0: number,
    a1: number
  ) => {
    raw[id] = depth === 0 ? { x: 0, y: 0 } : polar(radius, (a0 + a1) / 2)
    const kids = childrenOf.get(id) ?? []
    if (!kids.length) return
    const wedgeRad = ((a1 - a0) * Math.PI) / 180
    const needed =
      (minArcAt(depth + 1) * kids.length) / Math.max(0.0001, wedgeRad)
    // grow for the fan-out, but CAP the step: `needed` scales with subtree weight, and
    // uncapped it flings deep tiers of a big graph tens of thousands of px out. Past the
    // cap the 76px grid absorbs residual collisions and fog keeps the depth quiet.
    const childRadius = Math.min(
      radius + 3 * ringStep,
      Math.max(radius + ringStep, needed)
    )
    const total = kids.reduce((s, k) => s + (sizeOf.get(k) ?? 1), 0)
    let a = a0
    for (const k of kids) {
      // blend even + weighted shares: pure weighting starves a light sibling beside a
      // heavy branch (packing it far under minArc). Half the wedge splits evenly (every
      // child's floor), half by subtree size (heavy branches still earn room).
      const span =
        (a1 - a0) *
        (0.5 / kids.length + (0.5 * (sizeOf.get(k) ?? 1)) / Math.max(1, total))
      place(k, depth + 1, childRadius, a, a + span)
      a += span
    }
  }
  if (focusId) {
    seen.add(focusId)
    discover(focusId, 0)
    place(focusId, 0, 0, w0, w1)
  }
  // disconnected / beyond-depth nodes ring the outside — WITHIN the wedge, so a
  // bundle's local overflow never sprays back toward the root
  const rest = nodes.filter(n => !seen.has(n.id))
  rest.forEach((n, i) => {
    raw[n.id] = polar(
      (maxDepth + 1) * ringStep,
      w0 + ((i + 0.5) * (w1 - w0)) / Math.max(1, rest.length)
    )
  })
  return cfg.snap === false ? raw : snapToGrid(raw)
}
