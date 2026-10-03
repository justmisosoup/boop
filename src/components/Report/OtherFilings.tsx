import type { ReactElement } from 'react'
import { Check, FileText, X } from 'lucide-react'

import { MetaChip } from '@/core'

import type { BusinessRecord } from '../../lib/deriveResults'
import { AttributeCells, type AttributeCell } from '../AttributeGrid'
import { cityRegistrationCells, isOpen } from './CityStrip'
import { Strip } from './Strip'

const icon = { 'aria-hidden': true, size: 12, strokeWidth: 2, className: 'shrink-0' } as const

/**
 * The filings other than the state's, as the State filings strip draws its
 * own: a chip per city registration, named by its city — open or closed, as
 * its mark — and one for a sole proprietor's DBA filing, what its state asks
 * of a trade name. Each opens its cells under the strip; closed until one is picked.
 */
export const OtherFilings = ({
  city,
  dbaRule
}: {
  city?: NonNullable<BusinessRecord['cityRegistrations']>
  dbaRule?: AttributeCell
}) => {
  const regs = city ?? []
  const cities = [...new Set(regs.map((r) => r.city))]
  // A tile per city, named by the city of the registration — "San Francisco" —
  // as the State filings strip names each filing by its state.
  const tiles = [
    ...cities.map((c) => {
      const here = regs.filter((r) => r.city === c)
      const open = here.some(isOpen)
      const name = here[0]?.state === 'DC' ? `${c}, DC` : c
      return {
        key: `city:${c}`,
        chip: (
          <MetaChip tone={open ? 'success' : 'danger'} size="compact">
            {open ? <Check {...icon} /> : <X {...icon} />}
            {name}
          </MetaChip>
        )
      }
    }),
    dbaRule && {
      key: 'dba',
      chip: (
        <MetaChip tone="neutral" size="compact">
          <FileText {...icon} />
          DBA filing
        </MetaChip>
      )
    }
  ].filter((t): t is { key: string; chip: ReactElement } => Boolean(t))
  if (tiles.length === 0) return null
  return (
    // Over the grid's last dashed rule, so the line between them is the
    // strip's solid one.
    <div className="relative -mt-px bg-card">
      <Strip
        label="Other filings"
        tiles={tiles}
        detail={(key) =>
          key.startsWith('city:') ? (
            <AttributeCells className="-mb-px" columns={3} items={cityRegistrationCells(regs, key.slice(5))} />
          ) : dbaRule ? (
            <AttributeCells className="-mb-px" items={[{ ...dbaRule, span: 'full' }]} />
          ) : null
        }
      />
    </div>
  )
}
