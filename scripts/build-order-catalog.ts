/**
 * The order catalog, built once by ~/Projects/prototype's own builder and kept
 * as data: which insights exist, which packages produce them, and how packages
 * resolve to the orders the API is sent.
 *
 *   bun run scripts/build-order-catalog.ts
 *
 * Every package and capability is turned on; the API refuses what the account
 * isn't entitled to.
 */
import { join } from 'node:path'

const SOURCE = join(process.env.HOME ?? '', 'Projects/prototype/src')
const { buildOrderCatalog } = await import(join(SOURCE, 'fixtures/orderCatalog/buildCatalog.ts'))
const meta = await import(join(SOURCE, 'fixtures/orderCatalog/metadata.ts'))
const { TASK_CATALOG } = await import(join(SOURCE, 'fixtures/catalog/index.ts'))

const catalog = buildOrderCatalog({
  entitledPackages: [...meta.CATALOG_PACKAGE_ORDER],
  capabilities: new Set(['improved_web', 'loans', 'sole_prop_prediction', 'tin_type', 'risky_keywords', 'related_businesses'])
})

const producible: Record<string, string[]> = {}
for (const task of TASK_CATALOG) {
  for (const p of meta.catalogPackagesForTask(task)) (producible[p] ??= []).push(task.key)
}

const resolution = {
  packageOrder: [...meta.CATALOG_PACKAGE_ORDER],
  orderOf: Object.fromEntries(
    Object.entries(meta.PACKAGE_META as Record<string, { order?: unknown }>)
      .filter(([, m]) => m.order)
      .map(([k, m]) => [k, m.order])
  ),
  dependency: meta.VERIFICATION_DEPENDENCY,
  producible
}

await Bun.write('src/data/orderCatalog.json', JSON.stringify({ catalog, resolution }, null, 2))
console.log(`${catalog.packages.length} packages, ${catalog.insight_groups.length} insight groups, ${catalog.insights.length} insights → src/data/orderCatalog.json`)
