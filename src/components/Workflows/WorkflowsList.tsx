import { useMemo, useState } from 'react'

import {
  ActionButton,
  ConfirmDialog,
  DataTable,
  type DataTableColumnDef,
  DateTime,
  EmptyState,
  ErrorState,
  IconActionButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  PageContainer,
  PageDescription,
  PageHeader,
  PageHeaderActions,
  PageHeaderBand,
  PageHeaderBar,
  PageHeaderTitles,
  PageHeading,
  SearchInput,
  SegmentedControl,
  SegmentedControlItem,
  Text,
  useToast
} from '@/core'
import { cn } from '@/utils/twUtils'
import { MoreHorizontal } from 'lucide-react'
import { useNavigate } from 'react-router'

import { useDeleteCustomOrderMutation } from '@/lib/customOrders/api'
import type { SavedCustomOrder } from '@/lib/customOrders/types'
import { useCustomOrderData } from '@/lib/customOrders/api'
import { ORDER_CATALOG } from '@/lib/customOrders/catalog'
import { summarize } from '@/lib/customOrders/model'
import { REPORT_ASSESSMENTS } from '@/lib/reportAssessments'
import cya from '@/utils/cya'

import {
  duplicateWorkflowPath,
  editWorkflowPath,
  NEW_WORKFLOW_PATH,
  workflowPath
} from './paths'

const WorkflowActionsMenu = ({
  order,
  onDelete
}: {
  order: SavedCustomOrder
  onDelete: (order: SavedCustomOrder) => void
}) => {
  const navigate = useNavigate()
  return (
    <Menu>
      <MenuTrigger asChild>
        <IconActionButton
          aria-label={`Actions for ${order.name}`}
          className={cn(
            'hover:!bg-[var(--core-color-table-action-hover-bg)] data-[state=open]:!bg-[var(--core-color-table-action-hover-bg)]',
            'opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100'
          )}
          variant='quiet'
        >
          <MoreHorizontal aria-hidden='true' />
        </IconActionButton>
      </MenuTrigger>
      <MenuContent align='end' themeMode='light'>
        <MenuItem onSelect={() => navigate(editWorkflowPath(order.id))}>
          Edit assessment
        </MenuItem>
        <MenuItem onSelect={() => navigate(duplicateWorkflowPath(order.id))}>
          Duplicate assessment
        </MenuItem>
        <MenuSeparator />
        <MenuItem onSelect={() => onDelete(order)} tone='destructive'>
          Delete assessment
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}

export const WorkflowsList = () => {
  const navigate = useNavigate()
  const { saved } = useCustomOrderData()
  const [deleteOrder, { isLoading: isDeleting }] =
    useDeleteCustomOrderMutation()
  const [pendingDelete, setPendingDelete] = useState<SavedCustomOrder | null>(
    null
  )
  const { showToast } = useToast()
  const create = () => navigate(NEW_WORKFLOW_PATH)
  // Every assessment: Middesk's defaults — the report's own — then the
  // team's custom ones; narrowed by kind and by what is searched.
  const [kind, setKind] = useState<'all' | 'default' | 'custom'>('all')
  const [query, setQuery] = useState('')
  const custom = saved.data ?? []
  const isDefault = (a: SavedCustomOrder) => REPORT_ASSESSMENTS.some((d) => d.id === a.id)
  const rows = (kind === 'default' ? [...REPORT_ASSESSMENTS] : kind === 'custom' ? custom : [...REPORT_ASSESSMENTS, ...custom]).filter((a) =>
    a.name.toLowerCase().includes(query.trim().toLowerCase())
  )

  const confirmDelete = async () => {
    if (!pendingDelete) return
    try {
      await deleteOrder(pendingDelete.id).unwrap()
      showToast({ text: 'Assessment deleted', appearance: 'success' })
    } catch {
      showToast({
        text: 'Couldn’t delete the assessment',
        appearance: 'error'
      })
    }
    setPendingDelete(null)
  }

  const columns = useMemo<DataTableColumnDef<SavedCustomOrder>[]>(
    () => [
      {
        id: 'name',
        header: 'Assessment',
        cell: ({ row }) => row.original.name,
        meta: { minWidth: 200 }
      },
      {
        // What it checks, in the catalog's words.
        id: 'checks',
        header: 'Checks',
        cell: ({ row }) => (
          <Text className='line-clamp-2' tone='secondary'>
            {summarize(ORDER_CATALOG, row.original)}
          </Text>
        ),
        meta: { minWidth: 280, hideBelow: 'md' }
      },
      {
        // A default is Middesk's; a custom one, whoever on the team made it.
        id: 'created_by',
        header: 'Created by',
        cell: ({ row }) => (isDefault(row.original) ? 'Middesk' : (row.original.created_by ?? '—')),
        meta: { minWidth: 140, hideBelow: 'sm' }
      },
      {
        id: 'updated',
        header: 'Last updated',
        cell: ({ row }) =>
          isDefault(row.original) ? (
            <Text tone='secondary'>—</Text>
          ) : (
            <DateTime relative>{row.original.updated_at}</DateTime>
          ),
        meta: { width: 'content', hideBelow: 'sm' }
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div
            className='flex items-center justify-end'
            onClick={event => event.stopPropagation()}
          >
            {/* Defaults are Middesk's, fixed: only a custom one is edited. */}
            {!isDefault(row.original) && (
              <WorkflowActionsMenu
                onDelete={setPendingDelete}
                order={row.original}
              />
            )}
          </div>
        ),
        meta: { align: 'end', width: 'content', skeleton: false }
      }
    ],
    []
  )

  return (
    <PageContainer width='wide'>
      <title>Assessments • Middesk</title>
      <PageHeaderBand className='px-0'>
        <PageHeader>
          <PageHeaderBar>
            <PageHeaderTitles>
              <PageHeading
                count={saved.data ? REPORT_ASSESSMENTS.length + custom.length : null}
                weight='normal'
              >
                Assessments
              </PageHeading>
              <PageDescription>
                Middesk’s default assessments, and the custom ones your team saves — each a set of
                insights you can run on any business.
              </PageDescription>
            </PageHeaderTitles>
            <PageHeaderActions>
              <ActionButton onClick={create} {...cya('CreateCustomOrder')}>
                Create assessment
              </ActionButton>
            </PageHeaderActions>
          </PageHeaderBar>
        </PageHeader>
      </PageHeaderBand>

      {/* Searched by name, and narrowed to either kind. */}
      <div className='mt-5 flex flex-wrap items-center gap-3'>
        <SearchInput
          aria-label='Search assessments'
          className='min-w-0 max-w-xs flex-1'
          onChange={setQuery}
          placeholder='Search assessments'
          value={query}
        />
        <SegmentedControl aria-label='Which assessments' onValueChange={(v) => v && setKind(v as typeof kind)} size='sm' value={kind}>
          <SegmentedControlItem value='all'>
            All <span className='tabular-nums'>{REPORT_ASSESSMENTS.length + custom.length}</span>
          </SegmentedControlItem>
          <SegmentedControlItem value='default'>
            Default <span className='tabular-nums'>{REPORT_ASSESSMENTS.length}</span>
          </SegmentedControlItem>
          <SegmentedControlItem value='custom'>
            Custom <span className='tabular-nums'>{custom.length}</span>
          </SegmentedControlItem>
        </SegmentedControl>
      </div>

      <DataTable<SavedCustomOrder>
        className='mt-3'
        columns={columns}
        data={saved.data ? rows : undefined}
        density='compact'
        empty={
          <EmptyState
            actionLabel='Create assessment'
            description='Pick the insights you need once, then order them for any business.'
            onAction={create}
            title='No assessments yet'
          />
        }
        error={
          saved.isError ? (
            <ErrorState
              description='Try again in a moment.'
              onAction={() => saved.refetch()}
              title='Couldn’t load assessments'
            />
          ) : undefined
        }
        getRowId={order => order.id}
        loading={saved.isLoading}
        // A custom one opens its page; a default has none of its own.
        rowIntent={{
          kind: 'detail',
          onOpen: order => {
            if (!isDefault(order)) navigate(workflowPath(order.id))
          }
        }}
        skeletonRowHeight={56}
      />

      {saved.data && saved.data.length > 0 && (
        <Text className='mt-3' size='xs' tone='secondary'>
          Editing an assessment never changes reports already run with it.
        </Text>
      )}

      <ConfirmDialog
        confirmLabel='Delete'
        description='Reports already placed with it are not affected.'
        isConfirming={isDeleting}
        isOpen={pendingDelete !== null}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title={`Delete “${pendingDelete?.name ?? ''}”?`}
        tone='danger'
      />
    </PageContainer>
  )
}


