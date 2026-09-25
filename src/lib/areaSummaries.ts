import { entityTypeCode, money } from './attributes'
import type { BusinessRecord } from './deriveResults'
import { industrySectorOf } from './naics'
import { describeRegistration, isGoodStanding, registrationState } from './registrationStatus'
import { soleProprietorOf } from './soleProprietor'
import { stateName } from './states'
import { validHitCount, watchlistVerdicts } from './watchlist'

/**
 * What each area checks, for this business.
 *
 * Not a restatement of the insights under it — they carry the facts. One or
 * two plain sentences in an analyst's terms: what the area establishes, and
 * where the entity type or industry changes what to look for.
 */
/** States whose LLC and PLLC filings name no members or managers. */
const NAMES_NO_MEMBERS: ReadonlySet<string> = new Set(['NY'])

/** One area's finding: the clause on the card, and the sentences under it. */
export type AreaSummary = { headline: string; summary: string }

export const areaSummaries = (record: BusinessRecord, _useCase: string): Map<string, AreaSummary> => {
  const entity = entityTypeCode(record)
  const kind = entity ?? 'business'
  const upper = (entity ?? '').toUpperCase()
  const state = record.formation ? stateName(record.formation.state) : undefined
  const industry = industrySectorOf(record)
  const hits = validHitCount(record)
  const returned = watchlistVerdicts(record)
  const notMatches = returned.filter((v) => !v.valid)

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

  // A sole proprietorship has one owner: the person it is registered under.
  const sole = soleProprietorOf(record)
  const ownership = sole
    ? `A sole proprietorship has one owner, the person it is registered under; ${
        sole.tradeNameOnFile ? `${sole.city}'s business registration lists ${sole.person} as the owner` : `the ${sole.city} city registration is in ${sole.person}'s name`
      }. Confirm it on the customer certification.`
    : professional
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
  /* An active registration the state has annotated — pending inactive,
     not in good standing — is active on its way out, and is named with what
     the state said about it. */
  const troubled = record.registrations
    .filter((r) => {
      const st = registrationState(r)
      return st.status === 'Active' && st.subStatus && !isGoodStanding(st.subStatus)
    })
    .map((r) => `its ${stateName(r.state)} registration is ${describeRegistration(r).toLowerCase()}`)
  const where = active.length
    ? `Registered to operate in ${list(active)}${lapsed.length ? `; its ${list(lapsed)} registration${lapsed.length === 1 ? ' is' : 's are'} inactive` : ''}${
        troubled.length ? `; ${troubled.join('; ')}` : ''
      }.`
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

  /* A lien or a bankruptcy is a claim on money; a litigation is a case that
     may or may not become one, so it is named as what it is. */
  const claims = (record.liens ?? []).length + (record.bankruptcies ?? []).length
  const cases = (record.litigations ?? []).length
  /* What is owed, in the amounts the record states. A closed lien is paid or
     released; a case with no judgment has awarded nothing; a UCC filing secures
     a loan without saying how much. Counting all of them as money owed read
     Checkr's 5 liens and 10 lawsuits as "15", when one Florida lien is the only
     amount on the record. */
  const liens = record.liens ?? []
  const liveLiens = liens.filter((l) => (l.status ?? '').toLowerCase() !== 'closed')
  const lienAmounts = liveLiens
    .map((l) => l.liabilityCents ?? l.loanPrincipalCents)
    .filter((c): c is number => c != null && c > 0)
  const judgments = (record.litigations ?? [])
    .filter((c) => /defendant/i.test(c.partyType ?? ''))
    .flatMap((c) => c.judgments ?? [])
    .map((j) => j.amountCents)
    .filter((c): c is number => c != null && c > 0)
  const bankrupt = (record.bankruptcies ?? []).length
  const stated = [...lienAmounts, ...judgments].reduce((a, b) => a + b, 0)
  const live = liveLiens.length + bankrupt + judgments.length
  const unstated = liveLiens.length > lienAmounts.length || bankrupt > 0
  const plural = (n: number, one: string, many: string) => `${n === 1 ? 'one' : n} ${n === 1 ? one : many}`
  const standingHeadline =
    live > 0
      ? stated > 0
        ? `${money(stated)} stated owed, across ${plural(live, 'open claim', 'open claims')}`
        : `${plural(live, 'open claim', 'open claims')} on file, no amount stated`
      : cases > 0
        ? `${cases} litigation ${cases === 1 ? 'record' : 'records'} on file, no open liens or bankruptcies`
        : claims > 0
          ? 'Liens on file, all closed'
          : 'No liens, judgments or bankruptcies'
  const standingSummary = [
    live > 0
      ? `Liens, judgments and bankruptcies show money the ${kind} owes elsewhere, which can reach funds held in the account.`
      : '',
    liens.length === 0
      ? ''
      : liveLiens.length === 0
        ? `${liens.length === 1 ? 'Its one lien is' : `All ${liens.length} of its liens are`} closed.`
        : `${liveLiens.length} of its ${liens.length} liens ${liveLiens.length === 1 ? 'is' : 'are'} not closed${
            lienAmounts.length === 0
              ? `, and ${liveLiens.length === 1 ? 'it states no amount' : 'none states an amount'}`
              : lienAmounts.length < liveLiens.length
                ? `; ${lienAmounts.length === 1 ? 'one states' : `${lienAmounts.length} state`} an amount`
                : ''
          }.`,
    cases > 0
      ? `${cases} ${cases === 1 ? 'lawsuit names' : 'lawsuits name'} it, ${
          judgments.length > 0 ? `with ${money(judgments.reduce((a, b) => a + b, 0))} in judgments against it` : 'none with a money judgment against it'
        }.`
      : '',
    bankrupt > 0 ? `${bankrupt === 1 ? 'One bankruptcy is' : `${bankrupt} bankruptcies are`} on file.` : '',
    stated > 0
      ? `The amount stated on the record is ${money(stated)}${unstated ? '; the rest carries no figure' : ''}.`
      : live > 0
        ? 'No amount is stated anywhere on the record.'
        : ''
  ]
    .filter(Boolean)
    .join(' ')

  return new Map<string, AreaSummary>([
    /* No Identity entry. Its four findings — the registration, the domestic
       filing, the office, whether it resolves to one entity — each head their
       own part of the card (see identitySections), and one headline and
       paragraph over them ran all four together. The card is named for the
       area, and the parts say what they found. */
    [
      'skill-kyb-3',
      {
        headline: hits > 0 ? `${hits} watchlist ${hits === 1 ? 'hit' : 'hits'} to clear before opening` : 'No sanctions or watchlist hits',
        summary:
          hits > 0
            ? `A sanctions or watchlist hit blocks account opening until it is cleared. ${hits === 1 ? 'One hit' : `${hits} hits`} on the ${kind} or the individuals named on its filings ${hits === 1 ? 'is' : 'are'} unresolved.`
            : notMatches.length > 0
              ? `No valid sanctions or watchlist hits. The screen returned ${
                  notMatches.length === 1
                    ? `${notMatches[0].entityName}, who ${notMatches[0].reason}`
                    : `${notMatches.length} names, none of which matches the ${kind} or the individuals named on its filings`
                }, so it is not counted and nothing here stands in the way of opening the account.`
              : `No sanctions or watchlist hits on the ${kind} or the individuals named on its filings, so nothing here stands in the way of opening the account.`
      }
    ],
    [
      'skill-kyb-activity',
      {
        /* The NAICS sector name can run to a line on its own, so the states it
           is registered in stay in the sentences under the heading. */
        headline: industry ? `Operates in ${industry.toLowerCase()}` : "What the business does isn't on the record",
        summary: [what, where, permission].filter(Boolean).join(' ')
      }
    ],
    [
      'skill-1789767328449',
      {
        headline: sole
          ? `Likely owned by ${sole.person}, as a sole proprietor`
          : professional
            ? 'Owned by licensed practitioners'
            : 'Owners come from the customer certification',
        summary: ownership
      }
    ],
    [
      'skill-financial-standing',
      {
        headline: standingHeadline,
        summary:
          standingSummary ||
          `No liens, judgments or bankruptcies against the ${kind}, so there is no sign of claims that could reach funds in the account.`
      }
    ]
  ])
}
