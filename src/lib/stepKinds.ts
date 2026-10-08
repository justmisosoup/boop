/**
 * A review step's kind: the one of a fixed set of actions it is.
 *
 * The report writes each follow-up in its own words — the name, the file
 * number, what was matched on. The list on the page says the action instead,
 * the same way every time: "Review sanctions hits", "Request certificate of
 * good standing". Read off the instruction's wording first, then off what it
 * cites; a step no rule knows is "Review finding".
 */
/** `cards`: report cards the kind always shows, beyond what the step cites —
 *  a licence question is about where and how the business operates, so it
 *  shows the whole of Activity & Permission: industry, licences, addresses. */
export type StepKind = { id: string; label: string; cards?: ReadonlyArray<string> }

const KINDS: ReadonlyArray<StepKind & { test: RegExp }> = [
  { id: 'sanctions', label: 'Review sanctions hits', test: /\b(ofac|sdn|bis\b|entity list|denied persons|watchlist|sanction)/ },
  { id: 'pep', label: 'Review PEP hits', test: /\bpep\b|politically exposed/ },
  { id: 'media', label: 'Review adverse media', test: /adverse media|\barticles?\b|\breports? (from|on)\b/ },
  { id: 'ownership', label: 'Request ownership certification', test: /beneficial ownership|ownership chart|control person|percent(age)? (or more|interest)/ },
  { id: 'signers', label: 'Request signing authority', test: /\bresolution\b|incumbency|authori[sz]ed signers?|who (opens and )?signs/ },
  { id: 'standing', label: 'Request certificate of good standing', test: /good standing|certificate of (legal )?(existence|status)|reinstatement/ },
  { id: 'formation', label: 'Request formation documents', test: /foreign qualification|formation filing|certificate of incorporation|articles of|\bcharter\b|fictitious business name|conversion filing|merger|asset-transfer/ },
  { id: 'ein', label: 'Request EIN letter', test: /\b(ein|tin)\b|cp ?575|147c/ },
  { id: 'liens', label: 'Request lien or judgment release', test: /lien release|satisfaction|proof of payment|judgment|tax warrants?|\bucc\b|\bdocket\b/ },
  { id: 'address', label: 'Request proof of address', test: /\blease\b|utility bill/ },
  { id: 'activity', label: 'Request account activity explanation', test: /expected account activity|explanation of/ },
  { id: 'licence', label: 'Request licence or permit', cards: ['industry', 'licenses', 'address'], test: /licen[cs]e|\bpermits?\b|operating authority|registrations? (it holds|covering|or licen)/ }
]

/** What a cited insight's key says the step is about, where its words did not. */
const BY_CITE: Record<string, string> = {
  watchlist: 'sanctions',
  politically_exposed_persons: 'pep',
  adverse_media: 'media',
  business_connections: 'ownership',
  person_verification: 'signers',
  kyc_decision: 'signers',
  sos_domestic_sub_status: 'standing',
  sos_inactive: 'standing',
  sos_domestic: 'formation',
  entity_type: 'formation',
  tin: 'ein',
  tin_issued: 'ein',
  liens: 'liens',
  litigations: 'liens',
  address_verification: 'address',
  address_deliverability: 'address',
  industry: 'licence'
}

const FALLBACK: StepKind = { id: 'finding', label: 'Review finding' }

export const stepKind = (instruction: string, cites?: ReadonlyArray<string>): StepKind => {
  const text = instruction.toLowerCase()
  const byWords = KINDS.find((k) => k.test.test(text))
  if (byWords) return { id: byWords.id, label: byWords.label, cards: byWords.cards }
  for (const cite of cites ?? []) {
    const id = BY_CITE[cite.split(':')[0]]
    const kind = id && KINDS.find((k) => k.id === id)
    if (kind) return { id: kind.id, label: kind.label, cards: kind.cards }
  }
  return FALLBACK
}
