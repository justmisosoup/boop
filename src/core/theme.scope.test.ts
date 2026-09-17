import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, test } from 'vitest'

/**
 * Global-boundary additive-safety contract.
 *
 * `src/router.tsx` applies a single app-wide `.core-theme` light boundary so
 * every `@/core` primitive resolves its `--core-*` tokens on every route. That
 * is only safe to wrap around legacy pages because the BARE `.core-theme` rule
 * defines *only* CSS custom properties — it paints nothing itself, so it cannot
 * restyle a legacy element (which never reads `--core-*`). Every cascading
 * (painted) rule is instead scoped to a `.core-theme .core-*` descendant class
 * that legacy markup never emits.
 *
 * This test pins that guarantee: if someone later adds a painted property
 * (`color`, `background`, `font`, …) directly to the bare `.core-theme` rule
 * (or its dark variant), it would leak onto every legacy page under the global
 * boundary. Fail here, in CI, instead of in production.
 */

const THEME_CSS = path.join(__dirname, 'theme.css')

// A rule body contains no nested braces, so `[^}]*` captures it whole.
const declarations = (body: string): string[] =>
  body
    .replace(/\/\*[\s\S]*?\*\//g, '') // strip comments
    .split(';')
    .map(decl => decl.trim())
    .filter(Boolean)

describe('global core-theme boundary is additive (custom properties only)', () => {
  const css = fs.readFileSync(THEME_CSS, 'utf8')

  const assertVariablesOnly = (label: string, selector: RegExp) => {
    const match = css.match(selector)
    expect(
      match,
      `could not find the ${label} rule in theme.css`
    ).not.toBeNull()

    const painted = declarations(match?.[1] ?? '').filter(
      decl => !/^--[\w-]+\s*:/.test(decl)
    )

    expect(
      painted,
      `${label} must declare only CSS custom properties. A painted property here cascades onto every legacy page under the global boundary in src/router.tsx. Offending: ${painted.join(' | ')}`
    ).toEqual([])
  }

  test('the bare .core-theme (light) rule declares only custom properties', () => {
    assertVariablesOnly('.core-theme', /(?:^|\n)\.core-theme\s*\{([^}]*)\}/)
  })

  test('the .core-theme[data-theme="dark"] rule declares only custom properties', () => {
    assertVariablesOnly(
      '.core-theme[data-theme="dark"]',
      /\.core-theme\[data-theme="dark"\]\s*\{([^}]*)\}/
    )
  })
})
