import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { Hand, RadioTower, Repeat, RotateCw } from 'lucide-react'

import {
  Hint,
  HintContent,
  HintTrigger,
  Menu,
  MenuContent,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
  MetaChip
} from '@/core'
import { cn } from '@/utils/twUtils'

import { StatusDot, type PanelGroup, type PanelInsight } from './AssessmentPanel'
import { CHIP_CLAIM } from '../chipStyles'
import { PointerTip } from '../PointerTip'
import { CADENCES, setMonitoring, useMonitoring, type Cadence } from '../../lib/monitoring'

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
      // A link to what it found: the hover underlines the finding.
      <button
        className={cn(
          'group/task relative z-[1] -mx-2 grid w-[calc(100%+16px)] cursor-pointer grid-cols-[12px_minmax(0,1fr)] items-start gap-x-2 rounded-control px-2 py-1 text-left',
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
            'break-words text-sm decoration-[var(--core-color-border-strong)] underline-offset-2 group-hover/task:underline',
            flagged ? 'text-text-primary' : 'text-text-secondary'
          )}
        >
          {insight.verdict}
        </span>
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

/** The mark's word, as the filter above names it; failed and for review are one. */
const WORD = { failure: 'Not passed', warning: 'Not passed', success: 'Passed', unknown: 'Context', pending: "Can't assess yet" } as const
/** Red for not passed; passed in the Verified chips' midnight (`CHIP_CLAIM`); the rest plain. */
const TONE = { failure: 'danger', warning: 'danger', success: 'neutral', unknown: 'neutral', pending: 'neutral' } as const

/**
 * The assessment's foot, as metadata: at the left, monitoring where it
 * re-runs on a schedule, else how many times it has run; when it last ran at
 * the right.
 */
/**
 * Monitoring, at the foot's right: its mark and how it runs — "Manual", run
 * when someone runs it, or the cadence it re-runs at: "Weekly". Clicked, one
 * choice among them.
 */
/** How it runs, at a glance: by hand, live, or on a repeat. */
const RUN_ICON = { off: Hand, realtime: RadioTower, daily: Repeat, weekly: Repeat, monthly: Repeat } as const

const MonitorControl = ({ storeKey, label }: { storeKey: string; label: string }) => {
  const cadence = useMonitoring(storeKey)
  const on = cadence !== null
  const word = on ? CADENCES.find((c) => c.id === cadence)?.label : 'Manual'
  const Icon = RUN_ICON[cadence ?? 'off']
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          aria-label={`Monitoring for ${label}: ${word}`}
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-control hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            on ? 'text-text-secondary' : 'text-[var(--core-color-text-muted)]'
          )}
          onClick={(e) => e.stopPropagation()}
          type="button"
        >
          <Icon aria-hidden="true" size={11} strokeWidth={2} />
          {word}
        </button>
      </MenuTrigger>
      <MenuContent align="end" themeMode="light">
        <MenuLabel>Run {label}</MenuLabel>
        <MenuRadioGroup onValueChange={(v) => setMonitoring(storeKey, v === 'off' ? null : (v as Cadence))} value={cadence ?? 'off'}>
          <MenuRadioItem value="off">
            <span className="inline-flex items-center gap-2">
              <Hand aria-hidden="true" size={14} strokeWidth={1.75} />
              Manual
            </span>
          </MenuRadioItem>
          {CADENCES.map((c) => {
            const ItemIcon = RUN_ICON[c.id]
            return (
              <MenuRadioItem key={c.id} value={c.id}>
                <span className="inline-flex items-center gap-2">
                  <ItemIcon aria-hidden="true" size={14} strokeWidth={1.75} />
                  {c.label}
                </span>
              </MenuRadioItem>
            )
          })}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  )
}

/**
 * The assessment's foot, as metadata: how many times it has run at the left —
 * on hover, the runs themselves and when each was — and monitoring at the right.
 */
const Footer = ({ group }: { group: PanelGroup }) => {
  if (group.runs === undefined && !group.monitorKey) return null
  const runs = group.runList ?? []
  const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  // On hover, each run: when, newest first, and how — run by hand, or by its
  // schedule. Every run so far was ordered by hand; a scheduled one will say so.
  const runsCard = (
    <ol className="m-0 flex w-48 list-none flex-col gap-1 p-0">
      {runs.map((r, i) => {
        const scheduled = Boolean(r.scheduled)
        const How = scheduled ? Repeat : Hand
        return (
          <li className="flex items-center justify-between gap-3" key={r.id}>
            <span className="text-text-primary">
              {day(r.at)}
              {i === 0 && <span className="text-text-secondary"> · Latest</span>}
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 text-text-secondary">
              <How aria-hidden="true" size={12} strokeWidth={1.75} />
              {scheduled ? 'Scheduled' : 'Manual'}
            </span>
          </li>
        )
      })}
    </ol>
  )
  const count = (
    <>
      <RotateCw aria-hidden="true" size={11} strokeWidth={2} />
      {group.runs} {group.runs === 1 ? 'run' : 'runs'}
    </>
  )
  return (
    <span className="relative z-[1] flex items-center justify-between gap-3 text-[10px] leading-4 tracking-[0.02em] text-[var(--core-color-text-muted)]">
      {group.runs === undefined ? (
        <span />
      ) : runs.length > 0 ? (
        <PointerTip className="inline-flex items-center gap-1 hover:text-text-primary" content={runsCard}>
          {count}
        </PointerTip>
      ) : (
        <span className="inline-flex items-center gap-1">{count}</span>
      )}
      {/* Run it again now, on the details on file. */}
      {group.onRerun && (
        <button
          className="-ml-1 mr-auto rounded-control text-[var(--core-color-text-link)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:text-[var(--core-color-text-muted)] disabled:no-underline"
          disabled={group.rerunning}
          onClick={(e) => {
            e.stopPropagation()
            group.onRerun?.()
          }}
          type="button"
        >
          {group.rerunning ? 'Rerunning…' : 'Rerun'}
        </button>
      )}
      {group.monitorKey && <MonitorControl label={group.label} storeKey={group.monitorKey} />}
    </span>
  )
}

/** The assessment's status, as a chip at the right of its name: its mark and its word. */
/** Assessments whose finding is that something exists — cases, liens, a PEP, a web
 *  presence — not that a check failed: their chip says what was found. */
const FOUND_CARDS = new Set(['website', 'litigation', 'liens', 'screening-pep'])
/** Of those, the ones where what was found counts against the business: cases, liens, PEP hits.
 *  The rest count for it: a web presence. */
const FOUND_AGAINST = new Set(['litigation', 'liens', 'screening-pep'])

const StatusChip = ({ group }: { group: PanelGroup }) => {
  const mark = markOf(group)
  const found = FOUND_CARDS.has(group.cardId) && (mark === 'failure' || mark === 'warning')
  if (found)
    return (
      // Cases found read as a mark against, red; a web presence found as one for, in Passed's midnight.
      <MetaChip
        className={cn('shrink-0', !FOUND_AGAINST.has(group.cardId) && CHIP_CLAIM)}
        size="compact"
        tone={FOUND_AGAINST.has(group.cardId) ? 'danger' : 'neutral'}
      >
        <span className="inline-flex items-center gap-1">
          <StatusDot intent={FOUND_AGAINST.has(group.cardId) ? 'failure' : 'success'} size={12} />
          Found
        </span>
      </MetaChip>
    )
  const intent = mark
  return (
    <MetaChip className={cn('shrink-0', intent === 'success' && CHIP_CLAIM)} size="compact" tone={TONE[intent]}>
      <span className="inline-flex items-center gap-1">
        <StatusDot intent={intent} size={12} />
        {WORD[intent]}
      </span>
    </MetaChip>
  )
}

const rowClass = (selected: boolean) =>
  cn(
    'relative grid cursor-pointer grid-cols-[minmax(0,1fr)] px-4 py-3 transition-colors duration-[var(--core-duration-fast)] hover:bg-[var(--core-color-list-item-hover-bg)] motion-reduce:transition-none',
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
      <div className="flex min-w-0 flex-col gap-1.5">
        <CategoryButton group={group} onSelect={onSelect} selected={selected}>
          <span className="flex min-w-0 flex-col gap-0.5">
            {/* The name as a label, as the report's fields label their values
                — small, secondary — over the summary; its chip at the right. */}
            <span className="flex items-center justify-between gap-3">
              <span className="text-caption leading-4 text-text-secondary">{group.label}</span>
              <StatusChip group={group} />
            </span>
            {/* What it found, in graphite: the row's substance, not a caption. */}
            {group.summary && <span className="text-sm text-text-primary">{group.summary}</span>}
          </span>
        </CategoryButton>
        {/* What the reader can do about it, above the row's own target. */}
        {group.actions && <div className="relative z-[1] flex flex-wrap gap-2">{group.actions}</div>}
        {tasks.length > 0 && <ul className="m-0 flex flex-col p-0">
          {tasks.map((i) => (
            <Task insight={i} key={i.id} onFollow={() => (onChip ? onChip(i, group) : onSelect())} />
          ))}
        </ul>}
        <Footer group={group} />
      </div>
    </div>
  )
}

const InsightCell = ({ group, selected, onSelect }: { group: PanelGroup; selected: boolean; onSelect: () => void }) => (
  <div className={rowClass(selected)}>
    <CategoryButton group={group} onSelect={onSelect} selected={selected}>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center justify-between gap-3">
          <span className="text-caption leading-4 text-text-secondary">{group.label}</span>
          <StatusChip group={group} />
        </span>
        <span className="text-sm text-text-primary">{group.insights[0].verdict}</span>
        <Footer group={group} />
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
        <div className={cn('bg-card', i > 0 && rowHairline)} data-flip-id={g.rowKey ?? g.cardId} key={g.rowKey ?? g.cardId}>
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
                data-flip-id={g.rowKey ?? g.cardId}
                key={g.rowKey ?? g.cardId}
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
