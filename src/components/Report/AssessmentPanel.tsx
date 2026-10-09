import { useLayoutEffect, useRef, type MouseEvent } from "react"

import { Circle, CircleAlert, CircleCheck, CircleX, Sparkles, type LucideIcon } from "lucide-react"

import { ActionButton, Hint, HintContent, HintTrigger, MetaChip, PageHeadingCount, Skeleton, Text } from "@/core"

import { cn } from "../../utils/twUtils"
import { CardHeader } from "../CardHeader"
import type { OutcomeTally } from "./ReportHero"

/**
 * The assessment's panel at the report's left: ~/Projects/prototype's
 * Insights panel (`containers/BusinessHome/Insights` — `InsightsPanel`,
 * `InsightSummary`, `InsightRow`), with the assessment itself in its head.
 *
 * Its head is the score with how the insights read beside it and the bar under
 * both; then the assessment, its summary and the way to the full assessment.
 * Under that, the insights, one row per card of the report: the card, its worst
 * finding as the verdict, the rest as chips. A row narrows the report to its
 * card; the same row again widens it back. Rows that passed with nothing more
 * to say sit two to a line, as the source's band does.
 *
 * The source's status glyph colours come from the Tailwind palette; here they
 * are the status tokens.
 */

export type Intent = "success" | "warning" | "failure" | "unknown" | "pending"

export type PanelInsight = {
  id: string
  intent: Intent
  /** The finding in a word or two where the check has one; else its sentence. */
  verdict: string
  /** The full sentence, for the hover. */
  statement: string
  /** Not an insight of its own — the row's lead (the business's name), or a
   *  tally of what else was found — so not counted. */
  synthetic?: boolean
}

export type PanelGroup = {
  /** The report card the insights are read on. */
  cardId: string
  label: string
  /** Worst first: the head of the row, then its chips. */
  insights: PanelInsight[]
}

const ICON: Record<Intent, LucideIcon> = {
  success: CircleCheck,
  warning: CircleAlert,
  failure: CircleX,
  unknown: Circle,
  pending: Circle
}

const COLOR: Record<Intent, string> = {
  success: "text-[var(--core-color-status-success-fg)]",
  warning: "text-[var(--core-color-status-warning-fg)]",
  failure: "text-[var(--core-color-status-danger-fg)]",
  unknown: "text-text-secondary",
  pending: "text-text-disabled"
}

const BAR: Record<Exclude<Intent, "pending">, string> = {
  success: "bg-[var(--core-color-status-success-fg)]",
  warning: "bg-[var(--core-color-status-warning-fg)]",
  failure: "bg-[var(--core-color-status-danger-fg)]",
  unknown: "bg-[var(--core-color-border-strong)]"
}

const CHIP_TONE = {
  success: "neutral",
  warning: "warning",
  failure: "danger",
  unknown: "neutral",
  pending: "neutral"
} as const

export const StatusDot = ({ intent, size = 16, className }: { intent: Intent; size?: number; className?: string }) => {
  const Icon = ICON[intent]
  return (
    <span className={cn("inline-block shrink-0 leading-[0]", className)}>
      <Icon aria-hidden="true" className={COLOR[intent]} size={size} strokeWidth={2.5} />
    </span>
  )
}

/** Rows that move when the list reorders glide to their new place. */
const useFlipList = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const previousRects = useRef(new Map<string, { top: number; left: number }>())
  const previousOrder = useRef("")

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    const blocks = Array.from(container.querySelectorAll<HTMLElement>("[data-flip-id]"))
    const orderKey = blocks.map((b) => b.dataset.flipId).join("|")
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
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
        block.style.transition = "none"
        block.style.transform = `translate(${dx}px, ${dy}px)`
        block.getBoundingClientRect()
        block.style.transition = "transform var(--core-duration-standard) var(--core-ease-standard)"
        block.style.transform = ""
        const onEnd = (e: TransitionEvent) => {
          if (e.target !== block || e.propertyName !== "transform") return
          block.style.transition = ""
          block.removeEventListener("transitionend", onEnd)
        }
        block.addEventListener("transitionend", onEnd)
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

const SEGMENTS = ["success", "warning", "failure", "unknown"] as const

const countsOf = (tally: OutcomeTally) => ({
  success: tally.good,
  warning: tally.review,
  failure: tally.bad,
  unknown: tally.neutral
})

/** The score, how the insights read beside it, and the bar under both. */
export const ScoreHead = ({ score, tally }: { score: number | null; tally: OutcomeTally }) => {
  const counts = countsOf(tally)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span
          aria-label={score === null ? "Not scored yet" : `Assessment score ${score} out of 100`}
          className="text-3xl font-light leading-none tabular-nums text-text-primary"
        >
          {score ?? "—"}
        </span>
        <span className="flex items-center gap-3">
          {SEGMENTS.map(
            (intent) =>
              counts[intent] > 0 && (
                <span className="flex items-center gap-1" key={intent}>
                  <StatusDot intent={intent} size={14} />
                  <span className="text-sm font-medium leading-5 tabular-nums text-text-primary">
                    {counts[intent]}
                    <span className="sr-only"> {intent}</span>
                  </span>
                </span>
              )
          )}
        </span>
      </div>
      <div aria-hidden="true" className="flex h-1.5 gap-[2px]">
        {SEGMENTS.map(
          (intent) =>
            counts[intent] > 0 && (
              <div className={cn("rounded-[3px]", BAR[intent])} key={intent} style={{ flexGrow: counts[intent] }} />
            )
        )}
      </div>
    </div>
  )
}

const Chip = ({ insight }: { insight: PanelInsight }) => (
  <Hint>
    {/* The row's click passes through the hover's trigger. */}
    <HintTrigger className="min-w-0 max-w-full cursor-[inherit]" data-row-passthrough="">
      {/* A long finding clips at the panel's edge; the hover has it whole. */}
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
  const flagged = head.intent === "failure" || head.intent === "warning"
  const target = (
    <button
      aria-pressed={selected}
      className={cn(
        "min-w-0 text-left",
        'after:absolute after:inset-0 after:content-[""]',
        "focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
      )}
      onClick={onSelect}
      type="button"
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[10px] leading-3 tracking-[0.02em] text-text-secondary">{group.label}</span>
        <span className={cn("text-sm leading-5 text-text-primary", flagged && "font-semibold")}>{head.verdict}</span>
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
    "relative grid cursor-pointer grid-cols-[16px_minmax(0,1fr)] gap-x-3 px-4 py-3 transition-colors duration-[var(--core-duration-fast)] hover:bg-[var(--core-color-list-item-hover-bg)] motion-reduce:transition-none",
    selected && "bg-[color-mix(in_srgb,var(--core-color-state-selected-bg)_50%,var(--core-color-surface-card))]"
  )

const InsightRow = ({ group, selected, onSelect }: { group: PanelGroup; selected: boolean; onSelect: () => void }) => {
  const [head, ...rest] = group.insights
  const delegate = (e: MouseEvent<HTMLDivElement>) => {
    if (!(e.target instanceof Element)) return
    const button = e.target.closest("button")
    if (button && !("rowPassthrough" in button.dataset)) return
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
const isSimple = (g: PanelGroup) => g.insights.length === 1 && g.insights[0].intent === "success"

export const AssessmentPanel = ({
  score,
  tally,
  title,
  summary,
  regenerating,
  summaryGenerated,
  onShowSummary,
  groups,
  selectedCard,
  onSelectCard,
  transitionName
}: {
  score: number | null
  tally: OutcomeTally
  title: string
  summary: { text: string } | null
  regenerating?: boolean
  summaryGenerated: boolean
  /** Opens the assessment in the Assistant. Absent — the copy shown there —
   *  the panel has no button. */
  onShowSummary?: () => void
  groups: PanelGroup[]
  /** The card the report is narrowed to, if any. */
  selectedCard?: string
  onSelectCard: (group: PanelGroup) => void
  transitionName?: string
}) => {
  const flipRef = useFlipList()
  const fulls = groups.filter((g) => !isSimple(g))
  const band = groups.filter(isSimple)

  return (
    <div
      className="overflow-hidden rounded-card border border-border bg-card shadow-elevation-card"
      ref={flipRef}
      style={transitionName ? { viewTransitionName: transitionName } : undefined}
    >
      {/* The overview's card head: the assessment in the serif card title, over a hairline. */}
      <CardHeader title={title} />
      <div className="flex flex-col gap-4 p-4">
        <ScoreHead score={score} tally={tally} />
        {/* What it found, under the score: secondary, a touch smaller. */}
        {summary ? (
          <Text className="break-words text-dense leading-5" tone="secondary">
            {summary.text}
          </Text>
        ) : regenerating ? (
          <div className="flex flex-col gap-2 py-1" role="status" aria-label="Writing summary">
            <Skeleton className="w-full" />
            <Skeleton className="w-11/12" />
          </div>
        ) : null}
        {/* The assessment, in full, and its recommendations are the Assistant's;
            this is the way to them. The panel never lists the steps. */}
        {onShowSummary && (
          <ActionButton
            className="w-full"
            leadingIcon={<Sparkles aria-hidden="true" size={14} />}
            onClick={onShowSummary}
            size="compact"
            variant="secondary"
          >
            Run assessment
          </ActionButton>
        )}
      </div>

      <div className="border-t border-border px-4 pb-1 pt-3">
        <h3 className="m-0 flex items-center gap-2 font-arizona text-base font-light">
          Insights
          <PageHeadingCount>{groups.reduce((n, g) => n + g.insights.filter((i) => !i.synthetic).length, 0)}</PageHeadingCount>
        </h3>
      </div>
      {groups.length === 0 ? (
        <p className="m-0 px-4 py-6 text-text-secondary">No insights found</p>
      ) : (
        <>
          {fulls.map((g, i) => (
            <div className={cn("bg-card", i > 0 && rowHairline)} data-flip-id={g.cardId} key={g.cardId}>
              <InsightRow group={g} onSelect={() => onSelectCard(g)} selected={selectedCard === g.cardId} />
            </div>
          ))}
          {band.length > 0 && (
            <div className={cn("grid grid-cols-2", fulls.length > 0 && rowHairline)}>
              {band.map((g, i) => {
                const spansRow = i === band.length - 1 && band.length % 2 === 1
                return (
                  <div
                    className={cn(
                      "bg-card",
                      i % 2 === 1 && "border-l border-[var(--core-color-border-divider)]",
                      spansRow && "col-span-2",
                      i >= 2 && [
                        'relative before:pointer-events-none before:absolute before:top-0 before:border-t before:border-[var(--core-color-border-divider)] before:content-[""]',
                        spansRow
                          ? "before:inset-x-4"
                          : i % 2 === 0
                            ? "before:left-4 before:right-0"
                            : "before:left-0 before:right-4"
                      ]
                    )}
                    data-flip-id={g.cardId}
                    key={g.cardId}
                  >
                    <InsightCell group={g} onSelect={() => onSelectCard(g)} selected={selectedCard === g.cardId} />
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
