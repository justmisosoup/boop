import type { BusinessRecord } from './deriveResults'
import type { GroupId } from './groups'

/**
 * The Identity assessment's rows, by the question each one answers.
 *
 * The pillar asks one thing — is this a real business, and is it the one it
 * claims to be — and establishes it in four parts. A flat list of seventeen
 * checks left the reader to sort them into those parts; this sorts them.
 * Keyed by the Insights panel's own topics, so an insight's place here is its
 * place there.
 *
 * Each part is headed by what it found, not by its name: the groupings are
 * the model's, per business, and the heading is its finding. `label` is the
 * fallback when there is nothing to find it from.
 *
 * A part with no cited rows does not appear: an empty heading would say it
 * was checked and came back empty. The filings are the Formation card's
 * (`FORMATION_CARD_INSIGHTS`); the office, web and office-state checks are
 * Activity & Permission's, and the business name is the Formation card's too.
 */
export type IdentitySection = {
  label: string
  groups: ReadonlyArray<GroupId>
  /** Insight keys this part claims outright, whatever their topic. The
   *  domestic-filing checks are Formation-topic insights, but what they say is
   *  the filing's standing, not the entity's registration. */
  insights?: ReadonlyArray<string>
  /** Checks the headline itself states, for this record. They are the part's
   *  to score, but not shown as rows — the card's title already says them. */
  stated?: (record: BusinessRecord) => ReadonlyArray<string>
  headline: (record: BusinessRecord) => string
  /** One sentence under the headline — only when it says something the
   *  headline does not. */
  note?: (record: BusinessRecord) => string | undefined
}

/**
 * The rows the Formation card carries, in the order it reads them: the lead
 * filing's standing; a linked or former domestic filing; the other filings
 * and their statuses; and what the entity type confirms. Whether it is
 * registered where its office is, and the office itself, are Activity &
 * Permission's — where the business operates. Then the business name and its DBAs.
 * Shown whenever the record has them — they are the record's facts, like the
 * card's grid — and so never repeated in Identity.
 */
export const FORMATION_CARD_INSIGHTS = [
  'sos_domestic',
  'sos_domestic_sub_status',
  'linked_domestic',
  'former_formation',
  'sos_active',
  'sos_inactive',
  'sos_unknown',
  'sos_status',
  'sos_not_found',
  'entity_type',
  /* The business name, and what it is. The card's grid states the name with
     every source that carries it — the filings, a city registration, the
     website — so the checks that establish it are the card's rows too, not a
     card of their own: the name match, the name's suffix against the entity
     type, the website's name, the DBAs, and the IRS record for the name. */
  'name',
  'name_and_entity_type',
  'name_entity_type',
  'submitted_name',
  'trade_names',
  'submitted_name_dba',
  'dba_owner_filing',
  'dba_name',
  'web_business_name_verification',
  'tin'
] as const

/*
 * No parts. The business-name part — the name match, the website's name, the
 * DBAs — repeated what the Formation card's grid states with its sources, so
 * its checks are the card's rows (`FORMATION_CARD_INSIGHTS`) and the part is
 * gone. What the assessment cites beyond the card reads as one card.
 */
export const IDENTITY_SECTIONS: ReadonlyArray<IdentitySection> = []

/**
 * The rows the industry-and-locations card carries, from the record whatever
 * the report cited: what the business does, whether it is registered where
 * its office is, the office itself and what USPS says of it, how many
 * businesses share it, the website's address, and the licence its industry
 * requires. `address_risk` is a grade over these and is not a row.
 */
export const OPERATIONS_CARD_INSIGHTS = [
  'industry',
  'sos_match',
  'address_verification',
  'address_property_type',
  'address_deliverability',
  'address_cmra',
  'address_registered_agent',
  'location_frequency',
  'web_address_verification',
  'license',
  'license_person_match',
  'license_address_match'
] as const
