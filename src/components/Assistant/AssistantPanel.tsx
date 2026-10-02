import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Ellipsis, History, Plus, X } from 'lucide-react'

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
  MenuSeparator,
  MenuTrigger,
  MutedText,
  Text,
  type FloatingPanelPresentation,
  type FloatingPanelState
} from '@/core'

import type { BusinessRecord, Derived } from '../../lib/deriveResults'
import type { GroupId } from '../../lib/groups'
import type { ReportBrief } from '../../lib/reportBrief'
import { reportDate, reportLabel } from '../../lib/reportLabels'
import type { CustomerSkill } from '../../lib/useAgent'
import type { useAnalysis } from '../../lib/useAnalysis'
import { cn } from '../../utils/twUtils'
import { MiddeskMark } from '../MiddeskMark'
import { AssistantComposer, type Send } from './AssistantComposer'
import { AssistantEmpty } from './AssistantEmpty'
import { AnswerTurn, BriefTurn, ErrorTurn, PendingTurn, UserTurn } from './AssistantTurn'
import { Conversations } from './Conversations'
import { STARTERS, suggestionsFor } from './starters'

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
  const suggestions = useMemo(
    // Under the brief, before anything is asked: the starters.
    () => (last ? suggestionsFor(last.result.suggestions, asked) : brief ? [...STARTERS] : []),
    [last, asked, brief]
  )
  // A conversation with a brief has already started: the report opened it.
  const empty = turns.length === 0 && !waiting && !analysis.error && !brief

  const report = analysis.selected
    ? { id: analysis.selected.id, label: reportLabel(analysis.selected) }
    : null

  const send = (s: Send) =>
    analysis.run(
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

  const openThread = (id: string) => {
    analysis.openThread(id)
    setView('thread')
  }
  const newThread = () => {
    analysis.newThread()
    setView('thread')
  }

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
            <IconActionButton
              ref={view === 'thread' ? viewFocusRef : undefined}
              aria-label="Conversation history"
              aria-pressed={view === 'conversations'}
              title="Conversation history"
              variant="quiet"
              onClick={() => setView(view === 'conversations' ? 'thread' : 'conversations')}
            >
              <History size={16} strokeWidth={1.75} />
            </IconActionButton>
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

        <FloatingPanelBody>
          {view === 'conversations' ? (
            <div className="min-h-0 flex-1 overflow-y-auto panel-scroll">
              <Conversations threads={analysis.threads} activeId={analysis.activeThreadId} onOpen={openThread} />
            </div>
          ) : empty ? (
            <div className="min-h-0 flex-1 overflow-y-auto panel-scroll">
              <AssistantEmpty onAsk={ask} />
            </div>
          ) : (
            <ChatLog label="Report conversation" viewportClassName="panel-scroll">
              {analysis.selected && (
                <ChatMarker>
                  {reportLabel(analysis.selected)} · {reportDate(analysis.selected)}
                </ChatMarker>
              )}

              {brief && analysis.selected && (
                <BriefTurn
                  brief={brief}
                  at={analysis.selected.at}
                  results={results}
                  record={record}
                  onJumpToCard={onJumpToCard}
                />
              )}

              {turns.map((v, i) => (
                <div key={v.id} className={cn('flex flex-col gap-4', (i > 0 || brief) && 'mt-2')}>
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
            <div className="shrink-0 px-3 pb-3 pt-2">
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
