import type { CSSProperties } from 'react'

/**
 * A `MetaChip` on the inverse surface — the midnight the tooltip sits on —
 * with inverse text. Not a tone core offers (its five are neutral, info,
 * success, warning, danger): the chip's own colour variables are overridden,
 * so the shape, size and type stay the library's. Used for the chips that
 * carry weight on a workflow page: a required attribute, the Beta status.
 */
export const INVERSE_CHIP = {
  '--core-badge-bg': 'var(--core-color-surface-inverse)',
  '--core-badge-fg': 'var(--core-color-text-inverse)',
  '--core-badge-border': 'var(--core-color-surface-inverse)'
} as CSSProperties
