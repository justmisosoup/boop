import { Hint, HintContent, HintTrigger, SegmentedControl, SegmentedControlItem } from '@/core'

import { InsightList } from './InsightList'

import { InsightBar, StatusDot, type PanelGroup, type PanelInsight } from './AssessmentPanel'

/** What the report is filtered to: every assessment, or those whose status reads this way. */
export type InsightOutcome = 'all' | 'failure' | 'success' | 'unknown' | 'pending'

export type InsightFilter = { outcome: InsightOutcome; cards: ReadonlySet<string> }

export const NO_FILTER: InsightFilter = { outcome: 'all', cards: new Set() }

/**
 * An assessment's status: can't assess yet where it needs an input, else its
 * worst insight's — failed and for review being one mark against.
 */
export const statusOf = (g: PanelGroup): Exclude<InsightOutcome, 'all'> => {
  if (g.needs?.length) return 'pending'
  const intent = g.insights[0]?.intent
  return intent === 'success' ? 'success' : intent === 'failure' || intent === 'warning' ? 'failure' : 'unknown'
}

/** Whether an assessment reads this way; under `all`, every one does. */
export const inStatus = (g: PanelGroup, outcome: InsightOutcome) => outcome === 'all' || statusOf(g) === outcome

/** `hint`: what the mark means, on hover — the segment shows only the mark and its count. */
const OUTCOMES: Array<{ id: Exclude<InsightOutcome, 'all'>; word: string; hint: string }> = [
  { id: 'failure', word: 'Not passed', hint: 'Not passed' },
  { id: 'success', word: 'Passed', hint: 'Passed' },
  { id: 'unknown', word: 'Context', hint: 'Context' },
  { id: 'pending', word: "Can't assess yet", hint: "Can't assess yet" }
]

export const outcomeWord = (o: InsightOutcome) => OUTCOMES.find((x) => x.id === o)?.word ?? 'All'

/**
 * The workflow's assessments, and the way to read only some of them — under
 * the side panel's Assessments heading.
 *
 * In the head, how many assessments read each way — not passed, passed,
 * context, can't assess yet — then the bar. Picking a status shows only the
 * assessments with it, whole, and narrows the report to their cards. "All"
 * shows the report whole again.
 * The report's own narrowing does the showing (`focus` on the record page),
 * so its back tab undoes this too.
 */
export const InsightsFilterCard = ({
  groups,
  filter,
  onChange,
  onChip
}: {
  groups: PanelGroup[]
  filter: InsightFilter
  onChange: (next: InsightFilter) => void
  /** An insight followed — or, with none, its category: the report shows what it found. */
  onChip?: (insight: PanelInsight | undefined, group: PanelGroup) => void
}) => {
  // Assessments, by status — not their insights.
  const total = { failure: 0, success: 0, unknown: 0, pending: 0 }
  for (const g of groups) total[statusOf(g)] += 1
  const all = groups.length
  // Under a status, the assessments that read that way, whole.
  const shown = groups.filter((g) => inStatus(g, filter.outcome))
  // A category opens its card whole (`onChip` with no insight), else narrows
  // the report to it; the same category again widens it back.
  const pick = (g: PanelGroup) => {
    if (filter.cards.has(g.cardId)) return onChange({ outcome: filter.outcome, cards: new Set() })
    if (onChip) return onChip(undefined, g)
    onChange({ outcome: filter.outcome, cards: new Set([g.cardId]) })
  }
  // No card around it and no title: the side panel's own head says Assessments.
  return (
    <section aria-label="Assessments" className="flex flex-col">
      {/* Pinned to the top of the panel as the list scrolls under it: which
          way they read is always a click away. It pulls out over the panel's
          own padding so nothing shows above or beside it, and its hairline
          stays with it rather than scrolling off with the list. */}
      <div className="sticky -top-4 z-[2] -mx-4 -mt-4 flex flex-col gap-3 border-b border-solid border-[var(--core-color-border-divider)] bg-card px-4 pb-3 pt-4">
        {/* How many need review — the assessments not passed — over the bar,
            then the way to read only some of them. */}
        <p className="m-0 text-dense leading-5 text-text-primary">
          {total.failure ? `${total.failure} of ${all} need review` : `None of ${all} need review`}
        </p>
        {/* Can't-assess-yet has no colour to give the bar: the bar is what was read. */}
        <InsightBar counts={total} />
        <SegmentedControl
          aria-label="Show insights"
          className="self-start"
          onValueChange={(v) => onChange({ outcome: v as InsightOutcome, cards: new Set() })}
          size="sm"
          value={filter.outcome}
        >
          <SegmentedControlItem value="all">
            All <span className="tabular-nums">{all}</span>
          </SegmentedControlItem>
          {OUTCOMES.map(({ id, word, hint }) => (
            <Hint key={id}>
              {/* On a wrapper, not the segment: the tooltip's own data-state
                  would overwrite the segment's "on" and drop its selected look. */}
              <HintTrigger asChild>
                <span className="inline-flex">
                  <SegmentedControlItem
                    aria-label={`${word}: ${total[id]}`}
                    disabled={total[id] === 0}
                    icon={<StatusDot intent={id} size={14} />}
                    value={id}
                  >
                    <span className="tabular-nums">{total[id]}</span>
                  </SegmentedControlItem>
                </span>
              </HintTrigger>
              <HintContent side="bottom">{hint}</HintContent>
            </Hint>
          ))}
        </SegmentedControl>
      </div>
      {/* The insights themselves, flush to the panel's edges as its other lists are. */}
      <div className="-mx-4">
        <InsightList groups={shown} onChip={onChip} onSelect={pick} selected={filter.cards} />
      </div>
    </section>
  )
}
