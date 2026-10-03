import { Building2 } from 'lucide-react'

import { HoverCard, HoverCardContent, HoverCardTrigger, MetaChip } from '@/core'

import type { BusinessRecord } from '../../lib/deriveResults'
import { relatedBusinessesOf } from '../../lib/relatedBusinesses'
import { AttributeCells } from '../AttributeGrid'
import { cellsFor } from '../ConnectionSections'
import { Strip } from './Strip'

const icon = { 'aria-hidden': true, size: 12, strokeWidth: 2, className: 'shrink-0' } as const

/**
 * The businesses connected to this one, as a strip of tiles by how they are
 * connected — people and an address, people, addresses — each opening to the
 * businesses connected that way and what they share: the people, with the
 * titles the filing gives, a business named on the other's filing, the
 * addresses. A connection on one shared commercial address is a neighbour,
 * not a related business; it is shown last, under its own tile, so the data
 * is there without being counted as related.
 */
type Kind = 'people' | 'address' | 'both' | 'neighbour'
type Connection = NonNullable<BusinessRecord['connections']>[number]
const KINDS: Array<{ id: Kind; label: string }> = [
  { id: 'both', label: 'People + Address' },
  { id: 'people', label: 'People' },
  { id: 'address', label: 'Address' },
  { id: 'neighbour', label: 'Shared address only' }
]

/** How many businesses a tile's hover names before "+ N more". */
const SHOWN = 4

/** What a connected business shares with this one, in a few words. */
const shared = (c: Connection) => {
  const people = [...(c.people ?? []), ...(c.businesses ?? [])].map((p) => p.name)
  const addresses = (c.addresses ?? []).length
  return [
    people.length > 0 && (people.length <= 2 ? people.join(', ') : `${people.slice(0, 2).join(', ')} + ${people.length - 2}`),
    addresses > 0 && `${addresses} address${addresses === 1 ? '' : 'es'}`
  ]
    .filter(Boolean)
    .join(' · ')
}

export const RelatedBusinesses = ({ record }: { record: BusinessRecord }) => {
  const connections = record.connections ?? []
  if (connections.length === 0) return null
  const related = new Set(relatedBusinessesOf(record))
  const kindOf = (c: Connection): Kind => {
    if (!related.has(c)) return 'neighbour'
    const people = (c.people ?? []).length + (c.businesses ?? []).length > 0
    const address = (c.addresses ?? []).length > 0
    return people && address ? 'both' : people ? 'people' : 'address'
  }
  const kinds = KINDS.filter((k) => connections.some((c) => kindOf(c) === k.id))
  return (
    <div>
      <Strip
        label="Connections"
        tiles={kinds.map((k) => {
          const these = connections.filter((c) => kindOf(c) === k.id)
          const n = these.length
          return {
            key: k.id,
            // Pointed at, the chip names the businesses connected that way and
            // what each shares — the people, an address.
            chip: (
              <HoverCard openDelay={300}>
                <HoverCardTrigger asChild>
                  <span className="flex">
                    <MetaChip tone="neutral" size="compact">
                      <Building2 {...icon} />
                      {k.label}
                      <span className="tabular-nums text-text-secondary">{n}</span>
                    </MetaChip>
                  </span>
                </HoverCardTrigger>
                <HoverCardContent side="top" className="w-72 p-3">
                  <span className="block text-sm font-medium text-foreground">
                    {n} business{n === 1 ? '' : 'es'} · {k.label}
                  </span>
                  <ul className="mt-1.5 flex flex-col gap-1 text-caption">
                    {these.slice(0, SHOWN).map((c, i) => (
                      <li key={c.id ?? i} className="flex flex-col">
                        <span className="truncate text-foreground">{c.name}</span>
                        <span className="truncate text-text-secondary">{shared(c)}</span>
                      </li>
                    ))}
                    {n > SHOWN && <li className="text-text-secondary">+ {n - SHOWN} more</li>}
                  </ul>
                </HoverCardContent>
              </HoverCard>
            )
          }
        })}
        detail={(key) => (
          <>
            {connections
              .map((c, i) => [c, i] as const)
              .filter(([c]) => kindOf(c) === key)
              .map(([c, i]) => (
                // A solid rule between businesses; the dashed rules stay within one.
                <div key={c.id ?? i} className="overflow-hidden border-b border-[var(--core-color-border-divider)] last:border-b-0">
                  <AttributeCells items={cellsFor(c, i)} className="-mb-px" />
                </div>
              ))}
          </>
        )}
      />
    </div>
  )
}
