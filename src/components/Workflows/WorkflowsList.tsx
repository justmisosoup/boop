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
  Text,
  useToast
} from '@/core'
import { cn } from '@/utils/twUtils'
import { MoreHorizontal } from 'lucide-react'
import { useNavigate } from 'react-router'

import { useDeleteCustomOrderMutation } from '@/lib/customOrders/api'
import type { SavedCustomOrder } from '@/lib/customOrders/types'
import { useCustomOrderData } from '@/lib/customOrders/api'
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
          Edit order
        </MenuItem>
        <MenuItem onSelect={() => navigate(duplicateWorkflowPath(order.id))}>
          Duplicate order
        </MenuItem>
        <MenuSeparator />
        <MenuItem onSelect={() => onDelete(order)} tone='destructive'>
          Delete order
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

  const confirmDelete = async () => {
    if (!pendingDelete) return
    try {
      await deleteOrder(pendingDelete.id).unwrap()
      showToast({ text: 'Order deleted', appearance: 'success' })
    } catch {
      showToast({
        text: 'Couldn’t delete the order',
        appearance: 'error'
      })
    }
    setPendingDelete(null)
  }

  const columns = useMemo<DataTableColumnDef<SavedCustomOrder>[]>(
    () => [
      {
        id: 'name',
        header: 'Order',
        cell: ({ row }) => row.original.name,
        meta: { minWidth: 240 }
      },
      {
        id: 'created_by',
        header: 'Created by',
        cell: ({ row }) => row.original.created_by ?? '—',
        meta: { minWidth: 160, hideBelow: 'sm' }
      },
      {
        id: 'updated',
        header: 'Last updated',
        cell: ({ row }) => (
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
            <WorkflowActionsMenu
              onDelete={setPendingDelete}
              order={row.original}
            />
          </div>
        ),
        meta: { align: 'end', width: 'content', skeleton: false }
      }
    ],
    []
  )

  return (
    <PageContainer width='wide'>
      <title>Custom orders • Middesk</title>
      <PageHeaderBand className='px-0'>
        <PageHeader>
          <PageHeaderBar>
            <PageHeaderTitles>
              <PageHeading
                count={saved.data ? saved.data.length : null}
                weight='normal'
              >
                Custom orders
              </PageHeading>
              <PageDescription>
                Saved selections of insights your team can order from Place
                order.
              </PageDescription>
            </PageHeaderTitles>
            <PageHeaderActions>
              <ActionButton onClick={create} {...cya('CreateCustomOrder')}>
                Create order
              </ActionButton>
            </PageHeaderActions>
          </PageHeaderBar>
        </PageHeader>
      </PageHeaderBand>

      <DataTable<SavedCustomOrder>
        className='mt-5'
        columns={columns}
        data={saved.data}
        density='compact'
        empty={
          <EmptyState
            actionLabel='Create order'
            description='Pick the insights you need once, then order them for any business.'
            onAction={create}
            title='No custom orders yet'
          />
        }
        error={
          saved.isError ? (
            <ErrorState
              description='Try again in a moment.'
              onAction={() => saved.refetch()}
              title='Couldn’t load custom orders'
            />
          ) : undefined
        }
        getRowId={order => order.id}
        loading={saved.isLoading}
        rowIntent={{
          kind: 'detail',
          onOpen: order => navigate(workflowPath(order.id))
        }}
        skeletonRowHeight={56}
      />

      {saved.data && saved.data.length > 0 && (
        <Text className='mt-3' size='xs' tone='secondary'>
          Editing an order never changes reports already placed with it.
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


