import { ChatSourceChip, type ChatSourceData } from '@/core'

import { CHIP_NO_GLYPH } from './chipStyles'

import type { BusinessRecord } from '../lib/deriveResults'

type Registration = BusinessRecord['registrations'][number]

/**
 * Registry sources, rendered with the design system's own citation chip.
 *
 * `ChatSourceChip` owns this shape already: one source is a link chip with a
 * hover preview; several collapse to `domain +n` whose popover lists them all,
 * keyboard and screen-reader reachable. The registry URL on each registration
 * (`source`) is what gives the chip its domain text and its destination.
 *
 * Domestic first — the state the business was formed in — then record order.
 */
/** The registry sources on their own, so a caller can fold them into one chip
 *  alongside whatever else attests the same value. Domestic first. */
export const registrationSources = (
  registrations: Registration[],
  domesticState?: string | null
): ChatSourceData[] => {
  const ordered = [
    ...registrations.filter((r) => r.state === domesticState),
    ...registrations.filter((r) => r.state !== domesticState)
  ]

  return ordered.map((r, i) => ({
    id: `${r.state}-${r.fileNumber ?? i}`,
    // The list-row title reads as the filing; the chip text is the registry
    // domain, which the primitive derives from `url`.
    label: r.name || `Registration — ${r.state}`,
    title: `${r.name || 'Registration'} — ${r.state}`,
    url: r.sourceUrl ?? undefined,
    // Chip text is normalised, not the raw host: every state registry has a
    // different domain (apps.dos.ny.gov, bizfileonline.sos.ca.gov,
    // icis.corp.delaware.gov) and none of them reads as "the Secretary of
    // State". The real host stays in the preview below.
    domain: `SOS · ${r.state}`,
    // What the reader wants on hover: which filing this is, and its standing.
    snippet: [
      r.sourceUrl ? new URL(r.sourceUrl).hostname.replace(/^www\./, '') : null,
      r.name,
      r.status ? `Status: ${r.status}` : null,
      r.subStatus ? `Sub-status: ${r.subStatus}` : null,
      r.fileNumber ? `File number: ${r.fileNumber}` : null,
      r.registrationDate ? `Registered ${r.registrationDate}` : null
    ]
      .filter(Boolean)
      .join(' · '),
    annotation:
      r.state === domesticState
        ? 'Government registry · domestic'
        : `Government registry${r.jurisdiction ? ` · ${r.jurisdiction}` : ''}`
  }))
}

export const SourceChip = ({
  registrations,
  domesticState
}: {
  registrations: Registration[]
  domesticState?: string | null
}) => {
  if (registrations.length === 0) return null

  const sources = registrationSources(registrations, domesticState)

  // The glyph is a favicon-style identity tile, which earns its place when
  // sources come from different domains. Every source here is a Secretary of
  // State registry and the chip already says which, so the tile is hidden
  // rather than swapped for another mark. Hidden in CSS because the cloned
  // primitive stays unmodified — and it is the glyph's WRAPPER that has to go:
  // the wrapper carries the 12px box and its own right margin, so hiding only
  // the tile inside left a 16px hole where the mark used to be.
  return (
    <span className={[
        // Hide the glyph's WRAPPER, not just the tile inside it: the wrapper
        // carries the 12px box and its own right margin.
        '[&_a>span:first-child]:hidden [&_button>span:first-child]:hidden',
        // The text that followed the glyph keeps a left margin meant to clear
        // it; with the glyph gone that becomes a hole at the start of the chip.
        '[&_a>span:nth-child(2)]:ml-0 [&_button>span:nth-child(2)]:ml-0'
      ].join(' ')}>
      <ChatSourceChip className={CHIP_NO_GLYPH} sources={sources} />
    </span>
  )
}
