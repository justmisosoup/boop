import type { ChatSourceData } from '@/core'

import type { BusinessRecord } from '../lib/deriveResults'
import { NOT_PROVIDED, registrationState, subStatusLabel } from '../lib/registrationStatus'
import { stateName } from '../lib/states'
import { StatusTag, toneOfStatus } from './StatusTag'

type Registration = BusinessRecord['registrations'][number]

/**
 * Registry sources, rendered with the design system's own citation chip.
 *
 * `ChatSourceChip` owns this shape already: one source is a link chip with a
 * hover preview; several collapse to `domain +n` whose popover lists them all,
 * keyboard and screen-reader reachable. The registry URL on each registration
 * (`source`) is what gives the chip its domain text and its destination.
 *
 * Domestic first — the state the business was formed in — then record order.
 */
/** The registry sources on their own, so a caller can fold them into one chip
 *  alongside whatever else attests the same value. Domestic first. */
export const registrationSources = (
  registrations: Registration[],
  domesticState?: string | null
): ChatSourceData[] => {
  const ordered = [
    ...registrations.filter((r) => r.state === domesticState),
    ...registrations.filter((r) => r.state !== domesticState)
  ]

  return ordered.map((r, i) => {
    const jurisdiction = (r.jurisdiction ?? '').toLowerCase()
    const st = registrationState(r)
    const tone = toneOfStatus(st.status, st.subStatus)
    return {
      id: `${r.state}-${r.fileNumber ?? i}`,
      // The chip reads "SOS · CA". No `domain` and no `url`: the core chip's
      // byline is domain + annotation, and a domain would put the chip text on
      // the line meant for the source.
      label: `SOS · ${r.state}`,
      // The state leads, as every record from a place does — "California" with
      // its status as a tag — over the source and whether this is the
      // formation (domestic) filing or a foreign one.
      title: stateName(r.state),
      badge: (
        <StatusTag
          label={st.status ?? NOT_PROVIDED}
          tone={tone}
        />
      ),
      // What the reader wants on hover: which filing this is, and its standing.
      snippet: [
        r.sourceUrl ? new URL(r.sourceUrl).hostname.replace(/^www\./, '') : null,
        r.name,
        r.status ? `Status: ${r.status}` : null,
        `Sub-status: ${subStatusLabel(r)}`,
        r.fileNumber ? `File number: ${r.fileNumber}` : null,
        r.registrationDate ? `Registered ${r.registrationDate}` : null
      ]
        .filter(Boolean)
        .join(' · '),
      annotation: `Secretary of State${jurisdiction === 'domestic' ? ' · Formation' : jurisdiction === 'foreign' ? ' · Foreign' : ''}`
    }
  })
}

/**
 * A city business registration as a chip's preview, as a filing's is: the
 * city leading with its standing as a tag, over the register it is from, and
 * on hover the name it is registered under, the owner and the account. One
 * per city and account; from the record's city registrations, or — where the
 * record carries only the source references — from those.
 */
export const cityRegistrationSources = (record: BusinessRecord): ChatSourceData[] => {
  const regs = record.cityRegistrations ?? []
  if (regs.length > 0) {
    const seen = new Set<string>()
    return regs.flatMap((r, i) => {
      const k = `${r.city}|${r.state}|${r.accountNumber ?? i}`
      if (seen.has(k)) return []
      seen.add(k)
      const same = regs.filter((x) => x.city === r.city && x.state === r.state && x.accountNumber === r.accountNumber)
      const open = same.some((x) => !x.locationEnd && !x.businessEnd)
      return [
        {
          id: `city-${k}`,
          label: 'City registration',
          title: `${r.city}, ${r.state}`,
          badge: <StatusTag label={open ? 'Active' : 'Closed'} tone={toneOfStatus(open ? 'active' : 'inactive', null)} />,
          snippet: [
            r.dba && `DBA: ${r.dba}`,
            r.owner && `Owner: ${r.owner}`,
            r.accountNumber && `Account: ${r.accountNumber}`,
            r.businessStart && `Since ${r.businessStart}`
          ]
            .filter(Boolean)
            .join(' · '),
          annotation: 'City business registration'
        }
      ]
    })
  }
  const refs = (record.names ?? []).flatMap((n) =>
    (n.sourceRefs ?? []).filter((x) => x.type === 'city_registration').map((x) => ({ name: n.name, ref: x }))
  )
  const seen = new Set<string>()
  return refs.flatMap(({ name, ref }) => {
    const m = (ref.metadata ?? {}) as { city?: string; state?: string; status?: string }
    const k = `${m.city}|${m.state}`
    if (!m.city || seen.has(k)) return []
    seen.add(k)
    return [
      {
        id: `city-${k}`,
        label: 'City registration',
        title: [m.city, m.state].filter(Boolean).join(', '),
        badge: m.status ? <StatusTag label={m.status} tone={toneOfStatus(m.status.toLowerCase(), null)} /> : undefined,
        snippet: [`Registered to ${name}`, m.status && `Status: ${m.status}`].filter(Boolean).join(' · '),
        annotation: 'City business registration'
      }
    ]
  })
}
