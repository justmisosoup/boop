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

export const MIDDESK_CONTEXTS: LibraryItem[] = []

/**
 * No Middesk context ships any more.
 *
 * It was a standing block of instructions prepended to every run — how to read
 * the record, what the filings mean, what is ordinary for a business of its age.
 * The assessments now carry that themselves: each one says what it owns and how
 * to read it, and a customer editing an assessment could not see or change the
 * paragraph that ran ahead of it. A default nobody can read, edit or switch off
 * is not context, it is a hidden prompt.
 *
 * The array stays so the composer and editor keep their shape if a default is
 * ever added back.
 */

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
 * What a complex assessment sends: a shared brief, and its parts kept apart.
 *
 * The parts used to be flattened into the brief as one string. That made them
 * unaddressable — there was no way to say "this one is done" or "this one never
 * arrived", and no way to work two of them at once. They are independent of each
 * other, so they are sent as a list and worked at the same time; only the
 * recommendation reads all of them.
 *
 * `prompt` is what every assessment is read against — the Middesk context and
 * the workflow's own brief. `assessments` is the manifest: one work unit each,
 * in the order the customer composed them, which is the order they render in.
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

  const assessments = parts
    .filter((x) => x.id !== assessment.id && x.kind !== 'workflow' && !disabled.includes(x.id))
    .map((x) => ({ id: x.id, name: x.name, instructions: x.instructions }))

  return {
    prompt: [context, assessment.instructions].filter(Boolean).join('\n\n'),
    assessments
  }
}
