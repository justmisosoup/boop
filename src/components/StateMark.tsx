import type { InsightResult } from '../types'

/**
 * The state is carried by SHAPE first, colour second — a result, an unknown and a
 * no result must be distinguishable without relying on colour, and three of the
 * four no-result reasons carry no colour at all.
 */
export const StateMark = ({
  state,
  className = ''
}: {
  state: InsightResult['state']
  className?: string
}) => {
  // Two marks, not four: either the check returned something or it did not.
  const result = state === 'result'
  const label = result ? 'Result' : 'No result'

  return (
    <svg
      viewBox="0 0 12 12"
      className={['h-3 w-3 shrink-0', className].join(' ')}
      role="img"
      aria-label={label}
      fill="none"
    >
      <title>{label}</title>
      {result ? (
        <circle cx="6" cy="6" r="4" fill="currentColor" />
      ) : (
        <circle cx="6" cy="6" r="3.5" stroke="currentColor" strokeWidth="1" strokeDasharray="1.6 1.4" />
      )}
    </svg>
  )
}
