import type { PortfolioBusiness } from '../types'
import { deriveResults } from './deriveResults'
import { heldReportFor } from './heldReports'
import { negativesFor } from './identityScore'
import { ALL, assessmentOf } from './records'
import { KIND_OF_BAND, KIND_SHORT } from './reportBrief'
import { TEAM, reviewOf, statusForBand } from './review'
import { screenedOf } from './screening'

/**
 * Every business as a question about the whole list reads it: the newest
 * report's call, score and headline, what the score read against the identity,
 * the public record and the screens counted, and where the review stands in
 * this browser. Built when a question is sent,
 * from what the list already reads — never written by hand.
 */
export const portfolioSnapshot = (): PortfolioBusiness[] =>
  ALL.map((r) => {
    const assessed = assessmentOf(r)
    const held = heldReportFor(r.name)
    const record = held?.snapshot?.record ?? r
    const results = deriveResults(record)
    const negative = negativesFor(record, results)
    const screens = screenedOf(record)
    const review = reviewOf(r.id, assessed ? statusForBand(assessed.score.band.id) : 'in_review')
    return {
      id: r.id,
      name: r.name,
      state: r.formation?.state ?? null,
      recommendation: (assessed ? KIND_SHORT[KIND_OF_BAND[assessed.score.band.id]] : 'Not assessed') as PortfolioBusiness['recommendation'],
      score: assessed?.score.value,
      assessedAt: assessed?.at || undefined,
      headline: held?.report?.headline || undefined,
      flagged: results.filter((x) => negative.has(x.insightId)).map((x) => x.statement),
      records: {
        liens: { open: (record.liens ?? []).filter((l) => l.status?.toLowerCase() === 'open').length, total: (record.liens ?? []).length },
        litigations: {
          open: (record.litigations ?? []).filter((c) => c.caseStatus?.toLowerCase() === 'open').length,
          total: (record.litigations ?? []).length
        },
        bankruptcies: (record.bankruptcies ?? []).length
      },
      screening: {
        ...(screens.watchlist.ran ? { watchlist: screens.watchlist.hits.length } : {}),
        ...(screens.pep.ran ? { pep: screens.pep.hits.length } : {}),
        ...(screens.media.ran ? { media: screens.media.hits.length } : {})
      },
      review: {
        status: review.status,
        assignee: TEAM.find((t) => t.id === review.assigneeId)?.name,
        requested: review.requested?.items
      }
    }
  })
