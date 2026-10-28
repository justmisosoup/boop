import { availabilityOf, ORDER_CATALOG, requiredInputsFor } from './customOrders/catalog'
import type { CustomOrderConfig, SavedCustomOrder } from './customOrders/types'
import { cardById, REPORT_CARDS } from './reportCards'

/**
 * The report's assessments, as things to order: each card of the report —
 * Registrations, Names, Liens — and the catalog packages and insight groups
 * that produce it. The order page lists these, by the report's own names; a
 * workflow is one assessment for now, so each ordered is one workflow.
 *
 * The bucketed and scored groups (address risk and usage, web presence
 * quality, risky keywords) are Middesk judgments the assessments leave out.
 */
const CONFIGS: Record<string, Pick<CustomOrderConfig, 'packages' | 'insight_groups'>> = {
  formation: {
    packages: ['business_verification_verify'],
    insight_groups: ['sos_registration_status', 'sos_domestic_standing', 'sos_state_match', 'formation_state', 'entity_type_match', 'entity_type']
  },
  name: { packages: ['business_verification_verify'], insight_groups: ['business_name', 'dba_name', 'name_entity_type'] },
  tin: { packages: ['business_verification_verify'], insight_groups: ['tin_match', 'tin_type'] },
  address: {
    packages: ['business_verification_verify'],
    insight_groups: ['address_verification', 'address_deliverability', 'address_property_type', 'address_flags']
  },
  people: { packages: ['business_verification_verify'], insight_groups: ['person_verification'] },
  connections: { packages: ['business_verification_verify'], insight_groups: ['business_connections'] },
  'screening-watchlist': { packages: ['business_verification_verify'], insight_groups: ['watchlist'] },
  'screening-pep': { packages: ['enhanced_screenings'], insight_groups: ['politically_exposed_persons'] },
  'screening-media': { packages: ['adverse_media'], insight_groups: ['adverse_media'] },
  website: {
    packages: ['web_analysis'],
    insight_groups: ['website_status', 'website_discovery', 'domain', 'web_content_match', 'profiles']
  },
  industry: { packages: ['industry_classification'], insight_groups: ['industry'] },
  liens: { packages: ['liens'], insight_groups: ['liens'] },
  litigation: { packages: ['litigations'], insight_groups: ['litigations'] },
  bankruptcy: { packages: ['bankruptcies'], insight_groups: ['bankruptcies'] }
}

/** A report assessment's order id: never a saved one's (those are uuids). */
export const REPORT_PREFIX = 'report:'
export const reportCardOf = (orderId: string) => (orderId.startsWith(REPORT_PREFIX) ? orderId.slice(REPORT_PREFIX.length) : undefined)

const EPOCH = '2026-01-01T00:00:00.000Z'

/** One report assessment, shaped as a saved order so the order page and its
 *  details step take it as they take any. */
const asSavedOrder = (cardId: string): SavedCustomOrder => {
  const config = { ...CONFIGS[cardId], status_overrides: [] }
  return {
    ...config,
    id: `${REPORT_PREFIX}${cardId}`,
    name: cardById(cardId)?.label ?? cardId,
    description: null,
    environment: 'production',
    required_inputs: requiredInputsFor(config).required,
    availability: availabilityOf(config),
    catalog_version: ORDER_CATALOG.version,
    created_by: null,
    created_at: EPOCH,
    updated_at: EPOCH
  }
}

/** Every report assessment, in the report's order. */
export const REPORT_ASSESSMENTS: ReadonlyArray<SavedCustomOrder> = REPORT_CARDS.filter((c) => CONFIGS[c.id]).map((c) =>
  asSavedOrder(c.id)
)
