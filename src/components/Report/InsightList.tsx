import { useLayoutEffect, useRef, type MouseEvent } from 'react'

import { Hint, HintContent, HintTrigger, MetaChip } from '@/core'
import { cn } from '@/utils/twUtils'

import { StatusDot, type PanelGroup, type PanelInsight } from './AssessmentPanel'

/*
 * The report's insights as a list, one row per card of the report: the card,
 * its worst finding as the verdict, the rest as chips. A row narrows the report
 * to its card; the same row again widens it back. Rows that passed with
 * nothing more to say sit two-up. Moved out of the left panel into the
 * Insights card at the report's head, under its switch.
 */

/** Failed and for review are one mark against: both read red. */
const CHIP_TONE = {
  success: 'neutral',
  warning: 'danger',
  failure: 'danger',
  unknown: 'neutral',
  pending: 'neutral'
} as const

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

const Chip = ({ insight }: { insight: PanelInsight }) => (
  <Hint>
    {/* The row's click passes through the hover's trigger. */}
    <HintTrigger className="min-w-0 max-w-full cursor-[inherit]" data-row-passthrough="">
      {/* A long finding clips at the card's edge; the hover has it whole. */}
      <MetaChip className="max-w-full" size="xs" tone={CHIP_TONE[insight.intent]}>
        <span className="inline-flex min-w-0 items-center gap-1">
          <StatusDot intent={insight.intent} size={12} />
          <span className="truncate">{insight.verdict}</span>
        </span>
      </MetaChip>
    </HintTrigger>
    <HintContent align="start" maxWidth={280} side="top">
      {insight.statement}
    </HintContent>
  </Hint>
)

/** The card's name over its verdict; the whole row is the target. */
const Header = ({ group, selected, onSelect }: { group: PanelGroup; selected: boolean; onSelect: () => void }) => {
  const head = group.insights[0]
  const flagged = head.intent === 'failure' || head.intent === 'warning'
  const target = (
    <button
      aria-pressed={selected}
      className={cn(
        'min-w-0 text-left',
        'after:absolute after:inset-0 after:content-[""]',
        'focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring'
      )}
      onClick={onSelect}
      type="button"
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[10px] leading-3 tracking-[0.02em] text-text-secondary">{group.label}</span>
        <span className={cn('text-dense leading-5 text-text-primary', flagged && 'font-semibold')}>{head.verdict}</span>
      </span>
    </button>
  )
  // The hover adds the full sentence — only when the row shows something shorter.
  if (head.verdict === head.statement) return <span className="flex min-w-0">{target}</span>
  return (
    <Hint>
      <HintTrigger asChild>
        <span className="flex min-w-0">{target}</span>
      </HintTrigger>
      <HintContent align="start" maxWidth={300} side="top">
        {head.statement}
      </HintContent>
    </Hint>
  )
}

const rowClass = (selected: boolean) =>
  cn(
    'relative grid cursor-pointer grid-cols-[16px_minmax(0,1fr)] gap-x-3 px-4 py-3 transition-colors duration-[var(--core-duration-fast)] hover:bg-[var(--core-color-list-item-hover-bg)] motion-reduce:transition-none',
    selected && 'bg-[color-mix(in_srgb,var(--core-color-state-selected-bg)_50%,var(--core-color-surface-card))]'
  )

const InsightRow = ({ group, selected, onSelect }: { group: PanelGroup; selected: boolean; onSelect: () => void }) => {
  const [head, ...rest] = group.insights
  const delegate = (e: MouseEvent<HTMLDivElement>) => {
    if (!(e.target instanceof Element)) return
    const button = e.target.closest('button')
    if (button && !('rowPassthrough' in button.dataset)) return
    onSelect()
  }
  return (
    <div className={rowClass(selected)} onClick={delegate}>
      <StatusDot className="mt-4" intent={head.intent} />
      <div className="flex min-w-0 flex-col">
        <Header group={group} onSelect={onSelect} selected={selected} />
        {rest.length > 0 && (
          <div className="relative flex flex-wrap items-center gap-1.5 pt-1.5">
            {rest.map((i) => (
              <Chip insight={i} key={i.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const InsightCell = ({ group, selected, onSelect }: { group: PanelGroup; selected: boolean; onSelect: () => void }) => (
  <div className={rowClass(selected)}>
    <StatusDot className="mt-4" intent={group.insights[0].intent} />
    <Header group={group} onSelect={onSelect} selected={selected} />
  </div>
)

/** Passed with nothing more to say: a cell of the two-up band. */
const isSimple = (g: PanelGroup) => g.insights.length === 1 && g.insights[0].intent === 'success'

export const InsightList = ({
  groups,
  selected,
  onSelect
}: {
  groups: PanelGroup[]
  /** The cards the report is narrowed to. */
  selected: ReadonlySet<string>
  onSelect: (group: PanelGroup) => void
}) => {
  const flipRef = useFlipList()
  const fulls = groups.filter((g) => !isSimple(g))
  const band = groups.filter(isSimple)
  if (groups.length === 0) return <p className="m-0 px-4 py-6 text-text-secondary">No insights found</p>
  return (
    <div ref={flipRef}>
      {fulls.map((g, i) => (
        <div className={cn('bg-card', i > 0 && rowHairline)} data-flip-id={g.cardId} key={g.cardId}>
          <InsightRow group={g} onSelect={() => onSelect(g)} selected={selected.has(g.cardId)} />
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
