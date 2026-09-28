# Working in this prototype

A Vite + React 19 + TypeScript prototype of the Middesk business-identity
assessment, running on `localhost:3000`. Two screens: the businesses list
(`/businesses`) and the assessment record it opens (`/businesses/:id`).

## Read these before touching UI

The dashboard's own design skills are cloned into `.claude/skills/`. Load them —
they are the bar this prototype is held to, not optional background:

| Doing | Load |
|---|---|
| building or styling any UI | **`design-system`**, and `design-system/prototype.md` first |
| matching a design exactly, fixing spacing/alignment | **`design-polish`** |
| a feature with several states | **`design-ux`** |
| React structure, hooks, props | **`component-patterns`** (React mechanics only — its styling half is the legacy stack, which does not exist here) |

`design-system/prototype.md` is the one local document: it says what those four
cloned skills get wrong about this repo. Read it before them.

Two further contracts, both authoritative:

- **`PARITY.md`** — what `@/core` is here, the files that differ from the app's, and
  the deliberate divergence in the result-state grammar.
- **`src/core/README.md`** — the design system's own contract, cloned with it.

## The rules that come up every time

1. **`src/core/**` is read-only.** It is a one-way clone of the app's `src/core`,
   pinned in `PARITY.md`. Nothing is written back and `/Users/sara-menefee/Projects/app`
   is never modified. Everything you build is LOCAL: `src/components/`,
   `src/pages/`, `src/lib/`. The clone is whole and its barrel is the app's public
   API; something it doesn't export isn't public in the app either.

2. **Rebuilding a screen the dashboard already has? Read the app's real
   implementation first.** Correct tokens are not enough — see
   `design-system/prototype.md` §6, which exists because this was got wrong.
   Routes are in `app/src/router.tsx`; pages in `app/src/containers/<Feature>/`.
   Port the app's real components, its real numbers, and its reasoning.

3. **Tokens only.** Every colour, space, radius, shadow and type value is a
   semantic `--core-*` token. The legacy palette keys (`dawn`, `frost`,
   `graphite`, `karl`, `midnight`, `yellow`) were removed from the Tailwind
   config on purpose.

4. **Don't invent records.** `src/data/records.json` holds the ingested
   businesses; `bun run pull` rewrites it wholesale from the live API. Never add
   rows by hand, and don't run `pull` (or `bun run build`, which calls it)
   unless a data refresh is the actual task.

## Running it

`preview_start` with name `prototype` (`.claude/launch.json`), or `bun run vite`
— port 3000. Verify changes in the browser on both screens, not just one.

`bun run build` fails on `tsc -b`, and has since before this prototype had a
second screen: the cloned `src/core` ships its colocated tests, and the test
dependencies aren't installed. `bunx vite build` is the real build check.

## Business formation and standing

- One implementation: `src/lib/registrationStatus.ts`. `domesticOf` and
  `formationFilingOf` pick the filing; `standingOf` classifies it from the table in
  `src/data/registrationStanding.json`. The score caps and the sub-status flag read it.
- The Formation card (`src/components/FormationCard.tsx`) is the one place filings are
  shown: the current domestic filing's grid, then — always from the record — a former
  or linked filing and every filing's status (`FORMATION_CARD_INSIGHTS` in
  `src/lib/identitySections.ts`). No report section repeats those rows.
- Where the business operates — the office address, the office-state check and every
  web check except the website's business name — is Activity & Permission's.
- Delaware and New Jersey publish no status; the table says so (`NOT_PUBLISHED`), and it
  is never a finding.
- `scripts/standing/` is only the offline tooling that builds the table — see its README.
