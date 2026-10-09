/**
 * The region-label layer — the map's quiet geography (the districts revival).
 *
 * State names behind an open address fan, rendered through React Flow's
 * `ViewportPortal`: graph coordinates (pan/zoom for free, no viewport
 * subscription — the DESIGN.md camera-motion law), OUTSIDE fitView bounds
 * and the nameplate solver, and painted in the viewport's negative stratum
 * (`z-index: -1`) so edges, marks, and cards all float above — features over
 * areal names, the cartographic order. The mark halo knockout occludes any
 * word passing under a tile for free.
 *
 * The areal VOICE (styles.css `.g-region`) is the one sanctioned caps use on
 * the canvas: tracked caps at 400 encode a region's extent, never importance
 * on a point — the card grammar's no-caps law stands, and the name keeps the
 * canvas's one bold.
 *
 * Ported from app/src/containers/Explorer/graph/Regions.tsx. The `?regions=1`
 * tuning lab (RegionsLab) is not ported — it is a dev proofing tool.
 */
import { memo } from 'react'
import { ViewportPortal } from '@xyflow/react'

import { REGION_PUSH, type RegionSpec } from './regionModel'

export const RegionLayer = memo(function RegionLayer({
  regions
}: {
  regions: readonly RegionSpec[]
}) {
  if (regions.length === 0) return null
  return (
    <ViewportPortal>
      <div
        aria-hidden='true'
        className='g-regionlayer'
        style={{ ['--g-region-push-base' as string]: `${REGION_PUSH}px` }}
      >
        {regions.map(r => (
          <span
            className='g-region'
            key={r.id}
            style={{
              left: r.x,
              top: r.y,
              ['--g-rx' as string]: r.ux,
              ['--g-ry' as string]: r.uy
            }}
          >
            <span className='g-r-full'>{r.label}</span>
            <span className='g-r-abbr'>{r.abbr}</span>
          </span>
        ))}
      </div>
    </ViewportPortal>
  )
})
