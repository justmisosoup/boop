import type { BusinessRecord, Derived } from './deriveResults'
import { stateName } from './states'

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

/**
 * How much an assessment counts, in the one-pager's words.
 *
 * Identity, Ownership & Control and Compliance Screenings are critical;
 * Activity & Permission is high. Two tiers, and a critical assessment counts
 * twice what a high one does — the smallest ratio that makes the tiers mean
 * anything, and one a reviewer can hold in their head. Nothing on the record
 * ranks the assessments; this is the product's ranking, declared once.
 */
export type AssessmentWeight = 'critical' | 'high'

export const WEIGHT: Record<AssessmentWeight, number> = { critical: 2, high: 1 }

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
export type ScoreArea = {
  id: string
  name: string
  insightIds: string[]
  /**
   * Questions the assessment left open that are OURS to close — see
   * `openQuestions`. An assessment with one cannot come back Approve: the file
   * it describes is incomplete, whatever its checks scored.
   */
  openQuestions?: string[]
  /** Its tier. Absent reads as critical. */
  tier?: AssessmentWeight
}

export type ScoreComponent = {
  /** The assessment's id, which is also its anchor in the report. */
  id: string
  label: string
  /** Its tier, for the card. */
  tier: AssessmentWeight
  /** The declared weight, before absent components are reweighted away. */
  weight: number
  /** The weight actually applied. 0 when the component had nothing to read. */
  appliedWeight: number
  /** 0–100, or null when there was nothing to read. */
  subScore: number | null
  /** One clause per test, in the order tested — the arguable part. */
  reasons: string[]
  /** The same three counts as numbers, for the card's glyphs. */
  counts: { positive: number; negative: number; neutral: number }
  /** Named inputs that could not be evaluated, so the card can say which. */
  missing: string[]
  /** Where the sub-score lands, in the same three bands as the whole. Null
   *  when there was nothing to read. */
  band: ScoreBand | null
  /** The insights behind it. Primary group first: the cell jumps to that one. */
  insightIds: string[]
}

export type ScoreCeiling = {
  id: string
  at: number
  /** The clause, for the model's own reasons list. */
  because: string
  /** The same fact as a reviewer would say it: what is wrong, in the record's
   *  own terms, with no arithmetic in it. */
  plain: string
}

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
  { id: 'conditions', label: 'Needs review', range: '50–89', tone: 'warning', from: 50 },
  { id: 'established', label: 'Approve', range: '90+', tone: 'success', from: 90 }
]

const bandFor = (value: number) =>
  [...BANDS].reverse().find((b) => value >= b.from) ?? BANDS[0]

/** The top of the Review band: what an assessment is held to while a question
 *  of ours is open in it. */
const HELD_AT = (BANDS.find((b) => b.id === 'established')?.from ?? 90) - 1

/**
 * The gaps in a section that hold its assessment for review.
 *
 * Only the open ones that are ours to close. A `not_published` gap is a fact
 * about a registry and a `not_required` one is a fact about the form — neither
 * says anything is missing from the file. A gap written off with `noAction` is
 * a decision already taken. What is left is a question the file is waiting on:
 * something we do not hold, or something no check reaches.
 */
export const openQuestions = (
  gaps: Array<{ point: string; why: string; noAction?: unknown }> | undefined
): string[] =>
  (gaps ?? [])
    .filter((g) => !g.noAction && (g.why === 'not_held_or_unreachable' || g.why === 'no_insight_covers_it'))
    .map((g) => g.point)

/**
 * The areas a report is scored in, from its own sections.
 *
 * One assessment, the insights its prose and gaps cite, and the questions it
 * left open. Built here rather than in the page so the record view and the
 * businesses list score a report the same way.
 */
export const areasOf = (
  sections: Array<{
    id: string
    body: Array<{ cites?: string[] }>
    gaps?: Array<{ point: string; why: string; cites?: string[]; noAction?: unknown }>
  }>,
  policy: Array<{ id: string; name: string; weight?: AssessmentWeight }>
): ScoreArea[] => {
  const named = new Map(policy.map((p) => [p.id, p]))
  return sections
    .filter((section) => named.has(section.id))
    .map((section) => ({
      id: section.id,
      name: (named.get(section.id) as { name: string }).name,
      tier: named.get(section.id)?.weight ?? 'critical',
      insightIds: [
        ...new Set([
          ...section.body.flatMap((b) => b.cites ?? []),
          ...(section.gaps ?? []).flatMap((g) => g.cites ?? [])
        ])
      ],
      openQuestions: openQuestions(section.gaps)
    }))
}

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
  // A domestic filing whose status the state does not publish is neither.
  sos_domestic: (r) => (r.state === 'result' ? 'positive' : NEUTRAL.has(r.reason ?? '') ? 'neutral' : 'negative'),
  // The IRS holding the number is the point; holding it against a DIFFERENT
  // name is the finding, and the record carries that as its own flag.
  tin: (_r, record) =>
    (record.tin as { mismatch?: boolean } | null)?.mismatch ? 'negative' : 'positive',
  entity_type: () => 'positive',
  /* The sub-status is the state's own word on standing. Good standing (or an
     equivalent) is a point for the file; withheld is nothing; anything else
     the state bothers to say — pending inactive, dissolved, delinquent — is a
     point against it, since a state does not annotate a filing it is happy with. */
  sos_domestic_sub_status: (r, record) => {
    if (r.state !== 'result') return 'neutral'
    const word = (sub(record, 'sos_domestic_sub_status') ?? '').toLowerCase()
    const good = /good standing|current|compliant/.test(word) && !/^not\b|not in/.test(word)
    return good ? 'positive' : 'negative'
  },

  // The office. Deliverable and commercial are points for it; a residential
  // suite is not a finding on its own.
  address_deliverability: (r) => (r.state === 'result' ? 'positive' : 'negative'),
  address_property_type: (_r, record) =>
    record.addresses.some((a) => a.submitted && a.propertyType === 'Commercial')
      ? 'positive'
      : 'neutral',
  address_registered_agent: () => 'neutral',
  /*
   * Every frequency band is context, the high one included.
   *
   * The high band used to count against the identity. But an address a
   * hundred businesses file from is, on this record set, a registered agent's
   * office or a co-working floor — the ordinary footprint of a Delaware
   * corporation or a start-up — and nothing in the check says which. What a
   * shared address means is the assessment's reading to make in prose, with
   * the address in front of it; a table that scores it has decided in advance
   * that a crowded floor is a mark against, which it is not.
   */
  location_frequency: () => 'neutral',

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
  /*
   * A name on the website is context, not a finding against the identity.
   *
   * A `Mismatch` here counted against the business, and a website is not a
   * source of record: a studio trades under one name and files under another,
   * and the check returns the mismatch without saying what the other name was.
   * The filing is what establishes the name, and `name` above reads that. A
   * `Verified` match is a genuine point for the file; a mismatch is a question,
   * and a question is not a mark against.
   */
  web_business_name_verification: (_r, record) =>
    (sub(record, 'web_business_name_verification') ?? '').toLowerCase().startsWith('verified')
      ? 'positive'
      : 'neutral',

  // People. A submitted person nobody can match to a filing or to the site is
  // the gap a CIP file cannot close by itself.
  /*
   * Unmatched only counts against the file when there was something to match.
   *
   * A person is matched against the officers a filing names, and a New York
   * PLLC's filing names none — membership is a licensed-practitioner question
   * the state does not publish. Not matching a person against a filing that
   * names no people is the EXPECTED outcome for a professional entity, so it
   * reads as the file behaving normally rather than as something withheld: a
   * point for it, not a question hanging over it.
   *
   * Where a registration DOES list officers and the submitted person is still
   * not among them, the check has something to say and it says it: that is a
   * point against, and it stays one.
   */
  person_verification: (_r, record) => {
    if ((sub(record, 'person_verification') ?? '').toLowerCase().startsWith('verified'))
      return 'positive'
    /*
     * A NATURAL person, not an officer row.
     *
     * New York lists this PLLC as its own process agent, so the filing's
     * `officers` array is non-empty and holds one entry: the entity's own name.
     * Testing the array's length read that as "a filing names people, and the
     * submitted person is not among them" — the one reading that makes this a
     * finding — when what the record actually says is the sentence the report
     * opens the ownership section with: no natural person is named.
     */
    const itself = new Set(
      [record.name, ...record.names.map((n) => n.name), ...record.registrations.map((r) => r.name)]
        .filter(Boolean)
        .map((n) => n.trim().toLowerCase())
    )
    const namesAPerson = record.registrations.some((r) =>
      (r.officers ?? []).some((o) => o && !itself.has(o.trim().toLowerCase()))
    )
    return namesAPerson ? 'negative' : 'positive'
  },
  web_person_verification: (r) => (r.state === 'result' ? 'positive' : 'negative'),
  /*
   * Connections are context, not a finding.
   *
   * This counted `Found` against the identity, which is not what a connected
   * business is. Two entities sharing an address is ordinary — a shared clinical
   * floor, a holding company, a landlord — and nothing in the check says which.
   * What it is NOT is a point against this business, and scoring it as one put a
   * red mark on the row in three assessments for something the record does not
   * allege. Whether the connection matters is the follow-up's question to ask,
   * not this table's to answer.
   *
   * `Not Found` is not a point for the file either: nobody looked for something
   * and failed to find it.
   */
  business_connections: () => 'neutral',

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

  /*
   * Financial standing. Nothing found is a point for the file. Something found
   * is context, not a finding: five open UCCs on a bakery are equipment
   * finance, and a lawsuit names an employer as often as a debtor. What a lien
   * or a suit means is the Financial Standing assessment's reading to make
   * against the business's age and line of work, and a table that scored it
   * had already decided. "Found" used to read as POSITIVE here — a check that
   * returned five liens counted for the business — which was wrong in the
   * other direction.
   *
   * A bankruptcy is the exception: it is adverse under any policy, and the
   * record-level ceiling already treats it so.
   */
  liens: (_r, record) => ((record.liens ?? []).length > 0 ? 'neutral' : 'positive'),
  litigations: (_r, record) => ((record.litigations ?? []).length > 0 ? 'neutral' : 'positive'),
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
 * Each assessment carries the weight its tier declares — see `WEIGHT`. The
 * ranking is the product's, stated once in the one-pager and once here, not
 * something inferred from the record.
 */
const scoreArea = (
  area: ScoreArea,
  byId: Map<string, Derived>,
  record: BusinessRecord,
  weight: number
): ScoreComponent => {
  const cited = area.insightIds
    .map((id) => byId.get(id))
    .filter((r): r is Derived => Boolean(r) && !r?.notReported)

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
  const open = area.openQuestions ?? []
  const reasons = [
    `${positive.length} positive`,
    `${negative.length} negative`,
    `${neutral.length} unknown`,
    // The clause that held it, beside the counts that did not: a reader seeing
    // 89 over five clean checks has to be told which rule put it there.
    ...(open.length > 0
      ? [`held for review: ${open.length === 1 ? 'one question' : `${open.length} questions`} the file leaves open`]
      : [])
  ]

  /*
   * A clean assessment is 100, each finding costs `FINDING_COST` — and an
   * assessment with a question of ours still open is held at the top of the
   * Review band, whatever its checks scored.
   *
   * The two are different shapes of incompleteness. A finding is something a
   * check came back with; an open question is something no check reached — a
   * beneficial owner the state does not publish and the customer has not yet
   * certified. Deducting for it would price the unknown, which the header of
   * this file forbids; ignoring it put a 100 over an ownership stage whose own
   * prose says ownership is unestablished. So it caps, the way the serious
   * findings do at the top: not above Review until the question is closed.
   */
  const raw = counted === 0 ? null : clamp(100 - FINDING_COST * negative.length)
  const subScore = raw === null ? null : open.length > 0 ? Math.min(raw, HELD_AT) : raw

  return {
    id: area.id,
    label: area.name,
    tier: area.tier ?? 'critical',
    weight,
    appliedWeight: 0,
    counts: { positive: positive.length, negative: negative.length, neutral: neutral.length },
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
    subScore,
    reasons,
    missing: counted === 0 ? ['nothing this assessment cited could be read'] : [],
    band: subScore === null ? null : bandFor(subScore),
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
  const subStatus = (domestic?.subStatus || '').toLowerCase()
  const where = stateName(domestic?.state ?? record.formation?.state)
  const tin = record.tin as { mismatch?: boolean } | null

  if (record.registrations.length === 0 && !record.formation)
    out.push({
      id: 'no_filing',
      at: 49,
      because: 'no filing on the record',
      plain: 'No Secretary of State filing was found for this business.'
    })
  else if (domestic && status && status !== 'active' && status !== 'unknown')
    out.push({
      id: 'filing_not_active',
      at: 49,
      because: `the domestic filing is ${status}`,
      // Named as the domestic registration, not just a filing: a foreign
      // registration lapsing is a different fact, and a reviewer reading
      // "the California filing is inactive" cannot tell which this was.
      plain: `The domestic registration in ${where} is ${status}${
        subStatus && subStatus !== status ? ` and ${subStatus}` : ''
      }.`
    })

  if (tin?.mismatch)
    out.push({
      id: 'tin_mismatch',
      at: 49,
      because: 'the TIN does not match the name',
      plain: 'The TIN does not match the business name at the IRS.'
    })
  if ((record.watchlist?.hitCount ?? 0) > 0)
    out.push({
      id: 'watchlist_hit',
      at: 69,
      because: 'an unresolved watchlist hit',
      plain: 'A watchlist hit on the business or a named person has not been resolved.'
    })
  if ((record.bankruptcies ?? []).length > 0)
    out.push({
      id: 'bankruptcy',
      at: 69,
      because: 'a bankruptcy on the record',
      plain: 'A bankruptcy filing is on the record.'
    })
  if (sub(record, 'liens') === 'High Risk Liens')
    out.push({ id: 'liens_high_risk', at: 79, because: 'high-risk liens', plain: 'High-risk liens are on the record.' })
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
    out.push({
      id: 'adverse_media_match',
      at: 89,
      because: 'an adverse-media match on a named person',
      plain: 'Adverse media matched a named person and has not been graded.'
    })
  if ((record.pep?.results ?? []).length > 0)
    out.push({
      id: 'pep_match',
      at: 89,
      because: 'a politically exposed person match',
      plain: 'A named person matched a politically exposed persons list.'
    })

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
/**
 * How the insights a report rests on read, counted once each.
 *
 * The same table `scoreArea` counts per assessment, over the union of what
 * every assessment cited — so the businesses list shows the same three numbers
 * a reader would get by adding up the score card's cells, minus the
 * double-counting of an insight cited by more than one assessment.
 */
export const polarityCounts = (
  record: BusinessRecord,
  results: Derived[],
  insightIds: Iterable<string>
): { positive: number; negative: number; neutral: number } => {
  const byId = new Map(results.map((r) => [r.insightId, r]))
  const counts = { positive: 0, negative: 0, neutral: 0 }
  for (const id of new Set(insightIds)) {
    const r = byId.get(id)
    if (!r || r.notReported) continue
    counts[polarityOf(r, record)] += 1
  }
  return counts
}

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
  // A hundred points shared out by tier: a critical assessment takes twice a
  // high one's share. With four assessments, three critical and one high,
  // that is 28.6 / 14.3 / 28.6 / 28.6 rather than four equal quarters.
  const total = areas.reduce((n, a) => n + WEIGHT[a.tier ?? 'critical'], 0)
  const components = areas.map((a) =>
    scoreArea(a, byId, record, Math.round(((100 * WEIGHT[a.tier ?? 'critical']) / total) * 10) / 10)
  )

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
