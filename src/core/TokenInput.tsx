import React, { useCallback, useRef, useState } from 'react'

import { cn } from '@/utils/twUtils'

import { Tag } from './Tag'

/**
 * `TokenInput` is a multi-value text field: free text becomes removable chips,
 * committed on Enter or comma (and on blur, or on paste — splitting a pasted list
 * on whitespace, commas, and semicolons). Backspace on an empty field removes the
 * last chip. Built for entering several emails at once (the team invite dialog),
 * but value-agnostic.
 *
 * Controlled: `value` holds the committed tokens, `onChange` fires with the next
 * array. Pass `validateToken` to flag bad entries — invalid chips render in the
 * `danger` tone so the user sees exactly which token to fix; `isInvalid` draws
 * the whole-field error ring (e.g. from form validation). The chrome (border,
 * focus-within ring, invalid ring) mirrors the DS text inputs via the scoped
 * `.core-token-input` class in theme.css.
 */
const SPLIT = /[\s,;]+/

export type TokenInputProps = {
  /** Committed tokens (controlled). */
  value: string[]
  onChange: (tokens: string[]) => void
  /** Return false to flag a committed token invalid (renders it `danger`). */
  validateToken?: (token: string) => boolean
  placeholder?: string
  /** Whole-field error state — draws the error ring. */
  isInvalid?: boolean
  disabled?: boolean
  autoFocus?: boolean
  id?: string
  onBlur?: () => void
  className?: string
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
}

export const TokenInput = React.forwardRef<HTMLInputElement, TokenInputProps>(
  (
    {
      value,
      onChange,
      validateToken,
      placeholder,
      isInvalid = false,
      disabled = false,
      autoFocus = false,
      id,
      onBlur,
      className,
      ...aria
    },
    ref
  ) => {
    const [draft, setDraft] = useState('')
    const innerRef = useRef<HTMLInputElement>(null)

    const setInputRef = useCallback(
      (node: HTMLInputElement | null) => {
        innerRef.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      },
      [ref]
    )

    const commit = (raw: string) => {
      const next = [...value]
      for (const piece of raw.split(SPLIT)) {
        const token = piece.trim()
        if (token && !next.includes(token)) next.push(token)
      }
      if (next.length !== value.length) onChange(next)
      setDraft('')
    }

    const removeAt = (index: number) =>
      onChange(value.filter((_, i) => i !== index))

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === ',') {
        // Commit the draft; on an empty Enter, just swallow it so the field
        // doesn't submit the surrounding form.
        if (draft.trim() || e.key === 'Enter') e.preventDefault()
        if (draft.trim()) commit(draft)
      } else if (e.key === 'Backspace' && !draft && value.length) {
        e.preventDefault()
        removeAt(value.length - 1)
      }
    }

    return (
      <div
        aria-invalid={isInvalid || undefined}
        className={cn(
          'core-token-input flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-control border border-solid border-[var(--core-color-control-border)] bg-[var(--core-color-control-bg)] px-3 py-1.5 transition-colors',
          'hover:border-[var(--core-color-control-border-hover)] focus-within:border-[var(--core-color-control-border-focus)]',
          'aria-[invalid=true]:border-[var(--core-color-control-error-border)]',
          disabled &&
            'cursor-not-allowed bg-[var(--core-color-control-disabled-bg)]',
          className
        )}
        onMouseDown={e => {
          // Clicking the field chrome (not a chip or its remove button) focuses
          // the input without stealing focus mid-click.
          if (e.target === e.currentTarget) {
            e.preventDefault()
            innerRef.current?.focus()
          }
        }}
      >
        {value.map((token, i) => (
          <Tag
            key={`${token}-${i}`}
            onRemove={disabled ? undefined : () => removeAt(i)}
            size='compact'
            tone={validateToken && !validateToken(token) ? 'danger' : 'subtle'}
          >
            {token}
          </Tag>
        ))}
        <input
          ref={setInputRef}
          autoFocus={autoFocus}
          className='min-w-[6rem] flex-1 border-0 bg-transparent p-0 text-sm leading-5 text-[var(--core-color-control-fg)] outline-hidden placeholder:text-[var(--core-color-control-placeholder)] disabled:cursor-not-allowed'
          disabled={disabled}
          id={id}
          onBlur={() => {
            if (draft.trim()) commit(draft)
            onBlur?.()
          }}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={e => {
            e.preventDefault()
            commit(e.clipboardData.getData('text'))
          }}
          placeholder={value.length ? undefined : placeholder}
          value={draft}
          {...aria}
        />
      </div>
    )
  }
)

TokenInput.displayName = 'TokenInput'
