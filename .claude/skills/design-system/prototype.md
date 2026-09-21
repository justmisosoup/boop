# Reading these skills in the prototype

The four design skills in `.claude/skills/` are **verbatim clones** from the
dashboard (`/Users/sara-menefee/Projects/app`, `.agents/skills/`, commit
`a7b2f9bc9`). They are unmodified apart from one pointer line at the top of each
`SKILL.md` leading here, so re-syncing them stays a straight copy — the same
discipline `PARITY.md` holds for the `@/core` clone.

They were written for the dashboard. Six things read differently here. Where
this file and a cloned skill disagree, **this file wins**; where this file is
silent, the skill is right.

## 1. `@/core` is a clone. Never edit it.

The skill's whole "CHANGING the system" apparatus — the promotion bar, the
gates, the demotion path — **does not apply**. `src/core` here is a one-way
clone of the app's, pinned in `PARITY.md`. Nothing is written back and `/app` is
never modified.

So the skill's gated middle column collapses to a flat rule: **`src/core/**` is
read-only.** Everything you build is LOCAL (`src/components/`, `src/pages/`,
`src/lib/`).

Needing a primitive the barrel doesn't export is not a promotion decision, it is
a copy: take its file from the app, take its transitive `src/core` imports, and
add a line to `src/core/index.ts`. `PARITY.md` records the three files that have
diverged and why; add to that ledger if you ever have to make a fourth.

A change that genuinely belongs in the design system goes **upstream in `app`
first**, then arrives here by re-cloning. Not the other way round.

## 2. There is no workbench.

`/internal/design-system` does not exist here, so every instruction to "open the
workbench specimen" has no target. Verify against the running prototype instead
— `localhost:3000` (`.claude/launch.json`, `preview_start` with name
`prototype`), on both real screens: the businesses list and a record.

`pitfalls.md` is still worth reading; its traps are about real routes with real
data, which is exactly what this is. Only the workbench step is missing.

## 3. Tailwind 3, and the config is `.cjs`.

The app is on Tailwind 4 with `tailwind.config.js` and `@config`. This is
Tailwind 3 with `tailwind.config.cjs` (the package is `type: module`) and
`@tailwind base/components/utilities` in `src/theme.css`. Token utilities and
`cn()` behave the same; the `@config` and v4-only syntax in the skills do not
apply.

Two custom screens are **page-layout budgets, not device sizes**: `wide`
(1104px) docks the record panel and `desk` (1504px) adds the contents rail. Both
already include the 224px global nav rail — the comments in the config derive
them. Don't treat them as `lg`/`xl` analogues.

## 4. There is no legacy stack to choose.

`component-patterns` routes styling decisions between styled-components +
`theme.ts` and `@/core`. Here there is no such choice: the legacy palette keys
(`dawn`, `frost`, `graphite`, `karl`, `midnight`, `yellow`) were deliberately
removed from the Tailwind config, and every visual value is a `--core-*` token.

Read `component-patterns` for React mechanics only — component structure, hooks,
props conventions. Ignore its styling half. `styled-components` is installed
because cloned core files use it; that is not licence for new product code to.

A consequence worth naming: some real app components can't be ported verbatim,
because they are styled-components over `theme.colors.frost`. Re-express that
chrome in `--core-*` tokens; keep the component's structure and its reasoning.

## 5. The result-state grammar is a deliberate divergence. Don't "fix" it.

`PARITY.md` records one place where this prototype knowingly departs from
`@/core`, with the reasoning in `../decisions/001`, `002` and `003`:

- **A no result gets no chip at all.** Not `MetaChip tone='warning'`, not
  `OutcomeBadge`. Absence is rendered as absence — lighter, no surface fill, no
  border accent, no status tone. Giving absence a chip gives it the visual
  apparatus of a finding, which is the failure the concept exists to prevent.
- **`StateMark` is new and intentional** — shape before colour, because three
  states plus a promoted reason is more than five tones can carry when only
  `neutral` is non-committal.
- **`toOutcomeSentiment` is not used.** It maps `unverified` and `unsupported`
  to `negative`.
- **A reason is a plain sentence**, not a `not_published` chip.

The skills' "same primitive for the same job" rule will read as a violation
here. It isn't. Read `PARITY.md` before changing anything in the insight rows.

## 6. Porting a screen from `app`: read the real thing first.

Most work here rebuilds something the dashboard already has. Composing correct
`@/core` primitives is **not** sufficient — you can get every token right and
still ship a screen that doesn't look like the product, because the app's
version has chrome you never saw.

That has happened. The businesses list was built from core primitives with
correct tokens, and still missed the card container, the status chip's real
component and wording, the column order, and the sticky-header docking — because
the app's own page was never opened.

So, before building or restyling any screen that exists in the dashboard:

1. **Find its real implementation.** Routes live in `app/src/router.tsx`; pages
   live in `app/src/containers/<Feature>/`. Read the container, its list/table
   child, its `Toolbar`, its `columns.ts` and its `constants.ts`.
2. **Port its real components, not equivalents.** If the app has
   `MetaTagStatus`, port `MetaTagStatus` — don't reach for a different badge and
   invent a status mapping. Keep the component's name and its comments; note the
   source path in a docblock so the next reader can diff it.
3. **Take its real numbers.** Column widths, densities, offsets and class
   strings are decisions someone already made. `BUSINESS_COLUMN_WIDTHS` is data,
   not a suggestion.
4. **Port the mechanism, not a shortcut.** The app docks its sticky table header
   to a measured `--bus-thead-top`. A hardcoded offset looks fine until the bar
   changes height.
5. **Keep its reasoning.** The app's comments say *why* — "plain text, no chip,
   so the row stays quiet next to the Status chip". That sentence is the design
   decision. Carry it over.
6. **Say what you could not port**, and why. Missing data is a fine reason; not
   having looked is not.

When app data doesn't exist here, drop the column or simplify the cell — don't
synthesise it, and don't quietly substitute a different presentation without
saying so.
