/**
 * An insight authored by prompt.
 *
 * The author writes what they want in plain English; the Claude Code session
 * compiles it into the structure below, and shows that reading back so it can
 * be corrected. Prose in, validated structure out — the same shape
 * `analyse-endpoint.ts` already uses for assessments.
 *
 * Why not a slot builder: a rigid picker can only express what the record
 * already models, and the record does not model what an author wants to say.
 * "Matches the website" is a real request that resolves to a precomputed flag;
 * "matches the DBA filing" names a source no record in the corpus carries. A
 * picker has to either omit those or invent vocabulary for them. A prompt can
 * accept both and say precisely what it could and could not map.
 *
 * It has no name, no group and no template. The statement is the insight, and
 * the template is derived from the compiled shape.
 *
 * WHERE IT LIVES. `src/data/catalog.json` is a build artifact: `bun run dev`
 * regenerates it from `catalog/insights.yaml`, so anything written there is
 * erased on the next start. Authored insights go to
 * `catalog/custom-insights.json` through `/api/insights`, read at runtime so a
 * new one appears without restarting vite.
 */
import {
  type Jurisdiction,
  JURISDICTION_LABEL,
  type NameRelation,
  type NameType,
  nameSource,
  relationLabel
} from './vocabulary'

/** A source the insight reads, optionally narrowed to a jurisdiction. */
export type CompiledSource = {
  /** The catalog's source id — `sos_registrations`, `lien`, … */
  id: string
  /** Absent or empty means every jurisdiction the source distinguishes. */
  jurisdictions?: Jurisdiction[]
}

export type CompiledName = {
  attribute: 'name'
  subject: { nameType: NameType; side: 'submitted' }
  relation: NameRelation
  sources: CompiledSource[]
  /** The states this insight can report, in the source's own terms. */
  states: string[]
}

/**
 * Something the prompt asked for that the record cannot answer.
 *
 * Kept on the definition rather than rejected at save time: per the product
 * decision, an insight that does not apply simply does not show up, and that
 * says nothing about whether it applies to some other record. This is the
 * author-facing explanation, distinct from the per-record `no_result` reason.
 */
export type Unsupported = { asked: string; why: string }

export type AuthoredInsight = {
  id: string
  /** Exactly what the author typed. The source of truth for re-compiling. */
  prompt: string
  compiled: CompiledName
  unsupported: Unsupported[]
  authored: true
  createdAt: string
  updatedAt: string
}

export type AuthoredInsightStore = { insights: AuthoredInsight[] }

// ---------------------------------------------------------------------------
// The sentence
// ---------------------------------------------------------------------------

const SUBJECT_LABEL: Record<NameType, string> = {
  legal: 'Submitted business name',
  dba: 'Submitted DBA'
}

/** "SOS registration (Domestic, Foreign)" */
export const sourceLabel = (source: CompiledSource): string => {
  const definition = nameSource(source.id)
  if (!definition) return source.id
  const narrowed = source.jurisdictions?.length
    ? ` (${source.jurisdictions.map((j) => JURISDICTION_LABEL[j]).join(', ')})`
    : ''

  return `${definition.label}${narrowed}`
}

const sourcesSentence = (sources: CompiledSource[]): string => {
  const labels = sources.map(sourceLabel)
  if (labels.length === 0) return 'any source that carries a business name'
  if (labels.length === 1) return labels[0]

  return `${labels.slice(0, -1).join(', ')} or ${labels[labels.length - 1]}`
}

/**
 * The statement the insight row renders.
 *
 * States what the record shows and nothing about whether that is good — the
 * rule every statement in the catalog follows.
 */
export const composeStatement = (insight: Pick<AuthoredInsight, 'compiled'>): string => {
  const { subject, relation, sources } = insight.compiled

  return `${SUBJECT_LABEL[subject.nameType]} ${relationLabel(relation)} the name on ${sourcesSentence(sources)}`
}

/** The templates.yaml template this insight's answer takes. */
export const templateFor = (_insight: Pick<AuthoredInsight, 'compiled'>): string => 'verification'

/** An id derived from the sentence, so it reads like the catalog's own. */
export const deriveId = (statement: string) =>
  statement
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || `insight_${Date.now().toString(36)}`

// ---------------------------------------------------------------------------
// Persistence and compilation
// ---------------------------------------------------------------------------

const ENDPOINT = '/api/insights'

export const loadInsights = async (): Promise<AuthoredInsight[]> => {
  const response = await fetch(ENDPOINT)
  if (!response.ok) throw new Error(`Could not read authored insights (${response.status})`)

  return ((await response.json()) as AuthoredInsightStore).insights ?? []
}

export const saveInsight = async (insight: AuthoredInsight): Promise<AuthoredInsight[]> => {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(insight)
  })
  const body = (await response.json()) as AuthoredInsightStore & { error?: string }
  if (!response.ok) throw new Error(body.error ?? 'Could not save that insight.')

  return body.insights ?? []
}

export const deleteInsight = async (id: string): Promise<AuthoredInsight[]> => {
  const response = await fetch(`${ENDPOINT}?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
  const body = (await response.json()) as AuthoredInsightStore & { error?: string }
  if (!response.ok) throw new Error(body.error ?? 'Could not delete that insight.')

  return body.insights ?? []
}

export type CompileResult = {
  id: string
  compiled: CompiledName
  unsupported: Unsupported[]
}

/** Queue a prompt for the session to compile. Returns the id to poll. */
export const requestCompile = async (prompt: string): Promise<string> => {
  const response = await fetch(`${ENDPOINT}/compile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  })
  const body = (await response.json()) as { id?: string; error?: string }
  if (!response.ok || !body.id) throw new Error(body.error ?? 'Could not queue that prompt.')

  return body.id
}

/** null while the session is still writing — keep polling. */
export const readCompile = async (id: string): Promise<CompileResult | null> => {
  const response = await fetch(`${ENDPOINT}/compile?id=${encodeURIComponent(id)}`)
  if (response.status === 404) return null
  const body = (await response.json()) as CompileResult & { error?: string }
  if (!response.ok) throw new Error(body.error ?? 'Could not read the compiled insight.')

  return body
}

export const draftFrom = (
  prompt: string,
  result: Pick<CompileResult, 'compiled' | 'unsupported'>
): AuthoredInsight => {
  const now = new Date().toISOString()

  return {
    id: deriveId(composeStatement({ compiled: result.compiled })),
    prompt,
    compiled: result.compiled,
    unsupported: result.unsupported ?? [],
    authored: true,
    createdAt: now,
    updatedAt: now
  }
}
