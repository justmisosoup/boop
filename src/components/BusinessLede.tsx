import { ChatSources, Skeleton, Text } from '@/core'

import type { AssessmentSection } from '../types'

/**
 * What the business is, under its name.
 *
 * The lede belongs to the business, not to the assessment: it is the same
 * sentence whichever tab you are on, and it is what the insights and attributes
 * below are about. Keeping it inside the assessment transcript meant the one
 * paragraph telling you what this company does was only visible from one of
 * three tabs, beneath a disclosure.
 *
 * It arrives with the first assessment write, so until then this holds its own
 * space rather than letting the tabs jump down the page when it lands.
 */
export const BusinessLede = ({
  section,
  pending
}: {
  section?: AssessmentSection
  /** An analysis is running and has not yet written the lede. */
  pending: boolean
}) => {
  if (!section) {
    if (!pending) return null
    return (
      <div className="mt-3 space-y-1.5">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    )
  }

  return (
    <div className="mt-3 space-y-2">
      {section.body.map((b) => (
        <Text key={b.text} tone="secondary">
          {b.text}
          {b.sources && b.sources.length > 0 && (
            <span className="ml-1 align-middle">
              <ChatSources
                label="Public sources"
                sources={b.sources.map((src) => ({
                  id: src.url,
                  label: src.title,
                  title: src.title,
                  url: src.url,
                  annotation: 'Public web'
                }))}
              />
            </span>
          )}
        </Text>
      ))}
    </div>
  )
}
