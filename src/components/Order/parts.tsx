import type { ReactNode } from 'react'

import { ChevronLeft, Plus, X } from 'lucide-react'

import { ActionButton, IconActionButton } from '@/core'

import { cn } from '@/utils/twUtils'


/**
 * The Place order page's own pieces, from ~/Projects/prototype's
 * `OrderPageSkeleton` and `components/PlaceOrderFlow/SharedComponents` — the
 * same layout, with tokens where those used the legacy theme.
 */

/** A page in the dashboard's body, under its nav: a bar with the breadcrumb and
 *  the step's actions — Cancel among them, so no close of its own — pinned
 *  over a narrow column as the page scrolls. */
export const OrderPageFrame = ({
  children,
  close,
  actions,
  crumbs
}: {
  children: ReactNode
  /** The page's breadcrumb, at the bar's left. */
  crumbs?: ReactNode
  close: () => void
  /** The step's buttons — Cancel and Next, Back and Run — at the bar's right. */
  actions?: ReactNode
}) => {
  return (
    // The dashboard's page scrolls it; the bar stays pinned at its top.
    <div className='flex min-h-dvh w-full flex-col bg-[var(--core-color-surface-canvas)] pb-5 text-foreground'>
      <div className='sticky top-0 z-10 border-b border-[var(--core-color-border-divider)] bg-[var(--core-color-surface-canvas)] px-4 py-4'>
        {/* The crumb and the actions on the form's own column. */}
        <div className='mx-auto flex w-full max-w-xl items-center justify-between gap-4'>
          <div className='min-w-0'>{crumbs}</div>
          <div className='flex shrink-0 items-center gap-2'>{actions}</div>
        </div>
      </div>
      <div className='mt-10 flex flex-col items-center px-4'>
        <div className='w-full max-w-xl'>{children}</div>
      </div>
    </div>
  )
}

export const Title = ({ children }: { children: ReactNode }) => (
  <h1 className='m-0 mb-1 font-arizona text-3xl font-light leading-10 tracking-[-0.02em]'>{children}</h1>
)

export const SubTitle = ({ children }: { children: ReactNode }) => (
  <p className='m-0 mb-4 text-sm text-text-secondary'>{children}</p>
)

export const LinkText = ({ children }: { children: ReactNode }) => (
  <span className='text-sm font-normal text-[var(--core-color-text-link)]'>{children}</span>
)

export const ButtonContainer = ({ children }: { children: ReactNode }) => (
  <div className='flex justify-end gap-2'>{children}</div>
)

export const Back = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
  <button
    className='-ml-1 mb-2 flex items-center gap-1 text-sm text-foreground'
    onClick={onClick}
    type='button'
  >
    <ChevronLeft aria-hidden='true' size={14} />
    {children}
  </button>
)

/** A field, or a list of them; the last of a list offers another. */
export const Row = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('flex flex-col items-start gap-2 [&>*]:w-full', className)}>{children}</div>
)

export const ArrayFieldItem = ({
  children,
  canDelete = true,
  onDelete,
  isLast = false,
  onAdd,
  addButtonText,
  deleteAriaLabel
}: {
  children: ReactNode
  canDelete?: boolean
  onDelete: () => void
  isLast?: boolean
  onAdd: () => void
  addButtonText: string
  deleteAriaLabel: string
}) => (
  <>
    {/* The delete sits inside the field's right end, so a list of them keeps
        the same right edge as every other field. */}
    <div className={cn('relative', canDelete && '[&_input]:pr-10')}>
      {children}
      {canDelete && (
        <IconActionButton
          aria-label={deleteAriaLabel}
          className='absolute bottom-1 right-1'
          onClick={onDelete}
          type='button'
          variant='quiet'
        >
          <X aria-hidden='true' />
        </IconActionButton>
      )}
    </div>
    {isLast && (
      <ActionButton
        className='!w-auto'
        leadingIcon={<Plus aria-hidden='true' />}
        onClick={onAdd}
        size='compact'
        type='button'
        variant='secondary'
      >
        {addButtonText}
      </ActionButton>
    )}
  </>
)
