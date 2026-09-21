# Parity ledger

The prototype uses the **real `@/core`**, cloned from the Middesk dashboard.

- **Source:** `/Users/sara-menefee/Projects/app`, `src/core`, at commit `f1add6296`
- **Cloned:** 2026-09-11
- **Direction:** one way. Nothing here is written back, and `/app` is never modified.

This supersedes the earlier build-fresh approach. That version rebuilt every
component and invented its own tokens; it did not look like the product, which was
the point of the exercise. The components below are the app's own files.

## What was cloned

| From `/app` | To | Modified? |
|---|---|---|
| `src/core/theme.css` | `src/core/theme.css` | No — all `--core-*` tokens, light and scoped dark |
| `src/core/tokens/` | `src/core/tokens/` | No |
| `src/core/theme.ts` | `src/core/theme.ts` | No |
| `src/core/Surface.tsx` | `src/core/Surface.tsx` | No — `Surface`, `Section`, `Heading`, `Text`, `MutedText`, `LabelText`, … |
| `src/core/Badge.tsx` | `src/core/Badge.tsx` | No |
| `src/core/Tag.tsx` | `src/core/Tag.tsx` | No |
| `src/utils/twUtils.ts` | `src/utils/twUtils.ts` | No — the tailwind-merge conflict groups |
| `tailwind.config.js` | `tailwind.config.cjs` | Renamed only (this package is `type: module`) |
| `tsconfig.json` compiler options | `tsconfig.json` | Mirrored, so the clone typechecks as it does at home |

Imports are `import { Surface, Text } from '@/core'`, exactly as in the app.

## The three local modifications

**1. The clone is pruned.** Only the primitives this screen consumes were copied.
The full `src/core` is 120 files and pulls in react-router, react-redux,
react-select, react-modal, sonner, styled-components, ionicons and more — a
dependency tail this prototype has no use for.

**2. `src/core/index.ts` is a trimmed barrel.** The app's is the full public API and
imports everything. This one re-exports only the pruned set. The *kept files* are
unmodified; only the barrel differs.

**3. `src/core/ChatSources.tsx` carries a `screenshot` field.** The first kept file
to be modified rather than cloned intact, so the re-clone is no longer a straight
copy for this one file.

`ChatSourceData` gained an optional `screenshot: { src, alt, onOpen? }`. When set,
the hover preview renders the capture where the headline would go, and `onOpen`
makes it the trigger for the consumer's viewer. Nothing else changes: a source
without one renders exactly as before, and a capture that fails to load falls back
to the headline it replaced.

The field is there because a citation preview titled `facebook.com/middesk`, above
a snippet reading `https://facebook.com/middesk`, says the same thing twice and
proves nothing. What a reviewer wants at that moment is the page — the Intro card
with `hello@middesk.com` highlighted is the evidence; the URL is only its address.
`title` is typed `string`, so there was no way to do this from the product side.

The viewer itself is NOT in core (`src/components/ScreenshotViewer.tsx`). Core's
HoverCard contract forbids it owning a dialog reachable only from a hover body, and
how a capture is shown at full size is the consuming screen's decision.

All three are marked in the files themselves. Adding a primitive means copying its
file, its transitive core imports, and adding a line to the barrel.

## The skills, cloned too

The dashboard's design skills are cloned into `.claude/skills/`, on the same
terms as the code.

- **Source:** `/Users/sara-menefee/Projects/app`, `.agents/skills/` (symlinked
  there as `.claude/skills/`), at commit `a7b2f9bc9`
- **Cloned:** 2026-09-21
- **Direction:** one way, as above.

| From `/app` | To | Modified? |
|---|---|---|
| `.agents/skills/design-system/` | `.claude/skills/design-system/` | `SKILL.md` only — one pointer line |
| `.agents/skills/design-polish/` | `.claude/skills/design-polish/` | One pointer line |
| `.agents/skills/design-ux/` | `.claude/skills/design-ux/` | One pointer line |
| `.agents/skills/component-patterns/` | `.claude/skills/component-patterns/` | One pointer line |

`building.md`, `pitfalls.md` and `reference.md` are byte-identical to the app's.
Each `SKILL.md` gained exactly one block, directly under its frontmatter,
pointing at `.claude/skills/design-system/prototype.md` — so re-syncing stays a
straight copy plus four one-line re-inserts.

`prototype.md` is the only local document, and the only one to write in. It
holds the six things those skills read differently here: core is read-only, there
is no workbench, Tailwind 3 with a `.cjs` config, no legacy stack to choose, the
result-state grammar below is deliberate, and the rule for porting a screen from
the app. Where it and a cloned skill disagree, it wins.

`CLAUDE.md` at the repo root points at all of it, so a session loads the bar
before it starts editing rather than after being asked to.

## Known inherited condition

`src/core/tokens/colors.ts` raises `TS2589: Type instantiation is excessively deep`.
**This is pre-existing in the app** — verified by running the same typecheck there.
Not caused by the clone, and not fixed here, because fixing it would mean modifying
a cloned file.

## The deliberate divergence: the result-state grammar

Everything visual comes from `@/core` except this, and the reasons are in
`decisions/001`, `002` and `003`.

**No badge is used for result state.** `@/core` renders status as a tone chip —
`MetaChip` with `neutral | info | success | warning | danger`, `EntityStateBadge`,
`OutcomeBadge`. A no result gets **no chip at all** here. Absence is rendered as
absence: lighter than a result, no surface fill, no border accent, no status tone.
Giving absence a chip gives it the visual apparatus of a finding, which is the exact
failure this concept exists to prevent. The shipping product renders "Not Provided by
State" as a yellow `warning`.

**`toOutcomeSentiment` is not used.** It maps `unverified` and `unsupported` to
`negative` (`decisions/002`). Results arrive typed here; nothing routes through a
string normaliser.

**`StateMark` is new.** Shape before colour — filled disc, half disc, dashed ring,
and an adverse triangle for `should_exist_not_found`. `@/core` distinguishes status
primarily by tone, and three states plus one promoted reason is more than five tones
can carry when only `neutral` is non-committal (`decisions/001`).

**The reason is a plain sentence.** "Delaware does not publish officers on its public
search", not a `not_published` chip. No `@/core` primitive attaches a reason to an
absence (`decisions/003`).

**No group headings.** The nine areas are navigational only (`00-MASTER-PLAN.md`
rule 3); using them as output structure gave them weight they should not carry. Rows
appear in the order the user added them.

## What the product system would need

If this moves in-tree, in order of size:

1. A result-state primitive taking `state` and `reason` as typed props, owning the
   whole grammar (`decisions/003` option A).
2. A non-colour axis for status, so absence is distinguishable from neutral without
   spending a tone.
3. An outcome normaliser that cannot map absence to negative — or none at the
   insight layer at all.
4. A list-level absence summary, distinct from `EmptyState`'s region level.
5. Captures held on the source record, taken at crawl time, with the crop the
   extractor actually read — `src/lib/sourceScreenshots.ts` is a fixture map keyed
   by page and attribute, standing in for that. Two open questions it does not
   answer: how a capture reaches touch, where there is no hover preview to hang it
   on, and what a stale capture should say when the page has since changed.

## Not yet built

Composition flow, the proposal journey, F3 and F4 traces.
