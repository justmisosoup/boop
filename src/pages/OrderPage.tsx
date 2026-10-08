import { useMemo, useState } from 'react'

import { MoreHorizontal, Plus } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import { z } from 'zod'

import {
  AppShellRoot,
  Button,
  Combobox,
  ConfirmDialog,
  Form,
  FormCheckboxField,
  FormRadioField,
  IconActionButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  useFormContext,
  useMiddeskForm,
  useToast
} from '@/core'
import cya from '@/utils/cya'

import { OrderDetails } from '../components/Order/OrderDetails'
import {
  ButtonContainer,
  LinkText,
  OrderCard,
  OrderLabel,
  OrderPageFrame,
  SubTitle,
  Title
} from '../components/Order/parts'
import { duplicateWorkflowPath, editWorkflowPath, NEW_WORKFLOW_PATH } from '../components/Workflows/paths'
import { displayName } from '../lib/businessNames'
import { useDeleteCustomOrderMutation } from '../lib/customOrders/api'
import { ORDER_CATALOG } from '../lib/customOrders/catalog'
import { summarize } from '../lib/customOrders/model'
import type { SavedCustomOrder } from '../lib/customOrders/types'
import { ALL } from '../lib/records'
import { useSavedWorkflows } from '../lib/savedWorkflows'

/**
 * Place an order: ~/Projects/prototype's Place order flow, Workflows tab only.
 *
 * One change from the source: workflows are checkboxes, so one order can run
 * several. Which packages that takes is the dev server's business
 * (`scripts/order-endpoint.ts`); nothing here names one.
 */

type SelectionValues = {
  business_type: 'new' | 'existing'
  business_id: string
  workflows: Record<string, boolean>
}

export type OrderSelection = {
  businessId: string | null
  workflowIds: string[]
}

const ORDER_PATH = '/order'

const SelectBusinessType = () => {
  const { watch, setValue } = useFormContext<SelectionValues>()
  const isExisting = watch('business_type') === 'existing'
  const businessId = watch('business_id')
  const options = useMemo(
    () =>
      [...ALL]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((r) => ({ label: displayName(r.name), value: r.id })),
    []
  )
  return (
    <OrderCard>
      <FormRadioField<SelectionValues>
        bold
        label='Place an order on a new business'
        name='business_type'
        value='new'
      />
      <FormRadioField<SelectionValues>
        bold
        label='Add an order to an existing business'
        name='business_type'
        value='existing'
        {...cya('selectExistingBusiness')}
      />
      {isExisting && (
        <Combobox
          aria-label='Business'
          className='w-full'
          emptyMessage='No business by that name.'
          multiple={false}
          onChange={(value: string[]) =>
            setValue('business_id', value[0] ?? '', { shouldDirty: true, shouldValidate: true })
          }
          options={options}
          placeholder='Search for a business'
          searchPlaceholder='Business name'
          value={businessId ? [businessId] : []}
        />
      )}
    </OrderCard>
  )
}

const SavedOrderRow = ({
  order,
  onEdit,
  onDuplicate,
  onDelete
}: {
  order: SavedCustomOrder
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}) => {
  const { orderable, reason } = order.availability
  return (
    <li className='flex items-center justify-between gap-4' {...cya(`SavedCustomOrder-${order.name}`)}>
      <div className='min-w-0'>
        <FormCheckboxField<SelectionValues>
          bold
          disabled={!orderable}
          label={
            // A div, not a span: the checkbox styles every span inside it as its box.
            <div className='grid gap-1'>
              {order.name}
              <OrderLabel disabled={!orderable}>{orderable ? summarize(ORDER_CATALOG, order) : reason}</OrderLabel>
            </div>
          }
          name={`workflows.${order.id}`}
          {...cya('SelectSavedCustomOrder')}
        />
      </div>
      <div className='flex shrink-0 items-center gap-1'>
        <Menu>
          <MenuTrigger asChild>
            <IconActionButton aria-label={`Actions for ${order.name}`} type='button' variant='quiet'>
              <MoreHorizontal aria-hidden='true' />
            </IconActionButton>
          </MenuTrigger>
          <MenuContent align='end' themeMode='light'>
            <MenuItem onSelect={onEdit}>Edit</MenuItem>
            <MenuItem onSelect={onDuplicate}>Duplicate</MenuItem>
            <MenuSeparator />
            <MenuItem onSelect={onDelete} tone='destructive'>
              Delete
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </li>
  )
}

const SavedCustomOrders = () => {
  const navigate = useNavigate()
  const { watch, setValue } = useFormContext<SelectionValues>()
  const picked = watch('workflows')
  const anyPicked = Object.values(picked ?? {}).some(Boolean)
  const clear = () => setValue('workflows', {}, { shouldDirty: true, shouldValidate: true })
  const orders = useSavedWorkflows()
  const [deleteOrder, { isLoading: isDeleting }] = useDeleteCustomOrderMutation()
  const [pendingDelete, setPendingDelete] = useState<SavedCustomOrder | null>(null)
  const { showToast } = useToast()

  // Workflows are built on their own pages; saving there comes back here.
  const openBuilder = (path: string) => navigate(path, { state: { returnTo: ORDER_PATH } })

  const confirmDelete = async () => {
    if (!pendingDelete) return
    try {
      await deleteOrder(pendingDelete.id).unwrap()
      setValue(`workflows.${pendingDelete.id}`, false, { shouldValidate: true })
      showToast({ text: 'Order deleted', appearance: 'success' })
    } catch {
      showToast({ text: 'Couldn’t delete the order', appearance: 'error' })
    }
    setPendingDelete(null)
  }

  return (
    <>
      <OrderCard
        title={
          <>
            Custom orders
            {anyPicked && (
              <button onClick={clear} type='button'>
                <LinkText>Clear selection</LinkText>
              </button>
            )}
          </>
        }
      >
        <ul className='m-0 grid list-none gap-3 p-0'>
          {orders.map((order) => (
            <SavedOrderRow
              key={order.id}
              onDelete={() => setPendingDelete(order)}
              onDuplicate={() => openBuilder(duplicateWorkflowPath(order.id))}
              onEdit={() => openBuilder(editWorkflowPath(order.id))}
              order={order}
            />
          ))}
          {orders.length === 0 && (
            <li>
              <OrderLabel>No custom orders yet.</OrderLabel>
            </li>
          )}
        </ul>
      </OrderCard>

      {/* Sized like the cards above it, dashed so it reads as a slot for a new
          card rather than a card of its own. */}
      <button
        className='mb-4 flex w-full items-center gap-2 rounded-card border border-dashed border-border bg-transparent px-6 py-5 text-base font-bold text-foreground hover:bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--core-color-focus-ring)]'
        onClick={() => openBuilder(NEW_WORKFLOW_PATH)}
        type='button'
        {...cya('CreateCustomOrder')}
      >
        <Plus aria-hidden='true' size={16} />
        Create order
      </button>

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
    </>
  )
}

const NextButton = () => {
  const { watch } = useFormContext<SelectionValues>()
  const picked = Object.values(watch('workflows') ?? {}).some(Boolean)
  const existing = watch('business_type') === 'existing'
  const business = watch('business_id')
  return (
    <Button data-cy='CustomOrderSelectionNext' disabled={!picked || (existing && !business)} type='submit'>
      Next
    </Button>
  )
}

const Selection = ({
  initial,
  onNext,
  onCancel
}: {
  initial: OrderSelection
  onNext: (selection: OrderSelection) => void
  onCancel: () => void
}) => {
  const form = useMiddeskForm<SelectionValues>({
    defaultValues: {
      business_type: initial.businessId ? 'existing' : 'new',
      business_id: initial.businessId ?? '',
      workflows: Object.fromEntries(initial.workflowIds.map((id) => [id, true]))
    },
    schema: z.custom<SelectionValues>() as unknown as z.ZodType<SelectionValues, SelectionValues>
  })
  const submit = (values: SelectionValues) => {
    const workflowIds = Object.entries(values.workflows ?? {})
      .filter(([, on]) => on)
      .map(([id]) => id)
    if (!workflowIds.length) return
    if (values.business_type === 'existing' && !values.business_id) return
    onNext({ businessId: values.business_type === 'existing' ? values.business_id : null, workflowIds })
  }
  return (
    <div>
      <Title>Place an order</Title>
      <SubTitle>Select which business to place an order on, and the custom orders to run.</SubTitle>
      <Form form={form} onSubmit={submit}>
        <SelectBusinessType />
        <SavedCustomOrders />
        <ButtonContainer>
          <Button onClick={onCancel} type='cancel'>
            Cancel
          </Button>
          <NextButton />
        </ButtonContainer>
      </Form>
    </div>
  )
}

export const OrderPage = () => {
  const navigate = useNavigate()
  const { state } = useLocation()
  const origin: string = typeof state?.origin === 'string' ? state.origin : '/businesses'
  const [selection, setSelection] = useState<OrderSelection>(() => ({
    businessId: typeof state?.businessId === 'string' ? state.businessId : null,
    workflowIds: typeof state?.customOrderId === 'string' ? [state.customOrderId] : []
  }))
  const [page, setPage] = useState<'selection' | 'details'>('selection')
  const close = () => navigate(origin)

  return (
    // No app chrome, but the same theme root the shell gives every other page.
    <AppShellRoot themeMode='light'>
      <title>Place Order • Middesk</title>
      <OrderPageFrame close={close}>
        {page === 'selection' ? (
          <Selection
            initial={selection}
            onCancel={close}
            onNext={(next) => {
              setSelection(next)
              setPage('details')
            }}
          />
        ) : (
          <OrderDetails onBack={() => setPage('selection')} selection={selection} />
        )}
      </OrderPageFrame>
    </AppShellRoot>
  )
}
