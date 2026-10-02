import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Building2, ClipboardCheck, Crosshair, Paperclip, Plus, X } from 'lucide-react'

import {
  ChatComposer,
  Menu,
  MenuContent,
  MenuItem,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
  type ChatChipData
} from '@/core'

import { composeAssessment } from '../../lib/library'
import type { Attachment } from '../../lib/useAnalysis'
import type { CustomerSkill } from '../../lib/useAgent'
import { cn } from '../../utils/twUtils'
import { MiddeskMark } from '../MiddeskMark'
import { readFile } from './files'

/** What one send carries. */
export type Send = {
  prompt: string
  /** The assessments in the box, each on its own — the manifest. Empty for a
   *  question, which is answered whole. */
  assessments: Array<{ id: string; name: string; instructions: string; insightIds?: string[] }>
  skills: string[]
  typed: string
  kind: 'report' | 'question'
  /** Which report a question is filed against. Absent starts a new one. */
  target?: string
  /** Documents the reviewer added, read against the recommendation. */
  attachments?: Attachment[]
}


/**
 * Kha's composer, on the kit's `ChatComposer`.
 *
 * The business — the report's context — is its own card just above the
 * box, as Linear names what a question is about. A customer workflow, if
 * one is attached, is a chip in the box until removed.
 * There is no `/` menu: nothing else is attached from here. A workflow with
 * nothing typed runs a report; anything typed is a question. While a report
 * is open it is in context — the business card above the box — and a
 * question is answered inside it; dismissed (the card's X), a question starts
 * a new report. The crosshairs beside + puts it back.
 *
 * The + at the far left adds to the box: files ("Add files") — the kit's
 * composer has no file picker of its own — or the customer's assessment
 * ("Assessments"), as a chip. Each
 * one is a chip in the box, removable until sent. A document is read against
 * the report on screen and its recommendation, so it skips the "where should
 * this go" question: it goes to the report, and the recommendation reloads
 * with what comes back.
 */
export const AssistantComposer = ({
  businessId,
  businessName,
  custom,
  disabled,
  report,
  busy,
  inputRef,
  onSend
}: {
  businessId: string
  businessName: string
  /** The customer's own skills — the workflow and the assessments under it. */
  custom: CustomerSkill[]
  /** Assessment ids switched off, which the workflow leaves out. */
  disabled: string[]
  /** The report being read, if any — what a question can be added to. */
  report: { id: string; label: string } | null
  /** A question is in flight. Sending again supersedes it rather than waiting. */
  busy: boolean
  inputRef?: RefObject<HTMLTextAreaElement | null>
  onSend: (send: Send) => void
}) => {
  const [value, setValue] = useState('')
  const [workflow, setWorkflow] = useState<string | null>(null)
  /** The report on screen is in context: a question is answered inside it.
   *  Dismissed, a question starts a new report. Back on for each report. */
  const [withReport, setWithReport] = useState(true)
  useEffect(() => setWithReport(true), [report?.id])
  /** Documents in the box, waiting to be sent. */
  const [files, setFiles] = useState<Attachment[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const addFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return
    const read = await Promise.all([...list].map(readFile))
    setFiles((prev) => [...prev, ...read])
    if (fileRef.current) fileRef.current.value = ''
  }

  /* The customer's assessment is attached only when picked from the +
     ("Assessments"): a chip in the box that, sent with nothing typed, runs a
     new report. */
  const chosenWorkflow = custom.find((x) => x.id === workflow && x.kind === 'workflow') ?? null
  const workflows = custom.filter((x) => x.kind === 'workflow')

  const chips = useMemo<ChatChipData[]>(
    () => [
      ...(chosenWorkflow
        ? [{ id: chosenWorkflow.id, label: chosenWorkflow.name, icon: <MiddeskMark className="h-[6px] w-2.5" /> }]
        : []),
      ...files.map((f, i) => ({
        id: `file:${i}`,
        label: f.name,
        icon: <Paperclip aria-hidden="true" size={12} strokeWidth={1.75} />
      }))
    ],
    [chosenWorkflow, files]
  )

  const onRemoveChip = (id: string) => {
    if (id === workflow) setWorkflow(null)
    if (id.startsWith('file:')) {
      const at = Number(id.slice(5))
      setFiles((prev) => prev.filter((_, i) => i !== at))
    }
  }

  // A workflow is the question, so it sends with nothing typed — which is the
  // difference between running one and asking something with a context.
  const typed = value.trim()
  const ready = Boolean(typed) || Boolean(chosenWorkflow) || files.length > 0

  const submit = () => {
    if (!ready) return

    /* Documents are asked of the report on screen, against its
       recommendation — no "where should this go". With nothing typed, the
       question is the one a document always asks. */
    if (files.length > 0) {
      const asked =
        typed ||
        (files.length === 1
          ? `Does ${files[0].name} change the recommendation?`
          : 'Do these documents change the recommendation?')
      dispatch({
        prompt: asked,
        skills: [],
        typed: asked,
        assessments: [],
        kind: 'question',
        target: report?.id,
        attachments: files
      })
      return
    }

    // A workflow sends everything it is built from — its own brief, the parts
    // under it, and the context it is read against. The parts travel as a
    // list rather than folded into the text: they are worked at the same
    // time, and each one has to be nameable for that.
    const composed = chosenWorkflow ? composeAssessment(chosenWorkflow, custom, disabled) : null
    const parts = [
      ...(composed ? [composed.prompt] : []),
      ...(typed ? [typed] : [])
    ]
    const names = chosenWorkflow ? [chosenWorkflow.name] : []

    // A workflow with nothing typed is a report; anything typed is a question
    // about this business, whatever else is in the box with it.
    const kind: Send['kind'] = chosenWorkflow && !typed ? 'report' : 'question'
    const payload = { prompt: parts.join('\n\n'), skills: names, typed, assessments: composed?.assessments ?? [] }

    // A question with the report in context is asked of THAT report; with it
    // dismissed, it is a fresh reading — a new report.
    if (kind === 'question' && report) {
      dispatch(withReport ? { ...payload, kind: 'question', target: report.id } : { ...payload, kind: 'report' })
      return
    }
    dispatch({ ...payload, kind })
  }

  /** Sending is what clears the box — a cancelled dialog leaves what was typed. */
  const dispatch = (send: Send) => {
    onSend({
      ...send,
      // A question is answered on its own terms, in one section — it does not
      // fan out across the workflow's assessments.
      assessments: send.kind === 'report' ? send.assessments : []
    })
    setValue('')
    setFiles([])
  }

  return (
    <>
      {/* The context: the business, as the report on screen reads it — its
          own card hovering just above the box, Linear's way. Its X takes the
          report out of context, card and all; the crosshairs puts it back.
          With no report there is nothing to take out. */}
      {(!report || withReport) && (
        <div className="mb-1.5 flex min-w-0 items-center gap-1.5 rounded-card border border-solid border-border bg-[var(--core-color-surface-subtle)] px-2.5 py-1 text-caption leading-4 text-foreground">
          <Building2 aria-hidden="true" size={12} strokeWidth={1.75} className="shrink-0 text-text-secondary" />
          <span className="min-w-0 flex-1 truncate">{businessName}</span>
          {report && (
            <button
              type="button"
              aria-label="Take the report out of context"
              title="Take the report out of context"
              onClick={() => setWithReport(false)}
              className="-mr-1 flex size-4 shrink-0 items-center justify-center rounded-control text-text-secondary hover:bg-[var(--core-color-state-hover-bg)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X aria-hidden="true" size={12} strokeWidth={1.75} />
            </button>
          )}
        </div>
      )}
      <ChatComposer
        // The action row's left slot, stretched across the row so the + sits
        // at the far left and the crosshairs at the far end, beside send. The
        // kit has no slot by send, so this reaches into its markup, as
        // `chipStyles.ts` does: one selector rather than a fork of the vendored
        // composer.
        className="[&_div.pb-2.justify-between>div:first-child]:flex-1 [&_div.pb-2.justify-between>div:first-child>span]:flex-1 [&_div.pb-2.justify-between>div:first-child>span]:overflow-visible"
        chips={chips}
        inputRef={inputRef}
        isStreaming={busy}
        label="Ask Assistant about this business"
        placeholder="Ask about this business…"
        sendDisabled={!ready}
        value={value}
        onChange={setValue}
        onRemoveChip={onRemoveChip}
        onSubmit={submit}
        hint={
          <span className="flex w-full items-center justify-between gap-1">
          <Menu>
            <MenuTrigger asChild>
              <button
                type="button"
                aria-label="Add to the conversation"
                title="Add"
                className="flex size-6 items-center justify-center rounded-control border border-solid border-border text-text-secondary hover:bg-[var(--core-color-state-hover-bg)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Plus aria-hidden="true" size={14} strokeWidth={2} />
              </button>
            </MenuTrigger>
            <MenuContent align="start" className="z-popover w-52">
              <MenuItem onSelect={() => fileRef.current?.click()} className="gap-2">
                <Paperclip aria-hidden="true" size={14} strokeWidth={1.75} className="shrink-0" />
                Add files
              </MenuItem>
              {/* The customer's assessment, attached as a chip: sent with
                  nothing typed, it runs a new report. */}
              <MenuSub>
                <MenuSubTrigger disabled={workflows.length === 0} className="gap-2">
                  <ClipboardCheck aria-hidden="true" size={14} strokeWidth={1.75} className="shrink-0" />
                  Assessments
                </MenuSubTrigger>
                <MenuSubContent className="z-popover w-60">
                  {workflows.map((w) => (
                    <MenuItem key={w.id} onSelect={() => setWorkflow(w.id)}>
                      <span className="truncate">{w.name}</span>
                    </MenuItem>
                  ))}
                </MenuSubContent>
              </MenuSub>
            </MenuContent>
          </Menu>
          {/* The report on screen, back into context. */}
          {report && (
            <button
              type="button"
              aria-pressed={withReport}
              aria-label={withReport ? 'The report is in context' : 'Put the report in context'}
              title={withReport ? 'The report is in context' : 'Put the report in context'}
              onClick={() => setWithReport((v) => !v)}
              className={cn(
                'flex size-6 items-center justify-center rounded-control border border-solid border-border hover:bg-[var(--core-color-state-hover-bg)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                withReport ? 'text-foreground' : 'text-text-secondary'
              )}
            >
              <Crosshair aria-hidden="true" size={14} strokeWidth={1.75} />
            </button>
          )}
          </span>
        }
      />

      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => void addFiles(e.target.files)}
      />

    </>
  )
}
