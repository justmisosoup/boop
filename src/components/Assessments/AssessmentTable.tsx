import { DataTable, DataTableRowActions, MetaChip, TruncatedText, type DataTableColumnDef } from '@/core'

import { DeterminationChip } from '../DeterminationChip'
import { InsightCounts } from '../InsightCounts'
import { countsOf } from '../Report/ReportHero'

import type { AssessmentRead } from '../../lib/assessments'

type Row = {
  read: AssessmentRead
  onOpen: () => void
  onGenerate: () => void
  onOrderAgain?: () => void
}

/**
 * The assessments as a table, as the Businesses list is one: the call, the
 * score behind it, the assessment, and how its insights read. A row opens its
 * assessment; the ⋯ holds the rest. The summary is the cards'.
 */
const columns: DataTableColumnDef<Row>[] = [
  {
    id: 'status',
    header: 'Status',
    accessorFn: (row) => row.read.score?.band.id ?? '',
    cell: ({ row }) =>
      row.original.read.ordering ? (
        <MetaChip size="compact">Ordering</MetaChip>
      ) : (
        <DeterminationChip band={row.original.read.score?.band ?? null} />
      ),
    meta: { width: 140 }
  },
  {
    id: 'score',
    header: 'Score',
    accessorFn: (row) => row.read.score?.value ?? -1,
    cell: ({ row }) => (
      <span className="font-semibold tabular-nums">{row.original.read.score?.value ?? '—'}</span>
    ),
    meta: { width: 72 }
  },
  {
    id: 'name',
    header: 'Assessment',
    accessorFn: (row) => row.read.assessment.name,
    cell: ({ row }) => <TruncatedText className="font-semibold">{row.original.read.assessment.name}</TruncatedText>,
    meta: { width: 200, grow: true }
  },
  {
    id: 'insights',
    header: 'Insights',
    accessorFn: (row) => row.read.tally.bad + row.read.tally.review,
    cell: ({ row }) => <InsightCounts counts={countsOf(row.original.read.tally)} labels={false} />,
    meta: { width: 150 }
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => (
      <DataTableRowActions
        actions={[
          {
            id: 'summary',
            label: row.original.read.summary ? 'Regenerate summary' : 'Generate summary',
            onSelect: (r) => r.onGenerate()
          },
          ...(row.original.onOrderAgain
            ? [{ id: 'again', label: 'Run again', onSelect: (r: Row) => r.onOrderAgain?.() }]
            : [])
        ]}
        label={`Actions for ${row.original.read.assessment.name}`}
        row={row.original}
        themeMode="light"
      />
    ),
    meta: { width: 48, align: 'end' }
  }
]

export const AssessmentTable = ({ rows }: { rows: Row[] }) => (
  <DataTable
    caption="Assessments"
    columns={columns}
    data={rows}
    density="compact"
    getRowId={(row) => row.read.assessment.id}
    rowIntent={{ kind: 'detail', onOpen: (row) => row.onOpen() }}
  />
)
