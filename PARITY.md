# Parity ledger

The prototype uses the **real `@/core`**, cloned from the Middesk dashboard.

- **Source:** `/Users/sara-menefee/Projects/app`, `src/core`, at commit `f1add6296`
- **Cloned:** 2026-09-11
- **Direction:** one way. Nothing here is written back, and `/app` is never modified.

This supersedes the earlier build-fresh approach. That version rebuilt every
component and invented its own tokens; it did not look like the product, which was
the point of the exercise. The components below are the app's own files.

## What was cloned

The whole of the app's `src/core`, untrimmed (177 files), with its public barrel
`src/core/index.ts` byte-identical to the app's at `f1add6296`. Also:

| From `/app` | To | Modified? |
|---|---|---|
| `src/utils/twUtils.ts` | `src/utils/twUtils.ts` | No — the tailwind-merge conflict groups |
| `tailwind.config.js` | `tailwind.config.cjs` | Renamed only (this package is `type: module`) |
| `tsconfig.json` compiler options | `tsconfig.json` | Mirrored, so the clone typechecks as it does at home |

Imports are `import { Surface, Text } from '@/core'`, exactly as in the app.

## Where the clone differs from `f1add6296`

Checked file by file on 2026-09-28. Four files differ:

- **`src/core/ChatSources.tsx` — local modifications, marked in the file.**
  - **(3)** `ChatSourceData` gained an optional `screenshot: { src, alt, onOpen? }`.
    When set, the hover preview renders the capture where the headline would go, and
    `onOpen` makes it the trigger for the consumer's viewer. A source without one
    renders exactly as before, and a capture that fails to load falls back to the
    headline it replaced. It is there because a preview titled `facebook.com/middesk`
    above a snippet reading `https://facebook.com/middesk` proves nothing; the page
    is the evidence. The viewer is NOT in core (`src/components/ScreenshotViewer.tsx`):
    core's HoverCard contract forbids it owning a dialog reachable only from a hover
    body.
  - **(4)** one shared identity for a whole list, and **(5)** which edge the list
    opens from.
  - **(6)** `ChatSourceData` gained an optional `badge: ReactNode`, rendered after
    the title in the list row and the preview headline. A source without one
    renders exactly as before. It carries a record's status as a `Tag`: a filing
    reading "California" with an Active chip beside it, rather than
    "California · Active" as text in the title.
- **`src/core/PayloadViewer.tsx`, `PayloadViewer.test.tsx` and
  `Dropdown.consumers.test.tsx`** differ with no local marker; they read as re-copied
  from a later app commit. Confirm against the app before a re-clone overwrites them.

(1) and (2) — the clone was pruned, and the barrel trimmed — are retired: the clone
is whole now. Adding a primitive means nothing; it is already there.

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

## Known Tailwind 3 / 4 selector difference

`DataTable` drops the last row's dividers with `last:[&>td]:border-b-0`. Tailwind 4
reads stacked variants outside-in (`tr:last-child > td`); Tailwind 3, which this
prototype runs, reads them the other way (`tr > td:last-child`), so every row lost
the divider under its final column. The core file is untouched; `src/theme.css`
restates the two selectors as the class meant them, under "Row dividers in the
data table". Re-cloning core does not disturb it. If the prototype ever moves to
Tailwind 4, delete that block.

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
