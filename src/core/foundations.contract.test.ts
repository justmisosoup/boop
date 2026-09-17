import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, test } from 'vitest'

/**
 * Foundation consumption contract.
 *
 * Tailwind resolves ambiguous arbitrary values (`text-[…]`, `shadow-[…]`,
 * `border-[…]`, …) containing a bare `var()` to *color*. Passing a non-color
 * token through one of these silently drops the declaration — this bit us
 * twice before this test existed (box-shadows in Menu, font sizes in Text,
 * which made all body text render at the inherited 16px instead of the
 * 14px token).
 *
 * The contract:
 * - Color tokens may be consumed via mapped utilities (`text-foreground`,
 *   `border-border`, `bg-popover`) or arbitrary `*-[var(--core-color-*)]`.
 * - Non-color tokens (type, elevation, radius) must use the mapped
 *   utilities from tailwind.config.js (`text-body`, `shadow-elevation-*`,
 *   `rounded-control`, …) or an explicit type hint
 *   (`text-[length:var(…)]`).
 */

const CORE_DIR = __dirname
const SCANNED_DIRS = [
  CORE_DIR,
  path.resolve(CORE_DIR, '../containers/DesignSystemWorkbench')
]

const AMBIGUOUS_VAR =
  /(?:text|shadow|border|ring|stroke|font|decoration|outline)-\[var\((--[a-z0-9-]+)\)/g

// `--core-color-elevation-*` matches the color namespace but holds shadow
// lists, not colors — it is explicitly excluded. `--core-badge-`/`--core-count-`/
// `--core-tag-` are sanctioned per-primitive color-indirection prefixes (each
// resolves to `--core-color-*` via inline style).
const COLOR_TOKEN = /^--core-(?:color-(?!elevation-)|badge-|count-|tag-)/

const tsxFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return tsxFiles(full)
    return entry.name.endsWith('.tsx') && !entry.name.includes('.test.')
      ? [full]
      : []
  })

describe('foundation consumption contract', () => {
  test('ambiguous Tailwind arbitrary values only carry color tokens', () => {
    const violations: string[] = []

    for (const file of SCANNED_DIRS.flatMap(tsxFiles)) {
      const source = fs.readFileSync(file, 'utf8')

      for (const match of source.matchAll(AMBIGUOUS_VAR)) {
        if (!COLOR_TOKEN.test(match[1])) {
          violations.push(
            `${path.relative(CORE_DIR, file)}: ${match[0]})] — non-color token in a color-defaulting utility; use a mapped utility (text-body, shadow-elevation-*, rounded-*) or a type hint`
          )
        }
      }

      // Shadows are never colors in our token set — ban the bare form
      // outright, including `--core-color-elevation-*`.
      for (const match of source.matchAll(/shadow-\[var\((--[a-z0-9-]+)\)/g)) {
        violations.push(
          `${path.relative(CORE_DIR, file)}: ${match[0]})] — use shadow-elevation-* from tailwind.config.js`
        )
      }
    }

    expect(violations).toEqual([])
  })
})
