import React from 'react'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { z } from 'zod'

import { FormSelectField, FormTextField } from './FormFields'
import { Form, getSubmitState, useMiddeskForm } from './MiddeskForm'

type Values = { email: string; events: string[] }

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  events: z.array(z.string()).min(1, 'Pick at least one event')
})

const EVENT_OPTIONS = [
  { label: 'Created', value: 'created' },
  { label: 'Updated', value: 'updated' }
]

const Harness = ({
  onSubmit = vi.fn(),
  defaultValues = { email: '', events: [] } as Values
}: {
  onSubmit?: (values: Values) => void
  defaultValues?: Values
}) => {
  const form = useMiddeskForm<Values>({ defaultValues, schema })
  const submitState = getSubmitState(form, { requireDirty: false })

  return (
    <Form form={form} onSubmit={onSubmit}>
      <FormTextField<Values>
        name='email'
        label='Email'
        placeholder='email@company.com'
      />
      <FormSelectField<Values>
        name='events'
        label='Events'
        isMulti
        options={EVENT_OPTIONS}
      />
      <button type='submit' disabled={submitState.isSubmitDisabled}>
        Save
      </button>
    </Form>
  )
}

describe('FormTextField', () => {
  test('shows a Zod error after blur and clears it once valid', async () => {
    render(<Harness />)

    const input = screen.getByLabelText('Email')

    expect(screen.queryByRole('alert')).toBeNull()

    fireEvent.change(input, { target: { value: 'not-an-email' } })
    fireEvent.blur(input)

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe(
        'Enter a valid email address'
      )
    })

    fireEvent.change(input, { target: { value: 'admin@example.com' } })

    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull()
    })
  })
})

describe('FormSelectField', () => {
  test('reflects the form value as selected option(s)', () => {
    render(
      <Harness defaultValues={{ email: 'a@b.com', events: ['updated'] }} />
    )

    expect(screen.getByText('Updated')).not.toBeNull()
  })

  test('renders the label and is searchable by it', () => {
    render(<Harness />)

    expect(screen.getByText('Events')).not.toBeNull()
  })
})

describe('FormTextField + FormSelectField submit wiring', () => {
  test('submit stays disabled until the form is valid', () => {
    render(<Harness />)

    expect(
      (screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement)
        .disabled
    ).toBe(true)
  })

  test('submits mapped text and select values when valid', async () => {
    const onSubmit = vi.fn()

    render(
      <Harness
        onSubmit={onSubmit}
        defaultValues={{ email: 'admin@example.com', events: ['created'] }}
      />
    )

    const save = screen.getByRole('button', {
      name: 'Save'
    }) as HTMLButtonElement

    await waitFor(() => expect(save.disabled).toBe(false))

    fireEvent.click(save)

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        email: 'admin@example.com',
        events: ['created']
      })
    })
  })
})
