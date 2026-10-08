import { filingAge } from './attributes'
import { displayName } from './businessNames'
import { trueEntityType, type BusinessRecord } from './deriveResults'
import { entityFormLabel } from './normalise'
import { formWord, solePropPhrase } from './soleProp'
import { article } from './registrationStatus'
import { stateName } from './states'

/**
 * The business in two sentences, for under the score: when and where it was
 * formed, what it does and where from. Each clause is one fact read off the
 * record — nothing is inferred, and a fact the record lacks is a clause left
 * out, so the prose shrinks rather than guesses.
 *
 *   "Zions Bank is a Corporation formed 10 years, 7 months ago. It operates
 *    in Salt Lake City, UT in the Commercial Banking industry."
 */
export const businessBlurb = (record: BusinessRecord): string | undefined => {
  const name = displayName(record.name)
  const sentences: string[] = []

  const formation = record.formation
  const form = trueEntityType(record)
  const formLabel = form && !/^unknown$/i.test(form) ? String(entityFormLabel(form)) : undefined
  // A sole proprietorship has no formation to date: say what it is, not when.
  const sole = solePropPhrase(record)
  if (sole) {
    sentences.push(`${name} is ${sole}.`)
  } else if (formation?.date || formLabel) {
    // "Zions Bank is a Corporation formed 10 years, 7 months ago."
    // Without a stated form: "Zions Bank was formed 10 years, 7 months ago."
    const word = formLabel ? formWord(formLabel) : undefined
    const lead = word ? `${name} is ${article(word)} ${word} formed` : `${name} was formed`
    let when = ''
    if (formation?.date) {
      // filingAge says "(10 years, 7 months old)"; here it is "10 years, 7 months ago".
      const age = filingAge(formation.date)?.replace(/^\(|\)$/g, '').replace(/ old$/, '')
      const month = new Date(formation.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      // The age alone — "formed 4 years, 3 months ago" — not the month as well.
      when = age && !/today/.test(age) ? ` ${age} ago` : ` in ${month}`
    }
    const where = formation?.state && !formLabel ? ` in ${stateName(formation.state)}` : ''
    sentences.push(`${lead}${when}${where}.`)
  }

  const naics = (record.industry ?? [])
    .filter((c) => /^naics$/i.test(c.system ?? '') && c.name)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  // The classifier's "Insufficient data" is not an industry.
  const industry = naics[0]?.name && !/^insufficient data$/i.test(naics[0].name) ? naics[0].name : undefined
  // The submitted office, not the registered agent's address.
  const office = record.addresses.find((a) => a.submitted && !a.isRegisteredAgent && !a.labels.includes('registered_agent'))
  // "4192 S Riverboat Rd, Salt Lake City, UT 84123" → "Salt Lake City, UT"
  const place = office ? (office.fullAddress.match(/,\s*([^,]+),\s*([A-Z]{2})\b/) ?? []).slice(1).join(', ') || office.fullAddress : undefined
  // "It operates in Salt Lake City, UT in the Commercial Banking industry."
  if (industry && place) sentences.push(`It operates in ${place} in the ${industry} industry.`)
  else if (industry) sentences.push(`It operates in the ${industry} industry.`)
  else if (place) sentences.push(`It operates in ${place}.`)

  return sentences.length > 0 ? sentences.join(' ') : undefined
}
