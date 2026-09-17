/**
 * What can be dropped into the composer: contexts and workflows.
 *
 * Two kinds, because sending them are two different acts. A **context** scopes
 * a question you type — "using Middesk Jurisdictions, which states is it not
 * registered in?" — and answers it. A **workflow** runs on its own: no question
 * needed, because the workflow is the question.
 *
 * The standing report is not a special case under this model. It is the SMB
 * account opening workflow firing on arrival, and it is the same thing a
 * reader could have dropped into the box themselves.
 *
 * Middesk's own are defaults: selectable, not editable. A customer can add
 * their own, and those they define and change — `editable` is what separates
 * the two, and nothing in the UI may offer an edit without it.
 */
export type LibraryItem = {
  id: string
  name: string
  /** One line, shown under the name in the picker. */
  description: string
  /** What it actually contributes to the run. */
  instructions: string
  /** False for Middesk's own. */
  editable: boolean
  /**
   * The version Middesk ships, on its own skills only.
   *
   * A default is not a fixed thing — what "Jurisdictions" grounds an answer in
   * changes as coverage does — so a reader comparing two runs needs to know
   * which version each was written against. The customer's own carry an author
   * and an edit time instead; those are the same question answered for
   * something with no release behind it.
   */
  version?: string
  /** What a default covers, named for a reader deciding whether to add it. */
  covers?: string[]
}

export type Workflow = LibraryItem & {
  /** Context ids the workflow runs with — the escalation a plain context does
   *  not have. */
  contexts: string[]
}

/**
 * Middesk's context. Selectable, not editable.
 *
 * One, not three. The split into Entities, Jurisdictions and Industries
 * described how the data is produced rather than anything a reader chooses
 * between — nobody grounds an answer in the filings but not the entity — so
 * three rows asked a question with no useful wrong answer.
 */
export const MIDDESK_CONTEXTS: LibraryItem[] = [
  {
    id: 'middesk-context',
    name: 'Middesk Context',
    description: 'What the record holds, and how to read it',
    instructions:
      'Ground the answer in what the record establishes about the entity: its legal and trade ' +
      'names, entity type, tax identification, the people attached to it, its addresses, and the ' +
      'businesses it is connected to. Read the filings for what they say and what they withhold — ' +
      'which jurisdictions the business is registered in, the status of each filing, which is ' +
      'domestic — and say when a question cannot be answered because a state does not publish it. ' +
      'Read all of it against the line of work and against how long the business has been going: ' +
      'what is ordinary for a business of this kind and this age rather than for a business in ' +
      'general.',
    editable: false,
    version: '0.12',
    covers: ['Industries', 'Entities', 'Jurisdictions', 'Age of Business']
  }
]

/**
 * The workflow a new customer starts with.
 *
 * NOT a Middesk default. Middesk supplies the contexts — what the record holds
 * and how to read it — and the customer supplies the policy that uses them:
 * which stages their file is built from, and what it takes to onboard. That is
 * their decision, not ours, so this is seeded into their own store on first
 * load and is theirs to change or delete from then on.
 */
export const SEED_WORKFLOW = {
    id: 'smb-account-opening',
    name: 'SMB account opening',
    description: 'The full KYB assessment and an onboarding recommendation',
    instructions:
      'Core KYB for a financial institution opening a business bank account. Work the stages an ' +
      'onboarding file is built from, in this order\n\n' +
      '- customer identification, whether a legally registered entity exists, is active, and is the applicant\n' +
      '- beneficial ownership and control, including what can only come from the customer\n' +
      '- the nature and purpose of the account, meaning whether the business is actually operating and what is expected to flow through it\n' +
      '- sanctions, PEP and watchlist screening\n' +
      '- adverse information and financial standing\n\n' +
      'Then recommend whether to onboard, and name the steps that complete the case file.',
    contexts: MIDDESK_CONTEXTS.map((c) => c.id),
    editable: true
}

/** The skill a run was made from, matched on the instructions it was sent.
 *  The customer's own are passed in — only Middesk's live in this file. */
export const skillFor = (
  prompt: string,
  custom: Array<{ id: string; name: string; instructions: string }> = []
): { id: string; name: string } | undefined =>
  [...custom, ...MIDDESK_CONTEXTS].find((x) => x.instructions.trim() === prompt.trim())

/** "Middesk · v0.12" — whose a default skill is, and which release of it. */
export const versionLine = (item: { version?: string }) =>
  item.version ? `Middesk · v${item.version}` : 'Middesk'


/**
 * The full brief a complex assessment sends.
 *
 * An assessment layered out of others is not its own text alone — the parts
 * under it are what it is built from, and a run that sent only the top-level
 * brief was running something the editor does not show. Order: the context it
 * is read against, then the assessment itself, then each part.
 *
 * Switched-off parts and context are left out, which is what the toggle means.
 */
export const composeAssessment = (
  assessment: { id: string; name: string; instructions: string },
  parts: Array<{ id: string; name: string; instructions: string; kind?: string }>,
  disabled: string[] = []
) => {
  const context = MIDDESK_CONTEXTS.filter((c) => !disabled.includes(c.id))
    .map((c) => c.instructions)
    .join('\n\n')

  const layered = parts
    .filter((x) => x.id !== assessment.id && x.kind !== 'workflow' && !disabled.includes(x.id))
    // Named, because the report is written in sections and the names are what
    // the sections are.
    .map((x) => `${x.name}\n${x.instructions}`)
    .join('\n\n')

  return [context, assessment.instructions, layered].filter(Boolean).join('\n\n')
}
