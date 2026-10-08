import { useState } from 'react'

import { useLocation, useNavigate } from 'react-router'

import { ActionButton, AppShellRoot } from '@/core'

import { AssessmentChecklist } from '../components/Order/AssessmentChecklist'
import { assessmentsOf } from '../lib/assessments'
import { displayName } from '../lib/businessNames'
import { byId } from '../lib/records'
import { OrderDetails } from '../components/Order/OrderDetails'
import { ButtonContainer, OrderPageFrame, SubTitle, Title } from '../components/Order/parts'

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
  const close = () => navigate(origin)
  // Opened from a business: that business, and when it last ran each assessment.
  const business = typeof state?.businessId === 'string' ? byId(state.businessId) : undefined
  const ran = new Map<string, string>()
  for (const a of business ? assessmentsOf(business) : []) {
    if (!a.customOrderId || !a.orderedAt) continue
    const prior = ran.get(a.customOrderId)
    if (!prior || prior < a.orderedAt) ran.set(a.customOrderId, a.orderedAt)
  }

  return (
    // No app chrome, but the same theme root the shell gives every other page.
    <AppShellRoot themeMode='light'>
      <title>Run assessment • Middesk</title>
      <OrderPageFrame close={close}>
        {page === 'selection' ? (
          <div>
            <Title>{business ? `Run assessment on ${displayName(business.name)}` : 'Run an assessment'}</Title>
            <SubTitle>
              {business
                ? 'Choose the assessments to run. Each one reads its own insights and appears on this business.'
                : 'Choose the assessments to run on a new business. Each one reads its own insights.'}
            </SubTitle>
            <AssessmentChecklist
              lastRun={business ? (id) => ran.get(id) : undefined}
              onChange={setSelected}
              returnTo={business ? `/businesses/${business.id}` : '/order'}
              selected={selected}
            />
            <div className='mt-4'>
              <ButtonContainer>
                <ActionButton onClick={close} type='button' variant='secondary'>
                  Cancel
                </ActionButton>
                <ActionButton
                  data-cy='CustomOrderSelectionNext'
                  disabled={selected.length === 0}
                  onClick={() => setPage('details')}
                  type='button'
                  variant='primary'
                >
                  Next
                </ActionButton>
              </ButtonContainer>
            </div>
          </div>
        ) : (
          <OrderDetails
            done={origin}
            onBack={() => setPage('selection')}
            selection={{ businessId: business?.id ?? null, workflowIds: selected }}
          />
        )}
      </OrderPageFrame>
    </AppShellRoot>
  )
}
