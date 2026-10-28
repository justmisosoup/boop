import { ActionButton, EmptyState } from '@/core'

import { SectionTitle } from './SectionTitle'

/**
 * Lucide's `radar`, drawn here so its two blips can take their own colour: the
 * sweep in the secondary grey, the blips in the status red — what monitoring
 * would pick up. (Lucide colours a whole icon by `currentColor`.)
 */
const MonitoringIcon = ({ size = 28, stroke = 1.5 }: { size?: number; stroke?: number }) => (
  <svg
    aria-hidden="true"
    className="text-text-secondary"
    fill="none"
    height={size}
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={stroke}
    viewBox="0 0 24 24"
    width={size}
  >
    <path d="M19.07 4.93A10 10 0 0 0 6.99 3.34" />
    <path d="M2.29 9.62A10 10 0 1 0 21.31 8.35" />
    <path d="M16.24 7.76A6 6 0 1 0 8.23 16.67" />
    <path d="M17.99 11.66A6 6 0 0 1 15.77 16.67" />
    <circle cx="12" cy="12" r="2" />
    <path d="m13.41 10.59 5.66-5.66" />
    {/* The blips: a touch heavier so the colour reads at this size. */}
    <g className="text-[var(--core-color-status-danger-fg)]" strokeWidth={stroke * (2.75 / 1.5)}>
      <path d="M4 6h.01" />
      <path d="M12 18h.01" />
    </g>
  </svg>
)

/**
 * Alerts for the business: changes to it after it was assessed — a filing
 * lapsing, a new lien, a watchlist hit. Nothing monitors a business in the
 * prototype yet, so the section is its empty state: what turning it on would
 * do. On the subtle surface rather than white, so it
 * sits back into the page and the assessments sit forward.
 */
/** `titled`: false in the side panel, whose own head says Alerts — and there,
 *  the same box drawn compact: its lines left-aligned over a large, clipped mark. */
export const AlertsCard = ({ titled = true }: { titled?: boolean }) => {
  const compact = !titled
  return (
    <section aria-label="Alerts" className="flex flex-col gap-5">
      {titled && <SectionTitle>Alerts</SectionTitle>}
      {compact ? (
        // In the side panel: the same box, compact — its lines left-aligned,
        // and the mark drawn large behind them at the right, clipped by the
        // card and faded, so it reads as the ground rather than an icon.
        <div className="relative overflow-hidden rounded-card border border-border bg-muted p-4">
          <span aria-hidden="true" className="pointer-events-none absolute -bottom-8 -right-8 opacity-20">
            {/* Drawn large, so a finer line: the same weight on screen as the small mark. */}
            <MonitoringIcon size={128} stroke={0.6} />
          </span>
          {/* The lines run the box's full width, over the mark. */}
          <div className="relative flex min-w-0 flex-col items-start gap-1">
            <p className="m-0 text-dense font-semibold leading-5 text-text-primary">Track entity changes</p>
            <p className="m-0 text-dense leading-5 text-text-secondary">
              Get notified when filings, liens or watchlist results change.
            </p>
            {/* A placeholder: how monitoring is set up isn't in the prototype. */}
            <ActionButton className="mt-2" onClick={() => {}} size="compact" variant="secondary">
              Learn how
            </ActionButton>
          </div>
        </div>
      ) : (
        // The empty state's box, with a small monitoring mark over its title
        // (EmptyState takes no icon): the box is this wrapper, the state sits
        // in it unboxed.
        <div className="flex flex-col items-center rounded-card border border-border bg-muted pt-8">
          <MonitoringIcon />
          <EmptyState
            // The description tucked up under its title and set apart from the
            // button: the state's grid spaces every line alike.
            className="min-h-0 !border-0 !bg-transparent !px-4 !pb-8 !pt-3 [&_p]:-mt-2 [&_p]:mb-2"
            title="Track entity changes"
            description="Get notified when filings, liens or watchlist results change."
            // Monitoring is opted into elsewhere; here, the way to find out how.
            actionLabel="Learn how"
            // A placeholder: monitoring isn't built in the prototype, so the
            // button is shown but goes nowhere.
            onAction={() => {}}
          />
        </div>
      )}
    </section>
  )
}
