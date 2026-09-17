# Core-internal UI substrate

This directory holds shadcn-generated Radix/Tailwind primitives that sit *underneath* the Middesk-owned `src/core` API. It exists so that:

1. Product code has one import path (`@/core`) and one prop vocabulary.
2. Raw shadcn output can change without rippling through product code.
3. Theming is enforced by the wrapper layer, not by individual callers.

## File ownership

| Path                          | Owner          | Imported by                              |
| ----------------------------- | -------------- | ---------------------------------------- |
| `src/core/<Name>.tsx`         | Middesk        | Product code, via `@/core`               |
| `src/core/internal/ui/*.tsx`  | shadcn (copy)  | Wrappers in `src/core/<Name>.tsx` only   |

Product code must not import from `@/core/internal/ui` directly. If you find yourself reaching in, add or extend a wrapper in `src/core` instead.

## How files get here

This directory is the `aliases.components` target in `components.json`:

```json
"aliases": {
  "components": "@/core/internal/ui"
}
```

So `bunx shadcn add <name>` writes `src/core/internal/ui/<name>.tsx`. You then hand-author `src/core/<Name>.tsx` that imports and wraps it.

## Worked example — adding a `Checkbox`

```bash
bunx shadcn add checkbox
# writes src/core/internal/ui/checkbox.tsx (raw shadcn output)
```

Then create `src/core/Checkbox.tsx` that:

- Imports the raw primitive from `./internal/ui/checkbox`.
- Replaces Tailwind palette classes (`border-primary`, raw hex) with semantic CSS variables (`var(--core-color-control-border)`).
- Exposes Middesk's size vocabulary (`compact` / `standard`) via `cva`.
- Hides shadcn prop surfaces you don't want product code to depend on.

Then export from `src/core/index.ts`. Product code does `import { Checkbox } from '@/core'`.

## `.core-theme` scoping requirement

The primitives in this directory and their wrappers depend on CSS variables and classes defined under the `.core-theme` selector in `src/core/theme.css`. Anything that consumes them must render inside a `.core-theme` ancestor, or styling silently no-ops. Today this is only enforced by `src/containers/DesignSystemWorkbench`; when a product route adopts these primitives, it must wrap appropriately.

## Expect `components.json` and `tailwind.config.js` to evolve

As more primitives migrate into this pattern:

- `components.json` may need additional aliases, registry entries, or style adjustments as the shadcn surface in use grows.
- `tailwind.config.js` will gain more `colors.*`, `borderRadius.*`, and animation entries that map to new `--core-*` tokens. Each new shadcn primitive tends to want one or two utilities it expects to resolve against the theme.

Both files are part of the substrate's seam with shadcn — treat them as living config, not one-time setup. `components.json` is parsed as strict JSON by the shadcn CLI and cannot carry inline comments, so this README is the canonical place to document its role.

## Migration scope

Existing Operator-local components are not moved by this PR; they remain legacy route-owned UI until a migration issue explicitly ports them into `src/core`.
