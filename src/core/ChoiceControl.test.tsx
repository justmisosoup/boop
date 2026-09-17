import React from 'react'

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { Checkbox, RadioGroup, RadioItem } from './ChoiceControl'

describe('Checkbox', () => {
  test('calls onCheckedChange when checked state changes', () => {
    const onCheckedChange = vi.fn()

    render(
      <Checkbox onCheckedChange={onCheckedChange}>Require evidence</Checkbox>
    )

    fireEvent.click(screen.getByRole('checkbox', { name: 'Require evidence' }))

    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })

  test('keeps a persistent visual shell for unchecked and checked states', () => {
    const { container } = render(
      <>
        <Checkbox>Show inactive</Checkbox>
        <Checkbox defaultChecked>Require evidence</Checkbox>
      </>
    )

    const controls = container.querySelectorAll('.core-checkbox-control')
    expect(controls).toHaveLength(2)
    expect(controls[0]?.getAttribute('data-state')).toBe('unchecked')
    expect(controls[1]?.getAttribute('data-state')).toBe('checked')
    expect(container.querySelectorAll('.core-checkbox-indicator')).toHaveLength(
      2
    )
  })

  test('renders an indeterminate state', () => {
    render(<Checkbox indeterminate>Some filters selected</Checkbox>)

    const checkbox = screen.getByRole('checkbox', {
      name: 'Some filters selected'
    })
    expect(checkbox.getAttribute('data-state')).toBe('indeterminate')
    expect(checkbox.getAttribute('aria-checked')).toBe('mixed')
  })

  test('supports disabled and invalid states', () => {
    render(
      <Checkbox disabled isInvalid>
        Locked policy
      </Checkbox>
    )

    const checkbox = screen.getByRole('checkbox', { name: 'Locked policy' })
    expect(checkbox).toHaveProperty('disabled', true)
    expect(checkbox.getAttribute('aria-invalid')).toBe('true')
  })

  test('keeps the accessible name the label and exposes description separately', () => {
    render(
      <Checkbox description='Owners receive weekly summary emails.'>
        Email me summaries
      </Checkbox>
    )

    // Name is the label alone; the description is the accessible description.
    const checkbox = screen.getByRole('checkbox', {
      name: 'Email me summaries',
      description: 'Owners receive weekly summary emails.'
    })
    expect(checkbox).toBeTruthy()
  })
})

describe('RadioGroup', () => {
  test('calls onValueChange when a radio item is selected', () => {
    const onValueChange = vi.fn()

    render(
      <RadioGroup onValueChange={onValueChange} value='reviewer'>
        <RadioItem value='admin'>Admin</RadioItem>
        <RadioItem value='reviewer'>Reviewer</RadioItem>
      </RadioGroup>
    )

    fireEvent.click(screen.getByRole('radio', { name: 'Admin' }))

    expect(onValueChange).toHaveBeenCalledWith('admin')
  })

  test('supports uncontrolled default value', () => {
    render(
      <RadioGroup defaultValue='reviewer'>
        <RadioItem value='admin'>Admin</RadioItem>
        <RadioItem value='reviewer'>Reviewer</RadioItem>
      </RadioGroup>
    )

    const reviewer = screen.getByRole('radio', { name: 'Reviewer' })
    expect(reviewer.getAttribute('data-state')).toBe('checked')
    expect(reviewer.getAttribute('aria-checked')).toBe('true')
  })

  test('propagates invalid radio group state to items', () => {
    render(
      <RadioGroup isInvalid value=''>
        <RadioItem value='compact'>Compact</RadioItem>
      </RadioGroup>
    )

    expect(
      screen
        .getByRole('radio', { name: 'Compact' })
        .getAttribute('aria-invalid')
    ).toBe('true')
  })

  test('keeps persistent radio indicators for unchecked and checked states', () => {
    const { container } = render(
      <RadioGroup defaultValue='reviewer'>
        <RadioItem value='admin'>Admin</RadioItem>
        <RadioItem value='reviewer'>Reviewer</RadioItem>
      </RadioGroup>
    )

    const controls = container.querySelectorAll('.core-radio-control')
    expect(controls).toHaveLength(2)
    expect(controls[0]?.getAttribute('data-state')).toBe('unchecked')
    expect(controls[1]?.getAttribute('data-state')).toBe('checked')
    expect(container.querySelectorAll('.core-radio-indicator')).toHaveLength(2)
  })

  test('supports invalid radio item state', () => {
    render(
      <RadioGroup value=''>
        <RadioItem isInvalid value='compact'>
          Compact
        </RadioItem>
      </RadioGroup>
    )

    expect(
      screen
        .getByRole('radio', { name: 'Compact' })
        .getAttribute('aria-invalid')
    ).toBe('true')
  })

  test('keeps the accessible name the label and exposes description separately', () => {
    render(
      <RadioGroup value='member'>
        <RadioItem
          description="Can view reports but can't manage members."
          value='member'
        >
          Member
        </RadioItem>
      </RadioGroup>
    )

    const member = screen.getByRole('radio', {
      name: 'Member',
      description: "Can view reports but can't manage members."
    })
    expect(member).toBeTruthy()
  })

  test('disables all items from the group', () => {
    render(
      <RadioGroup disabled value='reviewer'>
        <RadioItem value='admin'>Admin</RadioItem>
        <RadioItem value='reviewer'>Reviewer</RadioItem>
      </RadioGroup>
    )

    expect(screen.getByRole('radio', { name: 'Admin' })).toHaveProperty(
      'disabled',
      true
    )
    expect(screen.getByRole('radio', { name: 'Reviewer' })).toHaveProperty(
      'disabled',
      true
    )
  })
})
