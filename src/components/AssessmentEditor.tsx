import { useEffect, useState } from 'react'

import { CubeIcon } from '@radix-ui/react-icons'
import { ChevronLeft, Plus, Trash2 } from 'lucide-react'

import {
  ActionButton,
  Dialog,
  Heading,
  Input,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  MutedText,
  Surface,
  Text,
  Textarea,
  Toggle
} from '@/core'

import { MIDDESK_CONTEXTS } from '../lib/library'
import type { CustomerSkill } from '../lib/useAgent'
import { authorLine } from '../lib/user'
import { MiddeskMark } from './MiddeskMark'

/**
 * One assessment, in one modal.
 *
 * There used to be two: an editor for writing a simple one, and a page for the
 * complex one that had parts. That made "simple" and "complex" two different
 * kinds of thing you edited in two different places, when the only difference
 * between them is whether anything has been added yet.
 *
 * So every assessment opens the same way — a name, a brief, and the list of
 * what it is built from. A new one opens with that list empty; adding to it is
 * what makes it complex. The top-level assessment is the one the report runs
 * and is reached by its own name; everything else is reached from its list, and
 * the breadcrumb back is what says so.
 */
export const AssessmentEditor = ({
  open,
  startOn,
  onClose,
  workflow,
  skills,
  disabled,
  onRenameWorkflow,
  onCreateSkill,
  onUpdateSkill,
  onDeleteSkill,
  onSetEnabled
}: {
  open: boolean
  /** 'new' to write one, an id to open one, 'list' for the top-level. */
  startOn?: 'list' | 'new' | (string & {})
  onClose: () => void
  /** The assessment the report runs. Its brief is the guidance. */
  workflow?: CustomerSkill
  skills: CustomerSkill[]
  /** Ids switched off. */
  disabled: string[]
  onRenameWorkflow: (id: string, name: string) => void
  onCreateSkill: (name: string, instructions: string) => void
  onUpdateSkill: (id: string, name: string, instructions: string, combines?: string[]) => void
  onDeleteSkill: (id: string) => void
  onSetEnabled: (id: string, on: boolean) => void
}) => {
  /** null = the top-level assessment, 'new' = writing one, else its id. */
  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [brief, setBrief] = useState('')
  const [combines, setCombines] = useState<string[]>([])

  const target = editing && editing !== 'new' ? skills.find((s) => s.id === editing) : undefined
  const isTop = editing === null
  const current = isTop ? workflow : target

  // Each opening starts where it was opened to, not wherever it was left.
  useEffect(() => {
    if (open) setEditing(startOn && startOn !== 'list' ? startOn : null)
  }, [open, startOn])

  // Bind the fields to whatever is open.
  useEffect(() => {
    setName(current?.name ?? '')
    setBrief(current?.instructions ?? '')
    setCombines(current?.combines ?? [])
  }, [current?.id, current?.name, current?.instructions, current?.combines])

  /**
   * What the open assessment is built from.
   *
   * The top-level one is built from every assessment written under it plus
   * Middesk's context. A sub-assessment is built from the ones it names, which
   * is what lets a complex one be layered out of simple ones.
   */
  const parts = isTop
    ? skills.filter((s) => s.id !== workflow?.id)
    : skills.filter((s) => combines.includes(s.id))

  /** Assessments that could be added to the one open, minus itself. */
  const addable = skills.filter(
    (s) => s.id !== current?.id && s.id !== workflow?.id && !combines.includes(s.id)
  )

  /**
   * The parts as they were when this view was opened.
   *
   * A part created under the parent is written to the store on its own Create,
   * so nothing about the parent's own fields changes — but its list has, and a
   * reader who has just added something to an assessment should be able to save
   * it rather than find Save greyed out.
   */
  const [baseline, setBaseline] = useState<string[]>([])
  useEffect(() => {
    setBaseline(parts.map((x) => x.id))
    // Re-baselined per view, not per render: `parts` is derived and a new array
    // every time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  const dirty =
    name.trim() !== (current?.name ?? '') ||
    brief !== (current?.instructions ?? '') ||
    combines.join() !== (current?.combines ?? []).join() ||
    parts.map((x) => x.id).join() !== baseline.join()

  const save = () => {
    if (editing === 'new') {
      onCreateSkill(name, brief)
    } else if (isTop && workflow) {
      if (name.trim() !== workflow.name) onRenameWorkflow(workflow.id, name.trim())
      if (brief !== workflow.instructions) onUpdateSkill(workflow.id, name.trim(), brief, combines)
    } else if (target) {
      onUpdateSkill(target.id, name.trim(), brief, combines)
    }

    // A part was opened FROM the parent, so saving it returns there — closing
    // the dialog outright drops the reader out of the thing they were editing
    // to change one piece of it. Only the top level closes.
    if (isTop) onClose()
    else setEditing(null)
  }

  return (
    <Dialog
      isOpen={open}
      onClose={onClose}
      size="lg"
      showHeader={false}
      title={current?.name ?? 'New assessment'}
    >
      <div className="grid gap-[var(--core-spacing-md)]">
        {/* Anything opened from the parent carries its name: a part of it, or
            a new one being written under it. */}
        {!isTop && workflow && (
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="flex items-center gap-1 text-caption text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft aria-hidden="true" className="size-3" />
            {workflow?.name ?? 'Assessment'}
          </button>
        )}

        <div>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Assessment name"
            aria-label="Assessment name"
            // `!` because `.core-input` sets font-size as a class rule and wins
            // the cascade against a plain utility of equal specificity.
            className={[
              '!h-auto !min-h-0 !border-0 !bg-transparent px-0 py-0 shadow-none',
              '!text-2xl font-semibold !leading-8 tracking-[-0.015em]',
              'focus-visible:!border-0 focus-visible:!outline-none focus-visible:!ring-0 hover:!border-0'
            ].join(' ')}
          />
          {current && <MutedText className="block text-caption">{authorLine(current)}</MutedText>}
        </div>

        <Textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="What this assessment works out, and how…"
          aria-label="Brief"
          rows={7}
          className="min-h-40"
        />

        {/* Top level only. Assessments layer one deep: the complex assessment
            is built from simple ones, and a simple one is not built from
            anything — letting a part contain parts makes "which brief ran" a
            question with no readable answer. */}
        {isTop && (
          <section className="grid gap-[var(--core-spacing-xs)]">
            <Heading level={4}>Assessments</Heading>

          <Surface variant="default" padding="none" className="overflow-hidden">
            <div className="divide-y divide-solid divide-border">
              {parts.map((s) => (
                <div
                  key={s.id}
                  className="group flex items-center gap-2 px-3 py-2 hover:bg-muted"
                >
                  <CubeIcon aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" />
                  <button
                    type="button"
                    onClick={() => setEditing(s.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <Text size="sm">{s.name}</Text>
                    <MutedText className="block text-caption">{authorLine(s)}</MutedText>
                  </button>
                  {/* Quiet until the row is hovered: removing is not what a
                      reader is here to do, and a bin on every row reads as an
                      invitation to use it. */}
                  <ActionButton
                    variant="quiet"
                    size="compact"
                    aria-label={`Remove ${s.name}`}
                    title="Remove"
                    onClick={() =>
                      isTop
                        ? onDeleteSkill(s.id)
                        : setCombines((p) => p.filter((x) => x !== s.id))
                    }
                    className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 aria-hidden="true" className="size-3.5" />
                  </ActionButton>
                </div>
              ))}

              {parts.length === 0 && (
                <div className="px-3 py-3">
                  <MutedText className="text-caption">
                    Add assessments to build up a more complex one, each with its own instructions.
                  </MutedText>
                </div>
              )}

              {/* The last row of the table rather than a button beside its
                  heading: adding one is the same act as opening one, and it
                  belongs where the list it joins is. */}
              <button
                type="button"
                onClick={() => setEditing('new')}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Plus aria-hidden="true" className="size-3.5 shrink-0" />
                <span className="text-sm leading-5">New assessment</span>
              </button>
            </div>
          </Surface>
        </section>
        )}

        {/* Context is not an assessment. It says how to read the record rather
            than what to work out from it, so it is its own list — Middesk's
            only for now, switched off rather than removed, because it is not
            the customer's to delete. */}
        {/* Top level only, like the assessments above it. A part is shallow by
            design: a name and a brief, and nothing that could nest further. */}
        {isTop && (
          <section className="grid gap-[var(--core-spacing-xs)]">
            <Heading level={4}>Context</Heading>
            <Surface variant="default" padding="none" className="overflow-hidden">
              <div className="divide-y divide-solid divide-border">
                {MIDDESK_CONTEXTS.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 px-3 py-2">
                    <MiddeskMark className="h-[7px] w-3 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <Text size="sm">{c.name}</Text>
                      <MutedText className="block text-caption">
                        {[c.version && `v${c.version}`, c.covers?.join(', ')]
                          .filter(Boolean)
                          .join(' ')}
                      </MutedText>
                    </div>
                    {/* `Toggle`, not `Switch`: the latter is the legacy
                        styled-components control with hardcoded colours and no
                        `--core-*` tokens, so it does not theme. */}
                    <Toggle
                      aria-label={`Use ${c.name}`}
                      checked={!disabled.includes(c.id)}
                      onCheckedChange={(on) => onSetEnabled(c.id, on)}
                    />
                  </div>
                ))}
              </div>
            </Surface>
          </section>
        )}

        <div className="flex justify-end gap-2">
          <ActionButton variant="secondary" onClick={onClose}>
            Cancel
          </ActionButton>
          <ActionButton disabled={!dirty || !name.trim() || !brief.trim()} onClick={save}>
            {editing === 'new' ? 'Create' : 'Save'}
          </ActionButton>
        </div>
      </div>
    </Dialog>
  )
}
