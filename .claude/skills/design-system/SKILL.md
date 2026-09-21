---
name: design-system
description: The Middesk @/core design system — how to BUILD product UI with it at a high bar, and the governance for CHANGING it. Use when building or styling any dashboard UI, and READ FIRST before adding/moving anything into src/core, adding/renaming/removing a src/core/index.ts export, editing a shared @/core primitive/token/foundation, or when asked to "make something reusable", "move it to the design system", or "extract a shared X". @/core = Radix + shadcn-style primitives + Lucide + --core-* tokens (light/scoped-dark), workbench at /internal/design-system. The deep contract is src/core/README.md; this skill is its action-gated front door.
---

> **Prototype note.** This is the app's skill, cloned verbatim into the prototype. Read `prototype.md` (beside this file) FIRST — `src/core` here is a read-only clone, so the CHANGING-the-system half of this skill does not apply, there is no workbench, and the result-state grammar is a deliberate divergence. It also carries the rule for porting a screen from `app`.

# Middesk design system (`@/core`)

`@/core` (`src/core`) is the dashboard's design system: product-agnostic primitives and layout contracts, stable enough for product routes to depend on via `import { X } from '@/core'`. Built on Radix + shadcn-style primitives + Lucide icons + `--core-*` CSS tokens (light + scoped dark), with a live workbench at `/internal/design-system`.

**Default:** compose from `@/core` to build product UI — always safe, always encouraged. New things you build go **LOCAL** (`src/components/<Feature>/` or `src/containers/<Feature>/`) by default. Adding to or changing `@/core` is a **gated exception** — read on.

> The canonical contract — full promotion checklist, readiness states, token-consumption contract, demotion path — is **`src/core/README.md`**. This skill is the front door an agent reads *at the decision moment*; it points at the contract, it does not replace it. When they disagree, the README wins.

## Start here — which doc?

This skill is the hub. Route to the right place by what you're doing:

| You're… | Read | |
|---|---|---|
| building a page / styling product UI | **`building.md`** — the 5 C's + paste-ready recipes | *Build* |
| looking up a token or a prop signature | **`reference.md`** — tokens + primitives at a glance | *Look up* |
| hitting a bug that only shows up in production | **`pitfalls.md`** — the traps, with fixes | *Avoid* |
| adding to / changing `@/core` itself | **`src/core/README.md`** (the contract) + this skill | *Change* |
| about to merge a migration PR | the **Check** checklist near the end of this skill | *Check* |

Sibling skills: **design-polish** for pixel-matching a Figma (but tokens, never raw hex) · **design-prototype** for throwaway speed (graduate back through here before it ships) · **operator-sidepanel** for Operator agent-card UI · **component-patterns** for React mechanics. The last two still describe the *legacy* stack — for new work, `@/core` wins.

## How to hold this — a floor, not a cage

Most UI work is **using** the system: composing primitives into LOCAL feature components. That space is yours — build boldly, try layouts, prototype, push the design past the recipes. The recipes in `building.md` are a *starting floor*, not the only sanctioned shapes; the quality bar is a *floor for quality*, not a ceiling on ambition. If you're just building a page, go straight to `building.md` and compose freely — you don't need the governance below.

The guardrails further down (the gates, the STOPs, the checklists) protect exactly one thing: the **shared surface** every other feature depends on. They exist so you can move fast in the LOCAL space *without* breaking someone else's screen. When a rule reads as absolute, it's guarding that shared edge — everywhere else, use judgment and explore.

## The one distinction: USING vs CHANGING the system

Classify every UI task by **blast radius** before you touch a file:

| | USING the system — ungated, go | CHANGING the system — gated, clear the bar |
|---|---|---|
| **What** | Import from `@/core`; compose primitives; pass documented props; build LOCAL feature components that wrap `@/core`. | Edit a shared primitive, token, or foundation (`theme.css`, `tokens/`, `tailwind.config.js`, `twUtils.ts`); add / rename / remove a `src/core/index.ts` export; add a new primitive. |
| **Blast radius** | One feature. | Any other consumer of `@/core`. |
| **Posture** | Build freely, to the quality bar below. | Stop — it's an API change. Meet the promotion bar + the anti-drift rules. |

If your change can only affect one feature, you're **using** the system. If it can alter any other consumer, you're **changing** it — stop and clear the gate.

> **The migration trap — read this before editing any `src/core` file.** Editing a primitive other features import is **CHANGING the system, even mid-migration when it feels like "just finishing the page."** Drift ships exactly here: a one-line change to make *one* page work — e.g. flipping `DataTable`'s `<table>` to `border-separate` for a sticky header — quietly broke row dividers on *every* DataTable, because CSS `border-separate` makes the browser ignore `<tr>` borders. If you touch a shared primitive you own **every** consumer: verify the workbench specimen in both themes, and add a test for the behavior you changed, **before you merge**. If the "more correct" fix would ripple app-wide, scope it (a new prop / a net-new `core-` class) or **STOP** and surface it — never ship the ripple inside a feature PR. (Full case + the CSS mechanism: `pitfalls.md`.)

## Build WITH it — the quality bar

Compose from `@/core`; don't reinvent primitives. What you ship (local *or* core) should clear this bar — and it's also the gate for anything entering `@/core`:

- **Tokens only.** Every color / space / radius / shadow / type value is a semantic `--core-*` token (a Tailwind mapped utility, or `*-[var(--core-color-*)]` for colors). No raw hex, ad-hoc px, bespoke shadows, or one-off durations. This is what makes light/dark parity fall out for free.
- **Every state + content resilience.** default, hover, focus-visible, active, selected, disabled, invalid, loading, empty — and content that is empty / minimal / overflow-long / wrapped. Happy-path-only is the most common gap.
- **Accessibility, owned in the component.** Native semantics first, then ARIA (Radix gives you most of it); fully keyboard-operable; visible focus ring; labels/errors wired; contrast ≥ 4.5:1 text, ≥ 3:1 UI.
- **Light + scoped-dark both readable**, because the component is mode-blind (tokens, not literals). Motion uses `--core-duration` / `--core-ease` and honors `prefers-reduced-motion`.
- **Responsive** across the app breakpoints (mobile 360 → desktop 1280).
- **The feel** (self-audit — this is what "high design bar" decomposes into): hierarchy carried by *multiple* reinforcing signals (size + weight + color + space), with secondary content actually de-emphasized; spacing and type only from the scale; restraint — default to ≤ 2–3 colors (more is fine when each one *carries meaning*, e.g. semantic status), no *invented* values, no decorative noise for its own sake. These are strong defaults, not a straitjacket — a data-dense or intentionally expressive surface can break them on purpose. If you're cutting corners rather than making a call, it's not done.

## Change it — does this earn `@/core`? (decision tree → one verdict)

1. **Foundational primitive** — `Button`, `Menu`, `Popover`, `Tabs`, `DataTable`, `Kbd`, `Highlight` → **CORE**.
2. **Cross-page layout contract** — `AppShell`, `PageHeader`, `PageHeaderBand`, `Toolbar`, `MetricCard`, `PageContainer` → **CORE**, with a workbench specimen, tests where behavior exists, and tokenized styling.
3. **Composed product pattern** — the Businesses toolbar, "settings header with team count", command-palette sections, route-aware nav groups → **LOCAL**.
4. **Glue around data fetching / routing / permissions / product nouns** → **LOCAL**.
5. **Styling convenience for ONE consumer** → **LOCAL** until a *second real consumer* pulls it up.
6. **Renames / removes / changes the signature of an existing export or shared foundation** → **STOP** (breaking — see Anti-drift).

A leaf earns **CORE** only if it passes the full promotion checklist in `src/core/README.md` (product-agnostic API, tokenized, all states, a11y owned, light/dark, behavior tests, **workbench specimen**, honest readiness state) **and a real second consumer already exists in the tree.** "Looks reusable" / "we might need it elsewhere" is not enough — **proven demand, not anticipated reuse.** (Exception: a clearly *foundational* primitive from row 1 — a `Button`/`Popover`-class element you're implementing from a spec — may go core on first use if it clears the full checklist. The second-consumer rule guards *convenience extractions*, not known foundations.)

## Keep it stable — anti-drift rules

The system grows by **addition, not mutation.** These are hard rules:

- **`src/core/index.ts` is a public API, not a convenience barrel.** Every export is a contract — the surface is enumerated in `index.ts` itself (don't hardcode a count in prose; it rots). Adding one is an API decision — intentional, stable name, no product coupling. **Renaming or removing one is breaking for every consumer → STOP**; deprecate instead.
- **Additive by default.** A new *optional* prop, or a *new* variant alongside the existing ones, is safe. Changing an existing variant's look/default, a default prop value, a prop/export name, or retuning/removing a token is **breaking** → deprecate, never silently change.
- **Never modify a shared foundation to fix one consumer** — e.g. `inputVariants`, `.core-input`, a shared `--core-*` token. Scope the fix to the specific primitive, or add a **net-new scoped class/token** (e.g. `.core-input-trigger`). If the "more correct" fix would ripple app-wide, surface it as an option and **STOP** — don't ship the ripple.
- **Deprecate → migrate → remove, never silent.** Keep the old path working, mark `@deprecated` with a pointer to the replacement, ship the new path in parallel, leave a migration note, update the workbench/readiness map, and remove only after consumers migrate. Demotion (core → feature folder) is normal, healthy maintenance (README has the steps).
- **Conventions, upheld in review — not (yet) hard-gated.** These rules are held in **code review** and on the **workbench** (`/internal/design-system`), not by CI. The design system is intentionally not hard-CI-gated yet — we may add gates once it stabilizes; for now, hold the bar yourself. (One narrow token-consumption check predates this system.) Treat a diff touching `src/core/index.ts` or a shared token with the scrutiny of an API change.
- **Verify, don't assume.** Measure computed style in the preview before declaring a primitive change safe — size-token *names* can mislead, and an arbitrary `text-[length:var()]` can make tailwind-merge drop a sibling `leading-*`.

## If unsure → build LOCAL

If you can't check every promotion box, or you're not sure the semantics are genuinely reusable: **build it local and let a second real consumer pull it up.** Uncertainty always resolves to the reversible action — never to a new export or a shared-foundation edit.

## Conventions

- **Selectors / ids / scoped class names are shared surface too.** Name them intentionally and namespaced: `core-` / `--core-*` for design-system scope. For product/command ids use a clear, unique prefix — **`bus-` for business** (not `biz-`). Renaming a shared scoped class (`.core-theme`, `.core-input`) is breaking → STOP.
- **Tokens are semantic-role names** (`--core-color-control-border`), never value-encoded. A new semantic token key must be registered in **both** `tailwind.config.js` (the mapped utility) **and** `src/utils/twUtils.ts` (tailwind-merge class groups) — skip `twUtils` and tailwind-merge misclassifies it and silently drops it.
- **Don't import `src/core/internal/ui/*` from product code** — that's the shadcn/Radix substrate; depend on the Middesk primitive re-exported from `@/core`.
- **Vocabulary** (use consistently): *primitive* = a `@/core` building block; *export* = the `index.ts` surface; *promote/earn* = LOCAL → core; *demote* = core → feature.

## Check — before you merge a migration PR

A migration changes the look, not the contract. Before merge:

- [ ] **Touched a file under `src/core` that other features import?** Then this PR *changes the system* — re-read the migration-trap gate above. Verify the primitive's workbench specimen in **both** themes, confirm every other consumer still looks right, and add/extend a **test** for the behavior you changed. (This is the gap that shipped the divider regression — `pitfalls.md` §2.)
- [ ] **Added a `src/core/index.ts` export?** It has a workbench specimen and an honest readiness state noted there.
- [ ] **Tokens only** — no raw hex / ad-hoc px / bespoke shadow in what you shipped (the 5 C's in `building.md`).
- [ ] **Every state** — loading (skeleton, not an empty-flash), empty, error, hover / focus-visible / disabled — and light + scoped-dark both readable.
- [ ] **Hard contracts preserved** — `cya()` hooks, modal keys, tracking events, exact request shapes (`pitfalls.md` §7).
- [ ] **Reused the recipe**, modern names not legacy twins, no re-wrapped `.core-theme`.

## Pointers — the deep sources (don't duplicate them here)

- **`src/core/README.md`** — canonical contract: contract hierarchy, full promotion checklist, readiness-state vocabulary, token-consumption contract, demotion path, the add/change-a-primitive runbook.
- **`building.md`** — *Build*: the 5 C's quality bar + paste-ready page recipes (list, detail-via-drawer, form-in-dialog, auto-save settings).
- **`reference.md`** — *Look up*: status-chip APIs, the tokens you reach for (with mapped utilities), and a primitives-at-a-glance prop table.
- **`pitfalls.md`** — *Avoid*: the production traps the workbench can't show you (the greenhouse problem, the divider case, CSS/Tailwind gotchas, portals, mocks).
- **Checks.** The design system is upheld in review + on the workbench, not by hard CI gates (yet). One narrow token-consumption check predates this system.
- **`src/core/theme.css`** — the `--core-*` token values (color / action / font / radius / spacing / shadow / duration / ease); runtime source of truth for light + scoped dark.
- **`/internal/design-system`** (DesignSystemWorkbench) — every primitive's specimen, and the review/drift surface where manual a11y + content-resilience checking happens.
- **Legacy:** the `theme.ts` palette (midnight / karl / frost / dawn) consumed via styled-components for pre-`@/core` code. New work is `@/core`. (There is no `@middesk/components` package in this repo — the legacy surface is `theme.ts` + styled-components.)
