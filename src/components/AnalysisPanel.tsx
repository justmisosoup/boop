import { useState } from 'react'

import { CubeIcon } from '@radix-ui/react-icons'
import { Check } from 'lucide-react'

import {
  ChatMessage,
  ChatSources,
  ChatThinking,
  Heading,
  MutedText,
  Spinner,
  Surface,
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



import { POLICY } from '../lib/useAnalysis'


import type { BusinessRecord, Derived } from '../lib/deriveResults'
import type { AnalysisVersion } from '../lib/useAnalysis'
import type {
  AnalysisDraft,
  AnalysisResult,
  AssessmentSection,
  AssessmentSectionId,
  CouldNotConfirmReason
} from '../types'
import { AnalysisSources } from './AnalysisSources'
import { attributesFor } from '../lib/attributes'
import { StateMark } from './StateMark'
import { makeGroupFor } from '../lib/groups'
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
/**
 * The report's shape is the manifest, not a fixed list.
 *
 * `recommendation` leads: it is the call, and an analyst wants the call before
 * the working. It still RUNS last, because it reads every assessment.
 */
const sectionsOf = (policy: Array<{ id: string; name: string }>) => [
  { id: 'recommendation', heading: 'Recommendation' },
  ...policy.map(({ id, name }) => ({ id, heading: name }))
]

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

const thinkingSteps = (
  insightCount: number,
  {
    slow = false,
    done = false,
    used = 0,
    started = false,
    acknowledged = false,
    arrived = [],
    policy = []
  }: {
    slow?: boolean
    done?: boolean
    used?: number
    started?: boolean
    acknowledged?: boolean
    /** Assessment ids on disk right now, in whatever order they finished. */
    arrived?: string[]
    policy?: Array<{ id: string; name: string }>
  } = {}
): ChatThinkingStep[] => {
  const landed = new Set(arrived)
  const written = policy.filter((a) => landed.has(a.id)).length
  const allWritten = done || (policy.length > 0 && written >= policy.length)
  /** Once the request is in, every assessment is under way at the same time. */
  const status = (id: string): ChatThinkingStep['status'] =>
    done || landed.has(id) ? 'complete' : acknowledged ? 'active' : 'pending'

  return [
    {
      id: 'read',
      label: done || started ? 'Read the business identity record' : 'Reading the business identity record',
      description: done ? `${used} of ${insightCount} insights used` : `${insightCount} insights available`,
      status: (done || started ? 'complete' : acknowledged ? 'active' : 'pending') as ChatThinkingStep['status']
    },
    {
      id: 'select',
      label: done || written > 0 ? 'Assembled assessments' : 'Assemble assessments',
      description: done
        ? `${policy.length} assessment${policy.length === 1 ? '' : 's'}`
        : `${Math.min(written, policy.length)} of ${policy.length} assessments`,
      status: (done || policy.length > 0 ? 'complete' : acknowledged ? 'active' : 'pending') as ChatThinkingStep['status']
    },
    ...policy.map(({ id, name }) => ({
      id: `assess:${id}`,
      label: `\u00a0\u00a0\u00a0\u00a0${name}`,
      status: status(id)
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
    ...(slow && !done ? [{ id: 'slow', label: 'Still waiting on the session', status: 'active' as const }] : [])
  ]
}

/**
 * The checks a sentence rests on, under the sentence.
 *
 * The chip alone said "Insights · 5" and opened a popover of categories, which
 * sent the reader to the reference panel and away from the argument. What a
 * citation is asked is "which checks say this" — a short list that belongs
 * directly beneath the claim.
 */
const CiteList = ({
  cited,
  categories,
  record,
  onJumpToGroup
}: {
  cited: Derived[]
  categories: Map<string, string>
  record?: BusinessRecord
  /** A run is being written, so sections not yet here are coming. */
  stream?: boolean
  onJumpToGroup: (groupId: string, insightIds: string[]) => void
}) => {
  const groupOf = makeGroupFor(categories)

  /**
   * The attributes, not the insights.
   *
   * An insight is a reading of a value — "we identified a name we believe is
   * different from the submitted business name" — and the reading was already
   * made in the sentence above. What the sentence cannot carry is the value
   * itself, which is the thing a reviewer writes down: Kairos Physio, 801
   * Madison Ave Fl 3, the TIN. So the card is the attribute, labelled, and the
   * insight is only what selects it and where it jumps to.
   *
   * Deduplicated on label and value: several checks read the same attribute,
   * and the business name would otherwise appear four times.
   */
  const seen = new Set<string>()
  const rows = cited.flatMap((r) =>
    (record ? attributesFor(r.insightId, record) : [])
      .filter((a) => a.value && a.label)
      .map((a) => ({ label: a.label, value: a.value as string, from: r }))
      .filter((a) => {
        const key = `${a.label}\u0000${a.value}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
  )

  if (rows.length === 0) return null

  return (
    <Surface variant="default" padding="none" className="mt-2 overflow-hidden">
      {/* A single attribute runs full width; the split starts at two. */}
      <div className={`-mb-px -mr-px grid${rows.length > 1 ? ' sm:grid-cols-2' : ''}`}>
        {rows.map((a) => (
          <button
            key={`${a.label}-${a.value}`}
            type="button"
            onClick={() => onJumpToGroup(groupOf(a.from.insightId), [a.from.insightId])}
            className="border-b border-r border-solid border-border px-3 py-2 text-left transition-colors hover:bg-[var(--core-color-state-hover-bg)]"
          >
            <MutedText className="block text-caption leading-snug">{a.label}</MutedText>
            <span className="mt-0.5 block text-sm leading-snug">{a.value}</span>
          </button>
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

export const Para = ({
  lead,
  sources,
  cites,
  results,
  categories,
  record,
  onJumpToGroup,
  children
}: {
  lead?: string
  sources?: Array<{ title: string; url: string }>
  cites?: string[]
  results: Derived[]
  categories: Map<string, string>
  record?: BusinessRecord
  onJumpToGroup: (groupId: string, insightIds: string[]) => void
  children: React.ReactNode
}) => {
  const cited = useCited(cites, results)

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
    </Text>
  )

  return (
    <div className="mt-3">
      {body}
      {cited.length > 0 && (
        <CiteList cited={cited} categories={categories} record={record} onJumpToGroup={onJumpToGroup} />
      )}
    </div>
  )
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
  record,
  onJumpToGroup
}: {
  section: AssessmentSection
  results: Derived[]
  categories: Map<string, string>
  record?: BusinessRecord
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
        record={record}
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
        record={record}
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
   * Not a bulleted list. The follow-ups are the only part of the report meant
   * to read as actionable, and a disc with an indent behind it made them the
   * report's footnotes. Set flush and bold, they are the thing to do.
   */
  <ul className="mt-3 list-none space-y-3 pl-0">
    {items.map((f) => (
      <li key={f.text}>
        <Text className="font-semibold">{f.text}</Text>
        {/* The things the step acts on, named. A step that says "establish who
            is behind the connected businesses" is not actionable until the
            businesses are on screen. */}
        {f.entities && f.entities.length > 0 && (
          <Surface variant="default" padding="none" className="mt-2 overflow-hidden">
            <div
              className={`-mb-px -mr-px grid${f.entities.length > 1 ? ' sm:grid-cols-2' : ''}`}
            >
              {f.entities.map((e) => (
                <div
                  key={e.name}
                  className="border-b border-r border-solid border-border px-3 py-2"
                >
                  <span className="block text-sm leading-snug">{e.name}</span>
                  {e.note && (
                    <MutedText className="mt-0.5 block text-caption leading-snug">
                      {e.note}
                    </MutedText>
                  )}
                </div>
              ))}
            </div>
          </Surface>
        )}
      </li>
    ))}
  </ul>
)

const ReportBody = ({
  result,
  results,
  categories,
  policy,
  record,
  stream = false,
  onJumpToGroup
}: {
  result: AnalysisResult | AnalysisDraft
  results: Derived[]
  categories: Map<string, string>
  /** The assessments this run was composed of — the report's layout. */
  policy: Array<{ id: string; name: string }>
  record?: BusinessRecord
  /** A run is being written, so sections not yet here are coming. */
  stream?: boolean
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

  const pass = { results, categories, record, onJumpToGroup }

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

      {sectionsOf(policy)
        .filter(({ id }) => byId.has(id) || (id === 'recommendation' && hasRecs))
        .map(({ id, heading }, i) => {
        const section = byId.get(id)
        // The recommendation lists are the tail of their section, so that
        // heading stands even when the session wrote no prose above them.
        const tail = id === 'recommendation' && hasRecs
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
            className={[
              // A rule between sections, counted over the sections that actually
              // rendered rather than over the manifest. Keyed to manifest
              // position, a first section that had not landed yet left the
              // second one drawing a divider against nothing: an empty band and
              // a rule at the very top of the report.
              i > 0 ? 'mt-7 border-t border-solid border-border pt-7' : '',
              'scroll-mt-6'
            ].join(' ')}
          >
            {/* Body size, bold. `Heading level={3}` sets these at 18px, which made
               five section titles compete with the report they label. */}
            <Text className="block font-semibold">{heading}</Text>
            {/* The verdict sentence is the recommendation's first line, where
                the conclusion is drawn — not floating above the whole message
                unattached to the section that argues it. */}
            {id === 'recommendation' && verdict && (
              <Text className="mt-3">{verdict.headline}</Text>
            )}
            {section && <SectionBody section={section} {...pass} />}
            {tail && <FollowUps items={followUps} />}
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
  record,
  onJumpToGroup,
  wrapRun
}: {
  version: AnalysisVersion
  results: Derived[]
  record?: BusinessRecord
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
      {/* No "Thought for 5s" here. The run's account of itself is in the left
          rail, beside the contents it produced; printing it over the report as
          well was the same line twice. */}

      <ReportBody
        result={result}
        results={results}
        categories={categories}
        record={record}
        policy={version.policy ?? []}
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
  record,
  arrived = [],
  business,
  entityLine,
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
  /** The record itself, so a cited check can show the value behind it. */
  record?: BusinessRecord
  /** Assessment ids on disk right now. */
  arrived?: string[]
  business?: string
  entityLine?: string
  waiting: boolean
  /** Stage one, on screen while the verdict is still being written. */
  draft: AnalysisDraft | null
  /** What is being run right now, so the thinking summary can say so. */
  waitingKind: 'report' | 'question' | null
  /** And what was sent, so the turn is on screen before the answer is. */
  waitingSkills: string[]
  waitingTyped: string
  /** The assessments inside the one that runs, named in the order they run. */
  policy: Array<{ id: string; name: string }>
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
          <Answer
            version={v}
            results={results}
            categories={categories}
            record={record}
            onJumpToGroup={onJumpToGroup}
          />
        </div>
      ))}

      {waiting && (
        <>
          <ChatMessage role="assistant" busy>
          {/* Nothing here while it runs. The left rail carries the run's state
              and each section's progress; a "Running assessment" block over the
              report said the same thing a second time, in the column meant for
              the report. */}

          {/* The assessments, already written, while the verdict is not. This
              is the whole point of two stages: the reader watches the argument
              land before the conclusion it supports. */}
          {draft && (
            <ReportBody
              result={draft}
              results={results}
              categories={categories}
              record={record}
              policy={policy}
              stream
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
