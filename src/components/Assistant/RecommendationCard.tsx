import { useRef, useState } from 'react'
import { ArrowRight, Check, ChevronLeft, ChevronRight, Paperclip, Pencil, Upload, X } from 'lucide-react'
import { createPortal } from 'react-dom'

import { ActionButton, Dialog, IconActionButton, Surface, Textarea } from '@/core'

import type { BusinessRecord, Derived } from '../../lib/deriveResults'
import type { GroupId } from '../../lib/groups'
import { createLocalStore } from '../../lib/localStore'
import { KIND_SHORT, KIND_WORD, type ReportBrief } from '../../lib/reportBrief'
import { formatTime } from '../../lib/reportLabels'
import type { Attachment } from '../../lib/useAnalysis'
import type { RevisedRecommendation } from '../../types'
import {
  acceptedRecommendation,
  answerRecommendation,
  informationRequested,
  requestInformation,
  undoAcceptance,
  undoRequest,
  useReview,
  type RecommendationAnswer
} from '../../lib/review'
import { CURRENT_USER } from '../../lib/user'
import { cn } from '../../utils/twUtils'
import { ScoreRing } from '../DeterminationCard'
import { Para } from '../ReportBody'
import { CardCitations } from './AssistantTurn'
import { readFile } from './files'

type Recommendation = NonNullable<ReportBrief['determination']>

/** Reports whose recommendation the reader has removed outright, in this
 *  browser — no card and no score — by whom and when, so the conversation can
 *  say so, with Undo. (`true`: removed before who and when were kept.) */
type Removal = { by: string; at: string }
const removed = createLocalStore<Removal | true>('prototype.recommendation.removed.v1')
export const useRecommendationRemoval = (reportId?: string): Partial<Removal> | undefined => {
  const entry = reportId ? removed.useAll()[reportId] : undefined
  return entry === true ? {} : entry
}
export const restoreRecommendation = (reportId: string) => removed.remove(reportId)


/** The steps as a message to the applicant: what to send, and why each. */
const draftMessage = (businessName: string, steps: Recommendation['steps']) =>
  [
    'Hello,',
    '',
    `To finish reviewing the application for ${businessName}, we need the following:`,
    '',
    ...steps.map((s, i) => `${i + 1}. ${s.instruction}${s.why ? `\n   ${s.why}` : ''}`),
    '',
    'Reply to this message with the documents attached, or let us know if you have any questions.',
    '',
    'Thank you.'
  ].join('\n')

/** The recommendation as it stands: the report's, or as a document revised
 *  it. The score is the record's either way — a document does not change the
 *  record. */
export const standingCall = (original: Recommendation, revision?: RevisedRecommendation): Recommendation =>
  revision
    ? {
        ...original,
        kind: revision.kind,
        label: KIND_WORD[revision.kind],
        reason: revision.reason,
        status: revision.kind === 'approve' ? 'approved' : revision.kind === 'reject' ? 'rejected' : 'in_review'
      }
    : original

/** The call as it stands, and the analyst's answer to it, if they have given
 *  one. An acceptance recorded before answers carried a choice reads as one. */
export const useAnsweredCall = (businessId: string, original?: Recommendation, revision?: RevisedRecommendation) => {
  const d = original ? standingCall(original, revision) : undefined
  const review = useReview(businessId, d?.status ?? 'in_review')
  const answer: RecommendationAnswer | undefined =
    review.answer ??
    (d && d.kind !== 'request' && acceptedRecommendation(review, d.status) && review.change
      ? { choice: d.kind, by: review.change.by, at: review.change.at }
      : undefined)
  return { d, review, answer }
}

/** The option rows' look: a numbered row, as a question's choices are listed. */
const ROW = cn(
  'group flex w-full items-center gap-3 rounded-control px-2 py-1.5 text-left text-sm leading-5 text-foreground',
  'transition-colors duration-fast motion-reduce:transition-none',
  'hover:bg-[var(--core-color-state-hover-bg)] focus-visible:bg-[var(--core-color-state-hover-bg)] focus-visible:outline-none'
)
const KEY =
  'flex size-6 shrink-0 items-center justify-center rounded-control bg-[var(--core-color-surface-subtle)] text-caption text-text-secondary'


/**
 * The recommendation, floating over the chat bar.
 *
 * Always a call the customer can act on, never "Needs Review" — they are
 * already reviewing. Approve or Reject, per the policy; or, when the record is
 * short of something, request it from the applicant, with the report's own
 * follow-ups as the list. The call and why sit beside the score in its band's
 * colour, as the determination card set them; the answers sit under both.
 *
 * - **The analyst answers** from a numbered list, as a question's choices
 *   are: Request information, Approve, Reject — each its own row, the
 *   recommended one first and marked — with an optional note under them.
 *   Approve or Reject sets the status the way the header's control does and
 *   skips the report's steps (the row says how many), then lives in the
 *   conversation (`DecisionTurn`) with the note and Undo, and the card goes.
 * - **Request information** walks the report's steps inside the card, one
 *   question each — request it, already have it, not needed, with a note —
 *   then drafts the message from the ones to request. Up and down move
 *   between the rows; the numbers pick.
 * - **X**, in its corner, removes it outright — no card, no score —
 *   remembered for this report. The conversation says so, with Undo
 *   (`DismissedTurn`); the Assistant's options bring it back too.
 * - **Request information** drafts the message to the applicant — editable,
 *   with Copy — and Done records the request. The card shrinks to the line
 *   that says so, with View and Undo.
 * - **A document added in the chat box** can change it: the answer's
 *   `revisedRecommendation` reloads the card — the call and reason replaced,
 *   the steps it settled struck, a caption naming the file.
 */
export const RecommendationCard = ({
  recommendation: original,
  businessId,
  businessName,
  reportId,
  results,
  record,
  groupFor,
  onJumpToGroup,
  revision,
  onDocuments
}: {
  recommendation: Recommendation
  businessId: string
  businessName: string
  reportId: string
  results: Derived[]
  record: BusinessRecord
  groupFor: (insightId: string) => GroupId
  /** A step's citation chip: opens the cited rows on the report. */
  onJumpToGroup?: (groupId: string, insightIds: string[]) => void
  /** What the newest document did to the recommendation, and when. */
  revision?: RevisedRecommendation & { at: string }
  /** Files the analyst already has, sent to the Assistant as documents. */
  onDocuments?: (files: Attachment[], typed: string) => void
}) => {
  // The caption says why the call moved, where a document moved it.
  const d = standingCall(original, revision)
  const resolved = new Set(revision?.resolved ?? [])
  const open = d.steps.filter((_, i) => !resolved.has(i + 1))
  const review = useReview(businessId, d.status)
  const accepted = d.kind !== 'request' && acceptedRecommendation(review, d.status)
  const requested = d.kind === 'request' && informationRequested(review)
  const [note, setNote] = useState('')
  /* Request information walks the report's steps one question at a time,
     then drafts the message from the ones to ask for. */
  const [stage, setStage] = useState<'options' | 'steps'>('options')
  const [at, setAt] = useState(0)
  const [stepAnswers, setStepAnswers] = useState<Record<number, StepAnswer>>({})
  /** The files the analyst already has, by step. */
  const [stepFiles, setStepFiles] = useState<Record<number, Attachment[]>>({})
  /** What the drafted message asks for — what Done records. */
  const [asking, setAsking] = useState<string[]>([])
  const [draft, setDraft] = useState<string | null>(null)
  const [viewing, setViewing] = useState(false)

  const by = (who?: string) => (who === CURRENT_USER ? 'you' : who)

  /* The message, drafted or as it was sent. Portalled to the page: the panel
     floats, and a dialog inside it would sit under its stacking. */
  const dialog = createPortal(
    <Dialog
      isOpen={draft !== null || viewing}
      onClose={() => {
        setDraft(null)
        setViewing(false)
      }}
      size="md"
      title={viewing ? 'Information requested' : 'Request information from the applicant'}
      description={
        viewing && review.requested
          ? `Requested by ${by(review.requested.by)}, ${new Date(review.requested.at).toLocaleString()}.`
          : 'Edit the message, copy it into your email or portal, then mark it requested.'
      }
      footer={
        <div className="flex justify-end gap-2">
          <ActionButton
            variant="secondary"
            onClick={() => void navigator.clipboard?.writeText((viewing ? review.requested?.message : draft) ?? '')}
          >
            Copy
          </ActionButton>
          {viewing ? (
            <ActionButton onClick={() => setViewing(false)}>Close</ActionButton>
          ) : (
            <>
              <ActionButton variant="quiet" onClick={() => setDraft(null)}>
                Cancel
              </ActionButton>
              <ActionButton
                onClick={() => {
                  requestInformation(businessId, asking, draft ?? '')
                  setDraft(null)
                }}
              >
                Done
              </ActionButton>
            </>
          )}
        </div>
      }
    >
      <Textarea
        aria-label="Message to the applicant"
        className="min-h-72 font-mono text-sm"
        readOnly={viewing}
        value={(viewing ? review.requested?.message : draft) ?? ''}
        onChange={(e) => setDraft(e.target.value)}
      />
    </Dialog>,
    document.body
  )

  if (accepted || requested)
    return (
      <>
        <Surface variant="card" padding="none" className="flex items-center gap-3 px-3 py-2" aria-label="Recommendation">
          <ScoreRing score={d.score} size="xs" label={d.label} />
          <span className="min-w-0 flex-1 text-sm leading-5 text-foreground">
            {requested ? (
              <>
                Information requested
                <span className="text-text-secondary">
                  {` · ${review.requested?.items.length} item${review.requested?.items.length === 1 ? '' : 's'} · by ${by(review.requested?.by)}`}
                </span>
              </>
            ) : (
              <>
                {d.label}
                <span className="text-text-secondary">{` · accepted by ${by(review.change?.by)}`}</span>
              </>
            )}
          </span>
          {requested && (
            <ActionButton variant="quiet" size="compact" onClick={() => setViewing(true)}>
              View
            </ActionButton>
          )}
          <ActionButton
            variant="quiet"
            size="compact"
            onClick={() => (requested ? undoRequest(businessId) : undoAcceptance(businessId))}
          >
            Undo
          </ActionButton>
        </Surface>
        {dialog}
      </>
    )

  /* The status's own words, the recommended call first, then the others,
     each its own row. Approve and Reject answer at once, with the note, and
     skip the report's steps — saying how many. Request information walks
     them. */
  const count = open.length
  const plural = (n: number) => `${n} step${n === 1 ? '' : 's'}`
  const answer = (choice: RecommendationAnswer['choice']) =>
    answerRecommendation(businessId, { choice, note }, review.status, d.kind === choice)
  const skips = count > 0 ? `skips ${plural(count)}` : undefined
  const request: Option = {
    id: 'request',
    label: 'Request information',
    recommended: d.kind === 'request',
    onSelect: () => {
      setAt(0)
      if (count > 0) setStage('steps')
      else finish()
    }
  }
  const approve: Option = { id: 'approve', label: 'Approve', recommended: d.kind === 'approve', detail: skips, onSelect: () => answer('approve') }
  const reject: Option = { id: 'reject', label: 'Reject', recommended: d.kind === 'reject', detail: skips, onSelect: () => answer('reject') }
  const options = d.kind === 'request' ? [request, approve, reject] : d.kind === 'approve' ? [approve, reject, request] : [reject, approve, request]

  /* One step, as a question: what to do about it. Answering moves on; the
     last one goes to the message. */
  const step = open[at]
  const next = () => (at < count - 1 ? setAt(at + 1) : finish())
  const addFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return
    const read = await Promise.all([...list].map(readFile))
    setStepFiles((prev) => ({ ...prev, [at]: [...(prev[at] ?? []), ...read] }))
    setStepAnswers((prev) => ({ ...prev, [at]: 'have' }))
  }
  const stepOptions: Option[] = STEP_ACTIONS.map((x) => ({
    id: x.id,
    label: x.label,
    picked: stepAnswers[at] === x.id,
    detail: x.detail,
    onSelect: () => {
      setStepAnswers((prev) => ({ ...prev, [at]: x.id }))
      next()
    },
    // Already having it: the row takes the file — dropped on it, or browsed
    // for from it — and once it holds one, its arrow moves on.
    ...(x.id === 'have'
      ? {
          files: stepAnswers[at] === 'have' ? (stepFiles[at] ?? []) : [],
          onFiles: addFiles,
          onRemoveFile: (i: number) => setStepFiles((prev) => ({ ...prev, [at]: (prev[at] ?? []).filter((_, j) => j !== i) })),
          onProceed: next
        }
      : {})
  }))
  const files = open.flatMap((_, i) => (stepAnswers[i] === 'have' ? (stepFiles[i] ?? []) : []))
  const filedSteps = open.map((_, i) => i).filter((i) => stepAnswers[i] === 'have' && (stepFiles[i] ?? []).length > 0)

  /* What the message asks for: the steps marked to request, each with its
     note, and the card's own note last. */
  const items = [
    ...open
      .map((x, i) => ({ ...x, i }))
      .filter((x) => stepAnswers[x.i] === 'request')
      .map((x) => ({ instruction: x.instruction, why: x.why })),
    ...(note.trim() ? [{ instruction: note.trim(), why: undefined }] : [])
  ]

  /* The steps done: the files the analyst already has go to the Assistant —
     the conversation shows them sent, each file a chip — and what is left to
     ask for opens as the message to the applicant. Then back to the answers. */
  function finish() {
    if (files.length > 0 && onDocuments) {
      const steps = filedSteps.map((i) => i + 1).join(', ')
      onDocuments(files, `Sent ${files.length} file${files.length === 1 ? '' : 's'} I already have, for step${filedSteps.length === 1 ? '' : 's'} ${steps}.`)
      setStepFiles({})
    }
    if (items.length > 0 || count === 0) {
      setAsking(items.map((x) => x.instruction))
      setDraft(draftMessage(businessName, items))
    }
    setStage('options')
    setAt(0)
  }

  return (
    <>
      <Surface variant="card" padding="none" className="flex flex-col gap-2 px-3 py-3" aria-label="Recommendation">
        {/* The call, and beside the X the pager through the report's steps —
            on every call, so what would be requested can be seen before
            answering. */}
        <div className="-mr-1.5 -mt-1 flex items-center gap-2">
          <span className="min-w-0 flex-1 text-sm font-medium leading-5 text-foreground">{KIND_SHORT[d.kind]}</span>
          {/* One pager for the whole card, as a question's is: the answer is
              0, before the steps; each step its number. Free to move through,
              so the steps can be read before answering. */}
          {count > 0 && (
            <span className="flex shrink-0 items-center gap-0.5 text-caption text-text-secondary">
              <IconActionButton
                aria-label={stage === 'steps' && at === 0 ? 'Back to the answers' : 'Previous'}
                title="Previous"
                variant="quiet"
                size="compact"
                disabled={stage === 'options'}
                onClick={() => (at === 0 ? setStage('options') : setAt(at - 1))}
              >
                <ChevronLeft size={14} strokeWidth={1.75} />
              </IconActionButton>
              <span className="tabular-nums">
                {stage === 'options' ? 0 : at + 1} of {count}
              </span>
              <IconActionButton
                aria-label="Next"
                title="Next"
                variant="quiet"
                size="compact"
                onClick={() =>
                  stage === 'options' ? (setAt(0), setStage('steps')) : next()
                }
              >
                <ChevronRight size={14} strokeWidth={1.75} />
              </IconActionButton>
            </span>
          )}
          {/* X removes it outright, remembered for this report. */}
          <IconActionButton
            aria-label="Remove recommendation"
            title="Remove"
            variant="quiet"
            size="compact"
            onClick={() => removed.set(reportId, { by: CURRENT_USER, at: new Date().toISOString() })}
          >
            <X size={14} strokeWidth={1.75} />
          </IconActionButton>
        </div>
        {/* Why, beside the score; the answers under both. */}
        {stage === 'options' && (
          <div className="flex items-center gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              {d.reason && (
                <Para inline className="text-sm leading-5 text-text-secondary" results={results} record={record}>
                  {d.reason}
                </Para>
              )}
              {/* Why the call moved, where a document moved it. */}
              {revision && (
                <span className="text-caption text-[var(--core-color-text-muted)]">
                  Updated from {revision.source} · {formatTime(revision.at)}
                </span>
              )}
            </div>
            <ScoreRing score={d.score} size="sm" label={d.label} />
          </div>
        )}

        {stage === 'options' && (
          <OptionList label="Your answer" options={options} note={note} onNote={setNote} notePlaceholder="Add notes" />
        )}

        {stage === 'steps' && step && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm leading-5 text-foreground">
                {step.instruction}
                {/* What the step answers for, on the report. */}
                <span className="ml-1 inline-flex flex-wrap gap-1 align-baseline">
                  <CardCitations cites={step.cites} results={results} groupFor={groupFor} onSelect={onJumpToGroup} />
                </span>
              </span>
              {step.why && <span className="text-caption text-text-secondary">{step.why}</span>}
            </div>
            <OptionList key={at} label={`Step ${at + 1}`} options={stepOptions} />
          </div>
        )}

      </Surface>
      {dialog}
    </>
  )
}

/** What to do about one of the report's steps. */
type StepAnswer = 'request' | 'have' | 'skip'
const STEP_ACTIONS: Array<{ id: StepAnswer; label: string; detail: string }> = [
  { id: 'request', label: 'Request information', detail: 'contacts applicant' },
  { id: 'have', label: 'Already have it', detail: 'upload file' },
  { id: 'skip', label: 'Not needed', detail: 'skip' }
]

type Option = {
  id: string
  label: string
  recommended?: boolean
  detail?: string
  picked?: boolean
  onSelect: () => void
  /** A row that takes files: dropped on it or browsed for from it. */
  onFiles?: (list: FileList | null) => void
  files?: Attachment[]
  onRemoveFile?: (index: number) => void
  /** With a file in it, the arrow that moves on. */
  onProceed?: () => void
}

/**
 * Numbered choices, as a question's are, with a note under them that goes
 * with whichever is picked. Up and down move between the rows; the numbers
 * pick. A picked row carries a check, not a fill.
 */
const OptionList = ({
  label,
  options,
  note,
  onNote,
  notePlaceholder
}: {
  label: string
  options: Option[]
  /** Absent, no note row. */
  note?: string
  onNote?: (value: string) => void
  notePlaceholder?: string
}) => {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div
      ref={ref}
      role="group"
      aria-label={label}
      className="-mx-1 flex flex-col divide-y divide-[var(--core-color-border-divider)]"
      onKeyDown={(e) => {
        const rows = [...(ref.current?.querySelectorAll<HTMLElement>('[data-answer]') ?? [])]
        const i = rows.indexOf(document.activeElement as HTMLElement)
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault()
          rows[(i + (e.key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length]?.focus()
        } else if (/^[1-9]$/.test(e.key) && Number(e.key) <= options.length && !(e.target instanceof HTMLInputElement)) {
          e.preventDefault()
          rows[Number(e.key) - 1]?.click()
        }
      }}
    >
      {options.map((o, i) =>
        o.onFiles ? (
          <div key={o.id} className="py-0.5">
            <FileRow option={o} index={i} />
          </div>
        ) : (
        <div key={o.id} className="py-0.5">
          <button type="button" data-answer aria-pressed={o.picked} className={ROW} onClick={o.onSelect}>
            <span className={KEY}>{i + 1}</span>
            <span className="min-w-0 flex-1">
              {o.label}
              {(o.recommended || o.detail) && (
                <span className="text-text-secondary"> ({[o.recommended && 'Recommended', o.detail].filter(Boolean).join(' · ')})</span>
              )}
            </span>
            {o.picked ? (
              <Check aria-label="Picked" size={14} strokeWidth={2} className="shrink-0 text-foreground" />
            ) : (
              <ArrowRight
                aria-hidden="true"
                size={14}
                strokeWidth={1.75}
                className="shrink-0 text-text-secondary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
              />
            )}
          </button>
        </div>
        )
      )}
      {onNote && (
        <div className="flex items-center gap-3 px-2 py-1.5">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-control border border-solid border-border text-text-secondary">
            <Pencil aria-hidden="true" size={12} strokeWidth={1.75} />
          </span>
          <input
            data-answer
            aria-label={notePlaceholder}
            placeholder={notePlaceholder}
            value={note ?? ''}
            onChange={(e) => onNote(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm leading-5 text-foreground outline-none placeholder:text-[var(--core-color-text-muted)]"
          />
        </div>
      )}
    </div>
  )
}

/**
 * An option row that is also the drop zone: drop a file on it, or click it to
 * browse. Holding a file, it shows each one with an X — as the chat box's
 * context tab does — and an arrow beside them to move on.
 */
const FileRow = ({ option: o, index }: { option: Option; index: number }) => {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const files = o.files ?? []
  const take = (list: FileList | null) => o.onFiles?.(list)
  return (
    <div
      data-answer
      role="button"
      tabIndex={0}
      aria-label={`${o.label}: drop a file here, or press to browse`}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          input.current?.click()
        }
      }}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        take(e.dataTransfer.files)
      }}
      className={cn(
        ROW,
        'cursor-pointer border border-dashed',
        over ? 'border-[var(--core-color-interactive-default)] bg-[var(--core-color-state-hover-bg)]' : 'border-transparent'
      )}
    >
      <span className={KEY}>{index + 1}</span>
      {files.length === 0 ? (
        <span className="min-w-0 flex-1">
          {o.label}
          {o.detail && <span className="text-text-secondary"> ({o.detail})</span>}
        </span>
      ) : (
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {files.map((f, i) => (
            <span
              key={`${f.name}-${i}`}
              className="inline-flex h-6 min-w-0 max-w-full items-center gap-1.5 rounded-card border border-solid border-border bg-[var(--core-color-surface-subtle)] pl-2 pr-0.5 text-caption leading-4 text-foreground"
            >
              <Paperclip aria-hidden="true" size={12} strokeWidth={1.75} className="shrink-0 text-text-secondary" />
              <span className="truncate">{f.name}</span>
              <button
                type="button"
                aria-label={`Remove ${f.name}`}
                title="Remove"
                onClick={(e) => {
                  e.stopPropagation()
                  o.onRemoveFile?.(i)
                }}
                className="flex size-5 shrink-0 items-center justify-center rounded-control text-text-secondary hover:bg-[var(--core-color-state-hover-bg)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X aria-hidden="true" size={12} strokeWidth={1.75} />
              </button>
            </span>
          ))}
        </span>
      )}
      {files.length > 0 ? (
        <IconActionButton
          aria-label="Next step"
          title="Next step"
          variant="quiet"
          size="compact"
          onClick={(e) => {
            e.stopPropagation()
            o.onProceed?.()
          }}
        >
          <ArrowRight size={14} strokeWidth={1.75} />
        </IconActionButton>
      ) : (
        <Upload aria-hidden="true" size={14} strokeWidth={1.75} className="shrink-0 text-text-secondary" />
      )}
      <input
        ref={input}
        type="file"
        multiple
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          take(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
