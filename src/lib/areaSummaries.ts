import { entityTypeCode } from './attributes'
import type { BusinessRecord } from './deriveResults'
import { industrySectorOf } from './naics'
import { stateName } from './states'

/**
 * What each area checks, for this business.
 *
 * Not a restatement of the insights under it — they carry the facts. One or
 * two plain sentences in an analyst's terms: what the area establishes, and
 * where the entity type or industry changes what to look for.
 */
/** States whose LLC and PLLC filings name no members or managers. */
const NAMES_NO_MEMBERS: ReadonlySet<string> = new Set(['NY'])

export const areaSummaries = (record: BusinessRecord, _useCase: string): Map<string, string> => {
  const entity = entityTypeCode(record)
  const kind = entity ?? 'business'
  const upper = (entity ?? '').toUpperCase()
  const state = record.formation ? stateName(record.formation.state) : undefined
  const industry = industrySectorOf(record)
  const hits = record.watchlist?.hitCount ?? 0
  const owed =
    (record.liens ?? []).length + (record.litigations ?? []).length + (record.bankruptcies ?? []).length

  // A professional entity is owned by licensed practitioners; the licence
  // record answers it, and is named rather than restated.
  const professional = upper === 'PLLC' || upper === 'PC' || upper === 'PA'
  /* People, not entities: a registered agent or the company itself named as
     service of process is not someone who can hold a licence. */
  const ENTITY = /\b(LLC|L\.L\.C|PLLC|INC|CORP|CORPORATION|COMPANY|CO\.|LTD|LP|LLP|SERVICES|TRUST|HOLDINGS)\b/i
  const titleCase = (n: string) => n.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
  // Named on a state filing — the ownership record — not submitted by the customer.
  const people = [
    ...new Set(
      record.people
        .filter((p) => p.name && !ENTITY.test(p.name) && (p.sources ?? []).includes('registration'))
        .map((p) => titleCase(p.name.trim()))
    )
  ]
  const list = (xs: string[]) => (xs.length < 3 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)
  const licences = record.licenses ?? []
  const licencePointer = licences.length
    ? `See the ${licences[0].registry ?? 'licence'} record for the practitioner's licence.`
    : 'No licence record was found; confirm the practitioner is licensed.'

  const ownership = professional
    ? `A ${entity} is typically owned by one or a few licensed practitioners who also run the practice.${
        people.length
          ? ` Check that ${list(people)} ${people.length === 1 ? 'holds' : 'hold'} the professional licence the practice requires.`
          : NAMES_NO_MEMBERS.has(record.formation?.state ?? '')
            ? ` ${state} filings name no members or managers, only an address for service of process, so no practitioner appearing on the state record is normal here.`
            : ' No individual is named on the state filing.'
      }`
    : upper === 'CORPORATION'
      ? 'A corporation is owned by shareholders, who are not named on its filings; officers are. Beneficial owners come from the customer certification, which is normal for this structure.'
      : upper === 'LLC'
        ? 'An LLC is owned by its members, who are rarely named on state filings. Beneficial owners come from the customer certification, which is normal for this structure.'
        : 'Owners are rarely named on public filings. Beneficial owners come from the customer certification.'

  /* Activity & Permission answers three things: what the business does,
     where it is registered to do it, and whether it needs a licence to. */
  const what = industry
    ? `Classified as ${industry}.`
    : 'We cannot confirm what the business does: no industry classification is on the record.'
  const active = [...new Set(record.registrations.filter((r) => /active/i.test(r.status ?? '') && !/inactive/i.test(r.status ?? '')).map((r) => stateName(r.state)))]
  const lapsed = [...new Set(record.registrations.filter((r) => /inactive/i.test(r.status ?? '')).map((r) => stateName(r.state)))].filter((st) => !active.includes(st))
  const where = active.length
    ? `Registered to operate in ${list(active)}${lapsed.length ? `; its ${list(lapsed)} registration${lapsed.length === 1 ? ' is' : 's are'} inactive` : ''}.`
    : record.registrations.length
      ? 'No active state registration confirms where it operates.'
      : 'No state registration shows where it operates.'
  const permission = professional
    ? `Operating as a ${entity} requires a professional licence. ${licencePointer}`
    : industry
      ? (record.industry ?? []).some((c) => c.highRisk)
        ? 'That classification is flagged as a high-risk industry.'
        : 'That classification is not a high-risk industry.'
      : ''

  /* The website, where there is one: what it corroborates of the submitted
     identity, and what it does not. Only the three identity details — name,
     office, people — and only when the site was online to be read. */
  const task = (key: string) => record.reviewTasks.find((t) => t.key === key)?.subLabel ?? ''
  const online = /online/i.test(task('website_status'))
  const WEB: Array<[string, string]> = [
    ['web_business_name_verification', 'business name'],
    ['web_address_verification', 'office address'],
    ['web_person_verification', 'submitted person']
  ]
  const confirmed = WEB.filter(([k]) => /verified|match/i.test(task(k)) && !/mismatch|unverified/i.test(task(k))).map(([, l]) => l)
  const outstanding = WEB.filter(([k]) => /mismatch|unverified/i.test(task(k))).map(([, l]) => l)
  const web = !online
    ? ''
    : [
        confirmed.length ? `The website confirms the ${list(confirmed)}.` : '',
        outstanding.length
          ? `It does not match the ${list(outstanding)}, which ${outstanding.length === 1 ? 'is' : 'are'} still to corroborate.`
          : ''
      ]
        .filter(Boolean)
        .join(' ')

  return new Map([
    [
      'skill-kyb-identification',
      [
        state
          ? `Confirms the applicant matches the ${kind} registered with the ${state} Secretary of State.`
          : 'Confirms the applicant against what the record holds. No formation filing was found.',
        web
      ]
        .filter(Boolean)
        .join(' ')
    ],
    [
      'skill-kyb-3',
      hits > 0
        ? `A sanctions or watchlist hit blocks account opening until it is cleared. ${hits === 1 ? 'One hit' : `${hits} hits`} on the ${kind} or the individuals named on its filings ${hits === 1 ? 'is' : 'are'} unresolved.`
        : `No sanctions or watchlist hits on the ${kind} or the individuals named on its filings, so nothing here stands in the way of opening the account.`
    ],
    ['skill-kyb-activity', [what, where, permission].filter(Boolean).join(' ')],
    ['skill-1789767328449', ownership],
    [
      'skill-financial-standing',
      owed > 0
        ? `Liens, judgments and bankruptcies show money the ${kind} owes elsewhere, which can reach funds held in the account. The record holds ${owed === 1 ? 'one' : owed}.`
        : `No liens, judgments or bankruptcies against the ${kind}, so there is no sign of claims that could reach funds in the account.`
    ]
  ])
}
