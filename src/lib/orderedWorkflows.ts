import ordered from '../data/orderedWorkflows.json'

/**
 * The businesses ordered from `/order`, and the workflows each was ordered
 * with — written by the dev server's order endpoint (`scripts/order-endpoint.ts`).
 *
 * A business here shows only its workflows' insights in the report; one not
 * here (everything pulled before ordering existed) shows everything, as before.
 */
export type OrderedBusiness = {
  name: string
  workflows: { id: string; name: string }[]
  insight_groups: string[]
  insights: string[]
  report_sections: string[]
  orderedAt: string
  /** Set once every order has finished and the record was pulled after. */
  completedAt?: string
}

export const ORDERED = ordered as Record<string, OrderedBusiness>

export const orderedFor = (businessId: string | undefined): OrderedBusiness | undefined =>
  businessId ? ORDERED[businessId] : undefined

/** Ordered, and its orders still running. */
export const isOrdering = (businessId: string) => {
  const o = ORDERED[businessId]
  return Boolean(o && !o.completedAt)
}
