import { useEffect, useRef, useState } from 'react'

import { CubeIcon } from '@radix-ui/react-icons'
import { ArrowUp, ChevronDown, History, Paperclip, Pencil, Plus } from 'lucide-react'

import {
  ActionButton,
  Dialog,
  IconActionButton,
  Input,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  MutedText,
  Surface,
  Tag,
  Textarea
} from '@/core'

import type { Derived } from '../lib/deriveResults'
import { composeAssessment, versionLine } from '../lib/library'
import type { CustomerSkill } from '../lib/useAgent'
import { ago, authorLine, useTicking } from '../lib/user'
import type { Attachment } from '../lib/useAnalysis'
import { MiddeskMark } from './MiddeskMark'

const readAsBase64 = (file: File) =>
  new Promise<Attachment>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () =>
      resolve({
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        // strip the `data:...;base64,` prefix
        dataBase64: String(reader.result).split(',')[1] ?? ''
      })
    reader.readAsDataURL(file)
  })

/** A skill in the box: what it is called, what it says, and whose it is. */
type Token = {
  id: string
  name: string
  instructions: string
  editable: boolean
  /** "Sara Menefee · Updated 1 min ago" — only on the customer's own. */
  author?: string
  /** One entry per save, oldest first. */
  history?: Array<{ at: string; by?: string }>
}

/**
 * Whose skill this is, as a glyph.
 *
 * The Middesk mark on what Middesk supplies, a cube on what the customer wrote.
 * Two provenances in one list need telling apart at a glance: one can be edited
 * and one cannot, and a name alone does not say which.
 */
const SkillGlyph = ({ mine }: { mine: boolean }) =>
  mine ? (
    <CubeIcon aria-hidden="true" className="size-3" />
  ) : (
    <MiddeskMark className="h-[7px] w-3" />
  )

/** A skill in the composer: a name standing for its instructions. The whole
 *  token opens them — a name in a box you are about to send should be readable
 *  by clicking it, without hunting for a control inside a chip. */
const SkillToken = ({
  token,
  onOpen,
  onRemove
}: {
  token: Token
  onOpen: () => void
  onRemove: () => void
}) => (
  <Tag
    tone="subtle"
    size="compact"
    icon={<SkillGlyph mine={token.editable} />}
    onRemove={onRemove}
    removeLabel={`Remove ${token.name}`}
  >
    <button
      type="button"
      className="cursor-pointer"
      title="Show instructions"
      onClick={(e) => {
        e.stopPropagation()
        onOpen()
      }}
    >
      {token.name}
    </button>
  </Tag>
)

/**
 * One row of the menu.
 *
 * Quiet until hovered, then it offers to show what the skill says. A menu of
 * names is only usable if a name can be opened — otherwise picking one is a
 * guess, and the reader has to leave for settings to check.
 */
const SkillRow = ({
  item,
  onSelect,
  onInspect
}: {
  item: Token
  onSelect: () => void
  onInspect: () => void
}) => {
  /**
   * Which of the two the pointer went down on.
   *
   * Radix decides an item is selected from its own pointer handlers on the
   * item element, so a nested button's `stopPropagation` runs too late — the
   * pencil picked the skill instead of opening it. The row therefore owns the
   * decision: the pencil only records that it was the target, and `onSelect`
   * reads that and branches.
   */
  const viaPencil = useRef(false)

  return (
    <MenuItem
      className="group justify-between"
      onSelect={() => {
        if (viaPencil.current) {
          viaPencil.current = false
          onInspect()
          return
        }
        onSelect()
      }}
    >
      {/* One line, always. A long name wrapping to two turned a tight list
          into ragged blocks and moved every row below it. */}
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <SkillGlyph mine={item.editable} />
        <span className="truncate">{item.name}</span>
      </span>
      {/* Only on what can actually be edited. A pencil on a Middesk default
          offers something the modal then refuses; its instructions are still
          readable by clicking the token once it is in the box. */}
      {item.editable && (
        <span
          role="button"
          tabIndex={-1}
          aria-label={`Edit ${item.name}`}
          title="Edit instructions"
          onPointerDown={() => {
            viaPencil.current = true
          }}
          className="ml-2 hidden rounded-control p-0.5 text-muted-foreground hover:text-foreground group-hover:inline-flex"
        >
          <Pencil aria-hidden="true" className="size-3.5" />
        </span>
      )}
    </MenuItem>
  )
}


/**
 * Skills.
 *
 * Linear's word, and one flat list the way Linear has it. The distinction
 * underneath is real — one runs on its own, the others scope a question you
 * type — but it is not a distinction the reader has to make before they can
 * read the list, so the menu does not ask them to.
 *
 * Names only: a menu is a list of things already named, and a line of
 * explanation under each turned a tight list into a panel.
 */
const LibraryPicker = ({
  contexts,
  workflow,
  custom,
  onToggleContext,
  onSetWorkflow,
  onCreate,
  onInspect
}: {
  contexts: string[]
  workflow: string | null
  /** The customer's own, listed with Middesk's. */
  custom: CustomerSkill[]
  onToggleContext: (id: string) => void
  onSetWorkflow: (id: string | null) => void
  onCreate: () => void
  onInspect: (t: Token) => void
}) => (
  <Menu>
    <MenuTrigger asChild>
      <ActionButton
        variant="quiet"
        size="compact"
        leadingIcon={<MiddeskMark className="h-[7px] w-3" />}
        trailingIcon={<ChevronDown aria-hidden="true" />}
      >
        Workflow
      </ActionButton>
    </MenuTrigger>
    {/* `z-popover` over core's default `z-50`: the dock is `z-floating` (1050)
        and a menu opened from inside it renders behind it otherwise. */}
    <MenuContent align="start" side="top" className="z-popover w-64">
      {custom
        .filter((c) => c.kind === 'workflow')
        .map((w) => (
          <SkillRow
            key={w.id}
            item={{ id: w.id, name: w.name, instructions: w.instructions, editable: true }}
            onSelect={() => onSetWorkflow(workflow === w.id ? null : w.id)}
            onInspect={() =>
              onInspect({
                id: w.id,
                name: w.name,
                instructions: w.instructions,
                editable: true,
                author: authorLine(w),
                history: w.history
              })
            }
          />
        ))}
      {/* Middesk Context is not listed here. It is part of the assessment —
          switched on or off in the assessment's own Context section — not a
          thing you add to a message alongside it. */}
      {custom
        .filter((c) => c.kind !== 'workflow')
        .map((c) => (
          <SkillRow
            key={c.id}
            item={{ id: c.id, name: c.name, instructions: c.instructions, editable: true }}
            onSelect={() => onToggleContext(c.id)}
            onInspect={() =>
              onInspect({
                id: c.id,
                name: c.name,
                instructions: c.instructions,
                editable: true,
                author: authorLine(c),
                history: c.history
              })
            }
          />
        ))}
      <MenuSeparator />
      {/* Last, always — the way the reference offers it, including when the
          list above is empty and this is the only thing in the menu. */}
      <MenuItem onSelect={onCreate}>
        <Plus aria-hidden="true" className="mr-1.5 size-3.5" />
        Create assessment
      </MenuItem>
    </MenuContent>
  </Menu>
)

/**
 * The composer, fixed to the bottom of the viewport.
 *
 * Question-first: it is enabled with nothing selected, because picking the
 * relevant insights is the product's job, not the analyst's. Dismissible to a
 * pill so it never sits on top of the record you are reading.
 */
export const AnalysisDock = ({
  open,
  setOpen,
  onSend,
  report,
  custom,
  disabled,
  onCreateSkill,
  onEditSkill,
  onUpdateSkill,
  waiting,
  pinned,
  results,
  onUnpin,
  hasAnalysis
}: {
  open: boolean
  setOpen: (v: boolean) => void
  /** One send for every combination: the composed instructions, the names that
   *  made them, and whether it is a report or a question. */
  onSend: (run: {
    prompt: string
    /**
     * The assessments in the box, each on its own — the manifest.
     *
     * They used to be folded into `prompt` as one string, which made them
     * unaddressable: there was no way to work two at once, and no way to say
     * which one had landed. Empty for a question, which is answered whole.
     */
    assessments: Array<{ id: string; name: string; instructions: string }>
    attachments: Attachment[]
    skills: string[]
    typed: string
    kind: 'report' | 'question'
    /** Which report a question is filed against. Absent starts a new one. */
    target?: string
  }) => void
  /** The report being read, if there is one — what a question can be added to.
   *  Absent means the first run on this business, which is a report. */
  report?: { id: string; label: string } | null
  /** The customer's own skills, and the way to write another. */
  custom: CustomerSkill[]
  /** Parts and context the customer has switched off. */
  disabled: string[]
  onCreateSkill: () => void
  /** Opens one of the customer's own in the assessment editor, where it is
   *  written — rather than in a second dialog that edits the same thing. */
  onEditSkill: (id: string) => void
  /** Saves an edit made from a token. Middesk's own never reach it. */
  onUpdateSkill: (id: string, name: string, instructions: string) => void
  waiting: boolean
  pinned: string[]
  results: Derived[]
  onUnpin: (id: string) => void
  hasAnalysis: boolean
}) => {
  const [prompt, setPrompt] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  /**
   * What is in the box beside the text.
   *
   * The standing workflow starts selected: the report on screen was produced by
   * it, and showing the box empty made the one thing that ran the least visible
   * thing in the room.
   */
  const [workflow, setWorkflow] = useState<string | null>(null)
  const [contexts, setContexts] = useState<string[]>([])
  /** The token being read, and the working copy of what it says. */
  const [inspect, setInspect] = useState<Token | null>(null)
  /** A question waiting on where it should go. */
  const [ask, setAsk] = useState<{
    prompt: string
    assessments: Array<{ id: string; name: string; instructions: string }>
    attachments: Attachment[]
    skills: string[]
    typed: string
  } | null>(null)
  const [draft, setDraft] = useState('')
  const [draftName, setDraftName] = useState('')

  // Keeps every "Updated N min ago" on screen honest as time passes.
  useTicking()

  // The customer's workflow, selected as soon as it is known — the report on
  // screen was produced by it, and an empty box made the one thing that ran the
  // least visible thing in the room. Only until they take it out themselves.
  const [touched, setTouched] = useState(false)
  const theirWorkflow = custom.find((c) => c.kind === 'workflow')
  useEffect(() => {
    if (!touched && theirWorkflow) setWorkflow(theirWorkflow.id)
  }, [touched, theirWorkflow])
  const field = useRef<HTMLTextAreaElement>(null)
  const filePicker = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) field.current?.focus()
  }, [open])

  /**
   * The field grows to its content instead of scrolling inside itself.
   *
   * Sitting inline beside the tokens it is one row tall, and a one-row textarea
   * whose box is shorter than its line showed a scrollbar over an empty field.
   * Measured rather than guessed, so a wrapped question grows the box.
   */
  useEffect(() => {
    const el = field.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [prompt, workflow, contexts])

  const byId = new Map(results.map((r) => [r.insightId, r]))

  // Middesk's skills and the customer's read the same way here; only
  // `editable` separates them, and only when the modal opens.
  const asToken = (x: {
    id: string
    name: string
    instructions: string
    editable?: boolean
    createdBy?: string
    createdAt?: string
    editedAt?: string
    version?: string
    history?: Array<{ at: string; by?: string }>
  }): Token => ({
    id: x.id,
    name: x.name,
    instructions: x.instructions,
    editable: x.editable ?? true,
    // Two provenances, two lines: a Middesk default has a release and no
    // author, a customer's has an author and no release. Reading only the
    // customer's fields left a default with no metadata at all.
    author:
      x.editable === false
        ? versionLine(x)
        : x.createdAt
          ? authorLine({ createdBy: x.createdBy, createdAt: x.createdAt, editedAt: x.editedAt })
          : undefined,
    history: x.history
  })
  const chosenWorkflow = workflow
    ? (() => {
        const w = custom.find((x) => x.id === workflow)
        return w ? asToken(w) : null
      })()
    : null
  // Only the customer's own. Middesk Context is part of the assessment rather
  // than something added to a message beside it, so it can never be a token.
  const chosenContexts = custom
    .filter((c) => c.kind !== 'workflow' && contexts.includes(c.id))
    .map(asToken)

  /**
   * Opening one.
   *
   * The customer's own go to the assessment editor, where they were written —
   * one editor, one breadcrumb, one place a change is made. A Middesk default
   * has nothing to edit, so it opens here as the read-only card it is.
   */
  const open_ = (t: Token) => {
    if (t.editable) {
      onEditSkill(t.id)
      return
    }
    setInspect(t)
    setDraft(t.instructions)
    setDraftName(t.name)
  }

  // A workflow is the question, so it sends with nothing typed — which is the
  // difference between running one and asking something with a context.
  const ready = Boolean(prompt.trim()) || Boolean(workflow)

  const submit = () => {
    // A run in flight does not block a new one: the composer was left
    // permanently disabled whenever a request went unanswered, which made one
    // stuck run lock the whole screen. Sending again supersedes it.
    if (!ready) return

    /**
     * Every skill in the box contributes its instructions, in the order they
     * read: the contexts ground the answer, the workflow says what to produce,
     * and anything typed comes last as the question being asked of them.
     *
     * Additive rather than exclusive — a workflow run with Jurisdictions
     * selected is that workflow read against the filings, which is a different
     * run from the workflow alone and must be sent as one.
     */
    // A workflow sends everything it is built from — its own brief, the parts
    // under it, and the context it is read against. The parts travel as a list
    // rather than folded into the text: they are worked at the same time, and
    // each one has to be nameable for that.
    const composed = chosenWorkflow ? composeAssessment(chosenWorkflow, custom, disabled) : null

    const parts = [
      ...chosenContexts.map((c) => c.instructions),
      ...(composed ? [composed.prompt] : []),
      ...(prompt.trim() ? [prompt.trim()] : [])
    ]

    const names = [
      ...(chosenWorkflow ? [chosenWorkflow.name] : []),
      ...chosenContexts.map((c) => c.name)
    ]

    // A workflow with nothing typed is a report; anything typed is a question
    // about this business, whatever else is in the box with it.
    const kind = chosenWorkflow && !prompt.trim() ? 'report' : 'question'

    const payload = {
      prompt: parts.join('\n\n'),
      attachments,
      skills: names,
      typed: prompt.trim(),
      assessments: composed?.assessments ?? []
    }

    /*
     * A question against a report is asked of THAT report.
     *
     * It was answered against what that report was reading, so it belongs with
     * it — but the reader may instead want a fresh reading of the business,
     * which is a new report. Only they know which, so they are asked. With no
     * report yet there is nothing to add to and the run is the first report.
     */
    if (kind === 'question' && report) {
      setAsk(payload)
      return
    }

    dispatch({ ...payload, kind, target: undefined })
  }

  /** Sending is what clears the box — a cancelled dialog leaves what was typed. */
  const dispatch = (run: {
    prompt: string
    assessments: Array<{ id: string; name: string; instructions: string }>
    attachments: Attachment[]
    skills: string[]
    typed: string
    kind: 'report' | 'question'
    target?: string
  }) => {
    onSend({
      ...run,
      // A question is answered on its own terms, in one section — it does not
      // fan out across the workflow's assessments.
      assessments: run.kind === 'report' ? run.assessments : []
    })
    setAsk(null)
    setPrompt('')
    setAttachments([])
  }

  const attach = async (files: FileList | null) => {
    if (!files?.length) return
    const read = await Promise.all([...files].map(readAsBase64))
    setAttachments((prev) => [...prev, ...read])
    if (filePicker.current) filePicker.current.value = ''
  }

  if (!open) {
    return (
      <div className="pointer-events-none fixed bottom-0 right-0 z-floating pb-4 left-[var(--nav-w)]">
        {/* Centred on the viewport, and the same width whatever the report is.
            It used to mirror the page's gutters, which meant dragging the
            report/panel boundary slid the composer sideways and resized it. */}
        <div className="mx-auto flex w-full max-w-[676px] justify-center px-6">
        <span className="pointer-events-auto">
          <ActionButton variant="secondary" onClick={() => setOpen(true)}>
            {hasAnalysis ? 'Refine analysis' : 'Ask about this business'}
          </ActionButton>
        </span>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-0 right-0 z-floating pb-4 left-[var(--nav-w)]">
      {/* Centred on the viewport at a fixed width — it is the same object
          whatever width the report is dragged to. */}
      <div className="mx-auto w-full max-w-[676px] px-6">
        {/* One box: the field and its controls live inside a single bordered
            surface, with submit as a round button in the bottom-right corner. */}
        <Surface
          variant="raised"
          padding="none"
          className={[
            'overflow-hidden rounded-card shadow-elevation-popover',
            // The composer IS the field, so it carries the focus state — a ring
            // around the bare strip inside it framed the wrong thing.
            'focus-within:border-[var(--core-color-control-border-focus)]'
          ].join(' ')}
        >
          {/* Attachments and pinned insights stay a band of their own: they are
              things the run carries, not words in the message. */}
          {(pinned.length > 0 || attachments.length > 0) && (
            <div className="flex flex-wrap items-center gap-1.5 border-b border-solid border-border px-3 py-2">
              {attachments.map((a) => (
                <Tag
                  key={a.name}
                  tone="info"
                  size="compact"
                  icon={<Paperclip aria-hidden="true" className="size-3" />}
                  onRemove={() => setAttachments((prev) => prev.filter((x) => x.name !== a.name))}
                  removeLabel={`Remove ${a.name}`}
                >
                  {a.name}
                </Tag>
              ))}
              {pinned.length > 0 && <MutedText className="text-caption">Also consider</MutedText>}
              {pinned.map((id) => (
                <Tag
                  key={id}
                  tone="subtle"
                  size="compact"
                  onRemove={() => onUnpin(id)}
                  removeLabel={`Remove ${byId.get(id)?.statement ?? id}`}
                >
                  {byId.get(id)?.statement ?? id}
                </Tag>
              ))}
            </div>
          )}

          {/* Skills sit INLINE with the field, not in a band above it: a skill
              is part of the message being sent, so the caret belongs directly
              after the last one. The field grows to fill the rest of the line
              and a long question wraps beneath rather than pushing them off. */}
          <div
            className="flex cursor-text flex-wrap items-center gap-x-1.5 px-3 pt-3"
            onClick={() => field.current?.focus()}
          >
            {chosenWorkflow && (
              <SkillToken
                token={chosenWorkflow}
                onOpen={() => open_(chosenWorkflow)}
                onRemove={() => {
                  setTouched(true)
                  setWorkflow(null)
                }}
              />
            )}
            {chosenContexts.map((c) => (
              <SkillToken
                key={c.id}
                token={c}
                onOpen={() => open_(c)}
                onRemove={() => setContexts((prev) => prev.filter((x) => x !== c.id))}
              />
            ))}

            <Textarea
              ref={field}
              rows={1}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
                if (e.key === 'Escape') setOpen(false)
                // Backspace on an empty field takes the last skill back off,
                // the way it removes the last character otherwise.
                if (e.key === 'Backspace' && !prompt) {
                  if (contexts.length > 0) setContexts((prev) => prev.slice(0, -1))
                  else if (workflow) setWorkflow(null)
                }
              }}
              placeholder={
                workflow || contexts.length > 0
                  ? ''
                  : hasAnalysis
                    ? 'Ask a follow-up, or ask the same question differently'
                    : 'Ask about this business…'
              }
              aria-label="Analysis question"
              // The field is the box's interior, not a box of its own: core's
              // input variants paint a border and a focus border, and both have
              // to go or you get a second outline inside the surface.
              // The field is the box's interior, not a box of its own. Every
              // state has to be stripped, not just the resting one: core paints
              // a border, a focus border and a focus ring, and the browser
              // paints its own outline on top.
              //
              // `outline-none`, NOT `outline-hidden` — the latter is a Tailwind
              // v4 utility and this project is on v3, where it compiles to
              // nothing at all. That is why the field showed as a boxed strip
              // beside the tokens.
              className={[
                'min-h-6 w-auto min-w-40 flex-1 resize-none overflow-hidden rounded-none px-0 py-0',
                '!border-0 !bg-transparent !shadow-none !outline-none',
                'focus:!border-0 focus:!outline-none focus:!shadow-none focus:!ring-0',
                'focus-visible:!border-0 focus-visible:!outline-none focus-visible:!shadow-none focus-visible:!ring-0',
                'hover:!border-0'
              ].join(' ')}
            />
          </div>

          {/* Keeps the box its old height so the controls do not ride up under
              the field when nothing is typed. */}
          <div className="h-8" aria-hidden="true" />

          <div className="flex items-center justify-between gap-3 px-3 pb-2.5 pt-0.5">
            <div className="flex items-center gap-1">
              <LibraryPicker
                contexts={contexts}
                workflow={workflow}
                custom={custom}
                onCreate={onCreateSkill}
                onInspect={open_}
                onToggleContext={(id) =>
                  setContexts((prev) =>
                    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                  )
                }
                onSetWorkflow={(id) => {
                  setTouched(true)
                  setWorkflow(id)
                }}
              />
            </div>

            <div className="flex items-center gap-1.5">
              <input
                ref={filePicker}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => void attach(e.target.files)}
              />
              <IconActionButton
                variant="quiet"
                onClick={() => filePicker.current?.click()}
                aria-label="Attach documents"
                title="Attach documents"
              >
                <Paperclip aria-hidden="true" />
              </IconActionButton>

              <IconActionButton
                variant="primary"
                onClick={submit}
                disabled={!ready}
                aria-label="Run analysis"
              >
                <ArrowUp aria-hidden="true" />
              </IconActionButton>
            </div>
          </div>
        </Surface>
      </div>

      {/* What the token stands for, on demand.
          Middesk's own open read-only: they are defaults, and a textarea that
          accepted typing it would then refuse to save is worse than one that
          says plainly it cannot be changed. */}
      {/* Where the answer goes.
          Both choices run the same question; they differ in what it is read
          against. Added, it is answered against the report already on screen
          and files under it. New, the business is read again from scratch and
          the answer opens its own report. Two affirmatives, so neither is the
          `ConfirmDialog` shape of "do it / do not". */}
      <Dialog
        isOpen={ask !== null}
        onClose={() => setAsk(null)}
        size="sm"
        title="Where should this answer go?"
        description={
          report
            ? `Add it to ${report.label}, which reads what that report read — or start a new report, read against the business as it is now.`
            : undefined
        }
        footer={
          <div className="flex justify-end gap-2">
            <ActionButton
              variant="secondary"
              onClick={() => ask && dispatch({ ...ask, kind: 'report', target: undefined })}
            >
              Start a new report
            </ActionButton>
            <ActionButton
              onClick={() => ask && dispatch({ ...ask, kind: 'question', target: report?.id })}
            >
              Add to this report
            </ActionButton>
          </div>
        }
      >
        <span className="sr-only">
          Choose whether this question is answered inside the report you are
          reading or as a new one.
        </span>
      </Dialog>

      <Dialog
        isOpen={inspect !== null}
        onClose={() => setInspect(null)}
        size="lg"
        // Both kinds carry their own header in the body, at the same scale:
        // one is typed and one is read, and a default rendered through the
        // primitive's header sat visibly smaller than the name beside it.
        showHeader={false}
        title={inspect?.name ?? ''}
      >
        {inspect && (
          <div className="grid gap-[var(--core-spacing-sm)]">
            {/* Both kinds render through the SAME two fields, so the two modals
                measure identically and only their editability differs. A
                heading for one and an input for the other looked like two
                dialogs that happened to share a subject. */}
            <Input
              value={inspect.editable ? draftName : inspect.name}
              onChange={(e) => setDraftName(e.target.value)}
              disabled={!inspect.editable}
              placeholder="Assessment name"
              aria-label="Assessment name"
              // `!` because `.core-input` sets font-size as a class rule and
              // wins the cascade against a plain utility.
              className={[
                '!h-auto !min-h-0 !border-0 !bg-transparent px-0 py-0 shadow-none',
                '!text-2xl font-semibold !leading-8 tracking-[-0.015em]',
                'disabled:!text-foreground',
                'focus-visible:!border-0 focus-visible:!outline-none focus-visible:!ring-0 hover:!border-0'
              ].join(' ')}
            />

            {/* Whose skill this is, in one place and one register for both:
                "Middesk · v0.12" for a default, "Sara Menefee · Updated 1 min
                ago" for one the customer wrote. */}
            {inspect.author && (
              <div className="flex items-center gap-1">
                <MutedText className="text-caption">{inspect.author}</MutedText>

                {/* "Updated" answers when it last changed; this answers when it
                    changed before that. Behind an icon because on a skill saved
                    once it says nothing the line above has not. */}
                {(inspect.history?.length ?? 0) > 1 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        aria-label="Change history"
                        title="Change history"
                        className="rounded-control p-0.5 text-muted-foreground hover:text-foreground"
                      >
                        <History aria-hidden="true" className="size-3.5" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="z-popover w-64 p-2">
                      <MutedText className="mb-1 block text-caption font-semibold">
                        Change history
                      </MutedText>
                      <div className="grid gap-1">
                        {[...(inspect.history ?? [])].reverse().map((h, i) => (
                          <div key={h.at} className="flex items-baseline justify-between gap-3">
                            <MutedText className="text-caption">
                              {i === (inspect.history?.length ?? 0) - 1 ? 'Created' : 'Updated'}
                            </MutedText>
                            <MutedText className="text-caption tabular-nums">
                              {ago(h.at)}
                            </MutedText>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            )}

            <Textarea
              value={inspect.editable ? draft : inspect.instructions}
              onChange={(e) => setDraft(e.target.value)}
              // `disabled`, not `readOnly`: read-only keeps live-text styling
              // and the box reads as editable until you try.
              disabled={!inspect.editable}
              aria-label="Instructions"
              rows={10}
              className="min-h-56"
            />

            <div className="flex justify-end gap-2">
              <ActionButton variant="secondary" onClick={() => setInspect(null)}>
                {inspect.editable ? 'Cancel' : 'Close'}
              </ActionButton>
              {inspect.editable && (
                <ActionButton
                  disabled={
                    !draft.trim() ||
                    !draftName.trim() ||
                    (draft.trim() === inspect.instructions && draftName.trim() === inspect.name)
                  }
                  onClick={() => {
                    onUpdateSkill(inspect.id, draftName, draft)
                    setInspect(null)
                  }}
                >
                  Save
                </ActionButton>
              )}
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}
