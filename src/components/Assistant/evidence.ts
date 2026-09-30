import { createElement, type ReactNode } from 'react'
import {
  Building2,
  FileText,
  Globe,
  Landmark,
  Link2,
  MapPin,
  Phone,
  Scale,
  ShieldCheck,
  Users
} from 'lucide-react'

import type { ChatSourceData } from '@/core'

import type { Derived } from '../../lib/deriveResults'
import { THEME, type GroupId } from '../../lib/groups'

/**
 * How much weight a source carries, most authoritative first.
 *
 * Citations are listed in this order, so a reader opening the popover meets the
 * strongest evidence first rather than whichever insight happened to sort
 * first. The ranking is the ordinary evidentiary one: what a government says
 * about itself, then what courts and public filings record, then what a
 * screening provider scored, then what the open web corroborates, and last what
 * the customer told us about themselves.
 */
const AUTHORITY: Record<GroupId, number> = {
  registration: 0,
  international_registration: 0,
  // The filing that constitutes the entity outranks the ones that qualify it.
  formation: 0,
  name: 1,
  address: 1,
  people: 1,
  tin: 1,
  // A federal registry stating a practitioner's credential — a government
  // record about a person, ranked with the other public filings.
  licenses: 1,
  liens: 2,
  litigation: 2,
  bankruptcy: 2,
  ppp_loans: 2,
  screening: 3,
  industry: 3,
  complaints: 3,
  kyc: 3,
  operating_as_claimed: 3,
  phone: 4,
  website: 4,
  profiles: 4,
  connections: 4,
  other: 5
}

/**
 * A glyph per theme, the way Kha's chips carry one for each report section.
 *
 * Lucide, 12px, in the chip's own ink. A theme without a natural glyph gets
 * the document; a chip is never without one, because the chips sit in a row
 * and one bare word among icons reads as a different kind of thing.
 */
const glyph = (Icon: typeof FileText): ReactNode =>
  createElement(Icon, { 'aria-hidden': 'true', size: 12, strokeWidth: 1.75 })

const GLYPHS: Partial<Record<GroupId, ReactNode>> = {
  name: glyph(Building2),
  formation: glyph(Landmark),
  registration: glyph(Landmark),
  international_registration: glyph(Globe),
  address: glyph(MapPin),
  people: glyph(Users),
  connections: glyph(Link2),
  website: glyph(Globe),
  profiles: glyph(Globe),
  phone: glyph(Phone),
  screening: glyph(ShieldCheck),
  kyc: glyph(ShieldCheck),
  liens: glyph(Scale),
  litigation: glyph(Scale),
  bankruptcy: glyph(Scale)
}

/**
 * A cited source is the CATEGORY the evidence came from — "Liens", not "Open
 * liens found".
 *
 * The statement is the finding, and the finding is already in the sentence the
 * chip is attached to; repeating it in the citation said the same thing twice
 * and made a source look like a second opinion. The category answers the
 * question a citation is actually asked: where does this come from.
 *
 * Several insights in one category collapse to one chip. Their statements
 * become the hover preview, so the way back to specifics survives, and
 * selecting the chip jumps to the group in the Insights view.
 */
const toSource = (
  groupId: GroupId,
  group: Derived[],
  onSelect?: (groupId: string, insightIds: string[]) => void
): ChatSourceData => ({
  id: groupId,
  label: THEME[groupId],
  // No `domain`: it renders into the row byline, where it repeated the title.
  title: THEME[groupId],
  annotation: `${group.length} insight${group.length === 1 ? '' : 's'}`,
  snippet: group.map((r) => r.statement).join(' · '),
  icon: GLYPHS[groupId] ?? glyph(FileText),
  onSelect: onSelect ? () => onSelect(groupId, group.map((r) => r.insightId)) : undefined
})

/**
 * Cited insights, as sources by theme, most authoritative first.
 *
 * A cite that matches no row on this record is dropped: it is not in the
 * Insights view either, so a chip for it would promise evidence nobody can
 * look at. The count of those is returned so the answer can say so.
 */
export const evidenceFor = (
  cites: ReadonlyArray<string> | undefined,
  results: Derived[],
  groupFor: (insightId: string) => GroupId,
  onSelect?: (groupId: string, insightIds: string[]) => void
): { sources: ChatSourceData[]; missing: number } => {
  const byId = new Map(results.map((r) => [r.insightId, r]))
  const found = (cites ?? [])
    .map((id) => byId.get(id))
    .filter((r): r is Derived => Boolean(r) && !r!.notReported)
  const groups = new Map<GroupId, Derived[]>()
  for (const r of found) {
    const id = groupFor(r.insightId)
    groups.set(id, [...(groups.get(id) ?? []), r])
  }
  const sources = [...groups.entries()]
    .sort(([a], [b]) => AUTHORITY[a] - AUTHORITY[b])
    .map(([id, group]) => toSource(id, group, onSelect))
  return { sources, missing: (cites?.length ?? 0) - found.length }
}
