import type React from 'react'

import { cn } from '@/utils/twUtils'

import { Skeleton } from './FeedbackState'

export type SkeletonPageProps = {
  /** Render the page title block (title + subtitle line). Default true. */
  header?: boolean
  /**
   * Render the subtitle line under the title. Default true. Set false for a
   * page whose header is title + tabs (no description line), so the silhouette
   * matches and the swap to the real page doesn't shift vertically.
   */
  subtitle?: boolean
  /** Render a short back-link stub above the title (for detail/sub pages). */
  backLink?: boolean
  /** Number of tab stubs to render under the header. Default 0 (none). */
  tabs?: number
  /**
   * Content skeleton. Defaults to a table-shaped card (header strip + rows)
   * that mirrors the DataTable card chrome, so a list page resolves into place
   * without a layout jump. Pass children to stand in for a non-table page.
   */
  children?: React.ReactNode
  className?: string
}

// Mirrors the DataTable card (same border / header strip / divider tokens) so
// the swap from this placeholder to a real table reads as one continuous paint
// rather than two different shapes.
const SkeletonTableCard = () => (
  <div className='overflow-hidden rounded-[var(--core-radius-card)] border border-[var(--core-color-table-border)] bg-[var(--core-color-surface-card)] shadow-elevation-card'>
    <div className='border-b border-[var(--core-color-table-border)] bg-[var(--core-color-table-header-bg)] px-4 py-2.5'>
      <Skeleton style={{ width: 96, height: 12 }} />
    </div>
    {/* Varied widths so the rows read as content, not a grid of identical bars. */}
    {['38%', '30%', '44%', '34%', '40%', '28%'].map((width, index) => (
      <div
        key={index}
        className='flex items-center justify-between gap-6 border-b border-[var(--core-color-table-divider)] px-4 py-3.5 last:border-b-0'
      >
        <Skeleton style={{ width, height: 13 }} />
        <Skeleton style={{ width: 64, height: 13 }} />
        <Skeleton style={{ width: 120, height: 13 }} />
      </div>
    ))}
  </div>
)

/**
 * Page-shaped loading placeholder: a title block, optional tabs, and a content
 * area (defaulting to a table-shaped card). It stands in for a whole page while
 * its code chunk and/or first data load resolve — used as the route-level
 * Suspense fallback so the content area never flashes blank, and reusable
 * anywhere a page needs a calm "still loading" frame.
 *
 * Built on the `@/core` Skeleton (shimmer + `prefers-reduced-motion` aware) and
 * the shared `--core-*` tokens; deliberately generic so the silhouette holds
 * steady across routes. On warm in-app navigations React Router keeps the
 * previous page visible (transitions), so this shows mainly on cold loads.
 */
export const SkeletonPage = ({
  header = true,
  subtitle = true,
  backLink = false,
  tabs = 0,
  children,
  className
}: SkeletonPageProps) => (
  <div className={cn('flex flex-1 flex-col gap-6 p-6', className)}>
    <span aria-live='polite' className='sr-only' role='status'>
      Loading
    </span>
    {backLink && (
      <Skeleton style={{ width: 96, height: 14, borderRadius: 6 }} />
    )}
    {header && (
      <div className='flex flex-col gap-2.5'>
        <Skeleton style={{ width: 200, height: 26, borderRadius: 8 }} />
        {subtitle && <Skeleton style={{ width: 320, height: 15 }} />}
      </div>
    )}
    {tabs > 0 && (
      <div className='flex gap-5'>
        {Array.from({ length: tabs }).map((_, index) => (
          <Skeleton key={index} style={{ width: 88, height: 16 }} />
        ))}
      </div>
    )}
    {children ?? <SkeletonTableCard />}
  </div>
)

SkeletonPage.displayName = 'SkeletonPage'
