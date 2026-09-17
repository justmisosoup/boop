import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { z } from 'zod'

import { Input } from '../Field'
import { FormControl } from './FormControl'
import { Form, useMiddeskForm } from './MiddeskForm'

type Values = { email: string }

const schema = z.object({ email: z.string().email('Enter a valid email.') })

const Harness = () => {
  const form = useMiddeskForm<Values>({ schema, defaultValues: { email: '' } })

  return (
    <Form form={form} onSubmit={() => undefined}>
      <FormControl
        control={form.control}
        description='For notifications only.'
        label='Work email'
        name='email'
      >
        {({ field }) => <Input type='email' {...field} />}
      </FormControl>
    </Form>
  )
}

describe('FormControl', () => {
  test('associates the label with the control via htmlFor/id', () => {
    render(<Harness />)

    expect(screen.getByLabelText('Work email').tagName).toBe('INPUT')
  })

  test('wires the description as the accessible description', () => {
    render(<Harness />)

    const input = screen.getByLabelText('Work email')
    const description = screen.getByText('For notifications only.')

    expect(input.getAttribute('aria-describedby')).toContain(description.id)
  })

  test('flows the value through react-hook-form', () => {
    render(<Harness />)

    const input = screen.getByLabelText('Work email') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'a@b.co' } })

    expect(input.value).toBe('a@b.co')
  })

  test('surfaces the validation error and marks the control invalid once touched', async () => {
    render(<Harness />)

    const input = screen.getByLabelText('Work email')
    fireEvent.change(input, { target: { value: 'nope' } })
    fireEvent.blur(input)

    const error = await screen.findByText('Enter a valid email.')

    expect(error).toBeTruthy()
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toContain(error.id)
  })
})
