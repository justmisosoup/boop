import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from 'react'
import { ArrowLeft, Ellipsis, FileText, History, MessageSquare, Plus, X } from 'lucide-react'

import {
  ChatLog,
  ChatMarker,
  ChatSuggestions,
  Dialog,
  FloatingPanel,
  FloatingPanelBody,
  FloatingPanelHeader,
  FloatingPanelTitle,
  IconActionButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
  MutedText,
  Text,
  type FloatingPanelPresentation,
  type FloatingPanelState
} from '@/core'

import type { BusinessRecord, Derived } from '../../lib/deriveResults'
import type { GroupId } from '../../lib/groups'
import { KIND_WORD, type BriefCard, type ReportBrief, type ReportFocus } from '../../lib/reportBrief'
import { formatTime, reportDate, reportLabel } from '../../lib/reportLabels'
import { undoAnswer } from '../../lib/review'
import type { CustomerSkill } from '../../lib/useAgent'
import type { RevisedRecommendation } from '../../types'
import type { useAnalysis } from '../../lib/useAnalysis'
import { cn } from '../../utils/twUtils'
import { MiddeskMark } from '../MiddeskMark'
import { AssistantComposer, type Send } from './AssistantComposer'
import { AssistantEmpty } from './AssistantEmpty'
import { AnswerTurn, BriefTurn, DecisionTurn, DismissedTurn, ErrorTurn, PendingTurn, UserTurn } from './AssistantTurn'
import { RecommendationCard, restoreRecommendation, useAnsweredCall, useRecommendationRemoval } from './RecommendationCard'
import { Conversations, conversationTitle, pastConversations, type AssessmentEntry } from './Conversations'
import { suggestionsFor } from './starters'

/** How many conversations History's dropdown lists before "Show all". */
const RECENT_CONVERSATIONS = 5

/**
 * Kha's Assistant, on the kit's `FloatingPanel`.
 *
 * One panel, two presentations and three states. Docked, it is the page's
 * right-hand column; floating, a window over the report; expanded, a wide
 * window; and minimised, the launcher pill. The header carries the mark, the
 * name, and four controls — history, new conversation, options, minimise —
 * and switches to the conversations list with a back arrow, the way the
 * Explorer dock's home ⇄ thread grammar does (`app/src/containers/Explorer/
 * chat/ExplorerChat.tsx`, which this is ported from).
 *
 * The page owns the state and presentation: they decide the column's width
 * and the rail, which are the page's to lay out.
 */
export const AssistantPanel = ({
  record,
  results,
  groupFor,
  analysis,
  custom,
  disabled,
  policy,
  state,
  presentation,
  canDock,
  onStateChange,
  onPresentationChange,
  onJumpToGroup,
  brief,
  focus,
  onFocusAssessment,
  revision,
  onJumpToCard,
  className
}: {
  record: BusinessRecord
  results: Derived[]
  groupFor: (insightId: string) => GroupId
  analysis: ReturnType<typeof useAnalysis>
  custom: CustomerSkill[]
  disabled: string[]
  /** The standing assessments, for a report run sent without its own. */
  policy: Array<{ id: string; name: string; instructions: string; insightIds?: string[] }>
  state: FloatingPanelState
  presentation: FloatingPanelPresentation
  /** Whether the page has a column to dock into at this width. */
  canDock: boolean
  onStateChange: (state: FloatingPanelState) => void
  onPresentationChange: (presentation: FloatingPanelPresentation) => void
  onJumpToGroup: (groupId: string, insightIds: string[]) => void
  /** The open report as the conversation's first message (`reportBrief`):
   *  there before anything is asked, and kept at the top after. */
  brief?: ReportBrief
  /** The assessment the report is narrowed to, if any. */
  focus?: ReportFocus | null
  /** Narrow the report to an assessment's cards, or widen it. */
  onFocusAssessment?: (card: BriefCard) => void
  /** What the newest document did to the recommendation — the hero shows
   *  it; a further document is read against it. */
  revision?: RevisedRecommendation & { at: string }
  /** A brief card's title scrolls the report to that card. */
  onJumpToCard?: (anchor: string) => void
  className?: string
}) => {
  const [view, setView] = useState<'thread' | 'conversations'>('thread')
  const [about, setAbout] = useState(false)
  const [rated, setRated] = useState<Record<string, 'up' | 'down' | undefined>>({})

  // Switching views unmounts the control that owned focus (the back arrow ⇄
  // the history button) — without a hand-off, focus falls to <body>. Each
  // view's leading header control takes it, on transitions only.
  const viewFocusRef = useRef<HTMLButtonElement>(null)
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null)
  const prevViewRef = useRef(view)
  useEffect(() => {
    if (prevViewRef.current !== view) viewFocusRef.current?.focus()
    prevViewRef.current = view
  }, [view])

  const docked = presentation === 'docked'
  const waiting = analysis.waiting && analysis.waitingKind === 'question'
  const turns = analysis.thread
  const last = turns[turns.length - 1]
  const asked = useMemo(() => turns.map((t) => t.typed ?? ''), [turns])
  /**
   * A conversation the reader started with "New conversation".
   *
   * The conversation a record opens on is led by the assessment — the brief,
   * with no starter questions under it. A new one is the reader asking for a
   * blank page, so it gets the original empty state, starters and all, and no
   * brief. Opening a conversation from the history goes back to the
   * assessment-led one.
   */
  const [fresh, setFresh] = useState(false)
  /** The conversation the record opened on — the assessment's. A new
   *  conversation can always go back to it. */
  const [assessmentThread] = useState(analysis.activeThreadId)
  const backToAssessment = () => {
    analysis.openThread(assessmentThread)
    setFresh(false)
  }
  const lead = fresh ? undefined : brief
  const suggestions = useMemo(
    () =>
      // Under the assessment, only what an answer offered itself; the
      // starters belong to a new conversation's empty state and its turns.
      last ? (lead ? (last.result.suggestions ?? []).map((label, i) => ({ id: `s-${i}`, label })) : suggestionsFor(last.result.suggestions, asked)) : [],
    [last, asked, lead]
  )
  // A conversation the assessment leads has already started: the report opened it.
  const empty = turns.length === 0 && !waiting && !analysis.error && !lead

  const report = analysis.selected
    ? { id: analysis.selected.id, label: reportLabel(analysis.selected) }
    : null

  const send = (s: Send) =>
    s.attachments && s.attachments.length > 0
      ? sendDocuments(s)
      : analysis.run(
      s.prompt,
      [],
      s.kind,
      s.skills,
      s.typed,
      // What the composer actually put in the box, so a disabled part or an
      // edit between render and send cannot drift from what runs. A report
      // sent without its parts runs the standing ones; a question carries
      // none — it is answered whole, and a manifest on it would make the
      // endpoint wait for assessments nobody is writing.
      s.kind === 'report' && s.assessments.length === 0 ? policy : s.assessments,
      s.target
    )

  /** A starter or a suggestion: asked as typed, of the open report. */
  const ask = (prompt: string) =>
    analysis.run(prompt, [], 'question', [], prompt, undefined, analysis.selected?.id)

  /**
   * Documents added in the chat box, read against the recommendation.
   *
   * The prompt names the call, its reason and its numbered steps, and asks the
   * session to say which steps the documents settle and to write
   * `revisedRecommendation` (analysis/README.md) — which the recommendation
   * card reloads with. The file names ride on the question as its chips, so
   * the turn shows what was attached.
   */
  const sendDocuments = (s: Send) => {
    const d = brief?.determination
    const names = (s.attachments ?? []).map((f) => f.name)
    // The recommendation as it stands now — revised by an earlier document, if one was.
    const label = revision ? KIND_WORD[revision.kind] : d?.label
    const reason = revision ? revision.reason : d?.reason
    const settled = new Set(revision?.resolved ?? [])
    const prompt = [
      s.typed,
      d ? `The recommendation is "${label}" (score ${d.value}): ${reason ?? ''}` : '',
      d && d.steps.length > 0
        ? `Its steps, numbered as \`resolved\` refers to them:\n${d.steps
            .map((x, i) => `${i + 1}. ${x.instruction}${settled.has(i + 1) ? ' (already resolved by ' + revision?.source + ')' : ''}`)
            .join('\n')}`
        : '',
      `Read the attached document${names.length === 1 ? '' : 's'} (${names.join(', ')}) against them. Say which steps ${names.length === 1 ? 'it resolves' : 'they resolve'}, which not, and whether the recommendation should change — and write \`revisedRecommendation\` with the call, the reason, the resolved step numbers and the source.`
    ]
      .filter(Boolean)
      .join('\n\n')
    analysis.run(prompt, s.attachments ?? [], 'question', names, s.typed, undefined, s.target ?? analysis.selected?.id)
  }

  /* A past conversation other than the assessment's was started as a new
     one, and opens as one: without the summary or the recommendation. */
  const openThread = (id: string) => {
    analysis.openThread(id)
    setFresh(id !== assessmentThread)
    setView('thread')
  }
  const newThread = () => {
    analysis.newThread()
    setFresh(true)
    setView('thread')
  }

  /** The way back to the assessment, from any new conversation — first in
   *  History, as a dropdown item and in the full list. */
  const assessmentEntry: AssessmentEntry | undefined =
    brief && analysis.selected
      ? {
          id: assessmentThread,
          label: reportLabel(analysis.selected),
          date: reportDate(analysis.selected),
          selected: !fresh && analysis.activeThreadId === assessmentThread,
          onOpen: () => {
            backToAssessment()
            setView('thread')
          }
        }
      : undefined
  /** The other conversations, newest first: the dropdown shows five. */
  const past = pastConversations(analysis.threads, assessmentEntry?.id)

  /* Answered, the analyst's answer is their turn in the conversation, by when
     they gave it, with their note and Undo; the card is gone until it is
     undone. */
  const call = useAnsweredCall(record.id, brief?.determination, revision)
  const decision =
    call.answer && call.d ? (
      <DecisionTurn
        choice={call.answer.choice}
        recommended={call.d.kind === call.answer.choice}
        label={call.d.label}
        note={call.answer.note}
        score={call.d.score}
        by={call.answer.by}
        at={call.answer.at}
        onUndo={() => undoAnswer(record.id)}
      />
    ) : null
  const removal = useRecommendationRemoval(analysis.selected?.id)
  const recommendationRemoved = Boolean(removal)
  /* What the reviewer did with the recommendation — answered it, removed it —
     each placed among the questions by when; one removed before times were
     kept goes last. */
  const events = [
    decision && call.answer ? { id: 'decision', at: call.answer.at, node: decision } : null,
    removal && analysis.selected
      ? {
          id: 'removed',
          at: removal.at ?? '\uffff',
          node: <DismissedTurn by={removal.by} at={removal.at} onUndo={() => restoreRecommendation(analysis.selected!.id)} />
        }
      : null
  ]
    .filter((e): e is { id: string; at: string; node: ReactElement } => e !== null)
    .sort((a, b) => a.at.localeCompare(b.at))
  const eventsBetween = (after: string, upTo?: string) =>
    events.filter((e) => e.at > after && (upTo === undefined || e.at <= upTo))

  /* How tall the floating recommendation is, for the room the log keeps
     under its last turn. */
  const recRef = useRef<HTMLDivElement>(null)
  const [recH, setRecH] = useState(0)
  const recShown = Boolean(!fresh && brief?.determination && analysis.selected && !call.answer && !recommendationRemoved)
  useEffect(() => {
    const el = recRef.current
    if (!el || !recShown || view !== 'thread') return setRecH(0)
    const measure = () => setRecH(el.offsetHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [recShown, view])

  /* The recommendation. Not in a new conversation: the decision is the
     assessment's, and a new conversation starts without it. */
  const recommendation =
    !fresh && brief?.determination && analysis.selected && !call.answer && !recommendationRemoved ? (
      <RecommendationCard
        recommendation={brief.determination}
        businessId={record.id}
        businessName={record.name}
        reportId={analysis.selected.id}
        results={results}
        record={record}
        groupFor={groupFor}
        onJumpToGroup={onJumpToGroup}
        revision={revision}
        // The files the analyst already has for its steps: read against the
        // recommendation, as a document added in the chat box is.
        onDocuments={(files, typed) =>
          send({ prompt: typed, typed, skills: [], assessments: [], kind: 'question', target: analysis.selected?.id, attachments: files })
        }
      />
    ) : null

  return (
    <>
      <FloatingPanel
        className={className}
        corner="bottom-right"
        // The report is the page; the panel does not move over it.
        draggable={false}
        initialFocusRef={composerInputRef}
        label="Middesk Assistant"
        launcher={
          <span className="flex items-center gap-2 text-sm font-medium">
            <MiddeskMark className="h-[9px] w-4" />
            Assistant
          </span>
        }
        launcherLabel="Open the Assistant"
        presentation={presentation}
        side="right"
        state={state}
        onStateChange={onStateChange}
      >
        {/* Docked, the header is a cell of the page's one bar: 49px like the
            page header and the rail beside it, so the rule runs flat. */}
        <FloatingPanelHeader className={docked ? 'h-[49px]' : undefined}>
          {view === 'thread' ? (
            <>
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center text-foreground"
              >
                <MiddeskMark className="h-[9px] w-4" />
              </span>
              <FloatingPanelTitle>
                <span className="min-w-0 truncate text-sm font-medium leading-tight">Assistant</span>
              </FloatingPanelTitle>
            </>
          ) : (
            <>
              <IconActionButton
                ref={viewFocusRef}
                aria-label="Back to conversation"
                variant="quiet"
                onClick={() => setView('thread')}
              >
                <ArrowLeft size={16} strokeWidth={1.75} />
              </IconActionButton>
              <FloatingPanelTitle>
                <span className="min-w-0 truncate text-sm font-medium leading-tight">Conversations</span>
              </FloatingPanelTitle>
            </>
          )}

          <span className="ml-auto flex shrink-0 items-center gap-0.5">
            {/* History: a dropdown of the assessment and the last five
                conversations, and "Show all" for the full list when there
                are more. */}
            <Menu>
              <MenuTrigger asChild>
                <IconActionButton
                  ref={view === 'thread' ? viewFocusRef : undefined}
                  aria-label="Conversation history"
                  aria-pressed={view === 'conversations'}
                  title="Conversation history"
                  variant="quiet"
                >
                  <History size={16} strokeWidth={1.75} />
                </IconActionButton>
              </MenuTrigger>
              <MenuContent align="end" className="z-popover w-72">
                {assessmentEntry && (
                  <MenuItem onSelect={assessmentEntry.onOpen} className="items-start gap-2">
                    <FileText aria-hidden="true" size={16} strokeWidth={1.5} className="mt-0.5 shrink-0" />
                    <span className="flex min-w-0 flex-col">
                      <span className="text-sm font-medium">Assessment</span>
                      <span className="truncate text-caption text-text-secondary">
                        {assessmentEntry.label} · {assessmentEntry.date}
                      </span>
                    </span>
                  </MenuItem>
                )}
                {past.length > 0 && (
                  <>
                    {assessmentEntry && <MenuSeparator />}
                    <MenuLabel>Recent</MenuLabel>
                    {past.slice(0, RECENT_CONVERSATIONS).map((t) => (
                      <MenuItem key={t.id} onSelect={() => openThread(t.id)} className="gap-2">
                        <MessageSquare aria-hidden="true" size={16} strokeWidth={1.5} className="shrink-0" />
                        <span className="min-w-0 flex-1 truncate text-sm">{conversationTitle(t)}</span>
                        {t.questions[0] && (
                          <span className="shrink-0 text-caption text-text-secondary">{formatTime(t.questions[0].at)}</span>
                        )}
                      </MenuItem>
                    ))}
                  </>
                )}
                {past.length > RECENT_CONVERSATIONS && (
                  <>
                    <MenuSeparator />
                    <MenuItem onSelect={() => setView('conversations')}>
                      Show all conversations ({past.length})
                    </MenuItem>
                  </>
                )}
              </MenuContent>
            </Menu>
            <IconActionButton
              aria-label="New conversation"
              title="New conversation"
              variant="quiet"
              onClick={newThread}
            >
              <Plus size={16} strokeWidth={1.75} />
            </IconActionButton>
            <Menu>
              <MenuTrigger asChild>
                <IconActionButton aria-label="Assistant options" title="Assistant options" variant="quiet">
                  <Ellipsis size={16} strokeWidth={1.75} />
                </IconActionButton>
              </MenuTrigger>
              <MenuContent align="end" className="z-popover w-48">
                {docked ? (
                  <MenuItem onSelect={() => onPresentationChange('floating')}>Float Assistant</MenuItem>
                ) : (
                  <MenuItem disabled={!canDock} onSelect={() => onPresentationChange('docked')}>
                    Dock Assistant
                  </MenuItem>
                )}
                {state === 'expanded' ? (
                  <MenuItem onSelect={() => onStateChange('window')}>Restore size</MenuItem>
                ) : (
                  <MenuItem
                    onSelect={() => {
                      // Expanded is a size the floating window takes; a rail
                      // has a width of its own, so expanding undocks first.
                      onPresentationChange('floating')
                      onStateChange('expanded')
                    }}
                  >
                    Expand Assistant
                  </MenuItem>
                )}
                {/* Removed from the chat bar: the way back. */}
                {recommendationRemoved && analysis.selected && (
                  <MenuItem onSelect={() => restoreRecommendation(analysis.selected!.id)}>Show recommendation</MenuItem>
                )}
                <MenuSeparator />
                <MenuItem onSelect={() => setAbout(true)}>About this assistant</MenuItem>
              </MenuContent>
            </Menu>
            <IconActionButton
              aria-label="Minimize Assistant"
              title="Minimize"
              variant="quiet"
              onClick={() => onStateChange('pill')}
            >
              <X size={16} strokeWidth={1.75} />
            </IconActionButton>
          </span>
        </FloatingPanelHeader>

        {/* The recommendation floats over the end of the conversation, so the
            log keeps room under its last turn for it — and lifts its "jump to
            latest" clear of it — by the card's measured height. */}
        <FloatingPanelBody style={{ '--rec-h': `${recH}px` } as CSSProperties}>
          {view === 'conversations' ? (
            <div className="min-h-0 flex-1 overflow-y-auto panel-scroll">
              <Conversations
                threads={analysis.threads}
                activeId={analysis.activeThreadId}
                // The way back to the assessment, from any new conversation.
                assessment={assessmentEntry}
                onOpen={openThread}
              />
            </div>
          ) : empty ? (
            <div className="min-h-0 flex-1 overflow-y-auto panel-scroll">
              <AssistantEmpty onAsk={ask} />
            </div>
          ) : (
            <ChatLog
              label="Report conversation"
              className="[&>button[aria-label='Jump to latest']]:bottom-[calc(var(--rec-h)+0.75rem)]"
              viewportClassName="panel-scroll pb-[var(--rec-h)]"
            >
              {analysis.selected && (
                <ChatMarker>
                  {reportDate(analysis.selected)}
                </ChatMarker>
              )}

              {lead && analysis.selected && (
                <BriefTurn
                  brief={lead}
                  at={analysis.selected.at}
                  results={results}
                  record={record}
                  groupFor={groupFor}
                  focus={focus}
                  onFocusAssessment={onFocusAssessment}
                  onJumpToCard={onJumpToCard}
                  onJumpToGroup={onJumpToGroup}
                />
              )}

              {turns.map((v, i) => (
                <Fragment key={v.id}>
                {lead &&
                  eventsBetween(turns[i - 1]?.at ?? '', v.at).map((e) => (
                    <div key={e.id} className="mt-2">
                      {e.node}
                    </div>
                  ))}
                <div className={cn('flex flex-col gap-4', (i > 0 || lead) && 'mt-2')}>
                  <UserTurn typed={v.typed ?? ''} skills={v.skills ?? []} at={v.at} />
                  <AnswerTurn
                    version={v}
                    results={results}
                    record={record}
                    groupFor={groupFor}
                    // Retry belongs to the newest ask: a failed one, if
                    // there is one, else this.
                    isLast={i === turns.length - 1 && !waiting && !analysis.failed}
                    rated={rated[v.id]}
                    onRate={(id, rating) =>
                      setRated((prev) => ({ ...prev, [id]: prev[id] === rating ? undefined : rating }))
                    }
                    onRetry={analysis.retry}
                    onJumpToGroup={onJumpToGroup}
                  />
                </div>
                </Fragment>
              ))}
              {lead &&
                eventsBetween(turns.at(-1)?.at ?? '').map((e) => (
                  <div key={e.id} className="mt-2">
                    {e.node}
                  </div>
                ))}

              {waiting && (
                <div className="mt-2 flex flex-col gap-4">
                  <UserTurn
                    typed={analysis.waitingTyped}
                    skills={analysis.waitingSkills}
                    at={new Date().toISOString()}
                  />
                  <PendingTurn startedAt={new Date().toISOString()} insightCount={results.length} />
                </div>
              )}

              {analysis.error && !waiting && (
                <div className="mt-2 flex flex-col gap-4">
                  {analysis.failed && (
                    <UserTurn
                      typed={analysis.failed.typed ?? ''}
                      skills={analysis.failed.skills ?? []}
                      at={analysis.failed.at}
                    />
                  )}
                  <ErrorTurn
                    message={analysis.error}
                    at={analysis.failed?.at ?? new Date().toISOString()}
                    insightCount={results.length}
                    onRetry={analysis.retry}
                  />
                </div>
              )}

              {!waiting && !analysis.error && suggestions.length > 0 && (
                <ChatSuggestions
                  // A suggestion is a whole question, and the column is
                  // narrow: the pill wraps rather than truncating mid-word,
                  // the way Kha's do. Reaches into the kit's pill by
                  // selector — the primitive has no wrap switch.
                  className="[&>button]:h-auto [&>button]:whitespace-normal [&>button]:py-1 [&>button]:text-left [&>button]:leading-5"
                  label="Suggested questions"
                  suggestions={suggestions}
                  onSelect={(s) => ask(s.label)}
                />
              )}
            </ChatLog>
          )}

          {view === 'thread' && (
            <div className="relative shrink-0 px-3 pb-3 pt-2">
              {/* The recommendation, floating over the conversation just above
                  the chat bar, with a shadow: in view however far the
                  conversation has scrolled. */}
              {recommendation && (
                <div ref={recRef} className="absolute inset-x-3 bottom-full z-10 [&>*]:shadow-elevation-raised">
                  {recommendation}
                </div>
              )}
              <AssistantComposer
                businessId={record.id}
                businessName={record.name}
                custom={custom}
                disabled={disabled}
                report={report}
                busy={false}
                inputRef={composerInputRef}
                onSend={send}
              />
            </div>
          )}
        </FloatingPanelBody>
      </FloatingPanel>

      {/* Collapsed to its bubble, the Assistant leaves the recommendation on
          screen: in the same corner, just above the bubble (24px inset, 40px
          tall, then a gap). */}
      {state === 'pill' && recommendation && (
        <div className="fixed bottom-20 right-6 z-floating w-[22.5rem] max-w-[calc(100vw-3rem)] [&>*]:shadow-elevation-raised">{recommendation}</div>
      )}

      {/* What this is, in this prototype's own terms — not the model note the
          reference carries, which describes a different pipeline. */}
      <Dialog isOpen={about} onClose={() => setAbout(false)} size="sm" title="About this assistant">
        <div className="flex flex-col gap-3">
          <Text>
            Answers are written by the Claude Code session running beside this prototype, from the report
            on screen and the insights it read. The assistant cannot search the web or change the report.
          </Text>
          <Text>
            Conversations are filed with the report they were asked of, in the prototype’s own store.
            Ratings stay in this window.
          </Text>
          <MutedText className="text-caption">
            In production, conversations would follow the report’s access permissions. Retention and
            model-training policies still need confirmation before real customer data is used.
          </MutedText>
        </div>
      </Dialog>
    </>
  )
}
