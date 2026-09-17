# `src/core` — dashboard product-system boundary

`src/core` is the dashboard app's shared product-system layer: semantic foundations, typed primitives, and behavior contracts that are stable enough for product routes to depend on through `@/core`.

This directory is not a component dumping ground. It is the narrow, durable API between dashboard product work and the underlying implementation details in styled-components, Tailwind, shadcn/Radix, third-party libraries, and legacy adapters.

## Contract hierarchy

Use this order when deciding where a change belongs:

1. **Foundations** — `theme.css`, `theme.ts`, and `tokens/` define semantic roles for color, spacing, density, radius, type, elevation, focus, and mode behavior.
2. **Core primitives** — `src/core/<Primitive>.tsx` exposes Middesk-owned product APIs imported from `@/core`.
3. **Core-internal substrate** — `src/core/internal/ui/*` may contain shadcn/Radix-generated implementation details. Product code must not import it directly.
4. **Feature composition** — `src/components/<Feature>/` and `src/containers/<Feature>/` compose core primitives with business logic, data fetching, routing, and product-specific copy.

If a route needs a capability that is missing from `@/core`, add or extend a core primitive instead of reaching into `src/core/internal`, duplicating token values, or promoting a feature component prematurely.

## What belongs in `src/core`

A file belongs here when it is a product-agnostic primitive with a stable contract:

- **Foundations:** `theme.css`, `theme.ts`, `tokens/`, and small utilities that keep primitives mode-blind.
- **Actions:** buttons, icon buttons, action links, and copy/export style controls.
- **Surfaces and text:** surface/card/section anatomy plus heading, body, label, helper, error, and code text roles.
- **Form primitives:** low-risk fields and controls without business logic; legacy form-library adapters can remain only while migration is explicit.
- **Status and feedback primitives:** badges, chips, counts, inline alerts, empty states, errors, loading regions, skeletons, and toasts with semantic APIs.
- **Complex primitives:** dialog/drawer, menu/select/popover, tooltip, tabs, table/list, and pagination only when keyboard, focus, ARIA, and route-adoption behavior is real or explicitly marked caveated.
- **Third-party wrappers:** generic display/interaction wrappers such as date/time, dropzone, tooltip, or dropdown when callers should depend on a Middesk API rather than vendor props.

Every product-facing primitive should be exported from `src/core/index.ts` and consumed as `import { Primitive } from '@/core'`.

## What does not belong in `src/core`

Keep these out unless they pass the promotion checklist below:

- Product-shaped components that know about businesses, registrations, orders, applications, agents, policies, jurisdictions, or customers.
- Containers that fetch data, read Redux/RTK Query state, mutate APIs, or depend on route state.
- One-off layouts built for a single route.
- Convenience aliases that re-export the same primitive with a feature-specific name.
- Raw shadcn/Radix files exposed directly to product code.
- Components whose behavior is aspirational rather than implemented.

Feature folders should wrap core primitives locally when they need product copy, business logic, analytics, permissions, or data loading.

## Promotion checklist

Before adding or promoting a primitive into `src/core`, verify all of the following or document the caveat in the workbench/readiness map:

- [ ] The API is product-agnostic: prop names and variants describe UI behavior, not a specific dashboard route or domain entity.
- [ ] The import path is product-facing: callers can use `@/core` without reaching into internal files.
- [ ] The primitive has TypeScript props and exports any reusable types from `src/core/index.ts`.
- [ ] Styling consumes semantic foundations from `src/core/theme.css`, `theme.ts`, or `tokens/`; no raw hex, ad hoc shadows, or unexplained pixel values in primitive anatomy.
- [ ] Interaction states are visible and named: hover, focus-visible, active/pressed, selected, disabled, invalid, loading, empty, and error where applicable.
- [ ] Accessibility ownership is in the primitive: native semantics first, then ARIA; icon-only controls are named; form labels/errors are wired; complex widgets own keyboard/focus behavior.
- [ ] Light and scoped dark mode are readable because the primitive is mode-blind and uses semantic variables.
- [ ] Behavior-focused tests exist for risky interactions, not only render smoke tests.
- [ ] The DesignSystemWorkbench shows realistic states and usage guidance close to the specimen or spec section.
- [ ] The readiness state is honest: `Ready for new use`, `Ready with caveats`, `Needs route validation`, `Specified, not built`, or `Blocked`.

A useful component that fails this checklist can still ship in a feature folder. It just is not core yet.

**And a real second consumer must already exist in the tree.** Promotion answers proven demand, not anticipated reuse — "looks reusable" or "we might need it elsewhere" is not enough. A primitive born LOCAL in one feature earns `@/core` when a *second* real consumer needs it. (Exception: a clearly *foundational* primitive — a `Button`/`Popover`-class element implemented from a spec — may go core on first use if it clears the full checklist. This rule guards *convenience extractions*, not known foundations.)

## Add or change a primitive (runbook)

The footguns here are registration, not design. The full sequence:

1. **Substrate (if shadcn/Radix-based):** `bunx shadcn add <x>` into `src/core/internal/ui/`, then wrap it in a Middesk-owned `src/core/<Primitive>.tsx` (see `src/core/internal/ui/README.md`). Product code never imports `internal/ui` directly.
2. **Tokenize** with `cva` + `--core-*` tokens — no raw hex/px (the token-consumption contract below).
3. **Register the export** in `src/core/index.ts` (the value export, plus any reusable `export type`). This is a public-API decision — stable name, no product coupling.
4. **A new semantic token touches three files** or tailwind-merge silently drops it: the value in `src/core/theme.css` (light **and** scoped-dark), the mapped utility in `tailwind.config.js`, and the conflict group in `src/utils/twUtils.ts`.
5. **A new workbench specimen touches three places:** the section in `src/containers/DesignSystemWorkbench/sections/PrimitiveSections.tsx`, its entry in `src/containers/DesignSystemWorkbench/config.ts` (`SECTIONS`), and the wiring in `src/containers/DesignSystemWorkbench/index.tsx`.
6. **Readiness:** note the primitive's readiness state on the workbench (`Ready for new use` / `Ready with caveats` / …) so adopters know whether it's safe to use.
7. **Tests:** behavior for risky interactions, and *appearance* where that's the contract (a render-and-assert test — e.g. asserting a table still renders its row dividers — is what catches a silent visual regression).

## Readiness states

Use the same state language in PRs, workbench copy, Linear updates, and review packets:

| State | Meaning | Allowed use |
| --- | --- | --- |
| `Ready for new use` | Built in `src/core`, exported from `@/core`, visible in workbench, behavior/a11y/mode basics checked. | Safe for new non-critical route work with normal review. |
| `Ready with caveats` | Useful and mostly proven, but has migration, legacy, visual, or test caveats. | Use deliberately; note caveats in the PR. |
| `Needs route validation` | Contract is credible, but production route adoption has not proven density, data states, or edge cases. | Prototype or pilot only; do not mass migrate. |
| `Specified, not built` | Desired contract and acceptance criteria are documented, but behavior is not implemented. | Do not import as production-ready. |
| `Blocked` | Dependency, direction, accessibility, or migration risk prevents responsible adoption. | Resolve blocker before implementation. |

Do not mark complex primitives ready because the file exists. Dialogs, drawers, menus, selects, tables, tabs, tooltips, and pagination need real keyboard/focus/ARIA behavior and route validation before broad adoption.

Track these states per primitive on the workbench (`/internal/design-system`) — it's the **"is X safe to adopt here?"** surface. It's a review/adoption aid, not machine-enforced.

## Foundation and mode rules

- CSS variables in `src/core/theme.css` are the runtime source of truth for mode-sensitive values.
- TypeScript token maps in `src/core/tokens/` are references for JS/styled-components/workbench consumption, not a competing source.
- Tailwind utilities are consumption syntax and layout glue; arbitrary values inside primitives should point at semantic variables.
- **Token consumption contract** (enforced by `src/core/foundations.contract.test.ts`): color tokens may use mapped utilities (`text-foreground`, `border-border`, `bg-popover`) or arbitrary `*-[var(--core-color-*)]`. Non-color tokens — type, elevation, radius — must use the mapped utilities in `tailwind.config.js` (`text-body`, `text-caption`, `shadow-elevation-*`, `rounded-control`, `rounded-popover`, …). Never pass a non-color token through a bare ambiguous arbitrary value like `text-[var()]` or `shadow-[var()]`: Tailwind parses it as a *color* and silently drops the declaration. New semantic utility keys must also be registered in `src/utils/twUtils.ts` so tailwind-merge resolves their conflict groups correctly.
- `.core-theme` scopes the current proof. The workbench may show light and scoped dark examples, but this is not a full-app dark-mode rollout.
- Product routes should not migrate broadly until the primitive family and route slice have explicit adoption tickets.
- **Changing a shared primitive is an API change — even mid-migration.** A one-line edit to serve one page ripples to every consumer. The canonical example: flipping `DataTable`'s `<table>` to `border-separate` for a sticky header silently erased row dividers app-wide, because CSS `border-separate` makes the browser ignore `<tr>` borders (full case + fix in `../../.claude/skills/design-system/pitfalls.md` §2). If a fix would ripple, scope it (a new optional prop / a net-new `core-` class) or **STOP** and surface it. When you must change a shared primitive, you own every consumer: verify the workbench specimen in both themes and add a test for the behavior you changed, before merge.
- **Legacy adapters may carry non-token values mid-migration.** Some older `src/core` files (styled-components adapters) still use `rgba()` / raw values; tokenize what you *touch*, but you needn't convert a whole legacy file to land a small scoped fix.

## Workbench requirement

The DesignSystemWorkbench is the review surface for core. New or changed primitive contracts should leave evidence there:

- states that expose real dashboard density, truncation, disabled/loading/error/empty behavior, and mode behavior;
- concise usage notes near the example;
- caveats for what is not ready;
- static/mock data only, never customer data;
- no production route migration hidden inside the workbench PR.

Use `src/containers/DesignSystemWorkbench/sections/PrimitiveSections.tsx` for current primitive-family evidence and `sections/SystemSections.tsx` for readiness/foundation evidence.

## Demotion and deprecation

A component already in `src/core` can be demoted or deprecated if it turns out to be feature-coupled, has a single durable consumer, lacks a maintainable accessibility contract, or is superseded by a stronger primitive. Treat demotion as normal maintenance:

1. create a focused PR;
2. update imports or provide a compatibility wrapper;
3. remove or mark the `@/core` export;
4. update the workbench/readiness map;
5. explain the migration boundary in the PR.

Demotion is healthier than keeping a misleading primitive in the shared layer.

## See also

- **`../../.claude/skills/design-system/building.md`** — how to *build* product UI with `@/core`: the quality bar (the 5 C's) and paste-ready page recipes (list, detail-via-drawer, form-in-dialog, auto-save settings).
- **`../../.claude/skills/design-system/pitfalls.md`** — the production traps the workbench can't show you (the greenhouse problem, the divider case, CSS/Tailwind gotchas, portals, mocks).
- **The `design-system` skill** (`.claude/skills/design-system/`) — the action-gated front door + router + the pre-merge Check checklist; this README is its canonical contract.
- **Checks & review.** These rules are upheld in code review and on the workbench — the design system is intentionally **not hard-CI-gated yet** (we may add gates once it stabilizes). One narrow token-consumption check predates this system and stays.
- **`../../.claude/skills/design-system/reference.md`** — *Look up*: the tokens you actually reach for (status, text tones, surfaces, borders) + a primitives-at-a-glance prop table.
