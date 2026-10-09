import table from '../data/registrationStanding.json'
import type { Assessment } from './assessments'
import type { DocNeed, StepRun } from './assessmentRuns'
import { ORDER_CATALOG } from './customOrders/catalog'
import type { BusinessRecord, Derived } from './deriveResults'
import { domesticOf, notPublished, registrationState, sameName } from './registrationStatus'
import { stateName } from './states'

/**
 * An assessment's next steps: only what the product can do on a business,
 * chosen by rule from what the record holds, each with the gap it would
 * close. Nothing free-text — no "collect an ownership chart" — and nothing a
 * step reveals is invented: it is already on the record.
 *
 * - `expand` runs another assessment's checks on this one.
 * - `documents` has the public-document agent fetch the Articles of
 *   Incorporation and a Certificate of Good Standing from the state.
 * - `request` asks the applicant for them (or takes the analyst's own), where
 *   the state does not publish them or they could not be found.
 *
 * The Assistant shows them; the side panel never does.
 */

export type StepKind = 'expand' | 'documents' | 'request'

export type NextStep = {
  id: string
  kind: StepKind
  label: string
  why: string
  /** Insight keys the step adds (`expand`). */
  adds?: string[]
  /** Documents the step is for (`documents`, `request`), and the state they come from. */
  docs?: DocNeed[]
  state?: string
  /** Its run, once run. */
  run?: StepRun
}

export const DOC_LABEL: Record<DocNeed, string> = {
  aoi: 'Articles of Incorporation',
  cogs: 'Certificate of Good Standing'
}
const docsLong = (docs: DocNeed[]) => docs.map((d) => DOC_LABEL[d]).join(' and ')

/**
 * The states whose registries publish nothing to retrieve: every status the
 * standing table holds for them is `NOT_PUBLISHED` (Delaware, New Jersey).
 * A starting point, to be refined state by state.
 */
const SILENT_STATES = (() => {
  const by = new Map<string, boolean>()
  for (const [k, e] of Object.entries((table as { entries: Record<string, { c: string }> }).entries)) {
    const state = k.split('|')[0]
    by.set(state, (by.get(state) ?? true) && e.c === 'NOT_PUBLISHED')
  }
  return new Set([...by].filter(([, silent]) => silent).map(([s]) => s))
})()
export const publishesDocuments = (state: string | null | undefined) => Boolean(state) && !SILENT_STATES.has(state!)

/** The record's documents from that state's registry, by what they are. */
export const documentsOnRecord = (record: BusinessRecord, state: string) => {
  // The Secretary of State's documents only: a lien's own "Initial filing" is
  // a UCC financing statement, not the Articles.
  const own = (record.documents ?? []).filter((d) => {
    const meta = (d.source as { metadata?: { state?: string } } | null)?.metadata
    return d.source?.type === 'registration' && (!meta?.state || meta.state === state)
  })
  return {
    aoi: own.filter((d) => /initial[\s_]filing|articles/i.test(d.documentType ?? '')),
    cogs: own.filter((d) => /good standing/i.test(d.documentType ?? ''))
  }
}

/** The entity a name says it is, by its suffix. */
const kindOfName = (name: string) =>
  /\bl\.?\s?l\.?\s?[cp]\.?$/i.test(name.trim()) || /\bllc\b|\bpllc\b/i.test(name)
    ? 'LLC'
    : /\b(inc|corp|corporation|incorporated|co)\.?$/i.test(name.trim())
      ? 'corporation'
      : undefined
const kindOfType = (type: string | null | undefined) =>
  !type ? undefined : /limited liability|llc/i.test(type) ? 'LLC' : /corp/i.test(type) ? 'corporation' : undefined

/**
 * Where the Secretary of State picture is unresolved, each gap in a phrase:
 * no domestic filing, data missing from it, a filing that disagrees with what
 * the customer submitted, or one that is no longer active. A status the state
 * never publishes (Delaware, New Jersey) is not a gap.
 */
export const sosGaps = (record: BusinessRecord): { state: string; gaps: string[] } | undefined => {
  const submitted = record.names?.find((n) => (n as { submitted?: boolean }).submitted)?.name ?? record.name
  const d = domesticOf(record)
  const state = d?.state ?? record.formation?.state
  if (!state) return undefined
  const where = stateName(state)
  if (!d) return { state, gaps: [`no ${where} domestic filing was found`] }
  const gaps: string[] = []
  const st = registrationState(d)
  if (!notPublished(d) && !/^active$/i.test(d.status ?? '')) {
    // The registry's own words: "inactive (expired)", not "inactive" alone.
    const status = (st.status ?? 'not active').toLowerCase()
    const details = st.statusDetails?.toLowerCase()
    gaps.push(`the ${where} domestic filing is ${status}${details && details !== status ? ` (${details})` : ''}`)
  }
  const missing = [!d.registrationDate && 'formation date', !d.entityType && 'entity type'].filter(Boolean)
  if (missing.length) gaps.push(`the filing has no ${missing.join(' or ')}`)
  const named = kindOfName(submitted)
  const filed = kindOfType(d.entityType)
  if (named && filed && named !== filed) gaps.push(`it records ${filed === 'LLC' ? 'an LLC' : 'a corporation'}, while the customer submitted ${named === 'LLC' ? 'an LLC' : 'a corporation'}`)
  if (d.name && !sameName(d.name, submitted)) gaps.push(`it is filed as ${d.name}, not the submitted ${submitted}`)
  return gaps.length ? { state, gaps } : undefined
}

const sentence = (parts: string[]) => {
  const s = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0]
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const groupsOfPackage = (pkg: string) => ORDER_CATALOG.insight_groups.filter((g) => g.packages.includes(pkg))
const BV_KEYS = groupsOfPackage('business_verification_verify').flatMap((g) => g.insight_keys)
const SOS_KEYS = ORDER_CATALOG.insight_groups.filter((g) => g.id.startsWith('sos_')).flatMap((g) => g.insight_keys)
const ALL_GROUPS = ORDER_CATALOG.insight_groups

const keyOf = (insightId: string) => insightId.split(':')[0]
const labelsOf = (keys: string[]) =>
  ALL_GROUPS.filter((g) => g.insight_keys.some((k) => keys.includes(k))).map((g) => g.label.toLowerCase())

/**
 * The next steps for one assessment, at most three, in order: widen a narrow
 * assessment to Business Verification; settle an unresolved SOS picture with
 * the state's documents (or a request, where the state has none to give);
 * widen to Full Business KYB — once Business Verification is run or not needed.
 */
export const nextStepsFor = (
  record: BusinessRecord,
  a: Assessment,
  /** Every result on the record, unscoped. */
  all: Derived[],
  runs: StepRun[],
  /** The record's documents are held back until retrieved (`documentsWithheld`). */
  withheld = false
): NextStep[] => {
  const ran = (id: string) => runs.find((r) => r.stepId === id)
  const reads = a.insights ? new Set(a.insights) : undefined
  const reading = (k: string) => !reads || reads.has(k)
  const available = [...new Set(all.filter((r) => !r.notReported).map((r) => keyOf(r.insightId)))]
  const steps: NextStep[] = []

  // 1. A narrow assessment that hasn't checked who the business is.
  const bv = available.filter((k) => BV_KEYS.includes(k) && !reading(k))
  if (reads && (bv.length || ran('business-verification'))) {
    const readsNow = labelsOf([...(a.insights ?? [])])
    const adds = labelsOf(bv)
    const identity = ['name', 'address_verification', 'tin', 'sos_domestic'].some(reading)
    steps.push({
      id: 'business-verification',
      kind: 'expand',
      label: 'Run Business Verification',
      // What it reads, and only the checks it would add — "who this business
      // is hasn't been checked" only where it reads none of them.
      why: identity
        ? `${a.name} reads ${readsNow.join(', ')}. Business Verification adds the checks it doesn't: ${adds.slice(0, 5).join(', ')}${adds.length > 5 ? ` and ${adds.length - 5} more` : ''}.`
        : `${a.name} reads ${readsNow.length ? readsNow.join(', ') : 'none of the identity checks'}, so who this business is hasn't been checked. Business Verification adds ${bv.length} insights already on this business: its name, registrations, addresses, TIN and watchlist.`,
      adds: bv,
      run: ran('business-verification')
    })
  }

  // 2. The Secretary of State picture is unresolved — only once the assessment reads it.
  const sos = SOS_KEYS.some(reading) ? sosGaps(record) : undefined
  if (sos) {
    const where = stateName(sos.state)
    const gap = `${sentence(sos.gaps)}.`
    const fetchRun = ran('documents')
    if (publishesDocuments(sos.state)) {
      steps.push({
        id: 'documents',
        kind: 'documents',
        label: `Retrieve ${docsLong(['aoi', 'cogs'])} from ${where}`,
        why: `${gap} The Articles of Incorporation and a Certificate of Good Standing would settle which entity this is and whether it is in good standing. ${where} publishes both, so the document agent can fetch them.`,
        docs: ['aoi', 'cogs'],
        state: sos.state,
        run: fetchRun
      })
      // Fetched, and not everything was there: a failure to resolve — ask.
      if (fetchRun?.missing?.length)
        steps.push({
          id: 'request',
          kind: 'request',
          label: `Request ${docsLong(fetchRun.missing)} from the applicant`,
          why: `${where} publishes the ${docsLong(fetchRun.missing)}, but ${fetchRun.missing.length > 1 ? 'they' : 'it'} could not be found in its records.`,
          docs: fetchRun.missing,
          run: ran('request')
        })
    } else {
      steps.push({
        id: 'request',
        kind: 'request',
        label: `Request ${docsLong(['aoi', 'cogs'])}`,
        // What's wrong and why it can't be fetched; the actions say what to do.
        why: `${gap} ${where} doesn't publish its filings' documents, so they can't be retrieved.`,
        docs: ['aoi', 'cogs'],
        run: ran('request')
      })
    }
  }

  // 2b. No gap, but the record's documents are still to be fetched: the agent
  //     retrieves them from the state whose filing they belong to.
  if (!sos && withheld && SOS_KEYS.some(reading)) {
    const held = (record.documents ?? []).filter((d) => d.source?.type === 'registration')
    const state = (held[0]?.source as { metadata?: { state?: string } } | null)?.metadata?.state
    if (state) {
      const where = stateName(state)
      steps.push({
        id: 'documents',
        kind: 'documents',
        label: `Retrieve ${docsLong(['aoi', 'cogs'])} from ${where}`,
        why: `No ${where} Secretary of State documents are on file for this business yet. ${where} publishes them, so the document agent can fetch them.`,
        docs: ['aoi', 'cogs'],
        state,
        run: ran('documents')
      })
    }
  }

  // 3. A narrow assessment, beside everything else held on the business —
  //    one widening at a time: not while Business Verification is still on
  //    offer, which Full Business KYB would only repeat.
  const bvPending = steps.some((st) => st.id === 'business-verification' && !st.run)
  const readGroups = ALL_GROUPS.filter((g) => g.insight_keys.some(reading)).length
  const rest = available.filter((k) => !reading(k) && !bv.includes(k))
  if (reads && (ran('full-kyb') || (!bvPending && readGroups < ALL_GROUPS.length / 2 && rest.length))) {
    const flagged = labelsOf(rest).slice(0, 3)
    steps.push({
      id: 'full-kyb',
      kind: 'expand',
      label: 'Run Full Business KYB',
      why: `Covers the rest of what Middesk holds on this business — ${rest.length} more insights${flagged.length ? `, including ${flagged.join(', ')}` : ''}.`,
      adds: [...bv, ...rest],
      run: ran('full-kyb')
    })
  }

  // A widening step that ran keeps the label and why it was run with: run,
  // the scope it described has grown. The others' reasons don't change.
  return steps.slice(0, 3).map((st) =>
    st.run && st.kind === 'expand' ? { ...st, label: st.run.label, why: st.run.why ?? st.why } : st
  )
}
