import type { ReactNode } from 'react'

import { Heading, Skeleton, Text } from '@/core'

/** The first word that carries letters or digits, lowercased. */
const firstToken = (s: string) => (s.toLowerCase().match(/[a-z0-9]+/) ?? [''])[0]

/**
 * The name a lede leads with, and what it says after it.
 *
 * Every lede opens the same way — a name, `is`, then what the business is:
 * "Andytown Coffee Roasters is a specialty coffee roaster…". The opening is a
 * rule on whoever writes it (`analysis/ledes.json`), so the copula is a seam we
 * can cut on, and the name goes to the heading rather than being said twice.
 *
 * The name comes from the lede rather than from the record on purpose. The
 * record's is the registered name, and a business is usually written up under
 * the one it trades as — ANDYTOWN LLC is Andytown Coffee Roasters, MIDDESK INC
 * is Middesk. The registered name is in the fixed header bar at every scroll
 * position, so this is the other name, not the same one again. It is printed as
 * the lede wrote it: title-casing it would mangle PLLC and every acronym.
 *
 * Three things make the cut safe, and all three fail the same way — the
 * registered name as the heading and not one word of the sentence lost:
 *
 * - No sentence boundary inside the name, so a lede opening with prose cannot
 *   promote half a paragraph to a heading.
 * - 80 characters at most, so a lede that opens some other way is not cut at
 *   the first `is` three lines in.
 * - The name has to start on the same word as the registered one. "The company
 *   is a specialty roaster" parses, and this is what rejects it.
 */
const splitLede = (text: string, registered: string) => {
  const m = /^\s*([^.!?\n]{2,80}?)\s+is\s+([\s\S]+)$/.exec(text)
  if (!m || firstToken(m[1]) !== firstToken(registered)) {
    return { name: registered, body: text }
  }
  return { name: m[1], body: m[2].charAt(0).toUpperCase() + m[2].slice(1) }
}

/**
 * What the business is, at the head of the report.
 *
 * The lede belongs to the business, not to the assessment: it is the same
 * paragraph whichever tab you are on, and it is what the insights and
 * attributes below are about. It led the contents rail for a while, which put
 * the one paragraph saying what this company does in a 224px column, clamped at
 * six lines, and only at the width where that rail appears at all — and the
 * rail returns nothing until a report has sections, so an assessment that had
 * not started yet took the description off the page with it. Here it opens the
 * report: one copy, in full, at every width, and the rail carries the contents
 * and nothing else.
 *
 * It is authored once per business and served from `/api/lede`, so no
 * assessment can reach it: an instruction added to one ("say HELLO at the top")
 * used to rewrite the first paragraph of the page.
 */
export const BusinessLede = ({
  text,
  name,
  trailing
}: {
  text: string | null
  name: string
  /** What the report was analysed with, level with the name. It belongs to the
   *  run rather than to the business, but this is the head of the page and the
   *  line the name sits on is the only one with room for it. */
  trailing?: ReactNode
}) => {
  // Absent means it is still being written — asked for on arrival, so the space
  // is held rather than letting the report jump when it lands. The heading does
  // not wait: the registered name is known from the record, and the lede's own
  // name replaces it if the two differ.
  const heading = (title: string) => (
    <div className="flex items-center gap-4">
      <Heading level={2}>{title}</Heading>
      {trailing && <span className="ml-auto shrink-0">{trailing}</span>}
    </div>
  )

  if (!text) {
    return (
      <div className="space-y-3">
        {heading(name)}
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </div>
    )
  }

  const lede = splitLede(text, name)

  return (
    <div className="space-y-3">
      {heading(lede.name)}
      <Text tone="secondary">{lede.body}</Text>
    </div>
  )
}
