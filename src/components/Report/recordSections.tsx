import type { ReactNode } from 'react'

import { Text } from '@/core'

import type { AttributeRow } from '../../lib/attributes'
import { cn } from '../../utils/twUtils'
import { AttributeCells, cell, type AttributeCell } from '../AttributeGrid'
import { RowProvenance } from '../Provenance'
import { StatusChip } from './ClaimsStrips'

/**
 * The shared grammar of a record held against the business — a lien, a court
 * case, a bankruptcy petition — as the report and the Sources tab draw it: a
 * band that names it, then its facts in labelled grids, in the dashboard's
 * own arrangement for each kind.
 */
export type Section = { key: string; label: string; columns: 2 | 3; cells: AttributeCell[] }

/** Cells a surface adds to a record's first section: the Sources card's
 *  Status, its link to the filing office. */
export type Extra = { lead?: AttributeCell[]; trail?: AttributeCell[] }

/** A value the source did not give, in the grey an absent value takes: the
 *  cell stays, so the grid keeps its shape, and the dash says it is empty. */
export const BLANK = <span className="text-text-secondary">—</span>

/** A field the record always has a place for: its value, or the dash where
 *  the source gave none. Every blank reads the same way. */
export const field = (label: string, value: ReactNode | null | undefined): AttributeCell => cell(label, value || BLANK)

/**
 * The band at the head of a record: whether it is still live, what it is,
 * and whom it involves, with its source chip at the far side. Dates stay in
 * the grid below — a date here said it twice.
 */
export const ClaimBand = ({
  status,
  title,
  detail,
  row,
  onJumpToSource
}: {
  status: string | null | undefined
  /** What the record is: the kind of lien, the case name, the chapter. */
  title: string
  /** Whom it involves, or the business's part in it: the secured parties,
   *  "Defendant", the court. */
  detail?: string
  /** The record's attribute row, for its provenance chip. */
  row?: AttributeRow
  onJumpToSource?: (cardId: string) => void
}) => (
  <div className="flex items-center justify-between gap-3 border-b border-[var(--core-color-border-divider)] bg-[var(--core-color-bg-secondary)] px-4 py-2.5">
    <span className="flex min-w-0 flex-wrap items-center gap-2">
      <StatusChip status={status} />
      <span className="text-sm font-semibold leading-5 text-text-primary">{title}</span>
      {detail && <span className="min-w-0 text-sm leading-5 text-text-primary">{detail}</span>}
    </span>
    <span className="flex shrink-0 items-center justify-end">
      {row && <RowProvenance row={row} onJumpToSource={onJumpToSource} />}
    </span>
  </div>
)

/** A section's heading in the report: the label on its own row, ruled off
 *  from the grid under it. */
const SectionHeading = ({ children }: { children: ReactNode }) => (
  <div className="border-b border-[var(--core-color-border-divider)] px-4 py-2.5">
    <Text tone="secondary" size="sm" className="leading-snug">
      {children}
    </Text>
  </div>
)

/**
 * The sections drawn: a heading over each grid, ruled off above and below.
 *
 * The rules are solid, as the band's are: a section heading sitting on the
 * previous grid's dashed cell rule read as part of that grid. Each grid pulls
 * its own dashed bottom rule up a pixel (`-mb-px`) so the next heading's
 * solid rule — or the block's own — paints over it. The first section
 * follows the band, which carries the rule. `heading` lets the Sources tab
 * draw its own heading row.
 */
export const RecordSections = ({
  sections,
  heading
}: {
  sections: Section[]
  heading?: (label: string) => ReactNode
  /** Kept for callers; every grid now hangs its last rule outside. */
  last?: boolean
}) => (
  <>
    {sections.map((s, i) => (
      <div key={s.key} className={cn(i > 0 && 'border-t border-[var(--core-color-border-divider)]')}>
        {heading ? heading(s.label) : <SectionHeading>{s.label}</SectionHeading>}
        <AttributeCells columns={s.columns} className="-mb-px" items={s.cells} />
      </div>
    ))}
  </>
)

/** One record as a block: its band, then its sections, ruled off from the next. */
export const RecordBlock = ({ band, sections }: { band: ReactNode; sections: Section[] }) => (
  <div className="border-b border-[var(--core-color-border-divider)] last:border-b-0">
    {band}
    <RecordSections sections={sections} />
  </div>
)
