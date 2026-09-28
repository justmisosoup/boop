import { entityTypeCode } from './attributes'
import type { BusinessRecord } from './deriveResults'
import type { GroupId } from './groups'
import { article, domesticOf, formationFilingOf } from './registrationStatus'
import { nameStandingOf } from './businessNames'
import { stateName } from './states'

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
 * Activity & Permission's. What is left here is the business name.
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

const task = (record: BusinessRecord, key: string) => record.reviewTasks.find((t) => t.key === key)?.subLabel ?? ''
const is = (record: BusinessRecord, key: string, re: RegExp) => re.test(task(record, key))

/**
 * The rows the Formation card carries, in the order it reads them: the lead
 * filing's standing; a linked or former domestic filing; the other filings
 * and their statuses; and what the entity type confirms. Whether it is
 * registered where its office is, and the office itself, are Activity &
 * Permission's — where the business operates. Filings only: the DBAs are the name's.
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
  'entity_type'
] as const

/**
 * The Registered entity part, when no state formation is on the record: what
 * the submitted name reads as instead (`nameStandingOf`) — a sole proprietor's
 * DBA, a DBA of a registered business, or nothing on file.
 */
const noFormationHeadline = (r: BusinessRecord): string => {
  const n = nameStandingOf(r)
  const owner = n.matchedDba?.owner
  if (n.matchedDba && owner) return `Submitted business name is a DBA of ${owner}`
  if (n.category === 'MATCHES_LEGAL_NAME') return 'Submitted business name matches registration'
  if (n.sole) return 'Submitted business name is a trade name'
  return 'No formation filing on record'
}

const noFormationNote = (r: BusinessRecord): string | undefined => {
  const n = nameStandingOf(r)
  const d = n.matchedDba
  const where = d?.city ? `${d.city}'s business registration` : `The ${d?.source ?? 'record'}`
  switch (n.category) {
    case 'DBA_OF_PERSON':
      return `${where} lists ${r.name} as what ${d?.owner ?? 'its owner'} does business as. With no state filing, that is the shape of a sole proprietorship.`
    case 'DBA_OF_REGISTERED_BUSINESS':
      return `${where} lists ${r.name} as a DBA of ${d?.owner}, whose ${stateName(n.ownerFiling?.state)} filing is on ${
        n.ownerLinked ? 'a linked record in this account' : 'this record'
      }.`
    case 'DBA_OF_UNREGISTERED_BUSINESS':
      return `${where} lists ${r.name} as a DBA of ${d?.owner}; no filing for ${d?.owner} is on record.`
    default:
      return n.sole ? `${r.name} isn't on any filing; the ${n.sole.city} city registration is in ${n.sole.person}'s name.` : undefined
  }
}

export const IDENTITY_SECTIONS: ReadonlyArray<IdentitySection> = [
  /* The business name: the name match against the registration, the name's
     suffix against the entity type, the website's name, and any DBAs. Standing
     and the filings are the Formation card's, above. */
  {
    label: 'Registered entity',
    groups: ['name', 'formation', 'tin', 'international_registration'],
    // The name the website shows is a name match, whatever the source: it sits
    // with the filing's name match, not with the website's other checks.
    insights: ['web_business_name_verification'],
    // The finding, short; the name and the registration it matched are the note.
    headline: (r) =>
      !r.formation
        ? noFormationHeadline(r)
        : is(r, 'name', /^verified$/i)
          ? 'Submitted business name matches registration'
          : is(r, 'name', /similar/i)
            ? 'Submitted business name closely matches registration'
            : "Submitted business name doesn't match registration",
    /* The detail under it: the name, and the registration it matched —
       "ANDYTOWN LLC matches against the Delaware domestic registration." The
       state is named because a record can carry more than one domestic
       registration (Andytown has California and Delaware). The entity type is
       said only where a check establishes it for the name — the name and
       entity type check (`name_and_entity_type`) verified; otherwise it is the
       Formation card's to state. */
    note: (r) => {
      if (!r.formation) return noFormationNote(r)
      const kind = is(r, 'name_and_entity_type', /^verified$/i) ? entityTypeCode(r) : undefined
      const noun = kind && /^[A-Z]{2,5}$/.test(kind) ? kind : kind?.toLowerCase()
      const as = noun ? ` as ${article(noun)} ${noun}` : ''
      // The filing it stands on now: Andytown's name is matched against its
      // Delaware registration, not the California one it converted out of.
      // With no domestic filing, the filing that was actually matched — never
      // an unconfirmed formation state (Sprig's is its California foreign one).
      const filing = domesticOf(r) ?? formationFilingOf(r) ?? r.registrations[0]
      if (!filing) return undefined
      const registration = `the ${stateName(filing.state)} ${
        /domestic/i.test(filing.jurisdiction ?? '') ? 'domestic ' : /foreign/i.test(filing.jurisdiction ?? '') ? 'foreign ' : ''
      }registration`
      const filed = filing?.name || r.name
      return is(r, 'name', /^verified$/i)
        ? `${r.name} matches against ${registration}${as}.`
        : is(r, 'name', /similar/i)
          ? `${r.name} is a close match to ${filed}, ${registration}${as}.`
          : `${r.name} does not match ${filed}, ${registration}${as}.`
    }
  },
]
