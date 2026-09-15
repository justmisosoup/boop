import React from 'react'

import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/utils/twUtils'

type ToneFamily =
  | 'status'
  | 'risk'
  | 'workflow'
  | 'outcome'
  | 'confidence'
  | 'evidence'

type BadgeSize = 'compact' | 'standard'

const badgeVariants = cva(
  [
    'core-badge inline-flex items-center whitespace-nowrap border border-solid',
    'gap-1 font-medium leading-none',
    'bg-[var(--core-badge-bg)] text-[var(--core-badge-fg)]',
    'border-[var(--core-badge-border)]'
  ],
  {
    variants: {
      size: {
        compact: 'core-badge-compact',
        standard: 'core-badge-standard'
      }
    },
    defaultVariants: {
      size: 'compact'
    }
  }
)

const badgeStyle = (family: ToneFamily, tone: string) =>
  ({
    '--core-badge-bg': `var(--core-color-${family}-${tone}-bg)`,
    '--core-badge-fg': `var(--core-color-${family}-${tone}-fg)`,
    '--core-badge-border': `var(--core-color-${family}-${tone}-border)`
  }) as React.CSSProperties

export type BadgeBaseProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants> & {
    children: React.ReactNode
    size?: BadgeSize
  }

const Badge = React.forwardRef<
  HTMLSpanElement,
  BadgeBaseProps & { family: ToneFamily; tone: string }
>(
  (
    { children, className, family, size = 'compact', style, tone, ...props },
    ref
  ) => (
    <span
      ref={ref}
      className={cn(badgeVariants({ size }), className)}
      style={{ ...badgeStyle(family, tone), ...style }}
      {...props}
    >
      {children}
    </span>
  )
)

Badge.displayName = 'Badge'

export type MetaChipTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

/**
 * MetaChip sizes. `compact`/`standard` carry the roomier chip padding; `xs`
 * renders at the base status-badge size (10px / 20px) so a free-tone status chip
 * can sit inline next to `EntityStateBadge` in a dense table or row.
 */
export type MetaChipSize = 'xs' | 'compact' | 'standard'

/**
 * Static key/value or status chip. Defaults to `standard`; reach for
 * `size='compact'` in dense surfaces (table rows, toolbars) where the standard
 * size reads too large, or `size='xs'` to match the small status badges.
 */
export const MetaChip = ({
  className,
  size = 'standard',
  tone = 'neutral',
  ...props
}: Omit<BadgeBaseProps, 'size'> & {
  tone?: MetaChipTone
  size?: MetaChipSize
}) => (
  <Badge
    // `xs` drops the `.core-chip` padding bump and renders at the base badge
    // size; `compact`/`standard` keep the chip sizing.
    className={size === 'xs' ? className : cn('core-chip', className)}
    family='status'
    size={size === 'xs' ? 'compact' : size}
    tone={tone}
    {...props}
  />
)

export type EntityState =
  | 'active'
  | 'inactive'
  | 'open'
  | 'closed'
  | 'processing'
  | 'unknown'
  | 'indeterminate'
  | 'not_found'

const entityStateTone: Record<EntityState, MetaChipTone> = {
  active: 'success',
  inactive: 'warning',
  open: 'warning',
  closed: 'success',
  processing: 'info',
  unknown: 'neutral',
  indeterminate: 'neutral',
  not_found: 'neutral'
}

export const EntityStateBadge = ({
  state,
  ...props
}: BadgeBaseProps & { state: EntityState }) => (
  <Badge family='status' tone={entityStateTone[state]} {...props} />
)

export type RiskSeverity =
  | 'none'
  | 'low'
  | 'moderate'
  | 'high'
  | 'critical'
  | 'unknown'

export const toRiskSeverity = (
  value: string | null | undefined
): RiskSeverity => {
  const normalized = (value ?? '').toLowerCase().replace(/[\s_-]+/g, ' ')

  if (['none', 'no findings', 'expected'].includes(normalized)) return 'none'
  if (normalized === 'low') return 'low'
  if (['medium', 'moderate', 'elevated'].includes(normalized)) {
    return 'moderate'
  }
  if (normalized === 'high') return 'high'
  if (normalized === 'critical') return 'critical'

  return 'unknown'
}

export const RiskSeverityBadge = ({
  severity,
  ...props
}: BadgeBaseProps & { severity: RiskSeverity }) => (
  <Badge family='risk' tone={severity} {...props} />
)

export const RiskDot = ({ severity }: { severity: RiskSeverity }) => (
  <span
    className='core-risk-dot inline-block rounded-full bg-[var(--core-risk-dot-bg)]'
    style={{
      '--core-risk-dot-bg': `var(--core-color-risk-${severity}-fg)`
    } as React.CSSProperties}
  />
)

export type WorkflowStatus =
  | 'draft'
  | 'preview'
  | 'queued'
  | 'processing'
  | 'pending'
  | 'complete'
  | 'submitted'
  | 'disabled'
  | 'failed'

export const toWorkflowStatus = (
  value: string | null | undefined
): WorkflowStatus => {
  const normalized = (value ?? '').toLowerCase().replace(/[\s_-]+/g, ' ')

  if (['created', 'draft', 'unsearched'].includes(normalized)) return 'draft'
  if (['drafted', 'preview', 'in preview'].includes(normalized)) {
    return 'preview'
  }
  if (['queued', 'scheduled'].includes(normalized)) return 'queued'
  if (
    ['searching', 'importing', 'enriching', 'processing'].includes(normalized)
  ) {
    return 'processing'
  }
  if (['pending', 'in progress'].includes(normalized)) return 'pending'
  if (['completed', 'complete', 'enriched', 'done'].includes(normalized)) {
    return 'complete'
  }
  if (['submitted', 'active'].includes(normalized)) return 'submitted'
  if (['disabled', 'inactive'].includes(normalized)) return 'disabled'
  if (['failed', 'error'].includes(normalized)) return 'failed'

  return 'draft'
}

export const WorkflowStatusBadge = ({
  status,
  ...props
}: BadgeBaseProps & { status: WorkflowStatus }) => (
  <Badge family='workflow' tone={status} {...props} />
)

export type OutcomeSentiment = 'positive' | 'negative' | 'neutral'

export const toOutcomeSentiment = (
  value: string | null | undefined
): OutcomeSentiment => {
  const normalized = (value ?? '').toLowerCase().replace(/[\s_-]+/g, ' ')

  if (
    [
      'verified',
      'clear',
      'supported',
      'active',
      'approved',
      'positive'
    ].includes(normalized)
  ) {
    return 'positive'
  }

  if (
    [
      'unverified',
      'mismatch',
      'high risk',
      'prohibited',
      'unsupported',
      'negative',
      'escalate'
    ].includes(normalized)
  ) {
    return 'negative'
  }

  return 'neutral'
}

export const OutcomeBadge = ({
  sentiment,
  ...props
}: BadgeBaseProps & { sentiment: OutcomeSentiment }) => (
  <Badge family='outcome' tone={sentiment} {...props} />
)

export const VerificationOutcomeBadge = ({
  outcome,
  ...props
}: BadgeBaseProps & { outcome: string }) => (
  <OutcomeBadge sentiment={toOutcomeSentiment(outcome)} {...props} />
)

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'unavailable'

export const toConfidenceLevel = (
  value: string | null | undefined
): ConfidenceLevel => {
  const normalized = (value ?? '').toLowerCase()

  if (['high', 'strong'].includes(normalized)) return 'high'
  if (['medium', 'moderate'].includes(normalized)) return 'medium'
  if (['low', 'weak'].includes(normalized)) return 'low'

  return 'unavailable'
}

export const ConfidenceBadge = ({
  level,
  ...props
}: BadgeBaseProps & { level: ConfidenceLevel }) => (
  <Badge family='confidence' tone={level} {...props} />
)

export type EvidenceQuality = 'strong' | 'moderate' | 'weak' | 'unavailable'

export const toEvidenceQuality = (
  value: string | null | undefined
): EvidenceQuality => {
  const normalized = (value ?? '').toLowerCase()

  if (normalized === 'strong') return 'strong'
  if (['medium', 'moderate'].includes(normalized)) return 'moderate'
  if (normalized === 'weak') return 'weak'

  return 'unavailable'
}

export const EvidenceBadge = ({
  quality,
  ...props
}: BadgeBaseProps & { quality: EvidenceQuality }) => (
  <Badge family='evidence' tone={quality} {...props} />
)

export const CountBubble = ({
  children,
  tone = 'neutral'
}: {
  children: React.ReactNode
  tone?: MetaChipTone
}) => (
  <span
    className={cn(
      'core-count inline-flex items-center justify-center rounded-full',
      'border border-solid bg-[var(--core-count-bg)]',
      'font-medium leading-none text-[var(--core-count-fg)]',
      'border-[var(--core-count-border)]'
    )}
    style={
      {
        '--core-count-bg': `var(--core-color-status-${tone}-bg)`,
        '--core-count-fg': `var(--core-color-status-${tone}-fg)`,
        '--core-count-border': `var(--core-color-status-${tone}-border)`
      } as React.CSSProperties
    }
  >
    {children}
  </span>
)
