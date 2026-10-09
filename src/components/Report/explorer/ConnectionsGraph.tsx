/**
 * The related-businesses graph — this business, the businesses connected to
 * it, and the people, entities and addresses that tie them, drawn as the
 * dashboard's Explorer draws a KYB neighborhood: entities are stations, ties
 * are lines, and you TRAVEL it (click a mark) rather than drag it.
 *
 * Ported from app/src/containers/Explorer/Kyb.tsx. `makeKybDef` is the app's
 * def — marks, the emphasis ladder, the edge grammar, chips, plate, regions,
 * framing — with two def-level changes noted where they sit (token inks and
 * radii; chip words read from the tie). The host is the app's `Kyb` less what
 * this card has no room or use for:
 *  - no docked detail panel (the Related businesses list beside it is this
 *    graph's words — the panel's job), so no resizable drawer, no persisted
 *    panel width/open state (`useStorage`), and `sidebarWidth` is 0;
 *  - no multi-select, lasso, agent-dock bridge or session write-back;
 *  - the keyboard (Esc home, ← / → history) is scoped to this graph having
 *    focus — the app's listens on the window, which on a report page would
 *    steal the page's arrow keys;
 *  - the wheel scrolls the page, not the map (GraphCanvas `scrollPans`): pan
 *    by drag, zoom by pinch or ⌘/Ctrl + wheel.
 */
import { ReactFlowProvider, useReactFlow, useStore } from '@xyflow/react'
import { Minus, Plus } from 'lucide-react'

import { ActionButton, IconActionButton } from '@/core'
import '@xyflow/react/dist/style.css'
import { memo, useCallback, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'

import type { BusinessRecord } from '../../../lib/deriveResults'
import { cn } from '../../../utils/twUtils'
import { EDGE_INK, HUBGRAY, KIND, KIND_NOUN, STATION } from './constants'
import { connectionOfNode, fromConnections } from './fromConnections'
import { addressDisplayLines } from './graph/address'
import { flagFacts } from './graph/addressRisk'
import { worldFor, type GraphModel } from './graph/buildGraph'
import { STRENGTH_WIDTH, STRENGTH_Z, dashFor, strengthTier, type EdgeView } from './graph/Edges'
import { GraphCanvas, type GraphDef, type GraphViewState, type PlateData } from './graph/GraphCanvas'
import type { HoverNeighbor } from './graph/Hover'
import { KybLegend } from './graph/Legend'
import type { MarkStyle } from './graph/Marks'
import { addressRegionsByBundle, regionExtent, type RegionSpec } from './graph/regionModel'
import type { ChipCandidate } from './graph/surfacing'
import './graph/styles.css'
import type { KybEdge, KybGraph, KybNode } from './types'

type Connection = NonNullable<BusinessRecord['connections']>[number]

/** A tie read from `anchorId`'s side: `label` from the `from` end,
 *  `inverseLabel` from the `to` end (the app's panelModel `labelFrom`). */
const labelFrom = (edge: KybEdge, anchorId: string | null): string =>
  anchorId === edge.from ? edge.label : (edge.inverseLabel ?? edge.label)

/** the two-line address identity, ONE source for the def's `nameLinesOf`,
 *  the plate's subhead — bundles excluded: a minted sub-bundle name
 *  ("CA · 3") shares the ` · ` seam but is a count, never a street/locality pair */
export const kybNameLines = (
  n: Pick<KybNode, 'kind' | 'name' | 'bundle'>
): { name: string; sub?: string } =>
  n.kind === 'address' && !n.bundle ? addressDisplayLines(n.name) : { name: n.name }

/** The focused node's card content — KYB's plate semantics in one PURE
 *  function: every kind earns the card, the subtitle is the caption with the
 *  kind noun as the fallback, facts cap at 5, and the anomaly rides the
 *  risk-inked utility foot. */
export const kybPlateContent = (
  n: Pick<KybNode, 'kind' | 'name' | 'subtitle' | 'flags' | 'facts' | 'anomaly' | 'risk' | 'bundle'>
): PlateData => {
  const sub = kybNameLines(n).sub
  return {
    // ONE suppression rule: when a bundle's count-name or an address's
    // locality already states the kind, only the authored subtitle prints
    caption: n.bundle || sub ? (n.subtitle ?? '') : n.subtitle || KIND_NOUN[n.kind],
    subhead: sub,
    // an address's flags lead the fact band as grouped rows ("USPS · CMRA"),
    // authored facts follow — same 5-cell cap
    cells: [...flagFacts(n.flags ?? []), ...(n.facts ?? [])].slice(0, 5),
    utility: n.anomaly ? { text: n.anomaly, risk: n.risk } : undefined
  }
}

/** the KYB graph definition (the app's `makeKybDef`) */
export function makeKybDef(
  world: GraphModel,
  canvasClass: string,
  /** PROTOTYPE: narrowed to one related business, the whole small graph is in
   *  frame and fully drawn — the business, this one, and every tie between. */
  whole = false
): GraphDef<KybNode, KybEdge, undefined> {
  const { nodes, edges, posOf, edgeGeo, nodeById, neighborsOf, scopeOf, boundsOf } = world

  const tileOf = (n: KybNode) => (n.kind === 'business' ? 52 : 44)

  // the quiet geography, derived once per world: per address bundle, one
  // region per state (stable array identity — a fan's labels fade in when it
  // opens, never re-fade as the focus walks its members)
  const { regionsOf: regionsByBundle, ownerOf: regionOwnerOf } = addressRegionsByBundle(world)
  const NO_REGIONS: RegionSpec[] = []
  const fanRegions = (focusId: string | null): RegionSpec[] => {
    if (!focusId) return NO_REGIONS
    const bid = regionsByBundle.has(focusId) ? focusId : regionOwnerOf.get(focusId)
    return (bid && regionsByBundle.get(bid)) || NO_REGIONS
  }

  // ONE frame for travel and peek: mark bounds, then union the open fan's
  // region words (ViewportPortal content sits outside fitView bounds)
  const frameFor = (focusId: string | null) => {
    // PROTOTYPE: a tighter margin than the app's 130 — in a report card the
    // focus (Zendesk at home) should fill the frame, its neighbours close round it
    const b = boundsOf(focusId && !whole ? [...scopeOf(focusId)] : nodes.map(n => n.id), 50)
    const regions = fanRegions(focusId)
    if (!b || regions.length === 0) return b
    let left = b.x
    let top = b.y
    let right = b.x + b.width
    let bottom = b.y + b.height
    for (const r of regions) {
      const e = regionExtent(r)
      left = Math.min(left, e.x)
      top = Math.min(top, e.y)
      right = Math.max(right, e.x + e.width)
      bottom = Math.max(bottom, e.y + e.height)
    }
    return { x: left, y: top, width: right - left, height: bottom - top }
  }

  // the ladder, keyed by focus alone: focus → lit (first degree, full tiles)
  // → world (second degree, station rings) → hidden (fog)
  const tiersFor = (focusId: string | null): Map<string, string> => {
    const m = new Map<string, string>()
    if (whole) {
      for (const n of nodes) m.set(n.id, n.id === focusId ? 'focus' : 'lit')
      return m
    }
    if (!focusId) {
      for (const n of nodes) m.set(n.id, 'world')
      return m
    }
    for (const n of nodes) m.set(n.id, 'hidden')
    m.set(focusId, 'focus')
    for (const nb of neighborsOf(focusId)) {
      if (nb.node.id === focusId) continue // a self-loop must not demote the focus
      m.set(nb.node.id, 'lit')
      for (const nb2 of neighborsOf(nb.node.id))
        if (!m.has(nb2.node.id) || m.get(nb2.node.id) === 'hidden') m.set(nb2.node.id, 'world')
    }
    return m
  }

  return {
    nodes,
    edges,
    posOf,
    edgeGeo,
    tileSize: tileOf,
    markOf: (n, em): MarkStyle => {
      const k = KIND[n.kind]
      // hubs (registered agent / mass address) always read as muted context
      const ring = n.hub ? HUBGRAY : k.ink
      const isBundle = Boolean(n.bundle)
      // the FOCUS always gets a full tile + the silas ring — even a hub
      const station = em === 'focus' ? false : n.hub ? true : STATION.has(em)
      return {
        station,
        size: tileOf(n),
        round: k.round,
        stationRound: n.kind === 'person' ? '50%' : 'var(--core-radius-xs)',
        glyph: k.glyph,
        ringColor: ring,
        fill: ring,
        // PROTOTYPE: the app's glyph is '#fff'; here it is the surface token,
        // so the glyph stays knocked out of the tile when the inks lighten in dark
        ink: 'var(--core-color-surface-default)',
        stack: isBundle && !station,
        riskRing: n.risk === 'high' || undefined
      }
    },
    emphasisFor: tiersFor,
    emphasisOf: view => tiersFor(view.focusId),
    edgeEmphasisOf: (e, aEm, bEm, view) =>
      view.focusId && (e.from === view.focusId || e.to === view.focusId)
        ? 'focus'
        : aEm === 'hidden' || bEm === 'hidden'
          ? 'hidden'
          : 'rest',
    edgeView: (e, em, g): EdgeView => {
      // a tie to a hub (either end) is CONTEXT — dotted, hairline, quiet even at focus
      const contextLink = Boolean(nodeById[e.to]?.hub || nodeById[e.from]?.hub)
      return {
        d: g.d,
        stroke: contextLink ? HUBGRAY : EDGE_INK[e.kind],
        width: contextLink ? 1.1 : em === 'focus' ? STRENGTH_WIDTH[strengthTier(e.evidence?.length ?? 1)] : 1.1,
        dash: dashFor({ unconfirmed: e.unconfirmed, contextLink }),
        opacity: em === 'hidden' ? 0 : contextLink ? 0.5 : em === 'focus' ? 1 : g.oRest
      }
    },
    // paint order: context under unconfirmed under confirmed, and on the focus
    // the weaker line under the stronger
    edgePaintRank: (e, em) => {
      const contextLink = Boolean(nodeById[e.to]?.hub || nodeById[e.from]?.hub)
      const cls = contextLink ? 0 : e.unconfirmed ? 1 : 2
      const s = em === 'focus' ? STRENGTH_Z[strengthTier(e.evidence?.length ?? 1)] : 0
      return (em === 'focus' ? 100 : 0) + cls * 10 + s
    },
    // control/record/identity name a relationship the mark can't show → earn a
    // chip on the line; hubs never do. The kernel places them and falls the
    // rest to the card.
    chipCandidates: view => {
      if (!view.focusId) return []
      const out: ChipCandidate[] = []
      for (const e of edges) {
        if (e.from !== view.focusId && e.to !== view.focusId) continue
        if (e.kind !== 'control' && e.kind !== 'record' && e.kind !== 'identity') continue
        const neighborId = e.from === view.focusId ? e.to : e.from
        const nb = nodeById[neighborId]
        if (!nb || nb.hub) continue
        out.push({
          edgeId: e.id,
          neighborId,
          // direction-aware: the chip speaks from the FOCUS's side
          text: labelFrom(e, view.focusId),
          // the chip washes to its LINE's color (law 5) — intrinsic, stable
          color: EDGE_INK[e.kind]
        })
      }
      return out
    },
    chipCap: 6,
    // the node's own truth: its anomaly claims the card; an address's flags
    // speak in the same meta voice when no anomaly outranks them
    metaOf: () => {
      const m = new Map<string, string>()
      for (const n of nodes) {
        if (n.anomaly) m.set(n.id, n.anomaly)
        else if (n.kind === 'address' && n.flags?.length) m.set(n.id, n.flags.slice(0, 2).join(' · '))
      }
      return m
    },
    alwaysPrintMeta: n => Boolean(n.anomaly),
    plateOf: kybPlateContent,
    nameLinesOf: kybNameLines,
    metaRiskOf: n => n.risk,
    regionsOf: view => fanRegions(view.focusId),
    // the focused node sits at the center with its own neighborhood around it;
    // the rest of the map lives just off-frame — you glide to it
    framing: view => frameFor(view.focusId),
    peekFraming: id => frameFor(id),
    hoverNeighbors: (id): HoverNeighbor[] => neighborsOf(id).map(nb => ({ nodeId: nb.node.id, edgeId: nb.edge.id })),
    canvasClass
  }
}

/** PROTOTYPE: zoom in and out, in the canvas's corner — the app's graph is
 *  travelled, not zoomed, but in a report card the reader asked for the
 *  buttons. Inside the provider, so they steer this graph's own viewport. */
const ZoomControls = () => {
  const rf = useReactFlow()
  const width = useStore((st) => st.width)
  const height = useStore((st) => st.height)
  // About the canvas's centre, so what is in the middle stays there.
  const zoomBy = (factor: number) => {
    const { x, y, zoom } = rf.getViewport()
    const next = Math.min(1.7, Math.max(0.14, zoom * factor))
    const k = next / zoom
    const cx = width / 2
    const cy = height / 2
    void rf.setViewport({ x: cx - (cx - x) * k, y: cy - (cy - y) * k, zoom: next }, { duration: 200 })
  }
  return (
    <div className="absolute bottom-3 right-3 flex flex-col overflow-hidden rounded-control border border-border bg-card shadow-elevation-card">
      <IconActionButton aria-label="Zoom in" onClick={() => zoomBy(1.25)} variant="quiet">
        <Plus aria-hidden="true" />
      </IconActionButton>
      <span aria-hidden="true" className="h-px bg-[var(--core-color-border-divider)]" />
      <IconActionButton aria-label="Zoom out" onClick={() => zoomBy(0.8)} variant="quiet">
        <Minus aria-hidden="true" />
      </IconActionButton>
    </div>
  )
}

const ConnectionsCanvas = memo(function ConnectionsCanvas({
  data,
  rootId,
  onSelect,
  focusOn,
  whole = false
}: {
  data: KybGraph
  rootId: string
  /** Where the camera starts: a picked related business, else this one. */
  focusOn?: string
  whole?: boolean
  /** a related business's mark was clicked */
  onSelect?: (nodeId: string) => void
}) {
  // the camera finds its canvas by class — one per instance, so two graphs on
  // a page never steer each other
  const canvasClass = `kyb-canvas-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const world = useMemo(() => worldFor(data, rootId), [data, rootId])
  const def = useMemo(() => makeKybDef(world, canvasClass, whole), [world, canvasClass, whole])
  const stageRef = useRef<HTMLDivElement>(null)

  const [hoverId, setHoverId] = useState<string | null>(null)
  const hoverFrom = useRef<'panel' | 'canvas'>('canvas')

  // a browser-style trail of where you've traveled: every hop pushes, ← / →
  // retrace, Esc returns home. ONE state object so the focus is DERIVED.
  const [hist, setHist] = useState(() => ({ trail: [focusOn ?? rootId], at: 0 }))
  const focusId = hist.trail[hist.at]

  const go = useCallback(
    (id: string | null) => {
      const target = id ?? rootId
      setHist(h =>
        h.trail[h.at] === target ? h : { trail: [...h.trail.slice(0, h.at + 1), target], at: h.at + 1 }
      )
    },
    [rootId]
  )
  const step = useCallback((delta: number) => {
    setHist(h => {
      const next = h.at + delta
      return next < 0 || next >= h.trail.length ? h : { ...h, at: next }
    })
  }, [])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      if (focusId !== rootId) {
        go(rootId)
        e.preventDefault()
      }
    } else if (e.key === 'ArrowLeft' && hist.at > 0) {
      step(-1)
      e.preventDefault()
    } else if (e.key === 'ArrowRight' && hist.at < hist.trail.length - 1) {
      step(1)
      e.preventDefault()
    }
  }

  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const view = useMemo<GraphViewState<undefined>>(
    () => ({
      focusId,
      hoverId,
      hoverFrom,
      ctx: undefined,
      onSelect: id => {
        go(id)
        onSelectRef.current?.(id)
      },
      onHover: id => {
        hoverFrom.current = 'canvas'
        setHoverId(id)
      },
      onPaneClick: () => go(rootId)
    }),
    [focusId, hoverId, go, rootId]
  )

  return (
    <ReactFlowProvider>
      <div
        ref={stageRef}
        tabIndex={0}
        aria-label="Related businesses graph"
        onKeyDown={onKeyDown}
        className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <GraphCanvas def={def} view={view} sidebarWidth={0} scrollPans={false} />
        <KybLegend edges={world.edges} nodes={world.nodes} nodeById={world.nodeById} rootRef={stageRef} />
        <ZoomControls />
      </div>
    </ReactFlowProvider>
  )
})

/**
 * The record's related businesses as a graph: the business at the centre, the
 * people, entities and addresses it shares, and the businesses that share
 * them. A fixed-height canvas, the full width of its container, in the
 * registrations map's frame (a rounded border on the subtle surface).
 *
 * `onSelectBusiness` is called with the connection when a related business's
 * mark is clicked (the canvas also travels to it). Renders nothing when the
 * record has no connections, or none that share anything drawable.
 */
export function ConnectionsGraph({
  record,
  onSelectBusiness,
  only,
  onShowAll
}: {
  record: BusinessRecord
  onSelectBusiness?: (connection: Connection) => void
  /** A related business picked: the graph is it, this business, and what ties them. */
  only?: string | null
  /** Back from one business to the first few. */
  onShowAll?: () => void
}) {
  const data = useMemo(() => fromConnections(record, only), [record, only])
  const onSelect = useCallback(
    (nodeId: string) => {
      // This business itself, picked: back to all its connections.
      if (nodeId === record.id) return onShowAll?.()
      const c = connectionOfNode(record, nodeId)
      if (c) onSelectBusiness?.(c)
    },
    [record, onSelectBusiness, onShowAll]
  )
  if ((record.connections ?? []).length === 0 || data.nodes.length < 2) return null
  return (
    <div
      className={cn(
        'graph-scope g-inks',
        // `isolate`: the canvas's own layers (the legend's ?) stay inside the
        // card, under the page's sticky header
        'relative isolate !h-[420px] w-full overflow-hidden rounded-control border border-border bg-[var(--core-color-surface-subtle)]'
      )}
    >
      <ConnectionsCanvas
        key={`${record.id}:${only ?? ''}`}
        data={data}
        rootId={record.id}
        onSelect={onSelect}
        // One business picked: the camera on it, the whole tie to this one in frame.
        focusOn={only ? `related:${only}` : undefined}
        whole={Boolean(only)}
      />
      {/* Narrowed to one business: the way back, top right (the legend's ? is top left). */}
      {only && onShowAll && (
        <ActionButton className="absolute right-3 top-3 shadow-elevation-card" onClick={onShowAll} size="compact" type="button" variant="secondary">
          Show all businesses
        </ActionButton>
      )}
    </div>
  )
}
