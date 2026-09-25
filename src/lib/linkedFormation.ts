import rawRecords from '../data/records.json'
import type { BusinessRecord } from './deriveResults'
import { formationConfirmed, sameName } from './registrationStatus'

/**
 * A formation found on another record, when this one has none.
 *
 * Sprig Technologies has no domestic filing — only a California foreign
 * registration — and Middesk's "Delaware" formation is read off that. Its own
 * record also lists the name Mixboard Inc., from San Francisco city
 * registrations at the addresses on its California filing. The account's
 * Mixboard Inc. record holds a Delaware domestic filing (#6473823, 2017) at
 * those same addresses, with the same person. That is a link, not a
 * confirmation: the card shows the linked filing and says how it was linked.
 *
 * A link needs all three: a name this record also goes by, a domestic filing
 * on the other record, and something concrete in common — an address or a
 * person. A name alone is a coincidence waiting to happen.
 */

type Registration = BusinessRecord['registrations'][number]

export type LinkedFormation = {
  /** The other record, and the domestic filing on it. */
  record: BusinessRecord
  filing: Registration
  /** The name this record also goes by that the other record is filed under. */
  name: string
  /** What else they share, in this record's own spelling. */
  addresses: string[]
  people: string[]
}

const ALL = rawRecords as BusinessRecord[]

// A placeholder a registry prints when it has no address is not a shared address.
const realAddress = (a: string) => !/undeliverable|\b99999\b/i.test(a)
const addressKey = (a: string) => a.toLowerCase().replace(/[^a-z0-9]/g, '')
const personKey = (n: string) => n.toLowerCase().replace(/[^a-z]/g, '')

export const linkedFormationOf = (record: BusinessRecord): LinkedFormation | undefined => {
  if (formationConfirmed(record)) return undefined
  if (record.registrations.some((r) => /domestic/i.test(r.jurisdiction ?? ''))) return undefined

  const otherNames = (record.names ?? []).map((n) => n.name).filter((n) => n && !sameName(n, record.name))
  if (otherNames.length === 0) return undefined

  const mine = new Map(
    record.addresses.filter((a) => realAddress(a.fullAddress)).map((a) => [addressKey(a.fullAddress), a.fullAddress])
  )
  const myPeople = new Map(record.people.map((p) => [personKey(p.name), p.name]))

  for (const other of ALL) {
    if (other.id === record.id) continue
    const name = otherNames.find((n) => sameName(n, other.name))
    if (!name) continue
    const filing = other.registrations.find((r) => /domestic/i.test(r.jurisdiction ?? ''))
    if (!filing) continue
    const addresses = [
      ...new Set(
        other.addresses
          .filter((a) => realAddress(a.fullAddress))
          .map((a) => mine.get(addressKey(a.fullAddress)))
          .filter((a): a is string => Boolean(a))
      )
    ]
    const people = [
      ...new Set(other.people.map((p) => myPeople.get(personKey(p.name))).filter((p): p is string => Boolean(p)))
    ]
    if (addresses.length === 0 && people.length === 0) continue
    return { record: other, filing, name, addresses, people }
  }
  return undefined
}

/** The street line of an address: "2021 Fillmore St PMB 86". */
const street = (a: string) => a.split(',')[0].trim()
const and = (xs: string[]) => (xs.length < 3 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)

/**
 * What the Formation card says about a linked formation: that none was found
 * for this business, which filing looks linked, and how — "No formation was
 * found for SPRIG TECHNOLOGIES INC. This one looks linked: MIXBOARD INC., a
 * Delaware domestic registration (#6473823). Its record also carries the name
 * Mixboard Inc.; both list 2021 Fillmore St PMB 86 and 71 Stevenson St Ste
 * 600, and both name Ryan Glasgow."
 */
export const linkedFormationNote = (record: BusinessRecord, link: LinkedFormation, stateName: (s: string) => string) => {
  // A name ending a sentence drops its own period; mid-sentence it keeps it ("MIXBOARD INC., a …").
  const bare = (n: string) => n.replace(/\.$/, '')
  // This business's own office addresses first: they are the ones on its filing.
  const submitted = new Set(record.addresses.filter((a) => a.submitted).map((a) => a.fullAddress))
  const addresses = [...link.addresses].sort((a, b) => Number(submitted.has(b)) - Number(submitted.has(a))).slice(0, 2)
  const ties = [
    addresses.length ? `both list ${and(addresses.map(street))}` : '',
    link.people.length ? `both name ${and(link.people.slice(0, 2))}` : ''
  ].filter(Boolean)
  return [
    `No formation was found for ${bare(record.name)}.`,
    `This one looks linked: ${link.filing.name}, a ${stateName(link.filing.state)} domestic registration${
      link.filing.fileNumber ? ` (#${link.filing.fileNumber})` : ''
    }.`,
    ties.length
      ? `Its record also carries the name ${link.name}; ${ties.join(', and ')}.`
      : `Its record also carries the name ${bare(link.name)}.`
  ].join(' ')
}
