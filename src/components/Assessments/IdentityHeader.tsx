import type { ReactNode } from 'react'
import { Building2, CalendarDays, Globe, Hash, Landmark, MoreHorizontal } from 'lucide-react'
import { Link } from 'react-router'

import {
  IconActionButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  PageBreadcrumb,
  PageBreadcrumbItem,
  PageHeader,
  PageHeaderActions,
  PageHeaderBand,
  PageHeaderTitles,
  PageHeading,
  Surface,
  Text
} from '@/core'

import { longDate, maskTin } from '../../lib/attributes'
import { displayName } from '../../lib/businessNames'
import type { BusinessRecord } from '../../lib/deriveResults'
import { entityTypeShown } from '../../lib/normalise'
import { stateName } from '../../lib/states'
import { AssigneeDropdown } from '../BusinessStatusBar/AssigneeDropdown'
import { StatusDropdown } from '../BusinessStatusBar/StatusDropdown'
import type { ReviewStatus } from '../../lib/review'
import { CardHeader } from '../CardHeader'

/** The canonical identity, one fact per cell: what the business IS, whichever
 *  assessment is being read. Values only, as the record states them. */
const identityFacts = (record: BusinessRecord): Array<{ label: string; value: ReactNode }> => {
  const legal = record.names.find((n) => n.type === 'legal')?.name ?? record.name
  const f = record.formation
  const office = record.addresses.find((a) => a.submitted) ?? record.addresses[0]
  const tin = (record.tin as { tin?: string } | null)?.tin
  const site = (record.website as { url?: string } | null)?.url
  return [
    { label: 'Legal name', value: legal },
    { label: 'Entity type', value: f?.entityType ? entityTypeShown(record, f.entityType) : '—' },
    {
      label: 'Formed',
      value: f?.state || f?.date ? [stateName(f?.state), f?.date && longDate(f.date)].filter(Boolean).join(' · ') : '—'
    },
    { label: 'TIN', value: tin ? maskTin(tin) : '—' },
    { label: 'Office address', value: office?.fullAddress ?? '—' },
    { label: 'Website', value: site ? site.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') : '—' }
  ]
}

/** "Limited liability company (LLC)" → "LLC": the abbreviation reads as the
 *  form in a line of facts; the name stays where there is none. */
const shortForm = (shown: string) => shown.match(/\(([^)]+)\)\s*$/)?.[1] ?? shown

/**
 * What is always true of the business, as one line of facts: its form, when and
 * where it was formed, its TIN, its site. (The office address is the
 * Addresses card's, not the profile's.) The legal name only when
 * it differs from the name in the title. Nothing that varies by assessment.
 */
const identityMeta = (record: BusinessRecord): Array<{ key: string; icon: ReactNode; text: string; label: string }> => {
  const legal = record.names.find((n) => n.type === 'legal')?.name
  const f = record.formation
  const tin = (record.tin as { tin?: string } | null)?.tin
  const site = (record.website as { url?: string } | null)?.url
  const icon = (I: typeof Building2) => <I aria-hidden="true" size={13} strokeWidth={1.75} />
  return [
    ...(legal && legal.toLowerCase() !== record.name.toLowerCase()
      ? [{ key: 'legal', icon: icon(Landmark), text: legal, label: 'Legal name' }]
      : []),
    ...(f?.entityType
      ? [{ key: 'form', icon: icon(Building2), text: shortForm(String(entityTypeShown(record, f.entityType))), label: 'Entity type' }]
      : []),
    ...(f?.state || f?.date
      ? [
          {
            key: 'formed',
            icon: icon(CalendarDays),
            text: ['Formed', f?.date && longDate(f.date), f?.state && `in ${stateName(f.state)}`].filter(Boolean).join(' '),
            label: 'Formation'
          }
        ]
      : []),
    ...(tin ? [{ key: 'tin', icon: icon(Hash), text: `TIN ${maskTin(tin)}`, label: 'TIN' }] : []),
    ...(site
      ? [{ key: 'site', icon: icon(Globe), text: site.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''), label: 'Website' }]
      : [])
  ]
}

/** The facts' labels: the report cards' column-header type, so the identity
 *  reads as the cards under it do. */
const LABEL = 'text-xs font-medium text-[var(--core-color-table-header-text)]'

/**
 * The business's profile, pinned at the top of its overview and of every
 * assessment in it: what is always true of the business, the decision on it,
 * and the way to run another assessment.
 *
 * The dashboard's business header (`components/BusinessHome/Layout.tsx`'s
 * sticky band over `BusinessStatusBar`): the crumb, the name at the left and
 * its controls at the right — assignee, then status — with the facts its
 * "Business details" card leads with run as one row under the name rather than
 * a separate card. Sticky, on the canvas, so the cards pass under it.
 */
export const IdentityHeader = ({
  record,
  defaultStatus,
  assessment,
  onRunAssessment,
  onOpenTimeline,
  onOpenActivity
}: {
  /** The business's filings over time, in the right-hand column. */
  onOpenTimeline?: () => void
  /** What has happened to the business here. */
  onOpenActivity?: () => void
  record: BusinessRecord
  defaultStatus: ReviewStatus
  /** On an assessment: its name, the crumb after the business, which links back. */
  assessment?: string
  /** Run another assessment on the business — in the profile's menu. */
  onRunAssessment?: () => void
}) => {
  return (
    <PageHeaderBand className="sticky top-0 z-[5] border-b border-[var(--core-color-border-divider)] bg-surface-canvas px-0 pb-8 pt-[30px]">
      <PageHeader>
        <PageBreadcrumb className="mb-3">
          <PageBreadcrumbItem asChild>
            <Link to="/businesses" className="no-underline">
              Businesses
            </Link>
          </PageBreadcrumbItem>
          {/* Each crumb a child of its own: the separators go between children,
              and a fragment around two of them counted as one. */}
          {assessment ? (
            <PageBreadcrumbItem asChild>
              <Link to={`/businesses/${record.id}`} viewTransition className="no-underline">
                {displayName(record.name)}
              </Link>
            </PageBreadcrumbItem>
          ) : (
            <PageBreadcrumbItem current>{displayName(record.name)}</PageBreadcrumbItem>
          )}
          {assessment && <PageBreadcrumbItem current>{assessment}</PageBreadcrumbItem>}
        </PageBreadcrumb>
        {/* The name, its facts and the decision. Wide, the decision sits at
            the right of the name; narrower, it moves above the name, so the
            name keeps the full measure. There the quiet Assigned to button is
            pulled out by its padding, so its words start on the name's edge,
            and the status and its menu sit at the far right. */}
        <div className="flex flex-col gap-3 wide:grid wide:grid-cols-[minmax(0,1fr)_auto] wide:gap-x-4 wide:gap-y-1">
          <PageHeaderTitles className="min-w-0 wide:col-start-1 wide:row-start-1">
            <PageHeading weight="normal" className="whitespace-normal break-words font-arizona text-4xl font-light leading-[2.75rem] tracking-[-0.02em]">
              {displayName(record.name)}
            </PageHeading>
          </PageHeaderTitles>
          {/* What is always true of the business, whichever assessment is open:
              one quiet line of facts, each with its icon, wrapping as it must. */}
          <ul className="-mt-2 m-0 flex list-none flex-wrap items-center gap-x-4 gap-y-1 p-0 text-text-secondary wide:col-start-1 wide:row-start-2 wide:mt-0">
            {identityMeta(record).map((m) => (
              <li key={m.key} className="flex min-w-0 items-center gap-1" title={m.label}>
                <span className="flex shrink-0">{m.icon}</span>
                <span className="sr-only">{m.label}: </span>
                <Text tone="secondary" className="truncate text-dense">
                  {m.text}
                </Text>
              </li>
            ))}
          </ul>
          {/* The decision and what to do next, as the dashboard's status bar
              orders them: who has it, where it stands, then the action. */}
          <PageHeaderActions className="order-first w-full flex-wrap justify-start [&>*:first-child]:-ml-2.5 [&>*:nth-child(2)]:ml-auto wide:order-none wide:w-auto wide:[&>*:first-child]:ml-0 wide:[&>*:nth-child(2)]:ml-0 wide:col-start-2 wide:row-span-2 wide:row-start-1 wide:self-start wide:justify-end">
            <AssigneeDropdown businessId={record.id} />
            <StatusDropdown businessId={record.id} defaultStatus={defaultStatus} />
            {(onRunAssessment || onOpenTimeline || onOpenActivity) && (
              <Menu>
                <MenuTrigger asChild>
                  <IconActionButton aria-label={`More for ${displayName(record.name)}`} variant="secondary">
                    <MoreHorizontal aria-hidden="true" />
                  </IconActionButton>
                </MenuTrigger>
                <MenuContent align="end" themeMode="light">
                  {onRunAssessment && <MenuItem onSelect={onRunAssessment}>Run assessment</MenuItem>}
                  {onRunAssessment && (onOpenTimeline || onOpenActivity) && <MenuSeparator />}
                  {onOpenTimeline && <MenuItem onSelect={onOpenTimeline}>Timeline</MenuItem>}
                  {onOpenActivity && <MenuItem onSelect={onOpenActivity}>Activity</MenuItem>}
                </MenuContent>
              </Menu>
            )}
          </PageHeaderActions>
        </div>
      </PageHeader>
    </PageHeaderBand>
  )
}

/**
 * The business's identity as a card of its own, one fact per row: the
 * overview's left column, which stays put whatever is open on the right.
 * Headed as every card in the report is.
 */
export const IdentityDetails = ({ record }: { record: BusinessRecord }) => (
  <Surface variant="card" padding="none" aria-label="Details">
    <CardHeader title="Details" />
    <dl className="m-0">
      {identityFacts(record).map((f) => (
        <div
          key={f.label}
          className="flex flex-col gap-0.5 px-4 py-2.5 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-[var(--core-color-border-divider)]"
        >
          <dt className={LABEL}>{f.label}</dt>
          <dd className="m-0 break-words">{f.value}</dd>
        </div>
      ))}
    </dl>
  </Surface>
)
