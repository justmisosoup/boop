# `@/core` — building product UI

How to build a page with the design system so it feels like a modern app: **clean, clear, calm, compact, consistent.** Compose from `@/core`; don't reinvent primitives. New things you build live **LOCAL** (`src/containers/<Feature>/` or `src/components/<Feature>/`) and wrap `@/core` — that's always safe. (Changing `@/core` itself is gated: see [README.md](../../../src/core/README.md). What bites you in production: [pitfalls.md](./pitfalls.md). Need a token or a prop signature mid-build: [reference.md](./reference.md).)

---

## The quality bar — the 5 C's

Each is a *test*, not a vibe. If any answer is "no," it's polished, not done.

- **Clean.** Every color / space / radius / shadow / type value is a `--core-*` token (a mapped Tailwind utility, or `*-[var(--core-color-*)]` for colors). No raw hex, ad-hoc px, bespoke shadow, or one-off duration. Default to ≤ 2–3 colors (more when each one *carries meaning*, e.g. semantic status); no decorative noise for its own sake. *This is what makes light/dark parity fall out for free.*
- **Clear.** Hierarchy is carried by *multiple* reinforcing signals (size + weight + color + space), and secondary content is *actually* de-emphasized (`Text tone='secondary'`, not just smaller). There is one obvious primary action per surface.
- **Calm.** Restraint, and motion that *earns its place*. Animation communicates a **spatial or causal relationship** (where did this come from, where did it go) — not decoration. Use `--core-duration`/`--core-ease`; **appear quickly, and exits no slower than entrances** (`duration-fast` 120ms is the default for feedback; 200ms+ starts to feel slow); animate **`transform`/`opacity` only**, never layout-triggering properties (pitfalls §3). `prefers-reduced-motion` is enforced globally — you don't re-implement it. The real "fast" is not the animation; see *Speed* below.
- **Compact.** Density comes from the spacing scale and the compact control sizes (`density='compact'`, `size='sm'`/`'compact'`). Information-dense, never cramped — and never trust a size token's *name*: measure the rendered height (see pitfalls §3).
- **Consistent.** Same scaffold across pages (the recipes below). Same primitive for the same job. The modern name, never the deprecated legacy twin (`ActionButton` not `Button`, `Dialog` not `Modal`, `Hint` not `Tooltip`, `TabsRoot` not `Tabs`, `Combobox` not `SelectedDropdown`). It matches its workbench specimen at `/internal/design-system`.

---

## Speed — make it instant, don't decorate the wait

The fastest UI removes the network from the interaction path; everything else just *looks* like it did. A polished loading animation is not speed — it's decoration over an absence of data. In priority order:

1. **Already here.** Read from cache (RTK Query `keepUnusedDataFor`), prefetch on intent, keep the previous page during navigation. A list you've already seen should reappear *instantly*, not re-skeleton.
2. **Optimistic.** A mutation should apply to the UI **now** and reconcile in the background — don't make the user watch a spinner for a write you're 99% sure will succeed. The auto-save recipe below is the control-level template; for RTK Query it's `onQueryStarted` + `updateQueryData` + `patch.undo()` on failure.
3. **A loading state is a smell, not a goal.** Before reaching for a skeleton or spinner, ask: *could this data already be local, cached, or prefetched?* A skeleton is the fallback for a genuine cold load — when you do show one it must mirror the final layout exactly (zero reflow on swap) and never flash empty-then-data (`data` undefined-until-loaded). A perpetual spinner usually means the architecture is waiting on the network in the wrong place.
4. **Don't undo it with motion.** A 200ms+ or layout-triggering transition (the 5 C's "Calm" + pitfalls §3) makes a genuinely fast interaction *feel* slow. Motion is the last 5% — keep it cheap (`transform`/`opacity`, ~150ms) or skip it.

This is a posture, not a one-off. The design system hands you the pieces (cache, optimistic helpers, a skeleton that matches the final layout); pushing the work *off* the interaction path is an app-architecture choice you make per feature.

---

## Recipes

Four scaffolds cover almost everything shipped so far. Each is **paste-and-adapt** — the structure and prop names are real. For the full thing, open the **exemplar** (a live file on `master`; the tree is the current truth — a recipe can drift, the exemplar can't).

> Two rules ride along every recipe: **the container orchestrates, the leaf is presentational** (the page holds Redux/RTK state and dispatches; rows, drawers, menus take `data` + callbacks as props and import nothing from the `actions` barrel — a new cyclic edge fails Biome's `noImportCycles`); and **don't re-wrap `.core-theme`** — the app-wide light scope already lives in `router.tsx`, and the Settings layout owns the page gutter (pass `className='px-0'` to `PageHeaderBand` inside it).

### 1. List page

A filter toolbar over a `DataTable`. The de-facto shape: an optional header band with tabs, a *helper-text-left / primary-action-right* row, the toolbar (`SegmentedControl` + `SearchInput` + `FacetFilter`), then the table.

**Exemplars:** [src/containers/Settings/Team/UsersContainer.tsx](../../../src/containers/Settings/Team/UsersContainer.tsx) (plain list, **no** header) · [src/containers/Settings/Webhooks/index.tsx](../../../src/containers/Settings/Webhooks/index.tsx) (tabbed, with header band).

```tsx
import {
  ActionButton, DataTable, type DataTableColumnDef, DataTableEmptyState,
  DataTableErrorState, type DataTableSortState, EntityStateBadge, FacetFilter,
  SearchInput, SegmentedControl, SegmentedControlItem, Text
} from '@/core'

const PER_PAGE = 10

function ItemsList() {
  const { data, isFetching, isError } = useGetItemsQuery()
  const [search, setSearch] = useState('')
  const [statusView, setStatusView] = useState<'all' | 'active'>('all')
  const [facet, setFacet] = useState<string[]>([])
  const [sort, setSort] = useState<DataTableSortState>({ id: 'name', direction: 'asc' })
  const [page, setPage] = useState(1)

  // Filter + sort the FULL set, THEN slice the page (most list APIs have no server-side query).
  const rows = data?.data
  const total = rows?.length ?? 0
  const pageRows = useMemo(() => rows?.slice((page - 1) * PER_PAGE, page * PER_PAGE), [rows, page])

  const columns = useMemo<DataTableColumnDef<Item>[]>(() => [
    { id: 'name', header: 'Name', cell: ({ row }) => <Text size='sm'>{row.original.name}</Text>, meta: { minWidth: 240 } },
    // status chip: pass a semantic prop, never a raw color token (see reference.md) —
    // EntityStateBadge for a lifecycle value, or <MetaChip tone='danger'>Revoked</MetaChip> for an arbitrary label.
    { id: 'status', header: 'Status', enableSorting: false, cell: ({ row }) => <EntityStateBadge state={row.original.state} />, meta: { width: 130 } },
    { id: 'actions', header: '', enableSorting: false, cell: ({ row }) => <ItemActionsMenu item={row.original} />, meta: { align: 'end', width: 'content' } }
  ], [])

  const getRowId = useCallback((row: Item, i: number) => `${row.id ?? 'item'}:${i}`, [])

  return (
    <div>
      <div className='flex items-center justify-between gap-4 pb-2'>
        <Text size='sm' tone='secondary'>Short description of what this list manages.</Text>
        <ActionButton onClick={onAdd} {...cya('AddItem')}>Add item</ActionButton>
      </div>

      <div className='flex flex-wrap items-center justify-between gap-3 py-2'>
        <SegmentedControl aria-label='Filter by status' size='sm' value={statusView}
          onValueChange={v => { setStatusView(v as 'all' | 'active'); setPage(1) }}>
          <SegmentedControlItem value='all'>All</SegmentedControlItem>
          <SegmentedControlItem value='active'>Active</SegmentedControlItem>
        </SegmentedControl>
        <div className='flex items-center gap-2'>
          <SearchInput aria-label='Search items' className='w-56' placeholder='Search items'
            value={search} onChange={v => { setSearch(v); setPage(1) }} onClear={() => { setSearch(''); setPage(1) }} />
          <FacetFilter align='end' aria-label='Filter by category' label='Category'
            options={FACET_OPTIONS} value={facet} onChange={v => { setFacet(v); setPage(1) }} />
        </div>
      </div>

      <DataTable<Item>
        columns={columns}
        data={data ? pageRows : undefined}   // undefined → skeleton; [] → empty state. Never default to [].
        density='compact'
        empty={<DataTableEmptyState>No items yet.</DataTableEmptyState>}
        error={isError ? <DataTableErrorState>Couldn’t load items.</DataTableErrorState> : undefined}
        getRowId={getRowId}
        loading={isFetching}
        onPageChange={setPage}
        onSortChange={setSort}
        pagination={{ page, perPage: PER_PAGE, total }}   // total = FILTERED count, not pageRows.length
        sort={sort}
      />
    </div>
  )
}
```

- **Header band is tabs-only.** `PageHeaderBand > PageHeader > PageHeading` (+ `TabsList`/`TabsTrigger`/`TabsCount`) appears only when the page has tabs. A plain list (Team Members) leads straight with the helper/action row — no `PageHeader`. Gate `TabsCount` on `data &&` so it doesn't flash a 0.
- **Controlled sort**: hold a `DataTableSortState` (`{ id, direction }`); opt a column out with `enableSorting: false`.
- Reset `page` to 1 in every filter's change handler.

### 2. Detail via drawer

A row click opens a side panel. The parent holds the selection; the drawer is a pure leaf.

**Exemplar:** [src/containers/Settings/Webhooks/index.tsx](../../../src/containers/Settings/Webhooks/index.tsx) + [WebhookDetailDrawer.tsx](../../../src/containers/Settings/Webhooks/WebhookDetailDrawer.tsx).

```tsx
// PARENT — owns the query + selection, wires row-click via rowIntent
const [detail, setDetail] = useState<Entity | null>(null)
const rowIntent = useMemo(() => ({ kind: 'detail' as const, onOpen: setDetail }), [])

<DataTable<Entity> columns={columns} data={data ? data.data : undefined}
  density='compact' getRowId={getRowId} loading={isFetching} rowIntent={rowIntent} />
<EntityDetailDrawer entity={detail} isOpen={detail !== null} onClose={() => setDetail(null)} />

// LEAF — presentational; data + onClose as props, no query of its own
export const EntityDetailDrawer = ({ entity, isOpen, onClose }: Props) => {
  const ref = useRef(entity)            // keep last value so content stays put through the close animation
  if (entity) ref.current = entity
  const stable = entity ?? ref.current
  if (!stable) return null
  return (
    <Drawer isOpen={isOpen} onClose={onClose} title='Item details' width={600}
      footer={<ActionLink to={`/items/${stable.id}`} variant='secondary'>View more</ActionLink>}>
      {/* …details… */}
    </Drawer>
  )
}
```

- **`rowIntent`** is the row-click wiring: `{ kind: 'detail', onOpen }` (the union is `'static' | 'select'+onSelect | 'detail'+onOpen`). Memoize it.
- **`Drawer` is modal by default** (overlay + scroll-lock + focus-trap). Pass `modal={false}` only when you actually want a non-modal side panel that leaves the page scrollable.
- The `ref`-keeps-last-value trick prevents the panel blanking mid-close.

### 3. Form in a dialog

A create/edit form inside a `Dialog`, validated with Zod via `useMiddeskForm`.

**Exemplars:** [src/containers/Settings/Team/NewUser.tsx](../../../src/containers/Settings/Team/NewUser.tsx) (TokenInput + RadioGroup) · [src/containers/Settings/Webhooks/NewWebhook.tsx](../../../src/containers/Settings/Webhooks/NewWebhook.tsx) (Combobox + Input).

```tsx
import {
  ActionButton, Dialog, Field, FieldLabel, FieldError, FormField, Input,
  Combobox, type ComboboxOption, TokenInput, InlineAlert, getSubmitState, useMiddeskForm
} from '@/core'

export const ADD_ENTITY_MODAL_KEY = 'add-entity-x'   // exported so the opener can dispatch(openModal(KEY))

const schema = z.object({ name: z.string().min(1, 'Required'), emails: z.array(z.string()).min(1, 'Add one.') })
type FormValues = z.infer<typeof schema>

const NewEntityDialog = ({ isOpen }: { isOpen: boolean }) => {
  const dispatch = useDispatch()
  const formId = useId()
  const form = useMiddeskForm<FormValues>({ schema, defaultValues: { name: '', emails: [] } })
  const { isSubmitDisabled, isSubmitting } = getSubmitState(form, { requireDirty: false })

  const onClose = () => { form.reset(); dispatch(closeModal(ADD_ENTITY_MODAL_KEY)) }
  const onSubmit = async (values: FormValues) => { await createEntity(values).unwrap(); onClose() }

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title='Add entity'
      footer={<>
        <ActionButton variant='secondary' type='button' onClick={onClose}>Cancel</ActionButton>
        {/* submit lives in the footer, OUTSIDE <form> → link via form={formId} */}
        <ActionButton disabled={isSubmitDisabled} form={formId} isLoading={isSubmitting} type='submit' {...cya('SubmitEntity')}>Save</ActionButton>
      </>}>
      <form className='grid gap-4' id={formId} onSubmit={form.handleSubmit(onSubmit)}>
        <Field>
          <FieldLabel htmlFor='entity-name'>Name</FieldLabel>
          <FormField control={form.control} name='name' render={({ field, fieldState }) => (
            <>
              <Input id='entity-name' aria-invalid={fieldState.error ? true : undefined} {...field} />
              {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
            </>
          )} />
        </Field>
        <Field isInvalid={!!form.formState.errors.emails}>
          <FieldLabel>Emails</FieldLabel>
          <FormField control={form.control} name='emails' render={({ field }) => (
            <TokenInput aria-label='Emails' value={field.value} onChange={field.onChange} onBlur={field.onBlur} placeholder='name@company.com' />
          )} />
        </Field>
      </form>
    </Dialog>
  )
}
```

- **Submit links by `form={formId}`** because it sits in `Dialog`'s `footer`, outside `<form>`. Use `useId()` for the id; Cancel is `type='button'`.
- **Visibility is Redux-driven**: export a `MODAL_KEY`, gate `isOpen` on `useSelector(s => s.modal.modal === KEY)`, close with `dispatch(closeModal(KEY))`, and always `form.reset()` on close.
- `getSubmitState(form, { requireDirty: false })` → `{ isSubmitDisabled, isSubmitting }`; pass `requireDirty:false` for create forms. `Combobox`/`TokenInput` values are **always arrays** (single-select reads `value[0]`).

### 4. Auto-save settings

No page-level Save. Each control persists on change and fires a toast. Dangerous directions confirm first.

**Exemplars:** [src/containers/Settings/Team/SSOSettingsContainer.tsx](../../../src/containers/Settings/Team/SSOSettingsContainer.tsx) + [SettingsSection.tsx](../../../src/containers/Settings/Team/SettingsSection.tsx).

```tsx
import { ActionButton, Combobox, Dialog, Text, Toggle, useToast } from '@/core'

// A control that auto-saves:
const onChange = async ([next]: string[]) => {
  if (!next || next === value) return
  try { await updateThing({ thing: next }).unwrap(); showToast({ text: 'Updated', appearance: 'success' }) }
  catch { showToast({ text: 'Couldn’t update', appearance: 'error' }) }
}

// A Toggle whose dangerous direction confirms first — the Toggle is STATE-CONTROLLED:
const [enabled, setEnabled] = useState<boolean | undefined>(undefined)   // seed from query via useEffect
const onToggle = (next: boolean) => {
  if (!next) { setConfirmOpen(true); return }   // risky direction → confirm; switch stays put (controlled)
  void persist(true)
}
const persist = async (next: boolean) => {
  const prev = enabled; setEnabled(next)        // optimistic
  try { await updateThing({ enabled: next }).unwrap(); showToast({ text: 'Updated', appearance: 'success' }) }
  catch { setEnabled(prev); showToast({ text: 'Couldn’t update', appearance: 'error' }) }   // rollback
}
```

- **The Toggle must be state-controlled** (`checked` from `useState` seeded by `useEffect` from the query), not bound to server data — that's what lets a confirm `Dialog` cancel a dangerous direction with no rollback, and the optimistic-update/catch-rollback pattern intact.
- **`useToast()` → `showToast({ text, appearance })`** with `appearance: 'success' | 'error'` (not `title`/`variant`).
- **LOCAL `SettingsSection`, not the DS `Section`.** This recipe uses a deliberately-local `SettingsSection` (a thin `Surface` wrapper with a level-3 `<h3>`) for the dense settings-card look. The DS `Section` hardwires `Heading level={2}` — right for a top-level page section, wrong here. Building a local section is correct, not an oversight; keep it local. (This is "using the system," not "changing" it.)

---

## Standard patterns (used by every recipe)

- **Container orchestrates / leaf is presentational** — and it's enforced by Biome's `noImportCycles` (`bun run lint:js`), not just style. The page holds Redux/RTK state and dispatches; leaves take `data` + callbacks. A leaf that imports the `actions` barrel adds a cyclic edge that **fails CI**.
- **`data` undefined-until-loaded** — `data={query ? rows : undefined}` shows a skeleton; `[]` shows the empty state. Memoize `columns`/`getRowId`/`rowIntent` (an unstable ref triggers a prod-only render loop — pitfalls §5). Index-suffix `getRowId`.
- **Prefer the modern name** — `ActionButton` over `Button`, `Dialog` over `Modal`, `Hint` over `Tooltip`, `TabsRoot` over legacy `Tabs`, `Combobox` over `SelectedDropdown`. The legacy twins still exist (some, like `Tabs`, still have consumers) and aren't formally `@deprecated` yet — so reach for the modern name on new work rather than treating the twin as forbidden.
- **Preserve hard contracts through the redesign** — re-attach every `{...cya('…')}` e2e hook (`import cya from 'utils/cya'` — a default export, *not* from `@/core`), modal-open key, tracking event, and exact request shape. A redesign changes the look, not the wiring (pitfalls §7).
- **Don't re-wrap `.core-theme`** — the root scope is global; portaled content (`Menu`, `Hint`) needs an explicit `themeMode` instead (pitfalls §4).

---

See also: [pitfalls.md](./pitfalls.md) (what breaks in production) · [README.md](../../../src/core/README.md) (the contract — for *changing* `@/core`).
