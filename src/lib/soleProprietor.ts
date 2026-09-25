import type { BusinessRecord } from './deriveResults'

/**
 * A business that reads as a sole proprietorship.
 *
 * A sole proprietor does not file with the Secretary of State, so "no SOS
 * filing" is not a finding against one. Firebird Yarns has no registrations;
 * its one record of existence is a San Francisco city registration filed under
 * Kathryn Bernard — the submitted person — at 1322 Haight St, the submitted
 * office address. That is the shape of a sole proprietor trading under a name,
 * and it is read as LIKELY, never as fact: nothing on the record states the
 * entity type.
 *
 * All three must hold: no registrations at all; a name on the record that a
 * city registration carries and that is a submitted person's; and that same
 * city registration on the submitted office address.
 */
export type SoleProprietor = {
  /** The name the city registration is filed under, in its own spelling. */
  person: string
  city: string
  state?: string
  /** The city registration's own status word, lower-case ("active"). */
  status?: string
  address: string
  /** From the city's own register, when it has been pulled: the account, and
   *  whether it lists the submitted name as what the owner does business as. */
  account?: string
  since?: string
  tradeNameOnFile: boolean
}

const key = (n: string | null | undefined) => (n ?? '').toLowerCase().replace(/[^a-z]/g, '')

export const soleProprietorOf = (r: BusinessRecord): SoleProprietor | undefined => {
  if (r.registrations.length > 0) return undefined
  const submitted = r.people.filter((p) => p.submitted)
  for (const n of r.names ?? []) {
    const city = (n.sourceRefs ?? []).filter((x) => x.type === 'city_registration')
    if (city.length === 0) continue
    if (!submitted.some((p) => key(p.name) === key(n.name))) continue
    const address = r.addresses.find(
      (a) => a.submitted && (a.sourceRefs ?? []).some((x) => city.some((c) => c.id === x.id))
    )
    if (!address) continue
    const m = city[0].metadata ?? {}
    // The register itself, where pulled: Firebird Yarns is account 1089962,
    // owner Kathryn Bernard, doing business as Firebird Yarns since 2018.
    const reg = (r.cityRegistrations ?? []).find((x) => x.refId && city.some((c) => c.id === x.refId))
    return {
      person: n.name,
      city: String(m.city ?? ''),
      state: m.state ? String(m.state) : undefined,
      status: m.status ? String(m.status).toLowerCase() : undefined,
      address: address.fullAddress,
      account: reg?.accountNumber ?? undefined,
      since: reg?.businessStart ?? undefined,
      tradeNameOnFile: Boolean(reg?.dba && key(reg.dba) === key(r.name))
    }
  }
  return undefined
}
