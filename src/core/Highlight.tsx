import { cn } from '@/utils/twUtils'

export type HighlightProps = {
  /** The full text to render. */
  text: string
  /** The substring to emphasize (case-insensitive). */
  query?: string
  /** Extra classes for the emphasized `<mark>` spans. */
  className?: string
}

// Escape user input so it can't break the match RegExp.
const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * `Highlight` renders `text`, emphasizing the run(s) that match `query`
 * (case-insensitive) — used in search and command-palette results to show
 * *why* a row matched. The emphasis is weight + full-contrast color, not a
 * highlighter fill, so it stays calm. Falls back to plain text when there's no
 * query or no match.
 */
export const Highlight = ({ className, query, text }: HighlightProps) => {
  const needle = query?.trim()
  if (!needle) return <>{text}</>

  const parts = text.split(new RegExp(`(${escapeRegExp(needle)})`, 'ig'))
  const lowerNeedle = needle.toLowerCase()

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === lowerNeedle ? (
          <mark
            // Index is part of the key because the same run can repeat.
            key={`${part}-${index}`}
            className={cn(
              'bg-transparent font-semibold text-foreground',
              className
            )}
          >
            {part}
          </mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        )
      )}
    </>
  )
}
