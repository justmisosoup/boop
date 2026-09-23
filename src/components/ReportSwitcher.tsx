import { useMemo } from 'react'
import { Plus } from 'lucide-react'

import {
  Menu,
  MenuContent,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
  MetaChip,
  PageBreadcrumbSwitcher
} from '@/core'

import type { BusinessRecord } from '../lib/deriveResults'
import { assessReport } from '../lib/records'
import { reportLabel, reportStamp } from '../lib/reportLabels'
import type { Report } from '../lib/useAnalysis'
import { ScoreRing } from './DeterminationCard'

/**
 * The open report's name in the pane's breadcrumb, and the way to open
 * another.
 *
 * One record, several runs. The crumb names the run that is open — the
 * assessment it was run from, and when — and opens onto the rest of them:
 * each with its score as the ring the determination card draws, the newest
 * marked Latest because it is the one the businesses list scores by. Last in
 * the menu, always, is running another. The switch lives where the report's
 * name is, so switching reports is done where the report is read.
 */
export const ReportSwitcher = ({
  reports,
  selectedId,
  record,
  onOpen,
  onNew
}: {
  /** Oldest first, as `useAnalysis` keeps them. */
  reports: Report[]
  /** The report open in the pane. */
  selectedId?: string | null
  /** The live record, scored against when a report carries no snapshot. */
  record: BusinessRecord
  onOpen: (id: string) => void
  /**
   * Run another. The standing assessment, read against the business as it is
   * now; the new report opens when it lands. Absent when nothing is
   * configured to run.
   */
  onNew?: { label: string; run: () => void; running?: boolean }
}) => {
  const newestId = reports[reports.length - 1]?.id
  const open = reports.find((r) => r.id === selectedId)

  // Newest first: the run the businesses list scores by is the one at the top.
  const rows = useMemo(
    () =>
      [...reports].reverse().map((r) => ({
        report: r,
        score:
          assessReport(
            { id: r.id, sections: r.result.sections, policy: r.policy, snapshot: r.snapshot },
            record
          )?.score ?? null
      })),
    [reports, record]
  )

  return (
    <Menu modal={false}>
      <MenuTrigger asChild>
        <PageBreadcrumbSwitcher aria-label="Switch report">
          {open ? `${reportLabel(open)} · ${reportStamp(open)}` : 'No reports yet'}
        </PageBreadcrumbSwitcher>
      </MenuTrigger>
      <MenuContent align="start" className="z-popover w-80">
        {rows.length > 0 && (
          <MenuRadioGroup value={selectedId ?? undefined} onValueChange={onOpen}>
            {rows.map(({ report, score }) => (
              <MenuRadioItem key={report.id} value={report.id} closeOnSelect className="py-2">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate">{reportLabel(report)}</span>
                  {/* Day and time, and how much was asked of this one. Two runs
                      of one assessment on one day are told apart by the time. */}
                  <span className="flex flex-wrap items-center gap-2 text-caption text-text-secondary">
                    {[
                      reportStamp(report),
                      report.questions.length > 0
                        ? `${report.questions.length} follow-up${report.questions.length === 1 ? '' : 's'}`
                        : ''
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    {report.id === newestId && (
                      <MetaChip size="xs" tone="neutral">
                        Latest
                      </MetaChip>
                    )}
                  </span>
                </span>
                <ScoreRing score={score} size="xs" />
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        )}
        {onNew && (
          <>
            {rows.length > 0 && <MenuSeparator />}
            <MenuItem disabled={onNew.running} onSelect={onNew.run}>
              <Plus aria-hidden="true" className="mr-1.5 size-3.5" />
              Run {onNew.label}
            </MenuItem>
          </>
        )}
      </MenuContent>
    </Menu>
  )
}
