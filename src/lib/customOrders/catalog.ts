// The server side of custom orders, copied from ~/Projects/prototype's
// fixtures/orderCatalog (resolve.ts, buildCatalog.ts, validate.ts). The catalog
// itself is built there and kept here as data — `scripts/build-order-catalog.ts`.

import data from '../../data/orderCatalog.json'
import type {
  CustomOrderConfig,
  CustomOrderError,
  InputKey,
  InputRequirement,
  OrderCatalog,
  SavedCustomOrder,
  StatusOverride
} from './types'

type Resolution = {
  packageOrder: string[]
  orderOf: Record<string, { package: string; subproduct: string }>
  dependency: { satisfiedBy: string[]; provider: string; dependents: string[] }
  producible: Record<string, string[]>
}

export const ORDER_CATALOG = data.catalog as OrderCatalog
const RESOLUTION = data.resolution as Resolution

// ── resolve.ts ────────────────────────────────────────────────────────────

export type ResolvedOrder = { package: string; subproducts: string[] }

export type ResolvedPackages = {
  // Catalog packages the customer chose.
  requested: string[]
  // Order packages that run behind the scenes for them.
  dependencies: string[]
  // Run order in catalog packages: dependencies first, then the requested.
  sequence: string[]
  // The orders actually placed: catalog packages sold as subproducts of one
  // order (Web Analysis, Industry Classification) collapse into it.
  orders: ResolvedOrder[]
}

const byCatalogOrder = (packages: Iterable<string>) => {
  const set = new Set(packages)
  return RESOLUTION.packageOrder.filter(p => set.has(p))
}

const toOrders = (sequence: readonly string[]): ResolvedOrder[] => {
  const orders: ResolvedOrder[] = []
  for (const key of sequence) {
    const order = RESOLUTION.orderOf[key]
    const pkg = order?.package ?? key
    const existing = orders.find(o => o.package === pkg)
    const subproducts = order ? [order.subproduct] : []
    if (existing) existing.subproducts.push(...subproducts)
    else orders.push({ package: pkg, subproducts })
  }
  return orders
}

export const resolvePackages = (
  requested: readonly string[]
): ResolvedPackages => {
  const { dependency } = RESOLUTION
  const unique = byCatalogOrder(requested)
  const needsVerification = unique.some(p => dependency.dependents.includes(p))
  const hasVerification = unique.some(p => dependency.satisfiedBy.includes(p))
  const dependencies =
    needsVerification && !hasVerification ? [dependency.provider] : []
  const sequence = [...dependencies, ...unique]
  return {
    requested: unique,
    dependencies,
    sequence,
    orders: toOrders(sequence)
  }
}

// ── buildCatalog.ts ───────────────────────────────────────────────────────

const isAnyOf = (r: InputRequirement): r is { any_of: InputKey[] } =>
  typeof r === 'object'

// Plain keys win: an `any_of` already satisfied by a required key is dropped.
export const normalizeRequirements = (
  requirements: readonly InputRequirement[],
  catalog: OrderCatalog = ORDER_CATALOG
): InputRequirement[] => {
  const plain = new Set(requirements.filter(r => !isAnyOf(r)) as InputKey[])
  const anyOfs = requirements
    .filter(isAnyOf)
    .filter(
      (r, i, all) =>
        !r.any_of.some(k => plain.has(k)) &&
        all.findIndex(o => o.any_of.join() === r.any_of.join()) === i
    )
  const order = catalog.inputs.map(i => i.key)
  return [
    ...[...plain].sort((a, b) => order.indexOf(a) - order.indexOf(b)),
    ...anyOfs
  ]
}

export type ExpandedConfig = {
  requested: string[]
  dependencies: string[]
  orders: ResolvedOrder[]
  insights: string[]
  report_sections: string[]
}

// The task keys a config shows: members of its included groups that one of
// the requested packages creates. Tasks only a dependency creates stay out.
export const expandConfig = (
  config: CustomOrderConfig,
  catalog: OrderCatalog = ORDER_CATALOG
): ExpandedConfig => {
  const { requested, dependencies, orders } = resolvePackages(config.packages)
  const included = catalog.insight_groups.filter(
    g =>
      config.insight_groups.includes(g.id) &&
      g.packages.some(p => requested.includes(p))
  )
  const producible = new Set(
    requested.flatMap(p => RESOLUTION.producible[p] ?? [])
  )
  return {
    requested,
    dependencies,
    orders,
    insights: included.flatMap(g =>
      g.insight_keys.filter(k => producible.has(k))
    ),
    report_sections: [...new Set(included.map(g => g.report_section))]
  }
}

export const requiredInputsFor = (
  config: CustomOrderConfig,
  catalog: OrderCatalog = ORDER_CATALOG
): { required: InputRequirement[]; optional: InputKey[] } => {
  const packages = catalog.packages.filter(p => config.packages.includes(p.key))
  const groups = catalog.insight_groups.filter(g =>
    config.insight_groups.includes(g.id)
  )
  // Only a package's own inputs are required — an insight's trigger inputs
  // (TIN for TIN match, DBA for DBA name) sharpen it but the order runs
  // without them, as in the standard order form.
  const required = normalizeRequirements(
    packages.flatMap(p => p.required_inputs),
    catalog
  )
  const requiredKeys = new Set(
    required.flatMap(r => (typeof r === 'object' ? [] : [r]))
  )
  const { insights } = expandConfig(config, catalog)
  const optional = [
    ...new Set(
      [
        ...groups.flatMap(g => g.trigger_inputs),
        ...catalog.insights
          .filter(i => insights.includes(i.key))
          .flatMap(i => i.trigger_inputs)
      ].filter(k => !requiredKeys.has(k))
    )
  ]
  return { required, optional }
}

// ── validate.ts ───────────────────────────────────────────────────────────

const labelOf = (catalog: OrderCatalog, pkg: string) =>
  catalog.packages.find(p => p.key === pkg)?.label ?? pkg

export const validateConfig = (
  config: CustomOrderConfig,
  catalog: OrderCatalog = ORDER_CATALOG
): CustomOrderError[] => {
  const errors: CustomOrderError[] = []
  if (!config.packages.length) {
    errors.push({ message: 'Choose at least one package.' })
    return errors
  }
  const known = new Set(catalog.packages.map(p => p.key))
  for (const pkg of config.packages) {
    if (!known.has(pkg)) {
      errors.push({ message: `${pkg} isn't available for this account.` })
    }
  }
  const selected = catalog.packages.filter(p => config.packages.includes(p.key))
  for (const pkg of selected) {
    const conflict = pkg.exclusive_with.find(o => config.packages.includes(o))
    if (conflict && pkg.key < conflict) {
      errors.push({
        message: `${pkg.label} can't be combined with ${labelOf(catalog, conflict)}.`
      })
    }
  }

  const groups = new Map(catalog.insight_groups.map(g => [g.id, g]))
  for (const id of config.insight_groups) {
    const group = groups.get(id)
    if (!group || !group.packages.some(p => config.packages.includes(p))) {
      errors.push({ message: `"${id}" isn't part of the selected packages.` })
    }
  }
  for (const pkg of selected) {
    if (!pkg.insight_group_ids.some(id => config.insight_groups.includes(id))) {
      errors.push({ message: `Choose at least one insight for ${pkg.label}.` })
    }
  }
  return errors
}

// Overrides equal to the default carry no information; dropping them keeps
// "customized" counts honest.
export const normalizeOverrides = (
  overrides: readonly StatusOverride[],
  catalog: OrderCatalog = ORDER_CATALOG
): StatusOverride[] =>
  overrides.filter(o => {
    const outcome = catalog.insights
      .find(i => i.key === o.insight)
      ?.outcomes.find(x => x.key === o.outcome)
    return outcome && outcome.default_status !== o.status
  })

export const availabilityOf = (
  saved: Pick<SavedCustomOrder, 'packages'>,
  catalog: OrderCatalog = ORDER_CATALOG
): SavedCustomOrder['availability'] => {
  const missing = saved.packages.find(
    p => !catalog.packages.some(c => c.key === p)
  )
  return missing
    ? {
        orderable: false,
        reason: 'Part of this order is no longer available.'
      }
    : { orderable: true }
}

// The subset of the POST /v1/businesses body the input checks read.
export type BusinessInputBody = {
  name?: string
  addresses?: { full_address?: string }[]
  website?: { url?: string }
  tin?: { tin?: string }
  names?: { name?: string; name_type?: string }[]
  formation?: { formation_state?: string; entity_type?: string }
  email_addresses?: { email?: string }[]
  phone_numbers?: { phone_number?: string }[]
  people?: { name?: string; dob?: string; ssn?: string }[]
}

const filled = (value: unknown) =>
  typeof value === 'string' ? value.trim().length > 0 : Boolean(value)

const HAS_INPUT: Record<InputKey, (b: BusinessInputBody) => boolean> = {
  name: b => filled(b.name),
  address: b => (b.addresses ?? []).some(a => filled(a.full_address)),
  website_url: b => filled(b.website?.url),
  tin: b => filled(b.tin?.tin),
  dba_name: b =>
    (b.names ?? []).some(n => n.name_type === 'dba' && filled(n.name)),
  formation_state: b => filled(b.formation?.formation_state),
  entity_type: b => filled(b.formation?.entity_type),
  email: b => (b.email_addresses ?? []).some(e => filled(e.email)),
  phone: b => (b.phone_numbers ?? []).some(p => filled(p.phone_number)),
  person: b => (b.people ?? []).some(p => filled(p.name)),
  person_dob: b => (b.people ?? []).some(p => filled(p.dob)),
  person_ssn: b => (b.people ?? []).some(p => filled(p.ssn))
}

export const missingInputs = (
  required: readonly InputRequirement[],
  body: BusinessInputBody
): InputRequirement[] =>
  required.filter(r =>
    typeof r === 'object'
      ? !r.any_of.some(k => HAS_INPUT[k](body))
      : !HAS_INPUT[r](body)
  )

export const validateInputs = (
  config: CustomOrderConfig,
  body: BusinessInputBody,
  catalog: OrderCatalog = ORDER_CATALOG
): CustomOrderError[] => {
  const label = (k: InputKey) =>
    catalog.inputs.find(i => i.key === k)?.label ?? k
  return missingInputs(requiredInputsFor(config, catalog).required, body).map(
    r =>
      typeof r === 'object'
        ? {
            message: `Enter ${r.any_of.map(label).join(' or ').toLowerCase()}.`,
            field: r.any_of[0]
          }
        : { message: `${label(r)} is required.`, field: r }
  )
}

// ── Several workflows in one order ────────────────────────────────────────

/**
 * Several workflows ordered together: every insight any of them includes,
 * then the fewest packages that cover them (`draftForGroups`), so two
 * workflows that both need verification order it once.
 */
export const combineConfigs = (
  configs: readonly CustomOrderConfig[],
  catalog: OrderCatalog = ORDER_CATALOG
): CustomOrderConfig => {
  const groups = [...new Set(configs.flatMap(c => c.insight_groups))]
  // Inline rather than through model.ts so this file stays importable from
  // the dev server without React-side modules.
  const wanted = new Set(groups)
  const packageOf = (key: string) => catalog.packages.find(p => p.key === key)
  const available = (packages: string[]) =>
    catalog.insight_groups
      .filter(g => g.packages.some(p => packages.includes(p)))
      .map(g => g.id)
  const chosen: string[] = []
  let remaining = [...wanted]
  while (remaining.length > 0) {
    const best = catalog.packages
      .filter(
        p =>
          !chosen.includes(p.key) &&
          !chosen.some(
            c =>
              p.exclusive_with.includes(c) ||
              (packageOf(c)?.exclusive_with ?? []).includes(p.key)
          )
      )
      .map(p => ({
        key: p.key,
        covers: p.insight_group_ids.filter(id => remaining.includes(id)).length,
        size: p.insight_group_ids.length
      }))
      .filter(c => c.covers > 0)
      .sort((a, b) => b.covers - a.covers || a.size - b.size)[0]
    if (!best) break
    chosen.push(best.key)
    const covered = new Set(available(chosen))
    remaining = remaining.filter(id => !covered.has(id))
  }
  const insights = new Set(
    catalog.insight_groups
      .filter(g => wanted.has(g.id))
      .flatMap(g => g.insight_keys)
  )
  return {
    packages: catalog.packages.map(p => p.key).filter(k => chosen.includes(k)),
    insight_groups: groups.filter(id => available(chosen).includes(id)),
    status_overrides: configs
      .flatMap(c => c.status_overrides)
      .filter(o => insights.has(o.insight))
  }
}
