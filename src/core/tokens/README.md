# Core token layering

The core design-system token stack has three layers:

1. **CSS variables are the runtime source of truth.**
   Theme-scoped decisions live in `src/core/theme.css` under `.core-theme` and optional `data-theme` values. Use this for color roles, elevation, focus, and component-shape roles that must stay mode-blind.

2. **TypeScript token maps are references, not a second source.**
   Files in `src/core/tokens/` expose typed names for styled-components, JS-driven primitives, and workbench specimens. They must point back to the CSS variables.

3. **Tailwind is consumption syntax and layout glue.**
   Tailwind semantic aliases should resolve to the same CSS variables. Tailwind should not introduce a competing design-token source.

## Primitive construction rule

Core primitives should express spacing, type, icon sizing, and shape through the
foundation variables in `src/core/theme.css`:

- Use `var(--core-spacing-*)` for padding, gaps, control height, and count/chip sizing.
- Use `var(--core-font-size-*)` and `var(--core-font-family-*)` for primitive text.
- Use `var(--core-radius-*)` for component shape.
- Use named surface and elevation roles together for panels, e.g. `Surface variant='raised'` should consume `--core-color-surface-raised`, `--core-color-border-strong`, and `--core-color-elevation-raised` rather than borrowing card elevation.
- Use role-aware size names for primitives. Prefer `compact` and `standard` over
  abstract `sm` / `md` / `lg`; each primitive maps those densities to its own
  anatomy. Buttons use action density, badges use status visibility, chips use
  contextual/interactive weight, and counts stay fixed until a concrete second
  role exists.
- Keep Tailwind arbitrary values out of `src/core` primitive anatomy unless they
  point at a semantic CSS variable, e.g. `text-[var(--core-color-text-danger)]`.

If a primitive needs `7px`, `11px`, or another non-foundation value, either map
it to the nearest foundation token or add a named foundation/role variable first.

## Content casing rule

Product UI copy should use sentence case. Primitive specimens and examples should
show labels like `High confidence`, `Needs review`, and `Could not load records`,
not `high confidence`, `NEEDS REVIEW`, or enum-shaped strings. Enum values may
stay lowercase in TypeScript, but visible labels should be formatted before
rendering.

## Naming rule

Prefer semantic roles over values:

- `surface.card`, not `white`
- `action.primary.bg`, not `midnightDark1`
- `risk.moderate.fg`, not `orange`
- `radius.card`, not `10px`

Keep raw size aliases only when they preserve compatibility or make low-level composition easier. Role names are preferred inside primitives because they explain intent.

## Current scope

These tokens are a scoped workbench proof and early core spine. They do not mean the full dashboard supports dark mode yet.
