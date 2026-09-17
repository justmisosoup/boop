import type { CSSProperties } from 'react'

/**
 * Token-driven syntax theme for `react-syntax-highlighter` (highlight.js
 * scopes). Every color is a literal `var(--core-color-syntax-*)` string, so it
 * resolves against whichever `.core-theme[data-theme]` scope is active — the
 * highlighted code follows light/dark mode with no JS and no re-render
 * (react-syntax-highlighter passes these values straight into inline `style`).
 *
 * This replaces the stock light-only `lightfair` palette (and the hand-copied
 * `SourceView/syntaxStyle.ts`), which froze token colors at a light palette
 * regardless of the active theme — unreadable on the dark code surface. It also
 * gives JSON keys (`hljs-attr`) their own color, which `lightfair` lacked.
 */
export const coreSyntaxStyle: Record<string, CSSProperties> = {
  hljs: {
    display: 'block',
    overflowX: 'auto',
    background: 'transparent',
    color: 'var(--core-color-syntax-fg)'
  },
  'hljs-attr': { color: 'var(--core-color-syntax-key)' },
  'hljs-attribute': { color: 'var(--core-color-syntax-key)' },
  'hljs-name': { color: 'var(--core-color-syntax-key)' },
  'hljs-string': { color: 'var(--core-color-syntax-string)' },
  'hljs-number': { color: 'var(--core-color-syntax-number)' },
  'hljs-literal': { color: 'var(--core-color-syntax-literal)' },
  'hljs-keyword': { color: 'var(--core-color-syntax-keyword)' },
  'hljs-built_in': { color: 'var(--core-color-syntax-keyword)' },
  'hljs-selector-tag': { color: 'var(--core-color-syntax-keyword)' },
  'hljs-meta': { color: 'var(--core-color-syntax-comment)' },
  'hljs-comment': { color: 'var(--core-color-syntax-comment)' },
  'hljs-variable': { color: 'var(--core-color-syntax-fg)' },
  'hljs-template-variable': { color: 'var(--core-color-syntax-fg)' }
}
