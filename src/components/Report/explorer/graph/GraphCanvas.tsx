/**
 * GraphCanvas — the calm graph render surface. An ordinary component: hand it a
 * `def` (frozen positions + the feature's own mark/edge/emphasis/label functions)
 * and a `view` (focus + hover) and it draws the map. No factory, no reusable-engine
 * contract — the feature (Explorer/KYB) supplies its `def` inline (see
 * `graphs/kyb/index.tsx`) and this component supplies the calm: the golden label
 * solver, the one travelling camera, the single brightness-only hover channel, and
 * identity-stable React-Flow reconciliation so a focus change re-renders dozens of
 * nodes, never all of them.
 *
 * The pure algorithms it composes live beside it as util modules (`layout`,
 * `bundle`, `surfacing`, `labels`, `camera`); React-Flow is used only for pan/zoom
 * and hit-testing — every position is ours.
 *
 * Ported from app/src/containers/Explorer/graph/GraphCanvas.tsx. Two changes:
 * the dev-only meters (`?lint=1` CalmLint, `?regions=1` RegionsLab) are not
 * ported, and `scrollPans` lets a canvas EMBEDDED in a scrolling page hand the
 * wheel back to the page (the app's canvas is the whole page, so it pans).
 */
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from 'react'
import {
  EdgeLabelRenderer,
  Handle,
  Position,
  ReactFlow,
  useUpdateNodeInternals
} from '@xyflow/react'
import type {
  Edge as RFEdge,
  Node as RFNode,
  NodeProps,
  EdgeProps,
  NodeTypes,
  EdgeTypes
} from '@xyflow/react'
import { Mark, Nameplate, Plate, nameplateStyle, type MarkStyle } from './Marks'
import { TransitEdge, type EdgeView } from './Edges'
import { RegionLayer } from './Regions'
import {
  ENTRANCE,
  edgeEntrance,
  entranceDelays,
  entranceSpan
} from './entrance'
import type { RegionSpec } from './regionModel'
import { CanvasHover, useHoverPointer, type HoverNeighbor } from './Hover'
import { useRefit, useSidebarPeek, useTravel } from './camera'
import {
  applyMetaBudget,
  CARD_GAP,
  cardDims,
  placeLabels,
  type LabelItem,
  type MarkRect,
  type Placement
} from './labels'
import { surfaceChips, type ChipCandidate, type PlacedChip } from './surfacing'
import { insetFraming, type Bounds, type EdgeGeo, type XY } from './layout'
import { plateDims, type PlateData } from './plate'

/* ------------------------------------------------------------------ */
/* The def a feature supplies                                          */
/* ------------------------------------------------------------------ */

export interface BaseNode {
  id: string
  name: string
}
export interface BaseEdge {
  id: string
  from: string
  to: string
}

/** plate content lives with its geometry (plate.ts) — re-exported here so a
 *  mode's def can type `plateOf` without reaching past the kernel surface */
export type { PlateData } from './plate'
/** region-label content lives with its model (regionModel.ts) — same idiom */
export type { RegionSpec } from './regionModel'

/** the feature's live view: focus + hover + selection + a feature-owned ctx
 *  (filters, lenses…). `ctx` must be reference-stable while unchanged
 *  (memoize it in the feature). */
export interface GraphViewState<C = unknown> {
  focusId: string | null
  hoverId: string | null
  /** where the hover came from — the PANEL peek only fires for 'panel' */
  hoverFrom?: { readonly current: 'panel' | 'canvas' }
  /** the multi-select set — marks wear their kind-ink ring while in it.
   *  A view concern beside focus/hover: selection changes brightness and
   *  chrome, never emphasis, labels, or the camera. */
  selectedIds?: ReadonlySet<string>
  ctx: C
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
  /** shift+click routes here (a selection toggle), never to onSelect */
  onToggleSelect?: (id: string) => void
  onPaneClick?: () => void
}

export interface GraphDef<
  N extends BaseNode = BaseNode,
  E extends BaseEdge = BaseEdge,
  C = unknown
> {
  nodes: N[]
  edges: E[]
  /** frozen world positions (mark centers) */
  posOf: Record<string, XY>
  /** frozen edge geometry (octilinear limbs, arcs…) */
  edgeGeo: Record<string, EdgeGeo>

  /* -- marks -- */
  markOf: (n: N, em: string) => MarkStyle
  tileSize: (n: N) => number

  /* -- the emphasis model -- */
  /** tier per node for the current view — the feature's scope/filter/lens logic */
  emphasisOf: (view: GraphViewState<C>) => Map<string, string>
  /** the same ladder keyed by focus alone, for callers OUTSIDE the view
   *  pipeline (sweep-select targets). Provide it when your emphasis reads
   *  nothing but the focus; omit it and such callers must build a full view. */
  emphasisFor?: (focusId: string | null) => Map<string, string>
  /** tier per edge, given its endpoint tiers */
  edgeEmphasisOf: (
    e: E,
    aEm: string,
    bEm: string,
    view: GraphViewState<C>
  ) => string
  /** tiers whose marks render as quiet station rings (label-solver `minor`) */
  stationTiers?: ReadonlySet<string>
  /** tiers that carry a placed nameplate (default: lit + focus) */
  labeledTiers?: ReadonlySet<string>

  /* -- card content -- */
  metaOf?: (
    em: Map<string, string>,
    view: GraphViewState<C>
  ) => Map<string, string>
  /** meta lines that must always print (anomalies — exempt from the budget) */
  alwaysPrintMeta?: (n: N) => boolean
  metaBudget?: number
  /** the focus card's content — a PURE function of the node is enough: the
   *  kernel reuses the previous object while the node and its focus tenure
   *  survive, so identity-based bailouts hold without mode-side caching */
  plateOf?: (n: N) => PlateData | undefined
  /** split display lines for a node's card (an address's street over its
   *  locality): `name` stays the bold line, `sub` an ALWAYS-printed identity
   *  second line — identity, not meta, so the printed-word budget and the
   *  tier gate never touch it. Omit for the single-line `name`. */
  nameLinesOf?: (n: N) => { name: string; sub?: string }
  /** severity that inks the meta line's interpuncts (MetaLine) — the
   *  canvas's one-character risk signal, never a badge */
  metaRiskOf?: (n: N) => 'high' | 'medium' | undefined
  /** the view's region labels (the quiet areal words behind an open fan).
   *  Keyed by focus + ctx alone, like `emphasisOf` — a result read from
   *  hover/selection would go stale. Return STABLE array identities per
   *  region set: the keyed spans (and their fade-in) live exactly as long
   *  as the layer they mount in, so a same-array re-render never replays
   *  the entrance. Empty/omitted → no layer. */
  regionsOf?: (view: GraphViewState<C>) => readonly RegionSpec[]

  /* -- edges -- */
  edgeView: (e: E, em: string, geo: EdgeGeo) => EdgeView
  /** array paint order within the edge layer (higher paints later/on top) */
  edgePaintRank?: (e: E, em: string) => number

  /* -- surfacing (DESIGN.md law 5) -- */
  /** the edges that EARN a chip for this view (feature semantics: which kinds
   *  qualify, which neighbors' cards already carry their exception). The canvas
   *  applies the law: distinctive-only, cap, anchor+slide, fall-to-card. */
  chipCandidates?: (
    view: GraphViewState<C>,
    em: Map<string, string>
  ) => ChipCandidate[]
  chipCap?: number

  /* -- camera + hover + clicks -- */
  framing: (view: GraphViewState<C>) => Bounds | null
  /** the sidebar PEEK frame per node (omit = no peek) — pointing from the
   *  panel gently previews where a click would take you */
  peekFraming?: (id: string, view: GraphViewState<C>) => Bounds | null
  hoverNeighbors: (id: string) => HoverNeighbor[]
  /** route a node click (default: onSelect) */
  onNodeClick?: (id: string, view: GraphViewState<C>) => void

  /* -- ReactFlow bundle -- */
  minZoom?: number
  maxZoom?: number
  /** the canvas element's feature class (e.g. 'kyb-canvas') — `g-canvas` is added */
  canvasClass: string
}

/* ------------------------------------------------------------------ */

/**
 * `sig` — the CONTENT SIGNATURE, and why it exists.
 *
 * A renderer reads its subject's content (name, meta, kind, risk) through
 * `engineRef`, not through `data` — that indirection is what keeps
 * `nodeTypes`/`edgeTypes` identity-stable, which is what stops React Flow
 * remounting the whole map on a graph change. The cost: the two places that
 * decide "nothing changed, reuse the old element" only ever saw VIEW fields,
 * so an edit to a node's content under a SURVIVING id would keep the stale
 * render forever.
 *
 * The signature closes that. It's the source object itself: a world is rebuilt
 * (fresh objects) exactly when graph data changes and never on a view change,
 * so reference identity is a precise content signature — a content edit
 * re-renders, and hover/focus/selection churn still doesn't.
 */
interface NData {
  id: string
  em: string
  lx?: number
  ly?: number
  meta?: string
  mq?: boolean
  plate?: PlateData
  /** the source node object — compared by reference only (see above) */
  sig?: unknown
  /** ms until this mark arrives — set while it enters, absent once settled */
  enter?: number
  [k: string]: unknown
}
interface EData {
  eid: string
  em: string
  /** ms until this line arrives, when it enters with a mark */
  enter?: number
  /** the source edge object — compared by reference only (see above) */
  sig?: unknown
  /** the built EdgeGeo — reference-compared like sig: a re-layout can move an
   *  edge's path under a SURVIVING edge object (a session graph mutation
   *  reuses untouched edges), and the path must repaint when it does */
  geo?: unknown
  [k: string]: unknown
}
type GNode = RFNode<NData, 'entity'>
type GEdge = RFEdge<EData, 'quiet'>

const EMPTY_REGIONS: readonly RegionSpec[] = []

const DEFAULT_STATION_TIERS: ReadonlySet<string> = new Set([
  'world',
  'ghost',
  'faded',
  'hidden'
])
const DEFAULT_LABELED: ReadonlySet<string> = new Set(['lit', 'focus'])

/** The zoom the travel camera's `fitBounds({ padding: 0.12 })` lands on, as a
 *  scale factor — so the pre-mount estimate and the inset math agree with the
 *  real fit instead of drifting a few percent from it. */
const FIT_PAD_SCALE = 0.893

/** the silas focus ring's growth beyond the tile (3+2+1.5 per side) — the
 *  solver reserves clear of the RING, and frame composition previews the
 *  same inflation for a not-yet-focused peek subject */
const FOCUS_RING = 13

/** the static, def-derived render inputs — the RF node/edge arrays and the id
 *  lookups. Rebuilt per `def` (cheap data); the renderer SHELLS live outside
 *  (see makeRenderers) so their identity survives a graph change. */
function buildEngine<N extends BaseNode, E extends BaseEdge, C>(
  def: GraphDef<N, E, C>
) {
  const nodeById: Record<string, N> = Object.fromEntries(
    def.nodes.map(n => [n.id, n])
  )
  const edgeById: Record<string, E> = Object.fromEntries(
    def.edges.map(e => [e.id, e])
  )
  const stationTiers = def.stationTiers ?? DEFAULT_STATION_TIERS
  const labeledTiers = def.labeledTiers ?? DEFAULT_LABELED

  /* ---------- static RF inputs ---------- */
  const baseNodes: GNode[] = def.nodes
    .filter(n => def.posOf[n.id])
    .map(n => {
      const p = def.posOf[n.id]
      const h = def.tileSize(n)
      return {
        id: n.id,
        type: 'entity' as const,
        position: { x: p.x - 80, y: p.y - h / 2 },
        data: { id: n.id, em: 'world' },
        draggable: false,
        selectable: false,
        style: { width: 160 },
        // the `measured` hint keeps handle bounds across data swaps so edges
        // never unmount on a focus change (the RF remount trap)
        measured: { width: 160, height: h }
      }
    })
  const baseEdges: GEdge[] = def.edges
    .filter(e => def.posOf[e.from] && def.posOf[e.to])
    .map(e => ({
      id: e.id,
      source: e.from,
      target: e.to,
      type: 'quiet' as const,
      data: { eid: e.id, em: 'rest' },
      selectable: false,
      focusable: false
    }))

  return {
    nodeById,
    edgeById,
    stationTiers,
    labeledTiers,
    baseNodes,
    baseEdges
  }
}

/** the renderer shells — built ONCE per canvas instance and fed the LIVE
 *  def/lookups through a ref, so `nodeTypes`/`edgeTypes` never change identity.
 *  React Flow remounts every node when nodeTypes changes; with the ref
 *  indirection a graph mutation (a session switch, an added node) reconciles
 *  instead. Content reached through the ref is covered by `data.sig` (see
 *  NData), so a def swap that edits a node under a surviving id still
 *  repaints. */
function makeRenderers<N extends BaseNode, E extends BaseEdge, C>(engineRef: {
  readonly current: {
    def: GraphDef<N, E, C>
    nodeById: Record<string, N>
    edgeById: Record<string, E>
  }
}) {
  const EntityNode = memo(
    function EntityNode({ data }: NodeProps<GNode>) {
      const { def, nodeById } = engineRef.current
      const { id, em, lx, ly, meta, mq, plate, sel, enter } = data
      const n = nodeById[id]
      if (!n) return null

      const m = def.markOf(n, em)
      const lines = def.nameLinesOf?.(n) ?? { name: n.name }
      const dims = cardDims({
        nameLen: lines.name.length,
        subLen: lines.sub?.length,
        metaLen: meta?.length,
        mq
      })
      const label =
        em === 'focus' && plate ? (
          <Plate
            caption={plate.caption}
            name={lines.name}
            subhead={plate.subhead}
            cells={plate.cells}
            utility={plate.utility}
            style={nameplateStyle({
              variant: 'focus',
              size: m.size,
              dx: lx,
              dy: ly
            })}
          />
        ) : (
          <Nameplate
            name={lines.name}
            sub={lines.sub}
            meta={meta}
            risk={def.metaRiskOf?.(n)}
            mq={mq}
            style={
              lx !== undefined && ly !== undefined
                ? nameplateStyle({
                    variant: 'placed',
                    size: m.size,
                    dx: lx,
                    dy: ly,
                    cardH: dims.h
                  })
                : nameplateStyle({ variant: 'home', size: m.size })
            }
          />
        )

      return (
        <div
          className={`g-node g-em-${em}${enter !== undefined ? ' g-enter' : ''}`}
          data-gid={id}
          // the selection ring reads this — one CSS rule, every kind's own ink
          style={{
            ['--g-selink' as string]: m.ringColor,
            ...(enter !== undefined
              ? { ['--g-enter' as string]: `${enter}ms` }
              : {})
          }}
        >
          <Handle
            type='target'
            position={Position.Top}
            isConnectable={false}
            className='g-handle'
            style={{ top: m.size / 2 }}
          />
          <Handle
            type='source'
            position={Position.Top}
            isConnectable={false}
            className='g-handle'
            style={{ top: m.size / 2 }}
          />
          <div className='g-tilebox' style={{ width: m.size, height: m.size }}>
            <Mark m={m} />
            {/* the selection check — an explicit "picked" mark, one accent
                everywhere (tiles only: a station is 13px inside this full-size
                box, so its signal is the ink FILL, painted in CSS) */}
            {sel === true && !m.station && (
              <span aria-hidden='true' className='g-selbadge'>
                <svg height={10} viewBox='0 0 16 16' width={10}>
                  <path
                    d='M3 8.5l3.2 3L13 5'
                    fill='none'
                    stroke='currentColor'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2.2'
                  />
                </svg>
              </span>
            )}
          </div>
          {label}
        </div>
      )
    },
    (a, b) =>
      a.data.id === b.data.id &&
      a.data.em === b.data.em &&
      a.data.lx === b.data.lx &&
      a.data.ly === b.data.ly &&
      a.data.meta === b.data.meta &&
      a.data.mq === b.data.mq &&
      a.data.plate === b.data.plate &&
      a.data.sel === b.data.sel &&
      // content, not view: a graph edit under a surviving id must repaint
      a.data.sig === b.data.sig
  )

  const QuietEdge = memo(
    function QuietEdge({ id, data }: EdgeProps<GEdge>) {
      const { def, edgeById } = engineRef.current
      const e = edgeById[id]
      const g = def.edgeGeo[id]
      if (!e || !g || !data) return null
      const line = (
        <TransitEdge
          id={id}
          view={def.edgeView(e, data.em, g)}
          className={`g-e-${data.em}`}
        />
      )
      return data.enter !== undefined ? (
        <g
          className='g-enter'
          style={{ ['--g-enter' as string]: `${data.enter}ms` }}
        >
          {line}
        </g>
      ) : (
        line
      )
    },
    (a, b) =>
      a.id === b.id &&
      a.data?.em === b.data?.em &&
      a.data?.sig === b.data?.sig &&
      a.data?.enter === b.data?.enter &&
      // geometry, not view: a re-layout under a surviving edge must repaint
      a.data?.geo === b.data?.geo
  )

  return {
    nodeTypes: { entity: EntityNode } as NodeTypes,
    edgeTypes: { quiet: QuietEdge } as EdgeTypes
  }
}

/* ------------------------------------------------------------------ */
/* the canvas                                                          */
/* ------------------------------------------------------------------ */

export function GraphCanvas<
  N extends BaseNode,
  E extends BaseEdge,
  C = unknown
>({
  def,
  view,
  children,
  sidebarWidth,
  focusInsetLeft,
  scrollPans = true
}: {
  def: GraphDef<N, E, C>
  view: GraphViewState<C>
  children?: ReactNode
  /** px of the stage the sidebar occupies beside the canvas (0 when closed).
   *  Informs the pre-mount first-frame framing estimate, and a change — a
   *  committed resize, an open/close — recomposes the camera once (debounced).
   *  Pass the COMMITTED width only, never a per-frame drag value. */
  sidebarWidth?: number
  /** px of the canvas's LEFT edge a floating companion covers (the agent dock
   *  over the lower-left). Every frame the camera composes shifts so the focus
   *  lands in the middle of what's VISIBLE rather than centred underneath the
   *  companion — see `composeFrame`. 0 disables it. */
  focusInsetLeft?: number
  /** true (the app's full-page canvas): the wheel pans the map. false (a
   *  canvas embedded in a scrolling page): the wheel scrolls the PAGE, and
   *  the map pans by drag and zooms by pinch or ⌘/Ctrl + wheel. */
  scrollPans?: boolean
}) {
  const updateInternals = useUpdateNodeInternals()
  const [ready, setReady] = useState(false)
  const [resizeTick, setResizeTick] = useState(0)
  const busy = useRef(false)
  const canvasRef = useRef<HTMLDivElement>(null)
  /** card slots survive focus changes — stillness (the golden solver's law) */
  const prevPlaced = useRef(
    new Map<string, { cx: number; cy: number; w: number; h: number }>()
  )
  /* the identity-stable builders' caches — declared BEFORE the engine memo so
     a def change can invalidate them in the same render pass, before any
     derived memo reads them */
  const prevNodes = useRef(new Map<string, GNode>())
  const prevEdges = useRef(new Map<string, GEdge>())
  const graphVersionRef = useRef(0)
  const settledIds = useRef<ReadonlySet<string>>(new Set())

  /* a def change (a session switch, an added node) rebuilds the engine AND
     flushes every identity cache: a stale absolute label slot strands a moved
     mark's nameplate (the prevPlaced trap), and stale node/edge objects would
     resurrect the pre-change graph. graphVersion rides along so the travel
     camera can glide-refit the new world. */
  const { engine, graphVersion } = useMemo(() => {
    prevPlaced.current.clear()
    prevNodes.current.clear()
    prevEdges.current.clear()
    graphVersionRef.current += 1
    return { engine: buildEngine(def), graphVersion: graphVersionRef.current }
  }, [def])
  const {
    nodeById,
    edgeById,
    stationTiers,
    labeledTiers,
    baseNodes,
    baseEdges
  } = engine

  /* the live seam the stable renderer shells read through (see makeRenderers) */
  const engineRef = useRef({ def, nodeById, edgeById })
  engineRef.current = { def, nodeById, edgeById }
  // the live view, for compose-time reads (composeFrame) that must not key a
  // callback's identity to focus churn — the camera hooks already re-run on
  // the frames themselves
  const viewRef = useRef(view)
  viewRef.current = view
  const entering = useMemo(() => {
    const seen = settledIds.current
    return entranceDelays({
      nodes: def.nodes,
      edges: def.edges,
      posOf: def.posOf,
      origin: viewRef.current.focusId,
      seen,
      timing: ENTRANCE
    })
  }, [def])
  useEffect(() => {
    settledIds.current = new Set(def.nodes.map(n => n.id))
  }, [def])
  const enteringSpan = entranceSpan(entering)
  // …and the live label placements, for the same reads (assigned below,
  // right after the solver memo — fresh by the time any camera composes)
  const placedRef = useRef<Map<string, Placement> | null>(null)
  const { nodeTypes, edgeTypes } = useMemo(
    () => makeRenderers<N, E, C>(engineRef),
    []
  )

  /**
   * Every frame the camera composes goes through here — first frame, travel,
   * refit, peek — with an explicit SUBJECT: the node the frame exists to
   * show (the focus for travel/refit/home, the peeked node for a peek).
   *
   * Two jobs, both about the subject's PLATE (state read through refs —
   * compose-time values, never callback identity):
   *  1. HOLD it in the bounds. The def's framing spans mark centers; the
   *     plate extends `PLATE_W/2` sideways and hangs below its slot — the
   *     kernel unions the card's rect (the SOLVED slot when the subject is
   *     the focus; the home slot as the preview for a not-yet-focused peek)
   *     so a small scope can't crop the card at the stage seam.
   *  2. Keep it clear of a floating companion. `insetFraming` shifts the
   *     frame off the covered band without shrinking; `keepVisible` caps the
   *     shift so the subject's own card never slides off the far edge.
   */
  const composeFrame = useCallback(
    (b: Bounds | null, subjectId: string | null): Bounds | null => {
      if (!b) return b
      const { def: liveDef, nodeById: liveNodes } = engineRef.current
      const n = subjectId ? liveNodes[subjectId] : undefined
      const p = subjectId && n ? liveDef.posOf[subjectId] : undefined
      const plate = n && p ? liveDef.plateOf?.(n) : undefined
      let bounds = b
      let keepVisible: { left: number; right: number } | undefined
      if (n && p && plate) {
        const name = liveDef.nameLinesOf?.(n)?.name ?? n.name
        const dims = plateDims(name, plate)
        // the solved slot exists only while the subject IS the focus; a peek
        // previews the post-travel home slot (below-centered, ring included)
        const slot =
          subjectId === viewRef.current.focusId
            ? placedRef.current?.get(subjectId ?? '')
            : undefined
        const cx = p.x + (slot?.dx ?? 0)
        const cy =
          p.y +
          (slot?.dy ??
            (liveDef.tileSize(n) + FOCUS_RING) / 2 + CARD_GAP + dims.h / 2)
        const halfW = dims.w / 2 + 12
        const left = Math.min(bounds.x, cx - halfW)
        const right = Math.max(bounds.x + bounds.width, cx + halfW)
        const bottom = Math.max(bounds.y + bounds.height, cy + dims.h / 2 + 12)
        bounds = {
          x: left,
          y: bounds.y,
          width: right - left,
          height: bottom - bounds.y
        }
        keepVisible = { left: cx - halfW, right: cx + halfW }
      }
      if (!focusInsetLeft) return bounds
      const el = canvasRef.current
      return insetFraming(bounds, {
        insetLeft: focusInsetLeft,
        availW: Math.max(
          420,
          el?.clientWidth ?? window.innerWidth - (sidebarWidth ?? 0)
        ),
        availH: Math.max(420, el?.clientHeight ?? window.innerHeight),
        padScale: FIT_PAD_SCALE,
        // the same limits the camera itself honours, so the predicted zoom is
        // the zoom the fit actually lands on
        minZoom: def.minZoom ?? 0.14,
        maxZoom: def.maxZoom ?? 1.7,
        keepVisible
      })
    },
    [def.maxZoom, def.minZoom, focusInsetLeft, sidebarWidth]
  )

  /* the FIRST frame must already be the composed frame — computing the rest
     fit before React Flow's first render kills the one wrong-zoom flash on
     load. (Estimated from the window; the instant first fit then corrects
     with the real canvas size in the same beat.) */
  const [defaultViewport] = useState(() => {
    const b = composeFrame(def.framing(view), view.focusId)
    if (!b || typeof window === 'undefined') return undefined
    const w = Math.max(420, window.innerWidth - (sidebarWidth ?? 0)) // minus the sidebar
    const h = Math.max(420, window.innerHeight)
    const zoom = Math.min(
      def.maxZoom ?? 1.7,
      Math.max(
        def.minZoom ?? 0.14,
        // match the travel camera's fitBounds padding (0.12) so the instant
        // first fit lands on the SAME zoom — no ~5% snap on the first frame
        Math.min(w / b.width, h / b.height) * FIT_PAD_SCALE
      )
    )
    return {
      x: w / 2 - (b.x + b.width / 2) * zoom,
      y: h / 2 - (b.y + b.height / 2) * zoom,
      zoom
    }
  })

  useEffect(() => {
    let t = 0
    const onResize = () => {
      window.clearTimeout(t)
      t = window.setTimeout(() => setResizeTick(x => x + 1), 180)
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.clearTimeout(t)
    }
  }, [])

  const emOf = useMemo(
    () => def.emphasisOf(view),
    [def, view.focusId, view.ctx]
  )
  /* region labels re-derive on travel/graph change only — never during
     camera motion (they live INSIDE the viewport transform) */
  const regions = useMemo(
    () => def.regionsOf?.(view) ?? EMPTY_REGIONS,
    [def, view.focusId, view.ctx]
  )
  const metaOf = useMemo(
    () => def.metaOf?.(emOf, view) ?? new Map<string, string>(),
    [def, emOf, view.focusId, view.ctx]
  )

  /* the GOLDEN solver: hysteresis, print occlusion, the printed-word budget */
  const placed = useMemo(() => {
    const items: LabelItem[] = []
    const marks: MarkRect[] = []
    const budgetItems: {
      id: string
      em: string
      x: number
      y: number
      hasMeta: boolean
      alwaysPrint?: boolean
    }[] = []
    for (const n of def.nodes) {
      const em = emOf.get(n.id)
      if (!em || em === 'hidden') continue
      const p = def.posOf[n.id]
      if (!p) continue
      const minor = stationTiers.has(em)
      const s = minor ? 20 : def.tileSize(n) + 6
      marks.push({ cx: p.x, cy: p.y, w: s, h: s, minor })
      if (labeledTiers.has(em)) {
        budgetItems.push({
          id: n.id,
          em,
          x: p.x,
          y: p.y,
          hasMeta: Boolean(metaOf.get(n.id)),
          alwaysPrint: def.alwaysPrintMeta?.(n)
        })
      }
    }
    const center = view.focusId
      ? (def.posOf[view.focusId] ?? { x: 0, y: 0 })
      : { x: 0, y: 0 }
    const quiet = applyMetaBudget(budgetItems, center, def.metaBudget ?? 6)
    for (const bi of budgetItems) {
      const n = nodeById[bi.id]
      const em = bi.em
      const meta = metaOf.get(bi.id)
      const mq = quiet.has(bi.id)
      // the plate is an adaptive ruled form — hand the solver its TRUE
      // geometry (plateDims packs the same rows the renderer paints), never
      // a fixed guess. A focus with no plate reserves an honest nameplate.
      const lines = def.nameLinesOf?.(n) ?? { name: n.name }
      const plate = em === 'focus' ? def.plateOf?.(n) : undefined
      const dims = plate
        ? plateDims(lines.name, plate)
        : cardDims({
            nameLen: lines.name.length,
            subLen: lines.sub?.length,
            metaLen: meta?.length,
            mq
          })
      // the focus mark wears the silas ring (+~13px) — the plate must clear
      // the RING, not just the tile (the graze fix)
      items.push({
        id: bi.id,
        x: bi.x,
        y: bi.y,
        size: def.tileSize(n) + (em === 'focus' ? FOCUS_RING : 0),
        w: dims.w,
        h: dims.h,
        focus: em === 'focus'
      })
    }
    const solved = placeLabels(items, center, marks, prevPlaced.current)
    return { ...solved, quiet }
  }, [def, emOf, metaOf, view.focusId])
  placedRef.current = placed.pos

  /* surfacing chips — STATIC per focus (never hover): the one-fact law */
  const surfaced = useMemo(() => {
    if (!def.chipCandidates || !view.focusId)
      return { chips: [] as PlacedChip[], yielded: new Map<string, string>() }
    const candidates = def.chipCandidates(view, emOf)
    if (!candidates.length)
      return { chips: [] as PlacedChip[], yielded: new Map<string, string>() }
    return surfaceChips({
      focusId: view.focusId,
      candidates,
      edgeGeo: def.edgeGeo,
      neighborEnd: edgeId => {
        const e = edgeById[edgeId]
        const nb = candidates.find(c => c.edgeId === edgeId)
        return e && nb && e.to === nb.neighborId ? 'b' : 'a'
      },
      occupied: placed.occupied,
      cap: def.chipCap
    })
  }, [def, emOf, placed, view.focusId, view.ctx])

  /* identity-stable builders — a focus change reconciles dozens, never all */
  const rfNodes = useMemo<GNode[]>(() => {
    const out: GNode[] = []
    for (const bn of baseNodes) {
      const id = bn.id
      const n = nodeById[id]
      const em = emOf.get(id) ?? 'hidden'
      const p: Placement | undefined = placed.pos.get(id)
      const lx = p?.dx
      const ly = p?.dy
      // the node's exception (metaOf) wins the card; else a relationship that
      // couldn't get a chip FALLS here (DESIGN.md law 5); else name-only
      const meta = metaOf.get(id) ?? surfaced.yielded.get(id) ?? undefined
      const mq = placed.quiet.has(id) || undefined
      const sel = view.selectedIds?.has(id) || undefined
      const enter = entering.get(id)
      const prev = prevNodes.current.get(id) ?? bn
      const d = prev.data
      // plate identity survives the focus tenure: while the same node stays
      // focused (and its content object `sig` survives), reuse the minted
      // plate so a PURE plateOf still satisfies the identity bailouts below
      const plate =
        em === 'focus'
          ? d.em === 'focus' && d.sig === n && d.plate
            ? d.plate
            : def.plateOf?.(n)
          : undefined
      if (
        d.sig === n &&
        d.em === em &&
        d.lx === lx &&
        d.ly === ly &&
        d.meta === meta &&
        d.mq === mq &&
        d.plate === plate &&
        d.sel === sel &&
        d.enter === enter
      ) {
        out.push(prev)
        continue
      }
      // the z-tier rides the RF wrapper as a class (a swap, never a remount);
      // the selection ring rides the same seam
      const zClass =
        em === 'focus'
          ? 'g-znode-focus'
          : em === 'lit'
            ? 'g-znode-lit'
            : undefined
      const className =
        [zClass, sel && 'g-selected'].filter(Boolean).join(' ') || undefined
      const next: GNode = {
        ...bn,
        className,
        data: { id, em, lx, ly, meta, mq, plate, sel, sig: n, enter }
      }
      prevNodes.current.set(id, next)
      out.push(next)
    }
    return out
  }, [
    def,
    emOf,
    metaOf,
    placed,
    surfaced,
    view.ctx,
    view.selectedIds,
    entering
  ])

  const rfEdges = useMemo<GEdge[]>(() => {
    const built: GEdge[] = []
    for (const be of baseEdges) {
      const e = edgeById[be.id]
      const em = def.edgeEmphasisOf(
        e,
        emOf.get(e.from) ?? 'hidden',
        emOf.get(e.to) ?? 'hidden',
        view
      )
      const geo = def.edgeGeo[be.id]
      const enter = edgeEntrance(entering, e)
      const prev = prevEdges.current.get(be.id)
      if (
        prev &&
        prev.data?.em === em &&
        prev.data?.sig === e &&
        prev.data?.geo === geo &&
        prev.data?.enter === enter
      ) {
        built.push(prev)
        continue
      }
      const next: GEdge = {
        ...be,
        data: { eid: be.id, em, sig: e, geo, enter }
      }
      prevEdges.current.set(be.id, next)
      built.push(next)
    }
    const rank = def.edgePaintRank
    if (!rank) return built
    // array order is the ONLY sanctioned edge z-order (zIndex escapes the layer)
    return built.sort(
      (x, y) =>
        rank(edgeById[x.id], x.data?.em ?? 'rest') -
        rank(edgeById[y.id], y.data?.em ?? 'rest')
    )
  }, [def, emOf, view.focusId, view.ctx, entering])

  /* the travel camera. graphVersion in the deps = the gentle refit: an added
     node re-settles the layout, and the camera glides to the new frame (the
     travel hook already serializes overlapping flights). */
  const framing = useMemo(
    () => () => composeFrame(def.framing(view), view.focusId),
    [def, view.focusId, view.ctx, composeFrame]
  )
  useTravel({
    focusId: view.focusId,
    framing,
    canvasSelector: `.${def.canvasClass}`,
    busy,
    deps: [ready, resizeTick, view.ctx, graphVersion],
    padding: 0.12,
    enabled: ready
  })

  /* the refit — when the sidebar changes the stage's shape (resize commit,
     open/close) or the dock's footprint changes (minimize, expand), one
     debounced linear recompose (see useRefit in camera.ts) */
  useRefit({
    watch: `${sidebarWidth ?? 0}:${focusInsetLeft ?? 0}`,
    framing: () => composeFrame(def.framing(view), view.focusId),
    canvasSelector: `.${def.canvasClass}`,
    busy,
    enabled: ready
  })

  /* pointer + bloom */
  const { handlers, overCanvas } = useHoverPointer({
    busy,
    onHover: id => view.onHover(id)
  })

  /* the sidebar peek — the one sanctioned camera-hover, panel-only */
  useSidebarPeek({
    hoverId: view.hoverId,
    hoverFrom: view.hoverFrom,
    // the SUBJECT of a peek frame is the peeked node — its card, not the
    // current focus's, is what must stay held and visible
    framing: id => composeFrame(def.peekFraming?.(id, view) ?? null, id),
    homeFraming: () => composeFrame(def.framing(view), view.focusId),
    canvasSelector: `.${def.canvasClass}`,
    busy,
    overCanvas,
    enabled: ready && Boolean(def.peekFraming)
  })

  return (
    <div
      className={`${def.canvasClass} g-canvas`}
      ref={canvasRef}
      style={{
        ['--g-enter-duration' as string]: `${ENTRANCE.duration}ms`,
        ['--g-enter-label-lag' as string]: `${ENTRANCE.labelLag}ms`,
        ['--g-enter-regions' as string]:
          entering.size > 0
            ? `${enteringSpan + ENTRANCE.regionsAfter}ms`
            : '0ms'
      }}
      {...handlers}
    >
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultViewport={defaultViewport}
        minZoom={def.minZoom ?? 0.14}
        maxZoom={def.maxZoom ?? 1.7}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll={scrollPans}
        zoomOnScroll={scrollPans}
        preventScrolling={scrollPans}
        zoomOnDoubleClick={false}
        onInit={() => {
          window.setTimeout(() => updateInternals(def.nodes.map(n => n.id)), 60)
          setReady(true)
        }}
        onNodeClick={(event, node) => {
          // shift+click is a selection toggle, never a travel — the additive
          // gesture (Figma convention); plain click stays the map's core move
          if (event.shiftKey && view.onToggleSelect) {
            view.onToggleSelect(node.id)
            return
          }
          if (def.onNodeClick) def.onNodeClick(node.id, view)
          else view.onSelect(node.id)
        }}
        onPaneClick={() => view.onPaneClick?.()}
      >
        <RegionLayer regions={regions} />
        <CanvasHover
          hoverId={view.hoverId}
          neighbors={def.hoverNeighbors}
          rootRef={canvasRef}
        />
        <FocusEdgeLabels chips={surfaced.chips} />
      </ReactFlow>
      {children}
    </div>
  )
}

/** The relationship chips on the focus's edges (DESIGN.md law 5) — pure
 *  presentation; the decision of WHICH edges earn one lives upstream.
 *  STATIC — no hover, no per-frame. `--g-k` washes the chip in the
 *  relationship's line hue (graph.css). */
function FocusEdgeLabels({ chips }: { chips: PlacedChip[] }) {
  if (!chips.length) return null
  return (
    <EdgeLabelRenderer>
      {chips.map(c => (
        <div
          key={c.id}
          className='g-edgelabel'
          style={
            {
              ['--g-k']: c.color,
              transform: `translate(-50%, -50%) translate(${c.x}px, ${c.y}px)`
            } as CSSProperties
          }
        >
          {c.text}
        </div>
      ))}
    </EdgeLabelRenderer>
  )
}
