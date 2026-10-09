/**
 * The connections seam: project a record's `connections` into a `KybGraph` —
 * this prototype's counterpart of the app's `fromBusiness.ts`, through the same
 * boundary (`normalizeKybGraph`).
 *
 * The graph is the business, the businesses connected to it, and what ties
 * them: each person, entity or address a connection shares is ONE node, tied
 * to this business on one side and to every related business that shares it on
 * the other — the way the app's KYB graph ties businesses through officers and
 * addresses. Nothing else is drawn: no websites or phones, and none of this
 * business's own officers or addresses that no connection shares.
 *
 * What each tie says, and how it is drawn:
 *  - A shared person or entity is a `control` tie (teal); a shared address a
 *    `location` tie (slate). The words are the roles each filing gives — this
 *    business's own from its record, the related business's from the
 *    connection — as the Related businesses card names them.
 *  - Width is corroboration, as in the app: the record's sources for this
 *    business's side, the filings an address was found on for the other.
 *  - Dash is certainty: a related business below the likely-related match
 *    (`LIKELY_MATCH`, 95%) is a lead, not a fact — its ties are dotted.
 *  - Hubs are context (law 7): a registered-agent address, or an entity named
 *    only as registered agent / for service of process, is a muted hub on a
 *    sparse hairline — a business tied only through one reads as context.
 *    Three or more registered-agent addresses collapse into one such mark
 *    ("16 registered agents"), drilled into like any bundle.
 *
 * A connection that shares nothing drawable is left out (no tie to draw, and
 * none is invented).
 */
import type { BusinessRecord } from '../../../lib/deriveResults'
import { nameKey } from '../../../lib/attributes'
import { isBusinessName } from '../../../lib/businessNames'
import { sameName } from '../../../lib/registrationStatus'
import { LIKELY_MATCH } from '../../../lib/relatedBusinesses'
import { ADDRESS_SEAM } from './graph/address'
import { addressRiskNodeProps, deriveAddressRisk } from './graph/addressRisk'
import { normalizeKybGraph } from './kybGraph'
import type { KybEdge, KybGraph, KybNode } from './types'

type Connection = NonNullable<BusinessRecord['connections']>[number]
type Party = { name: string; titles?: string[] }
type RecordAddress = BusinessRecord['addresses'][number]

/** a filed name, spaced once and without the quotes some filings wrap it in */
const clean = (v: string) =>
  v
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^['"](.*)['"]$/, '$1')
    .trim()

/** "registered_agent" → "Registered agent" (the Related businesses card's) */
const roleName = (v: string) => {
  const s = v.replace(/_/g, ' ').toLowerCase()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** a tie's words: the first two roles a filing gives, as the app's fromBusiness
 *  joins an officer's roles ("Treasurer & Director") */
const rolesLabel = (titles: readonly string[] | undefined) =>
  [...new Set((titles ?? []).map(roleName))].slice(0, 2).join(' & ')

const AGENT = /registered.?agent|service of process|statutory agent/i

/** named only as an agent — a registered agent, or for service of process */
const onlyAgent = (titles: readonly string[] | undefined) =>
  (titles ?? []).length > 0 && (titles ?? []).every(t => AGENT.test(t))

/** An address by its street line and ZIP, so "…UT 84123" finds "…UT
 *  84123-2550" (the Related businesses card's key). */
const addressKey = (full: string) =>
  `${(full.split(',')[0] ?? '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()}|${
    (full.match(/\b(\d{5})(?:-\d{4})?\b/) ?? [])[1] ?? ''
  }`

/** a card-friendly address label: "1 Main St · Cambridge, CA" (fromBusiness's) */
function shortAddress(full: string): string {
  const [line1, city, stateZip] = full.split(',').map(s => s.trim())
  const st = stateZip?.split(' ')[0]
  return city ? `${line1}${ADDRESS_SEAM}${city}${st ? `, ${st}` : ''}` : line1
}

/** The same person under a middle initial or not: "REED E STEINER" is Reed
 *  Steiner (the card's own match). */
const firstLast = (v: string) => {
  const words = v
    .toLowerCase()
    .replace(/[^a-z\s]+/g, ' ')
    .trim()
    .split(/\s+/)
  return words.length > 1 ? `${words[0]} ${words[words.length - 1]}` : words[0]
}

/** what the related business is, in the Related businesses card's words */
const relationOf = (c: Connection): string => {
  const parties = (c.people ?? []).length + (c.businesses ?? []).length > 0
  if (parties) return (c.confidence ?? 0) >= LIKELY_MATCH ? 'Likely related' : 'Possibly related'
  return (c.addresses ?? []).length === 1 ? 'Shared address only' : 'Shared addresses only'
}

/** the filings an address was found on, as citations */
const citesOf = (a: NonNullable<Connection['addresses']>[number]): string[] =>
  (a.sources ?? []).map(s =>
    [s.metadata?.state, s.type.replace(/_/g, ' '), s.metadata?.file_number && `#${s.metadata.file_number}`]
      .filter(Boolean)
      .join(' ')
  )

/** PROTOTYPE: how many related businesses the card's graph draws — the first,
 *  in the Related businesses list's own order. */
const GRAPH_TOP = 3

/** A registered agent's address: on the connection, or on this business's record. */
const isAgentAddress = (a: NonNullable<Connection['addresses']>[number], ours?: RecordAddress) =>
  (a.labels ?? []).some(l => /registered.?agent/i.test(l)) ||
  Boolean(ours?.isRegisteredAgent) ||
  (ours?.labels ?? []).some(l => /registered.?agent/i.test(l))

export function fromConnections(
  record: BusinessRecord,
  /** One related business picked: it alone, and how it ties to this one. */
  only?: string | null
): KybGraph {
  // The list's order (`RelatedBusinesses`): likely related first; then those
  // sharing people and addresses, people, addresses; the most shared; the
  // strongest match.
  const parties = (c: Connection) => (c.people ?? []).length + (c.businesses ?? []).length
  const likely = (c: Connection) => (parties(c) > 0 && (c.confidence ?? 0) >= LIKELY_MATCH ? 0 : 1)
  const rank = (c: Connection) =>
    parties(c) > 0 && (c.addresses ?? []).length > 0 ? 0 : parties(c) > 0 ? 1 : 2
  const shared = (c: Connection) => parties(c) + (c.addresses ?? []).length
  const recordAddresses = new Map(record.addresses.map(a => [addressKey(a.fullAddress), a] as const))
  // Registered-agent addresses are left out of the graph altogether; a
  // business that shared only those has nothing left to draw.
  const connections = [...(record.connections ?? [])]
    .sort(
      (a, b) =>
        likely(a) - likely(b) ||
        rank(a) - rank(b) ||
        shared(b) - shared(a) ||
        (b.confidence ?? 0) - (a.confidence ?? 0)
    )
    // One business picked, the full relationship: every address it shares,
    // registered agents' too (drawn as muted context, as the app draws hubs).
    .map(c => ({
      ...c,
      addresses: only
        ? (c.addresses ?? [])
        : (c.addresses ?? []).filter(a => !isAgentAddress(a, recordAddresses.get(addressKey(a.fullAddress))))
    }))
    .filter(c => parties(c) + c.addresses.length > 0)
    .filter(c => !only || c.id === only)
    .slice(0, GRAPH_TOP)
  const rootId = record.id
  const nodes = new Map<string, KybNode>()
  const edges = new Map<string, KybEdge>()
  nodes.set(rootId, { id: rootId, kind: 'business', name: clean(record.name) })

  const edge = (e: Omit<KybEdge, 'id' | 'current'>) => {
    const id = `e:${e.from}>${e.to}`
    if (!edges.has(id)) edges.set(id, { id, current: true, ...e })
  }

  /* ---------- this business's side of a shared node ---------- */

  const personOnRecord = (name: string) =>
    record.people.find(
      p => nameKey(p.name) === nameKey(name) || sameName(p.name, name) || firstLast(p.name) === firstLast(name)
    )
  const addressOnRecord = new Map<string, RecordAddress>(
    record.addresses.map(a => [addressKey(a.fullAddress), a] as const)
  )
  const agents = new Set(
    record.registrations.map(r => r.registeredAgent).filter((v): v is string => Boolean(v)).map(nameKey)
  )

  /** a shared person or entity — one node, however many connections share it */
  const party = (p: Party, kind: 'person' | 'entity'): string => {
    const name = clean(p.name)
    const id = `${kind}:${nameKey(name)}`
    const existing = nodes.get(id)
    if (existing) {
      // a hub only while EVERY filing names it only as an agent
      if (existing.hub && !onlyAgent(p.titles)) {
        existing.hub = undefined
        existing.subtitle = undefined
      }
      return id
    }
    const ours = personOnRecord(name)
    const hub = kind === 'entity' && (onlyAgent(p.titles) || agents.has(nameKey(name)))
    nodes.set(id, {
      id,
      kind: kind === 'person' ? 'person' : 'business',
      name,
      ...(hub ? { subtitle: 'Registered agent', hub: true } : {})
    })
    edge({
      from: rootId,
      to: id,
      kind: 'control',
      label:
        rolesLabel(ours?.titles) ||
        (agents.has(nameKey(name)) ? 'Registered agent' : kind === 'person' ? 'Shared person' : 'Shared entity'),
      evidence: ours?.sources?.length ? ours.sources : ['Business record']
    })
    return id
  }

  /** a shared address — one node, flagged from this business's own record */
  const address = (a: NonNullable<Connection['addresses']>[number]): string => {
    const key = addressKey(a.fullAddress)
    const id = `address:${key}`
    const ours = addressOnRecord.get(key)
    const ra =
      (a.labels ?? []).some(l => /registered.?agent/i.test(l)) ||
      Boolean(ours?.isRegisteredAgent)
    const existing = nodes.get(id)
    if (existing) {
      if (ra && !existing.hub) {
        existing.hub = true
        existing.subtitle = 'Registered agent'
        existing.anomaly ??= 'Shared registered-agent address'
        const tie = edges.get(`e:${rootId}>${id}`)
        if (tie) {
          tie.label = 'Registered agent'
          tie.group = 'registered agents'
        }
      }
      return id
    }
    const risk = ours
      ? deriveAddressRisk({
          cmra: ours.cmra === true || undefined,
          deliverability:
            ours.deliverable === false ? 'undeliverable' : ours.deliverable === true ? 'deliverable' : undefined,
          propertyType:
            ours.propertyType?.toLowerCase() === 'residential'
              ? 'residential'
              : ours.propertyType?.toLowerCase() === 'commercial'
                ? 'commercial'
                : undefined,
          locationCount: ours.locationCount ?? undefined
        })
      : undefined
    nodes.set(id, {
      id,
      kind: 'address',
      name: shortAddress(clean(a.fullAddress)),
      ...(ra ? { subtitle: 'Registered agent', hub: true } : {}),
      ...addressRiskNodeProps(risk),
      // a registered-agent address always reads "shared" (fromBusiness's words)
      ...(ra ? { anomaly: 'Shared registered-agent address' } : {})
    })
    edge({
      from: rootId,
      to: id,
      kind: 'location',
      label: ra ? 'Registered agent' : 'Address',
      evidence: ours?.sources?.length ? ours.sources : ['Business record'],
      // registered agents collapse into one context mark once there are three
      // (the app's panel sinks them to one "Registered agents" group the same way)
      ...(ra ? { group: 'registered agents' } : {})
    })
    return id
  }

  /* ---------- each related business, tied through what it shares ---------- */

  for (const c of connections) {
    const people = (c.people ?? []).filter(p => !isBusinessName(p.name))
    const entities = [...(c.businesses ?? []), ...(c.people ?? []).filter(p => isBusinessName(p.name))]
    const addresses = c.addresses ?? []
    if (people.length + entities.length + addresses.length === 0) continue

    const id = `related:${c.id}`
    const match = typeof c.confidence === 'number' ? `${Math.round(c.confidence * 100)}%` : null
    nodes.set(id, {
      id,
      kind: 'business',
      name: clean(c.name),
      subtitle: relationOf(c),
      ...(match ? { facts: [['Match', match]] } : {})
    })
    // below the likely-related cut the match is a lead, not a fact
    const unconfirmed = (c.confidence ?? 0) < LIKELY_MATCH || undefined

    for (const p of people) {
      edge({
        from: party(p, 'person'),
        to: id,
        kind: 'control',
        label: rolesLabel(p.titles) || 'Shared person',
        unconfirmed,
        evidence: [c.name]
      })
    }
    for (const e of entities) {
      edge({
        from: party(e, 'entity'),
        to: id,
        kind: 'control',
        label: rolesLabel(e.titles) || 'Shared entity',
        unconfirmed,
        evidence: [c.name]
      })
    }
    for (const a of addresses) {
      const ra = (a.labels ?? []).some(l => /registered.?agent/i.test(l))
      const cites = citesOf(a)
      edge({
        from: address(a),
        to: id,
        kind: 'location',
        label: ra ? 'Registered agent' : 'Address',
        unconfirmed,
        evidence: cites.length ? cites : [c.name]
      })
    }
  }

  return normalizeKybGraph({ nodes: [...nodes.values()], edges: [...edges.values()] })
}

/** the record's connection behind a related-business node, by its node id */
export const connectionOfNode = (record: BusinessRecord, nodeId: string): Connection | undefined =>
  nodeId.startsWith('related:')
    ? (record.connections ?? []).find(c => `related:${c.id}` === nodeId)
    : undefined
