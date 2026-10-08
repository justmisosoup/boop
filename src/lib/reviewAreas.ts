import type { ReportBrief } from './reportBrief'
import { stepKind } from './stepKinds'

/**
 * The assessment areas the review steps are filed under — the one-pager's
 * four, and Liens & litigations where a policy runs it. Each step's kind
 * (`stepKinds`) belongs to one area, so the list under the score groups the
 * same way every time, whatever words the report used.
 */
export type ReviewAreaId = 'identity' | 'activity' | 'ownership' | 'screening' | 'liens'

/** `cards`: the report cards the area is read from — what the report
 *  narrows to when the area is selected. Fixed per area, not read off the
 *  report: Identity is the formation, the website and the officers; Activity
 *  & Permission is the industry, the licences and the addresses. */
export type ReviewArea = { id: ReviewAreaId; label: string; cards: ReadonlyArray<string> }

export const REVIEW_AREAS: ReadonlyArray<ReviewArea> = [
  { id: 'identity', label: 'Identity', cards: ['formation', 'website', 'people', 'tin'] },
  { id: 'activity', label: 'Activity & Permission', cards: ['industry', 'licenses', 'address'] },
  { id: 'ownership', label: 'Ownership & Control', cards: ['people', 'connections', 'kyc'] },
  { id: 'screening', label: 'Compliance Screenings', cards: ['screening-watchlist', 'screening-pep', 'screening-media'] },
  { id: 'liens', label: 'Liens & Litigations', cards: ['liens', 'litigation', 'bankruptcy'] }
]

const AREA_OF_KIND: Record<string, ReviewAreaId> = {
  standing: 'identity',
  formation: 'identity',
  ein: 'identity',
  finding: 'identity',
  address: 'activity',
  licence: 'activity',
  activity: 'activity',
  ownership: 'ownership',
  signers: 'ownership',
  sanctions: 'screening',
  pep: 'screening',
  media: 'screening',
  liens: 'liens'
}

/** The brief's blocks that are not a policy's assessment, by their own ids:
 *  the formation block is Identity's, and so is the business's web presence. */
const AREA_OF_BLOCK: Record<string, ReviewAreaId> = { formation: 'identity', 'web-presence': 'identity' }

/** Which area a brief block is: by its id where the block is the report's own, else by its assessment's name. */
export const areaOfAssessmentName = (name: string | undefined, blockId?: string): ReviewAreaId | undefined => {
  if (blockId && AREA_OF_BLOCK[blockId]) return AREA_OF_BLOCK[blockId]
  const n = (name ?? '').toLowerCase()
  if (/identif|identity|verification/.test(n)) return 'identity'
  if (/activity|permission|industry/.test(n)) return 'activity'
  if (/ownership|control/.test(n)) return 'ownership'
  if (/screening|compliance/.test(n)) return 'screening'
  if (/lien|litigation|financial/.test(n)) return 'liens'
  return undefined
}

export type ReviewGroup = ReviewArea & {
  steps: Array<{ index: number; label: string; cites?: string[] }>
}

/**
 * The areas in their order, each with its open steps. The four one-pager
 * areas are always listed — a clear report still has its assessments to look
 * at — and Liens & litigations only where a step falls there.
 */
export const reviewGroups = (
  determination: NonNullable<ReportBrief['determination']>,
  resolved: readonly number[] = []
): ReviewGroup[] => {
  const open = determination.steps
    .map((step, index) => ({ step, index, kind: stepKind(step.instruction, step.cites) }))
    .filter(({ index }) => !resolved.includes(index + 1))
  return REVIEW_AREAS.map((area) => ({
    ...area,
    steps: open
      .filter(({ kind }) => (AREA_OF_KIND[kind.id] ?? 'identity') === area.id)
      .map(({ index, kind, step }) => ({ index, label: kind.label, cites: step.cites }))
  })).filter((g) => g.id !== 'liens' || g.steps.length > 0)
}
