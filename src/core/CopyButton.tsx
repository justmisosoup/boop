import { useEffect, useRef, useState } from 'react'

import { Check, Copy } from 'lucide-react'

import { IconActionButton } from './Action'
import type { ActionSize, ActionVariant } from './Action'
import { useToast } from './Toast'

export type CopyButtonProps = {
  /** The text written to the clipboard. */
  value: string
  /** Accessible label in the idle state (also the hover tooltip). */
  label?: string
  /** Accessible label while the copied confirmation is showing. */
  copiedLabel?: string
  variant?: ActionVariant
  size?: ActionSize
  className?: string
  disabled?: boolean
}

/** How long the check confirmation stays before reverting to the copy icon. */
const COPIED_RESET_MS = 1500

/**
 * Icon-only copy-to-clipboard control: writes `value`, swaps the copy glyph for
 * a check for a beat on success, announces the result to assistive tech, and
 * toasts on failure (the Clipboard API can be blocked by permissions/insecure
 * origins). Consolidates the inline copy controls in `PayloadViewer` and the
 * webhooks detail drawer. (SourceView keeps its legacy styled control, and
 * PayloadViewer's oversized-body fallback keeps its own copy/download action.)
 *
 * Positioning is the caller's job — pass `className` (e.g. an absolute overlay on
 * a code block, or `shrink-0` in a flex row).
 */
export const CopyButton = ({
  value,
  label = 'Copy to clipboard',
  copiedLabel = 'Copied to clipboard',
  variant = 'quiet',
  size = 'compact',
  className,
  disabled
}: CopyButtonProps) => {
  const { showToast } = useToast()
  const [copied, setCopied] = useState(false)
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )

  useEffect(() => () => clearTimeout(resetTimer.current), [])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      clearTimeout(resetTimer.current)
      resetTimer.current = setTimeout(() => setCopied(false), COPIED_RESET_MS)
    } catch {
      showToast({ appearance: 'error', text: 'Could not copy — try again' })
    }
  }

  return (
    <>
      <IconActionButton
        aria-label={copied ? copiedLabel : label}
        className={className}
        disabled={disabled}
        onClick={handleCopy}
        size={size}
        variant={variant}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </IconActionButton>
      {/* Some screen readers don't re-announce an accessible-name change on the
          already-focused button, so confirm success via a polite live region
          (failures already announce through the error toast). */}
      <span aria-live='polite' className='sr-only' role='status'>
        {copied ? copiedLabel : ''}
      </span>
    </>
  )
}

CopyButton.displayName = 'CopyButton'
