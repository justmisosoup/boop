import { EmptyState } from '@/core'

import { SectionTitle } from './SectionTitle'

/**
 * Alerts for the business: changes to it after it was assessed — a filing
 * lapsing, a new lien, a watchlist hit. Nothing monitors a business in the
 * prototype yet, so the section is its empty state: what turning it on would
 * do. On the subtle surface rather than white, so it
 * sits back into the page and the assessments sit forward.
 */
export const AlertsCard = () => {
  return (
    <section aria-label="Alerts" className="flex flex-col gap-3">
      <SectionTitle>Alerts</SectionTitle>
      <EmptyState
        className="!bg-muted px-4 py-6"
        title="Get alerted for changes"
        description="Monitor this business for registration, lien and watchlist changes, and get notified."
        actionLabel="Turn on monitoring"
        // A placeholder: monitoring isn't built in the prototype, so the
        // button is shown but goes nowhere.
        onAction={() => {}}
      />
    </section>
  )
}
