import React from 'react'

import {
  type Control,
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
  useController
} from 'react-hook-form'

import { Field, FieldDescription, FieldError, FieldLabel } from '../Field'

/**
 * The bindings handed to the render prop: react-hook-form's field plus a stable
 * control `id` and the wired aria attributes. Spread onto an `Input`
 * (`{...field}`), or destructure `value`/`onChange` for Radix-style controls
 * (e.g. `RadioGroup`, `Toggle`, `Combobox`).
 */
export type FormControlField<
  T extends FieldValues,
  N extends FieldPath<T>
> = ControllerRenderProps<T, N> & {
  id: string
  'aria-invalid'?: true
  'aria-describedby'?: string
}

export type FormControlRenderArg<
  T extends FieldValues,
  N extends FieldPath<T>
> = {
  field: FormControlField<T, N>
  isInvalid: boolean
  error?: string
  /**
   * Id of the rendered label. Single inputs are linked automatically via
   * `field.id` + the label's `htmlFor`; for grouped controls that can't take an
   * `id` (e.g. `RadioGroup`) set `aria-labelledby` to this instead.
   */
  labelId: string
}

export type FormControlProps<T extends FieldValues, N extends FieldPath<T>> = {
  name: N
  /** Optional — falls back to the surrounding `Form` context. */
  control?: Control<T>
  label?: React.ReactNode
  description?: React.ReactNode
  /** Appends a muted "(optional)" suffix to the label. */
  optional?: boolean
  /**
   * Only surface the error once the field has been touched. Default `true`.
   */
  showErrorWhenTouched?: boolean
  disabled?: boolean
  className?: string
  children: (arg: FormControlRenderArg<T, N>) => React.ReactNode
}

/**
 * Binds a `@/core` form control to react-hook-form and renders the full field
 * anatomy — `Field` + `FieldLabel` (with `htmlFor`) + optional
 * `FieldDescription` + the control + `FieldError` — wiring `id`,
 * `aria-invalid`, and `aria-describedby` from field state. Replaces the
 * hand-rolled `Field` + `Controller` + `FieldError` bridge every form otherwise
 * repeats, and keeps the label/description/error a11y correct by default.
 *
 * @example
 * <FormControl control={form.control} name='email' label='Work email'>
 *   {({ field }) => <Input type='email' {...field} />}
 * </FormControl>
 */
export function FormControl<T extends FieldValues, N extends FieldPath<T>>({
  name,
  control,
  label,
  description,
  optional = false,
  showErrorWhenTouched = true,
  disabled,
  className,
  children
}: FormControlProps<T, N>) {
  const reactId = React.useId()
  const controlId = `${reactId}-control`
  const labelId = `${reactId}-label`
  const descriptionId = `${reactId}-description`
  const errorId = `${reactId}-error`

  const { field, fieldState } = useController<T, N>({ name, control, disabled })

  const showError = showErrorWhenTouched
    ? fieldState.isTouched && !!fieldState.error
    : !!fieldState.error
  const error = showError ? fieldState.error?.message : undefined

  const describedBy =
    [description ? descriptionId : null, error ? errorId : null]
      .filter(Boolean)
      .join(' ') || undefined

  return (
    <Field
      className={className}
      isDisabled={!!field.disabled}
      isInvalid={!!error}
    >
      {label ? (
        <FieldLabel htmlFor={controlId} id={labelId}>
          {label}
          {optional ? (
            <span className='ml-1 font-normal text-[var(--core-color-control-helper-text)]'>
              (optional)
            </span>
          ) : null}
        </FieldLabel>
      ) : null}
      {description ? (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      ) : null}
      {children({
        field: {
          ...field,
          id: controlId,
          'aria-invalid': error ? true : undefined,
          'aria-describedby': describedBy
        },
        isInvalid: !!error,
        error,
        labelId
      })}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </Field>
  )
}

FormControl.displayName = 'FormControl'
