import { Fragment, useMemo, useState } from 'react'
import { Building2, Copy, Plus, RotateCcw, X } from 'lucide-react'
import { useNavigate } from 'react-router'

import {
  ActionButton,
  ChatComposer,
  ChatLog,
  ChatMessage,
  ChatMessageActions,
  ChatSourceChip,
  ChatSuggestions,
  ChatThinking,
  FloatingPanel,
  FloatingPanelBody,
  FloatingPanelHeader,
  FloatingPanelTitle,
  IconActionButton,
  Text,
  type ChatSourceData,
  type FloatingPanelState
} from '@/core'

import { ALL, assessmentOf } from '../../lib/records'
import { KIND_OF_BAND, KIND_SHORT } from '../../lib/reportBrief'
import { usePortfolioAssistant, type PortfolioTurn } from '../../lib/usePortfolioAssistant'
import { MiddeskMark } from '../MiddeskMark'
import { AssistantWho, Meta, UserTurn } from './AssistantTurn'

/** Where a list conversation starts. */
const STARTERS = [
  'Which businesses are waiting on information?',
  'Which businesses have adverse media or sanctions hits?',
  'Which approvals have open liens or litigation?',
  'Who has not been assessed yet?'
]

/** How many businesses a paragraph names one by one before the rest fold into "+N". */
const CHIPS_SHOWN = 4

/**
 * The Assistant on the businesses list.
 *
 * Questions about every business at once — who is waiting on what, which
 * approvals carry liens — answered by the session from a snapshot of the list
 * (`portfolioSnapshot`), not from any one record. Each paragraph cites the
 * businesses it rests on as the report's citations are drawn; a chip opens
 * that business. The record page has its own Assistant, about that business.
 *
 * The same launcher as the record's, in the corner; it starts put away.
 */
export const PortfolioAssistant = () => {
  const navigate = useNavigate()
  const [state, setState] = useState<FloatingPanelState>('pill')
  const [value, setValue] = useState('')
  const { turns, pending, ask, retry, clear } = usePortfolioAssistant()

  /** A business as a citation: its name, its call and score, its headline. */
  const sources = useMemo(() => {
    const byId = new Map<string, ChatSourceData>()
    for (const r of ALL) {
      const assessed = assessmentOf(r)
      byId.set(r.id, {
        id: r.id,
        label: r.name,
        title: r.name,
        annotation: assessed ? `${KIND_SHORT[KIND_OF_BAND[assessed.score.band.id]]} · ${assessed.score.value}` : 'Not assessed',
        icon: <Building2 aria-hidden="true" size={12} strokeWidth={1.75} />,
        onSelect: () => navigate(`/businesses/${r.id}`)
      })
    }
    return byId
  }, [navigate])

  const send = (typed: string) => {
    const q = typed.trim()
    if (!q || pending) return
    setValue('')
    void ask(q)
  }

  const last = turns.at(-1)
  const suggestions = (turns.length === 0 ? STARTERS : (last?.answer?.suggestions ?? [])).map((label, i) => ({
    id: `s-${i}`,
    label
  }))

  return (
    <FloatingPanel
      corner="bottom-right"
      draggable={false}
      label="Middesk Assistant"
      launcher={
        <span className="flex items-center gap-2 text-sm font-medium">
          <MiddeskMark className="h-[9px] w-4" />
          Assistant
        </span>
      }
      launcherLabel="Open the Assistant"
      presentation="floating"
      side="right"
      state={state}
      onStateChange={setState}
    >
      <FloatingPanelHeader>
        <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center text-foreground">
          <MiddeskMark className="h-[9px] w-4" />
        </span>
        <FloatingPanelTitle>
          <span className="min-w-0 truncate text-sm font-medium leading-tight">Assistant</span>
        </FloatingPanelTitle>
        <span className="ml-auto flex shrink-0 items-center gap-0.5">
          <IconActionButton aria-label="New conversation" title="New conversation" variant="quiet" onClick={clear}>
            <Plus size={16} strokeWidth={1.75} />
          </IconActionButton>
          <IconActionButton aria-label="Minimize Assistant" title="Minimize" variant="quiet" onClick={() => setState('pill')}>
            <X size={16} strokeWidth={1.75} />
          </IconActionButton>
        </span>
      </FloatingPanelHeader>

      <FloatingPanelBody>
        <ChatLog label="Businesses conversation" viewportClassName="panel-scroll">
          {turns.length === 0 && (
            <ChatMessage role="assistant" header={<Meta align="start" at={new Date().toISOString()} who={<AssistantWho />} />}>
              <Text size="sm">
                Ask about all {ALL.length} businesses at once — who is waiting on what, which calls carry open
                findings, who has not been assessed. Each answer names the businesses it rests on.
              </Text>
            </ChatMessage>
          )}

          {turns.map((t, i) => (
            <div key={t.id} className={i > 0 ? 'mt-2 flex flex-col gap-4' : 'flex flex-col gap-4'}>
              <UserTurn typed={t.typed} skills={[]} at={t.at} />
              {t.answer ? (
                <ListAnswer turn={t} sources={sources} />
              ) : t.error ? (
                <ChatMessage
                  role="assistant"
                  header={<Meta align="start" at={t.at} who={<AssistantWho />} />}
                  footer={
                    <ActionButton variant="quiet" size="compact" leadingIcon={<RotateCcw size={12} strokeWidth={1.75} />} onClick={() => retry(t.id)}>
                      Retry
                    </ActionButton>
                  }
                >
                  <Text size="sm" className="text-text-secondary">
                    {t.error}
                  </Text>
                </ChatMessage>
              ) : (
                <ChatMessage role="assistant" busy header={<Meta align="start" at={t.at} who={<AssistantWho />} />}>
                  <ChatThinking
                    active
                    label="Working…"
                    steps={[
                      { id: 'read', label: 'Businesses read', description: `${ALL.length} businesses`, status: 'complete' },
                      { id: 'answer', label: 'Answer written', status: 'active' }
                    ]}
                  />
                </ChatMessage>
              )}
            </div>
          ))}

          {!pending && suggestions.length > 0 && (
            <ChatSuggestions
              className="[&>button]:h-auto [&>button]:whitespace-normal [&>button]:py-1 [&>button]:text-left [&>button]:leading-5"
              label="Suggested questions"
              suggestions={suggestions}
              onSelect={(s) => send(s.label)}
            />
          )}
        </ChatLog>

        <div className="shrink-0 px-3 pb-3 pt-2">
          {/* The context: the whole list, as the record's chat box names its business. */}
          <p className="mb-1.5 flex min-w-0 items-center gap-1.5 rounded-card border border-solid border-border bg-[var(--core-color-surface-subtle)] px-2.5 py-1 text-caption leading-4 text-foreground">
            <Building2 aria-hidden="true" size={12} strokeWidth={1.75} className="shrink-0 text-text-secondary" />
            <span className="truncate">All businesses · {ALL.length}</span>
          </p>
          <ChatComposer
            label="Ask Assistant about your businesses"
            placeholder="Ask about your businesses…"
            sendDisabled={!value.trim() || Boolean(pending)}
            value={value}
            onChange={setValue}
            onSubmit={() => send(value)}
          />
        </div>
      </FloatingPanelBody>
    </FloatingPanel>
  )
}

/** The session's answer: its paragraphs, each with the businesses it cites. */
const ListAnswer = ({ turn, sources }: { turn: PortfolioTurn; sources: Map<string, ChatSourceData> }) => {
  const paragraphs = turn.answer?.paragraphs ?? []
  const text = paragraphs.map((p) => p.text).join('\n\n')
  return (
    <ChatMessage
      role="assistant"
      header={<Meta align="start" at={turn.answeredAt ?? turn.at} who={<AssistantWho />} />}
      footer={
        <ChatMessageActions
          actions={[
            {
              id: 'copy',
              icon: <Copy size={12} strokeWidth={1.75} />,
              label: 'Copy answer',
              onClick: () => void navigator.clipboard?.writeText(text)
            }
          ]}
        />
      }
    >
      <div className="flex flex-col gap-2">
        {paragraphs.map((p, i) => {
          const cited = (p.cites ?? []).map((id) => sources.get(id)).filter((x): x is ChatSourceData => Boolean(x))
          const rest = cited.slice(CHIPS_SHOWN)
          return (
            <p key={i} className="text-sm leading-5 text-foreground">
              {p.text}
              {cited.length > 0 && (
                <span className="ml-1 inline-flex flex-wrap gap-1 align-baseline">
                  {cited.slice(0, CHIPS_SHOWN).map((src) => (
                    <Fragment key={src.id}>
                      <ChatSourceChip sources={[src]} />
                    </Fragment>
                  ))}
                  {rest.length > 0 && <ChatSourceChip sources={rest} />}
                </span>
              )}
            </p>
          )
        })}
      </div>
    </ChatMessage>
  )
}
