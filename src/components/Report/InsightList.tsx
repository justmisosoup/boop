import { useLayoutEffect, useRef, type ReactNode } from 'react'

import { ChevronRight } from 'lucide-react'

import { Hint, HintContent, HintTrigger } from '@/core'
import { cn } from '@/utils/twUtils'

import { StatusDot, type PanelGroup, type PanelInsight } from './AssessmentPanel'

/*
 * The report's insights as a list, one row per card of the report: the
 * category, marked by its worst finding, then each review task under it. The
 * category opens its card whole; a task opens it on what the task found; the
 * same category again widens the report back. Rows that passed with
 * nothing more to say sit two-up. Moved out of the left panel into the
 * Insights card at the report's head, under its switch.
 */

/** Rows that move when the list reorders glide to their new place. */
const useFlipList = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const previousRects = useRef(new Map<string, { top: number; left: number }>())
  const previousOrder = useRef('')

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    const blocks = Array.from(container.querySelectorAll<HTMLElement>('[data-flip-id]'))
    const orderKey = blocks.map((b) => b.dataset.flipId).join('|')
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const origin = container.getBoundingClientRect()
    const relativeRect = (b: HTMLElement) => {
      const r = b.getBoundingClientRect()
      return { top: r.top - origin.top, left: r.left - origin.left }
    }
    if (previousOrder.current && previousOrder.current !== orderKey && !reduceMotion) {
      for (const block of blocks) {
        const id = block.dataset.flipId
        const previous = id ? previousRects.current.get(id) : undefined
        if (!previous) continue
        const r = relativeRect(block)
        const dx = previous.left - r.left
        const dy = previous.top - r.top
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue
        block.style.transition = 'none'
        block.style.transform = `translate(${dx}px, ${dy}px)`
        block.getBoundingClientRect()
        block.style.transition = 'transform var(--core-duration-standard) var(--core-ease-standard)'
        block.style.transform = ''
        const onEnd = (e: TransitionEvent) => {
          if (e.target !== block || e.propertyName !== 'transform') return
          block.style.transition = ''
          block.removeEventListener('transitionend', onEnd)
        }
        block.addEventListener('transitionend', onEnd)
      }
    }
    previousRects.current = new Map(
      blocks.flatMap((b) => (b.dataset.flipId ? [[b.dataset.flipId, relativeRect(b)] as const] : []))
    )
    previousOrder.current = orderKey
  })

  return containerRef
}

const rowHairline =
  'relative before:pointer-events-none before:absolute before:inset-x-4 before:top-0 before:border-t before:border-[var(--core-color-border-divider)] before:content-[""]'

/**
 * One insight under its assessment: its mark and its finding, the whole line
 * the target. Followed, the report shows what it found (`onFollow`). A finding
 * against the business reads in ink; a pass or a fact, quieter. On hover, why
 * it matters for this business — the assessment's context.
 */
const Task = ({ insight, onFollow }: { insight: PanelInsight; onFollow: () => void }) => {
  const flagged = insight.intent === 'failure' || insight.intent === 'warning'
  const line = (
      // A link to what it found: the arrow says so before the hover does, and
      // the hover underlines the finding and moves the arrow on.
      <button
        className={cn(
          'group/task relative z-[1] -mx-2 grid w-[calc(100%+16px)] cursor-pointer grid-cols-[12px_minmax(0,1fr)_14px] items-start gap-x-2 rounded-control px-2 py-1 text-left',
          'transition-colors duration-[var(--core-duration-fast)] hover:bg-[var(--core-color-state-hover-bg)] motion-reduce:transition-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
        )}
        onClick={(e) => {
          e.stopPropagation()
          onFollow()
        }}
        type="button"
      >
        <StatusDot className="mt-[3px]" intent={insight.intent} size={12} />
        <span
          className={cn(
            'break-words text-dense leading-5 decoration-[var(--core-color-border-strong)] underline-offset-2 group-hover/task:underline',
            flagged ? 'text-text-primary' : 'text-text-secondary'
          )}
        >
          {insight.verdict}
        </span>
        <ChevronRight
          aria-hidden="true"
          className="mt-[3px] text-[var(--core-color-text-muted)] transition-transform duration-[var(--core-duration-fast)] group-hover/task:translate-x-0.5 group-hover/task:text-text-primary motion-reduce:transition-none"
          size={14}
          strokeWidth={1.75}
        />
      </button>
  )
  return (
    <li className="m-0 list-none">
      {insight.why ? (
        <Hint>
          <HintTrigger asChild>{line}</HintTrigger>
          <HintContent align="start" maxWidth={280} side="left">
            {insight.why}
          </HintContent>
        </Hint>
      ) : (
        line
      )}
    </li>
  )
}

/** The assessment's mark: what it can't read yet, else its worst insight. */
const markOf = (g: PanelGroup) => (g.needs?.length ? 'pending' : (g.insights[0]?.intent ?? 'unknown'))

const rowClass = (selected: boolean) =>
  cn(
    'relative grid cursor-pointer grid-cols-[16px_minmax(0,1fr)] gap-x-3 px-4 py-3 transition-colors duration-[var(--core-duration-fast)] hover:bg-[var(--core-color-list-item-hover-bg)] motion-reduce:transition-none',
    selected && 'bg-[color-mix(in_srgb,var(--core-color-state-selected-bg)_50%,var(--core-color-surface-card))]'
  )

/** The category's name: the target that opens its card whole. */
const CategoryButton = ({ group, selected, onSelect, children }: { group: PanelGroup; selected: boolean; onSelect: () => void; children: ReactNode }) => (
  <button
    aria-pressed={selected}
    className={cn(
      'min-w-0 text-left',
      'after:absolute after:inset-0 after:content-[""]',
      'focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring'
    )}
    aria-label={`${group.label}: open its card`}
    onClick={onSelect}
    type="button"
  >
    {children}
  </button>
)

/**
 * A category of the report — Liens, Addresses, Registrations — marked by the
 * worst of its insights, and under it every insight that rolls up to it: the
 * review tasks, each its own line.
 */
const InsightRow = ({
  group,
  selected,
  onSelect,
  onChip
}: {
  group: PanelGroup
  selected: boolean
  onSelect: () => void
  onChip?: (insight: PanelInsight, group: PanelGroup) => void
}) => {
  // The Names row's synthetic lead is the business's name — the category says Names.
  const tasks = group.insights.filter((i, n) => !(n === 0 && i.synthetic))
  return (
    <div className={rowClass(selected)}>
      <StatusDot className="mt-0.5" intent={markOf(group)} />
      <div className="flex min-w-0 flex-col gap-1.5">
        <CategoryButton group={group} onSelect={onSelect} selected={selected}>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-dense font-semibold leading-5 text-text-primary">
              {group.label}
              {group.needs?.length ? <span className="font-normal text-text-secondary"> · Can't assess yet</span> : null}
            </span>
            {group.summary && <span className="text-dense leading-5 text-text-secondary">{group.summary}</span>}
          </span>
        </CategoryButton>
        {/* What the reader can do about it, above the row's own target. */}
        {group.actions && <div className="relative z-[1] flex flex-wrap gap-2">{group.actions}</div>}
        {tasks.length > 0 && <ul className="m-0 flex flex-col p-0">
          {tasks.map((i) => (
            <Task insight={i} key={i.id} onFollow={() => (onChip ? onChip(i, group) : onSelect())} />
          ))}
        </ul>}
        {/* When it last ran, as metadata at its foot. */}
        {group.updated && <span className="text-[10px] leading-4 tracking-[0.02em] text-[var(--core-color-text-muted)]">Updated {group.updated}</span>}
      </div>
    </div>
  )
}

const InsightCell = ({ group, selected, onSelect }: { group: PanelGroup; selected: boolean; onSelect: () => void }) => (
  <div className={rowClass(selected)}>
    <StatusDot className="mt-4" intent={markOf(group)} />
    <CategoryButton group={group} onSelect={onSelect} selected={selected}>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-dense font-semibold leading-5 text-text-primary">{group.label}</span>
        <span className="text-dense leading-5 text-text-secondary">{group.insights[0].verdict}</span>
        {group.updated && <span className="text-[10px] leading-4 tracking-[0.02em] text-[var(--core-color-text-muted)]">Updated {group.updated}</span>}
      </span>
    </CategoryButton>
  </div>
)

/** Passed with nothing more to say: a cell of the two-up band. */
const isSimple = (g: PanelGroup) => !g.needs?.length && !g.summary && g.insights.length === 1 && g.insights[0].intent === 'success'

export const InsightList = ({
  groups,
  selected,
  onSelect,
  onChip
}: {
  groups: PanelGroup[]
  /** The cards the report is narrowed to. */
  selected: ReadonlySet<string>
  onSelect: (group: PanelGroup) => void
  /** A chip, followed: the report shows what it found. */
  onChip?: (insight: PanelInsight, group: PanelGroup) => void
}) => {
  const flipRef = useFlipList()
  const fulls = groups.filter((g) => !isSimple(g))
  const band = groups.filter(isSimple)
  if (groups.length === 0) return <p className="m-0 px-4 py-6 text-text-secondary">No insights found</p>
  return (
    <div ref={flipRef}>
      {fulls.map((g, i) => (
        <div className={cn('bg-card', i > 0 && rowHairline)} data-flip-id={g.cardId} key={g.cardId}>
          <InsightRow group={g} onChip={onChip} onSelect={() => onSelect(g)} selected={selected.has(g.cardId)} />
        </div>
      ))}
      {band.length > 0 && (
        <div className={cn('grid grid-cols-2', fulls.length > 0 && rowHairline)}>
          {band.map((g, i) => {
            const spansRow = i === band.length - 1 && band.length % 2 === 1
            return (
              <div
                className={cn(
                  'bg-card',
                  i % 2 === 1 && 'border-l border-[var(--core-color-border-divider)]',
                  spansRow && 'col-span-2',
                  i >= 2 && [
                    'relative before:pointer-events-none before:absolute before:top-0 before:border-t before:border-[var(--core-color-border-divider)] before:content-[""]',
                    spansRow ? 'before:inset-x-4' : i % 2 === 0 ? 'before:left-4 before:right-0' : 'before:left-0 before:right-4'
                  ]
                )}
                data-flip-id={g.cardId}
                key={g.cardId}
              >
                <InsightCell group={g} onSelect={() => onSelect(g)} selected={selected.has(g.cardId)} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
