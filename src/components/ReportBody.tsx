import { Fragment, cloneElement, isValidElement, useMemo } from 'react'

import { ChatSources, Heading, Surface, Text } from '@/core'

import { attributesFor } from '../lib/attributes'
import type { BusinessRecord, Derived } from '../lib/deriveResults'
import type {
  AnalysisDraft,
  AnalysisResult,
  AssessmentSection,
  CouldNotConfirmReason
} from '../types'
import { AttributeGrid, cell } from './AttributeGrid'
import { ROLLUP_NO_GLYPH } from './chipStyles'
import { InsightRow } from './InsightRow'

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
  onJumpToSource
}: {
  cited: Derived[]
  record?: BusinessRecord
  /** Insight ids the assessment score read as a point against the identity. */
  negatives?: ReadonlySet<string>
  /** An evidence chip names a source record, and following it opens that
   *  source's card — the behaviour the same chip has in the Insights tab. */
  onJumpToSource?: (cardId: string) => void
}) => {
  // The rows read the record for their evidence; without one there is nothing
  // for them to open.
  if (!record || cited.length === 0) return null

  return (
    // The Insights tab's own frame, verbatim: one rule around the stack, rows
    // divided by their own top border, the last one's bled off the bottom.
    <Surface
      variant="default"
      padding="none"
      className="mt-3 overflow-hidden rounded-none border-text-primary"
    >
      <div className="-mb-px">
        {cited.map((r) => (
          <InsightRow
            key={r.insightId}
            result={r}
            record={record}
            negative={negatives?.has(r.insightId)}
            onJumpToSource={onJumpToSource}
          />
        ))}
      </div>
    </Surface>
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
  children
}: {
  sources?: Array<{ title: string; url: string }>
  results: Derived[]
  record?: BusinessRecord
  children: React.ReactNode
}) => {
  // Memoised on the report's own inputs: the matcher walks every insight's
  // attributes, and a paragraph is not the right place to do that per render.
  const pattern = useMemo(() => attributePattern(results, record), [results, record])

  const body = (
    <Text>
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
    </Text>
  )

  return <div className="mt-3">{body}</div>
}

/**
 * One section's prose: what the record establishes, then what it could not.
 *
 * The gap sits immediately beneath the finding it undercuts rather than in a
 * pooled list at the end — a reader judging ownership needs to see what is
 * missing from ownership while they are still reading about it.
 *
 * It is not announced. The first gap used to open with a bold "Not
 * established.", which made the absence a labelled feature of the page and let
 * the sentence after it be a fragment hanging off the label. A gap is a
 * sentence like any other in the report: it says what is not known, in its own
 * words, and reads as prose rather than as a filed exception.
 */
export const SectionBody = ({
  section,
  results,
  record,
  negatives,
  identity,
  onJumpToSource
}: {
  section: AssessmentSection
  results: Derived[]
  record?: BusinessRecord
  negatives?: ReadonlySet<string>
  /**
   * The business identity card, under this section's opening claim.
   *
   * It used to sit above the first heading, between the recommendations and the
   * argument, where it was a block of filing facts nothing on either side was
   * talking about. Identity is the section those facts ARE the subject of, so
   * it lands there: the sentence that says the name and address match a filing,
   * then the filing's own values, then the checks behind them.
   */
  identity?: React.ReactNode
  onJumpToSource?: (cardId: string) => void
}) => {
  /*
   * One stack of insights for the whole assessment, at the end of it.
   *
   * Each paragraph used to carry its own — five sentences, five cards, and the
   * prose arrived a paragraph at a time between them. The reader could not read
   * the assessment without stopping at every break, and the same check cited by
   * two sentences appeared twice. The prose is one summary now and the checks
   * are one card under it: the argument reads through, and what it rests on is
   * in one place.
   *
   * The gaps' citations go in too — a gap is part of what the assessment found,
   * and splitting its checks off would be the same interleaving one level down.
   */
  const cited = useCited(
    [
      ...section.body.flatMap((b) => b.cites ?? []),
      ...(section.gaps ?? []).filter((g) => !g.noAction).flatMap((g) => g.cites ?? [])
    ],
    results
  )

  return (
  <>
    {section.body.map((b) => (
      <Para key={b.text} sources={b.sources} results={results} record={record}>
        {b.text}
      </Para>
    ))}

    {/* Only the open ones. A `noAction` gap is one nobody is going to act on,
        and printing it read as "Not established. X, and also nothing will be
        done about it" — a line that costs the reader attention and changes
        nothing they do. It stays in the data; it is not part of the report. */}
    {section.gaps?.filter((g) => !g.noAction).map((g, i) => {
      /*
       * The reason, unless the evidence under the claim already states it.
       *
       * `not_published` cites a check whose own Sub status cell now reads "The
       * state does not publish sub status", two lines below the sentence — so
       * the clause was saying it twice, once in prose and once on the value it
       * is about. The other three reasons have no such cell and keep theirs.
       */
      const tail = [g.why === 'not_published' ? null : WHY[g.why], g.wouldAnswer]
        .filter(Boolean)
        .join('. ')
      return (
        <Para key={g.point} results={results} record={record}>
          {g.point}
          {tail && (
            <>
              {' '}
              <span className="text-[var(--core-color-text-muted)]">— {tail}</span>
            </>
          )}
        </Para>
      )
    })}

    {/* The filing's own values, between the summary and the checks behind it.
        Only under the assessment this card is the subject of — see ReportBody. */}
    {identity}

    <CiteList
      cited={cited}
      record={record}
      negatives={negatives}
      onJumpToSource={onJumpToSource}
    />
  </>
  )
}

/**
 * The follow-ups, in priority order.
 *
 * A numbered list would imply a sequence that has to be worked through in order;
 * these are independent items that merely happen to be ranked, so they are
 * bulleted and the ranking is carried by the order alone.
 */
const FollowUps = ({
  items
}: {
  items: NonNullable<AnalysisResult['followUps']>
}) => (
  /*
   * No citations here.
   *
   * A follow-up is an instruction, and the finding behind it has already been
   * made and evidenced in the assessment above. Repeating the evidence on the
   * action attached it to a sentence that is not claiming anything.
   */
  /*
   * Bulleted, now that they are the section.
   *
   * They were set flush and unbulleted while they sat under a paragraph of
   * prose, where a disc and an indent made them read as its footnotes. With the
   * prose gone there is nothing for them to hang off: the marker is what says
   * this is a list of separate things to do rather than one long instruction.
   */
  <ul className="mt-3 list-disc space-y-3 pl-5">
    {items.map((f) => (
      <li key={f.text} className="pl-1">
        <Text className="font-semibold">{f.text}</Text>
        {/* The things the step acts on, named. A step that says "establish who
            is behind the connected businesses" is not actionable until the
            businesses are on screen. */}
        {f.entities && f.entities.length > 0 && (
          <AttributeGrid
            className="mt-2"
            items={f.entities.map((e) => cell(undefined, e.name, { key: e.name, note: e.note }))}
          />
        )}
      </li>
    ))}
  </ul>
)

export const ReportBody = ({
  result,
  results,
  policy,
  record,
  identity,
  score,
  stream = false,
  negatives,
  onJumpToSource
}: {
  result: AnalysisResult | AnalysisDraft
  results: Derived[]
  /** The assessments this run was composed of — the report's layout. */
  policy: Array<{ id: string; name: string }>
  record?: BusinessRecord
  /**
   * What the record holds, between the actions and the argument.
   *
   * The recommendations are what a reviewer does next, so they come first; the
   * identity card is what they are about to act on; the assessments are why.
   * It is passed in rather than rendered here because it is the business's, not
   * the run's — see RecordPage.
   */
  identity?: React.ReactNode
  /** How well the identity stands up, under the actions it justifies. */
  score?: React.ReactNode
  /** A run is being written, so sections not yet here are coming. */
  stream?: boolean
  /** Insight ids the assessment score read as a point against the identity. */
  negatives?: ReadonlySet<string>
  /** An evidence chip under a cited insight opens that source's card. */
  onJumpToSource?: (cardId: string) => void
}) => {
  const verdict = 'headline' in result ? result : null
  const followUps = verdict?.followUps ?? []
  const byId = new Map(result.sections.map((s) => [s.id, s]))
  const answer = byId.get('answer')
  const hasRecs = followUps.length > 0
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

  const pass = { results, record, negatives, onJumpToSource }

  /**
   * Which section the identity card goes under: the first assessment in the
   * manifest that actually landed — Identity, in every workflow that has one.
   *
   * Keyed on position rather than on a section id, because the manifest is the
   * customer's and its ids are theirs. The first assessment a report opens with
   * is the one establishing who the business is; that is where the filing's own
   * values belong.
   */
  const identityUnder = sectionsOf(policy).find(({ id }) => byId.has(id))?.id

  return (
    <>
      {/* The lede is not rendered here. It describes the business rather than
          the assessment, so it leads the report under its own heading, above
          everything a run wrote — see BusinessLede. */}

      {/* A question has no recommendation to land in, so its one-sentence answer
          leads instead — the same sentence, in the only place it can go. */}
      {verdict && isQuestion && <Text className="mt-2">{verdict.headline}</Text>}

      {/* A follow-up question is answered on its own terms — running it through
          the standing headings would be filing, not answering. */}
      {answer && <SectionBody section={answer} {...pass} />}

      {/* What a reviewer does before the account opens, and the number behind
          the call — both above the argument, neither under a heading. They were
          a "Recommendations" section, then an "Approve" one; the score card's
          own band is the call, and the follow-ups are a list of actions that
          needs no label to be read as one. */}
      {hasRecs && <FollowUps items={followUps} />}
      {score}

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
            className="mt-10 scroll-mt-6"
          >
            {/* Body size, bold. `Heading level={3}` sets these at 18px, which made
               five section titles compete with the report they label. Every
               section's heading is this one line: the assessment's name, and a
               rule carrying it across. */}
            {/* H3. One step above the assessment's own cell on the score card,
                which is H4: the same assessment is named in both places, and
                over the argument it is a division of the page rather than a
                label on a number. */}
            <div className="mb-10 flex items-center gap-4">
              <Heading level={3}>{heading}</Heading>
              <span aria-hidden="true" className="section-rule h-px flex-1" />
            </div>
            {section && (
              <SectionBody
                section={section}
                {...pass}
                identity={id === identityUnder ? identity : undefined}
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

