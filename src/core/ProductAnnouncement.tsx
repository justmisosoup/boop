import type React from 'react'

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  X
} from 'lucide-react'

import { cn } from '@/utils/twUtils'

import { ActionLink, IconActionButton } from './Action'
import { Heading, Surface, Text } from './Surface'

export type ProductAnnouncementCtaConfig = {
  label: string
  href: string
  variant?: 'primary' | 'secondary'
}

type AnnouncementCtaProps = {
  cta: ProductAnnouncementCtaConfig
  size?: 'compact' | 'standard'
  /** Brand-lime treatment on the invariant accent tokens. */
  accent?: boolean
  className?: string
  onClick?: () => void
}

const AnnouncementCta = ({
  accent = false,
  className,
  cta,
  onClick,
  size = 'compact'
}: AnnouncementCtaProps) => (
  <ActionLink
    className={cn(
      // The bangs beat the `.core-theme .core-action-*` color rules. The
      // accent pair is theme-invariant (lime never flips modes), so this
      // reads the same inside light and dark scopes.
      accent &&
        '!border-transparent !bg-brand-accent !text-brand-on-accent hover:opacity-90',
      className
    )}
    href={cta.href}
    rel='noopener noreferrer'
    size={size}
    target='_blank'
    trailingIcon={<ExternalLink aria-hidden className='size-3' />}
    variant={cta.variant ?? 'secondary'}
    onClick={onClick}
  >
    {cta.label}
  </ActionLink>
)

export type ProductAnnouncementPagerProps = {
  count: number
  index: number
  onSelect: (index: number) => void
}

const pagerStepClasses =
  'flex size-4 cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-0 transition-opacity hover:opacity-80'

/** Prev/next arrows around a "1/3" position count, overlaid in the announcement
 * image's bottom-right corner and wrapping around the running announcements.
 * Renders nothing with a single announcement. White is image-relative, matching
 * the modal's close chip. */
const AnnouncementPager = ({
  count,
  index,
  onSelect
}: ProductAnnouncementPagerProps) => {
  if (count < 2) return null

  return (
    <div className='absolute bottom-2 right-2 flex items-center gap-0.5 rounded-full bg-[var(--core-color-overlay-backdrop)] px-1.5 py-1 text-white backdrop-blur-sm'>
      <button
        aria-label='Previous announcement'
        className={pagerStepClasses}
        type='button'
        onClick={() => onSelect((index - 1 + count) % count)}
      >
        <ChevronLeft aria-hidden size={12} strokeWidth={2} />
      </button>
      <span className='text-[10px] font-medium leading-none tabular-nums'>
        {index + 1}/{count}
      </span>
      <button
        aria-label='Next announcement'
        className={pagerStepClasses}
        type='button'
        onClick={() => onSelect((index + 1) % count)}
      >
        <ChevronRight aria-hidden size={12} strokeWidth={2} />
      </button>
    </div>
  )
}

export type ProductAnnouncementNavProps = {
  /** Bold lead-in; also all the card shows in its collapsed state. */
  title?: React.ReactNode
  imageSrc?: string
  imageAlt?: string
  children?: React.ReactNode
  cta: ProductAnnouncementCtaConfig
  variant?: 'card' | 'inset' | 'raised'
  /** The theme the card renders in — self-scoped, so pass the opposite of
   * the app's mode to make the card pop against the chrome. */
  themeMode?: 'light' | 'dark'
  /** Paging through simultaneously running announcements; overlays the image. */
  pager?: ProductAnnouncementPagerProps
  /** When the rail runs out of room, the caller passes this to shrink the
   * card to its title row with a chevron that pops the full card back open.
   * Expansion is one-way: once popped open there is no collapse control. */
  collapse?: { isCollapsed: boolean; onExpand: () => void }
  onDismiss?: () => void
  onCtaClick?: () => void
  className?: string
}

const NavAnnouncement = ({
  children,
  className,
  collapse,
  cta,
  imageAlt = '',
  imageSrc,
  onCtaClick,
  onDismiss,
  pager,
  themeMode,
  title,
  variant = 'inset'
}: ProductAnnouncementNavProps) => (
  <Surface
    className={cn(
      // grid-cols-[minmax(0,1fr)] pins the single track to the available
      // width: no child's min-content (a long nowrap CTA label, an unbroken
      // word) can ever widen the card — content shrinks or wraps instead.
      // overflow-hidden clips any residue at the card's rounded edge.
      'core-theme grid grid-cols-[minmax(0,1fr)] gap-[var(--core-spacing-sm)] overflow-hidden',
      className
    )}
    data-theme={themeMode === 'dark' ? 'dark' : undefined}
    padding='sm'
    variant={variant}
  >
    {collapse?.isCollapsed ? (
      <div className='flex items-center gap-1'>
        <Text className='min-w-0 flex-1 truncate font-semibold' size='sm'>
          {title}
        </Text>
        <IconActionButton
          aria-label='Expand announcement'
          className='!rounded-full'
          title='Expand'
          variant='quiet'
          onClick={collapse.onExpand}
        >
          <ChevronDown aria-hidden size={14} strokeWidth={1.75} />
        </IconActionButton>
      </div>
    ) : (
      <>
        {imageSrc && (
          <div className='relative'>
            <img
              alt={imageAlt}
              className='h-24 w-full rounded-md bg-white object-cover'
              src={imageSrc}
            />
            {pager && <AnnouncementPager {...pager} />}
          </div>
        )}
        {(title || children) && (
          <Text
            className={cn(
              'line-clamp-4',
              // With several announcements paging, reserve the full four lines
              // (text-sm line-height is 1.25rem) so the card height never
              // jumps between announcements with different copy lengths.
              pager && pager.count > 1 && 'min-h-20'
            )}
            size='sm'
          >
            {title && <span className='font-semibold'>{title}</span>}
            {title && children && ' '}
            {children}
          </Text>
        )}
        {/* min-w-0: without it, a long nowrap CTA label sets this grid
            item's min-content width and widens the whole track — every
            sibling (image included) stretches with it while paging. */}
        <div className='flex min-w-0 items-center gap-1'>
          <AnnouncementCta
            accent
            className='min-w-0 flex-1'
            cta={cta}
            onClick={onCtaClick}
          />
          {onDismiss && (
            <IconActionButton
              aria-label='Dismiss announcement'
              className='!rounded-full'
              title='Dismiss'
              variant='quiet'
              onClick={onDismiss}
            >
              <X aria-hidden size={14} strokeWidth={1.75} />
            </IconActionButton>
          )}
        </div>
      </>
    )}
  </Surface>
)

export type ProductAnnouncementBodyProps = {
  /** Header line, rendered above the body copy. */
  title?: React.ReactNode
  children?: React.ReactNode
  cta: ProductAnnouncementCtaConfig
  imageSrc?: string
  imageAlt?: string
  /** Left inset matching the nav rail width, so the card centers over the
   * content column rather than the full viewport. Only the centered 'bottom'
   * placement uses it. */
  insetLeft?: string
  /** Where the card is fixed (default 'top'). 'top' settles under the
   * topbar's trailing-actions corner; 'bottom-right' settles above the
   * assistant launcher pill; 'bottom' centers over the content column. */
  placement?: 'top' | 'bottom' | 'bottom-right'
  /** bottom-right only: whether the assistant launcher pill is on screen.
   * The card is only elevated off the bottom when something actually sits
   * below it; otherwise (the default) it keeps the same inset from the
   * bottom as from the right edge. */
  launcherPresent?: boolean
  /** The theme the card renders in — self-scoped. */
  themeMode?: 'light' | 'dark'
  /** Paging through simultaneously running announcements; overlays the image. */
  pager?: ProductAnnouncementPagerProps
  onDismiss?: () => void
  onCtaClick?: () => void
  className?: string
}

const BodyAnnouncement = ({
  children,
  className,
  cta,
  imageAlt = '',
  imageSrc,
  insetLeft = '0px',
  launcherPresent = false,
  onCtaClick,
  onDismiss,
  pager,
  placement = 'top',
  themeMode,
  title
}: ProductAnnouncementBodyProps) => (
  <div
    className={cn(
      'core-theme pointer-events-none fixed z-floating flex',
      'animate-in fade-in duration-standard ease-emphasized motion-reduce:animate-none',
      // Under the topbar's trailing corner (topbar is 58px tall; top-20
      // leaves a 22px gap on the spacing scale). Banners above the topbar
      // push it down while this stays viewport-fixed.
      placement === 'top' && 'right-6 top-20 justify-end slide-in-from-top-4',
      placement === 'bottom' &&
        'bottom-6 right-0 justify-center slide-in-from-bottom-4',
      // Above the assistant launcher: its pill is fixed at bottom-6 right-6
      // and h-10 (FloatingPanel), so bottom-20 clears it with a 16px gap on
      // the spacing scale. When the launcher isn't rendered, take its
      // corner spot instead.
      placement === 'bottom-right' &&
        (launcherPresent
          ? 'bottom-20 right-6 justify-end slide-in-from-bottom-4'
          : 'bottom-6 right-6 justify-end slide-in-from-bottom-4')
    )}
    data-theme={themeMode === 'dark' ? 'dark' : undefined}
    style={placement === 'bottom' ? { left: insetLeft } : undefined}
  >
    <Surface
      asChild
      className={cn(
        // Fixed w-80 plus overflow-hidden: no announcement's copy can change
        // the card's geometry — content shrinks or wraps inside it.
        'pointer-events-auto flex w-80 max-w-[calc(100vw-32px)] flex-col gap-[var(--core-spacing-sm)] overflow-hidden',
        // Keep the raised variant's elevation but take the card surface
        // color, so this matches the nav announcement's midnight in dark (raised
        // is a step lighter there).
        'bg-surface-card',
        className
      )}
      padding='md'
      variant='raised'
    >
      <aside aria-label='Announcement'>
        {imageSrc && (
          <div className='relative'>
            <img
              alt={imageAlt}
              className='h-28 w-full rounded-md bg-white object-cover'
              src={imageSrc}
            />
            {pager && <AnnouncementPager {...pager} />}
          </div>
        )}
        <div className='grid gap-0.5'>
          {title && (
            <Heading
              className={cn(
                'text-caption',
                // With several announcements paging, pin the title to one line
                // and reserve two copy lines (text-sm line-height is
                // 1.25rem) so the card height never jumps.
                pager && pager.count > 1 && 'truncate'
              )}
              level={4}
            >
              {title}
            </Heading>
          )}
          {children && (
            <Text
              className={cn(
                pager && pager.count > 1 && 'line-clamp-2 min-h-10'
              )}
              size='sm'
            >
              {children}
            </Text>
          )}
        </div>
        <div className='flex min-w-0 items-center gap-1'>
          <AnnouncementCta
            accent
            className='min-w-0 flex-1'
            cta={cta}
            onClick={onCtaClick}
          />
          {onDismiss && (
            <IconActionButton
              aria-label='Dismiss announcement'
              className='!rounded-full'
              title='Dismiss'
              variant='quiet'
              onClick={onDismiss}
            >
              <X aria-hidden size={14} strokeWidth={1.75} />
            </IconActionButton>
          )}
        </div>
      </aside>
    </Surface>
  </div>
)

export type ProductAnnouncementBannerProps = {
  /** Bold lead-in; the body copy (children) renders after it. */
  title?: React.ReactNode
  children?: React.ReactNode
  cta: ProductAnnouncementCtaConfig
  onDismiss?: () => void
  onCtaClick?: () => void
  className?: string
}

const BannerAnnouncement = ({
  children,
  className,
  cta,
  onCtaClick,
  onDismiss,
  title
}: ProductAnnouncementBannerProps) => (
  // The strip is brand-dark in both app themes, so it self-scopes dark and
  // takes the same card surface as the other announcement displays.
  <aside
    aria-label='Announcement'
    className={cn(
      'core-theme flex min-h-11 items-center justify-between gap-4 bg-surface-card py-1.5 pl-6 pr-10 text-foreground',
      className
    )}
    data-theme='dark'
  >
    {/* One line, always: the title and pill hold their size and the copy
        truncates when the viewport runs short. */}
    <div className='flex min-w-0 items-center gap-2 text-sm font-semibold'>
      <span className='shrink-0 whitespace-nowrap'>{title}</span>
      {children && (
        <span className='min-w-0 truncate font-normal'>{children}</span>
      )}
      <AnnouncementCta
        accent
        className='shrink-0 !rounded-full'
        cta={cta}
        onClick={onCtaClick}
      />
    </div>
    {onDismiss && (
      <IconActionButton
        aria-label='Dismiss banner'
        className='shrink-0 !rounded-full'
        title='Dismiss'
        variant='quiet'
        onClick={onDismiss}
      >
        <X aria-hidden size={14} strokeWidth={1.75} />
      </IconActionButton>
    )}
  </aside>
)

/** One product-announcement component, three displays — discriminated on `display`, so
 * each surface's specific props (e.g. the body card's insetLeft) only
 * type-check on the display they belong to. Announcement
 * content, dismissal persistence, and analytics stay with the caller — every
 * display here is presentational. */
export type ProductAnnouncementProps =
  | ({ display: 'nav' } & ProductAnnouncementNavProps)
  | ({ display: 'body' } & ProductAnnouncementBodyProps)
  | ({ display: 'banner' } & ProductAnnouncementBannerProps)

export const ProductAnnouncement = (props: ProductAnnouncementProps) => {
  switch (props.display) {
    case 'nav': {
      const { display: _display, ...navProps } = props
      return <NavAnnouncement {...navProps} />
    }
    case 'body': {
      const { display: _display, ...bodyProps } = props
      return <BodyAnnouncement {...bodyProps} />
    }
    case 'banner': {
      const { display: _display, ...bannerProps } = props
      return <BannerAnnouncement {...bannerProps} />
    }
  }
}

ProductAnnouncement.displayName = 'ProductAnnouncement'
