import type { CSSProperties, ReactNode } from 'react'

import { Heading, MetaChip, PageHeadingCount, Surface, Text } from '@/core'
import { cn } from '@/utils/twUtils'

import {
  type Draft,
  inputSummary
} from '@/lib/customOrders/model'
import type { OrderCatalog } from '@/lib/customOrders/types'

// MetaChip has no inverse tone; overriding its colour variables keeps the
// library's shape and type while marking a required attribute.
const INVERSE_CHIP = {
  '--core-badge-bg': 'var(--core-color-surface-inverse)',
  '--core-badge-fg': 'var(--core-color-text-inverse)',
  '--core-badge-border': 'var(--core-color-surface-inverse)'
} as CSSProperties

export const Counted = ({ label, count }: { label: string; count: number }) => (
  <span className='flex items-center gap-2'>
    {label}
    <PageHeadingCount>{count}</PageHeadingCount>
  </span>
)

export const SectionCard = ({
  title,
  trailing,
  children,
  className
}: {
  title: ReactNode
  trailing?: ReactNode
  children: ReactNode
  className?: string
}) => (
  <Surface
    className={cn('overflow-hidden', className)}
    padding='none'
    variant='card'
  >
    {/* Tall enough for a compact button, so a header reads the same with or
        without one (the editor's "Add insights" vs the read-only view). */}
    <div className='flex min-h-14 items-center justify-between gap-3 border-[var(--core-color-border-divider)] border-b px-4 py-3'>
      <Heading className='min-w-0 font-normal text-base' level={4}>
        {title}
      </Heading>
      {trailing && (
        <span className='flex shrink-0 items-center gap-2'>{trailing}</span>
      )}
    </div>
    {children}
  </Surface>
)

const DIVIDED =
  '[&:not(:first-child)]:border-t [&:not(:first-child)]:border-[var(--core-color-border-divider)]'

export const CardRow = ({
  children,
  className
}: {
  children: ReactNode
  className?: string
}) => <div className={cn('px-4 py-3', DIVIDED, className)}>{children}</div>

export const Detail = ({
  label,
  children
}: {
  label: string
  children: ReactNode
}) => (
  <div
    className={cn(
      'flex items-baseline justify-between gap-4 px-4 py-2',
      DIVIDED
    )}
  >
    <Text className='m-0' tone='secondary'>
      {label}
    </Text>
    <Text className='m-0 text-right'>{children}</Text>
  </div>
)

const usedForText = (usedFor: string[]) =>
  usedFor.length > 2
    ? `${usedFor.slice(0, 2).join(', ')} and ${usedFor.length - 2} more`
    : usedFor.join(', ')

// What the customer sends for this selection, required first.
export const AttributesCard = ({
  catalog,
  draft
}: {
  catalog: OrderCatalog
  draft: Draft
}) => {
  const { required, optional } = inputSummary(catalog, draft)
  const rows = [
    ...required.map(use => ({ ...use, required: true })),
    ...optional.map(use => ({ ...use, required: false }))
  ]

  return (
    <SectionCard title={<Counted count={rows.length} label='Attributes' />}>
      {rows.length === 0 ? (
        <CardRow>
          <Text size='sm' tone='secondary'>
            Add insights to see the details you’ll send.
          </Text>
        </CardRow>
      ) : (
        <ul aria-label='Attributes' className='m-0 list-none p-0'>
          {rows.map(row => (
            <li
              className={cn(
                'flex items-center justify-between gap-3 px-4 py-2.5',
                DIVIDED
              )}
              key={row.id}
            >
              <span className='grid min-w-0 gap-0.5'>
                <Text className='m-0'>{row.label}</Text>
                {row.usedFor.length > 0 && (
                  <span className='truncate text-muted-foreground text-xs'>
                    {usedForText(row.usedFor)}
                  </span>
                )}
              </span>
              {row.required ? (
                <MetaChip size='xs' style={INVERSE_CHIP}>
                  Required
                </MetaChip>
              ) : (
                <MetaChip size='xs'>Optional</MetaChip>
              )}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}
