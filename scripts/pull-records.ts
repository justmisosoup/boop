/**
 * Pulls REAL businesses from the Middesk API into the prototype.
 *
 * The key is read from prototype/.env.local (gitignored) and never leaves this
 * script — a build-time pull, so nothing is bundled into client code and no key
 * reaches the browser.
 *
 *   bun run pull                 # first page of the account
 *   bun run pull "apex"          # search by name
 *   bun run pull --id <uuid>     # one business
 *   bun run pull --limit 40      # more records
 *
 * Output: src/data/records.json, normalised into the shape src/lib/deriveResults
 * reads. The API's own field names are preserved in the normaliser below so the
 * mapping is auditable.
 */
const KEY = process.env.MIDDESK_API_KEY
const BASE = process.env.MIDDESK_API_URL ?? 'https://api.middesk.com/v1'

if (!KEY) {
  console.error('No MIDDESK_API_KEY. Put it in prototype/.env.local, then re-run.')
  process.exit(1)
}

const call = async (path: string) => {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${KEY}`, Accept: 'application/json' }
  })
  // Never echo the key or a response body that might contain one.
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} on ${path}`)
  return res.json()
}

type Any = Record<string, any>

/**
 * A source, whole.
 *
 * The API returns `{id, type, metadata}` per source and the metadata is where
 * the useful part lives — which state a tax permit is in, which plan year a
 * Form 5500 covers, a registration's file number and status. Flattening to
 * `x.type` threw all of it away, so five separate tax permits read as one
 * source called "sales_tax_permit".
 */
const sourceRefs = (raw: Any[] | undefined) =>
  (raw ?? [])
    .map((x: Any) =>
      typeof x === 'string'
        ? { id: x, type: x, metadata: {} }
        : { id: x.id ?? x.type, type: x.type, metadata: x.metadata ?? {} }
    )
    .filter((x) => Boolean(x.type))

const normalise = (b: Any) => ({
  id: b.id,
  name: b.name ?? b.names?.find((n: Any) => n.type === 'legal')?.name ?? 'Unnamed business',
  status: b.status ?? 'unknown',
  createdAt: b.created_at ?? null,
  formation: b.formation
    ? {
        date: b.formation.formation_date ?? b.formation.date ?? null,
        entityType: b.formation.entity_type ?? b.formation.entityType ?? 'UNKNOWN',
        state: b.formation.formation_state ?? b.formation.state ?? null
      }
    : null,
  // Names carry type (legal / dba) and `submitted`. Without them a DBA check has
  // no way to know whether a DBA was even submitted.
  names: (b.names ?? []).map((n: Any) => ({
    name: n.name,
    type: n.type ?? 'legal',
    submitted: n.submitted === true,
    // Types only, for the provenance labels that just need the kind.
    sources: sourceRefs(n.sources).map((x) => x.type),
    sourceRefs: sourceRefs(n.sources)
  })),
  addresses: (b.addresses ?? []).map((a: Any) => ({
    fullAddress: a.full_address ?? a.fullAddress ?? [a.address_line1, a.city, a.state].filter(Boolean).join(', '),
    state: a.state ?? null,
    labels: a.labels ?? [],
    // Per-address facts. `location_count` is the number the aggregate
    // `location_frequency` task bands, so counts can be stated per address
    // instead of read off a single band for the whole record.
    locationCount: typeof a.location_count === 'number' ? a.location_count : null,
    cmra: a.cmra === true,
    isRegisteredAgent: a.is_registered_agent === true,
    propertyType: a.property_type ?? null,
    // Geocoded by the API. Without them "is this address near the one the
    // customer gave us" can only be answered by reading the two strings.
    latitude: typeof a.latitude === 'number' ? a.latitude : null,
    longitude: typeof a.longitude === 'number' ? a.longitude : null,
    // USPS deliverability, per address. The review task states it once for the
    // record; the flag says which address it is actually about.
    deliverable: typeof a.deliverable === 'boolean' ? a.deliverable : null,
    submitted: a.submitted === true,
    // Types only, for the provenance labels that just need the kind.
    sources: sourceRefs(a.sources).map((x) => x.type),
    sourceRefs: sourceRefs(a.sources)
  })),
  people: (b.people ?? []).map((p: Any) => ({
    name: p.name ?? p.full_name ?? 'Unnamed person',
    titles: (p.titles ?? []).map((t: Any) => (typeof t === 'string' ? t : t.title)).filter(Boolean),
    // `submitted` separates who the customer gave us from who we found. Dropping
    // it made a found entity look like a submitted person.
    submitted: p.submitted === true,
    // Types only, for the provenance labels that just need the kind.
    sources: sourceRefs(p.sources).map((x) => x.type),
    sourceRefs: sourceRefs(p.sources)
  })),
  registrations: (b.registrations ?? []).map((r: Any) => ({
    name: r.name ?? '',
    state: r.state ?? '',
    // Every filing states its own entity type and agent. Dropping them left the
    // record-level formation object as the only source of entity type, which is
    // why one filing could show it and four could not.
    entityType: r.entity_type ?? null,
    registeredAgent:
      typeof r.registered_agent === 'string' ? r.registered_agent : (r.registered_agent?.name ?? null),
    status: r.status ?? 'unknown',
    subStatus: r.sub_status ?? null,
    // The registry's own words on the status, where it gives any. Delaware and
    // New Jersey never do, and never publish a status either.
    statusDetails: r.status_details ?? null,
    jurisdiction: r.jurisdiction ?? null,
    fileNumber: r.file_number ?? null,
    registrationDate: r.registration_date ?? null,
    // The registry the filing was read from — this is what the source chip
    // shows, links to, and previews on hover.
    sourceUrl: typeof r.source === 'string' ? r.source : null,
    // What this filing itself lists. Lets an address or an officer be attributed
    // to the filing it actually came from, instead of to "a registration".
    addresses: (r.addresses ?? []).map((a: Any) =>
      typeof a === 'string' ? a : (a.full_address ?? '')
    ),
    officers: (r.officers ?? []).map((o: Any) => (typeof o === 'string' ? o : (o.name ?? '')))
  })),
  tin: b.tin ?? null,
  // What the crawl actually found. Keeping only url/status/domain threw away
  // the scrape: the page title, the platform it runs on, who registered the
  // domain and until when, the pages that were read, and the contact details
  // lifted off them.
  website: b.website
    ? {
        id: b.website.id ?? null,
        url: b.website.url ?? null,
        // The customer gave us the URL; the crawl then reached it. Both facts.
        submitted: b.website.submitted === true,
        status: b.website.status ?? null,
        httpStatusCode: b.website.http_status_code ?? null,
        title: b.website.title ?? null,
        platform: b.website.platform ?? null,
        category: b.website.category ?? null,
        parked: b.website.parked === true,
        comingSoon: b.website.coming_soon === true,
        businessNameMatch: b.website.business_name_match === true,
        domain: b.website.domain?.domain ?? null,
        domainId: b.website.domain?.domain_id ?? null,
        domainCreated: b.website.domain?.creation_date ?? null,
        domainExpires: b.website.domain?.expiration_date ?? null,
        registrar: b.website.domain?.registrar?.name ?? null,
        pages: (b.website.pages ?? []).map((pg: Any) => ({
          url: pg.url ?? null,
          category: pg.category ?? null
        })),
        // Each contact carries its OWN provenance. Flattening to a list of
        // strings attributed every one of them to the website crawl, and
        // `hello@middesk.com` did not come from the website — it was read off
        // the Facebook profile.
        emails: (b.website.email_addresses ?? []).map((e: Any) => ({
          email: e.email,
          submitted: e.submitted === true,
          sources: sourceRefs(e.sources).map((x) => x.type),
          sourceRefs: sourceRefs(e.sources)
        })),
        phones: (b.website.phone_numbers ?? []).map((n: Any) => ({
          phone: n.phone_number ?? n.number,
          submitted: n.submitted === true,
          sources: sourceRefs(n.sources).map((x) => x.type),
          sourceRefs: sourceRefs(n.sources)
        }))
      }
    : null,
  // A profile's rating is the part a reviewer reads it for. Keeping only the
  // URL and status meant "Trustpilot profile is reachable" and said nothing
  // about 2.8 from 3 reviews.
  profiles: (b.profiles ?? []).map((p: Any) => ({
    url: p.url ?? null,
    type: p.type ?? null,
    status: p.status ?? null,
    submitted: p.submitted === true,
    rating: typeof p.rating === 'number' ? p.rating : null,
    ratingCount: typeof p.rating_count === 'number' ? p.rating_count : null,
    followers: typeof p.metadata?.followers === 'number' ? p.metadata.followers : null,
    categories: (p.metadata?.categories ?? [])
      .map((c: Any) => (typeof c === 'string' ? c : c?.name))
      .filter(Boolean)
  })),
  // The codes ARE the classification. A category carries NAICS, SIC and MCC
  // codes together — SIC is not a `classification_system` of its own, it rides
  // inside whichever category was assigned — so keeping only the name threw
  // away both the codes and the fact that SIC was classified at all.
  industry: (b.industry_classification?.categories ?? []).map((c: Any) => ({
    system: c.classification_system ?? null,
    name: c.name ?? null,
    naicsCodes: c.naics_codes ?? [],
    sicCodes: c.sic_codes ?? [],
    mccCodes: c.mcc_codes ?? [],
    sector: c.sector ?? null,
    score: typeof c.score === 'number' ? c.score : null,
    highRisk: c.high_risk === true
  })),
  // What was actually searched. A watchlist check that returns no hits is only
  // meaningful if you know which lists it ran against — the agencies and their
  // lists are on the record and were being dropped, leaving "no hits" resting
  // on nothing a reviewer could scope.
  watchlist: b.watchlist
    ? {
        hitCount: b.watchlist.hit_count ?? 0,
        lists: (b.watchlist.lists ?? []).map((l: Any) => ({
          agency: l.agency ?? null,
          agencyAbbr: l.agency_abbr ?? null,
          organization: l.organization ?? null,
          title: l.title ?? null,
          abbr: l.abbr ?? null,
          hits: (l.results ?? []).length,
          // Where the hit actually is, so a match can be opened rather than
          // taken on trust.
          results: (l.results ?? []).map((x: Any) => ({
            // The id is how a hit is tied to the name that matched it: the name
            // carries it in `sources`. Without it a hit is an orphan headline.
            id: x.id,
            entityName: x.entity_name ?? null,
            aliases: x.entity_aliases ?? [],
            url: x.agency_information_url ?? null
          }))
        }))
      }
    : null,

  // PEP returns matches, not a list of registers — an empty result means the
  // screen ran and found nobody.
  pep: b.politically_exposed_person_screening
    ? {
        results: (b.politically_exposed_person_screening.results ?? []).map((r: Any) => ({
          id: r.id,
          name: r.name ?? r.entity_name ?? null,
          url: r.url ?? r.source_url ?? null
        }))
      }
    : null,

  // Keyed by result id, because that is how a screening result is tied to the
  // person it matched: the person carries the result's id in their `sources`.
  // Flattening the items lost that link and left a pile of articles with no
  // indication of whose name pulled them in.
  adverseMedia: b.adverse_media_screening
    ? {
        results: (b.adverse_media_screening.results ?? []).map((r: Any) => ({
          id: r.id,
          matchScore: typeof r.match_score === 'number' ? r.match_score : null,
          items: (r.items ?? []).map((i: Any) => ({
            sourceName: i.source_name ?? null,
            title: i.title ?? null,
            url: i.url ?? null,
            // The confidence matters as much as the risk name: a "low"
            // organized-crime flag on a name collision is not the same claim as
            // a "high" one, and the names alone read identically.
            risks: (i.flags?.risks ?? []).map((x: Any) => ({
              name: x.name,
              confidence: x.confidence_level ?? null
            })),
            sentiment: (i.flags?.sentiments ?? [])[0]?.name ?? null
          }))
        }))
      }
    : null,

  /**
   * Court records, UCC and tax lien filings, bankruptcy petitions.
   *
   * The API returns all three in full on `GET /businesses/{id}` and this script
   * was dropping them, so the review task's one-line message ("10 related
   * litigations") was everything the prototype held. That made every one of
   * them unreadable: a count cannot say whether the business is plaintiff or
   * defendant, what a lien secures, or which court heard it — and the reports
   * were writing those up as data we did not have when we had never asked for
   * it.
   *
   * Each one names its own source: the court that heard the case, the state
   * office the lien is filed with. That is what puts them in the Sources tab
   * beside the registries rather than leaving them as assertions.
   */
  litigations: (b.litigations ?? []).map((l: Any) => ({
    id: l.id,
    caseName: l.case_name ?? null,
    caseNumber: l.case_number ?? null,
    caseStatus: l.case_status ?? null,
    caseType: l.case_type ?? null,
    filingDate: l.filing_date ?? null,
    // The court is the source. `jurisdiction_state` alone would merge nine
    // Georgia cases heard by one circuit court with anything else in Georgia.
    court: l.jurisdiction ?? null,
    courtState: l.jurisdiction_state ?? null,
    // Which side the business is on. "Related litigation" covers being sued
    // and suing, and the two are not the same finding.
    partyType: l.party_type ?? null,
    parties: (l.parties ?? []).map((x: Any) => ({ name: x.name, role: x.role ?? null })),
    // Docket entries carrying a money judgment. Most carry none — a judgment
    // line with a null amount is a filing, not a sum owed.
    judgments: (l.judgments ?? []).map((j: Any) => ({
      text: j.text ?? null,
      date: j.docket_entry_date ?? null,
      amountCents: typeof j.amount_cents === 'number' ? j.amount_cents : null
    }))
  })),

  liens: (b.liens ?? []).map((l: Any) => ({
    id: l.id,
    type: l.type ?? null,
    fileNumber: l.file_number ?? null,
    state: l.state ?? null,
    status: l.status ?? l.status_category ?? null,
    filingDate: l.filing_date ?? null,
    lapseDate: l.lapse_date ?? null,
    collateral: l.collateral ?? null,
    // What it secures, where the filing office states it. Null on most UCC-1s,
    // which is a fact about the filing rather than a gap in the pull.
    liabilityCents: typeof l.liability_cents === 'number' ? l.liability_cents : null,
    loanPrincipalCents:
      typeof l.loan_principal_amount_cents === 'number' ? l.loan_principal_amount_cents : null,
    // The filing office's own page for this lien.
    url: l.source ?? null,
    debtors: (l.debtors ?? []).map((x: Any) => ({ name: x.name, type: x.type ?? null })),
    securedParties: (l.secured_parties ?? []).map((x: Any) => ({
      name: x.name,
      type: x.type ?? null
    }))
  })),

  bankruptcies: (b.bankruptcies ?? []).map((x: Any) => ({
    id: x.id,
    caseNumber: x.case_number ?? null,
    chapter: x.chapter ?? null,
    status: x.status ?? null,
    filingDate: x.filing_date ?? null,
    court: x.court ?? x.jurisdiction ?? null,
    courtState: x.jurisdiction_state ?? null
  })),

  // The businesses connected to this one, strongest first. The review task
  // only says Found; `/connections` names them and says what is shared. Fetched
  // per business below and attached before normalising; absent when the
  // account is not entitled to it, which the record then carries as no field
  // rather than as an empty list.
  ...(Array.isArray(b.connections)
    ? {
        connections: b.connections.map((c: Any) => ({
          id: c.id,
          name: c.name,
          confidence: typeof c.confidence === 'number' ? c.confidence : null,
          connectedBusinessId: c.connected_business_id ?? null,
          people: (c.connecting_people ?? []).map((p: Any) => p.name ?? p).filter(Boolean),
          addresses: (c.connecting_addresses ?? []).map((a: Any) => ({
            fullAddress: a.full_address,
            labels: a.labels ?? [],
            sources: a.sources ?? []
          })),
          businesses: (c.connecting_businesses ?? []).map((x: Any) => x.name ?? x).filter(Boolean)
        }))
      }
    : {}),

  // The insight surface. `status` (success/warning/failure) is deliberately NOT
  // carried across: it is a judgement, and the assessment layer is where
  // judgement belongs (catalog/decompositions.md).
  reviewTasks: (b.review?.tasks ?? []).map((t: Any) => ({
    key: t.key,
    subLabel: t.sub_label ?? t.subLabel ?? '',
    // The source's own explanation. Better than anything inferred from the
    // sub-label alone, and it says what was actually compared.
    message: t.message ?? null,
    category: t.category ?? null
  }))
})

const args = process.argv.slice(2)
const limitArg = args.indexOf('--limit')
const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : 25

let summaries: Any[] = []

if (args[0] === '--id' && args[1]) {
  summaries = [{ id: args[1] }]
} else {
  const q = args[0] && !args[0].startsWith('--') ? `&q=${encodeURIComponent(args[0])}` : ''
  // Over-fetch a little so that records without review tasks can be dropped and
  // still leave `limit` of them.
  const page = await call(`/businesses?per_page=${Math.min(limit * 2, 100)}${q}`)
  summaries = page.data ?? page.businesses ?? []
}

// The list endpoint returns summaries; addresses, registrations and people come
// from the per-business endpoint.
const full: Any[] = []
for (const s of summaries) {
  try {
    const business = await call(`/businesses/${s.id}`)
    // Names behind the connections review task. A 403 means the account is not
    // entitled to it, not that there are none — leave the field off.
    try {
      const connections = await call(`/businesses/${s.id}/connections`)
      business.connections = connections.data ?? []
    } catch {
      /* not entitled, or no connections for this business */
    }
    full.push(business)
  } catch (e) {
    console.warn(`skipped ${s.id}: ${(e as Error).message}`)
  }
}

// Latest first, always. The account grows; the prototype should show what was
// added most recently rather than whatever the page happens to return.
const records = full
  .map(normalise)
  .filter((r) => r.reviewTasks.length > 0)
  .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
  .slice(0, limit)
await Bun.write('src/data/records.json', JSON.stringify(records, null, 2))

console.log(
  `pulled ${records.length} record(s) with ${records.reduce((n, r) => n + r.reviewTasks.length, 0)} review tasks → src/data/records.json`
)
