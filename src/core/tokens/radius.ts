/**
 * Semantic border-radius tokens — CSS variable references for scoped theming.
 *
 * Values resolve at runtime via .core-theme defined in src/core/theme.css.
 * Radius tokens are theme-invariant (same in light and dark).
 */

export const semanticRadius = {
  xxs: 'var(--core-radius-xxs)',
  xs: 'var(--core-radius-xs)',
  sm: 'var(--core-radius-sm)',
  md: 'var(--core-radius-md)',
  lg: 'var(--core-radius-lg)',
  control: 'var(--core-radius-control)',
  card: 'var(--core-radius-card)',
  modal: 'var(--core-radius-modal)',
  drawer: 'var(--core-radius-drawer)',
  popover: 'var(--core-radius-popover)',
  pill: 'var(--core-radius-pill)',
  full: 'var(--core-radius-full)'
} as const

export type SemanticRadiusToken = keyof typeof semanticRadius
