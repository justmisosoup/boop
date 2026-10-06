import { Text } from '@/core'

import type { BusinessRecord } from '../../lib/deriveResults'
import { capturedLabel, type SourceScreenshot } from '../../lib/sourceScreenshots'
import { cn } from '../../utils/twUtils'
import { AttributeCells, type AttributeCell } from '../AttributeGrid'
import { useScreenshotViewer } from '../ScreenshotViewer'

export const WebsiteDetails = ({
  website,
  cells,
  screenshot
}: {
  website?: BusinessRecord['website']
  cells: AttributeCell[]
  screenshot?: SourceScreenshot
}) => {
  const { open } = useScreenshotViewer()
  const rawStatus = website?.status?.trim()
  const status = rawStatus ? rawStatus.replace(/_/g, ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase()) : undefined
  const online = /^online$/i.test(rawStatus ?? '')
  const statusLine = (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {website?.submitted ? 'Submitted' : 'Found'}
      {status && <>
        <span aria-hidden="true">·</span>
        <span className="inline-flex items-center gap-1.5">
          {online && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-[var(--core-color-status-success-fg)]" />}
          {status}
        </span>
      </>}
    </span>
  )
  const details = cells.map((cell) => cell.label === 'Website' ? { ...cell, note: statusLine } : cell)

  return (
    <div data-website-details className={cn('grid min-w-0 grid-cols-1', screenshot && 'sm:grid-cols-3')}>
      <div className={cn('min-w-0', screenshot && 'sm:col-span-2')}>
        <AttributeCells items={details} columns={1} className="-mb-px" />
      </div>
      {screenshot && <figure className="flex min-w-0 flex-col gap-2 border-t border-[var(--core-color-border-divider)] p-4 sm:border-l sm:border-t-0">
        <Text size="sm" tone="secondary">Screenshot</Text>
        <button
          type="button"
          aria-label={`View screenshot: ${screenshot.alt}`}
          onClick={() => open(screenshot)}
          className="block aspect-[3/4] w-full overflow-hidden rounded-control border border-border transition-opacity duration-fast hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <img src={screenshot.src} alt="" className="block h-auto w-full" />
        </button>
        <Text size="sm" tone="muted">{capturedLabel(screenshot.capturedAt)}</Text>
      </figure>}
    </div>
  )
}
