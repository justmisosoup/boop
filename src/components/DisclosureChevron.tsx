import { cn } from '../utils/twUtils'

/**
 * The glyph on anything that opens: an insight's evidence, a source's payload.
 *
 * One definition, because a chevron that points down on one card and reads
 * "Hide" in words on the next is two languages for the same gesture. It is
 * always the mark on a control, never the control itself — the row or the card
 * header is the hit target, which is why this is a `span` and takes no handler.
 */
export const DisclosureChevron = ({ open, className }: { open: boolean; className?: string }) => (
  <span
    aria-hidden="true"
    className={cn(
      'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors',
      className
    )}
  >
    <svg
      viewBox="0 0 12 12"
      className={cn('h-3 w-3 transition-transform duration-200', open && 'rotate-180')}
      fill="none"
    >
      <path
        d="M3 4.5 6 7.5 9 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </span>
)
