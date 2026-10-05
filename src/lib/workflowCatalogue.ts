import { Bell, CircleCheck, FileText, GitFork, PenLine, Table2, type LucideIcon } from 'lucide-react'

import { WORKFLOWS, workflowBySlug, type Workflow, type WorkflowOutput, type WorkflowStatus } from './workflows'

/**
 * The marketplace catalogue: every workflow Middesk lists, by team.
 *
 * The five authored workflows in `workflows.ts` are the ones with a detail
 * page; they are listed first in their team. The rest are the catalogue's
 * product reading of what each team hands Middesk — a name, the job in one
 * line, what comes back and how long it takes. They have no detail page yet,
 * so their cards do not link.
 */
export type WorkflowTeam = { slug: string; name: string }

export type WorkflowListing = {
  slug: string
  name: string
  tagline: string
  team: string
  output: WorkflowOutput
  status: WorkflowStatus
  stepCount: number
  /** An Alert runs for as long as the business is watched; "Ongoing", not steps. */
  ongoing?: boolean
}

export const WORKFLOW_TEAMS: WorkflowTeam[] = [
  { slug: 'regulatory-and-compliance', name: 'Regulatory and compliance' },
  { slug: 'fraud', name: 'Fraud' },
  { slug: 'credit-underwriting', name: 'Credit underwriting' },
  { slug: 'onboarding', name: 'Onboarding' },
  { slug: 'payments-risk', name: 'Payments risk' },
  { slug: 'lending-operations', name: 'Lending operations' },
  { slug: 'marketplace-trust', name: 'Marketplace trust' },
  { slug: 'insurance', name: 'Insurance' },
  { slug: 'procurement-and-vendors', name: 'Procurement and vendors' },
  { slug: 'treasury', name: 'Treasury' },
  { slug: 'tax-and-licensing', name: 'Tax and licensing' },
  { slug: 'portfolio-monitoring', name: 'Portfolio monitoring' }
]

const TEAM_BY_SLUG = new Map(WORKFLOW_TEAMS.map((t) => [t.slug, t]))
export const teamBySlug = (slug?: string | null) => (slug ? TEAM_BY_SLUG.get(slug) : undefined)
export const teamHref = (team: string) => `/workflows?team=${team}`

type Entry = [name: string, tagline: string, output: WorkflowOutput, stepCount: number, status: WorkflowStatus]

const entry = (team: string) => ([name, tagline, output, stepCount, status]: Entry): WorkflowListing => ({
  slug: name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, ''),
  name,
  tagline,
  team,
  output,
  status,
  stepCount,
  ongoing: output === 'Alert' || undefined
})

const AUTHORED_LISTINGS: Record<string, Entry[]> = {
  'regulatory-and-compliance': [
    ['Risk rating to your policy', 'Upload your risk policy once, and Middesk rates every business the same way.', 'Decision', 3, 'Beta'],
    ['Enhanced due diligence', 'Send a high-risk case, and Middesk drafts the EDD memo with every source cited.', 'Memo', 6, 'Available'],
    ['Change monitoring', 'Send the businesses to watch, and Middesk alerts you only when a change matters.', 'Alert', 0, 'Available'],
    ['Periodic review', 'Send accounts due for review, and Middesk refreshes them and closes the clean ones.', 'Review', 5, 'Planned'],
    ['FinCEN 314(a) search', 'Upload the 314(a) list, and Middesk searches your whole book for matches.', 'Report', 2, 'Planned']
  ],
  fraud: [
    ['Hijacked business detection', 'Send an application, and Middesk checks for recent changes to who controls the business.', 'Decision', 3, 'Beta'],
    ['Synthetic business detection', 'Send an application, and Middesk checks whether the business exists beyond paper.', 'Decision', 4, 'Available'],
    ['Applicant connection', 'Send the applicant and business, and Middesk confirms how they are connected.', 'Decision', 2, 'Available'],
    ['Document tampering', 'Upload documents, and Middesk checks them for edits and compares them to the record.', 'Review', 3, 'Beta'],
    ['Shell company screen', 'Send a business, and Middesk checks for the marks of a shell: no staff, no site, a shared address.', 'Decision', 4, 'Beta'],
    ['Address reuse', 'Send an address, and Middesk finds every other applicant who has used it.', 'Report', 2, 'Available'],
    ['Website authenticity', 'Send a website, and Middesk checks it is live, owned by the business, and not a template.', 'Decision', 3, 'Available'],
    ['Bust-out pattern', 'Send an account, and Middesk flags the filing and ownership changes that precede a bust-out.', 'Alert', 0, 'Planned'],
    ['First-party fraud review', 'Send a disputed account, and Middesk assembles what the applicant said against what is on record.', 'Memo', 4, 'Planned'],
    ['Duplicate applicant', 'Send an application, and Middesk finds earlier applications from the same business under other names.', 'Decision', 2, 'Available'],
    ['Phone and email ownership', 'Send the contact details, and Middesk checks they belong to the business, not a reseller.', 'Decision', 2, 'Beta'],
    ['Fraud ring mapping', 'Send a confirmed fraud case, and Middesk maps every business and person linked to it.', 'Map', 3, 'Planned']
  ],
  'credit-underwriting': [
    ['Loan stacking detection', 'Send an application, and Middesk finds recent advances and UCC filings against the business.', 'Decision', 3, 'Beta'],
    ['Revenue verification', 'Upload transactions and tax returns, and Middesk checks stated revenue against both.', 'Review', 4, 'Beta'],
    ['Cash flow analysis', 'Upload a transaction export, and Middesk calculates coverage, NSFs, and related-party flows.', 'Report', 5, 'Planned'],
    ['Guarantor and affiliate mapping', 'Send a guarantor, and Middesk maps every affiliate with its liens and judgments.', 'Map', 3, 'Beta'],
    ['Time in business', 'Send a business, and Middesk dates it from its first filing, licence, and web presence.', 'Decision', 2, 'Available'],
    ['UCC position', 'Send a business, and Middesk lists every secured party ahead of you and what they hold.', 'Report', 2, 'Available'],
    ['Tax lien and judgment check', 'Send a business and its owners, and Middesk finds open liens and judgments against each.', 'Review', 3, 'Available'],
    ['Industry classification', 'Send a business, and Middesk classifies what it does and whether your policy lends to it.', 'Decision', 2, 'Available'],
    ['Collateral ownership', 'Send the collateral, and Middesk confirms the business owns it and nothing is filed against it.', 'Decision', 3, 'Planned'],
    ['Credit memo draft', 'Send the file, and Middesk drafts the credit memo with every figure traced to its source.', 'Memo', 6, 'Planned'],
    ['Renewal review', 'Send a maturing loan, and Middesk refreshes the borrower and flags what changed since origination.', 'Review', 4, 'Beta'],
    ['Covenant watch', 'Send the covenants, and Middesk alerts you when a filing or lien breaks one.', 'Alert', 0, 'Planned']
  ],
  onboarding: [
    ['Instant approval', 'Send an application, and Middesk approves the clear cases and routes the rest to review.', 'Decision', 3, 'Available'],
    ['Application completion', 'Send a partial application, and Middesk fills the gaps from public records.', 'Review', 2, 'Available'],
    ['Sole proprietor onboarding', 'Send an owner with no filing, and Middesk verifies the person and the trade name instead.', 'Decision', 3, 'Beta'],
    ['Nonprofit verification', 'Send a nonprofit, and Middesk confirms its IRS status and the officers on file.', 'Decision', 3, 'Beta'],
    ['Foreign entity onboarding', 'Send a business formed abroad, and Middesk verifies its US registrations and agent.', 'Review', 4, 'Planned'],
    ['Reapplication review', 'Send a returning applicant, and Middesk shows what changed since the last decision.', 'Review', 2, 'Available'],
    ['Document request', 'Send an application, and Middesk asks only for the documents the record cannot supply.', 'Decision', 2, 'Beta'],
    ['Onboarding handoff memo', 'Send an approved account, and Middesk writes the handoff note for the account team.', 'Memo', 3, 'Planned']
  ],
  'payments-risk': [
    ['Merchant underwriting', 'Send a merchant, and Middesk verifies it and checks the card brands’ prohibited lists.', 'Decision', 4, 'Available'],
    ['MCC assignment', 'Send a merchant, and Middesk assigns the MCC from what the business actually sells.', 'Decision', 2, 'Available'],
    ['Transaction laundering screen', 'Send a merchant and its site, and Middesk checks what it sells matches what it processes.', 'Decision', 3, 'Beta'],
    ['MATCH list check', 'Send a merchant and its principals, and Middesk screens them against terminated merchant lists.', 'Decision', 2, 'Available'],
    ['Chargeback risk review', 'Send a merchant, and Middesk reads its reviews, complaints, and refund terms.', 'Review', 3, 'Beta'],
    ['Beneficiary verification', 'Send a payout destination, and Middesk confirms the account holder is the business.', 'Decision', 2, 'Planned'],
    ['Merchant change alerts', 'Send your merchants, and Middesk alerts you when ownership, name, or standing changes.', 'Alert', 0, 'Available'],
    ['Sponsor bank packet', 'Send the merchant file, and Middesk assembles the packet your sponsor bank asks for.', 'Report', 3, 'Planned']
  ],
  'lending-operations': [
    ['Closing conditions', 'Send a loan at closing, and Middesk confirms good standing, officers, and signing authority.', 'Decision', 3, 'Available'],
    ['Signer authority', 'Send the signer, and Middesk confirms they hold the role the resolution names.', 'Decision', 2, 'Available'],
    ['Good standing certificate', 'Send a business, and Middesk orders the certificate from the state that issues it.', 'Report', 1, 'Beta'],
    ['UCC filing prep', 'Send the loan, and Middesk prepares the UCC-1 with the exact legal name on file.', 'Report', 2, 'Beta'],
    ['Entity name correction', 'Send a borrower, and Middesk finds the filing name where the application’s differs.', 'Review', 2, 'Available'],
    ['Post-closing audit', 'Send closed loans, and Middesk rechecks every condition against the record.', 'Review', 4, 'Planned'],
    ['Default watch', 'Send the portfolio, and Middesk alerts you when a borrower dissolves or is sued.', 'Alert', 0, 'Planned']
  ],
  'marketplace-trust': [
    ['Seller verification', 'Send a seller, and Middesk confirms the business, its owner, and where it ships from.', 'Decision', 3, 'Available'],
    ['Counterfeit risk screen', 'Send a seller and its catalogue, and Middesk checks for brands it is not authorised to sell.', 'Review', 3, 'Beta'],
    ['Seller reactivation', 'Send a suspended seller, and Middesk shows whether the reason has been resolved.', 'Review', 2, 'Beta'],
    ['Multi-account detection', 'Send a seller, and Middesk finds its other storefronts under other names.', 'Decision', 2, 'Available'],
    ['Payout eligibility', 'Send a seller, and Middesk decides whether it clears your payout policy.', 'Decision', 3, 'Available'],
    ['Seller tax status', 'Send a seller, and Middesk confirms its TIN and sales tax registration in each state.', 'Decision', 2, 'Planned'],
    ['Seller changes', 'Send your sellers, and Middesk alerts you when one changes hands.', 'Alert', 0, 'Planned']
  ],
  insurance: [
    ['Commercial applicant verification', 'Send an insured, and Middesk confirms the business, its class, and its locations.', 'Decision', 3, 'Available'],
    ['Class code check', 'Send an insured, and Middesk checks the stated class against what the business does.', 'Decision', 2, 'Beta'],
    ['Premium audit prep', 'Send a policy up for audit, and Middesk gathers payroll, headcount, and location evidence.', 'Report', 4, 'Planned'],
    ['Certificate holder check', 'Send a certificate request, and Middesk confirms the holder is a real counterparty.', 'Decision', 2, 'Beta'],
    ['Claim party verification', 'Send a claimant business, and Middesk confirms it existed when the loss occurred.', 'Review', 3, 'Planned'],
    ['Policy change watch', 'Send your insureds, and Middesk alerts you when one adds a location or changes owners.', 'Alert', 0, 'Planned']
  ],
  'procurement-and-vendors': [
    ['Vendor onboarding', 'Send a vendor, and Middesk verifies it, its bank details, and who signs for it.', 'Decision', 4, 'Available'],
    ['Vendor sanctions screen', 'Send a vendor and its owners, and Middesk screens them and clears the false positives.', 'Decision', 2, 'Available'],
    ['Bank account change', 'Send a vendor’s new banking details, and Middesk checks the change is the vendor’s.', 'Decision', 2, 'Beta'],
    ['Diverse supplier status', 'Send a vendor, and Middesk confirms its certifications with the issuing bodies.', 'Review', 2, 'Planned'],
    ['Vendor risk memo', 'Send a strategic vendor, and Middesk drafts the risk memo with every source cited.', 'Memo', 5, 'Planned'],
    ['Vendor standing watch', 'Send your vendors, and Middesk alerts you when one loses standing or is sued.', 'Alert', 0, 'Beta']
  ],
  treasury: [
    ['Counterparty verification', 'Send a counterparty, and Middesk confirms the entity and its authorised signers.', 'Decision', 3, 'Available'],
    ['Account opening packet', 'Send your own entity, and Middesk assembles the KYC packet a bank asks for.', 'Report', 3, 'Beta'],
    ['Subsidiary registry', 'Send your entities, and Middesk keeps each one’s filings and standing current.', 'Review', 2, 'Planned'],
    ['Payment beneficiary check', 'Send a wire beneficiary, and Middesk confirms the business behind the account.', 'Decision', 2, 'Beta'],
    ['Entity standing watch', 'Send your entities, and Middesk alerts you before a filing lapses.', 'Alert', 0, 'Planned']
  ],
  'tax-and-licensing': [
    ['Sales tax registration', 'Send a business, and Middesk checks where it is registered and where it should be.', 'Review', 3, 'Available'],
    ['Licence verification', 'Send a business, and Middesk confirms every licence it needs is held and current.', 'Decision', 3, 'Available'],
    ['TIN match', 'Send a name and TIN, and Middesk confirms the pair with the IRS.', 'Decision', 1, 'Available'],
    ['1099 vendor check', 'Send your vendors, and Middesk confirms names and TINs before you file.', 'Review', 2, 'Beta'],
    ['Licence expiry watch', 'Send your licensees, and Middesk alerts you before a licence expires.', 'Alert', 0, 'Planned']
  ],
  'portfolio-monitoring': [
    ['Standing changes', 'Send your book, and Middesk alerts you when a business loses good standing.', 'Alert', 0, 'Available'],
    ['Ownership changes', 'Send your book, and Middesk alerts you when control of a business changes.', 'Alert', 0, 'Beta'],
    ['New liens and litigation', 'Send your book, and Middesk alerts you when a lien or lawsuit is filed.', 'Alert', 0, 'Available'],
    ['Portfolio risk report', 'Send your book, and Middesk reports which accounts changed and what it means.', 'Report', 3, 'Planned'],
    ['Watchlist rescreen', 'Send your book, and Middesk rescreens every business and person against updated lists.', 'Decision', 2, 'Beta']
  ]
}

const listingOf = (w: Workflow): WorkflowListing => ({
  slug: w.slug,
  name: w.name,
  tagline: w.tagline,
  team: w.team,
  output: w.output,
  status: w.status,
  stepCount: w.steps.length
})

/** Every listing, team by team: the authored workflows first, then the catalogue's. */
export const CATALOGUE: WorkflowListing[] = WORKFLOW_TEAMS.flatMap((team) => [
  ...WORKFLOWS.filter((w) => w.team === team.slug).map(listingOf),
  ...(AUTHORED_LISTINGS[team.slug] ?? []).map(entry(team.slug))
])

export const WORKFLOW_COUNT = CATALOGUE.length

/** Whether the listing opens a detail page. */
export const hasDetail = (l: Pick<WorkflowListing, 'slug'>) => workflowBySlug(l.slug) !== undefined

const matches = (l: WorkflowListing, q: string) => `${l.name} ${l.tagline}`.toLowerCase().includes(q)

/** Each team with its listings, filtered by a search. Teams with no match are left out. */
export const listingsByTeam = (query = ''): Array<{ team: WorkflowTeam; listings: WorkflowListing[] }> => {
  const q = query.trim().toLowerCase()
  return WORKFLOW_TEAMS.map((team) => ({
    team,
    listings: CATALOGUE.filter((l) => l.team === team.slug && (!q || matches(l, q)))
  })).filter((t) => t.listings.length > 0)
}

/** "Decision · 4 steps", or "Alert · Ongoing" for a watch that never finishes. */
export const listingShape = (l: Pick<WorkflowListing, 'output' | 'stepCount' | 'ongoing'>) =>
  `${l.output} · ${l.ongoing ? 'Ongoing' : `${l.stepCount} steps`}`

export const OUTPUT_ICON: Record<WorkflowOutput, LucideIcon> = {
  Decision: CircleCheck,
  Review: Table2,
  Report: FileText,
  Memo: PenLine,
  Alert: Bell,
  Map: GitFork
}
