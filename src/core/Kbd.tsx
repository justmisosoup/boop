import type React from 'react'

import { cn } from '@/utils/twUtils'

export type KbdProps = React.HTMLAttributes<HTMLElement>

/**
 * `Kbd` is a single keyboard key cap for shortcut hints — `⌘K`, `Esc`, `↵` —
 * in menus, tooltips, and the command palette. Presentational; uses semantic
 * tokens so it reads correctly in scoped dark. Group multiple caps with a thin
 * gap (e.g. `⌘` `K`) rather than baking a combo into one cap.
 */
export const Kbd = ({ className, ...props }: KbdProps) => (
  <kbd
    className={cn(
      'inline-flex h-5 min-w-[20px] items-center justify-center rounded-[5px]',
      'border border-border bg-[var(--core-color-surface-subtle)] px-1.5',
      'font-sans text-[11px] font-medium leading-none text-muted-foreground',
      className
    )}
    {...props}
  />
)
