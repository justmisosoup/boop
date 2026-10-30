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
  /** A variant's reading, kept as it was when added: editing the saved
   *  assessment later never changes a report already placed. */
  status_overrides?: Array<{ insight: string; outcome: string; status: string }>
  based_on?: string | null
  summary_lead?: string | null
  instructions?: string | null
  /** Added on data the business already had: no order was placed. */
  attached?: boolean
}

export type OrderedBusiness = {
  name: string
  assessments: OrderedAssessment[]
}

export const ORDERED = ordered as Record<string, OrderedBusiness>

export const orderedFor = (businessId: string | undefined): OrderedBusiness | undefined =>
  businessId ? ORDERED[businessId] : undefined

/**
 * How long an assessment may read as "Ordering". Past it, it reads from
 * whatever results have landed — an order the API is slow to finish never
 * holds the business up — and later results still fill in as they arrive.
 */
export const ORDERING_CAP_MS = 10 * 60 * 1000

/** Still waiting on this assessment's orders, inside the cap. */
export const stillOrdering = (a: Pick<OrderedAssessment, 'orderedAt' | 'completedAt'>, now = Date.now()) =>
  !a.completedAt && now - Date.parse(a.orderedAt) < ORDERING_CAP_MS

/** Ordered, and some of its orders still running (inside the cap). */
export const isOrdering = (businessId: string) =>
  Boolean(ORDERED[businessId]?.assessments.some((a) => stillOrdering(a)))

/** When the business was first ordered here. */
export const firstOrderedAt = (businessId: string) =>
  ORDERED[businessId]?.assessments.map((a) => a.orderedAt).sort()[0]
