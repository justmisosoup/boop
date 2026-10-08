import type { ReactNode } from 'react'

import { ChevronLeft, X } from 'lucide-react'
import { useNavigate } from 'react-router'

import { cn } from '@/utils/twUtils'

import { MiddeskMark } from '../MiddeskMark'

/**
 * The Place order page's own pieces, from ~/Projects/prototype's
 * `OrderPageSkeleton` and `components/PlaceOrderFlow/SharedComponents` — the
 * same layout, with tokens where those used the legacy theme.
 */

/** Full page, no app chrome: the mark, a close button, a narrow column. */
export const OrderPageFrame = ({
  children,
  close
}: {
  children: ReactNode
  close: () => void
}) => {
  const navigate = useNavigate()
  return (
    <div className='flex min-h-dvh w-full flex-col bg-[var(--core-color-surface-canvas)] pb-5 pt-6 text-foreground'>
      <div className='relative flex justify-between px-10'>
        <button
          aria-label='Middesk Home'
          className='-ml-3 flex items-center'
          onClick={() => navigate('/businesses')}
          type='button'
        >
          <MiddeskMark className='h-[22px] w-10' />
        </button>
        <button aria-label='close' onClick={close} type='button'>
          <X aria-hidden='true' size={26} strokeWidth={1.5} />
        </button>
      </div>
      <div className='mt-4 flex flex-col items-center px-4'>
        <div className='w-full max-w-[550px]'>{children}</div>
      </div>
    </div>
  )
}

export const Title = ({ children }: { children: ReactNode }) => (
  <h1 className='mb-1 font-arizona text-[1.875rem] font-normal leading-tight'>{children}</h1>
)

export const SubTitle = ({ children }: { children: ReactNode }) => (
  <div className='mb-4 text-base'>{children}</div>
)

/** A bordered card with a bold title, as the order flow's `StyledCard`. */
export const OrderCard = ({
  title,
  children,
  className
}: {
  title?: ReactNode
  children?: ReactNode
  className?: string
}) => (
  <div
    className={cn(
      'mb-4 grid gap-4 rounded-card border border-border bg-card px-6 py-5 [&_label]:text-base',
      className
    )}
  >
    {title && <b className='flex items-center justify-between gap-3'>{title}</b>}
    {children}
  </div>
)

export const OrderLabel = ({
  children,
  disabled
}: {
  children: ReactNode
  disabled?: boolean
}) => (
  <div
    className={cn(
      'text-base font-normal leading-normal',
      disabled ? 'text-[var(--core-color-text-disabled)]' : 'text-foreground'
    )}
  >
    {children}
  </div>
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

/** A field and its delete button side by side; the last row offers another. */
export const Row = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div
    className={cn(
      'grid grid-cols-[100%_min-content] items-end gap-x-2 [&:not(:last-of-type)]:mb-1',
      className
    )}
  >
    {children}
  </div>
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
    {children}
    {canDelete ? (
      <button aria-label={deleteAriaLabel} className='mb-3 p-1' onClick={onDelete} type='button'>
        <X aria-hidden='true' size={16} />
      </button>
    ) : (
      <div />
    )}
    {isLast && (
      <button className='mb-2 justify-self-start text-left' onClick={onAdd} type='button'>
        <LinkText>{addButtonText}</LinkText>
      </button>
    )}
  </>
)
