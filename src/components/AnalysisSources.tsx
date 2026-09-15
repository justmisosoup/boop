import { ChatSources, MutedText, type ChatSourceData } from '@/core'

import { ROLLUP_NO_GLYPH } from './chipStyles'

import type { Derived } from '../lib/deriveResults'
import { makeGroupFor, THEME, type GroupId } from '../lib/groups'

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
  sos: 0,
  registrations: 0,
  // The filing that constitutes the entity outranks the ones that qualify it.
  formation: 0,
  name: 1,
  address: 1,
  people: 1,
  liens: 2,
  litigations: 2,
  bankruptcies: 2,
  watchlist: 3,
  politically_exposed_persons: 3,
  adverse_media: 3,
  industry: 3,
  website: 4,
  web: 4,
  business_connections: 4,
  other: 5
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
 * Several insights in one category collapse to one row. Their statements become
 * the hover preview, so the way back to specifics survives, and selecting the
 * row jumps to the first of them.
 */
const toSource = (
  groupId: GroupId,
  theme: string,
  group: Derived[],
  onSelect?: (groupId: string, insightIds: string[]) => void
): ChatSourceData => ({
  id: theme,
  label: theme,
  // No `domain`: it renders into the row byline, where it repeated the title.
  title: theme,
  annotation: `${group.length} insight${group.length === 1 ? '' : 's'}`,
  snippet: group.map((r) => r.statement).join(' · '),
  onSelect: onSelect ? () => onSelect(groupId, group.map((r) => r.insightId)) : undefined
})

/** Cited categories, most authoritative first, each keeping its insights. */
const byTheme = (found: Derived[], groupFor: (id: string) => GroupId) => {
  const groups = new Map<GroupId, Derived[]>()
  for (const r of found) {
    const id = groupFor(r.insightId)
    groups.set(id, [...(groups.get(id) ?? []), r])
  }
  return [...groups.entries()].map(([id, group]) => ({ id, theme: THEME[id], group }))
}

/**
 * Citations, by theme.
 *
 * A chip reads "Addresses +2", not the full insight statement — a statement is a
 * sentence, and a sentence cannot sit inside another sentence. The statements
 * are the rows of the popover, where there is room for them.
 */
export const AnalysisSources = ({
  used,
  results,
  categories,
  onSelect,
  inline
}: {
  used: string[]
  results: Derived[]
  categories: Map<string, string>
  /** Follows a citation to its category in the Insights tab. */
  onSelect?: (groupId: string, insightIds: string[]) => void
  /** Inline within the prose, rather than the message-level roll-up. */
  inline?: boolean
}) => {
  const groupFor = makeGroupFor(categories)
  const byId = new Map(results.map((r) => [r.insightId, r]))
  const found = used
    .map((id) => byId.get(id))
    .filter((r): r is Derived => Boolean(r))
    .sort((a, b) => AUTHORITY[groupFor(a.insightId)] - AUTHORITY[groupFor(b.insightId)])
  const missing = used.length - found.length

  if (found.length === 0 && missing === 0) return null

  if (inline) {
    // One roll-up for the whole paragraph, reading "Sources · 3" — where three
    // is three CATEGORIES, not three insights. A chip per category meant four
    // or five trailing every paragraph; naming the leading one promoted a
    // single source to stand for the rest on a ranking the reader cannot see.
    return (
      <span className="ml-0.5 align-middle">
        <ChatSources
          className={ROLLUP_NO_GLYPH}
          label="Insights"
          sources={byTheme(found, groupFor).map(({ id, theme, group }) =>
            toSource(id, theme, group, onSelect)
          )}
        />
      </span>
    )
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <ChatSources
        className={ROLLUP_NO_GLYPH}
        label="Insights used"
        sources={byTheme(found, groupFor).map(({ id, theme, group }) =>
          toSource(id, theme, group, onSelect)
        )}
      />
      {missing > 0 && (
        // Never swallowed: a citation that matches no row on this record is the
        // kind of thing this product exists to surface, not hide.
        <MutedText className="text-caption">
          {missing} cited insight{missing === 1 ? '' : 's'} not found on this record
        </MutedText>
      )}
    </div>
  )
}
