import ordered from '../data/orderedWorkflows.json'

/**
 * The businesses ordered from `/order`, and the assessments each was ordered
 * with — written by the dev server's order endpoint (`scripts/order-endpoint.ts`).
 *
 * One assessment per custom order per order placed: a business ordered with two
 * custom orders has two, and ordering it again adds more. Each reads only its
 * own insights. A business not here (everything pulled before ordering existed)
 * has the one "Full Business KYB" assessment — see `assessments.ts`.
 */
export type OrderedAssessment = {
  /** Unique to this order of this custom order; safe in a file name. */
  id: string
  customOrderId: string
  name: string
  insight_groups: string[]
  /** Catalog insight keys — the part of a `Derived.insightId` before `:`. */
  insights: string[]
  orderedAt: string
  /** Set once its orders have finished and the record was pulled after. */
  completedAt?: string
}

export type OrderedBusiness = {
  name: string
  assessments: OrderedAssessment[]
}

export const ORDERED = ordered as Record<string, OrderedBusiness>

export const orderedFor = (businessId: string | undefined): OrderedBusiness | undefined =>
  businessId ? ORDERED[businessId] : undefined

/** Ordered, and some of its orders still running. */
export const isOrdering = (businessId: string) =>
  Boolean(ORDERED[businessId]?.assessments.some((a) => !a.completedAt))

/** When the business was first ordered here. */
export const firstOrderedAt = (businessId: string) =>
  ORDERED[businessId]?.assessments.map((a) => a.orderedAt).sort()[0]
