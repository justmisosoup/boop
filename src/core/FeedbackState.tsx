import type React from 'react'

import {
  CircleAlert,
  CircleCheck,
  Info,
  type LucideIcon,
  TriangleAlert,
  X
} from 'lucide-react'
import styled, { keyframes } from 'styled-components'

import { cn } from '@/utils/twUtils'

import { ActionButton, IconActionButton } from './Action'
import { useCoreThemeFallback } from './useCoreThemeFallback'

export type FeedbackTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

const toneToStatus: Record<FeedbackTone, string> = {
  neutral: 'neutral',
  info: 'info',
  success: 'success',
  warning: 'warning',
  danger: 'danger'
}

// Canonical tone → icon. Pairs the semantic colour with a distinct shape so an
// alert's meaning never rides on colour alone (WCAG 1.4.1).
const toneToIcon: Record<FeedbackTone, LucideIcon> = {
  neutral: Info,
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleAlert
}

type AlertSize = 'compact' | 'standard'

const AlertRoot = styled.div<{ $tone: FeedbackTone; $size: AlertSize }>`
  --core-alert-fg: ${({ $tone }) =>
    `var(--core-color-status-${toneToStatus[$tone]}-fg)`};
  /* Tint-aware dismiss hover: the tone's border reads as a subtle step on the
     tinted bg, where the quiet action's neutral hover would clash. */
  --core-alert-dismiss-hover: ${({ $tone }) =>
    `var(--core-color-status-${toneToStatus[$tone]}-border)`};

  align-items: flex-start;
  background: ${({ $tone }) =>
    `var(--core-color-status-${toneToStatus[$tone]}-bg)`};
  border: 1px solid
    ${({ $tone }) => `var(--core-color-status-${toneToStatus[$tone]}-border)`};
  border-radius: var(--core-radius-card);
  color: var(--core-color-text-primary);
  display: flex;
  gap: ${({ $size }) =>
    $size === 'compact' ? 'var(--core-spacing-xs)' : 'var(--core-spacing-sm)'};
  padding: ${({ $size }) =>
    $size === 'compact' ? 'var(--core-spacing-sm)' : 'var(--core-spacing-md)'};
`
const AlertIcon = styled.span`
  align-items: center;
  color: var(--core-alert-fg);
  display: inline-flex;
  flex: 0 0 auto;
  /* optical nudge so the glyph sits on the first line of text */
  margin-top: 1px;
`
const AlertContent = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: var(--core-spacing-xs);
  min-width: 0;
`
const Title = styled.h3<{ $size?: AlertSize }>`
  color: var(--core-alert-fg, var(--core-color-text-primary));
  font-size: ${({ $size }) =>
    $size === 'compact'
      ? 'var(--core-font-size-sm)'
      : 'var(--core-font-size-md)'};
  font-weight: var(--core-font-weight-bold);
  line-height: 1.4;
  margin: 0;
`
const Body = styled.p`
  /* Explicit — a global \`p\` colour would otherwise beat the inherited alert
     colour and leave the body unreadable on the dark tint. */
  color: var(--core-color-text-primary);
  font-size: var(--core-font-size-sm);
  line-height: 1.5;
  margin: 0;
  overflow-wrap: anywhere;
`
const AlertActions = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: var(--core-spacing-sm);
  margin-top: var(--core-spacing-xs);
`
const DismissSlot = styled.div`
  flex: 0 0 auto;
  margin-left: var(--core-spacing-xs);
`
const DismissButton = styled(IconActionButton)`
  /* Swap the quiet action's neutral hover/active for the tone-tinted value set
     on the alert root, so it blends with the coloured bg instead of clashing. */
  &&& {
    --core-action-hover-bg: var(--core-alert-dismiss-hover);
    --core-action-active-bg: var(--core-alert-dismiss-hover);
  }
`

export type InlineAlertProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Bold heading line. Optional — omit for a single-line message. */
  title?: React.ReactNode
  /** Body / message content. */
  children?: React.ReactNode
  /** Semantic tone; also drives the status icon and colour. */
  tone?: FeedbackTone
  /** Density. `standard` (default) or `compact` for dense contexts. */
  size?: AlertSize
  /**
   * Show the tone's status icon. Off by default so existing usages are
   * unchanged; opt in for the fuller banner treatment.
   */
  showIcon?: boolean
  /** Custom leading icon; overrides the tone default and implies `showIcon`. */
  icon?: React.ReactNode
  /** Optional actions, rendered under the message. Keep to one primary. */
  actions?: React.ReactNode
  /** When set, renders a dismiss button that calls this handler. */
  onDismiss?: () => void
  /** Accessible label for the dismiss button. */
  dismissLabel?: string
  /**
   * Live-region role. Defaults to `alert` for `danger`, `status` otherwise.
   * `alert` announces assertively — reserve it for urgent, dynamic messages.
   */
  role?: 'status' | 'alert'
}

export const InlineAlert = ({
  actions,
  children,
  className,
  dismissLabel = 'Dismiss',
  icon,
  onDismiss,
  role,
  showIcon = false,
  size = 'standard',
  title,
  tone = 'info',
  ...props
}: InlineAlertProps) => {
  // Self-scope `.core-theme` so the `--core-*` tokens resolve even on legacy
  // routes that lack a themed ancestor; a no-op once one exists.
  const [rootRef, applyFallback] = useCoreThemeFallback<HTMLDivElement>()
  const ToneIcon = toneToIcon[tone]
  const iconSize = size === 'compact' ? 16 : 18
  const iconNode =
    icon ?? (showIcon ? <ToneIcon size={iconSize} strokeWidth={1.75} /> : null)

  return (
    <AlertRoot
      $size={size}
      $tone={tone}
      className={cn('core-alert', applyFallback && 'core-theme', className)}
      ref={rootRef}
      role={role ?? (tone === 'danger' ? 'alert' : 'status')}
      {...props}
    >
      {iconNode && <AlertIcon aria-hidden>{iconNode}</AlertIcon>}
      <AlertContent>
        {title && <Title $size={size}>{title}</Title>}
        {children && <Body>{children}</Body>}
        {actions && <AlertActions>{actions}</AlertActions>}
      </AlertContent>
      {onDismiss && (
        <DismissSlot>
          <DismissButton
            aria-label={dismissLabel}
            onClick={onDismiss}
            size='compact'
            variant='quiet'
          >
            <X size={16} strokeWidth={1.75} />
          </DismissButton>
        </DismissSlot>
      )}
    </AlertRoot>
  )
}

const StateRoot = styled.div`
  align-items: center;
  background: var(--core-color-surface-card);
  border: 1px solid var(--core-color-border-default);
  border-radius: var(--core-radius-card);
  color: var(--core-color-text-primary);
  display: grid;
  gap: var(--core-spacing-sm);
  justify-items: center;
  min-height: 180px;
  padding: var(--core-spacing-xl);
  text-align: center;
`
const StateText = styled.p`
  color: var(--core-color-text-secondary);
  font-size: var(--core-font-size-md);
  line-height: 1.5;
  margin: 0;
  max-width: 44ch;
`
export type EmptyStateProps = React.HTMLAttributes<HTMLDivElement> & {
  title: React.ReactNode
  description?: React.ReactNode
  actionLabel?: string
  onAction?: () => void
}

export const EmptyState = ({
  actionLabel,
  className,
  description,
  onAction,
  title,
  ...props
}: EmptyStateProps) => (
  <StateRoot className={cn('core-feedback-state', className)} {...props}>
    <Title>{title}</Title>
    {description && <StateText>{description}</StateText>}
    {actionLabel && onAction && (
      <ActionButton onClick={onAction} variant='secondary'>
        {actionLabel}
      </ActionButton>
    )}
  </StateRoot>
)

export type ErrorStateProps = EmptyStateProps & {
  recoverLabel?: string
}

export const ErrorState = ({
  actionLabel = 'Try again',
  recoverLabel,
  ...props
}: ErrorStateProps) => (
  <EmptyState actionLabel={recoverLabel ?? actionLabel} {...props} />
)

const shimmer = keyframes`
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
`
export const Skeleton = styled.div`
  animation: ${shimmer} 3.2s ease-in-out infinite;
  background: linear-gradient(
    90deg,
    var(--core-color-surface-subtle) 25%,
    var(--core-color-surface-default) 50%,
    var(--core-color-surface-subtle) 75%
  );
  background-size: 200% 100%;
  border-radius: var(--core-radius-control);
  height: 12px;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`
const LoadingRoot = styled.div`
  display: grid;
  gap: var(--core-spacing-xs);
`
export type LoadingRegionProps = React.HTMLAttributes<HTMLDivElement> & {
  label?: string
  rows?: number
}

export const LoadingRegion = ({
  className,
  label = 'Loading',
  rows = 3,
  ...props
}: LoadingRegionProps) => (
  <LoadingRoot
    aria-busy='true'
    aria-live='polite'
    className={cn('core-loading-region', className)}
    role='status'
    {...props}
  >
    <span>{label}</span>
    {Array.from({ length: rows }).map((_, index) => (
      <Skeleton
        className='core-skeleton'
        key={index}
        style={{ width: `${[100, 92, 76, 88][index % 4]}%` }}
      />
    ))}
  </LoadingRoot>
)
