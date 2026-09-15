/**
 * Semantic spacing tokens — CSS variable references for scoped theming.
 *
 * Values resolve at runtime via .core-theme defined in src/core/theme.css.
 * Spacing tokens are theme-invariant (same in light and dark).
 */

export const semanticSpacing = {
  xxs: 'var(--core-spacing-xxs)',
  xs: 'var(--core-spacing-xs)',
  sm: 'var(--core-spacing-sm)',
  md: 'var(--core-spacing-md)',
  lg: 'var(--core-spacing-lg)',
  xl: 'var(--core-spacing-xl)',
  '2xl': 'var(--core-spacing-2xl)',
  layoutMd: 'var(--core-spacing-layout-md)',
  '3xl': 'var(--core-spacing-3xl)',
  '4xl': 'var(--core-spacing-4xl)'
} as const

export type SemanticSpacingToken = keyof typeof semanticSpacing
