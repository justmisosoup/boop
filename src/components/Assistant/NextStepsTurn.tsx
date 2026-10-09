import { useRef, useState, type ReactNode } from 'react'

import { Download, Send, Upload } from 'lucide-react'

import {
  ActionButton,
  ActionLink,
  ChatMessage,
  Field,
  FieldLabel,
  Input,
  Spinner,
  Text,
  Textarea
} from '@/core'

import { DOC_LABEL, type NextStep, type StepKind } from '../../lib/nextSteps'
import type { BusinessRecord } from '../../lib/deriveResults'
import { formatDate } from '../../lib/reportLabels'
import { stateName } from '../../lib/states'
import { CURRENT_USER } from '../../lib/user'
import { AssistantWho, Meta } from './AssistantTurn'

/**
 * The assessment, as the Assistant gives it: the short read, then the next
 * steps — each one something the product can do, with the gap it closes.
 * Running one needs no confirming: it reveals what is already on the record,
 * and the report behind updates. A request opens its form here, inline.
 */

export type RequestPayload = { email: string; message: string }

const RUN_LABEL: Record<StepKind, string> = { expand: 'Run', documents: 'Retrieve', request: 'Request from applicant' }

const draftMessage = (businessName: string, step: NextStep) =>
  [
    'Hello,',
    '',
    `To finish reviewing ${businessName}, please send us:`,
    '',
    ...(step.docs ?? []).map((d, i) => `${i + 1}. ${DOC_LABEL[d]}`),
    '',
    step.why,
    '',
    'Reply with the documents attached, or let us know if you have any questions.',
    '',
    'Thank you.'
  ].join('\n')

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Ask the applicant: the message, prefilled, and their email to confirm. */
const RequestForm = ({
  step,
  businessName,
  onSubmit
}: {
  step: NextStep
  businessName: string
  onSubmit: (payload: RequestPayload) => void
}) => {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState(() => draftMessage(businessName, step))
  const id = `request-${step.id}`
  return (
    <div className="mt-3 flex flex-col gap-3 rounded-card border border-border bg-card p-3">
      {/* No email on the record: it is the request's confirmation step. */}
      <Field>
        <FieldLabel className="text-sm" htmlFor={`${id}-email`}>
          Applicant email
        </FieldLabel>
        <Input id={`${id}-email`} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" type="email" value={email} />
      </Field>
      <Field>
        <FieldLabel className="text-sm" htmlFor={`${id}-message`}>
          Message
        </FieldLabel>
        <Textarea id={`${id}-message`} onChange={(e) => setMessage(e.target.value)} rows={8} value={message} />
      </Field>
      <ActionButton
        className="self-end"
        disabled={!EMAIL.test(email.trim())}
        leadingIcon={<Send aria-hidden="true" size={14} />}
        onClick={() => onSubmit({ email: email.trim(), message })}
        size="compact"
        type="button"
        variant="primary"
      >
        Send request
      </ActionButton>
    </div>
  )
}

/** What a step that has run came to, in a line. */
const Outcome = ({ step, record }: { step: NextStep; record: BusinessRecord }) => {
  const run = step.run!
  if (run.requested) return <>Requested from {run.requested.email} · awaiting applicant</>
  if (step.kind === 'documents') {
    const found = (record.documents ?? []).filter((d) => run.found?.includes(d.id)).map((d) => d.documentType?.replace(/_/g, ' '))
    return (
      <>
        {found.length ? `Found ${[...new Set(found)].join(', ')}` : 'Nothing found'}
        {run.missing?.length ? (
          <span className="text-[var(--core-color-status-warning-fg)]">
            {' · '}
            {run.missing.map((d) => DOC_LABEL[d]).join(' and ')} not found
          </span>
        ) : null}
      </>
    )
  }
  return <>Done · {run.adds?.length ?? 0} insights added</>
}

export const NextStepsTurn = ({
  at,
  title,
  read,
  steps,
  record,
  businessName,
  running,
  onRun,
  onRequest,
  onUpload,
  onViewResults,
  assessment
}: {
  /** The assessment in full — the Assistant's sectioned brief — leading the turn. */
  assessment?: ReactNode
  at: string
  title: string
  read?: string
  steps: NextStep[]
  record: BusinessRecord
  businessName: string
  /** The step running now. */
  running?: string
  onRun: (step: NextStep) => void
  onRequest: (step: NextStep, payload: RequestPayload) => void
  /** Files the analyst holds, added to the report's documents. */
  onUpload: (step: NextStep, files: File[]) => void
  onViewResults: (step: NextStep) => void
}) => {
  const [open, setOpen] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  // A ref, not state: the picked files arrive before a re-render could pass it on.
  const uploadFor = useRef<NextStep | null>(null)
  // After each recommendation runs, the Assistant says what it came to and
  // what follows — the next one still open, or that there's nothing left.
  const ran = steps.filter((st) => st.run).sort((a, b) => a.run!.at.localeCompare(b.run!.at))
  const followUp = (step: NextStep) => {
    const run = step.run!
    const later = steps.find((st) => !st.run && st !== step)
    const next = later ? (
      <>
        Next: <span className="font-semibold">{later.label}</span>.
      </>
    ) : (
      <>That's everything the record can settle here.</>
    )
    const found = (record.documents ?? [])
      .filter((d) => run.found?.includes(d.id))
      .map((d) => (d.documentType ?? 'document').replace(/_/g, ' ').toLowerCase())
    const what =
      step.kind === 'expand' ? (
        <>
          {step.label.replace(/^Run /, '')} ran on this assessment: {run.adds?.length ?? 0} more insights are now on the report, and
          the score reads them.
        </>
      ) : step.kind === 'documents' ? (
        found.length ? (
          <>
            The document agent retrieved the {[...new Set(found)].join(' and ')} from {stateName(step.state)}. They're on the report
            under Documents.
            {run.missing?.length ? <> The {run.missing.map((d) => DOC_LABEL[d]).join(' and ')} wasn't in its records.</> : null}
          </>
        ) : (
          <>The document agent found nothing in {stateName(step.state)}'s records.</>
        )
      ) : run.requested ? (
        <>Requested from {run.requested.email}. The review stays open until the applicant replies.</>
      ) : (
        <>{run.uploads?.map((u) => u.name).join(', ')} added to the report's documents.</>
      )
    return (
      <ChatMessage key={`follow-${step.id}`} role="assistant" header={<Meta align="start" at={run.at} who={<AssistantWho />} />}>
        <Text className="text-sm leading-5">
          {what} {next}
        </Text>
      </ChatMessage>
    )
  }

  return (
    <div className="flex flex-col gap-4">
    {/* The assessment in full, then what to do next. */}
    {assessment}
    <ChatMessage role="assistant" header={<Meta align="start" at={at} who={<AssistantWho />} />}>
      <div className="flex flex-col gap-3">
        <input
          ref={fileInput}
          accept="application/pdf"
          className="hidden"
          multiple
          onChange={(e) => {
            const files = [...(e.target.files ?? [])]
            if (uploadFor.current && files.length) onUpload(uploadFor.current, files)
            e.target.value = ''
            uploadFor.current = null
          }}
          type="file"
        />
        {steps.length === 0 ? (
          <Text size="sm" tone="secondary">
            Nothing else to run: the record holds no gap a step in the product would close.
          </Text>
        ) : (
          // The heading sits close over its list.
          <div className="flex flex-col gap-1.5">
            {/* A label, as the report's tables caption a row ("Mailing"); one is a Recommendation. */}
            <span className="text-caption text-text-secondary">{steps.length === 1 ? 'Recommendation' : 'Recommendations'}</span>
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {steps.map((step) => {
                const done = Boolean(step.run)
                return (
                  <li key={step.id} className="rounded-card border border-border bg-card p-3">
                    <div className="flex items-start">
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="text-sm font-semibold">{step.label}</span>
                        <Text className="leading-5" tone="secondary">
                          {step.why}
                        </Text>
                        {/* What it came to — except an upload, whose "View documents" says it. */}
                        {done && !step.run?.uploads?.length && (
                          <Text className="mt-1" size="sm">
                            <Outcome record={record} step={step} />
                          </Text>
                        )}
                        <div className="mt-2 flex items-center gap-2">
                          {running === step.id ? (
                            <span className="flex items-center gap-2 text-sm text-text-secondary">
                              <Spinner size="sm" /> Running…
                            </span>
                          ) : done ? (
                            (step.kind !== 'request' || step.run?.uploads?.length) && (
                              <span className="flex flex-col items-start gap-2.5">
                                <span className="flex flex-wrap items-center gap-2">
                                  <ActionButton onClick={() => onViewResults(step)} size="compact" type="button" variant="secondary">
                                    {step.kind === 'request' ? 'View documents' : 'View results'}
                                  </ActionButton>
                                  {/* The file itself, beside the way to it in the report. */}
                                  {step.run?.uploads?.[0] && (
                                    <ActionLink
                                      download={step.run.uploads[0].name}
                                      href={`/documents/${step.run.uploads[0].id}.pdf?b=${record.id}`}
                                      leadingIcon={<Download aria-hidden="true" size={14} />}
                                      size="compact"
                                      variant="secondary"
                                    >
                                      Download
                                    </ActionLink>
                                  )}
                                </span>
                                {/* Under it, where the document came from and when. */}
                                {step.run?.uploads?.length ? (
                                  <span className="text-caption text-text-secondary">
                                    {/* The applicant's reply names the address it was asked at. */}
                                    {step.run.uploads.some((u) => u.from === 'applicant')
                                      ? `Provided ${formatDate(step.run.at)} by ${step.run.requested?.email ?? 'the applicant'}`
                                      : `Uploaded ${formatDate(step.run.at)} by ${CURRENT_USER}`}
                                  </span>
                                ) : null}
                              </span>
                            )
                          ) : step.kind === 'request' ? (
                            // The analyst's own copy, or the applicant's: two ways to close it.
                            <>
                              <ActionButton
                                leadingIcon={<Upload aria-hidden="true" size={14} />}
                                onClick={() => {
                                  uploadFor.current = step
                                  fileInput.current?.click()
                                }}
                                size="compact"
                                type="button"
                                variant="secondary"
                              >
                                Upload file
                              </ActionButton>
                              <ActionButton
                                leadingIcon={<Send aria-hidden="true" size={14} />}
                                onClick={() => setOpen(open === step.id ? null : step.id)}
                                size="compact"
                                type="button"
                                variant="secondary"
                              >
                                Request from applicant
                              </ActionButton>
                            </>
                          ) : (
                            <ActionButton onClick={() => onRun(step)} size="compact" type="button" variant="secondary">
                              {RUN_LABEL[step.kind]}
                            </ActionButton>
                          )}
                        </div>
                        {open === step.id && !done && (
                          <RequestForm
                            businessName={businessName}
                            onSubmit={(payload) => {
                              setOpen(null)
                              onRequest(step, payload)
                            }}
                            step={step}
                          />
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </ChatMessage>
    {ran.map(followUp)}
    </div>
  )
}
