import type { ReactNode } from "react"

import { Circle, CircleCheck, CircleX, type LucideIcon } from "lucide-react"

import { ActionButton, Skeleton, Text } from "@/core"

import { cn } from "../../utils/twUtils"
import type { ScoreBand } from "../../lib/identityScore"
import { DeterminationChip } from "../DeterminationChip"
import { MiddeskMark } from "../MiddeskMark"
import type { OutcomeTally } from "./ReportHero"

/**
 * The assessment's panel at the report's left: ~/Projects/prototype's
 * Insights panel (`containers/BusinessHome/Insights` — `InsightsPanel`,
 * `InsightSummary`, `InsightRow`), with the assessment itself in its head.
 *
 * Its head is the call and how the insights read, rolled up, with the bar under;
 * then the assessment, its summary and the way to the full assessment.
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
  // One mark against: a warning draws as the failure's X.
  warning: CircleX,
  failure: CircleX,
  unknown: Circle,
  pending: Circle
}

const COLOR: Record<Intent, string> = {
  success: "text-[var(--mark-pass)]",
  warning: "text-[var(--core-color-status-danger-fg)]",
  failure: "text-[var(--core-color-status-danger-fg)]",
  unknown: "text-text-secondary",
  pending: "text-text-disabled"
}

const BAR: Record<Exclude<Intent, "pending">, string> = {
  success: "bg-[var(--core-color-status-success-fg)]",
  warning: "bg-[var(--core-color-status-danger-fg)]",
  failure: "bg-[var(--core-color-status-danger-fg)]",
  unknown: "bg-[var(--core-color-border-strong)]"
}

export const StatusDot = ({ intent, size = 16, className }: { intent: Intent; size?: number; className?: string }) => {
  const Icon = ICON[intent]
  return (
    <span className={cn("inline-block shrink-0 leading-[0]", className)}>
      <Icon aria-hidden="true" className={COLOR[intent]} size={size} strokeWidth={2.5} />
    </span>
  )
}

/** Rows that move when the list reorders glide to their new place. */
const SEGMENTS = ["success", "failure", "unknown"] as const

const countsOf = (tally: OutcomeTally) => ({
  success: tally.good,
  failure: tally.bad + tally.review,
  unknown: tally.neutral
})

/** How the insights read, rolled up, and the bar under the counts. No score:
 *  the card's call is its chip, `trailing` them where the card shows one. */
export const ScoreHead = ({
  tally,
  trailing
}: {
  tally: OutcomeTally
  /** After the counts, at the right edge: the call's chip. */
  trailing?: ReactNode
}) => {
  const counts = countsOf(tally)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
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
        {trailing && <span className="ml-auto shrink-0">{trailing}</span>}
      </div>
      <InsightBar counts={counts} />
    </div>
  )
}

/** The three-colour bar: passed, against, context — each its share. */
export const InsightBar = ({ counts }: { counts: Record<(typeof SEGMENTS)[number], number> }) => (
  <div aria-hidden="true" className="flex h-1.5 gap-[2px]">
    {SEGMENTS.map(
      (intent) =>
        counts[intent] > 0 && (
          <div className={cn("rounded-[3px]", BAR[intent])} key={intent} style={{ flexGrow: counts[intent] }} />
        )
    )}
  </div>
)

export const AssessmentPanel = ({
  call,
  title,
  summary,
  regenerating,
  summaryGenerated,
  onShowSummary,
  actions,
  transitionName
}: {
  /** The call, as the business page's cards chip it; null where none is made. */
  call: ScoreBand | null
  title: string
  summary: { text: string } | null
  regenerating?: boolean
  summaryGenerated: boolean
  /** Opens the assessment in the Assistant. Absent — the copy shown there —
   *  the panel has no button. */
  onShowSummary?: () => void
  /** The business's controls — assignee, status, its menu — in the chip's place. */
  actions?: ReactNode
  transitionName?: string
}) => {

  return (
    <div
      className="overflow-hidden rounded-card border border-border bg-card shadow-elevation-card"
      style={transitionName ? { viewTransitionName: transitionName } : undefined}
    >
      <div className="assessment-card-body flex flex-col gap-4 p-4">
        {/* The assessment's name, no hairline under it: small, in graphite, as
            the summary cards name it, with its call at the far right of the
            same line. */}
        {/* One row — the name, then the controls. Where the card itself is
            narrow (`theme.css`, a container query on the card, not the window):
            the controls first, the assignee at the far left with its words on
            the card's edge, the status and menu at the right, and the name
            whole on its own line under them. */}
        <div className="assessment-head flex items-center justify-between gap-3">
          <h2 className="m-0 min-w-0 truncate font-arizona text-base font-light text-text-primary">{title}</h2>
          {/* The decision and what to do next where given — assignee, status,
              the menu — else the call as a chip. */}
          <span className="assessment-actions flex shrink-0 items-center gap-2">
            {actions ?? <DeterminationChip band={call} />}
          </span>
        </div>
        {/* What it found: secondary, a touch smaller. */}
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
            // As wide as its label, at the left. The Assistant's own button:
            // its pill, in midnight with the label reversed, and the Middesk
            // mark — this opens it. Important, as core's action classes
            // outrank a utility.
            className="self-start !rounded-pill !border-transparent !bg-[var(--core-color-interactive-default)] !text-[var(--core-color-text-inverse)] hover:!bg-[var(--core-color-interactive-hover)]"
            leadingIcon={<MiddeskMark className="h-[9px] w-4" />}
            onClick={onShowSummary}
            size="compact"
            variant="secondary"
          >
            Run Assistant
          </ActionButton>
        )}
      </div>

    </div>
  )
}
