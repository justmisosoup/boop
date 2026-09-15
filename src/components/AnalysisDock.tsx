import { useEffect, useRef, useState } from 'react'

import { ArrowUp, Paperclip } from 'lucide-react'

import { ActionButton, IconActionButton, MutedText, Surface, Tag, Textarea } from '@/core'

import type { Derived } from '../lib/deriveResults'
import type { Attachment } from '../lib/useAnalysis'

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
  onRun,
  waiting,
  pinned,
  results,
  onUnpin,
  hasAnalysis
}: {
  open: boolean
  setOpen: (v: boolean) => void
  onRun: (prompt: string, attachments: Attachment[]) => void
  waiting: boolean
  pinned: string[]
  results: Derived[]
  onUnpin: (id: string) => void
  hasAnalysis: boolean
}) => {
  const [prompt, setPrompt] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const field = useRef<HTMLTextAreaElement>(null)
  const filePicker = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) field.current?.focus()
  }, [open])

  const byId = new Map(results.map((r) => [r.insightId, r]))

  const submit = () => {
    if (!prompt.trim() || waiting) return
    onRun(prompt, attachments)
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
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-floating flex justify-center p-4">
        <span className="pointer-events-auto">
          <ActionButton variant="secondary" onClick={() => setOpen(true)}>
            {hasAnalysis ? 'Refine analysis' : 'Ask about this business'}
          </ActionButton>
        </span>
      </div>
    )
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-floating p-4">
      <div className="mx-auto max-w-[880px]">
        {/* One box: the field and its controls live inside a single bordered
            surface, with submit as a round button in the bottom-right corner. */}
        <Surface
          variant="raised"
          padding="none"
          className="overflow-hidden rounded-card shadow-elevation-popover"
        >
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

          <Textarea
            ref={field}
            rows={2}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
              if (e.key === 'Escape') setOpen(false)
            }}
            placeholder={
              hasAnalysis
                ? 'Ask a follow-up, or ask the same question differently'
                : 'Ask about this business…'
            }
            aria-label="Analysis question"
            // The field is the box's interior, not a box of its own: core's
            // input variants paint a border and a focus border, and both have to
            // go or you get a second outline inside the surface.
            className={[
              'min-h-20 resize-none rounded-none px-3 pb-1 pt-3',
              '!border-0 bg-transparent shadow-none',
              'focus-visible:!border-0 focus-visible:outline-hidden focus-visible:ring-0',
              'hover:!border-0'
            ].join(' ')}
          />

          <div className="flex items-center justify-between gap-3 px-3 pb-2.5 pt-0.5">
            <ActionButton variant="quiet" size="compact" onClick={() => setOpen(false)}>
              Dismiss
            </ActionButton>

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
                isLoading={waiting}
                disabled={waiting || !prompt.trim()}
                aria-label={waiting ? 'Running' : 'Run analysis'}
              >
                <ArrowUp aria-hidden="true" />
              </IconActionButton>
            </div>
          </div>
        </Surface>
      </div>
    </div>
  )
}
