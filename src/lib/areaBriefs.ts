import type { AreaSummary } from './areaSummaries'
import { displayName } from './businessNames'
import type { BusinessRecord } from './deriveResults'
import { identityBrief } from './identityBrief'
import { operationsOf } from './operations'
import type { ReviewAreaId } from './reviewAreas'
import { dismissalOf, screenedOf } from './screening'
import { stateName } from './states'

/**
 * Each assessment area's answer, in one short paragraph.
 *
 * The question each area asks is fixed — is this the business, what does it
 * do and may it, who owns it, does anything come back on screening, what
 * does it owe — so the paragraph answers that and stops. The business is the
 * subject; the facts are the record's; what the record lacks is left out.
 * The headlines and sentences the Assistant's brief carries (`areaSummaries`)
 * are the facts' source for the areas that have one.
 */
const list = (xs: string[]) => (xs.length < 3 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** The policy's assessment ids, by area — the keys `areaSummaries` writes. */
const SUMMARY_ID: Partial<Record<ReviewAreaId, string>> = {
  activity: 'skill-kyb-activity',
  ownership: 'skill-1789767328449',
  screening: 'skill-kyb-3',
  liens: 'skill-financial-standing'
}

/** "4192 S Riverboat Rd, Salt Lake City, UT 84123" → "Salt Lake City, UT". */
const placeOf = (fullAddress: string, state: string | null | undefined): string | undefined => {
  const m = fullAddress.match(/,\s*([^,]+),\s*([A-Z]{2})\b/)
  if (m) return `${m[1].trim()}, ${m[2]}`
  return state ? stateName(state) : undefined
}

/** Does it do what it says, where it says, and may it? */
const activityBrief = (record: BusinessRecord, summary: AreaSummary | undefined): string => {
  const name = displayName(record.name)
  const ops = operationsOf(record)
  const sentences: string[] = []

  // What it does, and what the policy makes of that.
  const lead = ops.industry.lead
  const flagged = [...new Set(ops.industry.flagged.map((c) => c.name).filter((n): n is string => Boolean(n)))]
  sentences.push(
    lead
      ? `${name} is classified as ${lead.name} (NAICS ${lead.code})${
          ops.industry.prohibited === 'flagged' ? `, flagged under your policy as ${list(flagged)}` : ops.industry.prohibited === 'clear' ? ', not a prohibited industry' : ''
        }.`
      : `What ${name} does is not on the record.`
  )

  // Where: the office, with its standing in that state, then every other
  // place a source ties to the business — by city and state.
  const officeAddr = ops.office ? record.addresses.find((a) => a.submitted && a.state === ops.office!.state) : undefined
  const office = officeAddr ? placeOf(officeAddr.fullAddress, officeAddr.state) : ops.office ? stateName(ops.office.state) : undefined
  const standing =
    ops.office?.verdict === 'active'
      ? 'where it is registered and active'
      : ops.office?.verdict === 'inactive'
        ? 'where its registration is inactive'
        : ops.office?.verdict === 'not_registered'
          ? 'where it is not registered'
          : undefined
  // Every place but the office — a submitted mailing address included. One
  // tile per place: USPS writes "Salt Lake Cty" for the same city.
  const sameKey = (p: string) => p.toLowerCase().replace(/\bcty\b/g, 'city').replace(/\bmt\b/g, 'mount').replace(/\bft\b/g, 'fort').replace(/\bst\b/g, 'saint').replace(/\s+/g, ' ')
  const seen = new Set(office ? [sameKey(office)] : [])
  const others = ops.locations
    .map((a) => placeOf(a.fullAddress, a.state))
    .filter((p): p is string => Boolean(p))
    .filter((p) => (seen.has(sameKey(p)) ? false : (seen.add(sameKey(p)), true)))
  // "City, ST" pairs carry commas, so the list is set off with semicolons.
  const places = (xs: string[]) => {
    const shown = xs.length > 6 ? [...xs.slice(0, 5), `${xs.length - 5} more`] : xs
    return shown.length < 3 ? shown.join(' and ') : `${shown.slice(0, -1).join('; ')} and ${shown.at(-1)}`
  }
  if (office) {
    sentences.push(
      `It operates from ${office}${standing ? `, ${standing}` : ''}${
        others.length > 0 ? `, with ${others.length === 1 ? 'another location' : 'other locations'} in ${places(others)}` : ''
      }.`
    )
  } else if (others.length > 0) {
    sentences.push(`No office was submitted; records place it in ${places(others)}.`)
  }

  // May it: the licence its industry needs, and the state licences it holds.
  // The area's own sentences say this already; take only those.
  const permission = (summary?.summary ?? '').split(/(?<=\.)\s+/).filter((x) => /licen[cs]e|authority|USDOT|Holds /.test(x))
  sentences.push(...permission)

  return sentences.join(' ')
}

/** Who owns and controls it? The area's sentences answer it directly. */
const ownershipBrief = (record: BusinessRecord, summary: AreaSummary | undefined): string =>
  summary?.summary || `No ownership information is on record for ${displayName(record.name)}.`

/** Does anything come back? What stands, by screen and name; what was dismissed, counted. */
const screeningBrief = (record: BusinessRecord): string => {
  const s = screenedOf(record)
  const live = {
    watchlist: s.watchlist.hits.filter((h) => !dismissalOf('watchlist', h)),
    pep: s.pep.hits.filter((h) => !dismissalOf('pep', h)),
    media: s.media.hits.filter((h) => !dismissalOf('media', h))
  }
  const dismissed = s.watchlist.hits.length + s.pep.hits.length + s.media.hits.length - (live.watchlist.length + live.pep.length + live.media.length)
  const names = (hits: Array<{ name: string }>) => {
    const all = [...new Set(hits.map((h) => h.name))]
    return all.length > 3 ? `${all.length} names` : list(all)
  }
  const standing = [
    live.watchlist.length > 0 ? `${plural(live.watchlist.length, 'watchlist hit')} on ${names(live.watchlist)}` : '',
    live.pep.length > 0 ? `${plural(live.pep.length, 'PEP hit')} on ${names(live.pep)}` : '',
    live.media.length > 0 ? `${plural(live.media.length, 'adverse media result')} on ${names(live.media)}` : ''
  ].filter(Boolean)
  const screenedNames = new Set([...s.watchlist.names, ...s.pep.names, ...s.media.names]).size
  const first =
    standing.length > 0
      ? `${list(standing)} ${standing.length === 1 && !/hits|results/.test(standing[0]) ? 'stands' : 'stand'} to review.`
      : `Nothing stands against ${displayName(record.name)}${screenedNames > 0 ? ` or the ${plural(screenedNames, 'name')} screened` : ''}.`
  const second = dismissed > 0 ? `${plural(dismissed, 'result was', 'results were')} dismissed as not matching.` : ''
  return [first.charAt(0).toUpperCase() + first.slice(1), second].filter(Boolean).join(' ')
}

/** What does it owe? The area's headline is the answer; its sentences, the detail. */
const liensBrief = (record: BusinessRecord, summary: AreaSummary | undefined): string =>
  summary ? `${summary.headline}. ${summary.summary}`.replace(/\.\. /, '. ') : `No liens, judgments or bankruptcies are on file for ${displayName(record.name)}.`

export const areaBrief = (area: ReviewAreaId, record: BusinessRecord, summaries: Map<string, AreaSummary>): string | undefined => {
  const summary = SUMMARY_ID[area] ? summaries.get(SUMMARY_ID[area]!) : undefined
  switch (area) {
    case 'identity':
      return identityBrief(record)
    case 'activity':
      return activityBrief(record, summary)
    case 'ownership':
      return ownershipBrief(record, summary)
    case 'screening':
      return screeningBrief(record)
    case 'liens':
      return liensBrief(record, summary)
  }
}
