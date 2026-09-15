import type React from 'react'
import { useId, useState } from 'react'

import { Check, ChevronDown, CircleAlert, Minus } from 'lucide-react'

import { cn } from '@/utils/twUtils'

import type { ChatSourceData } from './ChatSources'
import type { Density } from './internal/density'
import { useDensity } from './internal/density'
import { ShimmerText } from './internal/shimmer'
import { Spinner } from './Spinner'

// ---------------------------------------------------------------------------
// ChatThinking — the agent-work disclosure for the Chat family.
// ---------------------------------------------------------------------------
//
// A collapsed one-liner ("Thought for 45s") that expands INLINE into the
// steps the agent took — titled rows with a status glyph, an optional muted
// description, and small quiet chips (search queries, visited pages).
// Composes as the first child of an assistant `ChatMessage`'s children; no
// message API involved.
//
// Design decisions:
// - Inline expansion, not a floating panel: steps land in the transcript
//   where they can be read beside the answer and scrolled back to — and a
//   button + region is the plainest accessible disclosure. Hover only
//   highlights; click commits (the family's one interaction grammar).
// - The reveal is the house grid-rows disclosure (the AppShell nav
//   mechanism): children stay mounted (cheap re-open, stable measurement for
//   `ChatLog`'s bottom-stick) but leave the a11y tree and tab order via
//   `aria-hidden` + `inert` while closed. Deliberately private — no public
//   Collapsible primitive until a second generic consumer exists.
// - Streaming: `active` shimmers the summary (the family's one "in progress"
//   voice, shared with `ChatMessage pending` — never pair the two on one
//   turn) and marks the block `aria-busy` so a `role='log'` region announces
//   the settled result once, not every appended step. Uncontrolled instances
//   auto-expand while active once steps exist and settle collapsed when the
//   run ends; a user's toggle wins for the instance's lifetime; `defaultOpen`
//   pins open. Controlled `open` disables all of it.
// - No live timer: a ticking "Thought for Ns" would re-render the log every
//   second for a caption nobody reads mid-stream. Consumers pass `duration`
//   once settled (one subtraction from wire timestamps) and may drive `label`
//   while active ("Searching the web").
// - Status vocabulary is neutral (map wire shapes at the consumer:
//   running→active, completed→complete; error/skipped pass through). Quiet
//   glyphs everywhere except error — status is metadata, not traffic lights.
//   The summary stays neutral on a failed step; the message itself narrates
//   run-level failure.
// - Steps are flat in v1. Still future: nested substeps, a hover peek on the
//   collapsed line, per-step disclosures.
//
// Readiness: prototype — settling on the workbench beside the rest of the
// Chat family; the agent dock is the intended first consumer.

export type ChatThinkingStepStatus =
  | 'pending'
  | 'active'
  | 'complete'
  | 'error'
  | 'skipped'

/**
 * One step of the agent's work. Neutral vocabulary — consumers map wire
 * shapes (Operator `running`→`active`, `completed`→`complete`; `error` and
 * `skipped` pass through).
 */
export type ChatThinkingStep = {
  id: string
  label: string
  /** Muted second line under the label. */
  description?: string
  /** Semantic glyph override (a Globe for a search step — 14px reads best).
   *  Replaces the status glyph, so leave it off a step that must show the
   *  active spinner. */
  icon?: React.ReactNode
  /** Defaults to 'complete' — a settled run is the common case. */
  status?: ChatThinkingStepStatus
  /** Small quiet tokens under the step — search queries (label only) and
   *  visited pages (`url` renders a link, `onSelect` a button). Reuses the
   *  source contract so a future preview upgrade is additive. */
  chips?: ChatSourceData[]
}

const formatThinkingDuration = (ms: number): string => {
  const totalSeconds = Math.max(1, Math.round(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0) return `${seconds}s`

  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`
}

// The house grid-rows disclosure (see AppShellNavCollapsible): height animates
// 0fr↔1fr, closed children stay mounted but leave the a11y tree + tab order.
const ThinkingDisclosure = ({
  children,
  id,
  open
}: {
  children: React.ReactNode
  id: string
  open: boolean
}) => (
  <div
    aria-hidden={!open || undefined}
    className={cn(
      'grid overflow-hidden transition-[grid-template-rows,opacity] duration-standard ease-emphasized motion-reduce:transition-none',
      open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
    )}
    data-state={open ? 'open' : 'closed'}
    id={id}
    inert={!open}
  >
    <div
      className={cn(
        'min-h-0 transition-transform duration-standard ease-emphasized motion-reduce:transition-none',
        open ? 'translate-y-0' : '-translate-y-1'
      )}
    >
      {children}
    </div>
  </div>
)

const StepStatusGlyph = ({ status }: { status: ChatThinkingStepStatus }) => {
  switch (status) {
    case 'active':
      return <Spinner label={false} size='sm' tone='muted' />
    case 'pending':
      return (
        <span
          aria-hidden='true'
          className='size-2 rounded-full border border-[var(--core-color-border-strong)]'
        />
      )
    case 'error':
      return (
        <CircleAlert
          aria-hidden='true'
          className='text-[var(--core-color-text-danger)]'
          size={14}
          strokeWidth={2}
        />
      )
    case 'skipped':
      return (
        <Minus
          aria-hidden='true'
          className='text-[var(--core-color-text-muted)]'
          size={14}
          strokeWidth={2}
        />
      )
    default:
      return (
        <Check
          aria-hidden='true'
          className='text-[var(--core-color-text-muted)]'
          size={14}
          strokeWidth={2}
        />
      )
  }
}

// Quieter than the composer's ChatChip on purpose: borderless, inset-toned —
// working notes, not attached context. Still at the 24px interactive floor.
const STEP_CHIP_CLASS = cn(
  'inline-flex h-6 max-w-full items-center gap-1 rounded-control',
  'bg-[var(--core-color-chip-bg)] px-1.5 text-caption',
  'text-[var(--core-color-text-secondary)]'
)

const STEP_CHIP_INTERACTIVE_CLASS = cn(
  STEP_CHIP_CLASS,
  'transition-colors duration-fast motion-reduce:transition-none',
  'hover:bg-[var(--core-color-chip-hover-bg)] hover:text-foreground',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
)

const StepChip = ({ chip }: { chip: ChatSourceData }) => {
  const face = (
    <>
      {chip.icon && (
        <span
          aria-hidden='true'
          className='flex size-3 shrink-0 items-center justify-center'
        >
          {chip.icon}
        </span>
      )}
      <span className='truncate'>{chip.label}</span>
    </>
  )

  if (chip.url) {
    return (
      <a
        className={STEP_CHIP_INTERACTIVE_CLASS}
        href={chip.url}
        rel='noreferrer'
        target='_blank'
      >
        {face}
      </a>
    )
  }

  if (chip.onSelect) {
    return (
      <button
        className={STEP_CHIP_INTERACTIVE_CLASS}
        type='button'
        onClick={chip.onSelect}
      >
        {face}
      </button>
    )
  }

  return <span className={STEP_CHIP_CLASS}>{face}</span>
}

const THINKING_STEP_PAD: Record<Density, string> = {
  standard: 'py-1',
  compact: 'py-0.5'
}

const ThinkingStepRow = ({
  density,
  step
}: {
  density: Density
  step: ChatThinkingStep
}) => {
  const status = step.status ?? 'complete'

  return (
    <div className={cn('flex items-start gap-2', THINKING_STEP_PAD[density])}>
      {/* h-5 = the caption line's 20px strut, so the glyph centers on the
          first text line however far the row wraps. */}
      <span className='flex h-5 w-3.5 shrink-0 items-center justify-center'>
        {step.icon ? (
          <span
            aria-hidden='true'
            className='text-[var(--core-color-text-muted)]'
          >
            {step.icon}
          </span>
        ) : (
          <StepStatusGlyph status={status} />
        )}
      </span>
      <div className='min-w-0 flex-1'>
        <div
          className={cn(
            'text-caption',
            status === 'error'
              ? 'text-[var(--core-color-text-danger)]'
              : 'text-[var(--core-color-text-secondary)]'
          )}
        >
          {/* Status must not live in color alone. */}
          {status === 'error' && <span className='sr-only'>Failed: </span>}
          {status === 'skipped' && <span className='sr-only'>Skipped: </span>}
          {step.label}
        </div>
        {step.description && (
          <div className='text-caption text-[var(--core-color-text-muted)]'>
            {step.description}
          </div>
        )}
        {step.chips && step.chips.length > 0 && (
          <div className='mt-1 flex flex-wrap gap-1'>
            {step.chips.map(chip => (
              <StepChip chip={chip} key={chip.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const THINKING_SUMMARY_TYPE: Record<Density, string> = {
  standard: 'text-sm leading-6',
  compact: 'text-caption'
}

// The rail indents the step list under the summary text; 3px of margin lines
// the hairline up with the chevron column's optical left edge.
const THINKING_LIST_PAD: Record<Density, string> = {
  standard: 'ml-[3px] mt-1 pl-3',
  compact: 'ml-[3px] mt-0.5 pl-2.5'
}

type ChatThinkingProps = {
  /** The run is still working: shimmer summary, `aria-busy`, and
   *  (uncontrolled) auto-expand while steps stream in. Don't pair with
   *  `ChatMessage pending` — one shimmer per turn. */
  active?: boolean
  /** Summary override. Defaults to 'Thinking…' while active, else
   *  'Thought for {duration}' (or 'Thought' with no duration). */
  label?: React.ReactNode
  /** Elapsed thinking time in ms, formatted as '45s' / '1m 12s'. Ignored
   *  while `active` — the primitive never runs its own timer. */
  duration?: number
  steps?: ChatThinkingStep[]
  /** Controlled open state — disables all auto expand/collapse. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Uncontrolled initial state; `true` pins it open until the user closes. */
  defaultOpen?: boolean
  /** Density override; inherits from the surrounding `FloatingPanel`. */
  density?: Density
  className?: string
}

export const ChatThinking = ({
  active = false,
  className,
  defaultOpen = false,
  density: densityProp,
  duration,
  label,
  onOpenChange,
  open: openProp,
  steps
}: ChatThinkingProps) => {
  const density = useDensity(densityProp)
  const regionId = useId()
  const [userToggled, setUserToggled] = useState<boolean | null>(null)

  const hasSteps = steps != null && steps.length > 0
  const autoOpen = defaultOpen || (active && hasSteps)
  const open = openProp ?? userToggled ?? autoOpen

  const toggle = () => {
    if (openProp === undefined) setUserToggled(!open)
    onOpenChange?.(!open)
  }

  const summary = active ? (
    <ShimmerText>{label ?? 'Thinking…'}</ShimmerText>
  ) : (
    <span className='truncate'>
      {label ??
        (duration != null
          ? `Thought for ${formatThinkingDuration(duration)}`
          : 'Thought')}
    </span>
  )

  return (
    <div
      aria-busy={active || undefined}
      className={cn('flex flex-col', className)}
    >
      {hasSteps ? (
        <button
          aria-controls={regionId}
          aria-expanded={open}
          className={cn(
            'inline-flex min-h-6 max-w-full items-center gap-1 self-start rounded-control text-left',
            THINKING_SUMMARY_TYPE[density],
            'text-[var(--core-color-text-secondary)]',
            'transition-colors duration-fast motion-reduce:transition-none hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          )}
          type='button'
          onClick={toggle}
        >
          {summary}
          <ChevronDown
            aria-hidden='true'
            className={cn(
              'shrink-0 text-[var(--core-color-text-muted)] transition-transform duration-standard ease-emphasized motion-reduce:transition-none',
              !open && '-rotate-90'
            )}
            size={14}
            strokeWidth={2}
          />
        </button>
      ) : (
        // An empty disclosure is a lie: no steps, no button, no chevron.
        <span
          className={cn(
            'inline-flex min-h-6 max-w-full items-center self-start',
            THINKING_SUMMARY_TYPE[density],
            'text-[var(--core-color-text-secondary)]'
          )}
        >
          {summary}
        </span>
      )}
      {hasSteps && (
        <ThinkingDisclosure id={regionId} open={open}>
          <div
            className={cn(
              'flex flex-col border-l border-border',
              THINKING_LIST_PAD[density]
            )}
          >
            {steps.map(step => (
              <ThinkingStepRow density={density} key={step.id} step={step} />
            ))}
          </div>
        </ThinkingDisclosure>
      )}
    </div>
  )
}
