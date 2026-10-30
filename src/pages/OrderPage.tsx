import { useEffect, useMemo, useState } from 'react'

import { ChevronDown } from 'lucide-react'
import { useFormState } from 'react-hook-form'

import { Link, useLocation, useNavigate } from 'react-router'

import {
  ActionButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  PageBreadcrumb,
  PageBreadcrumbItem,
  PageHeadingCount,
  SearchInput,
  SegmentedControl,
  SegmentedControlItem,
  useToast
} from '@/core'

import { AssessmentChecklist } from '../components/Order/AssessmentChecklist'
import { SectionTitle } from '../components/Assessments/SectionTitle'
import { useSavedWorkflows } from '../lib/savedWorkflows'
import { displayName } from '../lib/businessNames'
import { byId } from '../lib/records'
import { readAssessments } from '../lib/assessments'
import { categoriesOf } from '../lib/deriveResults'
import { makeGroupFor } from '../lib/groups'
import { cardFor } from '../lib/reportCards'
import { REPORT_ASSESSMENTS, reportCardOf } from '../lib/reportAssessments'
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
  // A TIN submitted from the business's TIN Match: straight to its details, TIN filled in.
  const prefillTin: string | undefined = typeof state?.tin === 'string' ? state.tin : undefined
  const [page, setPage] = useState<'selection' | 'details'>(prefillTin ? 'details' : 'selection')
  const available = useSavedWorkflows()
  const close = () => navigate(origin)
  // Opened from a business: that business. Otherwise one found by name on the
  // details step, if the reader picks one — the assessments are added to it.
  const opened = typeof state?.businessId === 'string' ? byId(state.businessId) : undefined
  const [picked, setPicked] = useState<string | null>(null)
  const business = opened ?? byId(picked ?? undefined)
  // What the business already has, and when it last ran — so the list says
  // so, and they can be run again in one go. A saved assessment, by the
  // workflow ordered with it; a report assessment, by any workflow that read
  // its card (Full Business KYB reads every card).
  const ranAt = useMemo(() => {
    const at = new Map<string, string>()
    const note = (id: string, when: string) => {
      if (!at.has(id) || when > at.get(id)!) at.set(id, when)
    }
    if (!business) return at
    const groupFor = makeGroupFor(categoriesOf(business))
    for (const r of readAssessments(business)) {
      const when = r.assessment.completedAt ?? r.runAt
      if (!when) continue
      if (r.assessment.customOrderId) note(r.assessment.customOrderId, when)
      const cards = r.assessment.insights ? new Set(r.assessment.insights.map((k) => cardFor(k, groupFor))) : undefined
      for (const a of REPORT_ASSESSMENTS) {
        const card = reportCardOf(a.id)!
        if (!cards || cards.has(card)) note(a.id, when)
      }
    }
    return at
  }, [business])
  // Every assessment the page lists: the default ones (the report's), then the
  // account's custom ones — narrowed by kind and by what is searched.
  const orderable = [...REPORT_ASSESSMENTS, ...available]
  const [kind, setKind] = useState<'all' | 'default' | 'custom'>('all')
  const [query, setQuery] = useState('')
  const listed = (kind === 'default' ? REPORT_ASSESSMENTS : kind === 'custom' ? available : orderable).filter((a) =>
    a.name.toLowerCase().includes(query.trim().toLowerCase())
  )
  const existing = orderable.filter((a) => ranAt.has(a.id) && a.availability.orderable)

  // The order itself, kept across both steps: what the details step edits, and
  // what step one runs outright when the business already has it all.
  const { showToast } = useToast()
  const order = useOrderDetails({
    selection: { businessId: business?.id ?? null, workflowIds: selected },
    prefill: prefillTin ? { tin: prefillTin } : undefined,
    onPlaced: (count, attached) => {
      const word = attached ? 'added' : 'started'
      showToast({ text: count === 1 ? `Assessment ${word}` : `${count} assessments ${word}`, appearance: 'success' })
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
    // In the dashboard's body, under its nav: the shell gives the theme root.
    <>
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
            {/* Already run on this business: said once, with the way to run
                them all again — its details are on file, so Run places it. */}
            {existing.length > 0 && (
              <div className='mt-6 flex items-center justify-between gap-4 rounded-card border border-border bg-muted px-4 py-3'>
                <span className='text-sm text-text-primary'>
                  This business already has {existing.length === 1 ? `the ${existing[0].name} assessment` : `${existing.length} of these assessments`}.
                  <span className='text-text-secondary'> Run {existing.length === 1 ? 'it' : 'them'} again to refresh the results.</span>
                </span>
                <ActionButton
                  className='shrink-0'
                  onClick={() => setSelected([...new Set([...selected, ...existing.map((a) => a.id)])])}
                  size='compact'
                  type='button'
                  variant='secondary'
                >
                  {existing.length === 1 ? 'Re-run it' : 'Re-run all'}
                </ActionButton>
              </div>
            )}
            {/* Every assessment, one list: the default ones — the report's,
                by its names and in its order — then the account's custom
                ones. Searched by name, and narrowed to either kind. */}
            <SectionTitle className='mb-3 mt-8 flex items-center gap-2'>
              Assessments
              <PageHeadingCount>{listed.length}</PageHeadingCount>
            </SectionTitle>
            <div className='mb-3 flex flex-wrap items-center gap-3'>
              <SearchInput
                aria-label='Search assessments'
                className='min-w-0 flex-1'
                onChange={setQuery}
                placeholder='Search assessments'
                value={query}
              />
              <SegmentedControl aria-label='Which assessments' onValueChange={(v) => v && setKind(v as typeof kind)} size='sm' value={kind}>
                <SegmentedControlItem value='all'>
                  All <span className='tabular-nums'>{orderable.length}</span>
                </SegmentedControlItem>
                <SegmentedControlItem value='default'>
                  Default <span className='tabular-nums'>{REPORT_ASSESSMENTS.length}</span>
                </SegmentedControlItem>
                <SegmentedControlItem value='custom'>
                  Custom <span className='tabular-nums'>{available.length}</span>
                </SegmentedControlItem>
              </SegmentedControl>
            </div>
            {listed.length > 0 ? (
              <AssessmentChecklist
                items={listed}
                lastRun={business ? (id) => ranAt.get(id) : undefined}
                onChange={setSelected}
                returnTo={business ? `/businesses/${business.id}` : '/order'}
                selected={selected}
              />
            ) : (
              <p className='m-0 rounded-card border border-border bg-card px-4 py-3 text-text-secondary'>
                No assessments match “{query.trim()}”.
              </p>
            )}
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
    </>
  )
}
