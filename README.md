# prototype

Phase 2. Renders from `catalog/` and `fixtures/`; does not compute.

```bash
bun install
bun run dev     # http://localhost:3000
```

`bun run data` regenerates `src/data/*.json` from the catalog and fixtures — it runs
automatically before `dev` and `build`, so changing the catalog changes the
prototype.

## What is here

- The assessment output screen, for F1 and F2.
- The result-state grammar: result, unknown, no result, with the reason as a plain
  sentence and `should_exist_not_found` promoted as the only adverse one.

## What is not

Composition flow, the proposal journey, F3 and F4. Search is deferred entirely.

## `src/data/results.ts` is a stand-in

The prototype renders; it does not compute. Those results are transcribed from
`concept/assessment.md`. They are deliberately NOT in `fixtures/`, which holds
attributes and provenance only so that phase 3 can derive the states rather than
play them back. When phase 3 lands, that file is deleted.

## `@/core` is a clone, not a rewrite

`src/core` and `src/utils/twUtils.ts` are cloned from the Middesk dashboard at commit
`f1add6296`, pruned to what this screen uses. Imports are `from '@/core'`, as in the
app. Read `PARITY.md` before changing anything under `src/core` — those files are
unmodified copies, and the only local change is the trimmed barrel.
