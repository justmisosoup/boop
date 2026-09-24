/**
 * State codes, spelled out.
 *
 * A two-letter code is right for a citation chip, where the space is one line of
 * a sentence. On a source card it is not — "Secretary of State — DE" asks the
 * reader to expand it, and half the codes are guessable only if you already know
 * the answer (MI/MN/MO/MS/MT).
 */
/**
 * States whose Secretary of State publishes no entity status.
 *
 * Delaware and New Jersey, and only them: every registration in those two
 * states comes back with no normalized status and no status details — six
 * million and nearly four million filings, 100% Unknown. A filing there reading
 * Unknown is the registry's habit, not a fact about the business, and it is
 * never flagged. An Unknown anywhere else is still a question.
 */
export const STATUS_NOT_PUBLISHED: ReadonlySet<string> = new Set(['DE', 'NJ'])

export const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan',
  MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana',
  NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
  OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee',
  TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  PR: 'Puerto Rico', GU: 'Guam', VI: 'U.S. Virgin Islands', AS: 'American Samoa',
  MP: 'Northern Mariana Islands'
}

/** The state's name, or the code itself when it is not one we hold. */
export const stateName = (code: string | null | undefined) =>
  (code && STATE_NAMES[code.toUpperCase()]) || code || 'Unknown state'

/**
 * A state as a value on the page: New York (NY).
 *
 * The record stores the two-letter code, which is what every other surface
 * cites it by — "SOS · NY" on the chips, "NY 048266" on a licence — so the code
 * has to stay. On its own as a value it made the reader expand an abbreviation
 * to read a filing fact, and the state a company was formed in is one of the
 * few facts on the card that a reviewer weighs rather than scans.
 *
 * An unknown code prints alone: inventing a name for it would be worse than
 * the abbreviation.
 */
export const stateLabel = (code: string | null | undefined) => {
  if (!code) return undefined
  const name = STATE_NAMES[code.toUpperCase()]
  return name ? `${name} (${code.toUpperCase()})` : code
}
