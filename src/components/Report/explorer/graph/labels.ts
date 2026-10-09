// Ported verbatim from app/src/containers/Explorer/graph/labels.ts
/**
 * Graph kernel — the GOLDEN nameplate solver, ported verbatim from the
 * Explorer's proven placement pass (demo/flow.tsx). This is the other half of
 * the calm: names never pile up, never shuffle, and never graze a mark.
 *
 * The disciplines it encodes (DESIGN.md / TYPOGRAPHY.md "the card grid"):
 * - BELOW is every card's home side — transit maps range all names one way.
 * - Three learnable geometries, tried in order: on-axis (below centered), flush
 *   corner (card edge registered a fixed 16px from the mark axis), beside
 *   (right before left — reading direction); above only as a late resort.
 * - POSITION HYSTERESIS: a card keeps its previous slot while it's still clean
 *   (Imhof: consistency beats per-label optimality) — labels must not
 *   re-shuffle around a still world.
 * - PRINT OCCLUSION: a card may cleanly COVER a minor ring (labeled tiers
 *   paint above the quiet world), but a half-poking graze is the ugliest state.
 * - The focus plate is the hero: it gets an escape ring of far candidates and
 *   a 4× graze penalty — it never grazes a mark if distance can save it.
 * - Integer offsets — half-pixel centers blur the 1px hairline border.
 */

export interface LabelItem {
  id: string
  /** mark center, world coords */
  x: number
  y: number
  /** mark edge length (the tile size — candidates offset from size/2) */
  size: number
  /** card dims (use cardDims for the shared estimator) */
  w: number
  h: number
  /** the focus plate — placed first, escape ring + 4× graze penalty */
  focus?: boolean
}

export interface MarkRect {
  cx: number
  cy: number
  w: number
  h: number
  /** a quiet world ring — a card may cleanly COVER it, never graze it */
  minor?: boolean
}

export interface Placement {
  /** card-center offset from the mark center (integers) */
  dx: number
  dy: number
}

const overlaps = (a: MarkRect, b: MarkRect, gap = 8) =>
  Math.abs(a.cx - b.cx) < (a.w + b.w) / 2 + gap &&
  Math.abs(a.cy - b.cy) < (a.h + b.h) / 2 + gap

/** The NAMEPLATE size estimator (ONE set of constants, product-wide): a quiet
 *  card rests name-only and collides as one line; widths quantize to the 8px
 *  system grid. `subLen` is the identity's second line (an address's
 *  locality) — always printed, so it always costs its 12px, unlike meta,
 *  which the word budget can quiet. The focus PLATE's rect comes from
 *  `plateDims` (plate.ts) — the same packing the renderer paints, so the two
 *  can't drift. The 184 width cap is mirrored by the painted card's
 *  `maxWidth` in Marks.tsx `nameplateStyle` — change both or neither. */
export function cardDims(opts: {
  nameLen: number
  subLen?: number
  metaLen?: number
  mq?: boolean
}): {
  w: number
  h: number
} {
  const metaLen = opts.mq ? 0 : (opts.metaLen ?? 0)
  const est =
    Math.max(opts.nameLen * 7, (opts.subLen ?? 0) * 6.2, metaLen * 6.2) + 20
  return {
    w: Math.min(184, Math.ceil(est / 8) * 8),
    h: (opts.metaLen && !opts.mq ? 38 : 26) + (opts.subLen ? 12 : 0)
  }
}

/** The printed-word budget (DESIGN.md): meta lines print on the N longest
 *  first-degree connections — long lines need the words most; nearer
 *  neighbors rest name-only (their words return on hover/bloom). Items whose
 *  meta must always print (anomalies — the trust surface) are exempt.
 *  Returns the ids whose meta goes QUIET (the card itself always places). */
export function applyMetaBudget(
  items: {
    id: string
    x: number
    y: number
    hasMeta: boolean
    alwaysPrint?: boolean
  }[],
  center: { x: number; y: number },
  budget = 6
): Set<string> {
  const candidates = items
    .filter(i => i.hasMeta && !i.alwaysPrint)
    .sort(
      (a, b) =>
        Math.hypot(b.x - center.x, b.y - center.y) -
        Math.hypot(a.x - center.x, a.y - center.y)
    )
  return new Set(candidates.slice(budget).map(i => i.id))
}

/** the one gap between a mark and its card (and card and card) — every
 *  candidate slot is built from it, and frame composition reuses it */
export const CARD_GAP = 8

/**
 * Place each label's card collision-free around its mark. Returns integer
 * card-center offsets (dx, dy from the mark center) plus the occupied rects
 * (marks + placed cards — what chip surfacing must dodge).
 *
 * `prev` is the hysteresis map (mutated in place — pass a ref that survives
 * focus changes): a card's previous slot is always the first candidate —
 * but only while the card is still the SAME SIZE. A resize (nameplate ⇄
 * plate on a focus transition, a meta reveal) re-solves instead: a slot
 * chosen for a past life can sit a grown card on its own mark, or strand a
 * shrunken one far below it.
 */
export function placeLabels(
  items: LabelItem[],
  center: { x: number; y: number },
  /** every visible mark on the map — quiet rings included (minor: true) */
  marks: MarkRect[],
  prev: Map<string, { cx: number; cy: number; w: number; h: number }>
): { pos: Map<string, Placement>; occupied: MarkRect[] } {
  const out = new Map<string, Placement>()
  // focus first (it anchors the composition), then nearest-to-focus outward
  const order = [...items].sort((a, b) => {
    if (a.focus) return -1
    if (b.focus) return 1
    return (
      Math.hypot(a.x - center.x, a.y - center.y) -
      Math.hypot(b.x - center.x, b.y - center.y)
    )
  })
  const placed: MarkRect[] = []
  for (const it of order) {
    const { x, y, size, w, h } = it
    // ONE gap (CARD_GAP, a system unit) between mark and card, every position
    const B = y + size / 2 + CARD_GAP + h / 2
    const T = y - size / 2 - CARD_GAP - h / 2
    const R = x + size / 2 + CARD_GAP + w / 2
    const L = x - size / 2 - CARD_GAP - w / 2
    // flush corners: the card EDGE registers 16px from the mark axis — a
    // fixed, learnable offset, never a per-card fraction. Right before left.
    const flush = w / 2 - 16
    const remembered = prev.get(it.id)
    // stillness only for the same-sized card (see the doc above)
    const held =
      remembered && remembered.w === w && remembered.h === h
        ? remembered
        : undefined
    const cands = [
      // the card's previous slot, when one exists — stillness first
      ...(held ? [{ cx: held.cx, cy: held.cy }] : []),
      { cx: x, cy: B }, // below centered — the home slot
      { cx: x + flush, cy: B }, // below, flush-right
      { cx: x - flush, cy: B }, // below, flush-left
      { cx: R, cy: y }, // beside right
      { cx: L, cy: y }, // beside left
      { cx: x, cy: T }, // above — a late resort, per the TfL discipline
      { cx: x + flush, cy: T },
      { cx: x - flush, cy: T },
      { cx: x, cy: B + h + 8 }, // below, second row
      // the plate is the hero and never grazes a mark if distance can save
      // it — a second escape ring exists for the focus alone
      ...(it.focus
        ? [
            { cx: R + 42, cy: y },
            { cx: L - 42, cy: y },
            { cx: R, cy: B }, // corner slots
            { cx: L, cy: B },
            { cx: R, cy: T },
            { cx: L, cy: T },
            { cx: x, cy: T - h - 8 } // above, second row
          ]
        : [])
    ]
    let best = cands[0]
    let bestScore = Infinity
    for (const c of cands) {
      const rect: MarkRect = { cx: c.cx, cy: c.cy, w, h }
      // cards and marks are hard obstacles; a minor ring fully under the card
      // is clean print occlusion, but a half-poking graze is the ugliest state
      let hard = 0
      let graze = 0
      for (const pr of placed) if (overlaps(rect, pr)) hard++
      for (const t of marks) {
        // never collide with our own mark: every constructed slot clears it
        // by geometry, and a held slot is only offered at the SAME dims that
        // once placed it cleanly (the size gate above)
        if (t.cx === x && t.cy === y) continue
        if (!overlaps(rect, t, 4)) continue
        if (
          t.minor &&
          Math.abs(t.cx - rect.cx) < rect.w / 2 - 10 - t.w / 2 &&
          Math.abs(t.cy - rect.cy) < rect.h / 2 - 10 - t.h / 2
        )
          continue // fully covered — invisible, not broken
        if (t.minor) graze++
        else hard++
      }
      // a grazed PLATE is four times the crime — the poking sliver of a ring
      // under the hero card hover-lifts THROUGH it (the ugliest state of all)
      const score = hard * 10 + graze * (it.focus ? 4 : 1)
      if (score === 0) {
        best = c
        bestScore = 0
        break
      }
      if (score < bestScore) {
        bestScore = score
        best = c
      }
    }
    placed.push({ cx: best.cx, cy: best.cy, w, h })
    prev.set(it.id, { cx: best.cx, cy: best.cy, w, h })
    // integer offsets — half-pixel centers blur the 1px hairline border
    out.set(it.id, { dx: Math.round(best.cx - x), dy: Math.round(best.cy - y) })
  }
  // marks + placed cards are what the hover chips must dodge
  return { pos: out, occupied: [...marks, ...placed] }
}
