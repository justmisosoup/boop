// Ported verbatim from app/src/containers/Explorer/kybGraph.ts
import { z } from 'zod'

import type { KybGraph, KybNode } from './types'

/**
 * The KYB graph data boundary — the typed seam EVERY graph goes through on
 * its way in, wherever it comes from: the demo fixture (./loadAppleGraph),
 * live `fromBusiness` output, a future threads API, or a user addition in
 * the chat (sessions' addNodeToGraph). It validates the shape (zod), then
 * normalizes so the layout is deterministic and can't be broken by bad data:
 *   - duplicate node ids are dropped (first wins) — the count on a mark stays honest;
 *   - edges whose endpoints don't exist are dropped — the map only draws real ties;
 *   - nodes and edges are sorted by id — layout output is INDEPENDENT of authoring
 *     order (spatial memory, DESIGN law 1, must not depend on array order).
 *
 * Deliberately fixture-free: product code depends on THIS module, never on
 * the demo data next door.
 */

const NODE_KINDS = ['business', 'person', 'address', 'phone', 'domain'] as const
const EDGE_KINDS = [
  'control',
  'location',
  'digital',
  'record',
  'identity'
] as const

const KybNodeSchema = z.object({
  id: z.string(),
  kind: z.enum(NODE_KINDS),
  name: z.string(),
  subtitle: z.string().optional(),
  hub: z.boolean().optional(),
  hubCount: z.number().optional(),
  risk: z.enum(['high', 'medium']).optional(),
  flags: z.array(z.string()).optional(),
  facts: z.array(z.tuple([z.string(), z.string()])).optional(),
  anomaly: z.string().optional()
})

const KybEdgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  kind: z.enum(EDGE_KINDS),
  label: z.string(),
  inverseLabel: z.string().optional(),
  current: z.boolean(),
  unconfirmed: z.boolean().optional(),
  evidence: z.array(z.string()).optional(),
  group: z.string().optional()
})

const KybGraphSchema = z.object({
  nodes: z.array(KybNodeSchema),
  edges: z.array(KybEdgeSchema)
})

const byId = <T extends { id: string }>(a: T, b: T): number =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0

/**
 * Validate + normalize a raw KYB graph into a deterministic, self-consistent one. Pure
 * and total for well-shaped input: empty/single-node graphs pass through untouched.
 * Throws (zod) on malformed input — callers at mutation boundaries catch and degrade.
 */
export function normalizeKybGraph(raw: unknown): KybGraph {
  const parsed = KybGraphSchema.parse(raw)

  const seen = new Set<string>()
  const nodes: KybNode[] = []
  for (const node of parsed.nodes) {
    if (seen.has(node.id)) continue
    seen.add(node.id)
    nodes.push(node)
  }

  const edges = parsed.edges
    .filter(edge => seen.has(edge.from) && seen.has(edge.to))
    // identity is a SUGGESTION by definition (constants.ts) — the boundary
    // makes the invariant true instead of trusting every author to remember
    .map(edge =>
      edge.kind === 'identity' && !edge.unconfirmed
        ? { ...edge, unconfirmed: true }
        : edge
    )

  nodes.sort(byId)
  edges.sort(byId)
  return { nodes, edges }
}
