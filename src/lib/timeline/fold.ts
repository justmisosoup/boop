/*
 * Ported verbatim from the dashboard: `app/src/containers/Timeline/fold.ts`
 * (rebuilt in `c4379d1cd`). This file is a clone — change it upstream and
 * re-copy, the way `src/core` is handled (PARITY.md).
 *
 * Only the imports differ, and only where the prototype has no equivalent:
 *   - nothing
 */

import { FOLD_AT, FOLD_SHOW } from './constants'
import type { Change, ChangeAction, Kind } from './types'

export type ChangeGroup = {
  key: string
  kind: Kind
  action: ChangeAction
  visible: Change[]
  hidden: Change[]
}

export const foldChanges = (
  changes: Change[],
  { foldAt = FOLD_AT, show = FOLD_SHOW } = {}
): ChangeGroup[] => {
  const groups: ChangeGroup[] = []
  for (const change of changes) {
    const last = groups[groups.length - 1]
    if (last && last.kind === change.kind && last.action === change.action) {
      last.visible.push(change)
      continue
    }
    groups.push({
      key: `${change.kind}-${change.action}-${change.id}`,
      kind: change.kind,
      action: change.action,
      visible: [change],
      hidden: []
    })
  }
  return groups.map(group =>
    group.visible.length > foldAt
      ? {
          ...group,
          visible: group.visible.slice(0, show),
          hidden: group.visible.slice(show)
        }
      : group
  )
}
