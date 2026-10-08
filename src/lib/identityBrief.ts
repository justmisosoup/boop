import { otherStateStandings } from '../components/Report/FilingStrip'
import { displayName } from './businessNames'
import { trueEntityType, type BusinessRecord } from './deriveResults'
import { entityFormLabel } from './normalise'
import { article, formationFilingOf, registrationState, sameName } from './registrationStatus'
import { formWord, solePropPhrase } from './soleProp'
import { stateName } from './states'

/**
 * The Identity assessment in one short paragraph: does the record establish
 * that this is the business on the application?
 *
 * The answer first, then only the facts it rests on — the filing (what, where,
 * when, under which name, standing), where else it is registered, and whether
 * the web corroborates it. Every clause is read off the record; what the
 * record lacks is left out, not guessed at.
 *
 *   "Sorenson Communications, LLC is a Utah corporation formed in 2000 under
 *    the submitted name. The Utah filing has expired; it is active in 1
 *    other state and inactive in 25. Its website, sorenson.com, is online on
 *    a 29-year-old domain, and 5 third-party profiles corroborate it."
 */
export const identityBrief = (record: BusinessRecord): string | undefined => {
  const name = displayName(record.name)
  const sentences: string[] = []

  const f = formationFilingOf(record)
  const form = trueEntityType(record) ?? f?.entityType ?? record.formation?.entityType
  const formLabel = form && !/^unknown$/i.test(form) ? String(entityFormLabel(form)) : undefined
  const state = f?.state ?? record.formation?.state
  const iso = f?.registrationDate ?? record.formation?.date
  const year = iso && /^\d{4}/.test(iso) ? iso.slice(0, 4) : undefined
  const submitted = (record.names ?? []).find((n) => n.submitted)?.name ?? record.name

  // A sole proprietorship has no formation filing to date or name: what it
  // is, and the registration that places it, say it.
  const sole = solePropPhrase(record)
  if (sole) {
    sentences.push(`${name} is ${sole}${state ? `, registered in ${stateName(state)}` : ''}.`)
  } else if (state || formLabel) {
    // "… is a Utah corporation formed in 2000 under the submitted name."
    const what = [state ? stateName(state) : undefined, formLabel ? formWord(formLabel) : 'business'].filter(Boolean).join(' ')
    // "a Utah corporation", "an Indiana LLC": by how the word is said.
    // "a Utah", "an Indiana", "an LLC": by how the first word is said.
    const first = what.split(' ')[0]
    const a = /^u[tn]a|^uni|^use|^usu|^one/i.test(first) ? 'a' : article(first)
    const under = f?.name ? (sameName(f.name, submitted) ? ' under the submitted name' : ` as ${f.name}, not the submitted ${submitted}`) : ''
    sentences.push(`${name} is ${a} ${what}${year ? ` formed in ${year}` : ''}${under}.`)
  } else {
    sentences.push(`No formation filing was found for ${name}.`)
  }

  if (f && state) {
    // The filing's standing, and where else it is registered.
    const st = registrationState(f)
    const others = otherStateStandings(record, state)
    const elsewhere =
      others.total > 0
        ? [
            others.active > 0 ? `active in ${others.active} other ${others.active === 1 ? 'state' : 'states'}` : undefined,
            others.inactive > 0 ? `inactive in ${others.inactive}` : undefined
          ]
            .filter(Boolean)
            .join(' and ')
        : undefined
    const standing = st.silent
      ? `${stateName(state)} does not publish filing status`
      : /^active$/i.test(st.status ?? '')
        ? `The ${stateName(state)} filing is active`
        : st.status
          ? `The ${stateName(state)} filing is ${st.status.toLowerCase()}${st.statusDetails && !/^active$/i.test(st.statusDetails) ? ` (${st.statusDetails.toLowerCase()})` : ''}`
          : undefined
    if (standing || elsewhere) sentences.push(`${[standing, elsewhere ? `it is ${elsewhere}` : undefined].filter(Boolean).join('; ')}.`.replace(/^it is/, 'It is'))
  }

  // The web: the site and how long its domain has been held, and the profiles.
  const site = record.website?.url ? record.website : undefined
  const host = site?.url ? site.url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '') : undefined
  const created = site?.domainCreated ? new Date(site.domainCreated) : undefined
  const years = created && !Number.isNaN(created.getTime()) ? Math.floor((Date.now() - created.getTime()) / (365.25 * 86_400_000)) : undefined
  const profiles = (record.profiles ?? []).length
  if (site && host) {
    const online = site.status === 'online'
    // "an 8-year-old", "an 11-year-old", "an 18-year-old": by how the number is said.
    const domain = years !== undefined && years > 0 ? ` on ${/^(8|11|18|8\d)$/.test(String(years)) ? 'an' : 'a'} ${years}-year-old domain` : ''
    const corroborate = profiles > 0 ? `, and ${profiles === 1 ? 'one third-party profile corroborates' : `${profiles} third-party profiles corroborate`} it` : ''
    sentences.push(`Its website, ${host}, is ${online ? 'online' : 'not reachable'}${domain}${corroborate}.`)
  } else if (profiles > 0) {
    sentences.push(`No website was found; ${profiles === 1 ? 'one third-party profile corroborates' : `${profiles} third-party profiles corroborate`} the business.`)
  } else {
    sentences.push('No website or third-party profiles were found.')
  }

  return sentences.join(' ')
}
