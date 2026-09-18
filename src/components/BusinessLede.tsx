import { Skeleton, Text } from '@/core'

/**
 * What the business is, under its name.
 *
 * The lede belongs to the business, not to the assessment: it is the same
 * sentence whichever tab you are on, and it is what the insights and attributes
 * below are about. Keeping it inside the assessment transcript meant the one
 * paragraph telling you what this company does was only visible from one of
 * three tabs, beneath a disclosure.
 *
 * It is authored once per business and served from `/api/lede`, so no
 * assessment can reach it: an instruction added to one ("say HELLO at the top")
 * used to rewrite the first paragraph of the page.
 */
export const BusinessLede = ({ text }: { text: string | null }) => {
  // Absent means it is still being written — asked for on arrival, so the
  // space is held rather than letting the tabs jump when it lands.
  if (!text) {
    return (
      <div className="mt-3 space-y-1.5">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    )
  }

  return (
    <div className="mt-3 space-y-2">
      <Text tone="secondary">{text}</Text>
    </div>
  )
}
