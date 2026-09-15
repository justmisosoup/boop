/**
 * Semantic typography tokens — CSS variable references for scoped theming.
 *
 * Values resolve at runtime via .core-theme defined in src/core/theme.css.
 * Typography tokens are theme-invariant (same in light and dark).
 */

export const semanticTypography = {
  fontFamily: {
    display: 'var(--core-font-family-display)',
    default: 'var(--core-font-family-default)'
  },
  fontSize: {
    xs: 'var(--core-font-size-xs)',
    sm: 'var(--core-font-size-sm)',
    md: 'var(--core-font-size-md)',
    lg: 'var(--core-font-size-lg)',
    xl: 'var(--core-font-size-xl)',
    displaySm: 'var(--core-font-size-display-sm)',
    displayMd: 'var(--core-font-size-display-md)',
    displayLg: 'var(--core-font-size-display-lg)',
    displayXl: 'var(--core-font-size-display-xl)'
  },
  fontWeight: {
    light: 'var(--core-font-weight-light)',
    normal: 'var(--core-font-weight-normal)',
    bold: 'var(--core-font-weight-bold)'
  }
} as const

export type SemanticTypographyToken =
  | `fontFamily.${keyof typeof semanticTypography.fontFamily}`
  | `fontSize.${keyof typeof semanticTypography.fontSize}`
  | `fontWeight.${keyof typeof semanticTypography.fontWeight}`
