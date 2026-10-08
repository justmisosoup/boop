import type { BusinessRecord } from './deriveResults'

type Connection = NonNullable<BusinessRecord['connections']>[number]

/**
 * The businesses related to this one — the provider's connections, less the
 * neighbours.
 *
 * A connection resting on one shared commercial address is a tenant of the
 * same building: J.L.W. Investors shares 801 Madison Ave Fl 3 with Kairos
 * Physical Therapy and nothing else, and a floor 21–100 businesses use is not
 * a relationship. A business is related when it shares a person, or more than
 * one address, or the one address it shares is a home — a residential address
 * in common is the rare case where one is enough.
 */
export const relatedBusinessesOf = (record: BusinessRecord): Connection[] => {
  const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const residential = new Set(
    record.addresses.filter((a) => (a.propertyType ?? '').toUpperCase() === 'RESIDENTIAL').map((a) => norm(a.fullAddress))
  )
  return (record.connections ?? []).filter((c) => {
    const people = (c.people ?? []).length
    const addresses = c.addresses ?? []
    if (people > 0 || addresses.length > 1) return true
    return addresses.length === 1 && residential.has(norm(addresses[0].fullAddress))
  })
}

/** The match a connection must reach, sharing people or a business named on
 *  both filings, to read as likely related (the Related businesses card's cut). */
export const LIKELY_MATCH = 0.95

/** The connections that read as likely related: a confident match that shares
 *  someone. The card's count and its place in the report follow these. */
export const confidentRelatedOf = (record: BusinessRecord): Connection[] =>
  (record.connections ?? []).filter(
    (c) =>
      (c.people ?? []).length + (c.businesses ?? []).length > 0 && (c.confidence ?? 0) >= LIKELY_MATCH
  )
