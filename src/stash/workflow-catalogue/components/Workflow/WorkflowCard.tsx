import type { CSSProperties } from 'react'

import { Link } from 'react-router'

import { Heading, Surface, Text } from '@/core'

import { hasDetail, listingShape, OUTPUT_ICON, type WorkflowListing } from '../../../../lib/workflowCatalogue'
import { workflowHref, type WorkflowStatus } from '../../../../lib/workflows'

/**
 * One workflow in the marketplace.
 *
 * The name, its one-line job, and a quiet footer: what comes back and how
 * long it takes on the left, its status on the right. A workflow with a
 * detail page is a link, the whole card; the catalogue's others are plain
 * cards, read but not opened.
 */
const STATUS_DOT: Record<WorkflowStatus, string> = {
  Available: 'var(--core-color-status-success-fg)',
  Beta: 'var(--core-color-status-info-fg)',
  Planned: 'var(--core-color-status-neutral-fg)'
}

/** The status as a dot and a word: colour for the glance, the word for the read. */
const StatusDot = ({ status }: { status: WorkflowStatus }) => (
  <span className="flex shrink-0 items-center gap-1.5">
    <span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: STATUS_DOT[status] }} />
    <Text tone="secondary" size="sm" className="m-0 whitespace-nowrap">
      {status}
    </Text>
  </span>
)

export const WorkflowCard = ({
  listing,
  className,
  style
}: {
  listing: WorkflowListing
  className?: string
  style?: CSSProperties
}) => {
  const Icon = OUTPUT_ICON[listing.output]
  const linked = hasDetail(listing)
  const body = (
    <>
      <div className="flex min-w-0 flex-col gap-1.5">
        <Heading level={4}>{listing.name}</Heading>
        <Text tone="secondary" className="m-0 line-clamp-2">
          {listing.tagline}
        </Text>
      </div>
      <div className="mt-auto flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-1.5">
          <Icon aria-hidden="true" size={14} strokeWidth={1.5} className="shrink-0 text-text-secondary" />
          <Text tone="secondary" size="sm" className="m-0 whitespace-nowrap">
            {listingShape(listing)}
          </Text>
        </span>
        <StatusDot status={listing.status} />
      </div>
    </>
  )
  const shell = 'flex h-full flex-col gap-5 no-underline'

  if (!linked) {
    return (
      <Surface variant="card" padding="lg" className={`${shell} ${className ?? ''}`} style={style}>
        {body}
      </Surface>
    )
  }

  return (
    <Surface
      asChild
      variant="card"
      padding="lg"
      style={style}
      className={`${shell} transition-colors duration-fast hover:bg-[var(--core-color-state-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none ${className ?? ''}`}
    >
      <Link to={workflowHref(listing)} aria-label={listing.name}>
        {body}
      </Link>
    </Surface>
  )
}
