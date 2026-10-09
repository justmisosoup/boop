/** The feature's shared constants: the KYB kind vocabulary — colors + glyphs
 *  shared by the canvas marks and the legend, so the two read as one product.
 *
 *  Ported from app/src/containers/Explorer/constants.ts — the kind vocabulary
 *  only. The panel/dock geometry (widths, clamps, the dock inset) is not
 *  ported: neither the docked panel nor the agent dock is. `HUBGRAY` is the
 *  stylesheet's `--hubgray` (a token) rather than the app's hex. */
import type { KybEdge, KybNodeKind } from './types'

export const KIND: Record<
  KybNodeKind,
  { ink: string; glyph: string; round: number | string }
> = {
  business: {
    ink: 'var(--g-cat-teal)',
    round: 'var(--core-radius-card)',
    glyph: 'M4 21V8l8-5 8 5v13M4 21h16M9 21v-5h6v5'
  },
  person: {
    ink: 'var(--g-cat-violet)',
    round: '50%',
    glyph: 'M12 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM5 20a7 7 0 0114 0'
  },
  address: {
    ink: 'var(--g-cat-slate)',
    round: 'var(--core-radius-card)',
    glyph:
      'M12 21s6-5.7 6-11a6 6 0 10-12 0c0 5.3 6 11 6 11zM12 12a2 2 0 100-4 2 2 0 000 4'
  },
  phone: {
    ink: 'var(--g-cat-cyan)',
    round: 'var(--core-radius-card)',
    glyph:
      'M6 3h3l2 5-2.5 1.5a11 11 0 005 5L16 12l5 2v3a2 2 0 01-2 2A15 15 0 014 6a2 2 0 012-3z'
  },
  domain: {
    ink: 'var(--g-cat-azure)',
    round: 'var(--core-radius-card)',
    glyph:
      'M12 3a9 9 0 100 18 9 9 0 000-18zM3.5 9h17M3.5 15h17M12 3a13 13 0 000 18M12 3a13 13 0 010 18'
  }
}

/** the kind's user-facing noun, SINGULAR — the plate caption's fallback when
 *  a node has no subtitle, and the source the legend's key rows derive from.
 *  One vocabulary per kind across every surface. */
export const KIND_NOUN: Record<KybNodeKind, string> = {
  business: 'Business',
  person: 'Person',
  address: 'Address',
  phone: 'Phone',
  domain: 'Website'
}

/** the semantic order kinds are listed in (the app's panelModel KIND_ORDER) */
export const KIND_ORDER: KybNodeKind[] = [
  'business',
  'person',
  'address',
  'phone',
  'domain'
]

export const EDGE_INK: Record<KybEdge['kind'], string> = {
  control: 'var(--g-cat-teal)',
  location: 'var(--g-cat-slate)',
  digital: 'var(--g-cat-cyan)',
  record: 'var(--g-cat-plum)',
  // identity is a SUGGESTION, not an asserted tie (already dotted) → neutral, not red
  identity: 'var(--hubgray)'
}

/** mass-connected context (registered agent / mass address) reads in this gray */
export const HUBGRAY = 'var(--hubgray)'

/** emphasis tiers that render as a quiet station ring (not a full glyph tile) */
export const STATION = new Set(['world', 'ghost', 'faded', 'hidden'])
