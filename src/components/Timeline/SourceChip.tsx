/*
 * Ported verbatim from the dashboard: `app/src/containers/Timeline/SourceChip.tsx`
 * (rebuilt in `c4379d1cd`). Every class string is the app's own — this half of
 * the tab is already Tailwind over `--core-*`, so it crosses without
 * re-expression. Change it upstream and re-copy (PARITY.md).
 *
 * Only the imports differ:
 *   - `businessId` is a prop rather than `useBusinessParams()`
 */

import { Link } from 'react-router'

import type { Source } from '../../lib/timeline/types'
import { cn } from '../../utils/twUtils'

const JURISDICTION_LABEL: Record<string, string> = {
  DOMESTIC: 'Domestic',
  FOREIGN: 'Foreign'
}

const TEXT =
  'shrink-0 whitespace-nowrap text-dense text-muted-foreground tabular-nums'

export const SourceChip = ({
  source,
  businessId
}: {
  source: Source
  /** The record this filing belongs to, so the chip can link to its card. The
   *  app reads this from the route with `useBusinessParams`. */
  businessId?: string
}) => {
  const jurisdiction = source.jurisdiction
    ? JURISDICTION_LABEL[source.jurisdiction]
    : undefined
  if (!source.state && !source.fileNumber) return null

  const body = (
    <>
      {source.state && <span className='text-foreground'>{source.state}</span>}
      {source.state && source.fileNumber && ' '}
      {source.fileNumber}
      {jurisdiction && (
        <>
          <span
            aria-hidden='true'
            className='text-[var(--core-color-border-strong)]'
          >
            {' · '}
          </span>
          {jurisdiction}
        </>
      )}
    </>
  )

  if (source.registrationId && businessId) {
    return (
      <Link
        className={cn(
          TEXT,
          '-mx-1 -my-0.5 inline-block rounded-md px-1 py-0.5 no-underline transition-colors duration-fast hover:bg-[var(--core-color-surface-subtle)] hover:text-foreground hover:no-underline',
          'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring'
        )}
        title='View this registration on the Sources tab'
        to={`/businesses/${businessId}/sources#${source.registrationId}`}
      >
        {body}
      </Link>
    )
  }
  return <span className={TEXT}>{body}</span>
}
