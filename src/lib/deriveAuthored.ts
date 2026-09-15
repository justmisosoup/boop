/**
 * Runs an authored insight against a record.
 *
 * Without this an authored insight would list in the Catalog and never appear
 * anywhere else — and, more to the point, never reach the assessment.
 * `AnalysisRequest.insights` is documented as "EVERY insight on the record.
 * The session picks from these — it cannot pick what it was not given", so an
 * insight that does not derive is an insight the assessment cannot use.
 *
 * Scope is Names. The comparison is the same three-way reading the shipped
 * `business_name_verification` makes — exact, similar, none — rather than a
 * second notion of "similar" living beside it.
 *
 * HOW THE RECORD CARRIES THIS. There are not separate "submitted" and "found"
 * name rows to compare. A name row is one name STRING, with `sourceRefs`
 * listing every source that rendered it — so "Middesk Inc" is marked submitted
 * and also carries five registration refs, meaning those registrations render
 * exactly that name. An exact match is therefore the submitted row itself
 * carrying a ref from the source in question, and a near miss is a different
 * name row carrying it instead.
 */
import type { InsightResult, NoResultReason } from '../types'
import type { AttributeRow } from './attributes'
import { composeStatement, sourceLabel, type AuthoredInsight, type CompiledSource } from './customInsights'
import type { BusinessRecord } from './deriveResults'
import { type Jurisdiction, NAME_SOURCES, nameSource } from './vocabulary'

/** Record spelling back to the catalog id, for labelling evidence rows. */
const NAME_SOURCE_BY_RECORD_TYPE = new Map(
  NAME_SOURCES.flatMap((source) => source.recordTypes.map((type) => [type, source.id]))
)

/**
 * Company-suffix- and punctuation-insensitive form.
 *
 * "Acme Widgets, Inc." and "ACME WIDGETS INC" are the same claim written two
 * ways; treating that as a mismatch would make almost every record fail.
 */
const canonical = (value: string) =>
  value
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .replace(/\b(inc|incorporated|llc|l\.l\.c|corp|corporation|co|company|ltd|limited|lp|llp|pllc|pc)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Loose containment, which is what "similar" means for a business name. */
const similar = (a: string, b: string) => {
  const [x, y] = [canonical(a), canonical(b)]
  if (!x || !y) return false

  return x.includes(y) || y.includes(x)
}

type NameRow = NonNullable<BusinessRecord['names']>[number]

/** Does this name carry a ref from one of the compiled sources? */
const carriedBy = (name: NameRow, sources: CompiledSource[]) => {
  if (sources.length === 0) return (name.sourceRefs ?? []).length > 0

  return (name.sourceRefs ?? []).some((ref) =>
    sources.some((source) => {
      const definition = nameSource(source.id)
      if (!definition?.recordTypes.includes(ref.type)) return false
      const wanted = source.jurisdictions?.length ? source.jurisdictions : definition.jurisdictions
      if (!wanted?.length) return true
      const jurisdiction = (ref.metadata as { jurisdiction?: string } | undefined)?.jurisdiction

      return Boolean(jurisdiction && wanted.includes(jurisdiction as Jurisdiction))
    })
  )
}

const noResult = (
  insight: AuthoredInsight,
  reason: NoResultReason,
  because: string
): InsightResult => ({
  insightId: insight.id,
  statement: composeStatement(insight),
  group: 'name',
  state: 'no_result',
  reason,
  because
})

/**
 * The result for one record, or a `no_result` saying why there isn't one.
 *
 * A record the insight cannot apply to is not an error and not an omission —
 * it is `no_result` with a reason, exactly as the built-in checks behave. The
 * definition stays valid and may well produce a result on the next record.
 *
 * The state reported is the one that obtains, not a pass/fail against the
 * relation the author picked: an insight has several states, and saying which
 * one holds is more use than saying whether one guess was right.
 */
export const deriveAuthored = (
  insight: AuthoredInsight,
  record: BusinessRecord
): InsightResult => {
  const { subject, sources } = insight.compiled
  const statement = composeStatement(insight)

  const submitted = (record.names ?? []).find(
    (name) => name.submitted && (name.type ?? 'legal') === subject.nameType
  )
  if (!submitted) {
    return noResult(
      insight,
      'not_required',
      subject.nameType === 'dba'
        ? 'No DBA was submitted for this business.'
        : 'No business name was submitted.'
    )
  }

  const carriers = (record.names ?? []).filter((name) => carriedBy(name, sources))
  if (carriers.length === 0) {
    return noResult(
      insight,
      'not_held_or_unreachable',
      sources.length === 0
        ? 'No source on this record carries a business name to compare against.'
        : 'None of the sources this insight reads returned a name for this business.'
    )
  }

  // The submitted row carrying a ref from the source IS the exact match: that
  // source rendered this exact name.
  const exact = carriers.includes(submitted)
  const others = carriers.filter((name) => name !== submitted)
  const close = others.filter((name) => similar(name.name, submitted.name))

  const [value, evidence] = exact
    ? ['match', [submitted.name]]
    : close.length > 0
      ? [`similar match \u2014 ${close.map((n) => n.name).join(', ')}`, close.map((n) => n.name)]
      : [`no match \u2014 ${others.map((n) => n.name).join(', ') || 'a different name'}`,
         others.map((n) => n.name)]

  return {
    insightId: insight.id,
    statement,
    group: 'name',
    state: 'result',
    // In the insight's own terms. Never a grade.
    value: value as string,
    evidence: evidence as string[]
  }
}

/** Every authored insight run against a record. */
export const deriveAuthoredAll = (
  insights: readonly AuthoredInsight[] | undefined,
  record: BusinessRecord | undefined
): InsightResult[] => {
  if (!insights?.length || !record) return []

  return insights.flatMap((insight) => {
    try {
      return [deriveAuthored(insight, record)]
    } catch {
      // One bad definition must not take the tab down with it.
      return []
    }
  })
}

/** The refs on this name that come from one of the compiled sources. */
const matchingRefs = (name: NameRow, sources: CompiledSource[]) =>
  (name.sourceRefs ?? []).filter((ref) =>
    sources.length === 0
      ? true
      : sources.some((source) => {
          const definition = nameSource(source.id)
          if (!definition?.recordTypes.includes(ref.type)) return false
          const wanted = source.jurisdictions?.length
            ? source.jurisdictions
            : definition.jurisdictions
          if (!wanted?.length) return true
          const jurisdiction = (ref.metadata as { jurisdiction?: string } | undefined)?.jurisdiction

          return Boolean(jurisdiction && wanted.includes(jurisdiction as Jurisdiction))
        })
  )

/**
 * The evidence behind an authored insight.
 *
 * Scoped to the sources the insight actually reads. The generic fallback in
 * `attributes.ts` returns the submitted name with every source attached to it,
 * which for an insight about one registration means showing a tax permit and
 * four others that had nothing to do with the finding.
 */
export const authoredAttributes = (
  insight: AuthoredInsight,
  record: BusinessRecord
): AttributeRow[] => {
  const { subject, sources } = insight.compiled
  const submitted = (record.names ?? []).find(
    (name) => name.submitted && (name.type ?? 'legal') === subject.nameType
  )

  const rows: AttributeRow[] = submitted
    ? [
        {
          group: 'name',
          label: subject.nameType === 'dba' ? 'Submitted DBA' : 'Submitted name',
          value: submitted.name,
          source: '',
          submitted: true
        }
      ]
    : []

  for (const name of record.names ?? []) {
    const refs = matchingRefs(name, sources)
    if (refs.length === 0) continue
    rows.push({
      group: 'name',
      label:
        sources.length === 1
          ? sourceLabel(sources[0])
          : (nameSource(
              NAME_SOURCE_BY_RECORD_TYPE.get(refs[0].type) ?? ''
            )?.label ?? refs[0].type),
      value: name.name,
      source: '',
      sources: [...new Set(refs.map((ref) => ref.type))],
      refs
    })
  }

  return rows
}
