// Ported from app/src/containers/Explorer/graph/regionModel.ts (state lookup now local, via ./address)
/**
 * Region labels for address fans (mode-level, pure) — the map's quiet
 * geography. Per address bundle: group its members by their label's state,
 * push each state's word outward from the bundle through its member
 * centroid, and displace it further along that bearing ONLY while something
 * would sit on the word's CORE. Cartography's real rule: features may
 * overlap an areal name (an edge graze still reads, and the interleaving is
 * the map's depth) — a name may never be BROKEN, a station mid-word
 * fragmenting it in two. Balance over avoidance: words stay attached to
 * their arcs.
 *
 * Derived ONCE per world (positions are frozen; nodes never move), so the
 * per-bundle arrays keep reference identity across focus hops — the fade-in
 * plays when a fan opens, never when the focus walks between its members.
 * Groups iterate in memberIds order, which the fan sort already ordered:
 * fan arc order == footprint caption order == region order, one law.
 */
import { getStateByAbbr, stateOfAddressName } from './address'
import type { GraphModel } from './buildGraph'
import { CARD_GAP } from './labels'

export interface RegionSpec {
  id: string
  /** the areal word — the FULL state name ("California"); CSS sets the case */
  label: string
  /** the two-letter form (a lab-switchable alternative rendering) */
  abbr: string
  /** the RESOLVED word center, world coords: the state's member centroid,
   *  pushed REGION_PUSH outward from the bundle, then displaced (a few
   *  small steps at most) only while a mark or plate would sit on the
   *  word's CORE and fragment it — edge grazes are welcome */
  x: number
  y: number
  /** unit bearing bundle→centroid — the lab's push knob slides the word
   *  along it as a DELTA from the resolved anchor (0,0 when the centroid
   *  sits ON the bundle) */
  ux: number
  uy: number
}

/** the shipped voice metrics — Amir's round-2 picks, mirrored by styles.css
 *  `var()` fallbacks and the ?regions=1 knob initials (retune together; the
 *  lab is the drift alarm). The camera's framing reads them through
 *  `regionExtent`, so the frame reserves what the CSS will paint. */
export const REGION_SIZE = 30
export const REGION_PUSH = 130

/** a member's CARD as a break-test point, below its mark center: half the
 *  44px tile + the mark↔card gap + half a tall (three-line) card — retune
 *  with `cardDims` (labels.ts) if card heights change */
const CARD_POINT_DY = 22 + CARD_GAP + 34

/** a region word's estimated world rect around its RESOLVED anchor — the
 *  camera's reserve and the displacement test share it. Errs wide (full-name
 *  width at full tracking) so a state name never crops mid-word; the abbr
 *  form simply earns a little extra air. */
export function regionExtent(r: Pick<RegionSpec, 'label' | 'x' | 'y'>): {
  x: number
  y: number
  width: number
  height: number
} {
  const halfW = (r.label.length * REGION_SIZE) / 2 + 24
  const halfH = REGION_SIZE * 0.75 + 12
  return {
    x: r.x - halfW,
    y: r.y - halfH,
    width: halfW * 2,
    height: halfH * 2
  }
}

export function addressRegionsByBundle(world: GraphModel): {
  /** bundleId → its regions, in fan order (stable array identity) */
  regionsOf: Map<string, RegionSpec[]>
  /** memberId → its bundleId (the fan a focused member belongs to) */
  ownerOf: Map<string, string>
} {
  const regionsOf = new Map<string, RegionSpec[]>()
  const ownerOf = new Map<string, string>()
  for (const n of world.nodes) {
    if (!n.bundle || n.bundle.memberKind !== 'address') continue
    const bundlePos = world.posOf[n.id]
    if (!bundlePos) continue
    const groups = new Map<string, { sx: number; sy: number; k: number }>()
    for (const mid of n.bundle.memberIds) {
      ownerOf.set(mid, n.id)
      const member = world.nodeById[mid]
      const p = world.posOf[mid]
      if (!member || !p) continue
      const st = stateOfAddressName(member.name)
      if (!st) continue
      const g = groups.get(st) ?? { sx: 0, sy: 0, k: 0 }
      g.sx += p.x
      g.sy += p.y
      g.k += 1
      groups.set(st, g)
    }
    // what can BREAK a word: a mark or a (roughly plate-center) card sitting
    // on its core. Tracked as points — a point outside the core at most
    // clips an edge, which reads fine and keeps words near their arcs
    const breakers = [n.id, ...n.bundle.memberIds]
      .map(id => world.posOf[id])
      .filter(Boolean)
      .flatMap(p => [
        { x: p.x, y: p.y },
        { x: p.x, y: p.y + CARD_POINT_DY }
      ])
    const regions: RegionSpec[] = []
    for (const [abbr, g] of groups) {
      const cx = g.sx / g.k
      const cy = g.sy / g.k
      const dx = cx - bundlePos.x
      const dy = cy - bundlePos.y
      const len = Math.hypot(dx, dy)
      const ux = len > 0 ? dx / len : 0
      const uy = len > 0 ? dy / len : 0
      const label = getStateByAbbr(abbr)?.name ?? abbr
      // displacement: REGION_PUSH is the resting distance; nudge outward in
      // small, few steps only while a breaker sits on the word's CORE — the
      // middle 60% of its width, where coverage fragments the name. Edge
      // grazes never move a word (balance over avoidance), and the step cap
      // accepts a graze rather than exiling a word from its arc.
      let push = REGION_PUSH
      if (ux !== 0 || uy !== 0) {
        const coreHalfW = ((label.length * REGION_SIZE) / 2) * 0.6
        const coreHalfH = REGION_SIZE * 0.75 + 30
        for (let step = 0; step < 4; step++) {
          const wx = cx + ux * push
          const wy = cy + uy * push
          const fragmented = breakers.some(
            b =>
              Math.abs(b.x - wx) < coreHalfW && Math.abs(b.y - wy) < coreHalfH
          )
          if (!fragmented) break
          push += 24
        }
      }
      regions.push({
        id: `${n.id}:${abbr}`,
        label,
        abbr,
        x: cx + ux * push,
        y: cy + uy * push,
        ux,
        uy
      })
    }
    if (regions.length > 0) regionsOf.set(n.id, regions)
  }
  return { regionsOf, ownerOf }
}
