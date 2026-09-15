import type React from 'react'

import { cn } from '@/utils/twUtils'

/**
 * The design system's single "in progress" text voice: a slow gradient sweep
 * clipped to the glyphs. Shared by `ChatMessage pending` and `ChatThinking
 * active` so every waiting state in a conversation shimmers identically.
 * Motion-safe by construction — reduced-motion users get plain secondary text.
 * Carries no type ramp; the caller owns font size/leading.
 */
export const ShimmerText = ({
  children,
  className
}: {
  children: React.ReactNode
  className?: string
}) => (
  <span
    className={cn(
      'text-[var(--core-color-text-secondary)]',
      'motion-safe:animate-shimmer motion-safe:bg-[length:200%_100%]',
      'motion-safe:bg-[linear-gradient(90deg,var(--core-color-text-secondary)_35%,var(--core-color-text-muted)_50%,var(--core-color-text-secondary)_65%)]',
      'motion-safe:bg-clip-text motion-safe:[-webkit-text-fill-color:transparent]',
      className
    )}
  >
    {children}
  </span>
)
