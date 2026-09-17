import type React from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  type ArrayPath,
  Controller,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
  FormProvider,
  type UseControllerProps,
  type UseFieldArrayReturn,
  type UseFormProps,
  type UseFormReturn,
  useFieldArray,
  useForm,
  useFormContext
} from 'react-hook-form'
import type { z } from 'zod'

export type MiddeskFormOptions<T extends FieldValues> = UseFormProps<
  T,
  unknown,
  T
> & {
  schema?: z.ZodType<T, T>
}

export const useMiddeskForm = <T extends FieldValues>({
  schema,
  resolver,
  mode = 'onChange',
  ...options
}: MiddeskFormOptions<T> = {}) =>
  useForm<T, unknown, T>({
    mode,
    resolver:
      resolver ??
      (schema
        ? (zodResolver(schema) as UseFormProps<T, unknown, T>['resolver'])
        : undefined),
    ...options
  })

// Re-export React Hook Form's context hook under the @/core surface so product
// code reads/writes form state with the library-native API.
export { useFormContext } from 'react-hook-form'

export type FormProps<T extends FieldValues> = {
  children: React.ReactNode
  form: UseFormReturn<T, unknown, T>
  onSubmit: (values: T) => void | Promise<void>
}

export const Form = <T extends FieldValues>({
  children,
  form,
  onSubmit
}: FormProps<T>) => (
  <FormProvider {...form}>
    <form onSubmit={form.handleSubmit(values => onSubmit(values))}>
      {children}
    </form>
  </FormProvider>
)

export type FormFieldProps<
  T extends FieldValues,
  TName extends FieldPath<T>
> = UseControllerProps<T, TName> & {
  render: ControllerProps<T, TName>['render']
}

export const FormField = <T extends FieldValues, TName extends FieldPath<T>>({
  ...props
}: FormFieldProps<T, TName>) => <Controller<T, TName> {...props} />

export type FormErrorProps<T extends FieldValues> = {
  name: FieldPath<T>
}

export const FormError = <T extends FieldValues>({
  name
}: FormErrorProps<T>) => {
  const {
    formState: { errors }
  } = useFormContext<T>()
  const error = name.split('.').reduce<unknown>((value, key) => {
    if (!value || typeof value !== 'object') return undefined

    return (value as Record<string, unknown>)[key]
  }, errors)
  const message =
    error && typeof error === 'object' && 'message' in error
      ? String(error.message)
      : undefined

  if (!message) return null

  return <div role='alert'>{message}</div>
}

export type ArrayFieldProps<
  T extends FieldValues,
  TName extends ArrayPath<T>
> = {
  children: (helpers: UseFieldArrayReturn<T, TName>) => React.ReactNode
  name: TName
}

export const ArrayField = <T extends FieldValues, TName extends ArrayPath<T>>({
  children,
  name
}: ArrayFieldProps<T, TName>) => {
  const { control } = useFormContext<T>()
  const helpers = useFieldArray<T, TName>({ control, name })

  return <>{children(helpers)}</>
}

export const getSubmitState = <T extends FieldValues>(
  form: UseFormReturn<T, unknown, T>,
  { requireDirty = true }: { requireDirty?: boolean } = {}
) => {
  const { isDirty, isSubmitting, isValid } = form.formState

  return {
    isDirty,
    isSubmitDisabled: isSubmitting || !isValid || (requireDirty && !isDirty),
    isSubmitting,
    isValid
  }
}
