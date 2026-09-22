import type { BusinessRecord, Derived } from './deriveResults'

/**
 * A weighted reading of how well a business's identity stands up.
 *
 * NOTHING IN THE RECORD IS A SCORE. There is no weight, no composite risk
 * index, no number on an insight — `deriveResults` carries `state` and nothing
 * else, and it discards the two graded composites the API does ship on the
 * grounds that "a grade over facts that are themselves insights is not an
 * insight". Every number below is invented here.
 *
 * So the defence is not that the number is true. It is that every input is a
 * named field, every weight is a constant in this file, and every point lost is
 * printed beside the fact that lost it. A reviewer who disagrees can point at a
 * row on the card and say which clause is wrong. That is the whole design.
 *
 * Four rules do the real work:
 *
 * - A `no_result` whose reason is `not_published` or `not_required` neither
 *   penalises nor credits. "New York does not publish sub-status" is a fact
 *   about New York, not about this business.
 * - Where the provider grades an outcome, the model reads the GRADE, not the
 *   raw material under it. An adverse-media match at 0.9994 whose review task
 *   says "Low risk" is scored low risk — a score that contradicts the check
 *   printed above it on the same page is worse than one that is slightly wrong.
 * - A component with nothing to read drops out and the rest renormalise, except
 *   `registered_standing`: "we could not check whether this entity exists, so
 *   we scored what we could" is backwards.
 * - Serious findings CAP the score rather than deducting from it. A weighted
 *   sum turns an OFAC hit into rounding error.
 */

export type BandId = 'established' | 'conditions' | 'not_established'

export type ScoreBand = {
  id: BandId
  label: string
  /** As the legend prints it: '0–49', '50–89', '90+'. */
  range: string
  tone: 'success' | 'warning' | 'danger'
  from: number
}

/** What the report was laid out in: one assessment, and the insights it cited.
 *  Built from the sections themselves — see `RecordPage`. */
export type ScoreArea = { id: string; name: string; insightIds: string[] }

export type ScoreComponent = {
  /** The assessment's id, which is also its anchor in the report. */
  id: string
  label: string
  /** The declared weight, before absent components are reweighted away. */
  weight: number
  /** The weight actually applied. 0 when the component had nothing to read. */
  appliedWeight: number
  /** 0–100, or null when there was nothing to read. */
  subScore: number | null
  /** One clause per test, in the order tested — the arguable part. */
  reasons: string[]
  /** Named inputs that could not be evaluated, so the card can say which. */
  missing: string[]
  /** The insights behind it. Primary group first: the cell jumps to that one. */
  insightIds: string[]
}

export type ScoreCeiling = { id: string; at: number; because: string }

export type IdentityScore = {
  /** 0–100, after reweighting and after any ceiling. The number in the ring. */
  value: number
  /** Before any ceiling, so the card can show what was cut and by what. */
  weighted: number
  band: ScoreBand
  components: ScoreComponent[]
  /** Applied ceilings, lowest first. Empty on an uncapped score. */
  ceilings: ScoreCeiling[]
  /** Declared weight that was evaluable, 0–100. Printed on the card. */
  coverage: number
  /** Distinct insights read as a point against the identity — counted once
   *  across the report, not once per assessment that cited them. */
  findings: number
}

/**
 * Bands as the decision they lead to.
 *
 * They were phrased as readings of the evidence — "Not established",
 * "Established with conditions" — which described the record and left the
 * reader to work out what to do about it. A reviewer at this point in the page
 * is deciding, and the band is the only thing on the card that can say which
 * way the number points: reject it, look at it, open it.
 *
 * The ids keep the old vocabulary. They are how components and ceilings are
 * keyed, and nothing about the arithmetic changed.
 */
export const BANDS: readonly ScoreBand[] = [
  { id: 'not_established', label: 'Reject', range: '0–49', tone: 'danger', from: 0 },
  { id: 'conditions', label: 'Review', range: '50–89', tone: 'warning', from: 50 },
  { id: 'established', label: 'Approve', range: '90+', tone: 'success', from: 90 }
]

const bandFor = (value: number) =>
  [...BANDS].reverse().find((b) => value >= b.from) ?? BANDS[0]

const task = (record: BusinessRecord, key: string) =>
  record.reviewTasks.find((t) => t.key === key)

const sub = (record: BusinessRecord, key: string) => task(record, key)?.subLabel ?? null

const clamp = (n: number) => Math.max(0, Math.min(100, n))

/**
 * Insight ids in a group, for the jump off a component's cell.
 *
 * Grouped the way the Insights tab groups them — `makeGroupFor`, not the raw
 * `group` the catalog put on the insight — or the jump would highlight rows
 * filed somewhere else and scroll to a heading that does not hold them.
 */
/**
 * Whether an insight is a point FOR the identity or against it.
 *
 * This is the whole judgement, and it is a table rather than a rule because a
 * rule got it wrong: counting an insight as established whenever the record
 * "returned a result" scored `Unable to identify a match to the submitted
 * person` and `We identified a name we believe is different from the submitted
 * business name` as clear, and put a 100 over a report whose own prose says
 * neither could be resolved. A check returning something is not the same as a
 * check coming back well.
 *
 * So each key says which way it reads by KYB standards, off the record's own
 * field where the record carries one:
 *
 * - `positive` — it establishes something about who this business is.
 * - `negative` — a reviewer has to do something about it before the account
 *   opens. A mismatch, an unresolvable person, an unexplained connection.
 * - `neutral` — neither. Provenance ("the URL was submitted"), a fact about a
 *   registry rather than the business ("New York does not publish sub-status"),
 *   and a reading that is only context ("one address in the moderate band").
 *   These are shown and not counted.
 *
 * An insight with no entry falls back to the record's own state: a no result is
 * not established, `should_exist_not_found` is adverse, anything else stands.
 */
type Polarity = 'positive' | 'negative' | 'neutral'

const POLARITY: Record<string, (r: Derived, record: BusinessRecord) => Polarity> = {
  // Identity: does a source of record agree with what was submitted?
  // `Verified` and `Similar Match` both stand; anything else is a name nobody
  // matched to a filing.
  name: (_r, record) => {
    const verdict = (sub(record, 'name') ?? '').toLowerCase()
    return verdict.startsWith('verified') || verdict.startsWith('similar') ? 'positive' : 'negative'
  },
  sos_active: (r) => (r.state === 'result' ? 'positive' : 'negative'),
  sos_match: (r) => (r.state === 'result' ? 'positive' : 'negative'),
  sos_domestic: (r) => (r.state === 'result' ? 'positive' : 'negative'),
  // The IRS holding the number is the point; holding it against a DIFFERENT
  // name is the finding, and the record carries that as its own flag.
  tin: (_r, record) =>
    (record.tin as { mismatch?: boolean } | null)?.mismatch ? 'negative' : 'positive',
  entity_type: () => 'positive',
  sos_domestic_sub_status: () => 'neutral',

  // The office. Deliverable and commercial are points for it; a residential
  // suite is not a finding on its own, and the frequency bands are context
  // until the address is shared with a hundred businesses.
  address_deliverability: (r) => (r.state === 'result' ? 'positive' : 'negative'),
  address_property_type: (_r, record) =>
    record.addresses.some((a) => a.submitted && a.propertyType === 'Commercial')
      ? 'positive'
      : 'neutral',
  address_registered_agent: () => 'neutral',
  location_frequency: (r) => (r.insightId.endsWith(':high') ? 'negative' : 'neutral'),

  // The web presence. Discovery says who supplied the URL, which is provenance;
  // what the site then says about the business is the finding.
  website_url_discovery: () => 'neutral',
  profile_discovery: () => 'neutral',
  website_status: (r) => (r.state === 'result' ? 'positive' : 'negative'),
  profile_status: (r) => (r.state === 'result' ? 'positive' : 'negative'),
  website_url_domain_ownership: (r) => (r.state === 'result' ? 'positive' : 'neutral'),
  web_address_verification: (r) => (r.state === 'result' ? 'positive' : 'negative'),
  web_email_address_verification: (r) => (r.state === 'result' ? 'positive' : 'negative'),
  web_phone_number_verification: (r) => (r.state === 'result' ? 'positive' : 'negative'),
  // The check's own verdict, not the fact that it ran. `business_name_match` is
  // null on this record even where the task says `Mismatch`, so the flag cannot
  // be the reading: a site presenting a different name from the application is
  // a name to reconcile, and `Similar Match` is not a mismatch.
  web_business_name_verification: (_r, record) =>
    (sub(record, 'web_business_name_verification') ?? '').toLowerCase().startsWith('mismatch')
      ? 'negative'
      : 'positive',

  // People. A submitted person nobody can match to a filing or to the site is
  // the gap a CIP file cannot close by itself.
  // `Unverified` is a result in the data and a gap in substance: the record
  // returned an answer, and the answer is that nobody could be matched.
  person_verification: (_r, record) =>
    (sub(record, 'person_verification') ?? '').toLowerCase().startsWith('verified')
      ? 'positive'
      : 'negative',
  web_person_verification: (r) => (r.state === 'result' ? 'positive' : 'negative'),
  // Connections are found, not cleared. Two businesses sharing this one's
  // addresses is a question about who is behind them.
  // No record field holds these — the check's own reading is the only account
  // of them, so it is what is read: `Found` is a question about who is behind
  // them, `Not Found` is a point for the file.
  business_connections: (_r, record) =>
    (sub(record, 'business_connections') ?? '').toLowerCase().startsWith('found')
      ? 'negative'
      : 'positive',

  // Screening. The absence of a hit is the point; a hit is the finding, and the
  // ceilings below carry the serious ones.
  watchlist: (_r, record) => ((record.watchlist?.hitCount ?? 0) > 0 ? 'negative' : 'positive'),
  politically_exposed_persons: (_r, record) =>
    (record.pep?.results ?? []).length > 0 ? 'negative' : 'positive',
  adverse_media: (_r, record) => {
    const grade = (sub(record, 'adverse_media') ?? '').toLowerCase()
    return grade.startsWith('high') || grade.startsWith('moderate') ? 'negative' : 'positive'
  },
  industry: (_r, record) =>
    (record.industry ?? []).some((i) => i.highRisk) ? 'negative' : 'positive',
  risky_keywords: (r) => (r.state === 'result' ? 'positive' : 'positive'),

  // Encumbrance. Nothing found is the point.
  liens: (r) => (r.reason === 'should_exist_not_found' ? 'negative' : 'positive'),
  litigations: (r) => (r.reason === 'should_exist_not_found' ? 'negative' : 'positive'),
  bankruptcies: (_r, record) => ((record.bankruptcies ?? []).length > 0 ? 'negative' : 'positive')
}

/** The catalog keys a per-band insight as `location_frequency:moderate`. */
const keyOf = (insightId: string) => insightId.split(':')[0]

const polarityOf = (r: Derived, record: BusinessRecord): Polarity => {
  const read = POLARITY[keyOf(r.insightId)]
  if (read) return read(r, record)
  // No entry: the record's own state, which is the weakest reading available
  // and the reason the table above exists.
  if (r.reason === 'should_exist_not_found') return 'negative'
  if (NEUTRAL.has(r.reason ?? '')) return 'neutral'
  return r.state === 'result' ? 'positive' : 'negative'
}

/**
 * What one finding costs a clean assessment.
 *
 * Four points: a file with three things to resolve sits at 91 and passes, a
 * file with six sits at 76 and gets read, a file with thirteen fails. The
 * serious findings do not travel through this number at all — they cap it, in
 * `ceilingsFor`, because a weighted arithmetic turns an OFAC hit into rounding.
 */
const FINDING_COST = 4

/** Neither penalises nor credits: a fact about the registry, not the business. */
const NEUTRAL: ReadonlySet<string> = new Set(['not_published', 'not_required'])

/**
 * One assessment's score, from the insights that assessment cited.
 *
 * The card used to break the number into five buckets of this file's own
 * invention — `Registered standing`, `Operating footprint` — beside a report
 * laid out in the customer's assessments. Two vocabularies for one record, and
 * the reader carried the mapping between them. The cells are the assessments
 * themselves now, scored on what each one actually rested on: its paragraphs'
 * citations and its gaps'.
 *
 * Every assessment carries the same weight. Nothing in the record ranks one
 * above another, and inventing a ranking here would be the kind of unstated
 * judgement the rest of this file refuses to make.
 */
const scoreArea = (
  area: ScoreArea,
  byId: Map<string, Derived>,
  record: BusinessRecord,
  weight: number
): ScoreComponent => {
  const cited = area.insightIds
    .map((id) => byId.get(id))
    .filter((r): r is Derived => Boolean(r) && !r.notReported)

  const read = cited.map((r) => ({ r, polarity: polarityOf(r, record) }))
  const positive = read.filter((x) => x.polarity === 'positive')
  const negative = read.filter((x) => x.polarity === 'negative')
  const neutral = read.filter((x) => x.polarity === 'neutral')
  const counted = positive.length + negative.length

  /*
   * Three counts, and nothing else.
   *
   * The cell used to name every finding, which put the same three statements in
   * all four cells — they are cited by all four assessments — and made the card
   * a second copy of the report under it. The findings are marked where they
   * are argued: the rows the score read as negative carry the mark in the
   * assessment itself, so the cell counts and the section shows.
   */
  const reasons = [
    `${positive.length} positive`,
    `${negative.length} negative`,
    `${neutral.length} unknown`
  ]

  return {
    id: area.id,
    label: area.name,
    weight,
    appliedWeight: 0,
    /*
     * A clean assessment is 100, and each finding costs `FINDING_COST`.
     *
     * It was the SHARE of an assessment's checks that came back positive, which
     * is the wrong shape twice over. A small assessment was punished for being
     * small — two findings in a five-check screening read as 60, beside the
     * same two findings in a sixteen-check identity reading as 81 — and the
     * three findings on this record are cited by every assessment, so each one
     * was charged four times and a file with three things to resolve came out
     * at 73. A reviewer looking at thirty-two clean checks and three open ones
     * does not read that as a third of a business.
     *
     * The deduction says what a reviewer actually counts: the number of things
     * they have to go and do. Nothing is invented beyond the one constant, and
     * each finding is printed by name in the cell it cost.
     */
    subScore: counted === 0 ? null : clamp(100 - FINDING_COST * negative.length),
    reasons,
    missing: counted === 0 ? ['nothing this assessment cited could be read'] : [],
    insightIds: cited.map((r) => r.insightId)
  }
}

/**
 * Findings that cap the score instead of deducting from it.
 *
 * A weighted sum turns the most serious thing on a record into rounding: an
 * adverse-media match against the submitted person costs less than a point at
 * 15% weight. These say "whatever the arithmetic, not above this".
 *
 * The 49s are things the record states unambiguously in its own fields. A
 * watchlist hit caps at 69 rather than 49 because a fuzzy name match is an
 * unresolved question, not a disqualification, and nothing on the record says
 * whether a reviewer has already dispositioned it.
 */
const ceilingsFor = (record: BusinessRecord): ScoreCeiling[] => {
  const out: ScoreCeiling[] = []
  const domestic =
    record.registrations.find((r) => r.jurisdiction === 'DOMESTIC') ??
    record.registrations.find((r) => r.state === record.formation?.state)
  const status = (domestic?.status || '').toLowerCase()
  const tin = record.tin as { mismatch?: boolean } | null

  if (record.registrations.length === 0 && !record.formation)
    out.push({ id: 'no_filing', at: 49, because: 'no filing on the record' })
  else if (domestic && status && status !== 'active' && status !== 'unknown')
    out.push({ id: 'filing_not_active', at: 49, because: `the domestic filing is ${status}` })

  if (tin?.mismatch) out.push({ id: 'tin_mismatch', at: 49, because: 'the TIN does not match the name' })
  if ((record.watchlist?.hitCount ?? 0) > 0)
    out.push({ id: 'watchlist_hit', at: 69, because: 'an unresolved watchlist hit' })
  if ((record.bankruptcies ?? []).length > 0)
    out.push({ id: 'bankruptcy', at: 69, because: 'a bankruptcy on the record' })
  if (sub(record, 'liens') === 'High Risk Liens')
    out.push({ id: 'liens_high_risk', at: 79, because: 'high-risk liens' })
  /*
   * The provider's grade, not the raw match score under it.
   *
   * This read `matchScore >= 0.9` and capped on it, which is the exact error
   * rule two of this file's header forbids: a 0.9994 string match that the
   * provider's own review task grades `Low risk` was capping a score whose
   * screening component, four lines above on the same card, printed "Adverse
   * media graded low risk". A card that contradicts itself is worse than one
   * that is slightly wrong. A match the provider has not graded, or has graded
   * moderate or high, still caps — that is a finding nobody has dispositioned.
   */
  const mediaGrade = (sub(record, 'adverse_media') ?? '').toLowerCase()
  const mediaGradedLow = mediaGrade.startsWith('low') || mediaGrade.startsWith('no result')
  if (
    !mediaGradedLow &&
    (record.adverseMedia?.results ?? []).some((r) => (r.matchScore ?? 0) >= 0.9)
  )
    out.push({ id: 'adverse_media_match', at: 89, because: 'an adverse-media match on a named person' })
  if ((record.pep?.results ?? []).length > 0)
    out.push({ id: 'pep_match', at: 89, because: 'a politically exposed person match' })

  return out.sort((a, b) => a.at - b.at)
}

/**
 * The insights this record reads as a point AGAINST the identity.
 *
 * The report marks them where they are cited, so a reader scanning the argument
 * sees the three things holding the score down without first working out which
 * of twenty rows they were. Same table the score uses — one judgement, read in
 * two places.
 */
export const negativesFor = (record: BusinessRecord, results: Derived[]): Set<string> =>
  new Set(
    results
      .filter((r) => !r.notReported && polarityOf(r, record) === 'negative')
      .map((r) => r.insightId)
  )

/**
 * The score for one report.
 *
 * Takes `(record, results)` and nothing else, so an old report's snapshot
 * reproduces the number it was written beside. Returns null when less than half
 * the declared weight could be evaluated — a ring over one working component is
 * a number with no model behind it.
 */
/**
 * The score for one report.
 *
 * Takes the record, the derived insights and the assessments the report was
 * laid out in, and nothing else — so an old report's snapshot reproduces the
 * number it was written beside. Returns null when the report has no assessments
 * to read: a ring over nothing is a number with no model behind it.
 */
export const identityScore = (
  record: BusinessRecord,
  results: Derived[],
  areas: ScoreArea[] = []
): IdentityScore | null => {
  if (areas.length === 0) return null

  const byId = new Map(results.map((r) => [r.insightId, r]))
  const weight = Math.round((100 / areas.length) * 10) / 10
  const components = areas.map((a) => scoreArea(a, byId, record, weight))

  const read = components.filter((c) => c.subScore !== null)
  const coverage = Math.round(read.reduce((n, c) => n + c.weight, 0))
  // Less than half the assessment could be read: the rest would renormalise
  // over a fragment, and "91, on 40 of 100" must not be readable as "91".
  if (coverage < 50) return null

  // An assessment with nothing to read drops out and the rest renormalise over
  // what was read.
  const applied = components.map((c) => ({
    ...c,
    appliedWeight: c.subScore === null ? 0 : Math.round((c.weight / coverage) * 1000) / 10
  }))

  const weighted = applied.reduce((n, c) => n + (c.subScore ?? 0) * (c.appliedWeight / 100), 0)
  const ceilings = ceilingsFor(record)
  const value = Math.round(ceilings.reduce((n, c) => Math.min(n, c.at), weighted))

  return {
    value: clamp(value),
    weighted: Math.round(weighted),
    band: bandFor(clamp(value)),
    components: applied,
    ceilings: ceilings.filter((c) => c.at < Math.round(weighted)),
    coverage,
    findings: negativesFor(record, results).size
  }
}
