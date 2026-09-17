import { useState } from 'react'

import { CubeIcon } from '@radix-ui/react-icons'
import { Check } from 'lucide-react'

import {
  ChatMessage,
  ChatSources,
  ChatThinking,
  Heading,
  Spinner,
  Tag,
  Text,
  type ChatThinkingStep
} from '@/core'

/** Seconds, the way core formats them — it does not export its own. */
const duration = (ms: number) => {
  const total = Math.max(1, Math.round(ms / 1000))
  const m = Math.floor(total / 60)
  const sec = total % 60
  if (m === 0) return `${sec}s`
  return sec === 0 ? `${m}m` : `${m}m ${sec}s`
}

/**
 * The run's state, as a glyph beside its summary.
 *
 * A shimmering line says something is happening but not that it is still
 * happening — it reads the same the moment it settles. A spinner turns while
 * the work is live and becomes a tick when it is not, which is the one thing a
 * reader checks when they come back to the page.
 */
const RunLabel = ({ busy, children }: { busy: boolean; children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-1.5">
    {busy ? (
      <Spinner size="sm" tone="muted" label={false} />
    ) : (
      <Check aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
    )}
    {children}
  </span>
)


/**
 * The user's turn: the skills that were sent, and anything typed with them.
 *
 * The tokens come from what the composer recorded, not from matching the
 * prompt text back to a skill — the prompt is now several skills' instructions
 * concatenated, so a text match fails and the whole composed brief printed
 * itself into the transcript. What a skill SAYS is read by opening it, not by
 * reading the turn.
 */
const SkillTurn = ({
  skills = [],
  typed = ''
}: {
  skills?: string[]
  typed?: string
}) => {
  if (skills.length === 0 && !typed) return null

  return (
    // Fixed at the top while the answer scrolls under it: a report runs to
    // several screens, and what was asked is the thing a reader loses first.
    <div className="sticky top-0 z-nav -mx-1 bg-background px-1 py-1">
    <ChatMessage role="user">
      {skills.length > 0 && (
        <span className="flex flex-wrap items-center gap-1.5">
          {skills.map((name) => (
            // The same glyph the composer's token carries. Dropping it here
            // made the sent turn a different object from the thing that was
            // sent.
            <Tag
              key={name}
              tone="subtle"
              size="compact"
              icon={<CubeIcon aria-hidden="true" className="size-3" />}
            >
              {name}
            </Tag>
          ))}
        </span>
      )}
      {typed && <span className={skills.length > 0 ? 'mt-1.5 block' : undefined}>{typed}</span>}
    </ChatMessage>
    </div>
  )
}

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
 * opening a file wants the call before the working, and the stages beneath it
 * are what they read when they want to disagree with it.
 *
 * The stages are the ones an account-opening file is actually built from —
 * identification, ownership, purpose, screening, adverse information — rather
 * than the shape of the record we happen to hold. A file assembled in this
 * order can be handed to a reviewer as it stands.
 *
 * `description` is deliberately absent — it is the lede, not a peer of the
 * assessments, and a heading between it and the top of the message makes one
 * opening read as two.
 *
 * The headings do not repeat the word "assessment" — the tab is already called
 * that, and five headings ending in it read as filing labels rather than prose.
 */
const SECTIONS: Array<{ id: AssessmentSectionId; heading: string }> = [
  { id: 'identification', heading: 'Customer identification' },
  { id: 'ownership', heading: 'Beneficial ownership and control' },
  { id: 'purpose', heading: 'Nature and purpose of the account' },
  { id: 'screening', heading: 'Sanctions and screening' },
  { id: 'adverse', heading: 'Adverse information and financial standing' },
  // Last, where it is reached: the turn, then the run, then the assessments it
  // worked through, then what they come to. Sitting first it was a conclusion
  // the reader met before any of the work it rests on.
  { id: 'recommendation', heading: 'Recommendation' }
]

/** The assessments proper — everything the policy runs, minus the conclusion. */
const ASSESSMENTS = SECTIONS.filter((s) => s.id !== 'recommendation')

/**
 * The steps a run works through.
 *
 * Taken from the assessment that was sent, not from a fixed list: the policy is
 * whatever the customer built `SMB account opening` out of, and naming five
 * standing stages while six of theirs ran said the wrong thing about work the
 * reader can watch happening. Falls back to the standing sections only when
 * nothing was passed — a question, or a run from before parts existed.
 */
const stepsOf = (policy: string[]) =>
  policy.length > 0
    ? policy.map((name, i) => ({ id: `policy:${i}`, heading: name }))
    : ASSESSMENTS

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
const thinkingSteps = (
  insightCount: number,
  {
    slow = false,
    done = false,
    used = 0,
    written = 0,
    started = false,
    acknowledged = false,
    policy = []
  }: {
    slow?: boolean
    done?: boolean
    used?: number
    /** The session has begun writing — the first section is on disk. */
    started?: boolean
    /** The server has the request. Until then nothing is under way and the
     *  summary says only that the assessment is running. */
    acknowledged?: boolean
    /** How many assessments are on disk right now. */
    written?: number
    /** The assessments inside the one that runs, in order. */
    policy?: string[]
  } = {}
): ChatThinkingStep[] => {
  const allWritten = done || written >= policy.length
  const status = (i: number): ChatThinkingStep['status'] =>
    done || written > i ? 'complete' : written === i && started ? 'active' : 'pending'

  return [
    /**
     * The first two steps tick over on real events, not on arrival.
     *
     * Marked complete from the first paint they were never seen happening, and
     * the run appeared to begin at step three — which is what made it read as a
     * decoration rather than an account of the work. Reading is finished when
     * the session's first write lands; selecting is finished when the first
     * assessment does.
     */
    {
      id: 'read',
      label: done || started ? 'Read the business identity record' : 'Reading the business identity record',
      description: done
        ? `${used} of ${insightCount} insights used`
        : `${insightCount} insights available`,
      status: (done || started
        ? 'complete'
        : acknowledged
          ? 'active'
          : 'pending') as ChatThinkingStep['status']
    },
    {
      id: 'select',
      label: done || written > 0 ? 'Assembled assessments' : 'Assemble assessments',
      // Counts up as they land: "5 assessments" sat unchanged through the one
      // part of the run a reader can actually watch progress.
      description: done
        ? `${policy.length} assessment${policy.length === 1 ? '' : 's'}`
        : `${Math.min(written, policy.length)} of ${policy.length} assessments`,
      status: (done || written > 0
        ? 'complete'
        : started
          ? 'active'
          : 'pending') as ChatThinkingStep['status']
    },

    // One per assessment, because the assessments are what is being run.
    // Indented under the step that assembled them: they are its contents, and
    // flat they read as peers of "read the record" rather than as the list it
    // just put together. `ChatThinkingStep` has no depth, so the indent is in
    // the label.
    ...policy.map((name, i) => ({
      id: `assess:${i}`,
      label: `\u00a0\u00a0\u00a0\u00a0${name}`,
      status: status(i)
    })),

    {
      id: 'context',
      label: done ? 'Considered context' : 'Consider context',
      status: (done ? 'complete' : allWritten ? 'active' : 'pending') as ChatThinkingStep['status']
    },
    {
      id: 'recommendation',
      label: done ? 'Built a recommendation' : 'Build a recommendation',
      status: (done ? 'complete' : 'pending') as ChatThinkingStep['status']
    },

    ...(slow && !done
      ? [
          {
            id: 'slow',
            label: 'Still waiting on the session',
            status: 'active' as const
          }
        ]
      : [])
  ]
}

export const WHY: Record<CouldNotConfirmReason, string> = {
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
export const Para = ({
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
export const SectionBody = ({
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
  onJumpToGroup,
  wrapRun
}: {
  version: AnalysisVersion
  results: Derived[]
  categories: Map<string, string>
  onJumpToGroup: (groupId: string, insightIds: string[]) => void
  /** Puts the workflow disclosure on the run's summary line. Only on the report
   *  turn: a question is its own prompt and already shows as the user message
   *  above the answer. */
  wrapRun?: (run: React.ReactNode) => React.ReactNode
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
      {(() => {
        const run = (
          <ChatThinking
            label={<RunLabel busy={false}>Thought for {duration(version.durationMs)}</RunLabel>}
            steps={thinkingSteps(version.insightCount, {
              done: true,
              started: true,
              used: result.used.length,
              policy: version.policy ?? []
            })}
          />
        )
        return wrapRun ? wrapRun(run) : run
      })()}

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
  waitingSkills,
  waitingTyped,
  policy,
  acknowledged,
  insightCount,
  draft,
  slow,
  error,
  onJumpToGroup,
  superseded
}: {
  versions: AnalysisVersion[]
  results: Derived[]
  categories: Map<string, string>
  waiting: boolean
  /** Stage one, on screen while the verdict is still being written. */
  draft: AnalysisDraft | null
  /** What is being run right now, so the thinking summary can say so. */
  waitingKind: 'report' | 'question' | null
  /** And what was sent, so the turn is on screen before the answer is. */
  waitingSkills: string[]
  waitingTyped: string
  /** The assessments inside the one that runs, named in the order they run. */
  policy: string[]
  /** The server has the request. */
  acknowledged: boolean
  /** Insights this business actually has — the Insights tab's own count. */
  insightCount: number
  slow: boolean
  error: string | null
  onJumpToGroup: (groupId: string, insightIds: string[]) => void
  superseded: AnalysisVersion[]
}) => {
  const kind = waitingKind ?? 'report'

  /**
   * The run's steps start collapsed.
   *
   * `ChatThinking` opens itself whenever it is active and has steps, which put
   * a nine-line list on screen for every run before the reader asked for it —
   * the summary line already says what is happening. Controlled here so it
   * starts shut and still opens on click.
   */
  const [stepsOpen, setStepsOpen] = useState(false)



  if (versions.length === 0 && !waiting && !error) return null

  return (
    <div className="space-y-1">
      {versions.map((v) => (
        <div key={v.id}>
          {/* The standing report has no user turn above it — it opens the
              transcript, so a marker announcing it is just a line to scroll past. */}
          <SkillTurn
            skills={v.skills}
            typed={v.typed ?? (v.skills?.length ? '' : v.prompt)}
          />
          <Answer
            version={v}
            results={results}
            categories={categories}
            onJumpToGroup={onJumpToGroup}
          />
        </div>
      ))}

      {waiting && (
        <>
          {/* The turn appears on submit, not when the answer lands — what was
              sent is the first thing a reader looks for after sending it. */}
          <SkillTurn skills={waitingSkills} typed={waitingTyped} />
          <ChatMessage role="assistant" busy>
          {(() => {
            const steps = thinkingSteps(insightCount, {
              slow,
              policy,
              // Counted, not keyed: a customer's assessment names do not map to
              // the report's standing section ids.
              started: draft !== null,
              acknowledged,
              written: (draft?.sections ?? []).filter((x) => x.id !== 'description').length,
              used: draft?.used.length ?? 0
            })

            /**
             * The summary says what is happening right now, not what was
             * started.
             *
             * A fixed "Running …" line sat unchanged for the length of a run
             * while six steps came and went underneath it, so the one line a
             * reader sees collapsed was the one line that never told them
             * anything. Expanded, every step is still there.
             */
            const active = steps.find((x) => x.status === 'active')

            const run = (
              <ChatThinking
                active
                /**
                 * Open, but only as far as the work has got.
                 *
                 * Collapsed, the one line on screen changed every few seconds
                 * and nothing was kept. Fully expanded, nine steps appeared at
                 * once before any of them had happened. Showing the stages that
                 * have started — and leaving them there — is the difference
                 * between a progress indicator and an account of the work.
                 */
                open
                onOpenChange={setStepsOpen}
                label={
                  <RunLabel busy>
                    {(active?.label ??
                      (kind === 'report'
                        ? 'Running assessment'
                        : 'Answering against the record')
                    ).trim()}
                  </RunLabel>
                }
                steps={steps.filter((x) => x.status !== 'pending')}
              />
            )
            return run
          })()}

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
        </>
      )}

      {error && (
        <Text tone="danger" className="px-1">
          {error}
        </Text>
      )}
    </div>
  )
}
