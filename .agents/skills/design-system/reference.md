# `@/core` — reference (look up a token or a prop)

The curated hot-path: the tokens you actually reach for and the props you actually pass. Full token values live in [theme.css](../../../src/core/theme.css); the full prop types live in each primitive's source and in [index.ts](../../../src/core/index.ts). This file is the fast lookup so you don't have to dive for the common cases. For *how* to assemble a page, see [building.md](./building.md).

---

## Status chips — use the prop, never a raw token

The most common styling question. **You never pick a status color token by hand — you pass a semantic prop and the primitive maps the color** (light + dark for free).

- **Entity lifecycle** (active / inactive / closed / processing…) → **`EntityStateBadge`**:
  ```tsx
  <EntityStateBadge state='active' />   // green, picked by state — no token touched
  ```
  `state: EntityState = 'active' | 'inactive' | 'open' | 'closed' | 'processing' | 'unknown' | 'indeterminate' | 'not_found'` (active/closed→green, inactive/open→amber, processing→blue, rest→neutral). There is **no `revoked` state**.
- **Arbitrary status label** (e.g. "Revoked", "Beta") → **`MetaChip`** with a tone:
  ```tsx
  <MetaChip tone='danger'>Revoked</MetaChip>   // tone='success' is green
  ```
  `tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger'` · `size: 'xs' | 'compact' | 'standard'` (default `standard`; use `xs` next to an `EntityStateBadge`).
- **Removable / actionable** pill → **`Tag`** (`onRemove`, `tone`). Keep *static* status on `EntityStateBadge`/`MetaChip`.
- **Typed domain badges** (color/label mapped from a domain enum): `WorkflowStatusBadge` (status), `OutcomeBadge`/`VerificationOutcomeBadge` (sentiment), `RiskSeverityBadge` (severity), `ConfidenceBadge` (level), `EvidenceBadge` (quality). Pair loose API strings with the `to*` normalizers (`toWorkflowStatus`, `toRiskSeverity`, …).

> Rule: reach for a **semantic prop** (`state` / `tone` / `severity`). Hand-picking `--core-color-status-*` tokens is the wrong path — it's what the chip already does for you.

## Text — tone & size

`<Text tone size>` (always renders a `<p>`). `tone: 'primary' | 'secondary' | 'muted' | 'danger' | 'success'` (default `primary`) · `size: 'xs' | 'sm' | 'md' | 'lg'` (default `md`). `tone='secondary'` is the de-emphasis primitive; `<MutedText>` = `size='sm' tone='muted'`. Siblings in the same module: `Heading` (`level 1–4`), `CodeText`, `ErrorText`, `HelperText`, `LabelText`.

## Color tokens you reach for

Color tokens may use a mapped utility *or* the arbitrary `*-[var(--core-color-*)]` form. Non-color tokens (type/elevation/radius) **must** use a mapped utility (see the token-consumption contract in [README.md](../../../src/core/README.md)).

| Role | Token | Utility |
|---|---|---|
| primary text | `--core-color-text-primary` | `text-foreground` |
| secondary text | `--core-color-text-secondary` | `text-text-secondary` |
| muted text | `--core-color-text-muted` | `text-muted-foreground` |
| disabled text | `--core-color-text-disabled` | `text-text-disabled` |
| link text | `--core-color-text-link` | `text-text-link` |
| page / canvas bg | `--core-color-surface-canvas` | `bg-background` |
| card surface | `--core-color-surface-card` | `bg-card` |
| raised surface | `--core-color-surface-raised` | `bg-surface-raised` |
| subtle / sunken surface | `--core-color-surface-subtle` | `bg-muted` |
| inset surface | `--core-color-surface-inset` | `bg-surface-inset` |
| popover surface | `--core-color-surface-popover` | `bg-popover` |
| default border | `--core-color-border-default` | `border-border` |
| divider | `--core-color-border-divider` | `border-[var(--core-color-border-divider)]` |
| control / input border | `--core-color-control-border` | `border-input` |
| focus ring | `--core-color-focus-ring` | `ring-ring` (with `focus-visible:ring-2`) |

For **status colors** (success/danger/warning/info/neutral, fg + bg) the tokens exist (`--core-color-status-*-{fg,bg}`) but you should rarely touch them — use the chip's `tone` prop above. Same for `Text tone='danger'|'success'`, which map `--core-color-text-{danger,success}` for you.

## Motion — durations & what's safe to animate

| Token | Value | Reach for it when |
|---|---|---|
| `--core-duration-fast` · `duration-fast` | 120ms | **interaction feedback** — hover, press, toggle, small reveals (the default) |
| `--core-duration-standard` · `duration-standard` | 200ms | overlay *entrances*; already at the "feels slow" edge — keep exits at least as fast |
| `--core-duration-slow` / `slower` | 320 / 500ms | large/page-scale motion only; rarely right for anything interactive |

Easing: `--core-ease-standard` (most things), `--core-ease-emphasized` (entrances with a little spring). Entrances appear quickly and **exits should be no slower than entrances** — use `duration-fast`/`standard`, not a one-off value. (The current `Dialog` (220ms) and `Drawer` (500ms) predate this and are the *tightening target* — don't copy their durations.)

**Animate `transform` and `opacity` only** (GPU-composited, no reflow). **Never** animate `width` / `height` / `margin` / `padding` / `top`/`left`/`right`/`inset` / `grid-template-*` — they reflow every frame (pitfalls §3). Don't use `transition: all`. `prefers-reduced-motion` is handled globally under `.core-theme` — you don't re-implement it.

## Primitives at a glance

Key props only — the ones you pass. (Readiness per primitive lives on the workbench at `/internal/design-system`.)

| Primitive | Key props |
|---|---|
| **DataTable** | `columns`, `data` (`undefined`→skeleton, `[]`→empty), `loading`, `sort`+`onSortChange` (`DataTableSortState`), `pagination={{page,perPage,total}}`+`onPageChange`, `density='compact'`, `getRowId`, `rowIntent`, `empty`, `error`. Memoize `columns`/`getRowId`/`rowIntent`. |
| **Dialog** | `title`, `isOpen` (**defaults `true`** — pass `false`!), `onClose` (Escape/backdrop), `footer`, `size 'sm'|'md'|'lg'`. Self-scopes theme. |
| **Drawer** | `isOpen`, `onClose`, `title`, `footer`, `side 'right'|'left'`, `size 'sm'…'full'`, `width` (overrides size), `modal` (**default true**; `false`=non-modal panel). Always render it (don't null on close). Self-scopes theme. `presentation='docked'` = in-flow inspector rail (no overlay machinery; omit `title` for a chromeless rail named by `aria-label`; mounts settled, slides open/closed by width-collapse); `resizable={{minWidth,maxWidth,defaultWidth,onResizeEnd}}` adds the window-splitter grab handle (commit-time callback — persist + refit there, never per-frame). |
| **Field** | wraps a control; `isInvalid`. With `FieldLabel htmlFor` · `FieldError` · `FieldDescription`. |
| **FormField** | RHF Controller bridge: `control`, `name`, `render={({field,fieldState})=>…}`. |
| **Combobox** | `value: string[]`, `onChange: (string[])=>void`, `options: ComboboxOption[]`, `multiple` (false→single, read `value[0]`), `isInvalid`. |
| **TokenInput** | `value: string[]`, `onChange`, `onBlur`, `isInvalid`, `placeholder`. |
| **SearchInput** | `value`, `onChange: (string)=>void` (raw string, **not** an event), `onClear`, `onSearch?` (Enter, trimmed), `size` (compact=32px). Width via `className` on the wrapper. |
| **SegmentedControl** | `value`, `onValueChange: (string)=>void`, `size 'sm'|'md'`. Non-deselectable. Children: `SegmentedControlItem value icon?` (inherits size — don't set it per item). |
| **FacetFilter** | `label`, `options: FacetFilterOption[]` (`{label,value}`), `value: string[]`, `onChange`, `align 'start'|'end'`, `size`, `themeMode?`. Multi-select; returns `null` if `options` empty. |
| **Toggle** | Radix Switch: `checked`, `onCheckedChange`, `description?`, label as children. Control it from state for confirm-before-dangerous-direction. |
| **ActionButton** | `variant 'primary'|'secondary'|'destructive'|'quiet'`, `size 'compact'`, `isLoading`, `disabled`, `form` (link a footer submit), `type`. (`ActionLink`, `IconActionButton` are siblings.) |
| **CopyButton** | `value` (to clipboard), `label?`, `variant?`, `size?`. Icon-only; needs a `ToastProvider`. |
| **InlineAlert** | `title` (required), `children?` body, `tone 'neutral'|'info'|'success'|'warning'|'danger'`. role auto: `alert` for danger. |
| **Menu** | `Menu` + `MenuTrigger` / `MenuContent` / `MenuItem` / `MenuSeparator`. Portaled → pass explicit `themeMode`. |
| **Chat family** | `ChatLog` / `ChatMessage` / `ChatMarker` / `ChatComposer` / `ChatSuggestions` / `ChatAttachment` / `ChatMessageActions` — the conversation kit (prototype); density inherits from `FloatingPanel`. |
| **ChatSourceChip / ChatSources** | `sources: ChatSourceData[]`. One source → a link/`onSelect` chip with a hover/focus preview; several → a `label +N` chip opening the claim's list in a popover. `ChatSources` = the footer roll-up (stacked tiles + count → full list). Portaled parts take `themeMode?`; empty renders nothing. |
| **ChatThinking** | `steps: ChatThinkingStep[]` (statuses `pending\|active\|complete\|error\|skipped`, flat), `active` (shimmer + auto-expand while streaming), `duration` ms → "Thought for 45s", `open`/`defaultOpen`/`onOpenChange`, `density`. Composes as an assistant turn's first child. |
| **useToast** | `const { showToast } = useToast()` → `showToast({ text, appearance: 'success'|'error' })`. |
| **useMiddeskForm** / **getSubmitState** | `useMiddeskForm({ schema, defaultValues })` (Zod). `getSubmitState(form, { requireDirty: false })` → `{ isSubmitDisabled, isSubmitting }`. |

Anything not here: open the primitive's source or `index.ts` types. If you reach for the same lookup twice, add it to this table.
