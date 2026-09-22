import { Clock, MessageSquare, PanelRightClose } from 'lucide-react'
import { ChevronDown } from 'lucide-react'

import { ActionButton, Hint, IconActionButton, Menu, MenuContent, MenuItem, MenuLabel } from '@/core'
import { MenuTrigger } from '@/core'

import { cn } from '../utils/twUtils'

/** What the right-hand column can be showing. */
export type PanelView = 'assistant' | 'timeline'

export const PANEL_VIEWS: Array<{
  id: PanelView
  label: string
  note: string
  icon: React.ReactNode
}> = [
  {
    id: 'assistant',
    label: 'Assistant',
    note: 'Ask about this business',
    icon: <MessageSquare aria-hidden="true" size={16} strokeWidth={1.5} />
  },
  {
    id: 'timeline',
    label: 'Timeline',
    note: 'What has been run, and when',
    icon: <Clock aria-hidden="true" size={16} strokeWidth={1.5} />
  }
]

/**
 * The column, put away.
 *
 * Not gone — a strip of what it could be showing, the same move the global nav
 * makes on the other edge of the page: collapsed, it is still a list of places,
 * and picking one is what opens it. A column that vanished entirely would need
 * a control somewhere else to bring it back, and that control would be a button
 * that says nothing about what it opens.
 */
export const ChatRail = ({
  view,
  onOpen
}: {
  view: PanelView
  onOpen: (view: PanelView) => void
}) => (
  <div className="flex h-full w-full flex-col">
    {/* The bar runs on across the collapsed column, broken at the seam but not
        stopped by it: one rule over both regions, and the icons hang below it
        the way the report's content hangs below its tabs. */}
    <div className="h-12 shrink-0 border-b border-solid border-border bg-card" />

    <div className="flex flex-col items-center gap-1 pt-3">
      {PANEL_VIEWS.map((v) => (
        <Hint key={v.id} content={v.label} side="left" size="compact">
          <IconActionButton
            variant="quiet"
            size="compact"
            aria-label={v.label}
            onClick={() => onOpen(v.id)}
            className={cn(v.id === view && 'bg-muted text-foreground')}
          >
            {v.icon}
          </IconActionButton>
        </Hint>
      ))}
    </div>
  </div>
)

/**
 * The tab bar, continued past the seam.
 *
 * The report's tabs say which face of the report you are reading; this says
 * what the column beside it is for. One rule runs across both, broken where the
 * columns are — so the bar reads as one bar over two regions rather than a
 * header the chat grew for itself.
 *
 * The same height as the tab bar to the pixel (`h-12` plus its border), because
 * the two are the same line.
 */
export const ChatPanelHeader = ({
  view,
  onView,
  onHide
}: {
  view: PanelView
  onView: (view: PanelView) => void
  onHide: () => void
}) => {
  const current = PANEL_VIEWS.find((v) => v.id === view) ?? PANEL_VIEWS[0]

  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-solid border-border bg-card px-3">
      <Menu>
        <MenuTrigger asChild>
          <ActionButton
            variant="quiet"
            size="compact"
            trailingIcon={<ChevronDown aria-hidden="true" />}
            className="font-semibold"
          >
            {current.label}
          </ActionButton>
        </MenuTrigger>
        <MenuContent align="start" className="z-popover w-56">
          <MenuLabel>This column</MenuLabel>
          {PANEL_VIEWS.map((v) => (
            <MenuItem
              key={v.id}
              onSelect={() => onView(v.id)}
              className={cn(v.id === view && 'bg-muted')}
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{v.label}</span>
                <span className="truncate text-caption text-muted-foreground">{v.note}</span>
              </span>
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>

      <span className="flex-1" />

      <Hint content="Hide this column" side="bottom" size="compact">
        <IconActionButton variant="quiet" size="compact" aria-label="Hide this column" onClick={onHide}>
          <PanelRightClose aria-hidden="true" size={16} strokeWidth={1.5} />
        </IconActionButton>
      </Hint>
    </div>
  )
}
