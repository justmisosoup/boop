// The builder's state and rules, computed only from the order catalog. The
// catalog never lists hidden dependency packages, so nothing derived here
// can name one.

import type {
  CatalogPackage,
  CustomOrderConfig,
  InputKey,
  InputRequirement,
  InsightGroup,
  InsightStatus,
  OrderCatalog,
  SavedCustomOrder,
  StatusOverride
} from './types'

export type Draft = {
  id: string | null
  name: string
  description: string
  packages: string[]
  // Groups are included by default; the draft records what was turned off.
  excludedGroups: string[]
  overrides: StatusOverride[]
  /** A variant's: the assessment it reads the same data as, the sentence its
   *  summary opens with, and how the Assistant should read it. */
  basedOn: string | null
  summaryLead: string
  instructions: string
}

export const emptyDraft = (): Draft => ({
  id: null,
  name: '',
  description: '',
  packages: [],
  excludedGroups: [],
  overrides: [],
  basedOn: null,
  summaryLead: '',
  instructions: ''
})

const packageOf = (catalog: OrderCatalog, key: string) =>
  catalog.packages.find(p => p.key === key)

export const groupsForPackage = (
  catalog: OrderCatalog,
  key: string
): InsightGroup[] => {
  const ids = packageOf(catalog, key)?.insight_group_ids ?? []
  return catalog.insight_groups.filter(g => ids.includes(g.id))
}

const availableGroupIds = (catalog: OrderCatalog, packages: string[]) =>
  catalog.insight_groups
    .filter(g => g.packages.some(p => packages.includes(p)))
    .map(g => g.id)

export const includedGroupIds = (
  catalog: OrderCatalog,
  draft: Draft
): string[] =>
  availableGroupIds(catalog, draft.packages).filter(
    id => !draft.excludedGroups.includes(id)
  )

// Groups a saved order left out stay out when it is edited, including groups
// the catalog gained since it was saved.
export const draftFromSaved = (
  saved: SavedCustomOrder,
  catalog: OrderCatalog,
  { duplicate = false } = {}
): Draft => ({
  id: duplicate ? null : saved.id,
  name: duplicate ? `${saved.name} (copy)` : saved.name,
  description: saved.description ?? '',
  packages: saved.packages.filter(p => packageOf(catalog, p)),
  excludedGroups: availableGroupIds(catalog, saved.packages).filter(
    id => !saved.insight_groups.includes(id)
  ),
  overrides: saved.status_overrides,
  // A duplicate reads the same data as what it was made from: that is what it varies.
  basedOn: duplicate ? (saved.based_on ?? saved.id) : (saved.based_on ?? null),
  summaryLead: saved.summary_lead ?? '',
  instructions: saved.instructions ?? ''
})

export const conflictFor = (
  catalog: OrderCatalog,
  draft: Draft,
  key: string
): CatalogPackage | undefined => {
  const exclusive = packageOf(catalog, key)?.exclusive_with ?? []
  return catalog.packages.find(
    p =>
      p.key !== key &&
      draft.packages.includes(p.key) &&
      exclusive.includes(p.key)
  )
}

export const togglePackage = (draft: Draft, key: string): Draft => ({
  ...draft,
  packages: draft.packages.includes(key)
    ? draft.packages.filter(p => p !== key)
    : [...draft.packages, key]
})

export const setGroupIncluded = (
  draft: Draft,
  groupId: string,
  included: boolean
): Draft => ({
  ...draft,
  excludedGroups: included
    ? draft.excludedGroups.filter(id => id !== groupId)
    : [...new Set([...draft.excludedGroups, groupId])]
})

// Selection is by insight: a group shared by two packages reads the same
// under either.
export const isInsightSelected = (
  catalog: OrderCatalog,
  draft: Draft,
  _packageKey: string,
  groupId: string
) => includedGroupIds(catalog, draft).includes(groupId)

/**
 * The packages to order for a set of insights: the fewest that cover them,
 * each pick the one covering the most still-uncovered insights, ties going to
 * the smaller package, so less runs that nobody asked for. Packages that
 * can't be ordered together are never both picked.
 */
export const draftForGroups = (
  catalog: OrderCatalog,
  draft: Draft,
  groupIds: string[]
): Draft => {
  const wanted = new Set(groupIds)
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
              (packageOf(catalog, c)?.exclusive_with ?? []).includes(p.key)
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
    const covered = new Set(availableGroupIds(catalog, chosen))
    remaining = remaining.filter(id => !covered.has(id))
  }
  return {
    ...draft,
    packages: chosen,
    excludedGroups: availableGroupIds(catalog, chosen).filter(
      id => !wanted.has(id)
    )
  }
}

// Exclusions only mean something while a selected package offers the group,
// so a removed package takes its now-orphaned exclusions with it.
const removePackage = (
  catalog: OrderCatalog,
  draft: Draft,
  packageKey: string
): Draft => {
  const packages = draft.packages.filter(p => p !== packageKey)
  const offered = availableGroupIds(catalog, packages)
  return {
    ...draft,
    packages,
    excludedGroups: draft.excludedGroups.filter(id => offered.includes(id))
  }
}

// Choosing an insight of an unselected package adds the package with only
// that insight; clearing a package's last insight removes the package.
export const toggleInsight = (
  catalog: OrderCatalog,
  draft: Draft,
  _packageKey: string,
  groupId: string
): Draft => {
  const included = includedGroupIds(catalog, draft)
  return draftForGroups(
    catalog,
    draft,
    included.includes(groupId)
      ? included.filter(id => id !== groupId)
      : [...included, groupId]
  )
}

// Other selected packages that also produce a group. Shared groups are one
// selection, so toggling it under either package changes both.
export const sharedWith = (
  catalog: OrderCatalog,
  draft: Draft,
  group: InsightGroup,
  packageKey: string
): CatalogPackage[] =>
  catalog.packages.filter(
    p =>
      p.key !== packageKey &&
      draft.packages.includes(p.key) &&
      group.packages.includes(p.key)
  )

export const setOverride = (
  draft: Draft,
  override: StatusOverride,
  defaultStatus: InsightStatus
): Draft => {
  const rest = draft.overrides.filter(
    o => !(o.insight === override.insight && o.outcome === override.outcome)
  )
  return {
    ...draft,
    overrides: override.status === defaultStatus ? rest : [...rest, override]
  }
}

export const toConfig = (
  catalog: OrderCatalog,
  draft: Draft
): CustomOrderConfig => {
  const groups = includedGroupIds(catalog, draft)
  const insights = new Set(
    catalog.insight_groups
      .filter(g => groups.includes(g.id))
      .flatMap(g => g.insight_keys)
  )
  return {
    packages: catalog.packages
      .map(p => p.key)
      .filter(key => draft.packages.includes(key)),
    insight_groups: groups,
    status_overrides: draft.overrides.filter(o => insights.has(o.insight))
  }
}

export const packageStepErrors = (
  catalog: OrderCatalog,
  draft: Draft
): string[] => {
  if (!draft.packages.length) return ['Choose at least one package.']
  return draft.packages.flatMap(key => {
    const conflict = conflictFor(catalog, draft, key)
    const pkg = packageOf(catalog, key)
    return conflict && pkg && key < conflict.key
      ? [`${pkg.label} can't be combined with ${conflict.label}.`]
      : []
  })
}

export const insightStepErrors = (
  catalog: OrderCatalog,
  draft: Draft
): string[] => {
  const included = includedGroupIds(catalog, draft)
  return draft.packages.flatMap(key => {
    const pkg = packageOf(catalog, key)
    const any = groupsForPackage(catalog, key).some(g =>
      included.includes(g.id)
    )
    return pkg && !any ? [`Choose at least one insight for ${pkg.label}.`] : []
  })
}

const checkList = new Intl.ListFormat('en', { type: 'conjunction' })

export const summarize = (
  catalog: OrderCatalog | undefined,
  config: CustomOrderConfig
): string => {
  const checks = (catalog?.insight_groups ?? [])
    .filter(g => config.insight_groups.includes(g.id))
    .map(g => g.label)
  return checkList.format(checks)
}

// Inputs some included insight uses but nothing requires. The details form
// offers them as optional, named for the insight they enable.
export const optionalInputs = (
  catalog: OrderCatalog,
  config: CustomOrderConfig,
  required: InputRequirement[]
): { key: InputKey; usedFor: string[] }[] => {
  const requiredKeys = new Set(
    required.flatMap(r => (typeof r === 'object' ? [] : [r]))
  )
  const groups = catalog.insight_groups.filter(g =>
    config.insight_groups.includes(g.id)
  )
  const insights = catalog.insights.filter(i =>
    groups.some(g => g.insight_keys.includes(i.key))
  )
  const byInput = new Map<InputKey, string[]>()
  for (const group of groups) {
    for (const key of group.trigger_inputs) {
      if (requiredKeys.has(key)) continue
      byInput.set(key, [...new Set([...(byInput.get(key) ?? []), group.label])])
    }
  }
  for (const insight of insights) {
    for (const key of insight.trigger_inputs) {
      if (requiredKeys.has(key)) continue
      const group = groups.find(g => g.id === insight.group_id)
      const label = group?.label ?? insight.label
      byInput.set(key, [...new Set([...(byInput.get(key) ?? []), label])])
    }
  }
  return catalog.inputs
    .filter(i => byInput.has(i.key))
    .map(i => ({ key: i.key, usedFor: byInput.get(i.key) ?? [] }))
}

type InsightRef = { packageKey: string; groupId: string }

// Shared insights can flip as earlier ones toggle, so each is checked against
// the running draft.
export const setInsightsSelected = (
  catalog: OrderCatalog,
  draft: Draft,
  refs: InsightRef[],
  selected: boolean
): Draft =>
  refs.reduce(
    (next, { packageKey, groupId }) =>
      isInsightSelected(catalog, next, packageKey, groupId) === selected
        ? next
        : toggleInsight(catalog, next, packageKey, groupId),
    draft
  )

export type InputUse = { id: string; label: string; usedFor: string[] }

// What the customer will send for this selection: required inputs come from
// the selected packages (dependencies included), optional ones from the
// insights that use them.
export const inputSummary = (
  catalog: OrderCatalog,
  draft: Draft
): { required: InputUse[]; optional: InputUse[] } => {
  const label = (key: InputKey) =>
    catalog.inputs.find(i => i.key === key)?.label ?? key
  const order = (key: InputKey) => catalog.inputs.findIndex(i => i.key === key)
  const included = includedGroupIds(catalog, draft)
  const needs = draft.packages.flatMap(key => {
    const usedFor = groupsForPackage(catalog, key)
      .filter(g => included.includes(g.id))
      .map(g => g.label)
    return (packageOf(catalog, key)?.required_inputs ?? []).map(
      requirement => ({ requirement, usedFor })
    )
  })
  const plain = new Set(
    needs.flatMap(({ requirement }) =>
      typeof requirement === 'object' ? [] : [requirement]
    )
  )
  // An either-or folds into an input already required elsewhere; otherwise
  // its first option is the one asked for, so every row is a single input.
  const keyFor = (requirement: InputRequirement): InputKey =>
    typeof requirement === 'object'
      ? (requirement.any_of.find(k => plain.has(k)) ?? requirement.any_of[0])
      : requirement
  const required = new Map<InputKey, InputUse & { rank: number }>()

  for (const { requirement, usedFor } of needs) {
    const key = keyFor(requirement)
    const existing = required.get(key)
    required.set(key, {
      id: key,
      label: label(key),
      usedFor: [...new Set([...(existing?.usedFor ?? []), ...usedFor])],
      rank: order(key)
    })
  }

  return {
    required: [...required.values()]
      .sort((a, b) => a.rank - b.rank)
      .map(({ rank: _rank, ...use }) => use),
    optional: optionalInputs(catalog, toConfig(catalog, draft), [
      ...required.keys()
    ]).map(({ key, usedFor }) => ({ id: key, label: label(key), usedFor }))
  }
}
