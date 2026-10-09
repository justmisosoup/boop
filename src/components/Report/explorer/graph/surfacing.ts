/**
 * The graph system — surfacing (kernel). The one-fact-per-connection LAW from
 * DESIGN.md law 5, lifted from the Explorer's proven chip placement:
 *
 * For each of the focus's first-degree connections, the canvas surfaces AT
 * MOST one fact, on the surface it belongs to. The MODE decides which edges
 * EARN a chip (edge semantics are the graph's own — control/record/identity
 * always qualify; location/digital only when the label names a role the mark
 * can't show; a neighbor whose card already carries its exception is out).
 * The KERNEL owns the law's mechanics:
 *
 * - DISTINCTIVE, not repeated: a label appearing 3+ times across the focus's
 *   neighborhood stays quiet — the sidebar enumerates the crowd.
 * - A cap (~6), longest lines first — they have the most room.
 * - A chip anchors at its NEIGHBOR's end ON the drawn path (the precomputed
 *   per-endpoint anchor), sliding along the segment to dodge cards, marks,
 *   and other chips.
 * - FALL TO THE CARD: a distinctive relationship that can't find clear room
 *   drops to the neighbor's card as a second line — never a pile, never lost.
 * - STATIC per focus — recomputed only when focus/fog change, never on hover:
 *   it cannot flash.
 *
 * Ported from app/src/containers/Explorer/graph/surfacing.ts.
 */
import type { EdgeGeo } from './layout'
import type { MarkRect } from './labels'

export interface ChipCandidate {
  edgeId: string
  /** the neighbor the chip describes (the non-focus end) */
  neighborId: string
  /** direction-aware text (state words ride the label; the panel adds tags) */
  text: string
  /** the chip's wash color (law 5: the LINE's kind — stable across re-focus) */
  color: string
}

export interface PlacedChip {
  id: string
  text: string
  color: string
  x: number
  y: number
}

const overlaps = (a: MarkRect, b: MarkRect, gap = 9) =>
  Math.abs(a.cx - b.cx) < (a.w + b.w) / 2 + gap &&
  Math.abs(a.cy - b.cy) < (a.h + b.h) / 2 + gap

export function surfaceChips(opts: {
  focusId: string
  /** pre-filtered by the mode: edges that EARN a chip (semantics + no anomaly) */
  candidates: ChipCandidate[]
  edgeGeo: Record<string, EdgeGeo>
  /** which geo anchor is the neighbor's end, per edge */
  neighborEnd: (edgeId: string) => 'a' | 'b'
  /** marks + placed cards from the label solver — hard obstacles */
  occupied: MarkRect[]
  cap?: number
}): { chips: PlacedChip[]; yielded: Map<string, string> } {
  const cap = opts.cap ?? 6
  // distinctive only: a label repeated 3+ times stays quiet
  const count = new Map<string, number>()
  for (const c of opts.candidates)
    count.set(c.text, (count.get(c.text) ?? 0) + 1)
  const chosen = opts.candidates
    .filter(c => (count.get(c.text) ?? 0) <= 2)
    .map(c => ({ c, geo: opts.edgeGeo[c.edgeId] }))
    .filter(x => x.geo)
    .sort((a, b) => b.geo.len - a.geo.len) // longest lines first

  const rects: MarkRect[] = [...opts.occupied]
  const chips: PlacedChip[] = []
  const yielded = new Map<string, string>()
  for (const { c, geo } of chosen) {
    if (chips.length >= cap) {
      yielded.set(c.neighborId, c.text)
      continue
    }
    const anchor =
      opts.neighborEnd(c.edgeId) === 'a' ? geo.aAnchor : geo.bAnchor
    const ax = Math.cos(anchor.a)
    const ay = Math.sin(anchor.a)
    // PROTOTYPE: the chip sets at `--core-font-size-sm` (12px; the app's is
    // 11px, which no token holds), so its advance scales 5.4 → 5.9
    const w = c.text.length * 5.9 + 16
    let spot: { x: number; y: number } | null = null
    // base at the neighbor-end anchor (on the line, on the neighbor's side)
    // and nudge ALONG that segment to dodge — staying on the line, beside its node
    for (const d of [0, 22, -22, 40, -40, 60]) {
      const x = anchor.x + ax * d
      const y = anchor.y + ay * d
      const rect: MarkRect = { cx: x, cy: y, w, h: 20 }
      if (!rects.some(r => overlaps(rect, r))) {
        spot = { x, y }
        break
      }
    }
    if (!spot) {
      yielded.set(c.neighborId, c.text) // no clear line room → fall to the card
      continue
    }
    rects.push({ cx: spot.x, cy: spot.y, w, h: 20 })
    chips.push({
      id: c.edgeId,
      text: c.text,
      color: c.color,
      x: spot.x,
      y: spot.y
    })
  }
  return { chips, yielded }
}
