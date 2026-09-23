import { attributesFor, licenseRows, type AttributeRow } from '../lib/attributes'
import { FOREIGN_STATUS_ORDER } from '../lib/attributes'
import type { BusinessRecord, Derived } from '../lib/deriveResults'
import { GROUPS, type GroupId } from '../lib/groups'
import { AttributeGrid } from './AttributeGrid'
import { cellsFromRows } from './attributeCells'

/**
 * Attributes, grouped as Middesk groups them and deduplicated.
 *
 * A row is filed under ITS OWN group, falling back to the insight's only when it
 * does not claim one. Grouping everything by the asking insight put the address
 * a lien was filed at under Web presence, because a website check had cited it —
 * the row followed the question rather than the fact.
 *
 * Keyed on the THING, not on how a row renders it or on which check asked. An
 * address is its address and a person is their name, so the same address found
 * in five places is one row with five sources, and someone who is both the
 * submitted contact and an officer on a filing is one person, not two rows
 * differing only by the label the asking check gave them.
 *
 * Rows with no identity of their own fall back to label plus value.
 *
 * The tab count uses this same function, so the number on the tab and the rows
 * underneath cannot disagree.
 */
/**
 * Reading order within a group, where insertion order would be arbitrary.
 *
 * Rows arrive in whatever sequence the insights happened to be derived in, so
 * the legal name could land after the formation date. Anything unlisted keeps
 * its position behind the named rows.
 */
const ROW_ORDER: Partial<Record<GroupId, string[]>> = {
  name: ['Legal name', 'DBA', 'Name on file'],
  formation: [
    'Entity type',
    'Formation state',
    'Formation date',
    'Status',
    'Sub status',
    'File number',
    'Registered agent'
  ],
  // Grouped by field, not by filing. Each insight contributes the filings it is
  // about — sos_inactive the Illinois one, sos_unknown the New Jersey one — so
  // left in producer order the rows arrive filing by filing and Status appears
  // four times, separated by file numbers. Ordered here, the statuses read as
  // the list they are and each names the filing it belongs to.
  registration: ['Status', 'Sub status', 'Registration date'],
  // The agent's address is the agent's, not the company's. Interleaved by
  // whichever check happened to surface it first, four of them sat between the
  // addresses the business actually operates from.
  address: ['Address', 'Registered agent address']
}

const ordered = (group: GroupId, rows: AttributeRow[]): AttributeRow[] => {
  const order = ROW_ORDER[group]
  if (!order) return rows

  const rank = (r: AttributeRow) => {
    const i = order.indexOf(r.label)
    return i === -1 ? order.length : i
  }
  // Within Status, the vocabulary's own order rather than the order the filings
  // happened to arrive in.
  const value = (r: AttributeRow) =>
    r.label === 'Status' ? FOREIGN_STATUS_ORDER.indexOf(r.value.toLowerCase()) : 0

  return [...rows].sort((a, b) => rank(a) - rank(b) || value(a) - value(b))
}

export const attributeRowsByGroup = (
  record: BusinessRecord,
  results: Derived[],
  groupFor: (insightId: string) => GroupId
): Map<GroupId, Map<string, AttributeRow>> => {
  const byGroup = new Map<GroupId, Map<string, AttributeRow>>()

  // Licences are not produced by any insight — no review task reaches one — so
  // they are added directly rather than waiting for a check that does not exist.
  for (const a of licenseRows(record)) {
    const rows = byGroup.get('licenses') ?? new Map<string, AttributeRow>()
    rows.set(a.matchValue ?? `${a.label}::${a.value}`, a)
    byGroup.set('licenses', rows)
  }

  for (const r of results) {
    const asked = groupFor(r.insightId)
    for (const a of attributesFor(r.insightId, record)) {
      // Attributes are what was FOUND. The articles behind an adverse-media
      // match, and anything else marked detail, are evidence for an insight —
      // they belong under it when it is expanded, not as facts about the
      // business alongside its addresses and officers.
      if (a.detail || a.evidenceOnly) continue

      const group = a.group ?? asked
      const rows = byGroup.get(group) ?? new Map<string, AttributeRow>()
      const key = a.matchValue ?? `${a.label}::${a.value}`
      const seen = rows.get(key)

      rows.set(
        key,
        seen
          ? {
              ...seen,
              // The fuller rendering wins: one producer may know the property
              // type or the registered-agent flag where another does not.
              value: a.value.length > seen.value.length ? a.value : seen.value,
              sources: [...new Set([...(seen.sources ?? []), ...(a.sources ?? [])])],
              submitted: seen.submitted || a.submitted,
              // Union, not first-wins: a value four filings agree on carries
              // all four, so the chip reads "SOS · CA +3" rather than naming
              // one and silently dropping the corroboration.
              registrations:
                seen.registrations || a.registrations
                  ? [
                      ...(seen.registrations ?? []),
                      ...(a.registrations ?? []).filter(
                        (r) =>
                          !(seen.registrations ?? []).some(
                            (x) => x.state === r.state && x.fileNumber === r.fileNumber
                          )
                      )
                    ]
                  : undefined
            }
          : a
      )
      byGroup.set(group, rows)
    }
  }

  return byGroup
}

export const countAttributes = (
  record: BusinessRecord,
  results: Derived[],
  groupFor: (insightId: string) => GroupId
): number => {
  let n = 0
  for (const rows of attributeRowsByGroup(record, results, groupFor).values()) n += rows.size
  return n
}

export type AttributeGroup = { id: GroupId; label: string; rows: AttributeRow[] }

/**
 * The attribute groupings, in the order the groups are laid out, empty ones
 * dropped — what the Attributes tab's column lists, and what its pane shows
 * one of. Only the groups with a declared order are reordered; elsewhere the
 * producer's order is the meaningful one — a filing's fields follow the filing
 * they belong to.
 */
export const attributeGroups = (
  record: BusinessRecord,
  results: Derived[],
  groupFor: (insightId: string) => GroupId
): AttributeGroup[] => {
  const byGroup = attributeRowsByGroup(record, results, groupFor)
  return GROUPS.map((g) => ({
    ...g,
    rows: ordered(g.id, [...(byGroup.get(g.id)?.values() ?? [])])
  })).filter((g) => g.rows.length > 0)
}

/**
 * The layer beneath the insights: one grouping of the addresses, registrations,
 * people and filings the statements were built from, in the pane beside the
 * column that lists the groupings.
 */
export const AttributeGroupDetail = ({
  group,
  record,
  onJumpToSource
}: {
  group: AttributeGroup
  record: BusinessRecord
  /** Follow a source chip to that source's card in the Sources tab. */
  onJumpToSource?: (cardId: string) => void
}) => (
  <AttributeGrid
    title={group.label}
    items={cellsFromRows(group.rows, {
      domesticState: record.formation?.state,
      onJumpToSource
    })}
  />
)
