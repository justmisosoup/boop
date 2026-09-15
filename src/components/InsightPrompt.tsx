import { useMemo, useRef, useState } from 'react'

import { ActionButton, InlineAlert, MetaChip, MutedText, Surface, Text, Textarea } from '@/core'

import { compilePrompt } from '../lib/compilePrompt'
import { type AuthoredInsight, composeStatement, draftFrom, sourceLabel } from '../lib/customInsights'
import type { BusinessRecord } from '../lib/deriveResults'
import {
  JURISDICTION_LABEL,
  NAME_SOURCES,
  observedCount,
  observedNameSources,
  relationLabel
} from '../lib/vocabulary'

/** Either trigger opens the picker: `/` the way a command does, `@` the way a
 *  mention does. Both mean the same thing, so neither has to be learned. */
const TRIGGERS = ['@', '/'] as const

/** Where the open trigger starts, or -1. */
const triggerAt = (upto: string) =>
  TRIGGERS.reduce((best, char) => Math.max(best, upto.lastIndexOf(char)), -1)

type Mention = {
  /** What gets inserted, after the @. */
  token: string
  label: string
  kind: 'attribute' | 'source'
  /** What this record holds, where that is knowable. Ordering hint only. */
  count?: number
}

/**
 * What can be referenced from the prompt.
 *
 * Attributes first, then every source the PRODUCT can supply — not only the
 * ones this record happens to carry. A source with no observations here is
 * still referenceable; it may simply not have been ordered for this business,
 * and an insight is written once and run against many records.
 */
const useMentions = (record?: BusinessRecord): Mention[] => {
  return useMemo(() => {
    const observed = observedNameSources(record)

    const attributes: Mention[] = [
      { token: 'Submitted business name', label: 'Submitted business name', kind: 'attribute' },
      { token: 'Submitted DBA', label: 'Submitted DBA / FBN', kind: 'attribute' },
      { token: 'Found name', label: 'Found name', kind: 'attribute' }
    ]

    const sources: Mention[] = NAME_SOURCES.flatMap((source) => {
      const count = observedCount(source, observed)
      const base: Mention = {
        token: source.label,
        label: source.label,
        kind: 'source',
        count
      }
      if (!source.jurisdictions) return [base]

      // A registration is routinely wanted domestic-only or foreign-only, so
      // each jurisdiction is referenceable in its own right.
      return [
        base,
        ...source.jurisdictions.map((jurisdiction) => ({
          token: `${source.label} (${JURISDICTION_LABEL[jurisdiction]})`,
          label: `${source.label} · ${JURISDICTION_LABEL[jurisdiction]}`,
          kind: 'source' as const,
          count
        }))
      ]
    })

    return [...attributes, ...sources]
  }, [record])
}

/**
 * Write an insight, and see what the session understood.
 *
 * Free text, because a picker can only offer what the record already models.
 * But an attribute has to be referenceable rather than merely described, so
 * `@` inserts a real one — the prompt stays prose while the things it names
 * are drawn from the actual vocabulary.
 *
 * The compiled reading is shown back rather than hidden: the prompt is the
 * input, but the structure is what runs against every record, and an author
 * has to be able to see and correct it.
 */
export const InsightPrompt = ({
  initial,
  onCancel,
  onSave,
  record,
  saving
}: {
  /** Set when editing: the prompt opens on it and saves back to the same id. */
  initial?: AuthoredInsight
  onCancel?: () => void
  onSave: (insight: AuthoredInsight) => void
  record?: BusinessRecord
  saving?: boolean
}) => {
  const mentions = useMentions(record)
  const [prompt, setPrompt] = useState(initial?.prompt ?? '')
  const [query, setQuery] = useState<string | null>(null)
  const [highlight, setHighlight] = useState(0)
  const [draft, setDraft] = useState<AuthoredInsight | null>(
    initial ? draftFrom(initial.prompt, compilePrompt(initial.prompt)) : null
  )
  const [error, setError] = useState<string | null>(null)
  const field = useRef<HTMLTextAreaElement>(null)

  /**
   * An edit keeps the insight it started from.
   *
   * `draftFrom` derives the id from the sentence, so without this a reworded
   * edit would save as a second insight and leave the original behind.
   */
  const withIdentity = (next: AuthoredInsight): AuthoredInsight =>
    initial
      ? { ...next, id: initial.id, createdAt: initial.createdAt }
      : next

  const matches = useMemo(() => {
    if (query === null) return []
    const q = query.toLowerCase()

    return mentions
      .filter((mention) => mention.label.toLowerCase().includes(q))
      // Attributes first: they are what the sentence is about, and a source
      // with a high count would otherwise bury them. Sources then lead with
      // whatever this record actually holds.
      .sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'attribute' ? -1 : 1

        return (b.count ?? 0) - (a.count ?? 0)
      })
      .slice(0, 8)
  }, [mentions, query])

  /** The word immediately after an open trigger, if the caret is inside one. */
  const readQuery = (value: string, caret: number) => {
    const upto = value.slice(0, caret)
    const at = triggerAt(upto)
    if (at === -1) return null
    const after = upto.slice(at + 1)
    // A reference ends at punctuation; a space is allowed so multi-word labels
    // stay reachable while typing.
    if (/[,.;\n]/.test(after)) return null

    return after
  }

  const onChange = (value: string, caret: number) => {
    setPrompt(value)
    setQuery(readQuery(value, caret))
    setHighlight(0)
    // The reading updates as you type, so the compiled structure is never a
    // surprise waiting behind a button.
    setDraft(value.trim() ? draftFrom(value, compilePrompt(value)) : null)
  }

  const insert = (mention: Mention) => {
    const element = field.current
    const caret = element?.selectionStart ?? prompt.length
    const upto = prompt.slice(0, caret)
    const at = triggerAt(upto)
    if (at === -1) return
    // Keep whichever trigger the author typed; the compiler reads both.
    const trigger = prompt[at]
    const next = `${prompt.slice(0, at)}${trigger}${mention.token} ${prompt.slice(caret)}`
    setPrompt(next)
    setQuery(null)
    setDraft(draftFrom(next, compilePrompt(next)))
    requestAnimationFrame(() => {
      const position = at + mention.token.length + 2
      element?.focus()
      element?.setSelectionRange(position, position)
    })
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (matches.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlight((current) => (current + 1) % matches.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlight((current) => (current - 1 + matches.length) % matches.length)
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault()
      insert(matches[highlight])
    } else if (event.key === 'Escape') {
      setQuery(null)
    }
  }

  return (
    <Surface className="grid gap-4" padding="md" variant="card">
      <div className="grid gap-2">
        <Text className="font-semibold">Write an insight</Text>
        <div className="relative">
          <Textarea
            aria-label="Insight prompt"
            onChange={(event) => onChange(event.target.value, event.target.selectionStart ?? 0)}
            onKeyDown={onKeyDown}
            placeholder="Type / or @ to reference an attribute or a source."
            ref={field}
            rows={2}
            value={prompt}
          />
          {matches.length > 0 && (
            <ul className="absolute z-10 m-0 mt-1 grid max-h-64 w-full list-none overflow-auto rounded-[var(--core-radius-card)] border border-border bg-surface-card p-1 shadow-md">
              {matches.map((mention, index) => (
                <li key={`${mention.kind}:${mention.token}`}>
                  <button
                    className={`flex w-full items-center justify-between gap-3 rounded-[var(--core-radius-control)] px-2 py-1.5 text-left text-[13px] ${
                      index === highlight ? 'bg-[var(--core-color-state-hover-bg)]' : ''
                    }`}
                    onClick={() => insert(mention)}
                    onMouseEnter={() => setHighlight(index)}
                    type="button"
                  >
                    <span className="truncate">{mention.label}</span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {mention.count ? (
                        <MutedText className="text-xs">{mention.count} on this record</MutedText>
                      ) : null}
                      <MetaChip size="xs" tone="neutral">
                        {mention.kind}
                      </MetaChip>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {error && <InlineAlert tone="danger">{error}</InlineAlert>}

      {draft && (
        <div className="grid gap-3 rounded-[var(--core-radius-card)] border border-border p-3">
          <div className="grid gap-1">
            <MutedText className="text-xs">The insight</MutedText>
            <Text className="text-[15px] leading-6">{composeStatement(draft)}</Text>
          </div>

          <div className="grid gap-1">
            <MutedText className="text-xs">What it reads</MutedText>
            <div className="flex flex-wrap items-center gap-1">
              <MetaChip size="xs" tone="neutral">
                {draft.compiled.subject.nameType === 'legal' ? 'Legal name' : 'DBA'} · submitted
              </MetaChip>
              <MetaChip size="xs" tone="neutral">
                {relationLabel(draft.compiled.relation)}
              </MetaChip>
              {draft.compiled.sources.map((source) => (
                <MetaChip key={source.id} size="xs" tone="info">
                  {sourceLabel(source)}
                </MetaChip>
              ))}
            </div>
          </div>

          {draft.compiled.states.length > 0 && (
            <div className="grid gap-1">
              <MutedText className="text-xs">States it can report</MutedText>
              <div className="flex flex-wrap gap-1">
                {draft.compiled.states.map((state) => (
                  <MetaChip key={state} size="xs" tone="neutral">
                    {state}
                  </MetaChip>
                ))}
              </div>
            </div>
          )}

          {draft.unsupported.length > 0 && (
            <div className="grid gap-1">
              <MutedText className="text-xs">Not included</MutedText>
              {draft.unsupported.map((item) => (
                <MutedText className="text-[13px] leading-5" key={item.asked}>
                  <span className="text-foreground">{item.asked}</span> — {item.why}
                </MutedText>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <ActionButton onClick={onCancel} variant="secondary">
            Cancel
          </ActionButton>
        )}
        <ActionButton
          disabled={!draft || saving}
          onClick={() => draft && onSave(withIdentity(draft))}
        >
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Add insight'}
        </ActionButton>
      </div>
    </Surface>
  )
}
