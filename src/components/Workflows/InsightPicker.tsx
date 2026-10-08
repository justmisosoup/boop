import { useState } from 'react'

import { Boxes, LayoutGrid, type LucideIcon } from 'lucide-react'

import {
  ActionButton,
  AppShellNavItem,
  Dialog,
  SearchInput,
  Text
} from '@/core'

import cya from '@/utils/cya'

import {
  conflictFor,
  type Draft,
  isInsightSelected,
  setInsightsSelected,
  toggleInsight
} from '@/lib/customOrders/model'
import type { OrderCatalog } from '@/lib/customOrders/types'

import {
  type BuilderTile,
  builderBundles,
  builderSections,
  matchesSearch,
  tilesIn
} from '@/lib/customOrders/layout'
import { Tile, TileGrid } from './Tile'

const ALL = 'all'
const BUNDLES = 'bundles'

const RailItem = ({
  icon: Icon,
  label,
  active,
  onSelect
}: {
  icon: LucideIcon
  label: string
  active: boolean
  onSelect: () => void
}) => (
  <li>
    <AppShellNavItem
      active={active}
      asChild
      className='focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring'
    >
      <button onClick={onSelect} type='button'>
        <span className='grid size-4 shrink-0 place-items-center'>
          <Icon aria-hidden='true' className='size-4' />
        </span>
        <span className='min-w-0 truncate'>{label}</span>
      </button>
    </AppShellNavItem>
  </li>
)

const SectionHeading = ({
  title,
  description
}: {
  title: string
  description?: string
}) => (
  <div className='grid gap-0.5'>
    <h3 className='font-semibold text-base text-foreground'>{title}</h3>
    {description && (
      <Text size='xs' tone='secondary'>
        {description}
      </Text>
    )}
  </div>
)

export const InsightPicker = ({
  catalog,
  draft,
  isOpen,
  onChange,
  onClose
}: {
  catalog: OrderCatalog
  draft: Draft
  isOpen: boolean
  onChange: (draft: Draft) => void
  onClose: () => void
}) => {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(ALL)
  const q = query.trim().toLowerCase()
  const showAll = Boolean(q) || active === ALL

  const isSelected = (ref: { packageKey: string; groupId: string }) =>
    isInsightSelected(catalog, draft, ref.packageKey, ref.groupId)
  const blockedBy = (packageKey: string) =>
    draft.packages.includes(packageKey)
      ? undefined
      : conflictFor(catalog, draft, packageKey)

  const bundles = builderBundles(catalog).filter(
    b => !q || matchesSearch(q, [b.title, b.description])
  )
  const sections = builderSections(catalog)
    .map(section => ({
      ...section,
      groups: section.groups
        .map(group => ({
          ...group,
          tiles: group.tiles.filter(
            t =>
              !q ||
              matchesSearch(q, [
                t.title,
                t.description,
                section.title,
                group.title ?? ''
              ])
          )
        }))
        .filter(group => group.tiles.length > 0)
    }))
    .filter(section => section.groups.length > 0)

  const visibleSections = sections.filter(s => showAll || s.id === active)
  const showBundles = bundles.length > 0 && (showAll || active === BUNDLES)
  const addedCount = builderSections(catalog)
    .flatMap(tilesIn)
    .filter(isSelected).length

  const insightTile = (tile: BuilderTile) => {
    const conflict = blockedBy(tile.packageKey)
    return (
      <Tile
        checked={isSelected(tile)}
        disabled={Boolean(conflict)}
        key={tile.dataCy}
        onToggle={() =>
          onChange(toggleInsight(catalog, draft, tile.packageKey, tile.groupId))
        }
        subtitle={
          conflict
            ? `Can't be combined with ${conflict.label}.`
            : tile.description
        }
        title={tile.title}
        {...cya(tile.dataCy)}
      />
    )
  }

  return (
    <Dialog
      // A fixed height keeps the modal from resizing as search narrows the
      // results; the body (the panel's second-to-last child, before the
      // footer) grows to fill it so the footer stays at the bottom. The body
      // drops its padding so the nav and results panes reach its edges.
      className='h-[min(760px,calc(100dvh-3rem))] max-w-5xl [&>:nth-last-child(2)]:flex-1 [&>:nth-last-child(2)]:overflow-hidden [&>:nth-last-child(2)]:p-0'
      footer={
        <div className='flex w-full items-center justify-between gap-3'>
          <Text size='sm' tone='secondary'>
            {addedCount} {addedCount === 1 ? 'insight' : 'insights'} added
          </Text>
          <ActionButton
            onClick={onClose}
            type='button'
            variant='primary'
            {...cya('InsightPickerDone')}
          >
            Done
          </ActionButton>
        </div>
      }
      isOpen={isOpen}
      onClose={onClose}
      size='lg'
      title='Add insights'
    >
      <div className='grid h-full grid-rows-[auto_minmax(0,1fr)] sm:grid-cols-[220px_minmax(0,1fr)] sm:grid-rows-[minmax(0,1fr)]'>
        <div className='grid content-start gap-3 border-b border-border p-2 sm:border-r sm:border-b-0'>
          <SearchInput
            aria-label='Search insights'
            onChange={setQuery}
            placeholder='Search insights'
            value={query}
          />
          <nav aria-label='Insight themes' className='hidden sm:block'>
            <ul className='m-0 grid list-none gap-0.5 p-0'>
              <RailItem
                active={!q && active === ALL}
                icon={LayoutGrid}
                label='All'
                onSelect={() => {
                  setQuery('')
                  setActive(ALL)
                }}
              />
              <RailItem
                active={!q && active === BUNDLES}
                icon={Boxes}
                label='Bundles'
                onSelect={() => {
                  setQuery('')
                  setActive(BUNDLES)
                }}
              />
              {builderSections(catalog).map(section => (
                <RailItem
                  active={!q && active === section.id}
                  icon={section.icon}
                  key={section.id}
                  label={section.title}
                  onSelect={() => {
                    setQuery('')
                    setActive(section.id)
                  }}
                />
              ))}
            </ul>
          </nav>
        </div>

        <div className='grid min-h-0 content-start gap-8 overflow-y-auto bg-background p-5'>
          {showBundles && (
            <section className='grid gap-3'>
              <SectionHeading
                description='Insights that are ordered together, like the packages you know.'
                title='Bundles'
              />
              <TileGrid label='Bundles'>
                {bundles.map(bundle => {
                  const conflict = blockedBy(bundle.id)
                  const checked = bundle.tiles.every(isSelected)
                  return (
                    <Tile
                      checked={checked}
                      disabled={Boolean(conflict)}
                      icon={bundle.icon}
                      key={bundle.id}
                      onToggle={() =>
                        onChange(
                          setInsightsSelected(
                            catalog,
                            draft,
                            bundle.tiles,
                            !checked
                          )
                        )
                      }
                      subtitle={
                        conflict
                          ? `Can't be combined with ${conflict.label}.`
                          : bundle.description
                      }
                      title={bundle.title}
                      {...cya(`CustomOrderBundle-${bundle.id}`)}
                    />
                  )
                })}
              </TileGrid>
            </section>
          )}

          {visibleSections.map(section => (
            <section className='grid gap-3' key={section.id}>
              <SectionHeading title={section.title} />
              {section.groups.map(group => (
                <div className='grid gap-2' key={group.title ?? section.id}>
                  {group.title && (
                    <Text className='font-semibold' size='xs' tone='secondary'>
                      {group.title}
                    </Text>
                  )}
                  <TileGrid label={`${group.title ?? section.title} insights`}>
                    {group.tiles.map(insightTile)}
                  </TileGrid>
                </div>
              ))}
            </section>
          ))}

          {!showBundles && visibleSections.length === 0 && (
            <Text size='sm' tone='secondary'>
              No insights match “{query.trim()}”.
            </Text>
          )}
        </div>
      </div>
    </Dialog>
  )
}
