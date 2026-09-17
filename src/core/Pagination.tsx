import type React from 'react'

import isNumber from 'lodash/isNumber'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { cn } from '@/utils/twUtils'

import {
  PaginationContent,
  PaginationItem,
  PaginationLink
} from './internal/ui/pagination'
import { useCoreThemeFallback } from './useCoreThemeFallback'

type PaginationProps = {
  /** The current page */
  page?: number
  /** Handler for pagination */
  onPage?: (page: number) => void
  /** Items per page */
  perPage?: number
  /** Total items in list */
  total?: number | null
  /**
   * Keep the control rendered even when everything fits on one page (shown as
   * "Page 1 of 1" with both arrows disabled). By default it hides itself.
   */
  persistent?: boolean
  /** Forwarded to the root element so `styled(ListPagination)` wrappers apply */
  className?: string
}

// Circular prev/next arrow using the core action-secondary token family so
// colour, hover, active, focus, and disabled states stay in sync with the rest
// of the design system. `.core-action` already supplies the pill radius — a
// circle on a square (h-9 w-9) box — so no radius override is needed.
const arrowClass = 'core-action core-action-secondary h-9 w-9'

// The DS sizes `.core-action svg` to 14px; the arrows want 16px. An inline
// style beats that stylesheet rule without resorting to `!important`.
const iconSize = { width: 16, height: 16 }

const Arrow = ({
  label,
  icon,
  targetPage,
  enabled,
  onPage
}: {
  label: string
  icon: React.ReactNode
  targetPage: number
  enabled: boolean
  onPage: (page: number) => void
}) => {
  const go = () => {
    if (enabled) onPage(targetPage)
  }
  return (
    <PaginationLink
      size='icon'
      aria-label={label}
      aria-disabled={!enabled}
      role='button'
      tabIndex={enabled ? 0 : -1}
      className={arrowClass}
      onClick={e => {
        e.preventDefault()
        go()
      }}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          go()
        }
      }}
    >
      {icon}
    </PaginationLink>
  )
}

const Pagination = ({
  onPage = () => {},
  page = 1,
  perPage = 5,
  total = null,
  persistent = false,
  className
}: PaginationProps) => {
  const [navRef, applyFallback] = useCoreThemeFallback()

  if (!persistent && isNumber(total) && total <= perPage) {
    return <></>
  }

  // When the total is unknown we can't compute a page count, so keep the
  // "next" control enabled and fall back to a "Page X" label. The Math.max
  // floors an empty persistent list at "Page 1 of 1" (both arrows disabled)
  // instead of an enabled next arrow into nothing.
  const known = isNumber(total) && total !== Infinity
  const totalPages = known
    ? Math.max(1, Math.ceil((total as number) / perPage))
    : null

  return (
    <nav
      ref={navRef}
      aria-label='pagination'
      className={cn(
        applyFallback && 'core-theme',
        'flex items-center',
        className
      )}
    >
      <span className='mr-2 whitespace-nowrap text-sm text-[var(--core-color-text-secondary)]'>
        {totalPages ? `Page ${page} of ${totalPages}` : `Page ${page}`}
      </span>
      <PaginationContent className='gap-2'>
        <PaginationItem>
          <Arrow
            label='Go to previous page'
            icon={<ChevronLeft className='-translate-x-px' style={iconSize} />}
            targetPage={page - 1}
            enabled={page > 1}
            onPage={onPage}
          />
        </PaginationItem>
        <PaginationItem>
          <Arrow
            label='Go to next page'
            icon={<ChevronRight className='translate-x-px' style={iconSize} />}
            targetPage={page + 1}
            enabled={totalPages ? page < totalPages : true}
            onPage={onPage}
          />
        </PaginationItem>
      </PaginationContent>
    </nav>
  )
}

export default Pagination
