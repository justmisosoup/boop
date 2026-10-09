// Ported verbatim from app/src/containers/Explorer/graph/Edges.tsx
/**
 * The graph system — edge primitive (kernel).
 *
 * Lines are the transit-map's quiet infrastructure: octilinear (routed in
 * layout.ts), calm-by-length at rest, and — on a focused node's edges only —
 * weighted by CONNECTION STRENGTH (how many sources corroborate the tie). The
 * kernel renders the line via React Flow's BaseEdge (so the `react-flow__edge-path`
 * the hover law brightens exists) and owns the shared style vocabulary; the mode
 * resolves its emphasis into the concrete stroke/width/opacity.
 */
import { BaseEdge } from '@xyflow/react'

/** A fully-resolved line: the mode maps (emphasis, edge semantics) → these. */
export interface EdgeView {
  /** octilinear path `d` (from layout.ts edgeGeo) */
  d: string
  stroke: string
  width: number
  /** dash pattern, or undefined for a solid line */
  dash?: string
  opacity: number
}

/** The line. interactionWidth:0 (marks own the pointer, not lines); the 320ms
 *  transition eases emphasis changes; the hover law brightens the path via the
 *  `.g-edge-hi` class the mode toggles on the edge wrapper (graph.css).
 *  THE PAINT BUDGET: a fully-hidden line leaves the paint pass (visibility) —
 *  hundreds of opacity-0 paths still cost raster work every camera frame.
 *  Hiding is a crisp swap; revealing fades in from 0 as before. */
export function TransitEdge({
  id,
  view,
  className
}: {
  id: string
  view: EdgeView
  className?: string
}) {
  return (
    <BaseEdge
      id={id}
      path={view.d}
      className={className}
      interactionWidth={0}
      style={{
        stroke: view.stroke,
        strokeWidth: view.width,
        strokeDasharray: view.dash,
        opacity: view.opacity,
        visibility: view.opacity === 0 ? 'hidden' : undefined,
        transition: 'opacity 320ms ease, stroke-width 320ms ease'
      }}
    />
  )
}

/* ---------- connection strength = line weight (SURFACING / DESIGN) ----------
   Three legible tiers on a focused node's edges: a WIDE spread (a strong tie is
   ~3.5× a weak one) so the difference reads at a glance. Emphasis is carried by
   OPACITY, so the resting map stays uniformly thin — weight reveals only where
   you're looking, and the channels don't collide. */
export type Strength = 'weak' | 'moderate' | 'strong'
export const STRENGTH_WIDTH: Record<Strength, number> = {
  weak: 1.4,
  moderate: 3,
  strong: 4.8
}
/** paint rank so focus edges sort strongest-LAST (a wide strong trunk covers a
 *  coincident thinner line in the same corridor). This is an in-ARRAY paint
 *  order, NOT a CSS z-index — RF renders each edge as its own z-0 <svg>, and a
 *  positive edge.zIndex would hoist the line above the marks (gotchas.md). */
export const STRENGTH_Z: Record<Strength, number> = {
  weak: 1,
  moderate: 2,
  strong: 3
}
export const strengthTier = (sources: number): Strength =>
  sources >= 3 ? 'strong' : sources >= 2 ? 'moderate' : 'weak'

/* ---------- line-style axis: dash = HOW SURE, and nothing else.
   solid = confirmed · dotted = unconfirmed (a lead, not a fact) · the sparse
   hairline = hub context, far sparser than unconfirmed so context never reads
   as an unverified fact. A tie's TENSE (former) lives in its words and the
   panel's Former tag, never in the paint — matching the graph_edges contract
   (status: active | unconfirmed | disputed; no "former"), so what a user
   learns from the key today survives live relationships landing. */
export function dashFor(opts: {
  unconfirmed?: boolean
  contextLink?: boolean
}): string | undefined {
  if (opts.contextLink) return '1 8'
  if (opts.unconfirmed) return '2 5'
  return undefined
}
