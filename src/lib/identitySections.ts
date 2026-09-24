import { entityTypeCode } from './attributes'
import type { BusinessRecord } from './deriveResults'
import type { GroupId } from './groups'
import { stateName } from './states'

/**
 * The Identity assessment's rows, by the question each one answers.
 *
 * The pillar asks one thing — is this a real business, and is it the one it
 * claims to be — and establishes it in four parts. A flat list of seventeen
 * checks left the reader to sort them into those parts; this sorts them.
 * Keyed by the Insights panel's own topics, so an insight's place here is its
 * place there.
 *
 * Each part is headed by what it found, not by its name: the groupings are
 * the model's, per business, and the heading is its finding. `label` is the
 * fallback when there is nothing to find it from.
 *
 * Digital corroboration only appears when the record has web evidence: an
 * empty heading would say it was checked and came back empty.
 */
export type IdentitySection = {
  label: string
  groups: ReadonlyArray<GroupId>
  headline: (record: BusinessRecord) => string
}

const task = (record: BusinessRecord, key: string) => record.reviewTasks.find((t) => t.key === key)?.subLabel ?? ''
const is = (record: BusinessRecord, key: string, re: RegExp) => re.test(task(record, key))

export const IDENTITY_SECTIONS: ReadonlyArray<IdentitySection> = [
  {
    label: 'Registered entity',
    groups: ['name', 'formation', 'tin', 'international_registration'],
    headline: (r) => {
      if (!r.formation) return 'No formation filing on record'
      const kind = entityTypeCode(r) ?? 'business'
      const noun = /^[A-Z]{2,5}$/.test(kind) ? kind : kind.toLowerCase()
      return is(r, 'name', /^verified$/i)
        ? `Registered in ${stateName(r.formation.state)} as a ${noun}, under the submitted name`
        : `Registered in ${stateName(r.formation.state)} as a ${noun}, under a different name`
    }
  },
  {
    label: 'Address & active status',
    groups: ['address', 'registration'],
    headline: (r) => {
      const active = is(r, 'sos_match', /submitted active/i)
        ? 'Active'
        : is(r, 'sos_match', /inactive/i)
          ? 'Inactive'
          : is(r, 'sos_match', /not registered/i)
            ? 'Not registered'
            : ''
      const address = task(r, 'address_deliverability')
        ? `${is(r, 'address_deliverability', /^deliverable$/i) ? 'a deliverable' : 'an undeliverable'}${
            is(r, 'address_property_type', /commercial/i) ? ' commercial' : is(r, 'address_property_type', /residential/i) ? ' residential' : ''
          } address`
        : ''
      if (active && address) return `${active} at ${address}`
      if (active) return `${active} in the state of its office`
      if (address) return `At ${address}`
      return 'Address & active status'
    }
  },
  {
    label: 'Digital corroboration',
    groups: ['website', 'profiles', 'phone'],
    headline: (r) => {
      const confirmed = [
        ['web_business_name_verification', 'business name'],
        ['web_address_verification', 'office address'],
        ['web_person_verification', 'submitted person']
      ]
        .filter(([k]) => /verified|match/i.test(task(r, k)) && !/mismatch|unverified/i.test(task(r, k)))
        .map(([, l]) => l)
      return confirmed.length
        ? `Website confirms the ${confirmed.length < 3 ? confirmed.join(' and ') : `${confirmed.slice(0, -1).join(', ')} and ${confirmed.at(-1)}`}`
        : 'Website confirms none of the submitted details'
    }
  },
  {
    label: 'Resolves to one entity',
    groups: ['people', 'connections'],
    headline: (r) =>
      !task(r, 'person_verification')
        ? 'Resolves to one entity'
        : is(r, 'person_verification', /^verified$/i)
          ? 'Submitted person is on the filings'
          : "Submitted person isn't on the filings"
  }
]
