import { useEffect, useState } from 'react'

import { CubeIcon } from '@radix-ui/react-icons'
import { ChevronLeft, Maximize2, Minimize2, Plus, Trash2 } from 'lucide-react'

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
} from '@/core'

import { cn } from '../utils/twUtils'
import type { CustomerSkill } from '../lib/useAgent'
import { authorLine } from '../lib/user'

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
  onRenameWorkflow,
  onCreateSkill,
  onUpdateSkill,
  onDeleteSkill,
}: {
  open: boolean
  /** 'new' to write one, an id to open one, 'list' for the top-level. */
  startOn?: 'list' | 'new' | (string & {})
  onClose: () => void
  /** The assessment the report runs. Its brief is the guidance. */
  workflow?: CustomerSkill
  skills: CustomerSkill[]
  /** Ids switched off. */
  onRenameWorkflow: (id: string, name: string) => void
  onCreateSkill: (name: string, instructions: string) => void
  onUpdateSkill: (id: string, name: string, instructions: string, combines?: string[]) => void
  onDeleteSkill: (id: string) => void
}) => {
  /** null = the top-level assessment, 'new' = writing one, else its id. */
  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [brief, setBrief] = useState('')
  const [combines, setCombines] = useState<string[]>([])
  /** The brief, filling the dialog. Collapsed by default so the assessments
   *  under it are the first thing seen. */
  const [briefOpen, setBriefOpen] = useState(false)

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
   * The top-level one is built from every assessment written under it. A
   * sub-assessment is built from the ones it names, which is what lets a
   * complex one be layered out of simple ones.
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
      // Dismissed only by Cancel or Save. The dialog closed on any click
      // outside it and on Escape, which meant a stray click while writing a
      // brief threw the whole edit away with no warning and nothing to undo.
      onClose={() => {}}
      size="lg"
      showHeader={false}
      title={current?.name ?? 'New assessment'}
    >
      {/*
        * As tall as its content needs, and never taller than the window.
        *
        * A fixed height padded a short brief with empty space and a tall one
        * still overflowed. `max-h` lets the dialog take the height its content
        * asks for and stop there; past that the body scrolls and the foot bar
        * stays put, so the dialog always fits the viewport it opened in.
        */}
      <div
        className={cn(
          'flex flex-col gap-[var(--core-spacing-md)]',
          // Expanded, the dialog takes the frame so the brief has something to
          // fill; otherwise it is sized by its content and capped at the window.
          briefOpen ? 'h-[min(82vh,760px)]' : 'max-h-[min(82vh,760px)]'
        )}
      >
        {/* A flex column, not a grid: `content-start` packs rows to the top and
            refuses to stretch any of them, so the expanded brief had nothing to
            grow into and sat three lines tall above an empty dialog. */}
        <div className="flex min-h-0 flex-1 flex-col gap-[var(--core-spacing-md)] overflow-y-auto">

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

        {/*
          * The brief expands to fill the dialog, rather than being dragged.
          *
          * A resize handle put the reader in charge of a dimension they should
          * not have to think about, and a brief long enough to need it was
          * edited through a seven-line slot. Expanded it takes the whole frame;
          * collapsed it steps back so the assessments below are reachable. The
          * two states are the only two anyone wanted.
          */}
        <div className={cn('group/field relative flex min-h-0 flex-col', briefOpen && 'flex-1')}>
          <Textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="What this assessment works out, and how…"
            aria-label="Brief"
            rows={briefOpen ? undefined : 7}
            // Room at the foot for the control sitting over it, so a long brief
            // does not run underneath the icon.
            className={cn('resize-none pb-9', briefOpen ? 'min-h-0 flex-1' : 'min-h-40')}
          />
          {/*
            * Expand/collapse, sitting in the corner of the field.
            *
            * The icon alone says nothing until it has been pressed once, so the
            * label unfurls from it on hover and lies over the text rather than
            * taking a row of its own. Built here rather than with `ButtonIcon`
            * because that renders at `min-content` with no padding and cannot
            * hold a label that grows — the border, radius and surface are the
            * same tokens it uses, so the two still read as one control.
            *
            * The label animates on grid columns, 0fr to 1fr, which transitions
            * to the text's natural width without anyone having to measure it.
            */}
          <button
            type="button"
            onClick={() => setBriefOpen((v) => !v)}
            aria-expanded={briefOpen}
            aria-label={briefOpen ? 'Collapse brief' : 'Expand brief'}
            className={cn(
              // A fixed height, so the pill grows sideways for its label and
              // never downwards: the label's line-height is taller than the
              // icon, which made the button tall enough to look like a mistake.
              'group/expand absolute bottom-2 right-2 flex h-7 items-center rounded-full',
              'border border-border bg-background px-2 shadow-sm',
              'text-muted-foreground transition hover:text-foreground',
              // Two gates, one per group. The field's hover decides whether the
              // control is there at all; the button's own decides whether it is
              // wearing its label. Focus opens both, so the keyboard reaches it.
              'opacity-0 group-hover/field:opacity-100 group-focus-within/field:opacity-100',
              'focus-visible:opacity-100'
            )}
          >
            <span
              className={cn(
                'grid grid-cols-[0fr] transition-[grid-template-columns] duration-200 ease-out',
                'group-hover/expand:grid-cols-[1fr] group-focus-visible/expand:grid-cols-[1fr]'
              )}
            >
              <span className="overflow-hidden">
                <span className="block whitespace-nowrap pr-1.5 text-body leading-none">
                  {briefOpen ? 'Collapse' : 'Expand'}
                </span>
              </span>
            </span>
            {briefOpen ? (
              <Minimize2 aria-hidden="true" className="size-3.5 shrink-0" />
            ) : (
              <Maximize2 aria-hidden="true" className="size-3.5 shrink-0" />
            )}
          </button>
        </div>

        {/* Top level only. Assessments layer one deep: the complex assessment
            is built from simple ones, and a simple one is not built from
            anything — letting a part contain parts makes "which brief ran" a
            question with no readable answer. */}
        {isTop && !briefOpen && (
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

        </div>

        {/* One bar at the foot: where the dialog came from on the left, what
            to do with it on the right. The trail sat above the name it leads
            back from, which put navigation before the thing being edited. */}
        <div className="flex shrink-0 items-center justify-between gap-2">
          {!isTop && workflow ? (
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="flex items-center gap-1 text-caption text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft aria-hidden="true" className="size-3" />
              {workflow?.name ?? 'Assessment'}
            </button>
          ) : (
            <span />
          )}

          <div className="flex shrink-0 gap-2">
            <ActionButton variant="secondary" onClick={onClose}>
              Cancel
            </ActionButton>
            <ActionButton disabled={!dirty || !name.trim() || !brief.trim()} onClick={save}>
              {editing === 'new' ? 'Create' : 'Save'}
            </ActionButton>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
