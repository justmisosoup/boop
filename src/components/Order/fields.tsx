import { useId, useState, type ReactNode } from 'react'

import { useController, type FieldPath, type FieldValues } from 'react-hook-form'
import ReactTextMask from 'react-text-mask'

import {
  Combobox,
  Field,
  FieldLabel,
  Input,
  Popover,
  PopoverAnchor,
  PopoverContent,
  Text,
  type ComboboxOption
} from '@/core'
import { cn } from '@/utils/twUtils'

import { displayName } from '../../lib/businessNames'
import type { BusinessRecord } from '../../lib/deriveResults'

/**
 * The order form's fields on the design system's own inputs — core `Field`,
 * `FieldLabel` and `Input` — rather than the legacy styled-components ones
 * `FormTextField` renders. Each reads and writes React Hook Form through
 * `useController`, as `FormTextField` does, so the form around them is unchanged.
 */

/** The legacy form's masks (`src/core/Form/constants.ts`, not exported). */
const MASKS = {
  date: [/\d/, /\d/, '/', /\d/, /\d/, '/', /\d/, /\d/, /\d/, /\d/],
  ein: [/\d/, /\d/, '-', /\d/, /\d/, /\d/, /\d/, /\d/, /\d/, /\d/],
  phone: ['(', /[1-9]/, /\d/, /\d/, ')', ' ', /\d/, /\d/, /\d/, '-', /\d/, /\d/, /\d/, /\d/]
} as const

type Mask = keyof typeof MASKS

/** A label, with the form's asterisk when the field is required. */
const Label = ({ htmlFor, required, children }: { htmlFor: string; required?: boolean; children: ReactNode }) => (
  // Body size, as the rest of the page: the label is not secondary text.
  <FieldLabel className="flex items-center gap-1 text-sm" htmlFor={htmlFor}>
    {children}
    {required && (
      <span aria-hidden="true" className="text-[var(--core-color-control-error-fg)]">
        *
      </span>
    )}
  </FieldLabel>
)

export const TextInputField = <T extends FieldValues>({
  name,
  label,
  placeholder,
  required,
  mask
}: {
  name: FieldPath<T>
  /** None for a repeated row under the first. */
  label?: ReactNode
  placeholder?: string
  required?: boolean
  mask?: Mask
}) => {
  const {
    field,
    fieldState: { error, isTouched }
  } = useController<T>({ name })
  const props = {
    'aria-invalid': Boolean(isTouched && error) || undefined,
    'aria-label': label ? undefined : placeholder,
    id: name,
    name: field.name,
    onBlur: field.onBlur,
    onChange: field.onChange,
    placeholder,
    required,
    spellCheck: false,
    value: (field.value ?? '') as string
  }

  return (
    <Field>
      {label && (
        <Label htmlFor={name} required={required}>
          {label}
        </Label>
      )}
      {mask ? (
        <ReactTextMask
          {...props}
          guide={false}
          mask={[...MASKS[mask]]}
          render={(ref, rest) => <Input ref={ref as (el: HTMLInputElement | null) => void} {...rest} />}
        />
      ) : (
        <Input ref={field.ref} {...props} />
      )}
    </Field>
  )
}

/** One option of a list — the formation state — searchable, clearable by picking it again. */
export const SelectInputField = <T extends FieldValues>({
  name,
  label,
  placeholder,
  required,
  options
}: {
  name: FieldPath<T>
  label: ReactNode
  placeholder?: string
  required?: boolean
  options: ComboboxOption[]
}) => {
  const { field } = useController<T>({ name })
  const value = (field.value ?? '') as string
  return (
    <Field>
      <Label htmlFor={name} required={required}>
        {label}
      </Label>
      <Combobox
        className="w-full"
        id={name}
        multiple={false}
        onChange={(next) => {
          field.onChange(next[0] ?? '')
          field.onBlur()
        }}
        options={options}
        placeholder={placeholder}
        searchPlaceholder="Search states"
        themeMode="light"
        value={value ? [value] : []}
      />
    </Field>
  )
}

/** The business name, suggesting the businesses already held as it is typed:
 *  picking one runs the assessments on it rather than on a new business. */
export const BusinessNameField = <T extends FieldValues>({
  name,
  label,
  placeholder,
  required,
  businesses,
  onPick
}: {
  name: FieldPath<T>
  label: ReactNode
  placeholder?: string
  required?: boolean
  businesses: BusinessRecord[]
  onPick: (business: BusinessRecord) => void
}) => {
  const {
    field,
    fieldState: { error, isTouched }
  } = useController<T>({ name })
  const value = (field.value ?? '') as string
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const listId = useId()

  const query = value.trim().toLowerCase()
  const matches = query
    ? businesses
        .filter((b) => [b.name, ...b.names.map((n) => n.name)].some((n) => n.toLowerCase().includes(query)))
        .slice(0, 6)
    : []
  const shown = open && matches.length > 0

  const pick = (b: BusinessRecord) => {
    setOpen(false)
    onPick(b)
  }

  return (
    <Field>
      <Label htmlFor={name} required={required}>
        {label}
      </Label>
      <Popover open={shown} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <Input
            ref={field.ref}
            aria-activedescendant={shown ? `${listId}-${active}` : undefined}
            aria-autocomplete="list"
            aria-controls={listId}
            aria-expanded={shown}
            aria-invalid={Boolean(isTouched && error) || undefined}
            autoComplete="off"
            id={name}
            name={field.name}
            onBlur={() => {
              field.onBlur()
              setOpen(false)
            }}
            onChange={(e) => {
              field.onChange(e)
              setActive(0)
              setOpen(true)
            }}
            onKeyDown={(e) => {
              if (!shown) return
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault()
                const step = e.key === 'ArrowDown' ? 1 : -1
                setActive((i) => (i + step + matches.length) % matches.length)
              } else if (e.key === 'Enter') {
                e.preventDefault()
                pick(matches[active])
              } else if (e.key === 'Escape') {
                setOpen(false)
              }
            }}
            placeholder={placeholder}
            required={required}
            role="combobox"
            spellCheck={false}
            value={value}
          />
        </PopoverAnchor>
        <PopoverContent
          className="w-[var(--radix-popper-anchor-width)] p-1"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            // Clicking the input itself is not "outside".
            if ((e.target as HTMLElement).id === name) e.preventDefault()
          }}
          themeMode="light"
        >
          <ul aria-label="Existing businesses" className="m-0 list-none p-0" id={listId} role="listbox">
            {matches.map((b, i) => (
              <li
                key={b.id}
                aria-selected={i === active}
                className={cn(
                  'flex cursor-pointer flex-col rounded-control px-2 py-1.5',
                  i === active && 'bg-[var(--core-color-state-hover-bg)]'
                )}
                id={`${listId}-${i}`}
                // Before the input's blur closes the list.
                onMouseDown={(e) => {
                  e.preventDefault()
                  pick(b)
                }}
                onMouseEnter={() => setActive(i)}
                role="option"
              >
                <span className="truncate">{displayName(b.name)}</span>
                {b.addresses[0]?.fullAddress && (
                  <Text className="truncate" size="sm" tone="secondary">
                    {b.addresses[0].fullAddress}
                  </Text>
                )}
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </Field>
  )
}
