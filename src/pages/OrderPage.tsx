import { useEffect, useState } from 'react'

import { ChevronDown } from 'lucide-react'
import { useFormState } from 'react-hook-form'

import { Link, useLocation, useNavigate } from 'react-router'

import { ActionButton, AppShellRoot, PageBreadcrumb, PageBreadcrumbItem, PageHeadingCount, Menu, MenuContent, MenuItem, MenuTrigger, useToast } from '@/core'

import { AssessmentChecklist } from '../components/Order/AssessmentChecklist'
import { SectionTitle } from '../components/Assessments/SectionTitle'
import { useSavedWorkflows } from '../lib/savedWorkflows'
import { displayName } from '../lib/businessNames'
import { byId } from '../lib/records'
import { OrderDetails, RunButton, useOrderDetails } from '../components/Order/OrderDetails'
import { OrderPageFrame, SubTitle, Title } from '../components/Order/parts'

/**
 * Run assessments: ~/Projects/prototype's Place order flow, Workflows tab only.
 *
 * Two steps: the assessments to run (one or many), then the details they need.
 * Opened from a business, the business is fixed — its details are prefilled
 * from what it already has, editable, and running returns to it. Opened from
 * the list, it runs on a new business. There is no business to choose either
 * way. Which packages the assessments take is the dev server's business
 * (`scripts/order-endpoint.ts`); nothing here names one.
 */

export type OrderSelection = {
  businessId: string | null
  workflowIds: string[]
}

export const OrderPage = () => {
  const navigate = useNavigate()
  const { state } = useLocation()
  const origin: string = typeof state?.origin === 'string' ? state.origin : '/businesses'
  const [selected, setSelected] = useState<string[]>(() =>
    typeof state?.customOrderId === 'string' ? [state.customOrderId] : []
  )
  const [page, setPage] = useState<'selection' | 'details'>('selection')
  const available = useSavedWorkflows()
  const close = () => navigate(origin)
  // Opened from a business: that business. Otherwise one found by name on the
  // details step, if the reader picks one — the assessments are added to it.
  const opened = typeof state?.businessId === 'string' ? byId(state.businessId) : undefined
  const [picked, setPicked] = useState<string | null>(null)
  const business = opened ?? byId(picked ?? undefined)

  // The order itself, kept across both steps: what the details step edits, and
  // what step one runs outright when the business already has it all.
  const { showToast } = useToast()
  const order = useOrderDetails({
    selection: { businessId: business?.id ?? null, workflowIds: selected },
    onPlaced: (count) => {
      showToast({ text: count === 1 ? 'Assessment started' : `${count} assessments started`, appearance: 'success' })
      navigate(picked ? `/businesses/${picked}` : origin)
    }
  })
  const { isValid } = useFormState({ control: order.form.control })
  const ready = Boolean(business) && selected.length > 0 && isValid
  // A refused order shows its errors on the details step, by the fields.
  useEffect(() => {
    if (order.error.header) setPage('details')
  }, [order.error.header])

  /**
   * The business page's own breadcrumb, carried on through both steps: the
   * business, then this flow, then the step — so each step reads as one level
   * further in, and the way back is the crumb, as everywhere else.
   */
  const LIGHT = 'font-normal text-text-secondary'
  const crumbs = (
    <PageBreadcrumb>
      {/* Opened from a business, the business leads; otherwise Assessments does. */}
      {business && (
        <PageBreadcrumbItem asChild>
          <Link className='no-underline' to={`/businesses/${business.id}`}>
            {displayName(business.name)}
          </Link>
        </PageBreadcrumbItem>
      )}
      {page === 'details' ? (
        <PageBreadcrumbItem asChild>
          <button className='no-underline' onClick={() => setPage('selection')} type='button'>
            Assessments
          </button>
        </PageBreadcrumbItem>
      ) : (
        <PageBreadcrumbItem className={LIGHT} current>
          Assessments
        </PageBreadcrumbItem>
      )}
      {page === 'details' && (
        <PageBreadcrumbItem className={LIGHT} current>
          Business details
        </PageBreadcrumbItem>
      )}
    </PageBreadcrumb>
  )

  return (
    // No app chrome, but the same theme root the shell gives every other page.
    <AppShellRoot themeMode='light'>
      <title>Run assessment • Middesk</title>
      {page === 'selection' ? (
        <OrderPageFrame
          actions={
            <>
              <ActionButton onClick={close} type='button' variant='secondary'>
                Cancel
              </ActionButton>
              {/* A business that already holds everything the assessments
                  need runs them from here; otherwise its details come next. */}
              {ready ? (
                // Run now, or look over the business's details first.
                <div className='flex items-center'>
                  <RunButton className='!rounded-r-none' state={order} />
                  <Menu>
                    <MenuTrigger asChild>
                      <ActionButton
                        aria-label='More ways to run'
                        className='!rounded-l-none border-l border-l-[var(--core-color-border-divider)] !px-2'
                        disabled={order.submitting}
                        type='button'
                        variant='primary'
                      >
                        <ChevronDown aria-hidden='true' size={16} />
                      </ActionButton>
                    </MenuTrigger>
                    <MenuContent align='end' themeMode='light'>
                      <MenuItem onSelect={() => setPage('details')}>Add business details</MenuItem>
                    </MenuContent>
                  </Menu>
                </div>
              ) : (
                <ActionButton
                  data-cy='CustomOrderSelectionNext'
                  disabled={selected.length === 0}
                  onClick={() => setPage('details')}
                  type='button'
                  variant='primary'
                >
                  Next
                </ActionButton>
              )}
            </>
          }
          close={close}
          crumbs={crumbs}
        >
          <div>
            <Title>{business ? displayName(business.name) : 'Run an assessment'}</Title>
            <SubTitle>
              {business
                ? 'Pick one or more assessments. Each runs on its own and adds a scored result to this business.'
                : 'Pick one or more assessments to run on a new business. Each runs on its own and is scored separately.'}
            </SubTitle>
            {/* The checklist's own heading, set apart from the page's. */}
            <SectionTitle className='mb-3 mt-8 flex items-center gap-2'>
              Assessments
              <PageHeadingCount>{available.length}</PageHeadingCount>
            </SectionTitle>
            <AssessmentChecklist
              onChange={setSelected}
              returnTo={business ? `/businesses/${business.id}` : '/order'}
              selected={selected}
            />
          </div>
        </OrderPageFrame>
      ) : (
        // The details step brings its own frame: its actions run its form.
        <OrderDetails
          close={close}
          crumbs={crumbs}
          onClearBusiness={picked ? () => setPicked(null) : undefined}
          onPickBusiness={opened ? undefined : (b) => setPicked(b.id)}
          onBack={() => setPage('selection')}
          state={order}
        />
      )}
    </AppShellRoot>
  )
}
