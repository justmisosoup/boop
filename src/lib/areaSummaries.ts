import { entityTypeCode, money } from './attributes'
import type { BusinessRecord } from './deriveResults'
import { industrySectorOf } from './naics'
import { operationsOf } from './operations'
import { relatedBusinessesOf } from './relatedBusinesses'
import { nameStandingOf } from './businessNames'
import { soleProprietorOf } from './soleProprietor'
import { stateName } from './states'
import { screenedOf, type Screened } from './screening'

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

/** What the screens returned, as the platform counts them: every hit a hit. */
const screeningSummary = (s: Screened): string => {
  const list = (xs: string[]) => (xs.length < 3 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)
  // Up to three names; beyond that the count, so Zendesk's eleven media
  // matches do not become the sentence.
  const names = (hits: Array<{ name: string }>) => {
    const all = [...new Set(hits.map((h) => h.name))]
    return all.length > 3 ? [`${all.length} names`] : all
  }
  const parts = [
    s.watchlist.hits.length > 0
      ? `${s.watchlist.hits.length === 1 ? 'One watchlist hit' : `${s.watchlist.hits.length} watchlist hits`} on ${list(names(s.watchlist.hits))}`
      : '',
    s.pep.hits.length > 0 ? `${s.pep.hits.length === 1 ? 'one PEP match' : `${s.pep.hits.length} PEP matches`} on ${list(names(s.pep.hits))}` : '',
    s.media.hits.length > 0 ? `adverse media on ${list(names(s.media.hits))}` : ''
  ].filter(Boolean)
  if (parts.length === 0) {
    const people = s.pep.names.length
    return `Nothing on the business or the ${people === 0 ? 'names' : people === 1 ? 'person' : `${people} people`} submitted with it.`
  }
  const sentence = parts.join('; ')
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`
}

export const areaSummaries = (record: BusinessRecord, _useCase: string): Map<string, AreaSummary> => {
  const entity = entityTypeCode(record)
  const kind = entity ?? 'business'
  const upper = (entity ?? '').toUpperCase()
  const state = record.formation ? stateName(record.formation.state) : undefined
  const industry = industrySectorOf(record)
  const screened = screenedOf(record)

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
  /* Officers the record names that the customer did not submit — a president
     on a Virginia SOS document, a manager on the filing — each with where the
     record holds them. A registered agent is the filing's contact, not an
     owner, and is left out. */
  const AGENT_TITLE = /registered agent|service of process|organizer/i
  const whereFound = (p: BusinessRecord['people'][number]) => {
    const refs = p.sourceRefs ?? []
    const filing = refs.find((r) => r.type === 'registration')
    const doc = refs.find((r) => r.type === 'parsed_sos_document')
    const m = ((filing ?? doc)?.metadata ?? {}) as { state?: string; filing_date?: string }
    const st = m.state ? stateName(m.state) : undefined
    if (filing) return `the ${st ? `${st} ` : ''}filing`
    if (doc) {
      const on = m.filing_date ? new Date(`${m.filing_date}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : undefined
      return `${st ? `a ${st} ` : 'a '}SOS document${on ? ` filed ${on}` : ''}`
    }
    return undefined
  }
  // A filing's own words parsed as a name ("WITHDRAWN", "VACANT") are not people.
  const NOT_A_NAME = /^(withdrawn|dissolved|vacant|none|resigned|deceased|unknown|not yet elected)$/i
  // "CEO" stays capitals; "OTHER" says nothing and reads as officer.
  const titleWord = (t: string) => (/^(ceo|cfo|coo|cto|cmo)$/i.test(t.trim()) ? t.trim().toUpperCase() : /^other$/i.test(t.trim()) ? 'officer' : t.trim().toLowerCase())
  const foundOfficers = record.people
    .filter((p) => !p.submitted && p.name && !ENTITY.test(p.name) && !NOT_A_NAME.test(p.name.trim()) && p.titles.some((t) => !AGENT_TITLE.test(t)) && whereFound(p))
    .map((p) => ({ name: p.name.replace(/\s+/g, ' ').trim(), title: titleWord(p.titles.find((t) => !AGENT_TITLE.test(t)) ?? ''), where: whereFound(p)! }))
  /* One named with where it is held; two or three named with their titles;
     more than that counted — a board of fourteen directors is a number, not
     a sentence. */
  const foundLine =
    foundOfficers.length === 0
      ? ''
      : foundOfficers.length === 1
        ? `${foundOfficers[0].name} is named as ${foundOfficers[0].title} on ${foundOfficers[0].where} but was not submitted.`
        : foundOfficers.length <= 3
          ? `${list(foundOfficers.map((o) => `${o.name} (${o.title})`))} are named on the record but were not submitted.`
          : `${foundOfficers.length} officers named on the record were not submitted.`

  /* The businesses related to this one — people or more than an address in
     common — and, when there are none, the connections that were only
     neighbours, so "No related businesses" does not read against the
     provider's "3 connections found" below it. */
  const related = relatedBusinessesOf(record).length
  const neighbours = (record.connections ?? []).length - related
  const relatedLine = !record.connections
    ? ''
    : related > 0
      ? `${related === 1 ? 'One related business' : `${related} related businesses`} found.`
      : neighbours > 0
        ? `No related businesses; ${neighbours === 1 ? 'the one connection shares' : `the ${neighbours} connections share`} only an address.`
        : 'No related businesses found.'

  const ownership = [
    sole ? `${sole.city} registers it to ${sole.person}.` : professional ? `${submittedLine} ${licencePointer}` : submittedLine,
    foundLine,
    relatedLine
  ]
    .filter(Boolean)
    .join(' ')

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
  /* A state licence is part of what the business does, and it places the
     business too: JC Swimming has no state registration, but its active
     California construction licence is at the submitted office. */
  const atOffice = (l: (typeof ops.stateLicences)[number]) =>
    l.addresses.some((a) => record.addresses.some((x) => x.submitted && x.fullAddress === a))
  const licensed = ops.stateLicences.map(
    (l) =>
      `${l.status ? `${article(l.status)} ${l.status.toLowerCase()}` : 'a'} ${[l.state && stateName(l.state), l.type, 'licence']
        .filter(Boolean)
        .join(' ')}${atOffice(l) ? ' at its office' : ''}`
  )
  const stateLicensed = licensed.length > 0 ? `Holds ${list(licensed)}.` : ''
  const where = !record.registrations.length
    ? stateLicensed
      ? ''
      : 'No state registration shows where it operates.'
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
          ? (() => {
              // Whether the FMCSA registration lists the address the customer
              // submitted — street line and ZIP, so a floor or a ZIP+4 still matches.
              const key = (a: string) => `${(a.split(',')[0] ?? '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()}|${(a.match(/\b(\d{5})(?:-\d{4})?\b/) ?? [])[1] ?? ''}`
              const submitted = new Set(record.addresses.filter((a) => a.submitted).map((a) => key(a.fullAddress)))
              const at = lic.found.some((f) => f.addresses.some((a) => submitted.has(key(a))))
              const dots = lic.found.map((f) => f.dotNumber).filter(Boolean).join(', ')
              return submitted.size === 0
                ? `Requires motor carrier authority; USDOT ${dots} on record.`
                : at
                  ? `Requires motor carrier authority; USDOT ${dots} on record, listing the submitted address.`
                  : `Requires motor carrier authority; USDOT ${dots} on record, at an address other than the submitted one.`
            })()
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
      ? `${cases === 1 ? 'One litigation case' : `${cases} litigation cases`}${
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
        // Counted as the platform counts: every result a screen returned.
        headline: (() => {
          const n = screened.watchlist.hits.length + screened.pep.hits.length + screened.media.hits.length
          return n > 0 ? `${n} screening ${n === 1 ? 'hit' : 'hits'} to review` : 'No compliance screening hits'
        })(),
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
        summary: [what, stateLicensed, where, elsewhere, permission].filter(Boolean).join(' ')
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
              : foundOfficers.length > 0
                ? `${foundOfficers.length === 1 ? 'One officer' : `${foundOfficers.length} officers`} found, not submitted`
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
