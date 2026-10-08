import { useEffect, useMemo, useState } from 'react'

import { useNavigate } from 'react-router'
import { z } from 'zod'

import {
  ArrayField,
  Button,
  Form,
  FormSelectField,
  FormTextField,
  Tooltip,
  useFormContext,
  useMiddeskForm,
  useToast
} from '@/core'
import cya from '@/utils/cya'
import { CircleHelp } from 'lucide-react'

import { combineConfigs, ORDER_CATALOG, requiredInputsFor } from '../../lib/customOrders/catalog'
import { optionalInputs } from '../../lib/customOrders/model'
import type { InputKey, InputRequirement } from '../../lib/customOrders/types'
import { byId } from '../../lib/records'
import { useSavedWorkflows } from '../../lib/savedWorkflows'
import { STATE_NAMES } from '../../lib/states'
import type { OrderSelection } from '../../pages/OrderPage'
import { ArrayFieldItem, Back, ButtonContainer, Row, Title } from './parts'

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
          ctx.addIssue({ code: 'custom', path: [r.any_of[0]], message: 'Required' })
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
    ...(addresses.length && { addresses: addresses.map((full_address) => ({ full_address })) }),
    ...(values.url.trim() && { website: { url: values.url.trim() } }),
    ...(values.tin.trim() && { tin: { tin: values.tin.trim() } }),
    ...(values.dba_name.trim() && { names: [{ name: values.dba_name.trim(), name_type: 'dba' }] }),
    ...((formationState || entityType) && {
      formation: {
        ...(formationState && { formation_state: formationState }),
        ...(entityType && { entity_type: entityType })
      }
    }),
    ...(emails.length && { email_addresses: emails.map((email) => ({ email })) }),
    ...(phones.length && { phone_numbers: phones.map((phone_number) => ({ phone_number })) }),
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

export const OrderDetails = ({
  selection,
  onBack
}: {
  selection: OrderSelection
  onBack: () => void
}) => {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const saved = useSavedWorkflows()
  const workflows = saved.filter((w) => selection.workflowIds.includes(w.id))
  const existing = selection.businessId ? byId(selection.businessId) : undefined
  const config = useMemo(() => combineConfigs(workflows), [workflows])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<ErrorState>({ header: '', messages: [] })

  const label = (key: InputKey) => ORDER_CATALOG.inputs.find((i) => i.key === key)?.label ?? key
  // An existing business already has its details on file.
  const required = existing ? [] : requiredInputsFor(config).required
  const optional = existing ? [] : optionalInputs(ORDER_CATALOG, config, required)
  const requiredKeys = required.flatMap((r) => (isAnyOf(r) ? r.any_of : [r]))
  const shown = new Set(
    ORDER_CATALOG.inputs
      .map((i) => i.key)
      .filter(
        (k) =>
          (!existing && ORDER_CATALOG.context_inputs.includes(k)) ||
          requiredKeys.includes(k) ||
          optional.some((o) => o.key === k)
      )
  )
  const isRequired = (key: InputKey) => required.includes(key)

  const schema = useMemo(() => buildSchema(required), [required.map((r) => JSON.stringify(r)).join()])
  const form = useMiddeskForm<Values>({
    defaultValues: emptyValues(),
    schema: schema as unknown as z.ZodType<Values, Values>
  })
  const { trigger } = form

  // Validate on mount to reflect the empty form's validity in the submit gating.
  useEffect(() => {
    void trigger()
  }, [trigger])

  const place = async (values: Values, dryRun: boolean) => {
    setSubmitting(true)
    setError({ header: '', messages: [] })
    try {
      const res = await fetch(`/api/order${dryRun ? '?dryRun=1' : ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: existing?.id,
          body: existing ? { name: existing.name } : toPayload(values),
          workflows: workflows.map((w) => ({
            id: w.id,
            name: w.name,
            config: { packages: w.packages, insight_groups: w.insight_groups, status_overrides: w.status_overrides }
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
        console.info('Order (dry run)', body)
        showToast({ text: 'Dry run: request logged to the console', appearance: 'success' })
        return
      }
      showToast({ text: 'Order placed', appearance: 'success' })
      navigate('/businesses')
    } catch {
      setError({ header: 'Couldn’t reach the order endpoint.', messages: [] })
    } finally {
      setSubmitting(false)
    }
  }

  const dryRun = new URLSearchParams(window.location.search).has('dryRun')

  return (
    <Form form={form} onSubmit={(values) => place(values, dryRun)}>
      <Back onClick={onBack}>Back to custom order selection</Back>
      <Title>Business Information</Title>
      <div className='mb-6 text-base text-[var(--core-color-text-secondary)]'>
        Ordering: {workflows.map((w) => w.name).join(', ')}
        {existing && ` for ${existing.name}`}
      </div>

      <WorkflowFields isRequired={isRequired} label={label} shown={shown} />

      {error.header && (
        <div className='mt-3 text-sm text-[var(--core-color-text-danger)]' role='alert'>
          {error.header}
          {error.messages.length > 0 && (
            <ul className='list-disc pl-5'>
              {error.messages.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className='mt-6'>
        <ButtonContainer>
          <Button onClick={onBack} type='cancel'>
            Back
          </Button>
          <PlaceOrderButton dryRun={dryRun} submitting={submitting} />
        </ButtonContainer>
      </div>
    </Form>
  )
}

const PlaceOrderButton = ({ submitting, dryRun }: { submitting: boolean; dryRun: boolean }) => {
  const {
    formState: { isValid }
  } = useFormContext<Values>()
  return (
    <Button disabled={submitting || !isValid} type='submit' {...cya('PlaceCustomOrder')}>
      {dryRun ? 'Place Order (dry run)' : 'Place Order'}
    </Button>
  )
}

const STATE_OPTIONS = Object.entries(STATE_NAMES).map(([value, label]) => ({ label, value }))

// The regular form's fields, in its order, shown when a workflow needs them.
const WorkflowFields = ({
  shown,
  isRequired,
  label
}: {
  shown: Set<InputKey>
  isRequired: (key: InputKey) => boolean
  label: (key: InputKey) => string
}) => {
  const { trigger } = useFormContext<Values>()
  const revalidate = () => setTimeout(() => void trigger(), 100)

  return (
    <>
      {shown.has('name') && (
        <Row>
          <FormTextField<Values>
            label='Business name'
            name='name'
            placeholder='Enter business name'
            required={isRequired('name')}
            showError={false}
          />
        </Row>
      )}
      {shown.has('address') && (
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
                  <FormTextField<Values>
                    label={i === 0 ? 'Office address' : ''}
                    name={`addresses.${i}.address`}
                    placeholder='Enter an address'
                    required={i === 0 && isRequired('address')}
                    showError={false}
                  />
                </ArrayFieldItem>
              ))}
            </Row>
          )}
        </ArrayField>
      )}
      {shown.has('dba_name') && (
        <Row>
          <FormTextField<Values>
            label={
              <span className='flex items-center gap-1'>
                DBA name
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
            showError={false}
          />
        </Row>
      )}
      {shown.has('tin') && (
        <Row>
          <FormTextField<Values>
            label='Taxpayer Identification Number TIN/EIN'
            name='tin'
            placeholder='XX-XXXXXXX'
            required={isRequired('tin')}
            showError={false}
            type='ein'
          />
        </Row>
      )}
      {shown.has('person') && (
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
                      <FormTextField<Values>
                        label={i === 0 ? 'Associated person' : ''}
                        name={`people_names.${i}.personName`}
                        placeholder='Enter first and last name'
                        showError={false}
                      />
                      <FormTextField<Values>
                        label={i === 0 ? 'Date of Birth' : ''}
                        name={`people_names.${i}.dob`}
                        placeholder='MM/DD/YYYY'
                        showError={false}
                        type='date'
                      />
                    </div>
                  ) : (
                    <FormTextField<Values>
                      label={i === 0 ? 'Associated person' : ''}
                      name={`people_names.${i}.personName`}
                      placeholder='Enter first and last name'
                      showError={false}
                    />
                  )}
                </ArrayFieldItem>
              ))}
            </Row>
          )}
        </ArrayField>
      )}
      {shown.has('person_ssn') && (
        <Row>
          <FormTextField<Values>
            label={label('person_ssn')}
            name='person_ssn'
            placeholder='XXX-XX-XXXX'
            required={isRequired('person_ssn')}
            showError={false}
          />
        </Row>
      )}
      {shown.has('formation_state') && (
        <Row>
          <FormSelectField<Values>
            isClearable
            label='Formation state'
            name='formation_state'
            options={STATE_OPTIONS}
            placeholder='Select a formation state'
            required={isRequired('formation_state')}
            showError={false}
          />
        </Row>
      )}
      {shown.has('entity_type') && (
        <Row>
          <FormTextField<Values>
            label={label('entity_type')}
            name='entity_type'
            placeholder='Enter entity type'
            required={isRequired('entity_type')}
            showError={false}
          />
        </Row>
      )}
      {shown.has('website_url') && (
        <Row>
          <FormTextField<Values>
            label='Website'
            name='url'
            placeholder='www.website.com'
            required={isRequired('website_url')}
            showError={false}
          />
        </Row>
      )}
      {shown.has('email') && (
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
                  <FormTextField<Values>
                    label={i === 0 ? 'Email address' : ''}
                    name={`email_addresses.${i}.email`}
                    placeholder='Enter email'
                    required={i === 0 && isRequired('email')}
                    showError={false}
                  />
                </ArrayFieldItem>
              ))}
            </Row>
          )}
        </ArrayField>
      )}
      {shown.has('phone') && (
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
                  <FormTextField<Values>
                    label={i === 0 ? 'Phone number' : ''}
                    name={`phone_numbers.${i}.phone_number`}
                    placeholder='(XXX) XXX-XXXX'
                    required={i === 0 && isRequired('phone')}
                    showError={false}
                    type='phone'
                  />
                </ArrayFieldItem>
              ))}
            </Row>
          )}
        </ArrayField>
      )}
    </>
  )
}
