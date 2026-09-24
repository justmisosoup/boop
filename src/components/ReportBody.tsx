import { Fragment, cloneElement, isValidElement, useMemo } from 'react'

import { ChatSources, Text } from '@/core'

import { attributesFor } from '../lib/attributes'
import { categoriesOf } from '../lib/deriveResults'
import { GROUPS, makeGroupFor, type GroupId } from '../lib/groups'
import type { AreaSummary } from '../lib/areaSummaries'
import { IDENTITY_SECTIONS, type IdentitySection } from '../lib/identitySections'
import type { BusinessRecord, Derived } from '../lib/deriveResults'
import type { AssessmentWeight } from '../lib/identityScore'
import type {
  AnalysisDraft,
  AnalysisResult,
  AssessmentSection,
  CouldNotConfirmReason
} from '../types'
import { cn } from '../utils/twUtils'
import { CardLabel } from './CardLabel'
import { ROLLUP_NO_GLYPH } from './chipStyles'
import { InsightRow } from './InsightRow'
import { InsightStack, ROW_HAIRLINE } from './InsightStack'

/**
 * How a report reads, wherever it is read.
 *
 * Lifted out of `AnalysisPanel` whole when the conversation moved to its own
 * column. The report and a typed question's answer are the same document in two
 * shapes — the same prose, the same citations, the same evidence rows — so they
 * have one renderer and the columns differ only in what they hand it. Splitting this
 * into a "report body" and an "answer body" would have been two implementations
 * of one grammar, drifting apart the first time either was touched.
 */

/**
 * The report's shape is the manifest, nothing else.
 *
 * `recommendation` used to lead it as a section of its own, headed with the
 * call — "Approve", over a rule, over the follow-ups. The score card says the
 * call now, in its own band and its own ring, so the heading was the same word
 * twice with 40px between them. What the recommendation carries is rendered
 * above the assessments by `ReportBody`, without a heading over it.
 */
const sectionsOf = (policy: Array<{ id: string; name: string }>) =>
  policy.map(({ id, name }) => ({ id, heading: name }))

/**
 * What is actually happening while the analysis is being written, in the order
 * it happens. The last step stays `active` — it is the one still running.
 */
/**
 * What a run works through, in the order it happens.
 *
 * Read the record, pick what the assessment requires, work each assessment in
 * it, weigh the context, then build the recommendation. The assessments are the
 * ones the customer actually put inside the one that was sent — a fixed list of
 * standing stages named work that was not happening.
 */
export const WHY: Record<CouldNotConfirmReason, string> = {
  not_published: 'the state does not publish it',
  not_held_or_unreachable: 'we do not hold it',
  not_required: 'not required for this kind of business',
  no_insight_covers_it: 'no insight covers it'
}


/**
 * The insights a sentence rests on, under the sentence.
 *
 * It used to render the ATTRIBUTES those insights read — the value a reviewer
 * writes down, with the reading stripped off it. But the sentence above IS the
 * reading, and a card saying `801 Madison Ave Fl 3` under it could not say
 * which of the three checks on that address it stood for; the evidence note was
 * doing that work, and doing it in six words.
 *
 * The insight is the unit the report argues from, so the insight is what sits
 * under the claim — the same rows as the Insights tab, with the same
 * disclosure, the same state grammar and the same evidence cells inside them.
 * A reader who has learnt one has learnt the other, and the attributes are
 * still one chevron away rather than gone.
 *
 * Deduplicated by `useCited` on the statement: two checks reaching the same
 * sentence are one row.
 */
const CiteList = ({
  cited,
  record,
  negatives,
  title,
  trailing,
  intro,
  sections,
  onJumpToSource
}: {
  cited: Derived[]
  record?: BusinessRecord
  /** Insight ids the assessment score read as a point against the identity. */
  negatives?: ReadonlySet<string>
  /** The assessment's name and its band, as the card's header. */
  title?: React.ReactNode
  trailing?: React.ReactNode
  /** What the assessment says it could not find, above the rows of what it did. */
  intro?: React.ReactNode
  /** The rows under named headings, by topic — one block per heading, in this
   *  order, empty ones dropped. Anything no heading claims goes under "Other". */
  sections?: ReadonlyArray<IdentitySection>
  /** An evidence chip names a source record, and following it opens that
   *  source's card — the behaviour the same chip has in the Insights tab. */
  onJumpToSource?: (cardId: string) => void
}) => {
  // The rows read the record for their evidence; without one there is nothing
  // for them to open.
  if (!record) return null

  /*
   * Flagged insights first, and every row on the page. An area's rows were
   * in citation order, which put the three a reviewer has to act on in the
   * middle of sixteen that all carry the same dot; the flagged rows lead now.
   * They used to fold the rest under "Show n other insights" — hiding
   * insights a reviewer is here to read.
   */
  const isFlagged = (r: Derived) => r.reason === 'should_exist_not_found' || Boolean(negatives?.has(r.insightId))
  const flagged = cited.filter(isFlagged)
  /*
   * Then by topic, then by what came back. Citation order scattered one
   * subject across the card — a filing, an address, the filing again — so the
   * rest follow the Insights panel's grouping (names, formation,
   * registrations, addresses, people…), and inside a topic a result reads
   * before an unknown, an unknown before a no-result.
   */
  const groupFor = makeGroupFor(categoriesOf(record))
  const topic = new Map(GROUPS.map((g, i) => [g.id, i]))
  const STATE_RANK: Record<string, number> = { result: 0, unknown: 1, no_result: 2 }
  const rank = (r: Derived) => [topic.get(groupFor(r.insightId)) ?? 99, STATE_RANK[r.state] ?? 3]
  const byTopic = (a: Derived, b: Derived) => {
    const [ta, sa] = rank(a)
    const [tb, sb] = rank(b)
    return ta - tb || sa - sb
  }
  const ordered = [...[...flagged].sort(byTopic), ...cited.filter((r) => !isFlagged(r)).sort(byTopic)]

  const row = (r: Derived) => (
    <InsightRow
      key={r.insightId}
      result={r}
      record={record}
      negative={negatives?.has(r.insightId)}
      onJumpToSource={onJumpToSource}
    />
  )

  return (
    // The Insights tab's own frame, the same component: one card, named in its
    // own header, rows divided by the inset hairline.
    <InsightStack
      title={title}
      trailing={
        <span className="flex items-center gap-2">
          {flagged.length > 0 && (
            <span className="text-caption tabular-nums text-text-secondary">{flagged.length} flagged</span>
          )}
          {trailing}
        </span>
      }
      intro={intro}
    >
      {sections
        ? [
            ...sections.map((s) => ({ label: s.headline(record), rows: ordered.filter((r) => s.groups.includes(groupFor(r.insightId) as GroupId)) })),
            {
              label: 'Other',
              rows: ordered.filter((r) => !sections.some((s) => s.groups.includes(groupFor(r.insightId) as GroupId)))
            }
          ]
            .filter((b) => b.rows.length > 0)
            .map((b) => (
              <div key={b.label}>
                <CardLabel as="h4" className="px-4 pb-1 pt-3">
                  {b.label}
                </CardLabel>
                {b.rows.map((r, i) => (
                  <div key={r.insightId} className={cn(i > 0 && ROW_HAIRLINE)}>
                    {row(r)}
                  </div>
                ))}
              </div>
            ))
        : ordered.map(row)}
    </InsightStack>
  )
}

/** Cited checks, resolved. A check that never ran is dropped: it is not in the
 *  Insights tab either, so citing it promises evidence nobody can look at. Two
 *  checks reaching the same sentence collapse to one. */
const useCited = (cites: string[] | undefined, results: Derived[]) => {
  const found = (cites ?? [])
    .map((id) => results.find((r) => r.insightId === id))
    .filter((r): r is Derived => Boolean(r) && !r!.notReported)
  const seen = new Set<string>()
  return found.filter((r) => !seen.has(r.statement) && seen.add(r.statement))
}

const escapeRe = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Every attribute value the report holds, as one matcher.
 *
 * Built from the whole insight list rather than from the paragraph's own
 * citations: an attribute is an attribute wherever the prose says it, and
 * marking only the ones a given paragraph happened to cite left the same
 * address underlined in one sentence and plain in the next.
 *
 * Longest first: the full address has the shorter values inside it, and a
 * shorter alternative winning would mark it a piece at a time. The lookarounds
 * keep a value from matching inside a longer word.
 */
const attributePattern = (results: Derived[], record?: BusinessRecord) => {
  const values = new Set<string>()
  for (const r of results) {
    for (const a of record ? attributesFor(r.insightId, record) : []) {
      // `value` and not `matchValue`: the latter is a dedupe key on most rows
      // (`legal:kairos physical therapy pllc`), and the prose says the value.
      const v = a.value?.trim()
      // Anything shorter is a state code or an entity suffix. They sit inside
      // ordinary sentences, and marking them marks the sentence.
      if (v && v.length > 3) values.add(v)
    }
  }
  if (values.size === 0) return null
  const alts = [...values]
    .sort((a, b) => b.length - a.length)
    .map(escapeRe)
    .join('|')
  // Case-sensitive: the record writes `Active`, and a sentence saying an
  // `active New York filing` is using the word, not citing the attribute.
  return new RegExp(`(?<![A-Za-z0-9])(?:${alts})(?![A-Za-z0-9])`, 'g')
}

/**
 * The attributes, marked where the prose says them.
 *
 * The card under a sentence holds the value the sentence is about, and tying
 * the two together was left to the reader's eye. Marking the value in place
 * says which words the card is holding, so the sentence and the card read as
 * one thing rather than two.
 */
const markAttributes = (node: React.ReactNode, pattern: RegExp | null): React.ReactNode => {
  if (!pattern) return node

  if (typeof node === 'string') {
    const parts: React.ReactNode[] = []
    let last = 0
    for (const m of node.matchAll(pattern)) {
      const at = m.index ?? 0
      if (at > last) parts.push(node.slice(last, at))
      parts.push(
        <span key={`${at}-${m[0]}`} className="attribute-mention">
          {m[0]}
        </span>
      )
      last = at + m[0].length
    }
    if (last === 0) return node
    if (last < node.length) parts.push(node.slice(last))
    return parts
  }

  if (Array.isArray(node)) {
    return node.map((child, i) => (
      <Fragment key={i}>{markAttributes(child, pattern)}</Fragment>
    ))
  }

  if (isValidElement(node)) {
    const kids = (node.props as { children?: React.ReactNode }).children
    return kids === undefined ? node : cloneElement(node, undefined, markAttributes(kids, pattern))
  }

  return node
}

/**
 * One sentence of the argument.
 *
 * It carries no citations of its own any more. Every paragraph used to end in
 * the stack of checks it rested on, which broke a five-sentence assessment into
 * five blocks of prose separated by five cards, and printed a check twice when
 * two sentences cited it. The assessment's checks are one card at the end of it
 * — see `SectionBody`.
 */
export const Para = ({
  sources,
  results,
  record,
  inline = false,
  className,
  children
}: {
  sources?: Array<{ title: string; url: string }>
  results: Derived[]
  record?: BusinessRecord
  /**
   * A line inside someone else's paragraph.
   *
   * `InlineAlert`'s body is already a `<p>`, and a `<p>` inside it is invalid;
   * the sentence is set as a block span instead, with the same marking and
   * the same sources chip.
   */
  inline?: boolean
  className?: string
  children: React.ReactNode
}) => {
  // Memoised on the report's own inputs: the matcher walks every insight's
  // attributes, and a paragraph is not the right place to do that per render.
  const pattern = useMemo(() => attributePattern(results, record), [results, record])

  const content = (
    <>
      {markAttributes(children, pattern)}
      {/* The chip is the disclosure: one labelled "Public sources", opening the
          pages the claim came from. It reads the same way as an insight citation
          because it is doing the same job — saying where this came from. */}
      {sources && sources.length > 0 && (
        <span className="ml-1 align-middle">
          <ChatSources
            className={ROLLUP_NO_GLYPH}
            label="Public sources"
            sources={sources.map((src) => ({
              id: src.url,
              label: src.title,
              title: src.title,
              url: src.url,
              annotation: 'Public web'
            }))}
          />
        </span>
      )}
    </>
  )

  if (inline) return <span className={cn('block', className)}>{content}</span>

  return (
    <div className={cn('mt-3', className)}>
      <Text>{content}</Text>
    </div>
  )
}

/**
 * One section: its insights, and nothing else.
 *
 * It opened with prose, then with a card of every attribute it cited. Both
 * restated what the rows beneath already carried: the statement is the
 * finding, and the attributes are one expand away inside it, with their
 * provenance. The section is the stack of checks the assessment rested on,
 * in the order the assessment cited them, and the reader opens what they want
 * to see behind.
 *
 * A gap prints only when nothing acts on it — see `closed` — and then as a
 * sentence, since an open question is not a value the record holds.
 */
export const SectionBody = ({
  section,
  heading,
  summary,
  results,
  record,
  negatives,
  closed,
  onJumpToSource
}: {
  section: AssessmentSection
  /** The area's name, for the card's header. A question's answer has none. */
  heading?: string
  /** What the area asks and why it matters, above its insights. */
  summary?: string
  results: Derived[]
  record?: BusinessRecord
  negatives?: ReadonlySet<string>
  /**
   * Gap ids a follow-up on the determination already closes.
   *
   * A gap that has a step written for it is said once, on the card, as the
   * step. Saying it again here as "X is not on the record" repeated the
   * recommendation in the passive voice, one screen down. Only a gap nothing
   * acts on is left for the section to state.
   */
  closed?: ReadonlySet<string>
  onJumpToSource?: (cardId: string) => void
}) => {
  /*
   * One stack of insights for the whole assessment, at the end of it, and one
   * card of data at the head of it — both over the same cited set. The gaps'
   * citations go in too: a gap is part of what the assessment found.
   */
  const cited = useCited(
    [
      ...section.body.flatMap((b) => b.cites ?? []),
      ...(section.gaps ?? []).filter((g) => !g.noAction).flatMap((g) => g.cites ?? [])
    ],
    results
  )

  /* Only the gaps nobody has written a step for. A `noAction` gap is one
     nobody is going to act on, and a closed one is already an instruction on
     the determination — see `closed`. Both stay in the data (the open
     ones are what hold an assessment for review); neither is repeated here as
     a sentence. Out-of-band gaps are not printed at all.

     Inside the card, as its intro: they are the assessment's own sentences
     about this record, and a paragraph floating between the card's header and
     the card read as belonging to neither. */
  const gaps = (section.gaps ?? []).filter(
    (g) => g.why !== 'no_insight_covers_it' && !g.noAction && !closed?.has(g.id)
  )
  const gapIntro =
    gaps.length > 0
      ? gaps.map((g, i) => {
          const tail = [g.why === 'not_published' ? null : WHY[g.why], g.wouldAnswer]
            .filter(Boolean)
            .join('. ')
          return (
            <Para key={g.point} inline className={i > 0 ? 'mt-2' : undefined} results={results} record={record}>
              {g.point}
              {tail && (
                <>
                  {' '}
                  <span className="text-[var(--core-color-text-muted)]">— {tail}</span>
                </>
              )}
            </Para>
          )
        })
      : null
  /* What the area is asking, first — so a reader knows what the rows under
     it are evidence for — then any gap the assessment wrote about it. */
  const intro =
    summary || gapIntro ? (
      <>
        {summary && <span className="block text-sm leading-5 text-text-secondary">{summary}</span>}
        {gapIntro && <div className={summary ? 'mt-2' : undefined}>{gapIntro}</div>}
      </>
    ) : undefined

  return (
    <>
      <CiteList
        cited={cited}
        record={record}
        negatives={negatives}
        title={heading}
        /* No weight on the header. An area's weight is how the policy counts
           it — background for whoever reads the policy, not something a
           reviewer reading this business needs beside the area's name. */
        intro={intro}
        sections={section.id === 'skill-kyb-identification' ? IDENTITY_SECTIONS : undefined}
        onJumpToSource={onJumpToSource}
      />
    </>
  )
}

export const ReportBody = ({
  result,
  results,
  policy,
  record,
  stream = false,
  negatives,
  tiers,
  summaries,
  onJumpToSource
}: {
  result: AnalysisResult | AnalysisDraft
  results: Derived[]
  /** The assessments this run was composed of — the report's layout. */
  policy: Array<{ id: string; name: string }>
  record?: BusinessRecord
  /** A run is being written, so sections not yet here are coming. */
  stream?: boolean
  /** Insight ids the assessment score read as a point against the identity. */
  negatives?: ReadonlySet<string>
  /** Accepted for callers that still pass it; the weight is not shown. */
  tiers?: ReadonlyMap<string, AssessmentWeight>
  /** What each area asks, shown at the head of its card. */
  summaries?: ReadonlyMap<string, AreaSummary>
  /** An evidence chip under a cited insight opens that source's card. */
  onJumpToSource?: (cardId: string) => void
}) => {
  const verdict = 'headline' in result ? result : null
  const byId = new Map(result.sections.map((s) => [s.id, s]))
  const answer = byId.get('answer')
  /**
   * A typed question, which is the only turn the headline belongs on.
   *
   * `types.ts` states the rule: the headline is one sentence answering the
   * question asked, and on a STANDING report it does not render — "onboard
   * subject to conditions" over a list of conditions names what the list
   * already is. It used to be suppressed by the presence of a recommendation
   * section; that section is gone, so the test is the thing itself.
   */
  const isQuestion = byId.has('answer')

  // What the recommendation already says to do, so the sections do not say
  // it again as what is missing.
  const closed = new Set((verdict?.followUps ?? []).flatMap((f) => f.closes ?? []))
  const pass = { results, record, negatives, closed, onJumpToSource }

  return (
    <>
      {/* The lede is not rendered here. It describes the business rather than
          the assessment, so it leads the report under its own heading, above
          everything a run wrote. */}

      {/* A question has no recommendation to land in, so its one-sentence answer
          leads instead — the same sentence, in the only place it can go. */}
      {verdict && isQuestion && <Text className="mt-2">{verdict.headline}</Text>}

      {/* A follow-up question is answered on its own terms — running it through
          the standing headings would be filing, not answering. */}
      {answer && <SectionBody section={answer} {...pass} />}

      {sectionsOf(policy)
        .filter(({ id }) => byId.has(id))
        .map(({ id, heading }) => {
        const section = byId.get(id)
        /*
         * Not here yet, but on its way, and the report should say so.
         *
         * A section that had not landed rendered nothing at all, so a run in
         * progress was blank space that intermittently produced a finished
         * section. The headings are known the moment the run is composed, so
         * they stand from the start and the prose fills in beneath them.
         */
        return (
          <div
            key={id}
            // The contents list jumps here.
            id={`section-${id}`}
            // The break between sections is the heading's own rule now, so this
            // is spacing alone. Every section takes it, including the first:
            // the score card sits above it, and the first heading was landing
            // flush on the card's bottom rule.
            className="mt-4 scroll-mt-6"
          >
            {/* No heading over the card. The area's name is the card's own
                header (see `CardHeader`), with its weight beside it — the
                section IS the card, so a heading and a rule above it named the
                same thing twice. */}
            {section && (
              <SectionBody
                section={section}
                /* What the area found, as its name; the pillar's own name only
                   while there is no finding yet. */
                heading={summaries?.get(id)?.headline ?? heading}
                summary={summaries?.get(id)?.summary}
                {...pass}
              />
            )}
          </div>
        )
      })}
    </>
  )
}

/**
 * A typed question's answer.
 *
 * The same renderer with an empty manifest: a question has no assessments to
 * lay out, no identity card and no score — it has one `answer` section, which
 * is the branch `ReportBody` already takes when it finds one. The shape is not
 * different, it is empty.
 */
const NO_POLICY: Array<{ id: string; name: string }> = []

export const AnswerBody = (props: {
  result: AnalysisResult | AnalysisDraft
  results: Derived[]
  record?: BusinessRecord
  negatives?: ReadonlySet<string>
  onJumpToSource?: (cardId: string) => void
}) => <ReportBody {...props} policy={NO_POLICY} />

