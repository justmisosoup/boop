import { describe, expect, test } from 'vitest'

import { coreSyntaxStyle } from './syntaxStyle'

describe('coreSyntaxStyle', () => {
  test('drives every token color from a --core-color-syntax-* var so it is mode-aware', () => {
    const colors = Object.values(coreSyntaxStyle)
      .map(rule => rule.color)
      .filter((color): color is string => typeof color === 'string')

    expect(colors.length).toBeGreaterThan(0)
    for (const color of colors) {
      expect(color).toMatch(/^var\(--core-color-syntax-[a-z]+\)$/)
    }
  })

  test('colors the JSON scopes lightfair left on the base color (keys, literals)', () => {
    expect(coreSyntaxStyle.hljs.color).toBe('var(--core-color-syntax-fg)')
    expect(coreSyntaxStyle['hljs-attr'].color).toBe(
      'var(--core-color-syntax-key)'
    )
    expect(coreSyntaxStyle['hljs-string'].color).toBe(
      'var(--core-color-syntax-string)'
    )
    expect(coreSyntaxStyle['hljs-number'].color).toBe(
      'var(--core-color-syntax-number)'
    )
    expect(coreSyntaxStyle['hljs-literal'].color).toBe(
      'var(--core-color-syntax-literal)'
    )
  })

  test('never ships a hard-coded hex color (would freeze the palette to one mode)', () => {
    expect(JSON.stringify(coreSyntaxStyle)).not.toMatch(/#[0-9a-fA-F]{3,6}/)
  })
})
