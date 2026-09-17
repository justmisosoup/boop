import React from 'react'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { z } from 'zod'

import {
  ArrayField,
  FormError,
  FormField,
  Form,
  getSubmitState,
  useMiddeskForm
} from './MiddeskForm'

type Values = {
  email: string
  people: { name: string }[]
}

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  people: z.array(z.object({ name: z.string() }))
})

const TestForm = ({ onSubmit }: { onSubmit: (values: Values) => void }) => {
  const form = useMiddeskForm<Values>({
    defaultValues: { email: '', people: [] },
    schema
  })
  const submitState = getSubmitState(form)

  return (
    <Form form={form} onSubmit={onSubmit}>
      <FormField
        control={form.control}
        name='email'
        render={({ field }) => (
          <input
            aria-label='Email'
            placeholder='email@company.com'
            {...field}
          />
        )}
      />
      <FormError<Values> name='email' />
      <ArrayField<Values, 'people'> name='people'>
        {({ append, fields }) => (
          <>
            <button type='button' onClick={() => append({ name: 'Jane Doe' })}>
              Add person
            </button>
            <div data-testid='people-count'>{fields.length}</div>
          </>
        )}
      </ArrayField>
      <button type='submit' disabled={submitState.isSubmitDisabled}>
        Save
      </button>
    </Form>
  )
}

describe('MiddeskForm', () => {
  test('validates with Zod and submits current values', async () => {
    const onSubmit = vi.fn()

    render(<TestForm onSubmit={onSubmit} />)

    const email = screen.getByLabelText('Email')
    const save = screen.getByRole('button', { name: 'Save' })

    expect((save as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(email, { target: { value: 'not-an-email' } })

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe(
        'Enter a valid email address'
      )
      expect((save as HTMLButtonElement).disabled).toBe(true)
    })

    fireEvent.change(email, { target: { value: 'admin@example.com' } })

    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull()
      expect((save as HTMLButtonElement).disabled).toBe(false)
    })

    fireEvent.click(save)

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        email: 'admin@example.com',
        people: []
      })
    })
  })

  test('exposes array helpers through ArrayField', () => {
    render(<TestForm onSubmit={vi.fn()} />)

    expect(screen.getByTestId('people-count').textContent).toBe('0')

    fireEvent.click(screen.getByRole('button', { name: 'Add person' }))

    expect(screen.getByTestId('people-count').textContent).toBe('1')
  })
})
