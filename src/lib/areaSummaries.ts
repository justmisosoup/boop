import { entityTypeCode } from './attributes'
import type { BusinessRecord } from './deriveResults'
import { industrySectorOf } from './naics'
import { stateName } from './states'

/**
 * What each area is asking, for this business.
 *
 * Not a restatement of the insights under it — they carry the facts. This
 * says why the area matters for the use case, given what kind of entity the
 * business is and what it does: the reason a reviewer is reading these rows.
 */
export const areaSummaries = (record: BusinessRecord, useCase: string): Map<string, string> => {
  const entity = entityTypeCode(record)
  const kind = entity ?? 'business'
  const state = record.formation ? stateName(record.formation.state) : undefined
  const industry = industrySectorOf(record)
  const purpose = useCase.toLowerCase()
  const upper = (entity ?? '').toUpperCase()

  /*
   * A professional entity is owned by licensed practitioners, and the licence
   * record is the thing that answers it — named here, not restated.
   */
  const professional = upper === 'PLLC' || upper === 'PC' || upper === 'PA'
  const licences = record.licenses ?? []
  const registry = licences[0]?.registry
  const licencePointer = licences.length
    ? `The ${registry ?? 'licence'} record found for the practice is what shows it.`
    : 'No licence record is on the file, so that is the thing to look for.'

  const ownership = professional
    ? `A ${entity} is a professional company: only licensed practitioners can own it. ${licencePointer}`
      : upper === 'CORPORATION'
        ? 'A corporation names officers on its filing but not shareholders, so ownership rests on what the customer certifies.'
        : upper === 'LLC'
          ? 'An LLC rarely names its members publicly, so ownership usually rests on what the customer certifies.'
          : 'Who owns it is rarely on a public filing, so ownership usually rests on what the customer certifies.'

  return new Map([
    [
      'skill-kyb-identification',
      `For ${purpose}, the account holder has to be the registered entity. ${
        state ? `A ${kind} formed in ${state} is established by its ${state} filing, so that is what this leans on.` : 'With no formation filing on the record, this leans on what else the record can corroborate.'
      }`
    ],
    [
      'skill-kyb-3',
      `An account cannot open for a sanctioned party. For a ${kind}, that means the entity and the people named on its filings.`
    ],
    [
      'skill-kyb-activity',
      professional
        ? `${useCase} turns on what the money is for. As a ${entity}, the practice needs a professional licence to operate${
            industry ? ` as ${industry}` : ''
          }. ${licencePointer}`
        : industry
        ? `${useCase} turns on what the money is for. Classified as ${industry}, this asks whether that line of business is restricted or needs a licence.`
        : `${useCase} turns on what the money is for. No industry classification is on the record, so this asks what the business does before anything else.`
    ],
    ['skill-1789767328449', `The bank has to know who owns and controls the account holder. ${ownership}`],
    [
      'skill-financial-standing',
      `For an operating account, liens, judgments and bankruptcies point to money the ${kind} owes elsewhere.`
    ]
  ])
}
