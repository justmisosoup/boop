import { Building2 } from 'lucide-react'

import { MetaChip } from '@/core'

import type { BusinessRecord } from '../../lib/deriveResults'
import { relatedBusinessesOf } from '../../lib/relatedBusinesses'
import { AttributeCells } from '../AttributeGrid'
import { cellsFor } from '../ConnectionSections'
import { Strip } from './Strip'

const icon = { 'aria-hidden': true, size: 12, strokeWidth: 2, className: 'shrink-0' } as const

/**
 * The businesses related to this one, as a strip of tiles — one per business,
 * strongest first — each opening to what it shares: the people, with the
 * titles the filing gives, a business named on the other's filing, the
 * addresses. Neighbours (one shared commercial address) are not here.
 */
/** How a business is related: by people, by address, or both. */
type Kind = 'people' | 'address' | 'both'
const kindOf = (c: ReturnType<typeof relatedBusinessesOf>[number]): Kind => {
  const people = (c.people ?? []).length + (c.businesses ?? []).length > 0
  const address = (c.addresses ?? []).length > 0
  return people && address ? 'both' : people ? 'people' : 'address'
}
const KINDS: Array<{ id: Kind; label: string }> = [
  { id: 'both', label: 'People + Address' },
  { id: 'people', label: 'People' },
  { id: 'address', label: 'Address' }
]

export const RelatedBusinesses = ({ record }: { record: BusinessRecord }) => {
  const related = relatedBusinessesOf(record)
  if (related.length === 0) return null
  // A tile per way of being related — shared people and address, people
  // alone, address alone — counted, opening to the businesses related that way.
  const kinds = KINDS.filter((k) => related.some((c) => kindOf(c) === k.id))
  return (
    <div className="border-b border-[var(--core-color-border-divider)]">
      <Strip
        label="Related businesses"
        tiles={kinds.map((k) => {
          const n = related.filter((c) => kindOf(c) === k.id).length
          return {
            key: k.id,
            chip: (
              <MetaChip tone="neutral" size="compact">
                <Building2 {...icon} />
                {k.label}
                <span className="tabular-nums text-text-secondary">{n}</span>
              </MetaChip>
            )
          }
        })}
        detail={(key) => (
          <>
            {related
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
