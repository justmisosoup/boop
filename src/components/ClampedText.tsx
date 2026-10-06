import { useLayoutEffect, useRef, useState } from 'react'

import { ActionButton } from '@/core'

import { cn } from '../utils/twUtils'

const CLAMP = { 2: 'line-clamp-2', 3: 'line-clamp-3', 4: 'line-clamp-4' } as const

/**
 * Long text held to a few lines, with the rest a click away.
 *
 * A UCC-1's collateral clause can run to a page (Zendesk's Exhibit A is 3,600
 * characters); printed whole it buried the filing's other facts. The control
 * appears only when something is hidden — measured against the rendered box,
 * not guessed from the text's length — so a short clause shows no button.
 */
export const ClampedText = ({ text, lines = 3, className }: { text: string; lines?: keyof typeof CLAMP; className?: string }) => {
  const ref = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [overflows, setOverflows] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || open) return
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [open, text])

  return (
    <span className={cn('block', className)}>
      <span ref={ref} className={cn('block whitespace-pre-line', !open && CLAMP[lines])}>
        {text}
      </span>
      {(overflows || open) && (
        <ActionButton
          variant="quiet"
          size="compact"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="-ml-2 mt-1 text-text-secondary"
        >
          {open ? 'Show less' : 'Show more'}
        </ActionButton>
      )}
    </span>
  )
}
