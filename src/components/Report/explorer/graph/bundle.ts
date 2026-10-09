// Ported verbatim from app/src/containers/Explorer/graph/bundle.ts
/**
 * Bundling — the scale-honesty primitive (DESIGN.md law 8 · KERNEL.md scale ladder).
 *
 * Collapse a focus's large same-group sibling sets into ONE expandable "bundle" mark
 * ("19 subsidiaries", "8 board members") so a ring never crams and a graph stays calm at
 * any scale. This is the kernel's guarantee that an author — or an agent feeding data +
 * intent — can hand it a rich neighborhood and never get a hairball.
 *
 * A pure transform on `{ nodes, edges }`: it re-points `root → member` edges to
 * `root → bundle → member`, so the bundle is one mark on the root's ring and its members
 * become its own neighborhood (revealed by traveling into it). Two honesty rules keep it
 * from ever hiding signal:
 *   1. an exception is never buried: it either ESCAPES via `keepOut` (a visible
 *      singleton), or stays a member the bundle CARRIES visibly (`risky` →
 *      `riskyIds`: the mode rings the mark and names it on the bundle's card);
 *   2. the count is always on the mark, and the sidebar still lists every member.
 *
 * Grouping intent comes from the data: an edge's optional `group` (a plural noun like
 * "subsidiaries") bundles its members together. Untagged neighbors auto-bundle only when a
 * same-(kind, edge-kind) set is large enough to crowd — so the generic engine stays calm
 * without the author thinking about it.
 *
 * RECURSIVE: a group may be a PATH — `group: 'subsidiaries/Ireland'` collapses into a
 * "subsidiaries" bundle whose members carry `group: 'Ireland'`, so the bundle itself
 * sub-bundles by region when opened. The scale ladder holds at every level: any drill-in
 * is a few calm marks, however deep the data goes. (Deeper levels collapse only on
 * EXPLICIT paths — auto-bundling inside a bundle would just re-wrap all its members.)
 *
 * Generic over node/edge shape via small factories, so KYB and the generic engine share it.
 */
import { type XY, egoRingLayout, snapToGrid } from './layout'

export interface BundleInfo {
  /** members collapsed into this bundle */
  count: number
  memberIds: string[]
  /** the plural noun shown in the mark's name (e.g. "subsidiaries") */
  label: string
  /** the dominant member kind — drives the bundle's glyph */
  memberKind: string
  /** MEMBERS the mode flags as exceptions (honesty rule 1's carry path) —
   *  the bundle says so on its own card and mark, so collapsing never hides
   *  the loudest member. In fan order. Only set when `risky` names them. */
  riskyIds?: string[]
}

interface NodeLike {
  id: string
  kind: string
}
interface EdgeLike {
  id: string
  from: string
  to: string
  kind?: string
  /** authoring intent: members sharing a group collapse together */
  group?: string
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function bundleNeighbors<N extends NodeLike, E extends EdgeLike>(
  nodes: N[],
  edges: E[],
  rootId: string,
  opts: {
    /** an explicitly-grouped set collapses at ≥ this many (default 3) */
    groupMin?: number
    /** an untagged same-(kind, edge-kind) set auto-collapses at ≥ this many (default 8) */
    autoMin?: number
    /** a member matching this stays a visible singleton — anomaly / high-risk escape */
    keepOut?: (n: N) => boolean
    /** members worth CARRYING as named exceptions on the bundle (e.g. scored
     *  high risk); matches populate `BundleInfo.riskyIds` */
    risky?: (n: N) => boolean
    /** reorder a group's members before the fan is threaded — a PERMUTATION
     *  of its input (same nodes, new order). Member-edge emission order is
     *  the fan's angular order (layout walks adjacency in edge-array order),
     *  so this is THE lever for a meaningful arc (addresses grouped by
     *  state). Identity when omitted. */
    orderMembers?: (members: N[]) => N[]
    /** plural label for an auto-group of the given kind ("business" → "businesses") */
    pluralOf?: (kind: string) => string
    /** build the synthetic bundle node (id + info → the caller's node type) */
    makeNode: (id: string, info: BundleInfo) => N
    /** build an edge from→to, reusing `via` for kind/state; `label` overrides the words */
    makeEdge: (
      id: string,
      from: string,
      to: string,
      via: E,
      label?: string
    ) => E
  },
  /** recursion depth — internal; deeper levels collapse only explicit path groups */
  depth = 0
): { nodes: N[]; edges: E[]; bundled: boolean } {
  const byId = new Map(nodes.map(n => [n.id, n]))
  const keepOut = opts.keepOut ?? (() => false)
  const pluralOf = opts.pluralOf ?? (k => `${k}s`)
  const groupMin = opts.groupMin ?? 3
  const autoMin = opts.autoMin ?? 8

  // the root's incident edges → { neighbor, edge, grouping key, label, rest-of-path }
  type Inc = {
    nb: N
    edge: E
    key: string
    explicit: boolean
    label: string
    rest?: string
  }
  const inc: Inc[] = []
  for (const e of edges) {
    const otherId = e.from === rootId ? e.to : e.to === rootId ? e.from : null
    if (!otherId) continue
    const nb = byId.get(otherId)
    if (!nb || nb.id === rootId) continue
    if (e.group) {
      // 'subsidiaries/Ireland' → bundle by 'subsidiaries' now; the member keeps
      // 'Ireland' so the bundle sub-bundles when the transform recurses into it
      const [head, ...restParts] = e.group.split('/').map(s => s.trim())
      inc.push({
        nb,
        edge: e,
        key: `g:${head}`,
        explicit: true,
        label: head,
        rest: restParts.length ? restParts.join('/') : undefined
      })
    } else if (depth === 0)
      inc.push({
        nb,
        edge: e,
        key: `a:${nb.kind}:${e.kind ?? ''}`,
        explicit: false,
        label: pluralOf(nb.kind)
      })
  }

  const groups = new Map<string, Inc[]>()
  for (const i of inc) {
    const arr = groups.get(i.key)
    if (arr) arr.push(i)
    else groups.set(i.key, [i])
  }

  const bundleNodes: N[] = []
  const addEdges: E[] = []
  const dropEdgeIds = new Set<string>()

  for (const members of groups.values()) {
    // dedupe by neighbor: two same-group edges to one node must not double-count it
    // (honesty rule 2 — the count on the mark is true) or emit duplicate edge ids
    const seenNb = new Set<string>()
    const eligible = members.filter(m => {
      if (keepOut(m.nb) || seenNb.has(m.nb.id)) return false
      seenNb.add(m.nb.id)
      return true
    })
    const min = eligible[0]?.explicit ? groupMin : autoMin
    if (eligible.length < min) continue

    // the root→bundle edge inherits the first AUTHORED member's edge (kind /
    // unconfirmed / evidence drive the spoke's paint) — captured before the
    // mode's fan order below, which must reorder the arc, never the spoke
    const template = eligible[0]
    if (opts.orderMembers) {
      const ranked = opts.orderMembers(eligible.map(m => m.nb))
      const rank = new Map(ranked.map((n, i) => [n.id, i] as const))
      eligible.sort(
        (a, b) => (rank.get(a.nb.id) ?? 0) - (rank.get(b.nb.id) ?? 0)
      )
    }
    // the members the bundle carries as named exceptions, in fan order
    const riskyIds = opts.risky
      ? eligible.filter(m => opts.risky?.(m.nb)).map(m => m.nb.id)
      : []

    const label = template.label
    const kindCount = new Map<string, number>()
    for (const m of eligible)
      kindCount.set(m.nb.kind, (kindCount.get(m.nb.kind) ?? 0) + 1)
    const memberKind = [...kindCount.entries()].sort(
      (a, b) => b[1] - a[1]
    )[0][0]

    const bId = `bundle:${rootId}:${template.key}`
    bundleNodes.push(
      opts.makeNode(bId, {
        count: eligible.length,
        memberIds: eligible.map(m => m.nb.id),
        label,
        memberKind,
        ...(riskyIds.length > 0 ? { riskyIds } : {})
      })
    )
    // root → bundle (once), labeled by the group; the group is CONSUMED here
    const rootEdge = opts.makeEdge(
      `e-${bId}`,
      rootId,
      bId,
      template.edge,
      cap(label)
    )
    rootEdge.group = undefined
    addEdges.push(rootEdge)
    // re-point each member onto the bundle, carrying its REST-of-path (if any) so the
    // bundle sub-bundles on recursion
    for (const m of eligible) {
      dropEdgeIds.add(m.edge.id)
      const me = opts.makeEdge(`e-${bId}-${m.nb.id}`, bId, m.nb.id, m.edge)
      me.group = m.rest
      addEdges.push(me)
    }
  }

  if (!bundleNodes.length) return { nodes, edges, bundled: false }
  let outNodes = [...nodes, ...bundleNodes]
  let outEdges = [...edges.filter(e => !dropEdgeIds.has(e.id)), ...addEdges]
  // recurse into each new bundle: members carrying a rest-of-path collapse again
  // ("19 subsidiaries" → Ireland · Americas · East Asia …). Depth-guarded.
  if (depth < 3) {
    for (const b of bundleNodes) {
      const r = bundleNeighbors(outNodes, outEdges, b.id, opts, depth + 1)
      outNodes = r.nodes
      outEdges = r.edges
    }
  }
  return { nodes: outNodes, edges: outEdges, bundled: true }
}

/**
 * Two-level ego layout for a bundled graph. The MAIN pass lays out the root's ring with
 * bundles as leaves (so the root reads as a few calm marks); then each bundle gets its OWN
 * local ego layout, offset to sit around the bundle. So drilling into "19 subsidiaries"
 * shows a tidy ring around the bundle — never a fan flung across the map — and the members
 * frame at a readable size. Deterministic (nodes never move); no dependency.
 *
 * This is the general fix that keeps EVERY focus usable, not just the root: a bundle is a
 * place you can stand, laid out as its own calm neighborhood.
 */
export function layoutWithBundles<
  N extends { id: string; bundle?: { memberIds: string[] } },
  E extends { from: string; to: string }
>(
  nodes: N[],
  edges: E[],
  rootId: string,
  cfg: {
    ringStep?: number
    minArc?: number
    localRingStep?: number
    localMinArc?: number
  } = {}
): Record<string, XY> {
  const byId = new Map(nodes.map(n => [n.id, n]))
  const bundles = nodes.filter(n => n.bundle)
  if (!bundles.length) {
    return egoRingLayout(rootId, nodes, buildAdj(nodes, edges), {
      ringStep: cfg.ringStep,
      minArc: cfg.minArc
    })
  }

  // a member's edge to its own bundle is INTERNAL — dropped from the main pass so bundles
  // sit on the root's ring as leaves (their members live in the local pass below)
  // a node may belong to SEVERAL bundles (explicitly grouped two ways) — track them
  // all, so every bundle→member edge is internal and none distorts the main pass
  const memberBundles = new Map<string, string[]>()
  for (const b of bundles)
    for (const m of (b.bundle as { memberIds: string[] }).memberIds) {
      const arr = memberBundles.get(m)
      if (arr) arr.push(b.id)
      else memberBundles.set(m, [b.id])
    }
  const internal = (e: E) =>
    (memberBundles.get(e.to) ?? []).includes(e.from) ||
    (memberBundles.get(e.from) ?? []).includes(e.to)

  const mainAdj = buildAdj(
    nodes,
    edges.filter(e => !internal(e))
  )
  const raw = egoRingLayout(rootId, nodes, mainAdj, {
    ringStep: cfg.ringStep ?? 260,
    minArc: cfg.minArc ?? 168,
    snap: false
  })
  const rootNeighbors = new Set((mainAdj[rootId] ?? []).map(x => x.node.id))

  // each bundle's own subtree (members + their descendants), laid out locally around it
  const fullAdj = buildAdj(nodes, edges)
  for (const b of bundles) {
    const sub = new Set<string>([b.id])
    const queue = [b.id]
    while (queue.length) {
      const id = queue.shift() as string
      for (const { node } of fullAdj[id] ?? []) {
        // stop at the root and its ring (sibling bundles live there) — but a SUB-bundle
        // reached through this bundle belongs to its subtree and lays out within it
        if (
          node.id === rootId ||
          rootNeighbors.has(node.id) ||
          sub.has(node.id)
        )
          continue
        // a member OWNED by another bundle must not be stolen through a cross-link —
        // it lays out with its own bundle; the cross-link renders as a long honest tie.
        // (An owner already claimed into THIS subtree — a sub-bundle — is ours.)
        const owners = memberBundles.get(node.id)
        if (owners && !owners.includes(b.id) && !owners.some(o => sub.has(o)))
          continue
        sub.add(node.id)
        queue.push(node.id)
      }
    }
    const subNodes = [...sub].map(id => byId.get(id) as N)
    const subAdj = buildAdj(
      subNodes,
      edges.filter(e => sub.has(e.from) && sub.has(e.to))
    )
    // grow OUTWARD: the bundle's tree fans in a wedge pointed away from the root
    // (the direction root → bundle), never back toward the center — a graph builds
    // out like a tree, so drill-clusters stop colliding with the root's ring.
    const origin = raw[b.id] ?? { x: 0, y: 0 }
    const rootPos = raw[rootId] ?? { x: 0, y: 0 }
    const dx = origin.x - rootPos.x
    const dy = origin.y - rootPos.y
    const outward =
      Math.hypot(dx, dy) > 1
        ? (Math.atan2(dy, dx) * 180) / Math.PI + 90 // → the polar() convention
        : undefined
    const local = egoRingLayout(b.id, subNodes, subAdj, {
      ringStep: cfg.localRingStep ?? 150,
      minArc: cfg.localMinArc ?? 130,
      snap: false,
      wedge: outward === undefined ? undefined : [outward - 100, outward + 100]
    })
    for (const id of sub) {
      const p = local[id]
      if (p) raw[id] = { x: origin.x + p.x, y: origin.y + p.y }
    }
  }

  return snapToGrid(raw)
}

function buildAdj<
  N extends { id: string },
  E extends { from: string; to: string }
>(nodes: N[], edges: E[]): Record<string, { node: N; edge: E }[]> {
  const byId = new Map(nodes.map(n => [n.id, n]))
  const adj: Record<string, { node: N; edge: E }[]> = {}
  for (const e of edges) {
    const a = byId.get(e.from)
    const b = byId.get(e.to)
    if (!a || !b) continue
    ;(adj[e.from] ??= []).push({ node: b, edge: e })
    ;(adj[e.to] ??= []).push({ node: a, edge: e })
  }
  return adj
}
