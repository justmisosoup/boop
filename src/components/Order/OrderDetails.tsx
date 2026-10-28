import { Fragment, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'

import { useFormState } from 'react-hook-form'
import { z } from 'zod'

import {
  ActionButton,
  ArrayField,
  Form,
  InlineAlert,
  MetaChip,
  PageHeadingCount,
  Text,
  Tooltip,
  useFormContext,
  useMiddeskForm,
  useToast
} from '@/core'
import cya from '@/utils/cya'
import { ChevronDown, CircleHelp } from 'lucide-react'
import { cn } from '@/utils/twUtils'

import { combineConfigs, ORDER_CATALOG, requiredInputsFor } from '../../lib/customOrders/catalog'
import { optionalInputs } from '../../lib/customOrders/model'
import type { InputKey, InputRequirement } from '../../lib/customOrders/types'
import type { BusinessRecord } from '../../lib/deriveResults'
import { ALL, byId } from '../../lib/records'
import { displayName } from '../../lib/businessNames'
import { useSavedWorkflows } from '../../lib/savedWorkflows'
import { REPORT_ASSESSMENTS } from '../../lib/reportAssessments'
import { STATE_NAMES } from '../../lib/states'
import type { OrderSelection } from '../../pages/OrderPage'
import { SectionTitle } from '../Assessments/SectionTitle'
import { BusinessNameField, SelectInputField, TextInputField } from './fields'
import { ArrayFieldItem, OrderPageFrame, Row, Title } from './parts'

/**
 * Business details for the workflows chosen: ~/Projects/prototype's
 * `CustomOrder/Details.tsx`, asking for every input any of them requires, and
 * offering the ones their insights can use.
 */

type Values = {
  name: string
  addresses: { id: string; address: string }[]
  url: string
  dba_name: string
  tin: string
  formation_state: string
  entity_type: string
  email_addresses: { id: string; email: string }[]
  phone_numbers: { id: string; phone_number: string }[]
  people_names: { id: string; personName: string; dob: string }[]
  person_ssn: string
}

const isAnyOf = (r: InputRequirement): r is { any_of: InputKey[] } => typeof r === 'object'

const uuid = () => crypto.randomUUID()

const emptyValues = (): Values => ({
  name: '',
  addresses: [{ id: uuid(), address: '' }],
  url: '',
  dba_name: '',
  tin: '',
  formation_state: '',
  entity_type: '',
  email_addresses: [{ id: uuid(), email: '' }],
  phone_numbers: [{ id: uuid(), phone_number: '' }],
  people_names: [{ id: uuid(), personName: '', dob: '' }],
  person_ssn: ''
})

/**
 * What we already know about a business, as the form's values: its submitted
 * name, addresses, TIN, website, DBA, formation and people. Ordering another
 * assessment starts from these rather than a blank form; every one can be
 * edited.
 */
const detailsOf = (record: BusinessRecord): Values => {
  const empty = emptyValues()
  const submittedAddresses = record.addresses.filter((a) => a.submitted)
  const addresses = (submittedAddresses.length ? submittedAddresses : record.addresses.slice(0, 1)).map((a) => ({
    id: uuid(),
    address: a.fullAddress
  }))
  const people = (record.people ?? []).filter((p) => p.submitted)
  return {
    ...empty,
    name: record.names.find((n) => n.type === 'legal' && n.submitted)?.name ?? record.name,
    addresses: addresses.length ? addresses : empty.addresses,
    url: (record.website as { url?: string } | null)?.url ?? '',
    dba_name: record.names.find((n) => n.type === 'dba' && n.submitted)?.name ?? '',
    tin: (record.tin as { tin?: string } | null)?.tin ?? '',
    formation_state: record.formation?.state ?? '',
    entity_type: record.formation?.entityType ?? '',
    people_names: people.length ? people.map((p) => ({ id: uuid(), personName: p.name, dob: '' })) : empty.people_names
  }
}

/** The fields the reader changed, as a PATCH body: only those. */
const changedFields = (now: ReturnType<typeof toPayload>, was: ReturnType<typeof toPayload>) =>
  Object.fromEntries(
    (Object.keys(now) as Array<keyof typeof now>)
      .filter((k) => JSON.stringify(now[k]) !== JSON.stringify(was[k]))
      .map((k) => [k, now[k]])
  )

// The value each input key reads from the form's fields.
const valueOf = (values: Values, key: InputKey): string => {
  switch (key) {
    case 'name':
      return values.name
    case 'address':
      return values.addresses[0]?.address ?? ''
    case 'website_url':
      return values.url
    case 'tin':
      return values.tin
    case 'dba_name':
      return values.dba_name
    case 'formation_state':
      return values.formation_state ?? ''
    case 'entity_type':
      return values.entity_type
    case 'email':
      return values.email_addresses[0]?.email ?? ''
    case 'phone':
      return values.phone_numbers[0]?.phone_number ?? ''
    case 'person':
      return values.people_names[0]?.personName ?? ''
    case 'person_dob':
      return values.people_names[0]?.dob ?? ''
    case 'person_ssn':
      return values.person_ssn
  }
}

const buildSchema = (required: InputRequirement[]) =>
  z.custom<Values>().superRefine((values, ctx) => {
    for (const r of required) {
      if (isAnyOf(r)) {
        if (!r.any_of.some((k) => valueOf(values, k).trim())) {
          ctx.addIssue({
            code: 'custom',
            path: [r.any_of[0]],
            message: 'Required'
          })
        }
      } else if (!valueOf(values, r).trim()) {
        ctx.addIssue({ code: 'custom', path: [r], message: 'Required' })
      }
    }
    if (values.tin.trim() && !/^\d{2}-?\d{7}$/.test(values.tin.trim())) {
      ctx.addIssue({ code: 'custom', path: ['tin'], message: 'Invalid TIN' })
    }
  })

/** The POST /v1/businesses body, as the source's `toPayload` builds it. */
const toPayload = (values: Values) => {
  const addresses = values.addresses.map((a) => a.address.trim()).filter(Boolean)
  const emails = values.email_addresses.map((e) => e.email.trim()).filter(Boolean)
  const phones = values.phone_numbers.map((p) => p.phone_number.trim()).filter(Boolean)
  const people = values.people_names.filter((p) => p.personName.trim())
  const formationState = values.formation_state?.trim() ?? ''
  const entityType = values.entity_type.trim()
  return {
    name: values.name.trim(),
    ...(addresses.length && {
      addresses: addresses.map((full_address) => ({ full_address }))
    }),
    ...(values.url.trim() && { website: { url: values.url.trim() } }),
    ...(values.tin.trim() && { tin: { tin: values.tin.trim() } }),
    ...(values.dba_name.trim() && {
      names: [{ name: values.dba_name.trim(), name_type: 'dba' }]
    }),
    ...((formationState || entityType) && {
      formation: {
        ...(formationState && { formation_state: formationState }),
        ...(entityType && { entity_type: entityType })
      }
    }),
    ...(emails.length && {
      email_addresses: emails.map((email) => ({ email }))
    }),
    ...(phones.length && {
      phone_numbers: phones.map((phone_number) => ({ phone_number }))
    }),
    ...(people.length && {
      people: people.map((p, i) => ({
        name: p.personName.trim(),
        ...(p.dob && { dob: p.dob }),
        ...(i === 0 && values.person_ssn.trim() && { ssn: values.person_ssn.trim() })
      }))
    })
  }
}

type ErrorState = { header: string; messages: string[] }

/**
 * The details step's state, for the order page and the business's Run
 * assessment dialog alike: the assessments chosen, the fields they need and can
 * use, the form (prefilled from the business when there is one), and placing
 * the order.
 */
export const useOrderDetails = ({
  selection,
  onPlaced,
  prefill
}: {
  selection: OrderSelection
  onPlaced: (count: number) => void
  /** Details the reader already gave — a TIN submitted from TIN Match — over the business's own. */
  prefill?: { tin?: string }
}) => {
  const { showToast } = useToast()
  const saved = useSavedWorkflows()
  // What was picked: the report's assessments and the saved ones, each its
  // own workflow on the business.
  const workflows = [...REPORT_ASSESSMENTS, ...saved].filter((w) => selection.workflowIds.includes(w.id))
  const existing = selection.businessId ? byId(selection.businessId) : undefined
  const config = useMemo(() => combineConfigs(workflows), [workflows])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<ErrorState>({ header: '', messages: [] })

  // What the assessments need is required; what their insights can use is
  // offered, named for what it is used for. The business's own details are
  // prefilled from what we know, and every one can be edited.
  const required = requiredInputsFor(config).required
  const optional = optionalInputs(ORDER_CATALOG, config, required)
  const requiredKeys = required.flatMap((r) => (isAnyOf(r) ? r.any_of : [r]))
  // Every business detail an order takes is offered — what isn't required is
  // optional. A person's date of birth and SSN only when a package screens
  // people with them, or an insight can use them.
  const PERSON_ONLY: InputKey[] = ['person_dob', 'person_ssn']
  const shown = new Set(
    ORDER_CATALOG.inputs
      .map((i) => i.key)
      .filter((k) => !PERSON_ONLY.includes(k) || requiredKeys.includes(k) || optional.some((o) => o.key === k))
  )
  const isRequired = (key: InputKey) => required.includes(key)
  const usedFor = (key: InputKey) => (isRequired(key) ? undefined : optional.find((o) => o.key === key)?.usedFor)

  const schema = useMemo(() => buildSchema(required), [required.map((r) => JSON.stringify(r)).join()])
  const initial = useMemo(() => {
    const base = existing ? detailsOf(existing) : emptyValues()
    return prefill?.tin ? { ...base, tin: prefill.tin } : base
  }, [existing, prefill?.tin])
  const form = useMiddeskForm<Values>({
    defaultValues: initial,
    schema: schema as unknown as z.ZodType<Values, Values>
  })
  const { trigger } = form

  // Validate on mount, and whenever the assessments chosen change what is
  // required, so a required field we don't hold gates the submit.
  useEffect(() => {
    void trigger()
  }, [trigger, schema])

  // An existing business picked from the name field: its details, in place of
  // what was typed.
  const firstInitial = useRef(initial)
  useEffect(() => {
    if (initial === firstInitial.current) return
    firstInitial.current = initial
    form.reset(initial)
    void trigger()
  }, [initial, form, trigger])

  const dryRun = new URLSearchParams(window.location.search).has('dryRun')
  // One order at a time: a second click while one is sending does nothing.
  const inFlight = useRef(false)

  const place = async (values: Values) => {
    if (inFlight.current) return
    inFlight.current = true
    // Read when sending, not when the page drew: the address decides.
    const dryRun = new URLSearchParams(window.location.search).has('dryRun')
    setSubmitting(true)
    setError({ header: '', messages: [] })
    try {
      const res = await fetch(`/api/order${dryRun ? '?dryRun=1' : ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: existing?.id,
          body: toPayload(values),
          // Only what the reader changed goes back to the business.
          ...(existing && {
            patch: changedFields(toPayload(values), toPayload(initial))
          }),
          workflows: workflows.map((w) => ({
            id: w.id,
            name: w.name,
            config: {
              packages: w.packages,
              insight_groups: w.insight_groups,
              status_overrides: w.status_overrides
            }
          }))
        })
      })
      const body = await res.json()
      if (!res.ok) {
        setError({
          header: 'The following errors occurred:',
          messages: (body.errors ?? []).map((e: { message: string }) => e.message)
        })
        return
      }
      if (dryRun) {
        console.info('Run assessment (not sent)', body)
        showToast({
          text: 'Not sent — the request is logged to the console',
          appearance: 'success'
        })
        return
      }
      onPlaced(workflows.length)
    } catch {
      setError({ header: 'Couldn’t reach the order endpoint.', messages: [] })
    } finally {
      inFlight.current = false
      setSubmitting(false)
    }
  }

  return {
    form,
    workflows,
    existing,
    shown,
    isRequired,
    usedFor,
    place,
    submitting,
    error,
    dryRun
  }
}

export type OrderDetailsState = ReturnType<typeof useOrderDetails>

/** "Run 2 assessments" — the submit's label. */
export const runLabel = (count: number) =>
  `Run ${count === 1 ? 'assessment' : `${count} assessments`}`

/** The fields, and any error placing the order, inside the form. */
export const OrderDetailsForm = ({
  state,
  onPickBusiness,
  children
}: {
  state: OrderDetailsState
  /** A new business's name suggests the ones already held; picking one runs on it. */
  onPickBusiness?: (business: BusinessRecord) => void
  children?: ReactNode
}) => (
  <Form form={state.form} onSubmit={state.place}>
    <WorkflowFields
      onPickBusiness={state.existing ? undefined : onPickBusiness}
      isRequired={state.isRequired}
      label={(key) => ORDER_CATALOG.inputs.find((i) => i.key === key)?.label ?? key}
      shown={state.shown}
      usedFor={state.usedFor}
    />
    {state.error.header && (
      <InlineAlert className='mt-4' title={state.error.header} tone='danger'>
        {state.error.messages.length > 0 && (
          <ul className='m-0 list-disc pl-5'>
            {state.error.messages.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}
      </InlineAlert>
    )}
    {children}
  </Form>
)

/** The order page's details step: the form, with its own Back and Run buttons. */
export const OrderDetails = ({
  state,
  onBack,
  crumbs,
  onPickBusiness,
  onClearBusiness,
  close
}: {
  /** The page's order — kept by the page, so step one can run it outright. */
  state: OrderDetailsState
  /** Leaves the page, from the bar's close button. */
  close: () => void
  onBack: () => void
  /** Run on an existing business found by name, rather than a new one. */
  onPickBusiness?: (business: BusinessRecord) => void
  /** Undo that: back to a new business. Absent when opened from the business. */
  onClearBusiness?: () => void
  /** The page's breadcrumb, which carries the way back to the checklist. */
  crumbs?: ReactNode
}) => {
  return (
    <OrderPageFrame
      actions={
        <>
          <ActionButton onClick={onBack} type='button' variant='secondary'>
            Back
          </ActionButton>
          <RunButton state={state} />
        </>
      }
      close={close}
      crumbs={crumbs}
    >
      <Title>Business details</Title>
      {/* What runs, as chips; the business is the crumb's. */}
      <div className='mb-8 flex flex-wrap items-center gap-2'>
        <Text size='sm' tone='secondary'>
          Running
        </Text>
        {state.workflows.map((w) => (
          <MetaChip key={w.id} size='compact'>
            {w.name}
          </MetaChip>
        ))}
      </div>
      {state.existing && onClearBusiness && (
        <InlineAlert className='-mt-4 mb-8' size='compact' tone='info'>
          <div className='flex items-center justify-between gap-4'>
            <span>This will add to the existing business {state.existing.name}.</span>
            <ActionButton className='shrink-0' onClick={onClearBusiness} size='compact' type='button' variant='secondary'>
              Undo
            </ActionButton>
          </div>
        </InlineAlert>
      )}
      <OrderDetailsForm onPickBusiness={onPickBusiness} state={state} />
    </OrderPageFrame>
  )
}

/** Outside the form, in the bar: it submits the form through its handle. */
export const RunButton = ({ state, className }: { state: OrderDetailsState; className?: string }) => {
  const { isValid } = useFormState({ control: state.form.control })
  return (
    <ActionButton
      className={className}
      disabled={state.submitting || !isValid}
      isLoading={state.submitting}
      onClick={state.form.handleSubmit(state.place)}
      type='button'
      variant='primary'
      {...cya('PlaceCustomOrder')}
    >
      {runLabel(state.workflows.length)}
    </ActionButton>
  )
}

const STATE_OPTIONS = Object.entries(STATE_NAMES).map(([value, label]) => ({
  label,
  value
}))

// The regular form's fields, in its order, shown when a workflow needs them.
const WorkflowFields = ({
  onPickBusiness,
  shown,
  isRequired,
  label,
  usedFor
}: {
  onPickBusiness?: (business: BusinessRecord) => void
  shown: Set<InputKey>
  isRequired: (key: InputKey) => boolean
  label: (key: InputKey) => string
  /** What an optional field sharpens; undefined for a required one. */
  usedFor: (key: InputKey) => string[] | undefined
}) => {
  const { trigger } = useFormContext<Values>()
  // Open to start; the reader can fold it away.
  const [optionalOpen, setOptionalOpen] = useState(true)
  const optionalId = useId()
  const revalidate = () => setTimeout(() => void trigger(), 100)
  /** A field's label. Required ones carry the form's asterisk; optional ones
   *  carry nothing more. */
  const L = (_key: InputKey, text: ReactNode) => text

  // Each field by its input, in the regular form's order.
  const fields: [InputKey, ReactNode][] = [
    [
      'name',
      <Row>
        {onPickBusiness ? (
          <BusinessNameField<Values>
            businesses={ALL}
            label={L('name', 'Business name')}
            name='name'
            onPick={onPickBusiness}
            placeholder='Enter business name'
            required={isRequired('name')}
          />
        ) : (
          <TextInputField<Values>
            label={L('name', 'Business name')}
            name='name'
            placeholder='Enter business name'
            required={isRequired('name')}
          />
        )}
      </Row>
    ],
    [
      'address',
      <ArrayField<Values, 'addresses'> name='addresses'>
        {({ fields, append, remove }) => (
          <Row>
            {fields.map((field, i) => (
              <ArrayFieldItem
                addButtonText='Add additional address'
                canDelete={fields.length > 1}
                deleteAriaLabel='Delete address'
                isLast={fields.length - 1 === i}
                key={field.id}
                onAdd={() => {
                  append({ id: uuid(), address: '' })
                  revalidate()
                }}
                onDelete={() => {
                  remove(i)
                  revalidate()
                }}
              >
                <TextInputField<Values>
                  label={i === 0 ? L('address', 'Office address') : undefined}
                  name={`addresses.${i}.address`}
                  placeholder='Enter an address'
                  required={i === 0 && isRequired('address')}
                />
              </ArrayFieldItem>
            ))}
          </Row>
        )}
      </ArrayField>
    ],
    [
      'dba_name',
      <Row>
        <TextInputField<Values>
          label={
            <span className='flex items-center gap-1'>
              {L('dba_name', 'DBA name')}
              <Tooltip
                content='We collect DBA (Doing Business As) names to run against watchlists'
                placement='right'
                trigger={<CircleHelp aria-hidden='true' size={14} />}
              />
            </span>
          }
          name='dba_name'
          placeholder='Enter DBA name'
          required={isRequired('dba_name')}
        />
      </Row>
    ],
    [
      'tin',
      <Row>
        <TextInputField<Values>
          label={L('tin', 'TIN')}
          name='tin'
          placeholder='XX-XXXXXXX'
          required={isRequired('tin')}
          mask='ein'
        />
      </Row>
    ],
    [
      'person',
      <ArrayField<Values, 'people_names'> name='people_names'>
        {({ fields, append, remove }) => (
          <Row>
            {fields.map((field, i) => (
              <ArrayFieldItem
                addButtonText='Add additional person'
                canDelete={fields.length > 1}
                deleteAriaLabel='Delete person'
                isLast={fields.length - 1 === i}
                key={field.id}
                onAdd={() => {
                  append({ id: uuid(), personName: '', dob: '' })
                  revalidate()
                }}
                onDelete={() => {
                  remove(i)
                  revalidate()
                }}
              >
                {shown.has('person_dob') ? (
                  <div className='grid grid-cols-[2fr_1fr] items-end gap-x-2'>
                    <TextInputField<Values>
                      label={i === 0 ? L('person', 'Associated person') : undefined}
                      name={`people_names.${i}.personName`}
                      placeholder='Enter first and last name'
                    />
                    <TextInputField<Values>
                      label={i === 0 ? L('person_dob', 'Date of birth') : undefined}
                      name={`people_names.${i}.dob`}
                      placeholder='MM/DD/YYYY'
                      mask='date'
                    />
                  </div>
                ) : (
                  <TextInputField<Values>
                    label={i === 0 ? L('person', 'Associated person') : undefined}
                    name={`people_names.${i}.personName`}
                    placeholder='Enter first and last name'
                  />
                )}
              </ArrayFieldItem>
            ))}
          </Row>
        )}
      </ArrayField>
    ],
    [
      'person_ssn',
      <Row>
        <TextInputField<Values>
          label={L('person_ssn', label('person_ssn'))}
          name='person_ssn'
          placeholder='XXX-XX-XXXX'
          required={isRequired('person_ssn')}
        />
      </Row>
    ],
    [
      'formation_state',
      <Row>
        <SelectInputField<Values>
          label={L('formation_state', 'Formation state')}
          name='formation_state'
          options={STATE_OPTIONS}
          placeholder='Select a formation state'
          required={isRequired('formation_state')}
        />
      </Row>
    ],
    [
      'entity_type',
      <Row>
        <TextInputField<Values>
          label={L('entity_type', label('entity_type'))}
          name='entity_type'
          placeholder='Enter entity type'
          required={isRequired('entity_type')}
        />
      </Row>
    ],
    [
      'website_url',
      <Row>
        <TextInputField<Values>
          label={L('website_url', 'Website')}
          name='url'
          placeholder='www.website.com'
          required={isRequired('website_url')}
        />
      </Row>
    ],
    [
      'email',
      <ArrayField<Values, 'email_addresses'> name='email_addresses'>
        {({ fields, append, remove }) => (
          <Row>
            {fields.map((field, i) => (
              <ArrayFieldItem
                addButtonText='Add additional email address'
                canDelete={fields.length > 1}
                deleteAriaLabel='Delete email address'
                isLast={fields.length - 1 === i}
                key={field.id}
                onAdd={() => {
                  append({ id: uuid(), email: '' })
                  revalidate()
                }}
                onDelete={() => {
                  remove(i)
                  revalidate()
                }}
              >
                <TextInputField<Values>
                  label={i === 0 ? L('email', 'Email address') : undefined}
                  name={`email_addresses.${i}.email`}
                  placeholder='Enter email'
                  required={i === 0 && isRequired('email')}
                />
              </ArrayFieldItem>
            ))}
          </Row>
        )}
      </ArrayField>
    ],
    [
      'phone',
      <ArrayField<Values, 'phone_numbers'> name='phone_numbers'>
        {({ fields, append, remove }) => (
          <Row>
            {fields.map((field, i) => (
              <ArrayFieldItem
                addButtonText='Add additional phone number'
                canDelete={fields.length > 1}
                deleteAriaLabel='Delete phone number'
                isLast={fields.length - 1 === i}
                key={field.id}
                onAdd={() => {
                  append({ id: uuid(), phone_number: '' })
                  revalidate()
                }}
                onDelete={() => {
                  remove(i)
                  revalidate()
                }}
              >
                <TextInputField<Values>
                  label={i === 0 ? L('phone', 'Phone number') : undefined}
                  name={`phone_numbers.${i}.phone_number`}
                  placeholder='(XXX) XXX-XXXX'
                  required={i === 0 && isRequired('phone')}
                  mask='phone'
                />
              </ArrayFieldItem>
            ))}
          </Row>
        )}
      </ArrayField>
    ]
  ]
  const visible = fields.filter(([key]) => shown.has(key))
  const needed = visible.filter(([key]) => isRequired(key))
  const optional = visible.filter(([key]) => !isRequired(key))

  // The fields themselves stay mounted while folded, so what is in them is kept.
  const fieldsOf = (group: [InputKey, ReactNode][]) =>
    group.map(([key, node]) => <Fragment key={key}>{node}</Fragment>)

  return (
    // What the assessments need, then what they can use, each under its heading.
    <div className='flex flex-col gap-10'>
      {needed.length > 0 && (
        <section aria-label='Required fields' className='flex flex-col gap-5'>
          {/* Counted, as Available assessments is. */}
          <SectionTitle className='flex items-center gap-2'>
            Required fields
            <PageHeadingCount>{needed.length}</PageHeadingCount>
          </SectionTitle>
          {fieldsOf(needed)}
        </section>
      )}
      {optional.length > 0 && (
        <section aria-label='Optional fields' className='flex flex-col gap-5'>
          <SectionTitle className='m-0'>
            <button
              aria-controls={optionalId}
              aria-expanded={optionalOpen}
              className='flex w-full items-center gap-2 text-left'
              onClick={() => setOptionalOpen((o) => !o)}
              type='button'
            >
              Optional fields
              <PageHeadingCount>{optional.length}</PageHeadingCount>
              <ChevronDown
                aria-hidden='true'
                className={cn(
                  // At the row's far right, under the fields' right edge.
                  'ml-auto text-text-secondary transition-transform duration-[var(--core-duration)] motion-reduce:transition-none',
                  optionalOpen && 'rotate-180'
                )}
                size={18}
              />
            </button>
          </SectionTitle>
          <div className={cn('flex flex-col gap-5', !optionalOpen && 'hidden')} id={optionalId}>
            {fieldsOf(optional)}
          </div>
        </section>
      )}
    </div>
  )
}
