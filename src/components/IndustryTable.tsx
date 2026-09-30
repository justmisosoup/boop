import { Fragment } from 'react'

import type { AttributeRow } from '../lib/attributes'
import { cn } from '../utils/twUtils'

/**
 * The industry classifications, as the dashboard's IndustryClassificationCard
 * lays them out (`app/src/containers/BusinessHome/HighCards/`): one row per
 * scheme, each of its classifications a line within it, the code, category and
 * confidence of each lined up across the row.
 *
 * A grid rather than a table, for its column sizing: the four columns take
 * their content's width and shrink (wrapping the category) only when the card
 * is narrower than that, and a last `1fr` column takes whatever is left — so
 * the confidence sits just after the longest category in the wide side panel
 * and still fits in the report's narrower column. The scheme spans its lines,
 * so a category that wraps keeps its code and confidence beside it.
 *
 * Two differences from the app: "Classification" heads the first column, and a
 * long category wraps rather than clipping behind a description tooltip we have
 * no descriptions for.
 */
const ORDER = ['Prohibited', 'NAICS', 'MCC', 'SIC']

const HEAD = 'pl-4 pb-2 pt-3 text-caption leading-snug text-text-secondary whitespace-nowrap'
const CELL = 'pl-4 text-sm leading-snug'

export const IndustryTable = ({ rows }: { rows: AttributeRow[] }) => {
  const schemes = ORDER.map((scheme) => [scheme, rows.filter((r) => r.label === scheme)] as const).filter(
    ([, list]) => list.length > 0
  )
  if (schemes.length === 0) return null

  return (
    <div role="table" className="grid grid-cols-[auto_auto_auto_auto_1fr]">
      <div role="row" className="contents">
        <span role="columnheader" className={HEAD}>Classification</span>
        <span role="columnheader" className={HEAD}>Code</span>
        <span role="columnheader" className={HEAD}>Category</span>
        <span role="columnheader" className={cn(HEAD, 'pr-4')}>Confidence</span>
        <span aria-hidden="true" />
      </div>
      {schemes.map(([scheme, list]) => (
        <Fragment key={scheme}>
          <div aria-hidden="true" className="col-span-full h-px bg-[var(--core-color-border-divider)]" />
          {list.map((r, i) => {
            // The scheme's first line takes its top padding, its last the bottom;
            // the lines between sit 4px apart, as the app's do.
            const pad = cn(i === 0 ? 'pt-3' : 'pt-1', i === list.length - 1 && 'pb-3')
            return (
              <div role="row" key={i} className="contents">
                {i === 0 && (
                  <span
                    role="cell"
                    className={cn(CELL, 'py-3 whitespace-nowrap')}
                    style={{ gridRow: `span ${list.length}` }}
                  >
                    {scheme}
                  </span>
                )}
                <span role="cell" className={cn(CELL, pad, 'whitespace-nowrap tabular-nums')}>
                  {r.lead ?? '-'}
                </span>
                <span role="cell" className={cn(CELL, pad)}>
                  {r.value}
                </span>
                <span role="cell" className={cn(CELL, pad, 'pr-4 whitespace-nowrap tabular-nums')}>
                  {r.trailing}
                </span>
                <span aria-hidden="true" />
              </div>
            )
          })}
        </Fragment>
      ))}
    </div>
  )
}
