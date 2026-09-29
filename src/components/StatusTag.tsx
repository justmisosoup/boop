import { Tag } from '@/core'

/**
 * A filing's status as a Tag beside its title, coloured as the dashboard's
 * MetaTag colours it: green where the state reports it active, red where it
 * reports it inactive or dissolved, grey where it reports none.
 */
export type RecordTone = 'success' | 'danger' | 'neutral'

export const toneOfStatus = (status?: string | null, subStatus?: string | null): RecordTone => {
  if (/dissolved/i.test(subStatus ?? '')) return 'danger'
  if (!status) return 'neutral'
  return /^active$/i.test(status) ? 'success' : 'danger'
}

export const StatusTag = ({ label, tone }: { label: string; tone: RecordTone }) => (
  <Tag tone={tone === 'neutral' ? 'subtle' : tone} size="compact">
    {label}
  </Tag>
)
