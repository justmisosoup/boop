import {
  Building2,
  FileSearch,
  Gavel,
  Globe,
  IdCard,
  Landmark,
  MapPin,
  Scale,
  SearchCheck,
  ShieldCheck,
  Users,
  type LucideIcon
} from 'lucide-react'

import agentStore from '../../analysis/agent.json'
import catalog from '../data/catalog.json'
import type { AssessmentWeight } from './identityScore'

/**
 * The workflows the marketplace lists: one per assessment area in
 * `analysis/agent.json`, presented as a product the customer can read about
 * and run.
 *
 * The area's identity — its id, weight and the insights it may cite — is the
 * agent's, read from the bundled store so the two cannot drift. What is
 * authored here is the product reading of it: the name a customer sees, what
 * the job is, what to send, the steps it takes and the tools each one calls.
 * The steps follow each area's "Always:" brief; the tools follow the sources
 * its insights are read from.
 */
export type WorkflowOutput = 'Review' | 'Report' | 'Decision' | 'Memo' | 'Alert' | 'Map'
export type WorkflowStatus = 'Beta' | 'Available' | 'Planned'

export type WorkflowStep = {
  title: string
  /** The toolsets the step calls, one chip each: "SOS · All states", "IRS". */
  tools: string[]
  /** The insights the step reads — ids from the area's `insightIds` in
   *  agent.json, checked at load. A step with none is the agent's own
   *  (explaining what the others found). */
  insights: string[]
  /** The data the step reads where no insight carries it yet: each as the API
   *  names it, with what it is. Listed under the sources as insights are. */
  attributes?: Array<{ id: string; label: string }>
}

/** An attribute the workflow takes, named as the platform's business record
 *  names it: `name`, `addresses`, `tin`, `names` (a DBA), `people`, `website`. */
export type WorkflowNeed = { label: string; required: boolean }

/** A tool the workflow calls: its name and what it brings to the job. */
export type WorkflowAddition = { icon: LucideIcon; name: string; description: string }

export type Workflow = {
  /** The assessment id in `agent.json`. */
  id: string
  slug: string
  name: string
  tagline: string
  /** The team the workflow belongs to: a slug in `WORKFLOW_TEAMS`. */
  team: string
  output: WorkflowOutput
  status: WorkflowStatus
  runsThrough: string[]
  /** What the workflow establishes and how, in one paragraph. */
  overview: string
  needs: WorkflowNeed[]
  steps: WorkflowStep[]
  adds: WorkflowAddition[]
  /** From the agent: the area's weight in the assessment. */
  weight: AssessmentWeight
  /** From the agent: how many insights the area may cite. */
  checks: number
}

/** The team every authored workflow here belongs to. The use case they
 *  serve, bank account opening, is the agent's one workflow in agent.json. */
const AUTHORED_TEAM = 'regulatory-and-compliance'

type Skill = { id: string; kind?: string; name?: string; weight?: AssessmentWeight; insightIds?: string[] }
const SKILLS = new Map(((agentStore as { skills?: Skill[] }).skills ?? []).map((s) => [s.id, s]))

const RUNS_THROUGH = ['API', 'MCP', 'Dashboard']

type Authored = Omit<Workflow, 'weight' | 'checks' | 'team' | 'runsThrough'>

const AUTHORED: Authored[] = [
  {
    id: 'skill-kyb-identification',
    slug: 'business-verification',
    name: 'Business verification',
    tagline: 'Send a business, and Middesk confirms it is real, active, and the one on the application.',
    output: 'Review',
    status: 'Beta',
    overview:
      'Confirms the business is a real, distinct, active entity, and the one on the application. The submitted name and address are checked against Secretary of State filings, domestic and foreign, and the filing’s standing is read where the state publishes it. A submitted TIN is checked with the IRS for a name tied to the business, and the entity type, trade names, website and profiles are verified where they were given. Every mismatch is explained rather than scored.',
    needs: [
      { label: 'Name', required: true },
      { label: 'Address', required: true },
      { label: 'TIN', required: false },
      { label: 'DBA name', required: false },
      { label: 'Entity type', required: false },
      { label: 'Website', required: false },
      { label: 'Third-party profiles', required: false }
    ],
    steps: [
      {
        title: 'Match the business to state filings',
        tools: ['SOS · All states'],
        insights: ['name','submitted_name','sos_domestic','linked_domestic','sos_status','sos_active','sos_inactive','sos_unknown','sos_not_found','sos_domestic_sub_status','formation_state','registrations_not_found','registrations_status','submitted_registrations_match'],
        attributes: [{ id: 'documents[].document_type', label: 'Certificate of good standing, where the state issued one' }]
      },
      // The brief's address line: the address checks are Activity & permission's
      // too, and agent.json lets Identity cite them.
      { title: 'Match the submitted address to the filing', tools: ['SOS · All states', 'USPS'], insights: ['address_verification', 'sos_match'] },
      { title: 'Match TIN with a name', tools: ['IRS'], insights: ['tin','tin_error','tin_issued','tin_type'] },
      { title: 'Confirm the entity type', tools: ['SOS · All states'], insights: ['entity_type','entity_type_match','name_and_entity_type','name_entity_type'] },
      { title: 'Resolve trade names and linked filings', tools: ['SOS · All states', 'DBA filings', 'City registrations', 'Licences & permits', 'Identity graph'], insights: ['trade_names','submitted_name_dba','dba_owner_filing','dba_name'] },
      { title: 'Confirm the business name on the web', tools: ['Web'], insights: ['web_business_name_verification'] },
      { title: 'Explain whether this is the business on the application', tools: ['Verification agent'], insights: [] }
    ],
    adds: [
      { icon: Landmark, name: 'State filings', description: 'Secretary of State records from every state, pulled at the source.' },
      { icon: IdCard, name: 'IRS TIN match', description: 'Name and EIN confirmed directly with the IRS.' },
      { icon: Building2, name: 'Entity matching', description: 'Trade names and foreign registrations resolve to the right business.' },
      { icon: FileSearch, name: 'Trade name registers', description: 'DBA and fictitious-name filings, city registrations, carrier registrations, sales tax permits and licences, each a place a trade name is on file.' }
    ],
  },
  {
    id: 'skill-kyb-activity',
    slug: 'activity-and-permission',
    name: 'Activity & permission',
    tagline: 'Send a business, and Middesk classifies what it does and checks it is licensed where it operates.',
    output: 'Review',
    status: 'Beta',
    overview:
      'Reads what the business does and whether it may do it where it operates. The industry is classified from the business’s own web presence and checked against prohibited industries, the office address is verified with USPS, licences are looked for in the states it operates in, and the website and profiles are checked for the name, address and people on them.',
    needs: [
      { label: 'Name', required: true },
      { label: 'Address', required: true },
      { label: 'Website', required: false },
      { label: 'Third-party profiles', required: false }
    ],
    steps: [
      { title: 'Classify the industry', tools: ['Web'], insights: ['industry'] },
      // The classification read against the customer's own policy.
      { title: 'Check the industry against your policy', tools: ['Your policy'], insights: ['industry'] },
      // The brief's "evidence of other industry activity": what the business
      // claims against what its web presence shows.
      { title: 'Look for activity other than claimed', tools: ['Web'], insights: ['operating_as_claimed'] },
      { title: 'Confirm where it operates', tools: ['USPS'], insights: ['sos_match','address_verification','address_deliverability','address_property_type','address_cmra','address_registered_agent','address_proximity'] },
      { title: 'Find licences where it operates', tools: ['State registers'], insights: ['license','license_person_match','license_address_match'] },
      { title: 'Check the website and profiles', tools: ['Web'], insights: ['website_url_discovery','website_status','website_parked','website_url_domain_ownership','domain_redirect','website_verification','profile_discovery','profile_status','web_address_verification','web_email_address_verification','web_phone_number_verification','web_person_verification'] },
      { title: 'Explain whether the industry is eligible and the business is licensed where it operates', tools: ['Activity agent'], insights: [] }
    ],
    adds: [
      { icon: SearchCheck, name: 'Industry classification', description: 'NAICS codes read from the business’s own web presence.' },
      { icon: MapPin, name: 'Address verification', description: 'Deliverability, property type and CMRA checks against USPS.' },
      { icon: Globe, name: 'Web presence', description: 'The website and profiles, with the name, address and people on them.' }
    ],
  },
  {
    id: 'skill-1789767328449',
    slug: 'ownership-and-control',
    name: 'Ownership & control',
    tagline: 'Send the people on the application, and Middesk checks them against the filings and the identity graph.',
    output: 'Review',
    status: 'Beta',
    overview:
      'Establishes who owns and controls the business and whether the attestation holds up. Each submitted person is matched to the officers the filings name, officers, owners and registered agents that were not submitted are found, related and parent entities are resolved through the identity graph, and a sole-proprietor reading is made only where a filing supports it.',
    needs: [
      { label: 'Name', required: true },
      { label: 'People', required: true },
      { label: 'People titles', required: false }
    ],
    steps: [
      { title: 'Match submitted people to filings', tools: ['SOS · All states', 'City registrations', 'DBA filings', 'Licences & permits', 'Carrier registrations'], insights: ['person_verification'] },
      { title: 'Find unsubmitted people', tools: ['SOS · All states', 'Identity graph', 'City registrations', 'DBA filings', 'Licences & permits', 'Carrier registrations'], insights: ['person_verification', 'business_connections'] },
      // The brief names registered agents listed as owners or officers, found
      // and submitted. No insight carries it; the filing and its addresses do.
      {
        title: 'Identify registered agents listed as owners or officers',
        tools: ['SOS · All states', 'Identity graph'],
        insights: [],
        attributes: [
          { id: 'registrations[].registered_agent', label: 'The agent each filing names' },
          { id: 'addresses[].labels: registered_agent', label: 'Addresses that are an agent’s, not the business’s' },
          { id: 'people[].titles', label: 'A person or entity whose title is agent as well as officer' }
        ]
      },
      { title: 'Resolve related and parent entities', tools: ['Identity graph'], insights: ['related_entities'] },
      { title: 'Check the entity type', tools: ['SOS · All states', 'DBA filings', 'City registrations'], insights: ['entity_type'] },
      // People added and removed over time: the reference's "identify
      // ownership changes". No insight carries it yet.
      {
        title: 'Identify ownership changes',
        tools: ['Business history events', 'Filing documents', 'Identity graph'],
        insights: [],
        attributes: [
          { id: 'person.created', label: 'Person added, with titles and whether submitted' },
          { id: 'person.deleted', label: 'Person removed' },
          { id: 'entity_as_person.created', label: 'Business entity listed as owner or officer added' },
          { id: 'entity_as_person.deleted', label: 'Business entity listed as owner or officer removed' },
          { id: 'registration.updated', label: 'Filing changed' },
          { id: 'raw_documents', label: 'Articles, amendments and annual reports' }
        ]
      },
      { title: 'Explain the ownership structure', tools: ['Ownership agent'], insights: [] }
    ],
    adds: [
      { icon: Users, name: 'People matching', description: 'Submitted people resolved to the officers each filing lists.' },
      { icon: Building2, name: 'Related entities', description: 'Businesses sharing owners, addresses or agents, from the identity graph.' },
      { icon: FileSearch, name: 'Filing history', description: 'People added and removed, from the business history events the API emits; amendments and annual reports where the bulk pipeline has pulled the filings.' },
      { icon: Landmark, name: 'Owner registers', description: 'Owner and licensee names from DBA filings, city registrations, licences, carrier registrations and Form 5500.' }
    ],
  },
  {
    id: 'skill-kyb-3',
    slug: 'compliance-screenings',
    name: 'Compliance screenings',
    tagline: 'Send a business and its people, and Middesk screens them against sanctions, PEP and adverse media.',
    output: 'Report',
    status: 'Available',
    overview:
      'Screens the business and every submitted or found person against sanctions and watchlists, checks each person for political exposure, and searches adverse media. Results are shown as returned, with false positives dismissed and the reason given.',
    // What the record actually holds to screen with: the names, the people
    // (name and titles — birth details, citizenship and aliases only come
    // back on a hit, never in), and the address and formation that clear
    // common-name false positives.
    needs: [
      { label: 'Name', required: true },
      { label: 'DBA name', required: false },
      { label: 'People', required: true },
      { label: 'Address', required: false },
      { label: 'Formation', required: false }
    ],
    steps: [
      {
        title: 'Screen the business and its names',
        // Every name the record holds — submitted, on a filing, trading as —
        // against the account's watchlists.
        tools: ['OFAC lists', 'BIS lists', 'State Department lists', 'SOS · All states', 'Trade name registers'],
        insights: ['watchlist'],
        attributes: [
          { id: 'watchlist.lists[].results[]', label: 'Each list hit, with the name it matched' },
          { id: 'watchlist.hit_count', label: 'How many hits stand' }
        ]
      },
      {
        title: 'Screen each person, submitted and found',
        tools: ['OFAC lists', 'BIS lists', 'State Department lists', 'SOS · All states', 'Owner registers'],
        insights: ['watchlist', 'people_criminal_history'],
        attributes: [
          { id: 'people[].sources', label: 'Where each screened person came from: submitted, or found on a filing' }
        ]
      },
      {
        title: 'Check for political exposure',
        tools: ['PEP screening'],
        insights: ['politically_exposed_persons'],
        attributes: [
          { id: 'results[].hit_type', label: 'Direct, by alias, or by association' },
          { id: 'results[].name, aliases', label: 'The name and aliases matched' },
          { id: 'results[].dob, birthplace, citizenship', label: 'Date and place of birth, citizenship' },
          { id: 'results[].employer, memberships', label: 'Employer, memberships and professional history' },
          { id: 'results[].associates', label: 'Relatives and close associates' },
          { id: 'results[].source_urls', label: 'Where the record was found' }
        ]
      },
      {
        title: 'Search adverse media',
        tools: ['Adverse media screening'],
        insights: ['adverse_media'],
        attributes: [
          { id: 'results[].match_score', label: 'How closely the name matched the subject' },
          { id: 'results[].status', label: 'Included, or dismissed by an analyst' },
          { id: 'results[].topics', label: 'The topics the coverage touches: sanctions, fraud, money laundering, tax evasion, organised crime' },
          { id: 'results[].subject', label: 'The business name or person the coverage was found for' }
        ]
      },
      {
        title: 'Screen historical names and people',
        // Names the business has dropped and people who have left its filings,
        // against the same lists.
        tools: ['Business history events', 'Filing documents', 'OFAC lists', 'BIS lists', 'State Department lists', 'PEP screening', 'Adverse media screening'],
        insights: [],
        attributes: [
          { id: 'name.created / name.deleted', label: 'Business names taken up and dropped' },
          { id: 'person.created / person.deleted', label: 'People added to and removed from the filings' },
          { id: 'raw_documents', label: 'Articles, amendments and annual reports' }
        ]
      },
      { title: 'Explain each standing hit and each dismissal', tools: ['Screening agent'], insights: [] }
    ],
    adds: [
      { icon: ShieldCheck, name: 'Sanctions and watchlists', description: 'OFAC (SDN, SSI, FSE, NS-CMIC, NS-MBS, NS-ISA, PLC, CAP), BIS (Entity List, DPL, UVL, MEU) and State Department (ITAR Debarred, ISN), screened by name and alias.' },
      { icon: Users, name: 'Politically exposed persons', description: 'Each submitted and found person checked for direct, alias and associate exposure, with the attributes that confirm or clear a match.' },
      { icon: Globe, name: 'Adverse media', description: 'Press and court coverage naming the business or its people, each result with its match score and the topics it touches.' },
      { icon: FileSearch, name: 'Filing history', description: 'Names dropped and people removed, from the business history events the API emits, screened alongside the current ones.' }
    ],
  },
  {
    id: 'skill-financial-standing',
    slug: 'liens-and-litigations',
    name: 'Liens & litigations',
    tagline: 'Send a business, and Middesk finds the liens, lawsuits and bankruptcies that bear on the account.',
    output: 'Report',
    status: 'Beta',
    overview:
      'Finds the public record that bears on the account: UCC and tax liens on the business, open and closed, with the secured party; litigation naming the business, which side it is on and any money judgment; and bankruptcies for the business and its people.',
    needs: [
      { label: 'Name', required: true },
      { label: 'Address', required: true },
      { label: 'People', required: false },
      { label: 'Formation date', required: false }
    ],
    steps: [
      // Each step checks the business and its people together: the same
      // record searched for both, the people's results as their own insight.
      {
        title: 'Find UCC and tax liens on the business and its people',
        tools: ['State UCC filings', 'Federal tax liens', 'State tax liens'],
        insights: ['liens', 'people_liens'],
        attributes: [
          { id: 'liens[].type', label: 'UCC, federal tax or state tax' },
          { id: 'liens[].status, filing_date, lapse_date', label: 'Open or closed, filed and lapsing when' },
          { id: 'liens[].secured_parties, debtors', label: 'Who holds it and who owes it' },
          { id: 'liens[].collateral', label: 'What it is secured on' },
          { id: 'liens[].liability_cents, loan_principal_cents', label: 'The amount owed and the principal' }
        ]
      },
      {
        title: 'Find litigation and judgments naming the business or its people',
        tools: ['State courts', 'Federal courts', 'Web'],
        insights: ['litigations', 'people_litigations', 'web_litigation'],
        attributes: [
          { id: 'litigations[].party_type', label: 'Which side: plaintiff, defendant, debtor, garnishee' },
          { id: 'litigations[].case_type, case_status', label: 'What kind of case, and whether it is open' },
          { id: 'litigations[].court, court_state, filing_date', label: 'Where and when it was filed' },
          { id: 'litigations[].judgments[].amount_cents', label: 'Any money judgment' }
        ]
      },
      {
        title: 'Find bankruptcies for the business and its people',
        tools: ['Federal bankruptcy courts'],
        insights: ['bankruptcies', 'people_bankruptcies'],
        attributes: [
          { id: 'bankruptcies[].chapter', label: 'The chapter filed under' },
          { id: 'bankruptcies[].status, filing_date', label: 'Where the petition stands, and since when' },
          { id: 'bankruptcies[].court, court_state', label: 'Which court' }
        ]
      },
      // The record holds no PPP data on this list; the check is the catalog's.
      { title: 'Find PPP loans', tools: ['SBA records'], insights: ['ppp_loans'] },
      { title: 'Explain which debts, cases and petitions bear on the account, read against the business’s age and line of work', tools: ['Liens & litigations agent'], insights: [] }
    ],
    adds: [
      { icon: Scale, name: 'Liens', description: 'UCC filings and federal and state tax liens, on the business and its people, open and closed, with the secured party and collateral.' },
      { icon: Gavel, name: 'Litigation', description: 'State and federal court cases naming the business or its people, which side each is on, and money judgments.' },
      { icon: FileSearch, name: 'Bankruptcies', description: 'Federal bankruptcy petitions by the business or its people, with the chapter and status.' },
      { icon: Landmark, name: 'PPP loans', description: 'Paycheck Protection Program loans to the business, from SBA records.' }
    ],
  }
]

/** Every workflow, in the order the marketplace lists them. */
export const WORKFLOWS: Workflow[] = AUTHORED.map((w) => {
  const skill = SKILLS.get(w.id)
  if (!skill) throw new Error(`workflows: no assessment ${w.id} in agent.json`)
  const allowed = new Set(skill.insightIds ?? [])
  for (const step of w.steps)
    for (const id of step.insights)
      if (!allowed.has(id)) throw new Error(`workflows: ${w.slug} step "${step.title}" cites ${id}, which ${skill.name} cannot`)
  return {
    ...w,
    team: AUTHORED_TEAM,
    runsThrough: RUNS_THROUGH,
    weight: skill.weight ?? 'critical',
    checks: skill.insightIds?.length ?? 0
  }
})

const BY_SLUG = new Map(WORKFLOWS.map((w) => [w.slug, w]))
const BY_ID = new Map(WORKFLOWS.map((w) => [w.id, w]))

export const workflowBySlug = (slug?: string) => (slug ? BY_SLUG.get(slug) : undefined)
export const workflowByAssessmentId = (id?: string) => (id ? BY_ID.get(id) : undefined)

export const workflowHref = (w: Pick<Workflow, 'slug'>) => `/workflows/${w.slug}`

/** "Review · 4 steps": what a workflow hands back and how long it is. */
export const workflowShape = (w: Pick<Workflow, 'output' | 'steps'>) => `${w.output} · ${w.steps.length} steps`

/** The weight as the page says it: "Critical", "High". */
export const weightLabel = (w: AssessmentWeight) => (w === 'critical' ? 'Critical' : 'High')

/** Names for the insights the catalog does not name. */
const INSIGHT_LABELS: Record<string, string> = {
  name_entity_type: 'Name states the entity type',
  submitted_name: 'Submitted name',
  trade_names: 'Trade names',
  submitted_name_dba: 'Submitted name as a DBA',
  dba_owner_filing: "DBA owner's filing",
  sos_domestic: 'Domestic filing',
  linked_domestic: 'Linked domestic filing',
  sos_active: 'Filing active',
  sos_inactive: 'Filing inactive',
  sos_unknown: 'Filing status unknown',
  sos_not_found: 'Filing not found',
  sos_status: 'Filing status',
  website_status: 'Website status',
  license: 'Licence',
  license_person_match: 'Licence person match',
  license_address_match: 'Licence address match',
  sos_match: 'Office state filing',
  address_verification: 'Address verification',
  address_deliverability: 'Address deliverability',
  address_property_type: 'Address property type',
  address_cmra: 'Address CMRA',
  address_registered_agent: 'Address registered agent',
  address_proximity: 'Address proximity',
  website_parked: 'Website parked',
  website_verification: 'Website verification'
}

const NAME_OF = (catalog as { nameOf?: Record<string, string> }).nameOf ?? {}

/** An insight's name: the catalog's, else the local one, else the id spelled out. */
export const insightLabel = (id: string): string =>
  NAME_OF[id] ?? INSIGHT_LABELS[id] ?? id.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
