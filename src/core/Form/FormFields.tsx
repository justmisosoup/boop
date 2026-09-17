import type React from 'react'

import { ChevronDownIcon, Cross2Icon } from '@radix-ui/react-icons'
import {
  type Control,
  type FieldPath,
  type FieldValues,
  useController
} from 'react-hook-form'
import { type NumberFormatValues, NumericFormat } from 'react-number-format'
import Select, {
  type ClearIndicatorProps,
  type DropdownIndicatorProps,
  type MultiValue,
  type SingleValue,
  type StylesConfig,
  components
} from 'react-select'
import ReactTextMask, { type MaskedInputProps } from 'react-text-mask'
import styled from 'styled-components'

import { Attribute, type AttributeProps } from '../Attribute'
import { colors, typography } from '../theme'

import { CheckboxControl, type CheckboxControlProps } from './CheckboxField'
import { MASKS } from './constants'
import { RadioControl, type RadioControlProps } from './RadioField'

import { PrimarySelectFieldStyle } from './SelectField'
import { textFieldStyle } from './TextField'

/**
 * RHF-backed field adapters.
 *
 * These mirror the presentational contract of `TextField`
 * and `SelectField` (same `Attribute` wrapper, same input/select styling) but
 * source their value, change, blur, and error state from React Hook Form via
 * `useController`. Product code stays declarative and never touches RHF APIs
 * beyond passing `name` (and optionally `control`).
 */

const StyledInput = styled.input<{ hasError?: boolean }>`
  ${textFieldStyle}
`

const StyledTextArea = styled.textarea<{ hasError?: boolean }>`
  ${textFieldStyle}
  /* Default to a fixed height, but let an explicit \`rows\` drive the height
     when the caller provides one. */
  ${({ rows }) => (rows ? '' : 'height: 100px;')}
`

// react-text-mask ships class-component types that styled-components v6's
// WebTarget doesn't accept; the runtime component is a valid target.
const MaskedInput = ReactTextMask as unknown as React.ComponentType<
  MaskedInputProps & React.InputHTMLAttributes<HTMLInputElement>
>

const StyledMaskedInput = styled(MaskedInput)<{ hasError?: boolean }>`
  ${textFieldStyle}
`

const StyledNumericInput = styled(NumericFormat)<{ hasError?: boolean }>`
  ${textFieldStyle}
`

const MASKED_TYPES = ['date', 'ein', 'phone', 'masked'] as const

const StyledError = styled.div`
  color: ${colors.red};
  font-size: ${typography.sizes.small};
  margin-top: 5px;
`

type SharedFieldProps<T extends FieldValues> = Pick<
  AttributeProps,
  'label' | 'optional' | 'required' | 'sublabel' | 'tooltip'
> & {
  control?: Control<T>
  name: FieldPath<T>
}

export type FormTextFieldProps<T extends FieldValues> = SharedFieldProps<T> & {
  // Forwarded to the underlying input so callers can preserve password-manager
  // autofill and mobile keyboard hints (e.g. username/current-password).
  autoComplete?: string
  autoFocus?: boolean
  className?: string
  disabled?: boolean
  enterKeyHint?:
    | 'enter'
    | 'done'
    | 'go'
    | 'next'
    | 'previous'
    | 'search'
    | 'send'
  inputMode?:
    | 'none'
    | 'text'
    | 'tel'
    | 'url'
    | 'email'
    | 'numeric'
    | 'decimal'
    | 'search'
  // Custom mask for type='masked' (react-text-mask format).
  mask?: (string | RegExp)[]
  placeholder?: string
  rows?: number
  // Render the field's validation message below the input. Set false when the
  // caller surfaces the error elsewhere (e.g. a custom error region).
  showError?: boolean
  type?:
    | 'date'
    | 'ein'
    | 'masked'
    | 'number'
    | 'password'
    | 'phone'
    | 'ssn'
    | 'text'
    | 'textarea'
    | 'usd'
}

export const FormTextField = <T extends FieldValues>({
  autoComplete,
  autoFocus,
  className,
  control,
  disabled,
  enterKeyHint,
  inputMode,
  label,
  mask = [],
  name,
  optional,
  placeholder,
  required,
  rows,
  showError = true,
  sublabel,
  tooltip,
  type = 'text'
}: FormTextFieldProps<T>) => {
  const {
    field,
    fieldState: { error, isTouched }
  } = useController<T>({ control, name })
  // The red border only shows after the field blurs.
  const hasError = Boolean(isTouched && error)

  const sharedProps = {
    autoFocus,
    className,
    disabled,
    hasError,
    id: name,
    name: field.name,
    onBlur: field.onBlur,
    onChange: field.onChange,
    placeholder,
    required,
    spellCheck: false,
    value: (field.value ?? '') as string
  }

  // Autofill/keyboard hints only apply to the plain text/password/number input
  // (masked, usd, ssn, and textarea inputs don't take them), so pass them there
  // rather than through the shared props spread into every input variant.
  const inputHints = { autoComplete, enterKeyHint, inputMode }

  const renderInput = () => {
    if ((MASKED_TYPES as readonly string[]).includes(type)) {
      return (
        <StyledMaskedInput mask={MASKS.get(type) || mask} {...sharedProps} />
      )
    }

    switch (type) {
      case 'ssn':
        // Mask the digits as a password except while the input is focused.
        return (
          <StyledMaskedInput
            type='password'
            mask={MASKS.get('ssn') || []}
            {...sharedProps}
            onFocus={(e: React.FocusEvent<HTMLInputElement>) => {
              e.target.type = 'text'
            }}
            onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
              field.onBlur()
              e.target.type = 'password'
            }}
          />
        )
      case 'textarea':
        return (
          <StyledTextArea
            {...sharedProps}
            ref={field.ref as React.Ref<HTMLTextAreaElement>}
            rows={rows}
          />
        )
      case 'usd':
        return (
          <StyledNumericInput
            {...sharedProps}
            onChange={undefined}
            onValueChange={(values: NumberFormatValues) => {
              field.onChange(values.floatValue ?? null)
            }}
            prefix='$'
            thousandSeparator
          />
        )
      default:
        return (
          <StyledInput
            {...sharedProps}
            {...inputHints}
            ref={field.ref}
            type={type}
          />
        )
    }
  }

  return (
    <label htmlFor={name}>
      <Attribute {...{ label, optional, required, sublabel, tooltip }}>
        {renderInput()}
        {showError && hasError && (
          <StyledError role='alert'>{error?.message}</StyledError>
        )}
      </Attribute>
    </label>
  )
}

type SelectValue = string | number
type SelectOption = { label: React.ReactNode; value: SelectValue }

const DropdownIndicator = (
  props: DropdownIndicatorProps<SelectOption, boolean>
) => (
  <components.DropdownIndicator {...props}>
    <ChevronDownIcon
      color={props.isDisabled ? colors.karlLight2 : colors.graphite}
      height={16}
      width={16}
    />
  </components.DropdownIndicator>
)

const ClearIndicator = (props: ClearIndicatorProps<SelectOption, boolean>) => (
  <components.ClearIndicator {...props}>
    <Cross2Icon color={colors.graphite} height={14} width={14} />
  </components.ClearIndicator>
)

export type FormSelectFieldProps<T extends FieldValues> =
  SharedFieldProps<T> & {
    isClearable?: boolean
    isDisabled?: boolean
    isMulti?: boolean
    menuPortalTarget?: HTMLElement | null
    options: SelectOption[]
    placeholder?: string
    // Render the field's validation message below the select. Set false when
    // the caller surfaces the error elsewhere (e.g. a custom error region).
    showError?: boolean
    styles?: StylesConfig<SelectOption, boolean>
  }

export const FormSelectField = <T extends FieldValues>({
  control,
  isClearable = false,
  isDisabled = false,
  isMulti = false,
  label,
  menuPortalTarget,
  name,
  optional,
  options,
  placeholder = '',
  required,
  showError = true,
  styles = {},
  sublabel,
  tooltip
}: FormSelectFieldProps<T>) => {
  const {
    field,
    fieldState: { error, isTouched }
  } = useController<T>({ control, name })
  const hasError = Boolean(isTouched && error)

  // RHF can't statically resolve a generic field's value type, so narrow the
  // stored value to the primitive(s) this field works with.
  const currentValue = field.value as SelectValue | SelectValue[] | undefined
  const selectValue = isMulti
    ? options.filter(option =>
        (Array.isArray(currentValue) ? currentValue : []).includes(option.value)
      )
    : (options.find(option => option.value === currentValue) ?? null)

  return (
    <label htmlFor={name}>
      <Attribute {...{ label, optional, required, sublabel, tooltip }}>
        <Select<SelectOption, boolean>
          aria-invalid={hasError}
          components={{ ClearIndicator, DropdownIndicator }}
          id={name}
          isClearable={isClearable}
          isDisabled={isDisabled}
          isMulti={isMulti}
          menuPortalTarget={menuPortalTarget}
          name={field.name}
          onBlur={field.onBlur}
          onChange={(
            selected: MultiValue<SelectOption> | SingleValue<SelectOption>
          ) => {
            field.onChange(
              isMulti
                ? (selected as MultiValue<SelectOption>).map(o => o.value)
                : ((selected as SingleValue<SelectOption>)?.value ?? null)
            )
          }}
          options={options}
          placeholder={placeholder}
          styles={{ ...PrimarySelectFieldStyle, ...styles }}
          value={selectValue}
        />
        {showError && hasError && (
          <StyledError role='alert'>{error?.message}</StyledError>
        )}
      </Attribute>
    </label>
  )
}

export type FormCheckboxFieldProps<T extends FieldValues> = Omit<
  CheckboxControlProps,
  'checked' | 'onChange' | 'name'
> & {
  control?: Control<T>
  name: FieldPath<T>
}

export const FormCheckboxField = <T extends FieldValues>({
  control,
  name,
  ...rest
}: FormCheckboxFieldProps<T>) => {
  const { field } = useController<T>({ control, name })

  return (
    <CheckboxControl
      name={name}
      checked={Boolean(field.value)}
      onChange={event => field.onChange(event.target.checked)}
      onBlur={field.onBlur}
      {...rest}
    />
  )
}

export type FormRadioFieldProps<T extends FieldValues> = Omit<
  RadioControlProps,
  'checked' | 'onChange' | 'name' | 'value'
> & {
  control?: Control<T>
  name: FieldPath<T>
  // The value this radio represents. `null` models an explicit "unset" option
  // (e.g. a "Never" choice) whose stored value is null/undefined.
  value: string | null
}

export const FormRadioField = <T extends FieldValues>({
  control,
  name,
  value,
  ...rest
}: FormRadioFieldProps<T>) => {
  const { field } = useController<T>({ control, name })
  const checked = (field.value ?? null) === value

  return (
    <RadioControl
      name={name}
      value={value ?? ''}
      checked={checked}
      onChange={() => field.onChange(value)}
      onBlur={field.onBlur}
      {...rest}
    />
  )
}
