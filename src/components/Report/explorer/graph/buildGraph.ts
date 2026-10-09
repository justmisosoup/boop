// Ported from app/src/containers/Explorer/graph/buildGraph.ts — two PROTOTYPE
// changes, marked below, let registered-agent addresses collapse into one
// context mark instead of each taking a seat on the root's ring.
/**
 * KYB world factory — lay a `KybGraph` out as ego rings from the root business (the
 * kernel's shared `egoRingLayout`: multi-hop BFS, grid-snapped, collision-free), compute
 * octilinear edge geometry, and expose the queries the def + panel read from one place.
 * Same input → same world; nodes never move.
 */
import {
  addressDisplayLines,
  footprintSummary,
  orderAddressMembers
} from './address'
import { bundleNeighbors, layoutWithBundles, type BundleInfo } from './bundle'
import {
  type Bounds,
  type EdgeGeo,
  boundsOf as kernelBoundsOf,
  octilinearGeometry,
  type XY
} from './layout'
import type { KybEdge, KybGraph, KybNode, KybNodeKind } from '../types'

const PLURAL: Record<KybNodeKind, string> = {
  business: 'businesses',
  person: 'people',
  address: 'addresses',
  phone: 'phones',
  domain: 'domains'
}

export interface GraphModel {
  nodes: KybNode[]
  edges: KybEdge[]
  posOf: Record<string, XY>
  edgeGeo: Record<string, EdgeGeo>
  nodeById: Record<string, KybNode>
  neighborsOf: (id: string) => { node: KybNode; edge: KybEdge }[]
  scopeOf: (id: string) => Set<string>
  boundsOf: (ids: string[], margin?: number) => Bounds
}

// Worlds are pure functions of (graph, rootId) and graphs update immutably,
// so one cache serves every consumer — the canvas, the session engine (which
// otherwise rebuilt the world on EVERY ask), and the blank stage. WeakMap:
// a dropped graph takes its worlds with it.
const worldCache = new WeakMap<KybGraph, Map<string, GraphModel>>()

export function worldFor(graph: KybGraph, rootId: string): GraphModel {
  let byRoot = worldCache.get(graph)
  if (!byRoot) {
    byRoot = new Map()
    worldCache.set(graph, byRoot)
  }
  let world = byRoot.get(rootId)
  if (!world) {
    world = buildGraph(graph, rootId)
    byRoot.set(rootId, world)
  }
  return world
}

// corridor-lane spacing: rest lines are 1.1px (6px reads as parallel tracks);
// two adjacent focus-strong 4.8px lines keep ~1.2px of air
const LANE_GAP = 6

export function buildGraph(graph: KybGraph, rootId: string): GraphModel {
  // the root's own ring must stay TRUE: the root and its direct neighbors may
  // never be swallowed into some other hub's bundle (a re-rooted session keeps
  // its first-degree ties as real, direct lines)
  const rootAdjacent = new Set<string>([rootId])
  for (const e of graph.edges) {
    if (e.from === rootId) rootAdjacent.add(e.to)
    if (e.to === rootId) rootAdjacent.add(e.from)
  }

  // bundle captions read member NAMES (the footprint) — original nodes only,
  // which is what address-bundle members always are
  const rawById = new Map(graph.nodes.map(n => [n.id, n] as const))

  const bundleOpts = (protectRing: boolean) => ({
    // ADDRESSES never escape for risk: a fan holds ALL its addresses, and the
    // exception is CARRIED instead (ring + named foot — Amir's redirect,
    // 2026-09-01). Hubs stay context, other kinds keep the escape until they
    // too have a carry treatment.
    keepOut: (n: KybNode) =>
      (protectRing && rootAdjacent.has(n.id)) ||
      // PROTOTYPE: a hub ADDRESS may join a bundle. The app keeps every hub a
      // singleton; a business with registrations in many states shares a
      // registered agent's address in each, and sixteen context stations on
      // one ring drive a card-sized canvas to an unreadable zoom. The seam
      // (fromConnections) groups them explicitly ("registered agents"), so
      // they only ever bundle with each other — never into a fan of real
      // addresses — and the bundle stays context (hub: true, below).
      (Boolean(n.hub) && n.kind !== 'address') ||
      ((n.risk === 'high' || Boolean(n.anomaly)) && n.kind !== 'address'),
    // a meaningful arc: an all-address fan groups by state (count desc, then
    // code) — identity on every other group
    orderMembers: orderAddressMembers,
    risky: (n: KybNode) => n.risk === 'high',
    pluralOf: (k: string) => PLURAL[k as KybNodeKind] ?? `${k}s`,
    makeNode: (id: string, info: BundleInfo): KybNode => {
      // plural-noun bundles only ("9 addresses") — a proper-noun state
      // sub-bundle ("CA · 3") would caption its own name
      const footprint =
        info.memberKind === 'address' && !/^[A-Z]/.test(info.label)
          ? footprintSummary(
              info.memberIds.map(mid => rawById.get(mid)?.name ?? '')
            )
          : ''
      // risk survives bundling by PROPAGATION: the bundle names its risky
      // member on its own exception slot (the risk-inked foot) and wears the
      // danger ring (risk: 'high' → markOf), so collapsing never hides it
      const risky = info.memberKind === 'address' ? (info.riskyIds ?? []) : []
      const riskyFoot =
        risky.length === 1
          ? `Includes 1 high-risk address — ${
              addressDisplayLines(rawById.get(risky[0])?.name ?? '').name
            }`
          : risky.length > 1
            ? `Includes ${risky.length} high-risk addresses`
            : undefined
      return {
        id,
        kind: info.memberKind as KybNodeKind,
        // "19 subsidiaries" for plural-noun groups; "Ireland · 3" for proper-noun
        // sub-groups (a path segment like 'subsidiaries/Ireland')
        name: /^[A-Z]/.test(info.label)
          ? `${info.label} · ${info.count}`
          : `${info.count} ${info.label}`,
        // the fan's footprint is the bundle's own caption ("CA, NY, NJ, DE"),
        // in the same order its arcs run (memberIds are already sorted)
        ...(footprint ? { subtitle: footprint } : {}),
        ...(riskyFoot ? { anomaly: riskyFoot, risk: 'high' as const } : {}),
        // PROTOTYPE: a bundle of hubs is itself context — muted, dotted
        ...(info.memberIds.every(mid => rawById.get(mid)?.hub)
          ? { hub: true }
          : {}),
        bundle: info
      }
    },
    makeEdge: (
      id: string,
      from: string,
      to: string,
      via: KybEdge,
      label?: string
    ): KybEdge => ({
      id,
      from,
      to,
      kind: via.kind,
      label: label ?? via.label,
      // the inverse reading survives re-pointing: a bundle's row back to the
      // root still reads "Parent company", and a drilled member's does too
      inverseLabel: via.inverseLabel,
      current: via.current,
      // a suggestion stays a suggestion when re-pointed through a bundle
      unconfirmed: via.unconfirmed,
      evidence: via.evidence
    })
  })

  // scale honesty: collapse the root's large same-group sibling sets into bundle
  // marks BEFORE layout, so the ring never crams. A risk/anomaly member escapes.
  let bundled = bundleNeighbors<KybNode, KybEdge>(
    graph.nodes,
    graph.edges,
    rootId,
    bundleOpts(false)
  )
  // …and the SAME honesty for every other drawn hub: a session re-rooted at a
  // subsidiary must not fan its parent's 50 edges across the map — the parent's
  // authored groups collapse wherever it sits. Original nodes only (a synthetic
  // bundle re-bundling its own members would be nonsense), and the root's ring
  // is protected (see keepOut) so first-degree ties stay direct lines.
  // BOUNDED to genuine hubs: a bundle needs ≥3 same-group members (bundle.ts
  // groupMin), so a node with original degree < 3 can never produce one —
  // skipping it is behavior-identical, and it keeps this pass O(hubs·E)
  // instead of O(N·E) on real-sized graphs (most nodes are degree-1 leaves).
  const degree = new Map<string, number>()
  for (const e of graph.edges) {
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1)
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1)
  }
  for (const n of graph.nodes) {
    if (n.id === rootId || (degree.get(n.id) ?? 0) < 3) continue
    bundled = bundleNeighbors<KybNode, KybEdge>(
      bundled.nodes,
      bundled.edges,
      n.id,
      bundleOpts(true)
    )
  }
  const { nodes, edges } = bundled
  const byId: Record<string, KybNode> = Object.fromEntries(
    nodes.map(n => [n.id, n])
  )

  const adjacency: Record<string, { node: KybNode; edge: KybEdge }[]> = {}
  for (const e of edges) {
    if (!byId[e.from] || !byId[e.to]) continue
    ;(adjacency[e.from] ??= []).push({ node: byId[e.to], edge: e })
    ;(adjacency[e.to] ??= []).push({ node: byId[e.from], edge: e })
  }

  // two-level layout: root ring with bundles as leaves, then each bundle's members laid
  // out locally AROUND it — so drilling into a bundle reads as a tidy ring, not a fan.
  // Spacing tuned for AIR: marks sit apart (minArc = a nameplate-and-a-half between
  // sibling centers), with fog keeping the visible set small enough to stay calm.
  const posOf = layoutWithBundles(nodes, edges, rootId, {
    ringStep: 330,
    minArc: 230,
    localRingStep: 190,
    localMinArc: 170
  })
  const edgeGeo = octilinearGeometry(
    edges.filter(e => posOf[e.from] && posOf[e.to]),
    posOf,
    { lanes: true, laneGap: LANE_GAP }
  )

  return {
    nodes,
    edges,
    posOf,
    edgeGeo,
    nodeById: byId,
    neighborsOf: id => adjacency[id] ?? [],
    scopeOf: id =>
      new Set<string>([id, ...(adjacency[id] ?? []).map(nb => nb.node.id)]),
    boundsOf: (ids, margin = 130) => kernelBoundsOf(ids, posOf, margin)
  }
}
