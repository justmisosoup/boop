import React from 'react'

import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  ChevronsUpDown,
  Minus
} from 'lucide-react'

import { cn } from '@/utils/twUtils'

/**
 * Content-chrome primitives — the page-level shell that lives inside
 * `AppShellMain`, below the topbar: a page header (eyebrow breadcrumb with
 * switchers + title + actions + description), a filter/search toolbar, and
 * metric cards with deltas. Built on the same Radix + CVA + `--core-*` token
 * grammar as `AppShell`/`TabsPrimitive` so it's theme-aware in light and dark.
 *
 * The tab bar is intentionally NOT re-implemented here: compose the existing
 * `Tabs`/`TabsList`/`TabsTrigger`/`TabsCount` from `TabsPrimitive` inside a
 * `PageHeader` (see the `…/design-system/chrome` preview).
 *
 * Buttons fight the app's *unlayered* global reset (`button { background:
 * transparent; border: 0; color: inherit; margin: 0; padding: 0 }` in
 * index.css). Unlayered rules beat Tailwind's layered utilities regardless of
 * specificity, so any bg/border/text/padding we want on a real <button> is
 * written with `!` (important) — same approach as `AppShell`. The page heading
 * renders as `role="heading"` on a <div> to sidestep the equally-unlayered
 * `h1 { font-size: 4em }` global without a pile of `!` overrides.
 */

/* ------------------------------------------------------------------ *
 * Page container
 * ------------------------------------------------------------------ */

const pageContainerVariants = cva('mx-auto w-full', {
  variants: {
    width: {
      full: 'max-w-none',
      wide: 'max-w-[1440px]',
      comfortable: 'max-w-[1200px]',
      narrow: 'max-w-[768px]'
    },
    padding: {
      none: '',
      page: 'px-6 py-6 md:px-8'
    }
  },
  defaultVariants: {
    width: 'full',
    padding: 'page'
  }
})

export type PageContainerProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof pageContainerVariants>

/** Centers + pads page content to a consistent rhythm. Optional glue. */
export const PageContainer = React.forwardRef<
  HTMLDivElement,
  PageContainerProps
>(({ className, padding, width, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(pageContainerVariants({ padding, width }), className)}
    {...props}
  />
))

PageContainer.displayName = 'PageContainer'

/* ------------------------------------------------------------------ *
 * Page header
 * ------------------------------------------------------------------ */

export type PageHeaderProps = React.HTMLAttributes<HTMLElement>

/** Vertical header block: breadcrumb → title row → description → (tabs). */
export const PageHeader = React.forwardRef<HTMLElement, PageHeaderProps>(
  ({ className, ...props }, ref) => (
    <header
      ref={ref}
      className={cn('flex flex-col gap-3', className)}
      {...props}
    />
  )
)

PageHeader.displayName = 'PageHeader'

export type PageHeaderBandProps = React.HTMLAttributes<HTMLDivElement>

/**
 * The standard top band for a content-chrome page: it anchors the `PageHeader`
 * so the page title's optical center lands on the same line as the sidebar
 * search/⌘K rail icon. Use it on every content-chrome page so the header sits in
 * the SAME place as the user navigates — it never jumps between pages.
 *
 * Render it as the page's first element, flush to the top of the content column
 * (directly below the topbar). If the page sits inside a wrapper that pads its
 * top (e.g. the settings layout), cancel that padding (a negative top margin) so
 * the band stays flush — the alignment depends on the band's top sitting at the
 * content-column top.
 */
export const PageHeaderBand = React.forwardRef<
  HTMLDivElement,
  PageHeaderBandProps
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    // pt-0.5 (2px) lands the lg title's 28px line center on the rail-icon line
    // (topbar height + 16px to the icon center); px-6 is the standard page
    // gutter. Override the gutter (px-0) when an outer wrapper already provides
    // it.
    className={cn('px-6 pt-0.5', className)}
    {...props}
  />
))

PageHeaderBand.displayName = 'PageHeaderBand'

export type PageBreadcrumbProps = React.HTMLAttributes<HTMLElement> & {
  /** Separator rendered between items; defaults to a quiet chevron. */
  separator?: React.ReactNode
}

/**
 * Eyebrow breadcrumb. Auto-inserts a separator between children so consumers
 * just list `PageBreadcrumbItem` / `PageBreadcrumbSwitcher` segments.
 */
export const PageBreadcrumb = React.forwardRef<
  HTMLElement,
  PageBreadcrumbProps
>(({ children, className, separator, ...props }, ref) => {
  const items = React.Children.toArray(children).filter(Boolean)
  const divider = separator ?? (
    <ChevronRight
      aria-hidden='true'
      className='size-3.5 shrink-0 text-[var(--core-color-text-disabled)]'
      strokeWidth={1.5}
    />
  )

  return (
    <nav
      ref={ref}
      aria-label='Breadcrumb'
      className={cn(
        'flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground',
        className
      )}
      {...props}
    >
      {items.map((child, index) => (
        <React.Fragment key={index}>
          {index > 0 && divider}
          {child}
        </React.Fragment>
      ))}
    </nav>
  )
})

PageBreadcrumb.displayName = 'PageBreadcrumb'

export type PageBreadcrumbItemProps = React.HTMLAttributes<HTMLSpanElement> & {
  asChild?: boolean
  /** The current page (last crumb): foreground weight, marked aria-current. */
  current?: boolean
}

export const PageBreadcrumbItem = React.forwardRef<
  HTMLSpanElement,
  PageBreadcrumbItemProps
>(({ asChild = false, className, current = false, ...props }, ref) => {
  const Component = asChild ? Slot : 'span'

  return (
    <Component
      ref={ref}
      aria-current={current ? 'page' : undefined}
      className={cn(
        'min-w-0 truncate',
        current
          ? 'font-medium text-foreground'
          : 'text-muted-foreground transition-colors hover:text-foreground',
        className
      )}
      {...props}
    />
  )
})

PageBreadcrumbItem.displayName = 'PageBreadcrumbItem'

export type PageBreadcrumbSwitcherProps =
  React.ButtonHTMLAttributes<HTMLButtonElement>

/**
 * A breadcrumb segment that opens a switcher (business / workspace / env).
 * Renders a quiet button + up/down chevrons; wire it to a `Menu`/`Dropdown`
 * trigger or an `onClick`. `!` overrides beat the unlayered button reset.
 */
export const PageBreadcrumbSwitcher = React.forwardRef<
  HTMLButtonElement,
  PageBreadcrumbSwitcherProps
>(({ children, className, type = 'button', ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      '-mx-1 inline-flex min-w-0 items-center gap-1 rounded-md !px-1 !py-0.5',
      'font-medium !text-foreground transition-colors',
      'hover:!bg-[var(--core-color-state-hover-bg)]',
      'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
      className
    )}
    type={type}
    {...props}
  >
    <span className='min-w-0 truncate'>{children}</span>
    <ChevronsUpDown
      aria-hidden='true'
      className='size-3 shrink-0 text-muted-foreground'
      strokeWidth={1.5}
    />
  </button>
))

PageBreadcrumbSwitcher.displayName = 'PageBreadcrumbSwitcher'

export type PageHeaderBarProps = React.HTMLAttributes<HTMLDivElement>

/** Title row: titles on the left, actions on the right. */
export const PageHeaderBar = React.forwardRef<
  HTMLDivElement,
  PageHeaderBarProps
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    // items-start so tall action buttons don't stretch the title's baseline.
    className={cn('flex items-start justify-between gap-4', className)}
    {...props}
  />
))

PageHeaderBar.displayName = 'PageHeaderBar'

export type PageHeaderTitlesProps = React.HTMLAttributes<HTMLDivElement>

/** Left column of the title row: heading + (description). */
export const PageHeaderTitles = React.forwardRef<
  HTMLDivElement,
  PageHeaderTitlesProps
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex min-w-0 flex-col gap-1', className)}
    {...props}
  />
))

PageHeaderTitles.displayName = 'PageHeaderTitles'

const pageHeadingVariants = cva(
  'm-0 min-w-0 truncate tracking-tight text-foreground',
  {
    variants: {
      size: {
        lg: 'text-[1.375rem] leading-7',
        md: 'text-lg leading-7',
        sm: 'text-base leading-6'
      },
      // Title weight. `semibold` is the default emphatic heading; `normal`/
      // `medium` are calmer options for large, quiet page titles. Default keeps
      // every existing consumer byte-for-byte identical.
      weight: {
        normal: 'font-normal',
        medium: 'font-medium',
        semibold: 'font-semibold'
      }
    },
    defaultVariants: {
      size: 'lg',
      weight: 'semibold'
    }
  }
)

export type PageHeadingProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof pageHeadingVariants> & {
    /** ARIA heading level (1–3). Rendered on a div to escape global h1 CSS. */
    level?: 1 | 2 | 3
    /** Optional count pill beside the title (e.g. total rows). */
    count?: React.ReactNode
  }

export const PageHeading = React.forwardRef<HTMLDivElement, PageHeadingProps>(
  ({ children, className, count, level = 1, size, weight, ...props }, ref) => {
    const heading = (
      <div
        ref={ref}
        aria-level={level}
        className={cn(pageHeadingVariants({ size, weight }), className)}
        role='heading'
        {...props}
      >
        {children}
      </div>
    )

    if (count == null) return heading

    return (
      <div className='flex min-w-0 items-center gap-2.5'>
        {heading}
        <PageHeadingCount>{count}</PageHeadingCount>
      </div>
    )
  }
)

PageHeading.displayName = 'PageHeading'

export type PageHeadingCountProps = React.HTMLAttributes<HTMLSpanElement>

/** Neutral count pill that sits beside a `PageHeading`. */
export const PageHeadingCount = React.forwardRef<
  HTMLSpanElement,
  PageHeadingCountProps
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      'inline-flex h-[1.375rem] min-w-[1.375rem] shrink-0 items-center justify-center rounded-full px-1.5',
      'bg-[var(--core-color-state-selected-bg)] text-xs font-medium tabular-nums text-text-secondary',
      className
    )}
    {...props}
  />
))

PageHeadingCount.displayName = 'PageHeadingCount'

export type PageDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>

export const PageDescription = React.forwardRef<
  HTMLParagraphElement,
  PageDescriptionProps
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('m-0 max-w-prose text-sm text-muted-foreground', className)}
    {...props}
  />
))

PageDescription.displayName = 'PageDescription'

export type PageHeaderActionsProps = React.HTMLAttributes<HTMLDivElement>

export const PageHeaderActions = React.forwardRef<
  HTMLDivElement,
  PageHeaderActionsProps
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex shrink-0 items-center gap-2', className)}
    {...props}
  />
))

PageHeaderActions.displayName = 'PageHeaderActions'

/* ------------------------------------------------------------------ *
 * Toolbar
 * ------------------------------------------------------------------ */

export type ToolbarProps = React.HTMLAttributes<HTMLDivElement>

/** A row of filters / search / view controls above page content. */
export const Toolbar = React.forwardRef<HTMLDivElement, ToolbarProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex min-h-9 flex-wrap items-center gap-2', className)}
      {...props}
    />
  )
)

Toolbar.displayName = 'Toolbar'

export type ToolbarSectionProps = React.HTMLAttributes<HTMLDivElement>

/** A logical group of toolbar controls. Pair with `ToolbarSpacer`. */
export const ToolbarSection = React.forwardRef<
  HTMLDivElement,
  ToolbarSectionProps
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex min-w-0 items-center gap-2', className)}
    {...props}
  />
))

ToolbarSection.displayName = 'ToolbarSection'

export type ToolbarSpacerProps = React.HTMLAttributes<HTMLDivElement>

/** Flexible gap that pushes following toolbar sections to the right. */
export const ToolbarSpacer = React.forwardRef<
  HTMLDivElement,
  ToolbarSpacerProps
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex-1', className)}
    aria-hidden='true'
    {...props}
  />
))

ToolbarSpacer.displayName = 'ToolbarSpacer'

export type ToolbarSeparatorProps = React.HTMLAttributes<HTMLDivElement>

export const ToolbarSeparator = React.forwardRef<
  HTMLDivElement,
  ToolbarSeparatorProps
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    aria-orientation='vertical'
    className={cn(
      'mx-0.5 h-5 w-px shrink-0 bg-[var(--core-color-border-default)]',
      className
    )}
    role='separator'
    {...props}
  />
))

ToolbarSeparator.displayName = 'ToolbarSeparator'

export type ToolbarCountProps = React.HTMLAttributes<HTMLParagraphElement>

/** Quiet result summary, e.g. "128 businesses". Uses tabular figures. */
export const ToolbarCount = React.forwardRef<
  HTMLParagraphElement,
  ToolbarCountProps
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn(
      'm-0 whitespace-nowrap text-sm tabular-nums text-muted-foreground',
      className
    )}
    {...props}
  />
))

ToolbarCount.displayName = 'ToolbarCount'

const toolbarButtonVariants = cva(
  [
    'inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-[var(--core-radius-action-standard)] !px-2.5 text-sm font-medium',
    'border border-transparent !text-text-secondary transition-colors',
    'hover:!bg-[var(--core-color-state-hover-bg)] hover:!text-foreground',
    'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
    'disabled:pointer-events-none disabled:opacity-50',
    // Open dropdown / popover reads like hover.
    'data-[state=open]:!bg-[var(--core-color-state-hover-bg)] data-[state=open]:!text-foreground'
  ],
  {
    variants: {
      // `active` = a filter is applied: a quiet selected pill so it stands out
      // from the unset controls without shouting.
      active: {
        true: '!border-[var(--core-color-state-selected-border)] !bg-[var(--core-color-state-selected-bg)] !text-foreground',
        false: ''
      }
    },
    defaultVariants: {
      active: false
    }
  }
)

export type ToolbarButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof toolbarButtonVariants> & {
    asChild?: boolean
    /** Leading icon (16px); rendered in a fixed icon box. */
    icon?: React.ReactNode
    /** Trailing icon, e.g. a `ChevronDown` for dropdown triggers. */
    trailingIcon?: React.ReactNode
  }

/**
 * Quiet toolbar control for filters / sort / view triggers. Transparent by
 * default, soft fill on hover/open, a quiet selected pill when `active` (a
 * filter is applied). Use `asChild` to render as a `Menu`/`Dropdown` trigger.
 */
export const ToolbarButton = React.forwardRef<
  HTMLButtonElement,
  ToolbarButtonProps
>(
  (
    {
      active,
      asChild = false,
      children,
      className,
      icon,
      trailingIcon,
      type,
      ...props
    },
    ref
  ) => {
    const Component = asChild ? Slot : 'button'

    return (
      <Component
        ref={ref}
        className={cn(toolbarButtonVariants({ active }), className)}
        data-active={active || undefined}
        type={asChild ? undefined : (type ?? 'button')}
        {...props}
      >
        {icon && (
          <span className='grid size-4 shrink-0 place-items-center'>
            {icon}
          </span>
        )}
        {children && <span className='min-w-0 truncate'>{children}</span>}
        {trailingIcon && (
          <span className='grid size-4 shrink-0 place-items-center text-muted-foreground'>
            {trailingIcon}
          </span>
        )}
      </Component>
    )
  }
)

ToolbarButton.displayName = 'ToolbarButton'

/* ------------------------------------------------------------------ *
 * Metric cards
 * ------------------------------------------------------------------ */

export type MetricCardGroupProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Target columns at the widest breakpoint (auto-responsive below). */
  columns?: 2 | 3 | 4
}

const metricColumns: Record<
  NonNullable<MetricCardGroupProps['columns']>,
  string
> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4'
}

/** Responsive grid of `MetricCard`s. */
export const MetricCardGroup = React.forwardRef<
  HTMLDivElement,
  MetricCardGroupProps
>(({ className, columns = 4, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('grid grid-cols-1 gap-3', metricColumns[columns], className)}
    {...props}
  />
))

MetricCardGroup.displayName = 'MetricCardGroup'

export type MetricCardProps = React.HTMLAttributes<HTMLDivElement> & {
  asChild?: boolean
  /** Top label, e.g. "Verified businesses". */
  label: React.ReactNode
  /** The headline figure. */
  value: React.ReactNode
  /** Optional delta chip (use `MetricDelta`). */
  delta?: React.ReactNode
  /** Quiet caption under the value, e.g. "vs. last 30 days". */
  caption?: React.ReactNode
  /** Optional trailing affordance in the label row (icon / menu). */
  icon?: React.ReactNode
}

/**
 * A single metric / KPI card: label, headline value, optional delta + caption.
 * `asChild` lets the whole card become a link; it gains a hover affordance.
 */
export const MetricCard = React.forwardRef<HTMLDivElement, MetricCardProps>(
  (
    {
      asChild = false,
      caption,
      className,
      delta,
      icon,
      label,
      value,
      ...props
    },
    ref
  ) => {
    const Component = asChild ? Slot : 'div'
    const interactive = asChild

    return (
      <Component
        ref={ref}
        className={cn(
          'flex flex-col gap-2 rounded-[var(--core-radius-card)] border border-border bg-card p-4 text-left',
          interactive &&
            'transition-colors hover:border-[var(--core-color-border-strong)] hover:bg-[var(--core-color-state-hover-bg)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
          className
        )}
        {...props}
      >
        <div className='flex items-center justify-between gap-2'>
          <span className='min-w-0 truncate text-sm font-medium text-muted-foreground'>
            {label}
          </span>
          {icon && (
            <span className='grid size-4 shrink-0 place-items-center text-muted-foreground'>
              {icon}
            </span>
          )}
        </div>
        <div className='flex-wrap items-end gap-2'>
          <span className='text-[1.75rem] font-semibold leading-none tabular-nums text-foreground'>
            {value}
          </span>
          {delta}
        </div>
        {caption && (
          <span className='text-xs text-muted-foreground'>{caption}</span>
        )}
      </Component>
    )
  }
)

MetricCard.displayName = 'MetricCard'

const metricDeltaVariants = cva(
  'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums',
  {
    variants: {
      tone: {
        positive:
          'bg-[var(--core-color-status-success-bg)] text-[var(--core-color-status-success-fg)]',
        negative:
          'bg-[var(--core-color-status-danger-bg)] text-[var(--core-color-status-danger-fg)]',
        neutral:
          'bg-[var(--core-color-status-neutral-bg)] text-[var(--core-color-status-neutral-fg)]'
      }
    },
    defaultVariants: {
      tone: 'neutral'
    }
  }
)

export type MetricDeltaProps = Omit<
  React.HTMLAttributes<HTMLSpanElement>,
  'children'
> &
  VariantProps<typeof metricDeltaVariants> & {
    /** Direction of the trend; drives the icon. Defaults from `tone`. */
    direction?: 'up' | 'down' | 'flat'
    /** The delta value, e.g. "12%" or "+340". */
    children: React.ReactNode
  }

/**
 * A trend chip for a `MetricCard`: a tinted pill with a direction arrow.
 * `tone` colors it (positive/negative/neutral); `direction` picks the arrow
 * (defaults to match the tone) so "down is good" cases can still read green.
 */
export const MetricDelta = React.forwardRef<HTMLSpanElement, MetricDeltaProps>(
  ({ children, className, direction, tone = 'neutral', ...props }, ref) => {
    const resolved =
      direction ??
      (tone === 'positive' ? 'up' : tone === 'negative' ? 'down' : 'flat')
    const Arrow =
      resolved === 'up' ? ArrowUp : resolved === 'down' ? ArrowDown : Minus

    return (
      <span
        ref={ref}
        className={cn(metricDeltaVariants({ tone }), className)}
        {...props}
      >
        <Arrow
          aria-hidden='true'
          className='size-3 shrink-0'
          strokeWidth={2.5}
        />
        {children}
      </span>
    )
  }
)

MetricDelta.displayName = 'MetricDelta'
