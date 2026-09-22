/*
 * Ported verbatim from the dashboard: `app/src/containers/Timeline/layout.ts`
 * (rebuilt in `c4379d1cd`). This file is a clone — change it upstream and
 * re-copy, the way `src/core` is handled (PARITY.md).
 *
 * Only the imports differ, and only where the prototype has no equivalent:
 *   - nothing
 */

import type React from 'react'

import type { LAYOUT } from './constants'

export const layoutVars = (layout: typeof LAYOUT): React.CSSProperties =>
  ({
    '--tl-row-h': `${layout.rowHeight}px`,
    '--tl-header-h': `${layout.headerHeight}px`,
    '--tl-label-w': `${layout.labelWidth}px`,
    '--tl-gap-pad': `${layout.gapPad}px`,
    '--tl-node': `${layout.nodeSize}px`,
    '--tl-rail-w': `${layout.railWidth}px`,
    '--tl-node-tint': `${layout.nodeTint}%`,
    '--tl-strip-h': `${layout.stripHeight}px`,
    '--tl-gap-inset': `${layout.gapInset}px`,
    '--tl-gap-step': `${layout.gapStep}px`
  }) as React.CSSProperties
