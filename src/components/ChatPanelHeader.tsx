import type { ReactNode } from 'react'
import { Activity, Clock, Database, ListChecks, PanelRightClose, PanelRightOpen } from 'lucide-react'

import { AppShellNavItem, Hint, IconActionButton } from '@/core'
import { cn } from '@/utils/twUtils'

import { MiddeskMark } from './MiddeskMark'


/** What the right-hand column can be showing. */
/** `sources:<kind>`: one kind of source (`SourceGroups.tsx`); `sources`, every one. */
export type PanelView = 'assistant' | 'timeline' | 'insights' | 'sources' | 'activity' | 'alerts' | `sources:${string}`

/** `foot`: under a divider, apart from the business's own views — the
 *  record's evidence (its filings over time, its sources) rather than its
 *  state. Not at the rail's foot: the Assistant's bubble sits there. */
export type PanelViewDef = { id: PanelView; label: string; icon: ReactNode; foot?: boolean }

/** The business's side panel: its assessments, what has happened to it here
 *  and its alerts; then, under a divider, its sources — its filings over time
 *  first, then on the record page one item per kind of source it has
 *  (`SourceGroups.tsx`). The Assistant is not one of them — it stays in its bubble,
 *  floating over the report. */
export const PANEL_VIEWS: PanelViewDef[] = [
  {
    id: 'insights',
    label: 'Assessments',
    icon: <ListChecks aria-hidden="true" size={16} strokeWidth={1.5} />
  },
  {
    id: 'activity',
    // Its alerts and its activity, one place: monitoring, then what happened.
    label: 'Activity',
    icon: <Activity aria-hidden="true" size={16} strokeWidth={1.5} />
  },
  {
    id: 'timeline',
    label: 'Timeline',
    icon: <Clock aria-hidden="true" size={16} strokeWidth={1.5} />,
    // The filings over time are a source too: the first under the divider.
    foot: true
  },
  {
    id: 'sources',
    label: 'Sources',
    icon: <Database aria-hidden="true" size={16} strokeWidth={1.5} />,
    foot: true
  }
]

/**
 * The business overview's column: what has happened to the business — its
 * filings over time, and its own activity here. The report's rail, with the
 * views a business (rather than one assessment) has.
 */
export const BUSINESS_PANEL_VIEWS: PanelViewDef[] = [
  {
    id: 'timeline',
    label: 'Timeline',
    icon: <Clock aria-hidden="true" size={16} strokeWidth={1.5} />
  },
  {
    id: 'activity',
    label: 'Activity',
    icon: <Activity aria-hidden="true" size={16} strokeWidth={1.5} />
  }
]

/**
 * The tab bar, continued past the seam.
 *
 * The report's tabs say which face of the report you are reading; this says
 * what the column beside it is for. One rule runs across both, broken where the
 * columns are — so it reads as one bar over two regions rather than a header
 * the column grew for itself. The same height as the tab bar to the pixel.
 *
 * The name is a label, not a control. Switching views is the rail's job, a menu
 * here was a second way to do the same thing, and the collapse sits at the far
 * right of the bar — in the rail, past the panel's own edge, where the column
 * actually ends.
 */
export const ChatPanelHeader = ({
  view,
  views = PANEL_VIEWS,
  action
}: {
  view: PanelView
  views?: PanelViewDef[]
  /** The view's own action, at the bar's right: Assessments' "Add assessment". */
  action?: ReactNode
}) => {
  const current = views.find((v) => v.id === view) ?? views[0]

  return (
    <div className="flex h-[49px] shrink-0 items-center gap-2 border-b border-solid border-border bg-card px-3">
      {/* In the report's serif, as its cards name themselves. */}
      <h2 className="m-0 min-w-0 flex-1 font-arizona text-base font-light text-text-primary">{current.label}</h2>
      {action}
    </div>
  )
}

/**
 * The rail: what this column could be showing, always on screen.
 *
 * The same move the global nav makes on the other edge of the page — a strip of
 * places, and while the panel is open, one of them current. It persists whether
 * the panel is open or shut, so putting the panel away leaves the list rather
 * than a bare edge, and the thing that opens it again is the thing that says
 * what it opens.
 *
 * White, like the report. The grey belongs to the panel, which is a surface you
 * work in rather than one you read.
 */
export const ChatRail = ({
  view,
  open,
  onOpen,
  onHide,
  views = PANEL_VIEWS,
  onAssistant,
  assistantOpen = false
}: {
  /** Opens the Middesk Assistant: given, its bubble sits at the rail's foot. */
  onAssistant?: () => void
  /** The Assistant is open: its bubble is ringed. */
  assistantOpen?: boolean
  /** What the column can show; the report's four by default. */
  views?: PanelViewDef[]
  view: PanelView
  /** The panel is showing `view` right now, rather than being put away. */
  open: boolean
  onOpen: (view: PanelView) => void
  onHide: () => void
}) => (
  <div className="flex h-full w-[49px] shrink-0 flex-col border-l border-solid border-border bg-card">
    {/* The bar runs on across the rail, broken at the seam but not stopped by
        it: one rule over every region, and the icons hang below it the way the
        report's content hangs below its tabs.

        The collapse lives in this square — the last cell of the bar, at the
        page's own right edge. It closes the column, so it belongs at the end of
        it rather than inside the thing being closed; and it stays there when the
        column is shut, pointing the other way, so the square that put it away is
        the square that brings it back. */}
    <div className="flex h-[49px] shrink-0 items-center justify-center border-b border-solid border-border">
      <Hint
        asChild
        content={open ? 'Hide this column' : 'Show this column'}
        side="left"
        size="compact"
      >
        <IconActionButton
          variant="quiet"
          size="compact"
          aria-label={open ? 'Hide this column' : 'Show this column'}
          aria-expanded={open}
          onClick={open ? onHide : () => onOpen(view)}
        >
          {open ? (
            <PanelRightClose aria-hidden="true" size={16} strokeWidth={1.5} />
          ) : (
            <PanelRightOpen aria-hidden="true" size={16} strokeWidth={1.5} />
          )}
        </IconActionButton>
      </Hint>
    </div>

    {/* `AppShellNavItem`, collapsed — the global nav's own row, so "selected"
        here IS selected there: `NAV_ITEM_ACTIVE` in `src/core/AppShell.tsx`,
        one constant, applied by the same component. It carries its own tooltip
        on the collapsed form, so there is no `Hint` around it. */}
    {[views.filter((v) => !v.foot), views.filter((v) => v.foot)].map((group, g) => (
    <div className={cn('flex flex-col gap-1 px-2', g === 0 ? 'pt-3' : 'mx-2 mt-2 border-t border-solid border-[var(--core-color-border-divider)] px-0 pt-2')} key={g}>
      {group.map((v) => (
        <AppShellNavItem
          key={v.id}
          // Nothing is current while the panel is shut: the rail is then a
          // list of things you could open, and marking one as selected claimed
          // a column that is not on screen.
          active={open && v.id === view}
          asChild
          collapsed
          icon={v.icon}
          tooltip={v.label}
        >
          {/* Icon only, and no label span: this rail is always collapsed, and
              `asChild` hands the row's children over — the component's own
              `opacity-0` label never runs, so a label passed here would print.
              The name is on `aria-label` and in the tooltip. */}
          <button
            type="button"
            aria-label={v.label}
            className="justify-center"
            onClick={() => onOpen(v.id)}
          >
            <span className="grid size-4 shrink-0 place-items-center">{v.icon}</span>
          </button>
        </AppShellNavItem>
      ))}
    </div>
    ))}
    {/* The Assistant, at the rail's foot and set apart from the views above:
        a filled bubble in the primary colour, the one thing here that talks
        back. It opens the Assistant's own window rather than this column. */}
    {onAssistant && (
      <div className="mt-auto flex justify-center pb-4">
        <Hint asChild content="Middesk Assistant" side="left" size="compact">
          <button
            aria-label="Open the Middesk Assistant"
            aria-pressed={assistantOpen}
            className={cn(
              'grid size-9 place-items-center rounded-full shadow-elevation-raised',
              'bg-[var(--core-color-action-primary-bg)] text-[var(--core-color-action-primary-fg)]',
              'transition-transform duration-[var(--core-duration-fast)] hover:scale-105 motion-reduce:transition-none',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              assistantOpen && 'ring-2 ring-[var(--core-color-action-primary-bg)] ring-offset-2'
            )}
            onClick={onAssistant}
            type="button"
          >
            <MiddeskMark className="h-[9px] w-4 [&_path]:fill-current" />
          </button>
        </Hint>
      </div>
    )}
  </div>
)
