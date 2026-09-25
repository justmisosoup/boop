import { entityTypeCode } from './attributes'
import type { BusinessRecord } from './deriveResults'
import type { GroupId } from './groups'
import { article, describeRegistration, domesticOf, formationFilingOf, isGoodStanding, registrationState, sameName } from './registrationStatus'
import { soleProprietorOf } from './soleProprietor'
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
 * Digital corroboration only appears when the record has web evidence: an
 * empty heading would say it was checked and came back empty.
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
 * What ties the office address to the business: the most authoritative record
 * it appears on, and how many more — "its California filing and several other
 * records". Listing every source read as a pile; the strongest one is the
 * claim, the rest is corroboration. Strongest first: the state filing, then
 * federal and state registrations, then local and incidental records.
 */
const SOURCE_WORDS: Array<[string, string]> = [
  ['sam_entity_extract', 'its SAM.gov registration'],
  ['sales_tax_permit', 'a state sales tax permit'],
  ['fmcsa_registration', 'its FMCSA motor-carrier registration'],
  ['npi_record', 'an NPI provider record'],
  ['parsed_sos_document', 'a Secretary of State document'],
  ['sec_filing', 'an SEC filing'],
  ['form_5500', 'a Form 5500 benefit-plan filing'],
  ['sba_entity_v2', 'an SBA record'],
  ['city_registration', 'a city business registration'],
  ['lien', 'a lien filing'],
  ['epa frs facility', 'an EPA facility record']
]
const evidenceFor = (address: BusinessRecord['addresses'][number] | undefined): string | undefined => {
  if (!address) return undefined
  const refs = address.sourceRefs ?? []
  const types = address.sources ?? []
  const filingStates = [
    ...new Set(refs.filter((x) => x.type === 'registration').map((x) => String(x.metadata?.state ?? '')).filter(Boolean))
  ]
  const hasFiling = types.includes('registration') || filingStates.length > 0
  const first = hasFiling
    ? filingStates.length === 1
      ? `its ${stateName(filingStates[0])} filing`
      : filingStates.length === 2
        ? `its ${stateName(filingStates[0])} and ${stateName(filingStates[1])} filings`
        : filingStates.length > 2
          ? 'its state filings'
          : 'its state filing'
    : SOURCE_WORDS.find(([t]) => types.includes(t))?.[1]
  if (!first) return undefined
  // Everything else it appears on, counted by kind of source.
  const kinds = new Set(types.filter((t) => t !== 'registration'))
  if (!hasFiling) kinds.delete(SOURCE_WORDS.find(([t]) => types.includes(t))![0])
  const more = kinds.size
  return more === 0 ? first : `${first} and ${more === 1 ? 'one other record' : 'several other records'}`
}

/** The office, read from its checks: deliverability, property type, and the
 *  registration's standing in the office's state. */
const office = (r: BusinessRecord) => {
  const address = r.addresses.find((a) => a.submitted && a.state)
  const code = address?.state ?? undefined
  const state = code ? stateName(code) : undefined
  const standing = is(r, 'sos_match', /submitted active/i)
    ? 'active'
    : is(r, 'sos_match', /inactive/i)
      ? 'inactive'
      : is(r, 'sos_match', /not registered/i)
        ? 'none'
        : undefined
  const deliverable = task(r, 'address_deliverability') ? is(r, 'address_deliverability', /^deliverable$/i) : undefined
  // Whether the address could be tied to the business at all — the first question.
  const verified = task(r, 'address_verification') ? is(r, 'address_verification', /^verified$/i) : undefined
  const kind = is(r, 'address_property_type', /commercial/i)
    ? 'commercial'
    : is(r, 'address_property_type', /residential/i)
      ? 'residential'
      : undefined
  return { state, standing, deliverable, verified, kind, evidence: evidenceFor(address) }
}

/** The checks that read the domestic filing's standing. */
const STANDING = ['sos_domestic', 'sos_domestic_sub_status']

export const IDENTITY_SECTIONS: ReadonlyArray<IdentitySection> = [
  /* What the entity is: the registration it was formed under, and nothing
     about its standing — that is the next part's. */
  {
    label: 'Registered entity',
    groups: ['name', 'formation', 'tin', 'international_registration'],
    // The finding, short; the name and the registration it matched are the note.
    headline: (r) =>
      !r.formation
        ? soleProprietorOf(r)
          ? soleProprietorOf(r)!.tradeNameOnFile
            ? 'Submitted business name matches the city registration'
            : 'Submitted business name is a trade name'
          : 'No formation filing on record'
        : is(r, 'name', /^verified$/i)
          ? 'Submitted business name matches registration'
          : is(r, 'name', /similar/i)
            ? 'Submitted business name closely matches registration'
            : "Submitted business name doesn't match registration",
    /* The detail under it: the name, and the registration it matched —
       "ANDYTOWN LLC matches against the Delaware domestic registration as an
       LLC." The state is named because a record can carry more than one
       domestic registration (Andytown has California and Delaware). */
    note: (r) => {
      if (!r.formation) {
        const sole = soleProprietorOf(r)
        return !sole
          ? undefined
          : sole.tradeNameOnFile
            ? `${sole.city}'s business registration lists ${r.name} as what ${sole.person} does business as.`
            : `${r.name} isn't on any filing; the ${sole.city} city registration is in ${sole.person}'s name.`
      }
      const kind = entityTypeCode(r)
      const noun = kind && /^[A-Z]{2,5}$/.test(kind) ? kind : kind?.toLowerCase()
      // No entity type on the filing: say which registration, not "as a business".
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
  /* Whether the filing it stands on is live: the domestic filing, where it is
     now, and the roll-up of every filing's status. Andytown was formed in
     California and files in Delaware now — a fact of its own, not a clause on
     the registration or on the address. */
  {
    label: 'Domestic filing',
    groups: ['registration'],
    insights: STANDING,
    headline: (r) => {
      const d = domesticOf(r)
      // A sole proprietorship is formed with no state; its absence is expected.
      if (!d) return soleProprietorOf(r) ? 'No state filing expected' : 'No domestic filing on record'
      const where = stateName(d.state)
      // The move is the finding; where it went is in the note.
      if (r.formation && d.state !== r.formation.state) return 'Domestic filing has changed states'
      const st = registrationState(d)
      if (!st.status) return st.silent ? `${where} doesn't publish filing status` : `No status reported for the ${where} filing`
      // The state is on the name card and in the note; the title is the standing.
      // A filing that is not active says only that — the note carries the
      // state's own words ("inactive — expired"), and saying them twice is noise.
      return st.status !== 'Active'
        ? `Domestic filing ${st.status.toLowerCase()}`
        : `Domestic filing ${describeRegistration(d).toLowerCase()}`
    },
    note: (r) => {
      const d = domesticOf(r)
      const formed = r.formation?.state
      const sole = !d ? soleProprietorOf(r) : undefined
      if (sole)
        return `A sole proprietorship isn't formed with a state. Its registration is with the City of ${sole.city}${
          sole.status ? `, ${sole.status}` : ''
        }, in ${sole.person}'s name.`
      if (!d) {
        // No domestic filing: the state it was formed in is not confirmed, and
        // the note says what is on file instead.
        const others = r.registrations
        return others.length === 0
          ? undefined
          : `No domestic filing is on record, so the state it was formed in isn't confirmed. ${
              others.length === 1
                ? `Its only filing is ${/foreign/i.test(others[0].jurisdiction ?? '') ? 'a foreign' : 'a'} registration in ${stateName(others[0].state)}.`
                : `It has ${others.length} other filings.`
            }`
      }
      /* A domestic filing that is not active leaves the question of whether
         anything still is. Sorenson's Utah filing expired; its one active
         filing is a foreign registration in Mississippi, in good standing. */
      const lapsed = registrationState(d).status && registrationState(d).status !== 'Active'
      const live = r.registrations.filter((x) => x !== d && (x.status ?? '').toLowerCase() === 'active')
      const standingOf = (x: (typeof live)[number]) => {
        const sub = registrationState(x).subStatus
        return sub && isGoodStanding(sub) ? ', in good standing' : sub ? `, ${sub.toLowerCase()}` : ''
      }
      const kindOf = (x: (typeof live)[number]) => (/foreign/i.test(x.jurisdiction ?? '') ? 'foreign' : 'domestic')
      // A filing under another name is another entity's, and is named as such.
      const under = (x: (typeof live)[number]) => (sameName(x.name, r.name) ? '' : `, under another name: ${x.name.replace(/\.$/, '')}`)
      const stillActive = !lapsed
        ? ''
        : live.length === 0
          ? r.registrations.length === 1
            ? 'It has no other filings.'
            : `None of its ${r.registrations.length} filings is active.`
          : live.length === 1
            ? `Its only active filing is a ${kindOf(live[0])} registration in ${stateName(live[0].state)}${standingOf(live[0])}${under(live[0])}.`
            : `${live.length} of its filings are active, all ${live.every((x) => kindOf(x) === 'foreign') ? 'foreign registrations' : 'elsewhere'}: ${live
                .slice(0, 4)
                .map((x) => stateName(x.state))
                .join(', ')}${live.length > 4 ? ` and ${live.length - 4} more` : ''}.`
      // The state and standing lead — the title says only that it is inactive.
      const lead = lapsed ? `${stateName(d.state)} domestic filing is ${describeRegistration(d).toLowerCase()}.` : ''
      if (!formed || d.state === formed) return [lead, stillActive].filter(Boolean).join(' ') || undefined
      /* The years tell the story: when it was formed, when the domestic filing
         moved, and how long it has been there. Years, not dates — the filings
         carry the dates. How long it has been ACTIVE there is only said when the
         state says it is active; Delaware publishes no status, so it is how
         long the filing has been there. */
      const st = registrationState(d)
      const was = stateName(formed)
      const now = stateName(d.state)
      const year = (iso?: string | null) => (iso && /^\d{4}/.test(iso) ? Number(iso.slice(0, 4)) : undefined)
      const since = (iso?: string | null) => {
        if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return undefined
        const [y, m, dd] = iso.slice(0, 10).split('-').map(Number)
        const t = new Date()
        return t.getFullYear() - y - (t.getMonth() + 1 < m || (t.getMonth() + 1 === m && t.getDate() < dd) ? 1 : 0)
      }
      const formedIn = year(r.formation?.date)
      const movedIn = year(d.registrationDate)
      const years = since(d.registrationDate)
      const converted = /convert/i.test(formationFilingOf(r)?.statusDetails ?? '')
      const active = st.status === 'Active'
      const there =
        years === undefined
          ? ''
          : years < 1
            ? ' less than a year ago'
            : active
              ? ` and has been active there for ${years} ${years === 1 ? 'year' : 'years'}`
              : ` and has been there for ${years} ${years === 1 ? 'year' : 'years'}`
      const standing = st.status
        ? active
          ? ''
          : ` It is ${describeRegistration(d).toLowerCase()} there.`
        : st.silent
          ? ` ${now} doesn't publish filing status.`
          : ''
      return [
        `Formed in ${was}${formedIn ? ` in ${formedIn}` : ''}${converted ? `; the ${was} filing converted out` : ''}.`,
        `Its domestic filing moved to ${now}${movedIn ? ` in ${movedIn}` : ''}${there}.${standing}`
      ].join(' ')
    }
  },
  /* Where it is: the office address, and whether the business is active in
     the office's state — a fact about the office, not the domestic filing. */
  {
    label: 'Office address',
    groups: ['address'],
    insights: ['sos_match'],
    // "The business is active in the state of the submitted office address" is
    // this card's title, so it is not also a row on it — unless the address
    // could not be verified, which takes the title instead.
    stated: (r) => (office(r).verified === false ? [] : ['sos_match']),
    /* The title is whether the business is active where its office is — the
       question this card answers, in the check's own terms, and the problem
       first when there is one. The subtext is the office itself in one
       sentence: "The submitted office address is a deliverable commercial
       address in California, where the business holds an active registration." */
    headline: (r) => {
      const o = office(r)
      // An address that could not be tied to the business is the finding,
      // before whether mail reaches it or the business is registered there.
      if (o.verified === false) return 'The submitted office address could not be verified'
      const state =
        o.standing === 'active'
          ? 'The business is active in the state of the submitted office address'
          : o.standing === 'inactive'
            ? 'The business is inactive in the state of the submitted office address'
            : o.standing === 'none'
              ? "The business isn't registered in the state of the submitted office address"
              : ''
      if (o.deliverable === false)
        return state && o.standing !== 'active' ? `${state}, which is undeliverable` : 'The submitted office address is undeliverable'
      return state || (o.deliverable ? 'The submitted office address is deliverable' : 'Submitted office address')
    },
    note: (r) => {
      const o = office(r)
      // When the title is about the address itself, the subtext says "It is".
      const aboutAddress = o.verified === false || (o.deliverable === false && (o.standing === 'active' || !o.standing))
      // An undeliverable address the title already names is not repeated.
      const titledUndeliverable = o.verified !== false && aboutAddress
      const words = [
        o.deliverable === undefined || titledUndeliverable ? '' : o.deliverable ? 'deliverable' : 'undeliverable',
        o.kind ?? ''
      ].filter(Boolean)
      const described = words.length ? `${/^[aeiu]/.test(words[0]) ? 'an' : 'a'} ${words.join(' ')} address` : 'an address'
      const holds =
        o.standing === 'active'
          ? 'holds an active registration'
          : o.standing === 'inactive'
            ? 'has an inactive registration'
            : o.standing === 'none'
              ? "isn't registered"
              : ''
      // Whether the address could be tied to the business, said every time.
      const verify =
        o.verified === false
          ? `We couldn't verify that the address belongs to the business${
              o.evidence ? `; it appears only on ${o.evidence}` : ': it appears on none of its filings or other records'
            }. `
          : ''
      // How: the records the address appears on.
      const verifiedTail = o.verified
        ? ` We verified the address belongs to the business${o.evidence ? `: it appears on ${o.evidence}` : ''}.`
        : ''
      if (!words.length && !holds) return `${verify}${verifiedTail.trim()}`.trim() || undefined
      const subject = aboutAddress ? 'It is' : 'The submitted office address is'
      const body = o.state
        ? `${subject} ${described} in ${o.state}${holds ? `, where the business ${holds}` : ''}.`
        : `${subject} ${described}${holds ? `, and the business ${holds} in its state` : ''}.`
      return `${verify}${body}${verifiedTail}`
    },
  },
  {
    label: 'Digital corroboration',
    groups: ['website', 'profiles', 'phone'],
    headline: (r) => {
      const confirmed = [
        ['web_business_name_verification', 'business name'],
        ['web_address_verification', 'office address'],
        ['web_person_verification', 'submitted person']
      ]
        .filter(([k]) => /verified|match/i.test(task(r, k)) && !/mismatch|unverified/i.test(task(r, k)))
        .map(([, l]) => l)
      return confirmed.length
        ? `Website confirms the ${confirmed.length < 3 ? confirmed.join(' and ') : `${confirmed.slice(0, -1).join(', ')} and ${confirmed.at(-1)}`}`
        : 'Website confirms none of the submitted details'
    }
  },
  {
    label: 'Resolves to one entity',
    groups: ['people', 'connections'],
    headline: (r) =>
      soleProprietorOf(r)
        ? soleProprietorOf(r)!.tradeNameOnFile
          ? 'Submitted person owns the city registration'
          : 'Submitted person is the name on the city registration'
        : !task(r, 'person_verification')
        ? 'Resolves to one entity'
        : is(r, 'person_verification', /^verified$/i)
          ? 'Submitted person is on the filings'
          : "Submitted person isn't on the filings",
    /* Who, as what, and on which filings — the detail the title stands on:
       "Michael McCrory (manager) and LAUREN CRABBE (chief executive officer,
       manager, registered agent) are named on its California filings." Agent
       companies are left out; they are not the people behind the business. */
    note: (r) => {
      const sole = soleProprietorOf(r)
      if (sole) {
        const who = r.people.find((p) => p.submitted)?.name ?? sole.person
        return sole.tradeNameOnFile
          ? `${sole.city}'s business registration${sole.account ? ` (account ${sole.account})` : ''} lists ${who} as its owner.`
          : `${who} is the name the ${sole.city} city registration is filed under, as a sole proprietor's would be.`
      }
      if (!task(r, 'person_verification')) return undefined
      const COMPANY = /\b(inc|llc|corp|corporation|company|co|ltd|lp|llp|pllc|services|agents?|global|association|bank)\b\.?/i
      const people = r.people.filter((p) => p.submitted && !COMPANY.test(p.name))
      const and = (xs: string[]) => (xs.length < 3 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)
      const name = (n: string) => n.replace(/\s+/g, ' ').trim()
      if (!is(r, 'person_verification', /^verified$/i))
        return people.length
          ? `${and(people.map((p) => name(p.name)))} ${people.length === 1 ? 'is' : 'are'} not named on its filings. Confirm this is the entity applying.`
          : 'Confirm this is the entity applying.'
      if (people.length === 0) return undefined
      // Filings name one role a dozen ways; the two that matter, said once.
      const ROLES: Array<[RegExp, string]> = [
        [/\bceo\b|chief executive/i, 'CEO'],
        [/(?<!vice )\bpresident\b/i, 'president'],
        [/vice president/i, 'vice president'],
        [/\bcfo\b|chief financial/i, 'CFO'],
        [/\bmanag/i, 'manager'],
        [/\bmember\b/i, 'member'],
        [/\bowner\b/i, 'owner'],
        [/\bdirector\b/i, 'director'],
        [/\bsecretary\b/i, 'secretary'],
        [/\btreasurer\b/i, 'treasurer'],
        [/registered agent/i, 'registered agent']
      ]
      const roles = (titles: string[]) =>
        ROLES.filter(([re]) => titles.some((t) => re.test(t)))
          .map(([, label]) => label)
          .slice(0, 2)
      const states = [
        ...new Set(
          people.flatMap((p) =>
            (p.sourceRefs ?? []).filter((x) => x.type === 'registration').map((x) => String(x.metadata?.state ?? ''))
          )
        )
      ].filter(Boolean)
      const where =
        states.length === 0 ? 'its filings' : states.length <= 3 ? `its ${and(states.map(stateName))} filings` : `its filings in ${states.length} states`
      const who = people.map((p) => {
        const rs = roles(p.titles)
        return `${name(p.name)}${rs.length ? ` (${rs.join(', ')})` : ''}`
      })
      return `${and(who)} ${people.length === 1 ? 'is' : 'are'} named on ${where}.`
    }
  }
]
