# `@/core` — pitfalls (what bites you in production)

The workbench is a greenhouse. Production is the weather.

These are the bugs you **cannot** find by reading source or eyeballing `/internal/design-system` — they only show up on a real route, in a production build, with real data and real overlays. Every entry here was paid for once already in a migration. Read this before you migrate a page or change a primitive.

> If you only remember one thing: **editing a file under `src/core` that other features import is changing the system — even mid-migration.** You own every consumer. Verify the workbench specimen in both themes and add a test *before* you merge. The rest of this file is why.

---

## 1. The greenhouse problem (the meta-trap)

The workbench silently guarantees four things production does **not**. Most `@/core` bugs live in the gap:

| The workbench always has… | …production often doesn't | What breaks |
|---|---|---|
| a `.core-theme` scope present | legacy routes / portaled content outside it | components render **unstyled** (§4) |
| referentially-stable `data` | inline `data`/`columns` rebuilt each render | **prod-only infinite render loop** (§5) |
| a dev build | a minified prod build | bugs invisible in dev/jsdom; show as Chrome's "Page Unresponsive", not a React throw |
| no React StrictMode surprises | double-invoke / effect timing | state churn that only bites on a hard load |

The takeaway: **dev-looks-fine is not proof.** Reproduce primitive changes with a real `vite build` + preview and a hard page load, not just the workbench.

---

## 2. Flagship case — a shared-primitive change that rippled

**The rule.** A change to a shared primitive is an API change. When you make one you own its effect on *every* consumer — and you prove it in the workbench (both themes) + a test, before merge, not after a bug report. This is the skill's *"never modify a shared foundation to fix one consumer"* made concrete.

**The mechanism that bit us.** A migration needed a sticky table header, which requires `border-separate border-spacing-0` on `<table>` (sticky + `border-collapse` renders wrong). That one-line change to the shared `DataTable` silently erased row dividers on every DataTable in the app — because **CSS `border-separate` makes the browser ignore borders on `<tr>`; only `<td>`/`<th>` borders paint.** The divider lived on `<tr>`, so it vanished everywhere. Nothing threw; it just looked subtly wrong, app-wide, until someone noticed.

**The fix.** Move the divider onto the cells: `border-b border-[var(--core-color-table-divider)]` on each `<td>`, plus `last:[&>td]:border-b-0` on `<tr>` to drop the last row's line.

*Provenance: introduced in #5781, fixed in #5795 — there if you want the diff, not required reading. The durable knowledge is the three paragraphs above; you never need to open the PRs to apply it.*

---

## 3. CSS & Tailwind traps

- **Never animate layout-triggering properties — this is the one that undoes all the speed work.** Animating `width` / `height` / `margin` / `padding` / `top`/`left`/`right`/`inset` / `grid-template-rows`/`-columns` forces the browser to **reflow every frame** for the whole duration — the jank a "fast" feeling dies on. Animate **`transform` and `opacity` only** (GPU-composited, no reflow): to move a panel use `translate`; to reveal, `opacity` + a small `translateY`. To collapse a width/height, animate a `transform: scaleX`/`translateX` on a fixed-size element, or accept an instant snap. Never use `transition: all` — it animates whatever happens to change, including layout props; name the properties (`transition-[transform,opacity]`). *The one tolerated exception:* a deliberate, user-initiated **expand/collapse** where a size change is intrinsic (a sidebar rail, an accordion) — keep it short and reduced-motion-guarded (the AppShell rail and the deprecated `LegacyDrawer` are the known cases). It is **not** a license to animate layout on hover, scroll, or feedback.
- **Short, asymmetric durations — 200ms+ *feels* slow.** Interaction feedback (hover, press, toggle, small reveals) should be `--core-duration-fast` (120ms) and **appear ~instantly**; exits should be **~150ms**. `standard` (200ms) is for overlay entrances and is already at the slow edge; `slow`/`slower` (320/500ms) are almost never right for anything interactive. Entrances and exits should be *asymmetric*, not one symmetric duration. (See the duration table in `reference.md`.)
- **`border-separate` ignores `<tr>` borders.** Sticky headers need `border-separate border-spacing-0` (sticky + `border-collapse` renders wrong). The cost is that row/column borders must live on `<td>`/`<th>`, never `<tr>`. (See §2.)
- **Ambiguous `text-[var()]` / `shadow-[var()]` are parsed as colors and silently dropped.** Tailwind reads a bare arbitrary `var()` in `text-`/`shadow-` as a *color*; a non-color token (type, elevation, radius) just vanishes. Use the mapped utility (`text-body`, `text-caption`, `shadow-elevation-*`, `rounded-control`) or, for a font size, the explicit `text-[length:var(--core-font-size-xs)]`.
- **`text-xs` / `text-sm` are Tailwind defaults, not the semantic type scale.** They're fine for incidental sizing — the `DataTable` itself uses `text-sm` — but don't reach for `text-xs` *expecting* the 10px design token. The mapped `text-caption` (12px) and `text-body` are the type scale; for the 10px caption specifically, use `text-[length:var(--core-font-size-xs)]`.
- **An arbitrary `text-[…]` can make tailwind-merge drop a sibling `leading-*`.** If you pin a font size with an arbitrary value, also pin `lineHeight` via inline style — tailwind-merge can classify them into the same group and drop one.
- **The unlayered `button { padding: 0; color: inherit }` reset eats utilities on a bare `<button>`.** A plain `<button>` styled with Tailwind padding/color loses them to the global reset. Fix with a **net-new scoped class** (e.g. `.core-input-trigger`), not `!important` — and never by editing the shared reset.
- **`compact` control heights are not uniform.** `ActionButton` compact is 32px, `Input` compact renders ~34px, `SegmentedControl` `sm` ~40px. Token *names* mislead — **measure the rendered height** in the preview before aligning a toolbar.

---

## 4. Overlays, portals & theme scope

- **Portaled content doesn't inherit the theme scope.** `Menu`, `Hint`, `Tooltip`, and any Radix portal render *outside* the `.core-theme` subtree, so they come out unstyled. Pass an explicit `themeMode` prop (see `AppSidebar`, `UsersContainer`). Primitives that may render scope-less (`Dialog`, `Drawer`, `Pagination`) self-scope via `useCoreThemeFallback`.
- **Don't re-wrap routes in `.core-theme`.** The app-wide light boundary already lives in `router.tsx` Root (variables only, deliberately no `bg-background`/`text-foreground` so it can't cascade onto legacy pages). Adding per-page wrappers is redundant and risks double-scoping.
- **z-index: overlays sit at 1100; anything that can appear *over* an overlay needs ≥ 1200.** `Dialog`/`Drawer` sit at z-1100; `Popover` and `Hint` at z-1200 so a `Combobox` or tooltip *inside* a Dialog/Drawer isn't occluded.

---

## 5. Data & DataTable resilience

- **Pass `data` undefined-until-loaded.** `data={query ? rows : undefined}` → the table shows a skeleton. `data={[]}` → it shows the empty state. Passing `[]` while loading flashes an empty state, then pops in.
- **Memoize `columns`, `getRowId`, and `rowIntent`.** An unstable inline reference triggers TanStack's `autoReset*`, which in a **prod build** becomes an infinite render loop (invisible in dev/jsdom; it manifests as Chrome's "Page Unresponsive"). The primitive now self-protects (`autoResetPageIndex/Expanded: false` + internal memo), but consumers still memoize.
- **Index-suffix `getRowId`.** Use `` `${row.id}:${i}` `` — mocks (and some endpoints) return duplicate/missing ids, and duplicate row keys corrupt selection/sort.
- **Sort the full filtered set *before* slicing the page.** Most list endpoints have no server-side query, so pages fetch-all then filter/sort/slice client-side; sorting after slicing only sorts the visible page. (And note the scale ceiling — see §6.)

---

## 6. Mocks hide production reality

Silkscreen/MSW mocks accept inputs the real API rejects, so these only surface on staging:

- **Gravatar always "has" an image.** A non-empty `image_url` is **not** proof of a real photo — Gravatar returns a default. Request `d=404` so a missing avatar actually 404s and you can fall back to initials.
- **`per_page` limits & deep-page caps are real.** `/v1/users` 422s on `per_page=200` and caps deep paging (~900 rows), so client-side fetch-all is fragile past ~1k rows. Exercise multi-page and error paths with a paginating/failing mock; the durable fix is a server-side query (a backend ask, not a client workaround).

---

## 7. Preserve the hard contracts through a redesign

A migration changes the look, not the wiring. Re-attach, verbatim:

- **e2e `cya()` hooks** — `{...cya('…')}`. These were silently dropped in the chrome rebuild and broke e2e; carry every one over.
- **Modal-open keys** (`add-user-x`, `update-user`, `ADD_WEBHOOK_MODAL_KEY`), **Segment tracking events**, and **exact request/query-string shapes** (e.g. repeated `event_types[]=`; coerce empty → `undefined` so `skipNulls` doesn't append stray params).

---

## The one habit that prevents most of this

Before you merge a PR that edits any file under `src/core`:

1. **Did you change a shared primitive?** If yes, this is *changing the system* — re-read the gate in the `design-system` skill and the anti-drift rules in [README.md](../../../src/core/README.md).
2. **Open the workbench specimen for it** at `/internal/design-system`, in **both** light and scoped-dark.
3. **Add (or update) a test** for the behavior you touched — including its *appearance* where that's the contract (the divider regression in §2 is exactly what a render-and-assert test catches).

See also: [building.md](./building.md) (how to build a page well) · [README.md](../../../src/core/README.md) (the contract).
