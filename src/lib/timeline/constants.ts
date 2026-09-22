/*
 * Ported verbatim from the dashboard: `app/src/containers/Timeline/constants.ts`
 * (rebuilt in `c4379d1cd`). This file is a clone — change it upstream and
 * re-copy, the way `src/core` is handled (PARITY.md).
 *
 * Only the imports differ, and only where the prototype has no equivalent:
 *   - nothing
 */

import type { Kind } from './types'

export const LIST_WINDOW = 100

// Before this year the source carries only initial filings.
export const COVERAGE_START_YEAR = 2019
export const COVERAGE_DOCS_URL =
  'https://docs.middesk.com/docs/monitor-overview'

export const FOLD_AT = 5
export const FOLD_SHOW = 4

export const KIND_ORDER: Kind[] = [
  'officer',
  'name',
  'address',
  'registration',
  'standing',
  'other'
]

export const KIND_LABEL: Record<Kind, { singular: string; plural: string }> = {
  officer: { singular: 'Officer', plural: 'Officers' },
  name: { singular: 'Name', plural: 'Names' },
  address: { singular: 'Address', plural: 'Addresses' },
  registration: { singular: 'Registration', plural: 'Registration' },
  standing: { singular: 'Standing', plural: 'Standing' },
  other: { singular: 'Other', plural: 'Other' }
}

export const KIND_COLOR_VAR: Record<Kind, string> = {
  officer: 'var(--core-color-categorical-1)',
  name: 'var(--core-color-categorical-2)',
  address: 'var(--core-color-categorical-3)',
  registration: 'var(--core-color-categorical-4)',
  standing: 'var(--core-color-categorical-5)',
  other: 'var(--core-color-text-disabled)'
}

export const LAYOUT = {
  rowHeight: 32,
  headerHeight: 24,
  labelWidth: 144,
  gapPad: 16,
  nodeSize: 24,
  railWidth: 40,
  stemWidth: 4,
  segmentHeight: 12,
  stripHeight: 88,
  nodeTint: 14,
  gapInset: 8,
  gapStep: 8
} as const
