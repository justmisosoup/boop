/**
 * The workflow a new customer starts with.
 *
 * NOT a Middesk default. The customer supplies the policy: which stages their
 * file is built from, and what it takes to onboard. That is their decision, not
 * ours, so this is seeded into their own store on first load and is theirs to
 * change or delete from then on.
 */
export const SEED_WORKFLOW = {
  id: 'smb-account-opening',
  name: 'SMB account opening',
  instructions:
    'Core KYB for a financial institution opening a business bank account. Work the stages an ' +
    'onboarding file is built from, in this order\n\n' +
    '- customer identification, whether a legally registered entity exists, is active, and is the applicant\n' +
    '- beneficial ownership and control, including what can only come from the customer\n' +
    '- the nature and purpose of the account, meaning whether the business is actually operating and what is expected to flow through it\n' +
    '- sanctions, PEP and watchlist screening\n' +
    '- adverse information and financial standing\n\n' +
    'Then recommend whether to onboard, and name the steps that complete the case file.'
}

/**
 * What a run sends: the workflow's brief, and its assessments kept apart.
 *
 * The assessments are independent of each other, so they are sent as a list and
 * worked at the same time; only the recommendation reads all of them. The list is
 * the manifest: one work unit each, in the order the customer composed them,
 * which is the order they render in.
 *
 * Each carries its `insightIds` — the insights it reads, and so the only ones its
 * section may cite. Dropping them here meant the endpoint's scope check saw no
 * scope and never ran.
 *
 * Switched-off assessments are left out, which is what the toggle means.
 */
export const composeAssessment = (
  workflow: { id: string; instructions: string },
  parts: Array<{ id: string; name: string; instructions: string; kind?: string; insightIds?: string[] }>,
  disabled: string[] = []
) => ({
  prompt: workflow.instructions,
  assessments: parts
    .filter((x) => x.id !== workflow.id && x.kind !== 'workflow' && !disabled.includes(x.id))
    .map((x) => ({ id: x.id, name: x.name, instructions: x.instructions, insightIds: x.insightIds }))
})
