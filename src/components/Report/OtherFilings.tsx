import { FileText } from 'lucide-react'

import { MetaChip } from '@/core'

import type { BusinessRecord } from '../../lib/deriveResults'
import { AttributeCells, type AttributeCell } from '../AttributeGrid'
import { CityStrip } from './CityStrip'
import { Strip } from './Strip'

const icon = { 'aria-hidden': true, size: 12, strokeWidth: 2, className: 'shrink-0' } as const

/**
 * The filings other than the state's, under them: the city registrations as
 * their own section, drawn as the state filings are (`CityStrip`), then a sole
 * proprietor's DBA filing — what its state asks of a trade name — under Other
 * filings.
 */
export const OtherFilings = ({
  city,
  dbaRule
}: {
  city?: NonNullable<BusinessRecord['cityRegistrations']>
  dbaRule?: AttributeCell
}) => {
  const regs = city ?? []
  if (regs.length === 0 && !dbaRule) return null
  return (
    <>
      {regs.length > 0 && <CityStrip regs={regs} />}
      {dbaRule && (
        // Over the rule above it, so the line between them is the strip's solid one.
        <div className="relative -mt-px bg-card">
          <Strip
            label="Other filings"
            tiles={[
              {
                key: 'dba',
                chip: (
                  <MetaChip tone="neutral" size="compact">
                    <FileText {...icon} />
                    DBA filing
                  </MetaChip>
                )
              }
            ]}
            detail={() => <AttributeCells className="-mb-px" items={[{ ...dbaRule, span: 'full' }]} />}
          />
        </div>
      )}
    </>
  )
}
