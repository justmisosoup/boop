import { entityTypeCode, money } from './attributes'
import type { BusinessRecord } from './deriveResults'
import { industrySectorOf } from './naics'
import { operationsOf } from './operations'
import { nameStandingOf } from './businessNames'
import { soleProprietorOf } from './soleProprietor'
import { stateName } from './states'
import { screeningOf, type Screening } from './screening'

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

/** What the screens found, and what they dismissed, counted. */
const screeningSummary = (s: Screening): string => {
  const people = s.subjects.filter((x) => x.key !== 'business').length
  const who = people > 0 ? `the business or the ${people === 1 ? 'person' : `${people} people`} submitted with it` : 'the business'
  const hitNames = [...new Set(s.findings.map((f) => f.against))]
  const named = hitNames.length <= 2 ? hitNames.join(' and ') : `${hitNames.length} names`
  const first =
    s.findings.length === 0
      ? `Nothing on ${who}.`
      : `${s.findings.length === 1 ? 'One hit' : `${s.findings.length} hits`} on ${named}.`
  const n = s.dismissed.length
  // Dismissed, counted; the table says on whom and why.
  const second =
    n === 0
      ? ''
      : ` ${n === 1 ? 'One' : String(n)} ${s.findings.length > 0 ? 'other ' : ''}${n === 1 ? 'result was' : 'results were'} dismissed.`
  return first + second
}

export const areaSummaries = (record: BusinessRecord, _useCase: string): Map<string, AreaSummary> => {
  const entity = entityTypeCode(record)
  const kind = entity ?? 'business'
  const upper = (entity ?? '').toUpperCase()
  const state = record.formation ? stateName(record.formation.state) : undefined
  const industry = industrySectorOf(record)
  const screened = screeningOf(record)

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
  // Members as the filings name them — their spelling, their role. Not the
  // record's people[], which folds a member and an agent whose names look
  // alike into one person.
  const members = [
    ...new Map(
      record.registrations
        .flatMap((r) => (r.officerRoles ?? []).filter((o) => o.roles.some((x) => /member/i.test(x))).map((o) => ({ ...o, state: r.state })))
        .map((o) => [o.name.toLowerCase(), o] as const)
    ).values()
  ]
  const list = (xs: string[]) => (xs.length < 3 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)
  const licences = record.licenses ?? []
  const licencePointer = licences.length
    ? `See the ${licences[0].registry ?? 'licence'} record for the practitioner's licence.`
    : "No licence record was found; confirm the practitioner is licensed."

  // A sole proprietorship has one owner: the person it is registered under.
  const sole = soleProprietorOf(record)
  /* Who was submitted and whether the filings name them, counted — as the
     screening card's sentence is. The rows under it name them and their roles. */
  const submitted = record.people.filter((p) => p.submitted && p.name && !ENTITY.test(p.name))
  const onFilings = submitted.filter((p) => (p.sources ?? []).includes('registration'))
  const submittedLine =
    submitted.length === 0
      ? 'No people submitted.'
      : submitted.length === 1
        ? `One person submitted, ${onFilings.length === 1 ? 'named on the state filing' : 'not named on the state filings'}.`
        : `${submitted.length} people submitted, ${
            onFilings.length === submitted.length
              ? `${submitted.length === 2 ? 'both' : 'all'} named on the state filings`
              : onFilings.length === 0
                ? 'none named on the state filings'
                : `${onFilings.length} named on the state filings`
          }.`
  // A sole proprietorship's owner is the person it is registered to; a
  // professional entity's needs a licence. Everything else is the count.
  const ownership = sole
    ? `${sole.city} registers it to ${sole.person}.`
    : professional
      ? `${submittedLine} ${licencePointer}`
      : submittedLine

  /* What the business does, where it does it, and whether it needs a licence
     to — the card's own reading (`operationsOf`), counted and named in the
     voice of the other cards. The headline names the classification, so the
     first clause says only what the Prohibited scheme made of it. */
  const ops = operationsOf(record)
  const article = (w: string) => (/^[aeiou]/i.test(w) ? 'an' : 'a')
  const what =
    ops.industry.prohibited === 'flagged'
      ? `Flagged as ${list([...new Set(ops.industry.flagged.map((c) => c.name).filter((n): n is string => !!n))])}.`
      : ops.industry.prohibited === 'clear'
        ? 'Not a prohibited industry.'
        : 'Prohibited status not assessed.'
  const office = ops.office ? stateName(ops.office.state) : undefined
  const where = !record.registrations.length
    ? 'No state registration shows where it operates.'
    : !office
      ? 'No office address submitted.'
      : ops.office?.verdict === 'active'
        ? `Registered and active in ${office}, the state of its office.`
        : ops.office?.verdict === 'inactive'
          ? `Its registration in ${office}, the state of its office, is inactive.`
          : ops.office?.verdict === 'not_registered'
            ? `Not registered in ${office}, the state of its office.`
            : ''
  const otherPlaces = ops.locations.filter((a) => !a.submitted).length
  const elsewhere = otherPlaces > 0 ? `${otherPlaces === 1 ? 'One other location' : `${otherPlaces} other locations`} on record.` : ''
  const lic = ops.licence
  const permission = !lic.required
    ? ''
    : lic.registry === 'none'
      ? `Requires ${article(lic.profession)} ${lic.profession} licence; no public register checked.`
      : lic.registry === 'FMCSA'
        ? lic.found.length > 0
          ? `Requires motor carrier authority; USDOT ${lic.found.map((f) => f.dotNumber).filter(Boolean).join(', ')} on record.`
          : 'Requires motor carrier authority; no FMCSA registration on record.'
        : lic.found.length > 0
          ? `Requires ${article(lic.profession)} ${lic.profession} licence; ${lic.found
              .map((x) => `${x.licenseState && x.licenseNumber ? `${x.licenseState} licence ${x.licenseNumber}` : `NPI ${x.number}`} found for ${titleCase(x.holder)}`)
              .join(', ')}.`
          : `Requires ${article(lic.profession)} ${lic.profession} licence; none found for the people submitted.`

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
  /* Counts, as the screening card's sentence is: what is open, what is
     closed, whether any of it states an amount. The cards under it name the
     filings. */
  const closedLiens = liens.length - liveLiens.length
  const taxLiens = liveLiens.filter((l) => /tax/i.test(l.type ?? '')).length
  const standingSummary = [
    liens.length === 0
      ? ''
      : liveLiens.length === 0
        ? `${liens.length === 1 ? 'One lien, closed' : `${liens.length} liens, all closed`}.`
        : `${liveLiens.length === 1 ? 'One open lien' : `${liveLiens.length} open liens`}${
            closedLiens > 0 ? ` and ${closedLiens} closed` : ''
          }; ${
            lienAmounts.length === 0
              ? liveLiens.length === 1
                ? 'it states no amount'
                : 'none states an amount'
              : `${money(lienAmounts.reduce((a, b) => a + b, 0))} stated`
          }${taxLiens === 0 ? (liveLiens.length === 1 ? ", and it isn't a tax lien" : ', and none is a tax lien') : ''}.`,
    cases > 0
      ? `${cases === 1 ? 'One lawsuit' : `${cases} lawsuits`}${
          judgments.length > 0 ? `, with ${money(judgments.reduce((a, b) => a + b, 0))} in judgments against it` : ', no money judgment'
        }.`
      : '',
    bankrupt > 0 ? `${bankrupt === 1 ? 'One bankruptcy' : `${bankrupt} bankruptcies`} on file.` : ''
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
        // A valid watchlist hit outranks the media; media matched outranks a
        // clean screen — the card is named for what it found.
        // What the screens found on the business and the submitted people
        // (`screeningOf`); what they returned on anyone else is dismissed.
        headline:
          screened.findings.length > 0
            ? `${screened.findings.length} screening ${screened.findings.length === 1 ? 'hit' : 'hits'} to review`
            : 'No compliance screening hits',
        /* Only what the headline and the rows do not already say. A clean
           screen needs no sentence: "No sanctions or watchlist hits" over
           "No watchlist hits were identified" was the same fact twice, and a
           summary saying it again made three. Names returned and ruled out are
           the evidence's to name; the card says only what they were. */
        // The outcome in two plain sentences; the table under it says who
        // and why, row by row.
        summary: screeningSummary(screened)
      }
    ],
    [
      'skill-kyb-activity',
      {
        /* The classification's name, as NAICS writes it. It can run to a line
           on its own, so the states it is registered in stay in the sentences
           under the heading. */
        headline: !industry
          ? "What the business does isn't on the record"
          : /^insufficient data$/i.test(industry)
            ? 'Industry classification returned insufficient data'
            : `Industry classified as ${industry}`,
        summary: [what, where, elsewhere, permission].filter(Boolean).join(' ')
      }
    ],
    [
      'skill-1789767328449',
      {
        headline: sole
          ? `Likely owned by ${sole.person}, as a sole proprietor`
          : professional
            ? 'Owned by licensed practitioners'
            : upper === 'LLC' && members.length > 0
              ? `${members.length === 1 ? 'Member' : 'Members'} named on the state filing`
              : 'Owners come from the customer certification',
        summary: ownership
      }
    ],
    [
      'skill-financial-standing',
      {
        headline: standingHeadline,
        summary:
          standingSummary || 'Nothing on file.'
      }
    ]
  ])
}
