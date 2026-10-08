import type { LucideIcon } from 'lucide-react'
import { LayoutGrid, Sparkles, X } from 'lucide-react'
import { type ReactNode, useState } from 'react'

import { ActionButton, IconActionButton, Text, Tooltip } from '@/core'
import { cn } from '@/utils/twUtils'

import {
  type Draft,
  isInsightSelected,
  toggleInsight
} from '@/lib/customOrders/model'
import type { OrderCatalog } from '@/lib/customOrders/types'
import cya from '@/utils/cya'

import { CardRow, Counted, SectionCard } from './cards'
import { builderSections, tilesIn } from '@/lib/customOrders/layout'

type Row = {
  id: string
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
        title: tile.title,
        description: tile.description,
        theme: section.title,
        icon: section.icon,
        remove: next =>
          toggleInsight(catalog, next, tile.packageKey, tile.groupId)
      }))
  )
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
          {rows.map(({ id, title, description, remove }) => (
            <li
              className={cn(
                'flex items-center gap-3 px-4 py-2.5',
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
              <span className='grid min-w-0 flex-1 gap-0.5'>
                <Text className='m-0 truncate'>{title}</Text>
                <span className='truncate text-muted-foreground text-xs'>
                  {description}
                </span>
              </span>
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
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  )
}
