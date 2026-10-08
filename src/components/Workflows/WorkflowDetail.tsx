import {
  ActionButton,
  ErrorState,
  Menu,
  MenuContent,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
  PageContainer,
  PageHeader,
  PageHeaderActions,
  PageHeaderBand,
  PageHeaderBar,
  PageHeaderTitles,
  PageHeading,
  SkeletonPage,
  Text
} from '@/core'
import { ChevronDown } from 'lucide-react'
import { useNavigate, useParams } from 'react-router'

import { useUpdateCustomOrderMutation } from '@/lib/customOrders/api'

import { draftFromSaved } from '@/lib/customOrders/model'
import type {
  SavedCustomOrder,
  WorkflowEnvironment
} from '@/lib/customOrders/types'
import { useCustomOrderData } from '@/lib/customOrders/api'
import cya from '@/utils/cya'

import { InsightsCard } from './AddedInsights'
import { AttributesCard } from './cards'
import { editWorkflowPath, WORKFLOWS_PATH } from './paths'
import { WorkflowTopbar } from './WorkflowTopbar'

const ENVIRONMENTS: {
  value: WorkflowEnvironment
  label: string
  description: string
}[] = [
  { value: 'draft', label: 'Draft', description: 'Not available to run.' },
  {
    value: 'sandbox',
    label: 'Sandbox',
    description: 'Runs in your sandbox environment.'
  },
  {
    value: 'production',
    label: 'Production',
    description: 'Runs in your live instance.'
  },
  {
    value: 'sandbox_and_production',
    label: 'Sandbox + production',
    description: 'Runs in sandbox and your live instance.'
  }
]

const Availability = ({ order }: { order: SavedCustomOrder }) => {
  const [updateOrder, { isLoading, isError }] = useUpdateCustomOrderMutation()
  const current = ENVIRONMENTS.find(e => e.value === order.environment)

  const changeEnvironment = (environment: WorkflowEnvironment) =>
    updateOrder({
      id: order.id,
      name: order.name,
      description: order.description,
      packages: order.packages,
      insight_groups: order.insight_groups,
      status_overrides: order.status_overrides,
      environment
    })

  return (
    <>
      {isError && (
        <Text className='m-0' size='sm' tone='danger'>
          Couldn’t update availability.
        </Text>
      )}
      <Menu modal={false}>
        <MenuTrigger asChild>
          <ActionButton
            aria-label={`Availability: ${current?.label}`}
            isLoading={isLoading}
            trailingIcon={<ChevronDown aria-hidden='true' size={14} />}
            variant='secondary'
            {...cya('WorkflowAvailability')}
          >
            {current?.label}
          </ActionButton>
        </MenuTrigger>
        <MenuContent align='end'>
          <MenuRadioGroup
            onValueChange={value =>
              changeEnvironment(value as WorkflowEnvironment)
            }
            value={order.environment}
          >
            {ENVIRONMENTS.map(e => (
              <MenuRadioItem key={e.value} value={e.value}>
                <span className='grid gap-0.5'>
                  {e.label}
                  <span className='text-muted-foreground text-xs'>
                    {e.description}
                  </span>
                </span>
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </MenuContent>
      </Menu>
    </>
  )
}

export const WorkflowDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { catalog, saved } = useCustomOrderData()
  const order = saved.data?.find(o => o.id === id)

  const body = (() => {
    if (catalog.isError || saved.isError) {
      return (
        <ErrorState
          description='Assessments aren’t available right now.'
          onAction={() => {
            catalog.refetch()
            saved.refetch()
          }}
          title='Couldn’t load this assessment'
        />
      )
    }
    if (!catalog.data || !saved.data) {
      return <SkeletonPage className='pt-0' subtitle={false} />
    }
    if (!order) {
      return (
        <ErrorState
          actionLabel='Back to assessments'
          description='It may have been deleted.'
          onAction={() => navigate(WORKFLOWS_PATH)}
          title='Couldn’t find that assessment'
        />
      )
    }
    const draft = draftFromSaved(order, catalog.data)

    return (
      <>
        <WorkflowTopbar
          actions={
            <>
              <ActionButton
                onClick={() => navigate(editWorkflowPath(order.id))}
                variant='secondary'
                {...cya('EditWorkflow')}
              >
                Edit
              </ActionButton>
              <ActionButton
                disabled={!order.availability.orderable}
                onClick={() =>
                  navigate('/order', {
                    state: { customOrderId: order.id }
                  })
                }
                variant='primary'
                {...cya('PlaceWorkflowOrder')}
              >
                Run assessment
              </ActionButton>
            </>
          }
          current={order.name}
        />
        <PageContainer width='comfortable'>
          <PageHeaderBand className='px-0'>
            <PageHeader>
              <PageHeaderBar>
                <PageHeaderTitles>
                  <PageHeading weight='normal'>{order.name}</PageHeading>
                </PageHeaderTitles>
                <PageHeaderActions>
                  <Availability order={order} />
                </PageHeaderActions>
              </PageHeaderBar>
            </PageHeader>
          </PageHeaderBand>

          <div className='mt-6 grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]'>
            <div className='flex min-w-0 flex-col gap-4'>
              <InsightsCard catalog={catalog.data} draft={draft} />
            </div>
            <div className='flex min-w-0 flex-col gap-4 lg:sticky lg:top-6'>
              <AttributesCard catalog={catalog.data} draft={draft} />
            </div>
          </div>
        </PageContainer>
      </>
    )
  })()

  return (
    <>
      <title>{`${order?.name ?? 'Assessment'} • Middesk`}</title>
      {catalog.data && saved.data && order ? (
        body
      ) : (
        <>
          <WorkflowTopbar current='Assessment' />
          <PageContainer width='comfortable'>{body}</PageContainer>
        </>
      )}
    </>
  )
}
