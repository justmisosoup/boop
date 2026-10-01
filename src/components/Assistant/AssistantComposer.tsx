import { useEffect, useMemo, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Building2 } from 'lucide-react'

import {
  ActionButton,
  ChatComposer,
  Dialog,
  type ChatChipData
} from '@/core'

import { composeAssessment } from '../../lib/library'
import type { CustomerSkill } from '../../lib/useAgent'
import { MiddeskMark } from '../MiddeskMark'

/** What one send carries. The same shape the old dock sent, minus attachments. */
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
}

const BUSINESS_CHIP = 'business'

/**
 * Kha's composer, on the kit's `ChatComposer`.
 *
 * The business is the standing chip — the one thing every question is about,
 * so it is in the box before anything is typed and cannot be taken out. The
 * customer's workflow sits beside it as a chip, attached until they remove it.
 * There is no `/` menu: nothing else is attached from here. A workflow with
 * nothing typed runs a report; anything typed is a question; a question while
 * a report is open asks where it goes.
 *
 * File attachments are not carried: the kit's composer has no slot for them.
 * The endpoint still accepts them for when it does.
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
  /** A question waiting on where it should go. */
  const [ask, setAsk] = useState<Omit<Send, 'kind' | 'target'> | null>(null)

  // The customer's workflow, attached as soon as it is known — the report on
  // screen was produced by it, and an empty box made the one thing that ran
  // the least visible thing in the room. Only until they take it out.
  const [touched, setTouched] = useState(false)
  const theirWorkflow = custom.find((c) => c.kind === 'workflow')
  useEffect(() => {
    if (!touched && theirWorkflow) setWorkflow(theirWorkflow.id)
  }, [touched, theirWorkflow])

  const chosenWorkflow = custom.find((x) => x.id === workflow && x.kind === 'workflow') ?? null

  const chips = useMemo<ChatChipData[]>(
    () => [
      {
        id: BUSINESS_CHIP,
        label: businessName,
        icon: <Building2 aria-hidden="true" size={12} strokeWidth={1.75} />
      },
      ...(chosenWorkflow
        ? [{ id: chosenWorkflow.id, label: chosenWorkflow.name, icon: <MiddeskMark className="h-[6px] w-2.5" /> }]
        : [])
    ],
    [businessId, businessName, chosenWorkflow]
  )

  const onRemoveChip = (id: string) => {
    // The business is what the conversation is about; it is not removable.
    if (id === BUSINESS_CHIP) return
    if (id === workflow) {
      setTouched(true)
      setWorkflow(null)
    }
  }

  // A workflow is the question, so it sends with nothing typed — which is the
  // difference between running one and asking something with a context.
  const typed = value.trim()
  const ready = Boolean(typed) || Boolean(chosenWorkflow)

  const submit = () => {
    if (!ready) return

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

    // A question against a report is asked of THAT report — or the reader
    // wants a fresh reading, which is a new report. Only they know which.
    if (kind === 'question' && report) {
      setAsk(payload)
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
    setAsk(null)
    setValue('')
  }

  return (
    <>
      <ChatComposer
        // Reaches into the kit's markup to take the remove button off the
        // FIRST chip, the business: the composer gives every chip one and has
        // no per-chip switch. Same trade as `chipStyles.ts` — one selector here
        // rather than a fork of the vendored composer.
        className="[&>div:last-of-type>div:first-child>span:first-child>button]:hidden"
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
      />

      {/* Where the answer goes.
          Both choices run the same question; they differ in what it is read
          against. Added, it is answered against the report already on screen
          and files under it. New, the business is read again from scratch and
          the answer opens its own report. Two affirmatives, so neither is the
          `ConfirmDialog` shape of "do it / do not". */}
      {createPortal(
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
              <ActionButton onClick={() => ask && dispatch({ ...ask, kind: 'question', target: report?.id })}>
                Add to this report
              </ActionButton>
            </div>
          }
        >
          <span className="sr-only">
            Choose whether this question is answered inside the report you are reading or as a new one.
          </span>
        </Dialog>,
        document.body
      )}
    </>
  )
}
