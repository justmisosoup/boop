/**
 * The graph system — the plate's content geometry (kernel).
 *
 * ONE geometry model for the focus plate. `packFacts` decides the ledger's
 * rows (which facts pair, which take the whole band, which values wrap) and
 * `plateDims` turns that into the rect the label solver reserves — including
 * the WIDTH: a fact-bearing plate takes the full measure (the measure exists
 * for fact lines to wrap on), while a header-only plate HUGS its name +
 * caption, so a short-named person or domain never floats in an empty card.
 * The renderer (Marks.tsx `Plate`) and the estimator both consume THIS
 * module, so the placed rect and the painted card cannot drift: the char
 * heuristics may misjudge a real wrap by a line, but never disagree with
 * themselves about the structure.
 *
 * Char-per-px coefficients follow the solver's established idiom (labels.ts:
 * `nameLen * 7`, `metaLen * 6.2`), tuned against the `?cards=1` lab's
 * estimate-vs-measured meter. `FILL` biases every wrap decision toward MORE
 * lines: over-reserving costs a little air; under-reserving grazes a mark
 * under the hero card — the ugliest state (labels.ts, the 4× plate penalty).
 *
 * The px constants below and the plate rules in styles.css are two halves of
 * one design — retune them together (the lab meter is the drift alarm).
 *
 * Ported from app/src/containers/Explorer/graph/plate.ts (two char advances
 * retuned for the token type sizes — see below).
 */

/** one fact: [label, value] — the mode authors these (KybNode.facts) */
export type PlateFact = [string, string]

/** the utility foot: the node's own exception, in the mode's severity
 *  (the KybNode risk vocabulary — high/medium or unstated) */
export interface PlateUtility {
  text: string
  risk?: 'high' | 'medium'
}

/** what a mode's `plateOf` supplies — the plate's content, not its geometry.
 *  `caption` prints UNDER the name (the nameplate's own grammar, scaled up —
 *  never a caps eyebrow above it). `subhead` is the identity's second line
 *  (an address's locality) between them — ONE line by design: plateDims
 *  reserves exactly SUBHEAD_LH for it and the CSS ellipsizes. */
export interface PlateData {
  caption: string
  subhead?: string
  cells: (PlateFact | null)[]
  utility?: PlateUtility
}

/** a packed ledger row: one full-band fact, or two short facts side by side */
export interface PlateRow {
  cells: [PlateFact] | [PlateFact, PlateFact]
  /** quantized content height (label line + 1–2 value lines), gaps excluded */
  h: number
}

/* ---------- the geometry constants (mirrored by styles.css) ---------- */

/** the full plate measure — what a fact-bearing card is wide (the ONE
 *  constant; nameplateStyle and the solver read the width off `plateDims`) */
export const PLATE_W = 280
/** the reserve floor for a hugged plate — the PAINT hugs at true
 *  max-content (Marks.tsx); this only keeps the solver's rect sane for
 *  very short names */
const PLATE_MIN_W = 120
/** horizontal padding per side (`.g-plate` padding) */
const PAD_X = 12
/** the full fact band / title measure */
const CONTENT_W = PLATE_W - PAD_X * 2
/** gutter between a paired row's two columns */
const PAIR_GAP = 16
/** one paired column's measure */
const HALF_W = (CONTENT_W - PAIR_GAP) / 2
/** vertical whitespace between fact rows (the de-latticed rhythm) */
const ROW_GAP = 12
/** a zone rule's vertical cost: 8px air + 1px line + 8px air — zone seams
 *  sit on the 8px rhythm, never hug their neighbors */
const RULE_ZONE = 17
/** `.g-plate` vertical padding + the 1px hairline border, top and bottom */
const PAD_TOP = 12
const PAD_BOTTOM = 12
const BORDER = 2
/** air between the name and its caption line */
const CAPTION_GAP = 2
/** air above the subhead (the identity's second line, between name and caption) */
const SUBHEAD_GAP = 2
/** extra air above the utility text: with the rule's 8px margin it gives the
 *  foot the same 12px above its words as the card pad below — the foot sits
 *  optically centered in its band instead of riding the rule */
const UTILITY_GAP = 4

/* line heights, per voice (styles.css is the source of the type itself) */
const LABEL_LH = 12
const VALUE_LH = 16
const NAME_LH = 20
const CAPTION_LH = 13
const SUBHEAD_LH = 13
const UTILITY_LH = 12

/* estimated advance per character, per voice (Suisse Intl):
 * label/caption/utility 10px/400 ≈ the meta coefficient; value 12px/400 a
 * step up; name 16px/600 scaled from the nameplate's proven 13px→7.0.
 * PROTOTYPE: the app sets the value at 11px and the plate name at 15px, which
 * no `--core-font-size-*` token holds; here they take the next token up
 * (`sm` 12px, `lg` 16px — never smaller) and these two advances scale with
 * them (app: VALUE_CHAR 6.6, NAME_CHAR 8.2). */
const LABEL_CHAR = 6.2
const VALUE_CHAR = 7.2
const NAME_CHAR = 8.75
const CAPTION_CHAR = 6.2
const UTILITY_CHAR = 6.2

/** the conservative fill: a line ≥85% full is TREATED as wrapping */
const FILL = 0.85

/** the printable-fact predicate — a cell with nothing to say says nothing
 *  (null / empty / '—' placeholders don't print; the live seam emits them) */
export const hasFact = (f: PlateFact | null | undefined): f is PlateFact =>
  Boolean(f && f[1] && f[1] !== '—')

/** estimated line count for `s` on a `width` measure, clamped — the same
 *  knob decides "fits one line" (=== 1) and the height of what doesn't */
const lines = (s: string, charPx: number, width: number, max: number): number =>
  Math.min(max, Math.max(1, Math.ceil((s.length * charPx) / (width * FILL))))

/** a fact both of whose halves sit on one HALF-width line may share a row */
const pairable = (f: PlateFact): boolean =>
  lines(f[0], LABEL_CHAR, HALF_W, 2) === 1 &&
  lines(f[1], VALUE_CHAR, HALF_W, 2) === 1

/**
 * Pack facts into ledger rows, in authored order (order is meaning — never
 * re-sorted): two ADJACENT pairable facts share a row; everything else takes
 * the full band, its value wrapping to at most two lines (the clamp — beyond
 * it the panel is the reading surface, per the README law). Labels never
 * wrap: a fact whose label outgrows the half column is full-rowed here,
 * structurally, so the label line height is always exactly one.
 */
export function packFacts(cells: (PlateFact | null)[]): PlateRow[] {
  const facts = cells.filter(hasFact)
  const rows: PlateRow[] = []
  let i = 0
  while (i < facts.length) {
    const a = facts[i]
    const b = facts[i + 1]
    if (b && pairable(a) && pairable(b)) {
      rows.push({ cells: [a, b], h: LABEL_LH + VALUE_LH })
      i += 2
      continue
    }
    const valueLines = lines(a[1], VALUE_CHAR, CONTENT_W, 2)
    rows.push({ cells: [a], h: LABEL_LH + valueLines * VALUE_LH })
    i += 1
  }
  return rows
}

/**
 * The plate's reserved rect. Height: header (wrapped name + caption) + the
 * packed fact band + the utility foot, each zone paying its rule only when
 * it prints (an empty band collapses entirely, rule and all — Marks.tsx).
 * Width: the full measure when any fact or utility prints; otherwise the
 * header's own estimated width, quantized to the 8px grid and clamped —
 * generous coefficients mean a hug errs a few px wide, never clipped.
 */
export function plateDims(
  name: string,
  plate: PlateData
): { w: number; h: number } {
  const rows = packFacts(plate.cells)
  const full = rows.length > 0 || Boolean(plate.utility)
  // the hug RESERVE carries the same conservative headroom every wrap
  // decision gets (÷FILL): the paint is the browser's true max-content, and
  // wide-glyph names run past the per-char estimate — the reserve must err
  // wide, never let a mark be judged clear of a card that overhangs it
  const headerEst =
    Math.max(
      name.length * NAME_CHAR,
      (plate.subhead?.length ?? 0) * CAPTION_CHAR,
      plate.caption.length * CAPTION_CHAR
    ) / FILL
  const w = full
    ? PLATE_W
    : Math.min(
        PLATE_W,
        Math.max(
          PLATE_MIN_W,
          Math.ceil((headerEst + PAD_X * 2 + BORDER) / 8) * 8
        )
      )
  // a hugged card paints at max-content: its header lines are 1 by
  // construction (re-applying FILL to a width granted FROM these strings
  // would charge every hug a phantom second line)
  const hugged = !full && w < PLATE_W
  const nameH = hugged
    ? NAME_LH
    : lines(name, NAME_CHAR, CONTENT_W, 2) * NAME_LH
  // one line by design, hugged or full — the CSS never lets a subhead wrap
  const subheadH = plate.subhead ? SUBHEAD_GAP + SUBHEAD_LH : 0
  const captionH = plate.caption
    ? CAPTION_GAP +
      (hugged
        ? CAPTION_LH
        : lines(plate.caption, CAPTION_CHAR, CONTENT_W, 2) * CAPTION_LH)
    : 0
  const factsH =
    rows.length > 0
      ? RULE_ZONE +
        rows.reduce((sum, r) => sum + r.h, 0) +
        (rows.length - 1) * ROW_GAP
      : 0
  const utilityH = plate.utility
    ? RULE_ZONE +
      UTILITY_GAP +
      lines(plate.utility.text, UTILITY_CHAR, CONTENT_W, 2) * UTILITY_LH
    : 0
  return {
    w,
    h:
      PAD_TOP +
      nameH +
      subheadH +
      captionH +
      factsH +
      utilityH +
      PAD_BOTTOM +
      BORDER
  }
}
