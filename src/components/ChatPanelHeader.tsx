import type { ReactNode } from 'react'
import { Clock, Database, LayoutList, ListChecks, MessageSquare, PanelRightClose, PanelRightOpen } from 'lucide-react'

import { AppShellNavItem, Hint, IconActionButton, Text } from '@/core'


/** What the right-hand column can be showing. */
export type PanelView = 'assistant' | 'timeline' | 'insights' | 'attributes' | 'sources'

export const PANEL_VIEWS: Array<{
  id: PanelView
  label: string
  icon: ReactNode
}> = [
  {
    id: 'assistant',
    label: 'Assistant',
    icon: <MessageSquare aria-hidden="true" size={16} strokeWidth={1.5} />
  },
  {
    id: 'timeline',
    label: 'Timeline',
    icon: <Clock aria-hidden="true" size={16} strokeWidth={1.5} />
  },
  // The assessment's evidence, beside it rather than under tabs of its own:
  // the insights it read, grouped; the attributes behind them; the sources
  // they came from.
  {
    id: 'insights',
    label: 'Insights',
    icon: <ListChecks aria-hidden="true" size={16} strokeWidth={1.5} />
  },
  {
    id: 'attributes',
    label: 'Attributes',
    icon: <LayoutList aria-hidden="true" size={16} strokeWidth={1.5} />
  },
  {
    id: 'sources',
    label: 'Sources',
    icon: <Database aria-hidden="true" size={16} strokeWidth={1.5} />
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
export const ChatPanelHeader = ({ view }: { view: PanelView }) => {
  const current = PANEL_VIEWS.find((v) => v.id === view) ?? PANEL_VIEWS[0]

  return (
    <div className="flex h-[49px] shrink-0 items-center gap-2 border-b border-solid border-border bg-card px-3">
      <Text size="sm" className="font-semibold">
        {current.label}
      </Text>
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
  onHide
}: {
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
    <div className="flex flex-col gap-1 px-2 pt-3">
      {PANEL_VIEWS.map((v) => (
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
  </div>
)
