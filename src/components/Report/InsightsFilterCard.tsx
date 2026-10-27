import { SegmentedControl, SegmentedControlItem } from '@/core'

import { InsightList } from './InsightList'

import { InsightBar, StatusDot, type PanelGroup } from './AssessmentPanel'

/** What the report is filtered to: every card, or the cards with an insight that read this way. */
export type InsightOutcome = 'all' | 'failure' | 'success' | 'unknown'

export type InsightFilter = { outcome: InsightOutcome; cards: ReadonlySet<string> }

export const NO_FILTER: InsightFilter = { outcome: 'all', cards: new Set() }

/** Failed and for review are one mark against, as the counts read. */
const outcomeOf = (intent: string): Exclude<InsightOutcome, 'all'> =>
  intent === 'success' ? 'success' : intent === 'failure' || intent === 'warning' ? 'failure' : 'unknown'

/** A card's insights that count — not the row's lead or its "other names" tally. */
const counted = (g: PanelGroup) => g.insights.filter((i) => !i.synthetic)

/** How many of a card's insights read this way; `all`, every one. */
export const countIn = (g: PanelGroup, outcome: InsightOutcome) =>
  counted(g).filter((i) => outcome === 'all' || outcomeOf(i.intent) === outcome).length

const OUTCOMES: Array<{ id: Exclude<InsightOutcome, 'all'>; word: string }> = [
  { id: 'failure', word: 'Not passed' },
  { id: 'success', word: 'Passed' },
  { id: 'unknown', word: 'Context' }
]

export const outcomeWord = (o: InsightOutcome) => OUTCOMES.find((x) => x.id === o)?.word ?? 'All'

/**
 * The report's insights, and the way to read only some of it — under the
 * left panel's Insights heading.
 *
 * In the head, under the title, which way the insights read — All, against,
 * passed, context — then the bar, and under it, one chip per report card with how many of its
 * insights read that way. Picking an outcome shows only the cards it touches;
 * picking chips shows only those cards. "All" shows the report whole again.
 * The report's own narrowing does the showing (`focus` on the record page),
 * so its back tab undoes this too.
 */
export const InsightsFilterCard = ({
  groups,
  filter,
  onChange
}: {
  groups: PanelGroup[]
  filter: InsightFilter
  onChange: (next: InsightFilter) => void
}) => {
  const total = { failure: 0, success: 0, unknown: 0 }
  for (const g of groups) for (const i of counted(g)) total[outcomeOf(i.intent)] += 1
  const all = total.failure + total.success + total.unknown
  // Under an outcome, only the cards it touches.
  const shown = groups.filter((g) => countIn(g, filter.outcome) > 0)
  // A row narrows the report to its card; the same row again widens it back.
  const pick = (g: PanelGroup) =>
    onChange({ outcome: filter.outcome, cards: filter.cards.has(g.cardId) ? new Set() : new Set([g.cardId]) })
  // No card around it and no title: the side panel's own head says Insights.
  return (
    <section aria-label="Insights" className="flex flex-col">
      {/* Pinned to the top of the panel as the list scrolls under it: which
          way they read is always a click away. It pulls out over the panel's
          own padding so nothing shows above or beside it, and its hairline
          stays with it rather than scrolling off with the list. */}
      <div className="sticky -top-4 z-[2] -mx-4 -mt-4 flex flex-col gap-3 border-b border-solid border-[var(--core-color-border-divider)] bg-card px-4 pb-3 pt-4">
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
          {OUTCOMES.map(({ id, word }) => (
            <SegmentedControlItem
              aria-label={`${word}: ${total[id]}`}
              disabled={total[id] === 0}
              icon={<StatusDot intent={id} size={14} />}
              key={id}
              value={id}
            >
              <span className="tabular-nums">{total[id]}</span>
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
        <InsightBar counts={total} />
      </div>
      {/* The insights themselves, flush to the panel's edges as its other lists are. */}
      <div className="-mx-4">
        <InsightList groups={shown} onSelect={pick} selected={filter.cards} />
      </div>
    </section>
  )
}
