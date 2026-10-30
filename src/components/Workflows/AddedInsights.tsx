import type { LucideIcon } from 'lucide-react'
import { ChevronDown, LayoutGrid, Sparkles, X } from 'lucide-react'
import { type ReactNode, useState } from 'react'

import { ActionButton, IconActionButton, SegmentedControl, SegmentedControlItem, Text, Tooltip } from '@/core'
import { cn } from '@/utils/twUtils'

import {
  type Draft,
  isInsightSelected,
  setOverride,
  toggleInsight
} from '@/lib/customOrders/model'
import type { InsightStatus, OrderCatalog } from '@/lib/customOrders/types'
import cya from '@/utils/cya'

import { CardRow, Counted, SectionCard } from './cards'
import { builderSections, tilesIn } from '@/lib/customOrders/layout'

type Row = {
  id: string
  groupId: string
  title: string
  description: string
  theme: string
  icon: LucideIcon
  remove: (draft: Draft) => Draft
}

// Bundles list every insight they include, in the order the picker shows them.
export const addedRows = (catalog: OrderCatalog, draft: Draft): Row[] => {
  const seen = new Set<string>()
  return builderSections(catalog).flatMap(section =>
    tilesIn(section)
      .filter(tile => {
        // A shared insight shows once, wherever the picker first lists it.
        if (seen.has(tile.groupId)) return false
        if (!isInsightSelected(catalog, draft, tile.packageKey, tile.groupId))
          return false
        seen.add(tile.groupId)
        return true
      })
      .map(tile => ({
        id: tile.dataCy,
        groupId: tile.groupId,
        title: tile.title,
        description: tile.description,
        theme: section.title,
        icon: section.icon,
        remove: next =>
          toggleInsight(catalog, next, tile.packageKey, tile.groupId)
      }))
  )
}

/** What each result of an insight counts as, in the panel's own words. */
const STATUS_WORD: Record<InsightStatus, string> = {
  success: 'Passed',
  warning: 'To review',
  failure: 'Not passed'
}

/**
 * An insight group's rules: every result each of its insights can come back
 * with, and what that result counts as in this assessment. The catalog's
 * default is preselected; a change is marked, and setting it back to the
 * default undoes it (`setOverride` drops an override equal to the default).
 * This is what makes a variant read the same data differently.
 */
const Rules = ({
  catalog,
  draft,
  groupId,
  onChange
}: {
  catalog: OrderCatalog
  draft: Draft
  groupId: string
  onChange: (draft: Draft) => void
}) => {
  const keys = catalog.insight_groups.find(g => g.id === groupId)?.insight_keys ?? []
  const insights = catalog.insights.filter(i => keys.includes(i.key))
  return (
    <div className='flex flex-col gap-3 pb-3 pl-4 pr-4'>
      {insights.map(insight => (
        <div className='flex flex-col gap-1.5' key={insight.key}>
          <Text className='m-0 font-medium' size='sm'>
            {insight.label}
          </Text>
          {insight.outcomes.map(outcome => {
            const current =
              draft.overrides.find(o => o.insight === insight.key && o.outcome === outcome.key)?.status ??
              outcome.default_status
            const changed = current !== outcome.default_status
            return (
              <div className='flex flex-wrap items-center justify-between gap-x-3 gap-y-1' key={outcome.key}>
                <span className='flex min-w-0 items-center gap-2 text-sm text-text-secondary'>
                  {outcome.label}
                  {changed && (
                    <button
                      className='rounded-control text-caption text-[var(--core-color-text-link)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                      onClick={() =>
                        onChange(
                          setOverride(draft, { insight: insight.key, outcome: outcome.key, status: outcome.default_status }, outcome.default_status)
                        )
                      }
                      title={`Reset to ${STATUS_WORD[outcome.default_status]}`}
                      type='button'
                    >
                      Changed · Reset
                    </button>
                  )}
                </span>
                <SegmentedControl
                  aria-label={`${insight.label}: ${outcome.label} counts as`}
                  onValueChange={v =>
                    v &&
                    onChange(
                      setOverride(draft, { insight: insight.key, outcome: outcome.key, status: v as InsightStatus }, outcome.default_status)
                    )
                  }
                  size='sm'
                  value={current}
                >
                  {(['success', 'warning', 'failure'] as const).map(st => (
                    <SegmentedControlItem key={st} value={st}>
                      {STATUS_WORD[st]}
                    </SegmentedControlItem>
                  ))}
                </SegmentedControl>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/** How many of a group's results this assessment reads differently. */
const changedIn = (catalog: OrderCatalog, draft: Draft, groupId: string) => {
  const keys = catalog.insight_groups.find(g => g.id === groupId)?.insight_keys ?? []
  return draft.overrides.filter(o => keys.includes(o.insight)).length
}

const DIVIDED =
  '[&:not(:first-child)]:border-t [&:not(:first-child)]:border-[var(--core-color-border-divider)]'

// Editable when `onChange` is given; otherwise a numbered, read-only list.
// `composer` offers drafting from a prompt as an alternative to picking.
export const InsightsCard = ({
  catalog,
  draft,
  onChange,
  onAdd,
  composer
}: {
  catalog: OrderCatalog
  draft: Draft
  onChange?: (draft: Draft) => void
  onAdd?: () => void
  composer?: ReactNode
}) => {
  const rows = addedRows(catalog, draft)
  const isEmpty = rows.length === 0
  const ids = rows.map(row => row.id)
  const [shownIds, setShownIds] = useState(ids)
  const [entering, setEntering] = useState<string[]>([])
  if (ids.join() !== shownIds.join()) {
    setShownIds(ids)
    setEntering(ids.filter(id => !shownIds.includes(id)))
  }
  const [prompting, setPrompting] = useState(false)
  const [rulesOpen, setRulesOpen] = useState<string | null>(null)

  const addButton = onAdd && (
    <ActionButton
      leadingIcon={<LayoutGrid aria-hidden='true' size={16} />}
      onClick={onAdd}
      size='compact'
      type='button'
      variant='secondary'
      {...cya('AddInsights')}
    >
      Add insights
    </ActionButton>
  )

  const promptButton = onAdd && composer && (
    <Tooltip
      content='Draft with prompt'
      trigger={
        <IconActionButton
          aria-label='Draft with prompt'
          className='!rounded-full'
          aria-pressed={prompting}
          onClick={() => setPrompting(open => !open)}
          {...cya('DraftWithPrompt')}
        >
          <Sparkles aria-hidden='true' />
        </IconActionButton>
      }
      triggerAsChild
    />
  )

  const emptyState = onAdd ? (
    <div className='grid place-items-center gap-1 rounded-card border border-border border-dashed px-6 py-8 text-center'>
      <span className='font-semibold text-foreground text-sm'>
        No insights yet
      </span>
      <span className='text-muted-foreground text-sm'>
        {composer
          ? 'Pick insights yourself, or describe what you need and we’ll draft a first pass.'
          : 'Add insights or a bundle to choose what this assessment checks.'}
      </span>
    </div>
  ) : (
    <Text size='sm' tone='secondary'>
      No insights.
    </Text>
  )

  return (
    <SectionCard
      title={<Counted count={rows.length} label='Insights' />}
      trailing={
        <>
          {promptButton}
          {addButton}
        </>
      }
    >
      {prompting && composer && <CardRow>{composer}</CardRow>}
      {isEmpty ? (
        !prompting && <CardRow>{emptyState}</CardRow>
      ) : (
        <ol aria-label='Added insights' className='m-0 list-none p-0'>
          {rows.map(({ id, groupId, title, description, remove }) => {
            const changed = changedIn(catalog, draft, groupId)
            const open = rulesOpen === id
            return (
            <li
              className={cn(
                DIVIDED,
                entering.includes(id) &&
                  'fade-in-0 slide-in-from-top-1 animate-in fill-mode-both duration-300 motion-reduce:animate-none'
              )}
              key={id}
              style={
                entering.includes(id)
                  ? { animationDelay: `${entering.indexOf(id) * 60}ms` }
                  : undefined
              }
              {...cya(`AddedInsight-${id}`)}
            >
              <div className='flex items-center gap-3 px-4 py-2.5'>
                <span className='grid min-w-0 flex-1 gap-0.5'>
                  <Text className='m-0 truncate'>{title}</Text>
                  <span className='truncate text-muted-foreground text-xs'>
                    {description}
                  </span>
                </span>
                {/* The rules: what each result counts as here. */}
                {(onChange || changed > 0) && (
                  <ActionButton
                    aria-expanded={open}
                    onClick={() => setRulesOpen(open ? null : id)}
                    size='compact'
                    trailingIcon={<ChevronDown aria-hidden='true' className={cn('size-4 transition-transform', open && 'rotate-180')} />}
                    type='button'
                    variant='quiet'
                  >
                    {changed > 0 ? `Rules · ${changed} changed` : 'Rules'}
                  </ActionButton>
                )}
                {onChange && (
                  <IconActionButton
                    aria-label={`Remove ${title}`}
                    onClick={() => onChange(remove(draft))}
                    type='button'
                    variant='quiet'
                  >
                    <X aria-hidden='true' />
                  </IconActionButton>
                )}
              </div>
              {open && onChange && <Rules catalog={catalog} draft={draft} groupId={groupId} onChange={onChange} />}
            </li>
            )
          })}
        </ol>
      )}
    </SectionCard>
  )
}
