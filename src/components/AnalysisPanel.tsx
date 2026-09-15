import { ChatMessage, ChatSources, ChatThinking, Heading, Text, type ChatThinkingStep } from '@/core'

import { POLICY } from '../lib/useAnalysis'


import type { Derived } from '../lib/deriveResults'
import type { AnalysisVersion } from '../lib/useAnalysis'
import type {
  AnalysisDraft,
  AnalysisResult,
  AssessmentSection,
  AssessmentSectionId,
  CouldNotConfirmReason
} from '../types'
import { AnalysisSources } from './AnalysisSources'
import { ROLLUP_NO_GLYPH } from './chipStyles'

/**
 * The headed sections, in the order they are read.
 *
 * Fixed here rather than taken from the result: the order of an argument is not
 * the session's to vary run to run, and a business is only comparable with
 * another if both are laid out the same way. A section with nothing in it is
 * dropped rather than shown empty.
 *
 * The shape is: what the business is, what we think, then why we think it —
 * `recommendation` sits second, above the assessments it rests on. An analyst
 * opening a file wants the call before the working, and the four assessments
 * beneath it are what they read when they want to disagree with it.
 *
 * `description` is deliberately absent — it is the lede, not a peer of the
 * assessments, and a heading between it and the top of the message makes one
 * opening read as two.
 *
 * The headings do not repeat the word "assessment" — the tab is already called
 * that, and four headings ending in it read as filing labels rather than prose.
 */
const SECTIONS: Array<{ id: AssessmentSectionId; heading: string }> = [
  { id: 'recommendation', heading: 'Recommendation' },
  { id: 'identity', heading: 'Business identity' },
  { id: 'ownership', heading: 'Ownership' },
  { id: 'activity', heading: 'Activity' },
  { id: 'compliance', heading: 'Compliance and screening' }
]

/** The assessments proper — everything the policy runs, minus the conclusion. */
const ASSESSMENTS = SECTIONS.filter((s) => s.id !== 'recommendation')

/**
 * What is actually happening while the analysis is being written, in the order
 * it happens. The last step stays `active` — it is the one still running.
 */
const thinkingSteps = (
  insightCount: number,
  {
    slow = false,
    done = false,
    used = 0,
    policy = false,
    counts,
    written = new Set<string>()
  }: {
    slow?: boolean
    done?: boolean
    used?: number
    policy?: boolean
    /**
     * Which assessments are on disk right now. The session writes the
     * assessments file one section at a time, so this genuinely grows during a
     * run — the steps tick over because the work landed, not on a timer.
     */
    written?: Set<string>
    /** What each assessment rested on, once there is a result to count. */
    counts?: Map<string, string>
  } = {}
): ChatThinkingStep[] => {
  const allWritten = done || ASSESSMENTS.every((a) => written.has(a.id))

  return [
  // While running, the policy is the summary line — repeating it as a step says
  // the same thing twice. Once settled the summary becomes "Thought for 6s", so
  // the policy moves into the steps to keep the context.
  ...(policy && done
    ? [
        {
          id: 'policy',
          label: `Ran against the ${POLICY.name} policy`,
          description: 'Identity, operating status, control, screening, blockers',
          status: 'complete' as const
        }
      ]
    : []),
  {
    id: 'read',
    label: 'Read the business identity record',
    description: done ? `${used} of ${insightCount} insights used` : `${insightCount} insights available`,
    status: 'complete'
  },
  // Selection is not finished until every assessment it named has been written.
  // A tick here while four steps below it are still pending would be claiming
  // the work was scoped when it was only listed.
  {
    id: 'select',
    label: `${allWritten ? 'Selected' : 'Selecting'} the assessments the policy requires`,
    description: allWritten
      ? `${ASSESSMENTS.length} assessments`
      : `${written.size} of ${ASSESSMENTS.length} written`,
    status: (allWritten ? 'complete' : 'active') as ChatThinkingStep['status']
  },
  // One step per assessment, because the assessments are what is being run —
  // naming them is the difference between a progress bar and an account of the
  // work. While waiting they are `pending` rather than ticking over one by one:
  // the session writes the report in a single pass, and animating four fake
  // stages would be inventing progress we cannot see.
  ...ASSESSMENTS.map(({ id, heading }, i) => {
    const landed = done || written.has(id)
    // The one being worked on is the first that has not landed — every earlier
    // assessment is on disk, so this is where the session actually is.
    const next = !landed && ASSESSMENTS.slice(0, i).every((a) => written.has(a.id))
    return {
      id: `assess:${id}`,
      label: `${landed ? 'Generated' : 'Generate'} ${heading.toLowerCase()} assessment`,
      description: counts?.get(id),
      status: (landed ? 'complete' : next ? 'active' : 'pending') as ChatThinkingStep['status']
    }
  }),
  // Last, and after the four above it: the recommendation is a reading OF the
  // assessments, so it cannot be the step that produces them. The report is
  // rendered verdict-first for the reader; it is not reasoned that way.
  {
    id: 'assess:recommendation',
    label: `${done ? 'Weighed' : 'Weigh'} the assessments into a recommendation`,
    description: counts?.get('recommendation'),
    status: (done ? 'complete' : allWritten ? 'active' : 'pending') as ChatThinkingStep['status']
  },
    ...(slow && !done
      ? [
          {
            id: 'slow',
            label: 'Still waiting on the session',
            description: 'The request is in prototype/analysis/pending.json',
            status: 'active' as const
          }
        ]
      : [])
  ]
}

const WHY: Record<CouldNotConfirmReason, string> = {
  not_published: 'the state does not publish it',
  not_held_or_unreachable: 'we do not hold it',
  not_required: 'not required for this kind of business',
  no_insight_covers_it: 'no insight covers it'
}

/**
 * A paragraph of the analysis.
 *
 * The section it belongs to is a bold lead-in on the first paragraph rather
 * than a heading above a stack — a heading plus one-line items reads as a
 * checklist, and this is an argument being made to an analyst.
 *
 * Findings are not marked or coloured, including the ones that count against the
 * business. An assessment states what the record shows; what to DO about it is
 * the recommendation's job, and it is the only part of the report that should
 * read as actionable.
 */
const Para = ({
  lead,
  sources,
  cites,
  results,
  categories,
  onJumpToGroup,
  children
}: {
  lead?: string
  sources?: Array<{ title: string; url: string }>
  cites?: string[]
  results: Derived[]
  categories: Map<string, string>
  onJumpToGroup: (groupId: string, insightIds: string[]) => void
  children: React.ReactNode
}) => {
  const body = (
    <Text>
      {lead && <span className="font-semibold">{lead} </span>}
      {children}
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
      {cites && cites.length > 0 && (
        <span className="ml-1.5 align-middle">
          <AnalysisSources
            used={cites}
            results={results}
            categories={categories}
            onSelect={onJumpToGroup}
            inline
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
 */
const SectionBody = ({
  section,
  results,
  categories,
  onJumpToGroup
}: {
  section: AssessmentSection
  results: Derived[]
  categories: Map<string, string>
  onJumpToGroup: (groupId: string, insightIds: string[]) => void
}) => (
  <>
    {section.body.map((b) => (
      <Para
        key={b.text}
        sources={b.sources}
        cites={b.cites}
        results={results}
        categories={categories}
        onJumpToGroup={onJumpToGroup}
      >
        {b.text}
      </Para>
    ))}

    {section.gaps?.map((g, i) => (
      <Para
        key={g.point}
        lead={i === 0 ? 'Not established.' : undefined}
        cites={g.cites}
        results={results}
        categories={categories}
        onJumpToGroup={onJumpToGroup}
      >
        {g.point}{' '}
        <span className="text-[var(--core-color-text-muted)]">
          — {WHY[g.why]}
          {g.wouldAnswer ? `. ${g.wouldAnswer}` : ''}
          {/* Written off rather than closed: shown, because a decision nobody
              can see is indistinguishable from an oversight. */}
          {g.noAction ? ` No follow-up: ${g.noAction}` : ''}
        </span>
      </Para>
    ))}
  </>
)

/**
 * The follow-ups, in priority order.
 *
 * A numbered list would imply a sequence that has to be worked through in order;
 * these are independent items that merely happen to be ranked, so they are
 * bulleted and the ranking is carried by the order alone.
 */
const FollowUps = ({
  items,
  results,
  categories,
  onJumpToGroup
}: {
  items: NonNullable<AnalysisResult['followUps']>
  results: Derived[]
  categories: Map<string, string>
  onJumpToGroup: (groupId: string, insightIds: string[]) => void
}) => (
  <ul className="mt-3 list-disc space-y-2 pl-5 marker:text-[var(--core-color-text-muted)]">
    {items.map((f) => (
      <li key={f.text}>
        <Text>
          {f.text}
          {f.cites && f.cites.length > 0 && (
            <span className="ml-1.5 align-middle">
              <AnalysisSources
                used={f.cites}
                results={results}
                categories={categories}
                onSelect={onJumpToGroup}
                inline
              />
            </span>
          )}
        </Text>
      </li>
    ))}
  </ul>
)

/**
 * What each assessment came out with, for its thinking step. Counted off the
 * result rather than asserted: a step claiming work that produced nothing is
 * the same lie as an empty disclosure.
 */
const assessmentCounts = (result: AnalysisResult | AnalysisDraft) => {
  const counts = new Map(
    result.sections.map((s) => {
      const gaps = s.gaps?.length ?? 0
      return [
        s.id as string,
        [
          `${s.body.length} finding${s.body.length === 1 ? '' : 's'}`,
          ...(gaps > 0 ? [`${gaps} gap${gaps === 1 ? '' : 's'}`] : [])
        ].join(' · ')
      ]
    })
  )

  if ('followUps' in result) {
    const followUps = result.followUps?.length ?? 0
    counts.set('recommendation', `${followUps} follow-up${followUps === 1 ? '' : 's'}, ranked`)
  }
  return counts
}

/**
 * The report itself, from either stage.
 *
 * A draft has assessments and no verdict; a settled result has both. The same
 * component renders each, so what a reader sees mid-run is literally the
 * finished report minus the part that has not been written.
 */
const ReportBody = ({
  result,
  results,
  categories,
  onJumpToGroup
}: {
  result: AnalysisResult | AnalysisDraft
  results: Derived[]
  categories: Map<string, string>
  onJumpToGroup: (groupId: string, insightIds: string[]) => void
}) => {
  const verdict = 'headline' in result ? result : null
  const followUps = verdict?.followUps ?? []
  const byId = new Map(result.sections.map((s) => [s.id, s]))
  const answer = byId.get('answer')
  const hasRecs = followUps.length > 0
  /** Whether a Recommendation block will render at all — the verdict goes there
   *  if one does, and must not also lead the message. */
  const hasRecommendation = byId.has('recommendation') || hasRecs

  const pass = { results, categories, onJumpToGroup }

  return (
    <>
      {/* The lede is not rendered here. It describes the business rather than
          the assessment, so it sits under the business name where every tab can
          see it — see BusinessLede. */}

      {/* A question has no recommendation to land in, so its one-sentence answer
          leads instead — the same sentence, in the only place it can go. */}
      {verdict && !hasRecommendation && <Text className="mt-2">{verdict.headline}</Text>}

      {/* A follow-up question is answered on its own terms — running it through
          the standing headings would be filing, not answering. */}
      {answer && <SectionBody section={answer} {...pass} />}

      {SECTIONS.map(({ id, heading }) => {
        const section = byId.get(id)
        // The recommendation lists are the tail of their section, so that
        // heading stands even when the session wrote no prose above them.
        const tail = id === 'recommendation' && hasRecs
        if (!section && !tail) return null

        return (
          <div key={id} className="mt-7">
            <Heading level={3}>{heading}</Heading>
            {/* The verdict sentence is the recommendation's first line, where
                the conclusion is drawn — not floating above the whole message
                unattached to the section that argues it. */}
            {id === 'recommendation' && verdict && (
              <Text className="mt-3">{verdict.headline}</Text>
            )}
            {section && <SectionBody section={section} {...pass} />}
            {tail && <FollowUps items={followUps} {...pass} />}
          </div>
        )
      })}
    </>
  )
}

const Answer = ({
  version,
  results,
  categories,
  onJumpToGroup
}: {
  version: AnalysisVersion
  results: Derived[]
  categories: Map<string, string>
  onJumpToGroup: (groupId: string, insightIds: string[]) => void
}) => {
  const { result } = version

  return (
    <ChatMessage
      role="assistant"
      footer={
        <AnalysisSources
          used={result.used}
          results={results}
          categories={categories}
          onSelect={onJumpToGroup}
        />
      }
    >
      {/* First child of the turn, per the primitive's contract: collapsed it is
          one muted "Thought for 4s" line, and it stays in the transcript for
          scroll-back. Duration is milliseconds; the primitive runs no timer. */}
      <ChatThinking
        duration={version.durationMs}
        steps={thinkingSteps(version.insightCount, {
          done: true,
          used: result.used.length,
          counts: assessmentCounts(result)
        })}
      />

      <ReportBody
        result={result}
        results={results}
        categories={categories}
        onJumpToGroup={onJumpToGroup}
      />
    </ChatMessage>
  )
}

/**
 * The analysis as a conversation.
 *
 * Each turn is the question and the answer beneath it, stacking as you ask more
 * — not a panel that replaces itself. While the session is writing, a pending
 * turn sits at the bottom, which is where a reader looks for it.
 */
export const AnalysisPanel = ({
  versions,
  results,
  categories,
  waiting,
  waitingKind,
  draft,
  slow,
  error,
  onJumpToGroup
}: {
  versions: AnalysisVersion[]
  results: Derived[]
  categories: Map<string, string>
  waiting: boolean
  /** Stage one, on screen while the verdict is still being written. */
  draft: AnalysisDraft | null
  /** What is being run right now, so the thinking summary can say so. */
  waitingKind: 'report' | 'question' | null
  slow: boolean
  error: string | null
  onJumpToGroup: (groupId: string, insightIds: string[]) => void
}) => {
  const kind = waitingKind ?? 'report'

  if (versions.length === 0 && !waiting && !error) return null

  return (
    <div className="space-y-1">
      {versions.map((v) => (
        <div key={v.id}>
          {/* The standing report has no user turn above it — it opens the
              transcript, so a marker announcing it is just a line to scroll past. */}
          {v.kind === 'question' && <ChatMessage role="user">{v.prompt}</ChatMessage>}
          <Answer
            version={v}
            results={results}
            categories={categories}
            onJumpToGroup={onJumpToGroup}
          />
        </div>
      ))}

      {waiting && (
        <ChatMessage role="assistant" busy>
          <ChatThinking
            active
            label={
              draft
                ? 'Weighing the assessments into a recommendation'
                : kind === 'report'
                  ? `Running against the ${POLICY.name} policy`
                  : 'Answering against the business identity record'
            }
            steps={thinkingSteps(results.length, {
              slow,
              policy: kind === 'report',
              written: new Set(draft?.sections.map((s) => s.id) ?? []),
              used: draft?.used.length ?? 0,
              counts: draft ? assessmentCounts(draft) : undefined
            })}
          />

          {/* The assessments, already written, while the verdict is not. This
              is the whole point of two stages: the reader watches the argument
              land before the conclusion it supports. */}
          {draft && (
            <ReportBody
              result={draft}
              results={results}
              categories={categories}
              onJumpToGroup={onJumpToGroup}
            />
          )}
        </ChatMessage>
      )}

      {error && (
        <Text tone="danger" className="px-1">
          {error}
        </Text>
      )}
    </div>
  )
}
