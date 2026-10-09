// Ported verbatim from app/src/containers/Explorer/types.ts
/**
 * The KYB graph's normalized data contract — what the canvas draws. Kinds map into the
 * color system and every edge can cite `evidence` (the "every line is a citation" law).
 * A `KybGraph` is a whole neighborhood: the fixture hand-authors one; `fromBusiness`
 * projects real Middesk responses into the SAME shape for the live path.
 */
import type { BundleInfo } from './graph/bundle'

export type KybNodeKind = 'business' | 'person' | 'address' | 'phone' | 'domain'

export interface KybNode {
  id: string
  kind: KybNodeKind
  /** short display label (≤ ~26 chars reads best on a card) */
  name: string
  subtitle?: string
  /** mass-connected context (registered agent / mass address): drawn muted, never a
   *  meaningful tie (the "hubs are context, never connections" law) */
  hub?: boolean
  hubCount?: number
  risk?: 'high' | 'medium'
  /** compact risk-flag copy in report precedence order ("CMRA",
   *  "Undeliverable", "101–1000 businesses" — see graph/addressRisk.ts):
   *  the meta line prints the top two, the plate composes them into fact
   *  rows. Flags are facts, not judgments — `risk` alone carries severity.
   *  Displayed for ADDRESS nodes today (the vocabulary and the fact
   *  grouping are address-specific); other kinds carry them inert. */
  flags?: string[]
  /** label/value pairs — the focus plate + the sidebar detail */
  facts?: [string, string][]
  /** the one fact that claims the card regardless of tier (anomalies outrank) */
  anomaly?: string
  /** engine-set (never authored): present iff this node is a collapsed bundle of
   *  `count` same-group siblings — the scale-honesty mark (see ./bundle) */
  bundle?: BundleInfo
}

/** edge family → line color + legend (the demo's proven taxonomy):
 *  control = ownership/officers · location = business↔address · digital = phones/sites ·
 *  record = filings/liens · identity = same-name (shown, never asserted as fact). */
export type KybEdgeKind =
  | 'control'
  | 'location'
  | 'digital'
  | 'record'
  | 'identity'

export interface KybEdge {
  id: string
  from: string
  to: string
  kind: KybEdgeKind
  label: string
  /** the same tie read from the `to` end ("Subsidiary" ⇄ "Parent company");
   *  omit when the label reads correctly from both ends. Live multi-hop data
   *  should author this on asymmetric ties. */
  inverseLabel?: string
  /** false = former/historical — said in the tie's WORDS and the panel's
   *  Former tag, never in the paint (dash means certainty only, matching the
   *  graph_edges contract, whose status list has no "former") */
  current: boolean
  /** true = suggestion, not fact → dotted (identity edges are always
   *  unconfirmed — enforced at the normalize boundary) */
  unconfirmed?: boolean
  evidence?: string[]
  /** authoring intent: neighbors of a node that share a `group` (a plural noun like
   *  "subsidiaries") collapse into one bundle mark when there are enough of them */
  group?: string
}

/** a whole neighborhood — `buildGraph` lays it out as ego rings from a root */
export interface KybGraph {
  nodes: KybNode[]
  edges: KybEdge[]
}
