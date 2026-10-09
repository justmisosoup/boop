/**
 * The graph system — mark & nameplate primitives (kernel).
 *
 * The transit-map vocabulary, as composable pieces a mode's node renderer
 * assembles: the quiet world reads as station RINGS on a line; where you are
 * (and its first degree) reads as a full glyph TILE; the focus wears the
 * ledger PLATE (name · caption · rule · fact rows · rule · utility foot).
 *
 * These emit the `.g-*` DOM the shared stylesheet (graph.css) paints. They are
 * data-agnostic: a mode computes the small view objects below from its own
 * model and hands them over. Nothing here knows what a "business" is.
 *
 * Ported from app/src/containers/Explorer/graph/Marks.tsx, less `MarkGlyph`
 * (the chip-scale mark for the panel and chat, neither of which is ported).
 */
import { Fragment, type CSSProperties } from 'react'

import { packFacts, PLATE_W, type PlateFact, type PlateUtility } from './plate'

/** Emphasis is an open string: the kernel paints world/lit/focus/faded/hidden,
 *  and a mode may add its own tiers (e.g. a journey 'way') in its stylesheet. */
export type Emphasis = string

/** The mark itself — a quiet ring, or a full glyph tile. The mode decides which
 *  (typically: world/faded/hidden → ring; lit/focus → tile) and supplies the
 *  hues, because "what color is a phone" is a mode's concern, not the kernel's. */
export interface MarkStyle {
  /** quiet station ring (true) vs. full glyph tile (false) */
  station: boolean
  /** tile edge length in px (ignored by the fixed 13px ring) */
  size: number
  /** tile border-radius: a number, or '50%' for the person circle */
  round: number | string
  /** station-ring border-radius — the 13px ring keeps the kind's square-vs-
   *  circle distinction at a SMALLER radius (Explorer: 4, person '50%') */
  stationRound?: number | string
  /** the 24×24 stroked SVG path for this kind */
  glyph: string
  /** station ring border color (the kind hue) */
  ringColor: string
  /** station ring FILL — white by default (the "open" prospect ring); a filled
   *  station (kind hue) reads as the served/customer state, transit-style */
  stationFill?: string
  /** tile background */
  fill: string
  /** tile glyph ink */
  ink: string
  /** tile hairline — set for the "open" (tint-filled) tile variant */
  tileBorder?: string
  /** a BUNDLE of many nodes — render a stacked-card backing so it reads as "many"
   *  (scale honesty: the count lives in the name, the stack signals the collapse) */
  stack?: boolean
  /** scored HIGH risk — the mark wears the danger ring (the reserved intent
   *  channel: a ring like the focus/selection rings, never a red badge). On
   *  the paint-budget station tier the ring IS the mark, so its border takes
   *  the danger ink instead. */
  riskRing?: boolean
}

/** The mark box contents: a station ring, or a glyph tile. Sits inside the
 *  mode's `.g-tilebox`. */
export function Mark({ m }: { m: MarkStyle }) {
  if (m.station) {
    return (
      <span
        className='g-station'
        style={{
          borderColor: m.riskRing ? 'var(--g-intent-danger)' : m.ringColor,
          borderRadius: m.stationRound ?? 4,
          ...(m.stationFill ? { background: m.stationFill } : {})
        }}
      />
    )
  }
  return (
    <div
      className={[
        'g-tile',
        m.stack ? 'g-stack' : '',
        m.riskRing ? 'g-riskring' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        width: m.size,
        height: m.size,
        borderRadius: m.round,
        background: m.fill,
        color: m.ink,
        ...(m.tileBorder ? { border: `1.5px solid ${m.tileBorder}` } : {}),
        // a bundle's stacked-card backing lives in CSS (.g-stack) so it COMPOSES with
        // the focus/hover ring shadows — an inline box-shadow would override them
        ...(m.stack ? { ['--g-stackfill' as string]: m.fill } : {})
      }}
    >
      <svg
        width={m.size * 0.54}
        height={m.size * 0.54}
        viewBox='0 0 24 24'
        aria-hidden='true'
      >
        <path
          d={m.glyph}
          fill='none'
          stroke='currentColor'
          strokeWidth='1.7'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
      </svg>
    </div>
  )
}

/** CANVAS VOICE 2 — the station meta caption. When a risk severity is given and
 *  the line has interpuncts, the hue inks the interpunct only (a one-character
 *  signal, never a badge — TYPOGRAPHY.md). */
export function MetaLine({
  meta,
  risk
}: {
  meta: string
  risk?: 'high' | 'medium' | 'low'
}) {
  if (!risk || !meta.includes('·')) return <div className='g-sub'>{meta}</div>
  const parts = meta.split('·').map(p => p.trim())
  return (
    <div className='g-sub'>
      {parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && <span className={`g-subsep g-subsep-${risk}`}>·</span>}
          {p}
        </Fragment>
      ))}
    </div>
  )
}

/** The resting nameplate: a hairline card with the station name, an optional
 *  identity second line (`sub` — an address's locality, always printed), and,
 *  on the printing tiers, a meta caption. `style` is the placed slot (see
 *  {@link nameplateStyle}); the mode passes it from the label solver.
 *  `mq` = meta rests quiet (beyond the printed-word budget — the words return
 *  on hover/bloom exactly like a world card's, via the .g-metaq CSS); `sub`
 *  is identity, not meta, so the budget and the tier gate never touch it. */
export function Nameplate({
  name,
  sub,
  meta,
  risk,
  mq,
  style
}: {
  name: string
  sub?: string
  meta?: string
  risk?: 'high' | 'medium' | 'low'
  mq?: boolean
  style: CSSProperties
}) {
  return (
    <div className={`g-label${mq ? ' g-metaq' : ''}`} style={style}>
      <div className='g-name'>{name}</div>
      {sub && <div className='g-name2'>{sub}</div>}
      {meta && <MetaLine meta={meta} risk={risk} />}
    </div>
  )
}

/** One fact of the focus plate: micro label over the weighted value. The
 *  packer (plate.ts) already dropped empty/'—' cells and decided the row
 *  shape — this only paints. */
export function PlateCell({ f }: { f: PlateFact }) {
  return (
    <span className='g-cell'>
      <span className='g-celllabel'>{f[0]}</span>
      <span className='g-cellvalue'>{f[1]}</span>
    </span>
  )
}

/** The ledger plate — one per screen. The nameplate's own grammar, scaled up
 *  (name · caption · rule · facts · rule · utility foot) on a left rail:
 *  `packFacts` (plate.ts) packs the fact band — a verdict fact takes the
 *  whole band and wraps to two lines, two adjacent short facts share a row —
 *  and the SAME packing sizes the solver's reserved rect (plateDims), so
 *  paint and placement can't drift. An all-empty band collapses entirely
 *  (rule and all). `utility` is the node's own exception (the anomaly),
 *  inked by its risk. */
export function Plate({
  caption,
  name,
  subhead,
  cells,
  utility,
  style
}: {
  caption: string
  name: string
  /** the identity's second line (locality) — one line, between name and caption */
  subhead?: string
  cells: (PlateFact | null)[]
  utility?: PlateUtility
  style: CSSProperties
}) {
  const rows = packFacts(cells)
  // the width is the plate's OWN decision, made from the same packing that
  // sizes it: the full measure exists for fact lines to wrap on; a header-
  // only card hugs at the browser's true max-content instead (plateDims
  // reserves a matching, deliberately wider rect for the solver)
  const hug = rows.length === 0 && !utility
  const width: CSSProperties = hug
    ? { maxWidth: PLATE_W, width: 'max-content' }
    : { width: PLATE_W }
  return (
    <div className='g-label g-plate' style={{ ...width, ...style }}>
      <div className='g-name'>{name}</div>
      {subhead && <div className='g-platesub'>{subhead}</div>}
      {caption && <div className='g-caption'>{caption}</div>}
      {rows.length > 0 && (
        <>
          <div className='g-platerule' aria-hidden='true' />
          <div className='g-platerows'>
            {rows.map((row, i) => (
              <div
                key={i}
                className={
                  row.cells.length === 2 ? 'g-platerow g-pair' : 'g-platerow'
                }
              >
                {row.cells.map((f, j) => (
                  <PlateCell key={j} f={f} />
                ))}
              </div>
            ))}
          </div>
        </>
      )}
      {utility && (
        <>
          <div className='g-platerule' aria-hidden='true' />
          <div
            className={`g-plateutility${
              utility.risk === 'high'
                ? ' g-util-high'
                : utility.risk === 'medium'
                  ? ' g-util-medium'
                  : ''
            }`}
          >
            {utility.text}
          </div>
        </>
      )}
    </div>
  )
}

/** Where the nameplate/plate sits, in node-local coordinates. The node wrapper
 *  is a fixed 160px-wide column with the mark centered at x=80; a card's center
 *  is therefore expressed as (80 + dx, size/2 + dy) with dx/dy from the solver.
 *
 *  - focus  → the plate, centered on its solved slot (width from plateDims —
 *             the full measure with facts, a content hug without).
 *  - placed → a lit card the solver moved: TOP-anchored (top = center − cardH/2)
 *             so a pointed-at card grows its words DOWNWARD and the name never
 *             wiggles up. `cardH` is the card's rested height (name-only ≈ 26,
 *             +12 per printed line — locality, meta) — the same estimate
 *             handed to the solver.
 *  - home   → the resting slot: centered just below the mark. */
export function nameplateStyle(opts: {
  variant: 'focus' | 'placed' | 'home'
  size: number
  dx?: number
  dy?: number
  cardH?: number
}): CSSProperties {
  const { variant, size, dx, dy, cardH = 26 } = opts
  if (variant === 'focus') {
    // position only — the Plate owns its width (full measure vs. hug)
    return {
      left: 80 + (dx ?? 0),
      top: size / 2 + (dy ?? 0),
      transform: 'translate(-50%, -50%)'
    }
  }
  if (variant === 'placed') {
    return {
      maxWidth: 184,
      left: 80 + (dx ?? 0),
      top: size / 2 + (dy ?? 0) - cardH / 2,
      transform: 'translate(-50%, 0)'
    }
  }
  // home: centered below the mark, one 8px gap under it
  return {
    maxWidth: 184,
    left: 80,
    top: size + 8,
    transform: 'translate(-50%, 0)'
  }
}
