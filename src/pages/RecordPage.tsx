import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router'

import { Plus } from 'lucide-react'

import {
  ActionButton,
  EmptyState,
  TabsContent,
  TabsRoot,
  type FloatingPanelPresentation,
  type FloatingPanelState
} from '@/core'

import { areasOf, BANDS, identityScore, negativesFor, type AssessmentWeight, bandOfCall } from '../lib/identityScore'
import { AssistantPanel } from '../components/Assistant/AssistantPanel'
import { standingCall } from '../components/Assistant/RecommendationCard'
import { ColumnResizer } from '../components/ColumnResizer'
import { filingKey, filingsWithTimeline, Timeline } from '../components/Timeline'
import type { Kind } from '../lib/timeline/types'
import { ChatPanelHeader, ChatRail, PANEL_VIEWS, type PanelView, type PanelViewDef } from '../components/ChatPanelHeader'
import { sourceGroupOf, sourceGroupsIn } from '../components/SourceGroups'
import { useWide, WIDE } from '../hooks/useWide'

import { statusForBand, useReview, type ReviewStatus } from '../lib/review'
import dayjs from '../lib/dayjs'
import { heldReportFor } from '../lib/heldReports'
import { sameName } from '../lib/registrationStatus'
import { BriefTurn } from '../components/Assistant/AssistantTurn'
import { NextStepsTurn, type RequestPayload } from '../components/Assistant/NextStepsTurn'
import { documentsWithheld, recordRun, runsFor, useAssessmentRuns } from '../lib/assessmentRuns'
import { DOC_LABEL, documentsOnRecord, nextStepsFor, sosGaps, type NextStep } from '../lib/nextSteps'
import { requestInformation } from '../lib/review'
import { reportLabel, reportStamp } from '../lib/reportLabels'
import { GroupedReport, STATE_RANK } from '../components/Report/GroupedReport'
import { type PanelGroup, type PanelInsight } from '../components/Report/AssessmentPanel'
import { SummaryBubble, type BubbleNotice } from '../components/Report/SummaryBubble'
import { cancelTinRequest, requestTin, useTinRequest } from '../lib/tinRequests'

/** The floating Assistant bubble beside the rail — off for now. */
const SHOW_ASSISTANT_BUBBLE = false
import type { RegistrationFilter } from '../components/Report/FilingStrip'
import type { StatusFilter } from '../components/Report/ResultTable'
import {
  inStatus,
  statusOf,
  InsightsFilterCard,
  NO_FILTER,
  outcomeWord,
  type InsightFilter
} from '../components/Report/InsightsFilterCard'
import { AssessmentBrief } from '../components/Report/AssessmentBrief'
import { REPORT_CARDS, cardAnchor, cardById, cardFor, cardIndex } from '../lib/reportCards'
import { missingInputs, whyOf } from '../lib/assessmentContext'
import { assessmentSummary } from '../lib/assessmentSummary'
import { outcomeOf, statementOf } from '../lib/insightOutcome'
import { evidenceByCard } from '../components/Assistant/evidence'
import { REVIEW_AREAS, areaOfAssessmentName, reviewGroups, type ReviewAreaId } from '../lib/reviewAreas'
import { areaBrief } from '../lib/areaBriefs'
import type { BriefCard, ReportFocus } from '../lib/reportBrief'
import { ScreenshotViewerProvider } from '../components/ScreenshotViewer'
import { ProfileSourceCards, SourceDetail, SourcesSummary, appOrderedSources, appTypeOf, sourcesFor } from '../components/SourcesTab'
import { SUBMITTED_CARD } from '../lib/sourceCards'
import { CardLabel } from '../components/CardLabel'
import { InsightRow } from '../components/InsightRow'
import { categoriesOf, deriveResults, type BusinessRecord, type Derived } from '../lib/deriveResults'
import { areaSummaries } from '../lib/areaSummaries'
import { displayName } from '../lib/businessNames'
import { assessmentById, businessScopeOf, readAssessment, readAssessments, resultsIn, type Assessment } from '../lib/assessments'
import { ActivityTab } from '../components/Assessments/ActivityTab'
import { AlertsCard } from '../components/Assessments/AlertsCard'
import { useSummaryRuns } from '../lib/useSummaryRuns'
import { BusinessOverview } from './BusinessOverview'
import { IdentityHeader } from '../components/Assessments/IdentityHeader'
import { assessmentTransitionName } from '../components/Assessments/AssessmentCard'
import { byId } from '../lib/records'
import { workflowByAssessmentId } from '../lib/workflows'
import { GROUPS, makeGroupFor } from '../lib/groups'
import { useAnalysis } from '../lib/useAnalysis'
import { AssessmentEditor } from '../components/AssessmentEditor'
import { composeAssessment } from '../lib/library'
import { PAGE_MEASURE } from '../lib/pageMeasure'
import { cn } from '../utils/twUtils'
import { useAgent } from '../lib/useAgent'
import { reportBrief } from '../lib/reportBrief'

/**
 * The reference panel's width, in px. Fixed.
 *
 * It was draggable, with the width kept per browser. In practice the handle
 * only ever produced work: a width to re-set on every window, and a boundary
 * that had to be right at every value it could take. One number, wide enough
 * that a source card is not a column two words across.
 */
/**
 * No reference panel any more.
 *
 * The insights, attributes and sources are tabs of the report rather than a
 * column beside it, so the document has the window. The variable stays because
 * the composer and the document wrapper both measure against it; at zero they
 * simply run to the right edge.
 */
const PANEL_W = 0

/** Put away, the column is a strip of icons — the same width the global nav
 *  rail collapses to, because it is the same gesture on the other edge. */
const RAIL_W = '49px'

/**
 * The report's measure, wherever something has to line up with it.
 *
 * 1000 at most, centred in whatever the white leaves. It used to be the report
 * column itself — `basis-[800px] shrink grow max-w-[1000px]` under the
 * wrapper's `justify-center` — but then everything inside the column inherited
 * the measure's edges, including the tab bar's rule, which stopped where the
 * prose stopped. The region spans; the text is what is measured.
 *
 * The inset is the measure's too, so the name in the bar, the tabs and the
 * prose all start at the same x. 48 at `wide`, where the white is the window's
 * middle column and can afford it; 24 below, where the report is a card the
 * page wrapper has already set 24px in from the window's edge — with 48 inside
 * that, a 660px window put its prose 72px in from either side.
 *
 * 1200 leaves 1104px of content at `wide`, less the 48 either side. Two
 * columns now — the report's cards, and the score with its review steps
 * (320px, plus the 16px gap) beside them — which puts the cards at 768px,
 * core's `narrow` width: the grids keep their three columns and the prose
 * its measure. At 992 the cards were down to 560 and the grids wrapped.
 */

/** See `generated` in RecordPage. */
const GENERATED = new Set<string>()

/** The narrowest the report goes beside a docked panel; below it the panel overlays. */
const REPORT_MIN = 640

/** The `focus` id the Insights card narrows the report under. `card-` led, so
 *  the brief reads it as a panel pick, not an assessment of its own. */
const INSIGHT_FILTER = 'card-insights-filter'

/** A call's kind as the score band its chip reads. */
const BAND_OF_KIND = { approve: 'established', request: 'not_established', reject: 'not_established' } as const

// The business flow's one measure (`pageMeasure.ts`).
const MEASURE = PAGE_MEASURE

/**
 * The assistant's state and presentation, remembered per browser.
 *
 * Minimise it once and it stays minimised; float it and it stays floating —
 * the same promise the Explorer dock makes (`readInitialState` there). Guarded
 * reads: with site data blocked the getter itself throws, inside a `useState`
 * initialiser, where an unguarded throw would crash the page.
 */
const ASSISTANT_STATE_KEY = 'proto:assistant:state'
const ASSISTANT_PRESENTATION_KEY = 'proto:assistant:presentation'

const readStored = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}
const writeStored = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // private mode / storage disabled — the preference just won't persist
  }
}

/**
 * Open, always, when a record opens — the assistant is half of what this page
 * is for, and its first message is the report summarised. A size the reader
 * chose (expanded) is kept; minimised is not: the pill is for putting it away
 * during a visit, not a state a record should open in.
 */
const readAssistantState = (): FloatingPanelState =>
  readStored(ASSISTANT_STATE_KEY) === 'expanded' ? 'expanded' : 'window'
const readAssistantPresentation = (): FloatingPanelPresentation =>
  readStored(ASSISTANT_PRESENTATION_KEY) === 'floating' ? 'floating' : 'docked'

/**
 * One business's assessment.
 *
 * The whole prototype until the businesses list arrived. Which record it shows
 * is the route now, not local state — so a reload holds its place and a record
 * can be linked to. Finding a different one is the rail's ⌘K search.
 */
export function RecordPage() {
  const { businessId, assessmentId } = useParams()
  // A next step that ran widens its assessment's scope: read again on any run.
  useAssessmentRuns()
  const selected = byId(businessId)

  // An id that isn't one of the ingested records: back to the list rather than
  // a half-rendered screen.
  if (!selected) return <Navigate replace to='/businesses' />

  // The business itself is this page, showing every assessment it has
  // (`businessScopeOf`) — not only its latest workflow's; with none run yet,
  // the overview.
  const scope = assessmentId ? assessmentById(selected, assessmentId) : businessScopeOf(selected)
  if (!assessmentId && !scope) return <BusinessOverview key={selected.id} record={selected} />
  if (!scope) return <Navigate replace to={`/businesses/${selected.id}`} />
  return <Record key={`${selected.id}/${scope.id}`} record={selected} scope={scope} />
}

/**
 * One business, one assessment.
 *
 * The page is the business's newest assessment: the report under the
 * Assessment tab, and the insights, attributes and sources that run read
 * under the other three. A business used to list several runs with a page
 * each; that has been set aside, see `heldReports.ts`.
 */
function Record({ record: selected, scope }: { record: BusinessRecord; scope: Assessment }) {
  /**
   * The assessment being read. "Full Business KYB" — every business pulled before
   * custom orders — reads the stored report, as the page always has. A custom
   * order's assessment reads the live record, scoped to its own insights, and
   * needs no report run to be read.
   */
  const scoped = !scope.full
  /** What the business is now. What a new report is run against. */
  const liveAll = useMemo(() => deriveResults(selected), [selected])
  // Every workflow run on the business, for its Activity.
  const reads = useMemo(() => readAssessments(selected), [selected])
  const live = useMemo(() => resultsIn(scope, liveAll), [scope, liveAll])

  // The skill that runs on arrival. Not a special case: it is the same thing a
  // reader could have dropped into the composer themselves.
  // The customer's assessments — the one that runs and the parts under it.
  const agent = useAgent()
  // Asked for on arrival and reused verbatim after: the business's own
  // description, independent of any assessment.

  // The workflow that runs on arrival is the customer's, not a Middesk default
  // — so the report waits for their store rather than firing against a stand-in.
  const standing = agent.skills.find((s) => s.kind === 'workflow')
  /**
   * The assessments inside the standing one, in the order they run.
   *
   * Carried whole rather than as names: each one is a work unit the run is
   * judged complete against, and a name alone cannot say which file landed.
   */
  const policy = useMemo(
    () =>
      agent.skills
        .filter((x) => x.kind !== 'workflow' && !(agent.disabled ?? []).includes(x.id))
        .map((x) => ({ id: x.id, name: x.name, instructions: x.instructions, insightIds: x.insightIds })),
    [agent.skills, agent.disabled]
  )
  const analysis = useAnalysis(selected, live)


  /**
   * Everything on this page is the report being read.
   *
   * The assessment and the three tabs used to come from different places — the
   * prose from the store, the insights and attributes computed fresh from
   * whatever the last pull fetched — so an older report's citations resolved
   * against newer data than the report had ever seen. They resolve from one
   * place now: the snapshot the report was written from.
   *
   * A report kept before snapshots existed has none, and falls back to the live
   * record, which is what the page always did. No report at all is the empty
   * state: `view` is null and nothing downstream has anything to render.
   */
  const view = scoped
    ? { recordId: selected.id, record: selected, results: liveAll }
    : analysis.selected
      ? (analysis.selected.snapshot ?? { recordId: selected.id, record: selected, results: live })
      : null
  const record = view?.record ?? selected
  const results: Derived[] = view?.results ?? []
  /**
   * What this assessment shows: only its insights, on only the cards those
   * insights belong to. The sources stay whole.
   */
  const shownResults: Derived[] = useMemo(() => resultsIn(scope, results), [scope, results])
  /** A custom order's assessment, read on its own: score, counts, summary. */
  const scopedRead = useMemo(
    () => (scoped ? readAssessment(selected, scope, liveAll) : undefined),
    [scoped, selected, scope, liveAll]
  )
  const summaryRuns = useSummaryRuns(selected)

  /**
   * The assessment's next steps: chosen by rule from the record the page is
   * reading, each one something the product can do. Run, they reveal what is
   * already on the record — the scope widens, documents appear — and the
   * Assistant, which lists them, shows what each came to.
   */
  const allRuns = useAssessmentRuns()
  const runs = useMemo(() => runsFor(selected.id, scope.id), [allRuns, selected.id, scope.id])
  // A demo switch: the record's documents held back until the agent retrieves them.
  const withheld = useMemo(() => documentsWithheld(selected.id), [allRuns, selected.id])
  const stepRecord = scoped ? selected : record
  const stepResults = scoped ? liveAll : results
  const nextSteps = useMemo(() => {
    // The session's wording of each step's why, where it has written one.
    const whys = scopedRead?.summary?.stepWhys
    return nextStepsFor(stepRecord, scope, stepResults, runs, withheld).map((st) => (whys?.[st.id] ? { ...st, why: whys[st.id] } : st))
  }, [stepRecord, scope, stepResults, runs, scopedRead, withheld])
  const [runningStep, setRunningStep] = useState<string>()
  const runStep = (step: NextStep) => {
    setRunningStep(step.id)
    window.setTimeout(() => {
      const at = new Date().toISOString()
      if (step.kind === 'documents') {
        const on = documentsOnRecord(stepRecord, step.state ?? sosGaps(stepRecord)?.state ?? '')
        const found = [...(step.docs ?? [])].flatMap((d) => on[d].map((x) => x.id))
        const missing = (step.docs ?? []).filter((d) => on[d].length === 0)
        recordRun(selected.id, scope.id, { stepId: step.id, label: step.label, why: step.why, at, found, missing })
      } else {
        recordRun(selected.id, scope.id, { stepId: step.id, label: step.label, why: step.why, at, adds: step.adds })
      }
      setRunningStep(undefined)
    }, 1100)
  }
  const requestStep = (step: NextStep, payload: RequestPayload) => {
    const at = new Date().toISOString()
    requestInformation(selected.id, (step.docs ?? []).map((d) => DOC_LABEL[d]), payload.message)
    recordRun(selected.id, scope.id, { stepId: step.id, label: step.label, why: step.why, at, requested: { email: payload.email, message: payload.message } })
  }
  /** The analyst's own files: kept by the dev server, then the report's documents. */
  const uploadStep = async (step: NextStep, files: File[]) => {
    setRunningStep(step.id)
    const uploads = await Promise.all(
      files.map(async (f) => {
        const res = await fetch('/api/document-upload', { method: 'POST', body: f })
        const { id } = (await res.json()) as { id: string }
        return { id, name: f.name, from: 'analyst' as const }
      })
    )
    recordRun(selected.id, scope.id, { stepId: step.id, label: step.label, why: step.why, at: new Date().toISOString(), uploads })
    setRunningStep(undefined)
  }
  /** What next steps brought to the report's Documents card: retrieved ids, uploaded names. */
  const retrieved = useMemo(
    () => ({
      retrieved: new Set(runs.flatMap((r) => r.found ?? [])),
      withheld,
      uploads: runs.flatMap((r) => (r.uploads ?? []).map((u) => ({ ...u, at: r.at, email: r.requested?.email })))
    }),
    [runs, withheld]
  )

  const [agentOpen, setAgentOpen] = useState<string | null>(null)

  /**
   * The assessments the score is broken down by, and what each one cited.
   *
   * The score card's cells used to be five buckets of `identityScore`'s own
   * invention, beside a report organised into the customer's assessments — two
   * vocabularies for one record. These are the sections themselves: the
   * assessment's name, and the union of every insight its prose and its gaps
   * point at, which is what that assessment actually rested on.
   */
  const scoreAreas = useMemo(() => {
    const version = analysis.selected
    if (!version) return []
    // The stored policy names the assessments; their tiers are the agent's,
    // read by id so a report kept before tiers existed still gets them.
    const tierOf = new Map(agent.skills.map((x) => [x.id, x.weight]))
    return areasOf(
      version.result.sections,
      (version.policy ?? policy).map((p) => ({ ...p, weight: tierOf.get(p.id) }))
    )
  }, [analysis.selected, policy, agent.skills])

  /**
   * The identity score, computed once for the page.
   *
   * The rail draws it and navigates by it; it used to be computed inside the
   * score card, which was the only thing that read it. Null until a report
   * exists — the rail draws an empty track and says so.
   */
  const score = useMemo(
    () => (view ? identityScore(record, results, scoreAreas) : null),
    [view, record, results, scoreAreas]
  )
  /** The status the determination implies, and the reviewer's review of it. */
  // The header's status defaults to the report's call, not the score's band.
  const determined = statusForBand(
    (bandOfCall(analysis.selected && 'headline' in analysis.selected.result ? (analysis.selected.result as { headline?: string }).headline : undefined) ?? score?.band)?.id
  )
  const review = useReview(selected.id, determined)
  /** Whose call the status is — Middesk's, until someone decides — and when
   *  the report ran: the assessment card's line under its name. */
  /** When the workflow's assessments last ran. */
  const ran = (scoped ? scopedRead?.runAt : analysis.selected?.at) || undefined
  // Who decided and when, once someone has; until then nothing — the status
  // in the page head is the call. When it ran is the card's Last updated.
  const decisionLine = (() => {
    const WORD: Record<ReviewStatus, string> = { approved: 'Approved', in_review: 'Needs review', rejected: 'Rejected' }
    return review.change ? `${WORD[review.change.to]} by ${review.change.by} on ${dayjs(review.change.at).format('MMM D, YYYY')}` : undefined
  })()

  /**
   * Each area's weight, keyed by its section, for the card headers.
   *
   * From the agent's configuration rather than the score, so the chips are on
   * the cards before a report exists and do not change when one does: a weight
   * is the policy's, not the run's.
   */
  const tiers = useMemo(
    () =>
      new Map<string, AssessmentWeight>(
        agent.skills
          .filter((s) => s.kind === 'assessment')
          .map((s) => [s.id, (s.weight as AssessmentWeight | undefined) ?? 'critical'])
      ),
    [agent.skills]
  )

  /** What each area asks, for this business and this use case, at the head of its card. */
  const summaries = useMemo(
    () => areaSummaries(record, analysis.selected ? reportLabel(analysis.selected) : 'Account opening'),
    [record, analysis.selected]
  )

  /** The chat has a column of its own only when the page is wide enough for a
   *  third region. CSS sizes it; this decides whether its log is mounted. */
  const isWide = useWide()

  /**
   * The chat's width, once the reader has set it.
   *
   * `null` means the breakpoint's own value — 360, or 420 at `desk`. Dragging
   * writes a number here and the root's inline style overrides the class, which
   * is the whole reason the default lives in a class and not in the style: an
   * inline value can win over a token, a token cannot win over an inline value.
   * Below `wide` nothing reads `--chat-w`, so a set width is simply inert there.
   */
  const [chatW, setChatW] = useState<number | null>(null)

  /**
   * Whether the assistant is on screen.
   *
   * Open when there is a conversation to show, closed otherwise: on a report
   * nobody has asked about it was 460px of white beside the thing being read.
   * The rail's button brings it back, and dismissing it gives the whole width
   * to the report again.
   */
  // A report opens with its Insights beside it — where the panel docks and
  // leaves the report in view (the nav rail, the rail, a 400px panel and
  // `REPORT_MIN`); narrower, it would cover the report, so it waits to be asked.
  const [chatOpen, setChatOpen] = useState(
    () => typeof window !== 'undefined' && window.innerWidth - 49 - 49 - 400 >= REPORT_MIN
  )

  /** What the right-hand column is showing. The picker in its own header, and
   *  the rail it collapses to, both set this. */
  // Insights first: the Assistant is not one of the column's views.
  const [panelView, setPanelView] = useState<PanelView>('insights')

  /**
   * The assistant's own state: pill, window or expanded, docked or floating.
   *
   * Docked, it IS the right-hand column and its state decides whether the
   * column is open. Floating, it is a window over the report and the column
   * is put away to the rail. Below `wide` there is no column to dock into, so
   * the preference is remembered and not honoured: the window floats.
   */
  // Dismissed on load: the report first. Brought back, it opens at the size
  // last used (`readAssistantState`).
  const [assistantState, setAssistantStateRaw] = useState<FloatingPanelState>('pill')
  /** The floating summary, put away with its × for this visit. */
  const [summaryDismissed, setSummaryDismissed] = useState(false)
  /** A question typed in the floating summary, for the Assistant to ask. */
  const [askRequest, setAskRequest] = useState<{ text: string; n: number }>()
  /** The summary, carried over as the Assistant thread's first message. */
  const [opener, setOpener] = useState<{ text: string; at: string }>()
  const [assistantPreference, setAssistantPresentationRaw] =
    useState<FloatingPanelPresentation>(readAssistantPresentation)
  const setAssistantState = (next: FloatingPanelState) => {
    setAssistantStateRaw(next)
    writeStored(ASSISTANT_STATE_KEY, next)
  }
  const setAssistantPresentation = (next: FloatingPanelPresentation) => {
    setAssistantPresentationRaw(next)
    writeStored(ASSISTANT_PRESENTATION_KEY, next)
  }
  // Always the bubble: the Assistant floats over the report and never takes
  // the side panel, whatever was remembered.
  void assistantPreference
  const assistantPresentation: FloatingPanelPresentation = 'floating'
  // Never docked: the column is the rail's views alone.
  const assistantDocked = false

  /**
   * Whether the column has something in it.
   *
   * On the assistant it is the docked panel's own state; on the other four
   * views it is the flag the rail toggles. One answer for the layout below,
   * which sizes the column and insets the report from it.
   */
  const columnOpen = panelView === 'assistant' ? assistantDocked : chatOpen

  /**
   * Beside the report, or over it.
   *
   * Docked while the report still has room to be read beside it — at least
   * `REPORT_MIN` once the nav, the rail and the panel are taken out — so the
   * whole report stays in view. In the mid range, where docking would squeeze
   * it past that, the panel lies over the report instead.
   */
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [room, setRoom] = useState({ vw: typeof window === 'undefined' ? 0 : window.innerWidth, nav: 0 })
  useEffect(() => {
    const read = () =>
      setRoom({
        vw: window.innerWidth,
        nav: rootRef.current ? parseFloat(getComputedStyle(rootRef.current).getPropertyValue('--nav-w')) || 0 : 0
      })
    read()
    window.addEventListener('resize', read)
    return () => window.removeEventListener('resize', read)
  }, [])
  // The panel's width as the root sets it: a dragged width, else the column's own.
  const panelPx = chatW ?? (room.vw >= 1504 ? 460 : 400)
  // The width read on resize, not `isWide`: one measurement for the whole rule.
  const docked = room.vw >= WIDE && columnOpen && room.vw - room.nav - 49 - panelPx >= REPORT_MIN

  /**
   * Written out rather than composed from `wide:` variants.
   *
   * The three states are `display: contents`, `display: flex` and
   * `display: none`, and Tailwind resolves two utilities setting one property
   * by stylesheet order rather than by the order they are written — so
   * `contents wide:hidden` is a coin toss. One string, one display.
   */
  const panelClass = !isWide
    ? // Below `wide` the panel lies over the report, beside the rail, rather
      // than taking a column from it: the report keeps its measure.
      chatOpen && panelView !== 'assistant'
      ? 'flex w-[min(420px,calc(100vw-49px))] min-w-0 flex-col border-l border-solid border-border bg-card shadow-elevation-drawer'
      : 'hidden'
    : chatOpen && panelView !== 'assistant'
      ? // Docked, a column beside the report; with no room for that, over it.
        cn('flex min-w-0 flex-1 flex-col border-l border-solid border-border bg-card', !docked && 'shadow-elevation-drawer')
      : 'hidden'

  /** The insights the score read as a point against the identity, marked in the
   *  report where they are argued. */
  const negatives = useMemo(() => negativesFor(record, results), [record, results])

  /**
   * A REPORT is being written — not merely that something was sent.
   *
   * A typed question sets `waiting` too, with an empty manifest, so everything
   * keyed to the bare flag treated a follow-up as a new report: the contents
   * rail collapsed to two entries and spun every dot while the report it was
   * indexing was still on the page. Harmless while the conversation lived in
   * this column; wrong the moment it moved out, because the report column would
   * start running because of something typed in the chat.
   */
  const running = analysis.waiting && analysis.waitingKind === 'report'

  /*
   * The report is static on arrival.
   *
   * Opening a record used to fire a run, so the page spent its first seconds
   * pretending to work on an assessment it already has on disk. The stored
   * report is now what is rendered, from the first paint. Pressing send still
   * runs one.
   */


  // Navigational only — grouping helps a reader find things and nothing rests
  // on it (00-MASTER-PLAN.md rule 3).
  const categories = useMemo(() => categoriesOf(record), [record])
  const groupFor = useMemo(() => makeGroupFor(categories), [categories])
  /** The cards this assessment's insights belong to; absent, every card. */
  const workflowCards = useMemo(
    () => (scope.insights ? new Set(scope.insights.map((k) => cardFor(k, groupFor))) : undefined),
    [scope, groupFor]
  )

  /** The open report as the Assistant's first message: the determination and
   *  each card's title and sentence, from the functions the page draws with. */
  const brief = useMemo(
    () =>
      reportBrief({
        version: analysis.selected,
        record,
        results,
        groupFor,
        score,
        scoreAreas,
        summaries,
        policy,
        tiers
      }),
    [analysis.selected, record, results, groupFor, score, scoreAreas, summaries, policy, tiers]
  )
  /** A custom order's assessment has no written recommendation: its call is
   *  its score's band, and the business's status stays the reviewer's. */
  const scopedCall = useMemo(() => {
    const sc = scopedRead?.score
    if (!sc) return undefined
    return {
      kind: (sc.band.id === 'established' ? 'approve' : sc.band.id === 'not_established' ? 'reject' : 'request') as 'approve' | 'reject' | 'request',
      status: statusForBand(sc.band.id),
      label: sc.band.label,
      value: sc.value,
      reason: scopedRead?.summary?.text,
      score: sc,
      steps: []
    }
  }, [scopedRead])
  /** A report on screen, so its hero heads the page. */
  const hero = scoped ? true : Boolean(view && brief)
  /**
   * What the newest document did to the recommendation: the latest answer on
   * this report, in any conversation, that wrote `revisedRecommendation`.
   * The hero reloads with it; the Assistant reads a further document against it.
   */
  const revision = useMemo(() => {
    const latest = analysis.threads
      .flatMap((t) => t.questions)
      .filter((q) => q.result.revisedRecommendation)
      .sort((a, b) => a.at.localeCompare(b.at))
      .at(-1)
    return latest ? { ...latest.result.revisedRecommendation!, at: latest.at } : undefined
  }, [analysis.threads])
  /** The assessment's short read: the panel's, and the Assistant's turn's. */
  const panelRead = scoped
    ? scopedRead?.summary?.text
    : // A fresh run's reason; else the report's summary of the business; else its headline.
      brief?.lede
      ? (revision?.reason ?? heldReportFor(selected.name)?.report?.summary ?? brief.lede)
      : undefined
  /** The brief the Assistant leads the assessment's turn with: the full
   *  report's, or — for an assessment — its own read, call and cards. */
  const assessmentBrief = useMemo(
    () =>
      !brief
        ? undefined
        : scoped
          ? {
              ...brief,
              lede: panelRead,
              determination: scopedCall,
              cards: brief.cards.filter((c) => !workflowCards || c.cards.some((x) => workflowCards.has(x)))
            }
          : { ...brief, lede: panelRead ?? brief.lede },
    [brief, scoped, panelRead, scopedCall, workflowCards]
  )
  const assessment = scoped ? scopedCall : brief?.determination ? standingCall(brief.determination, revision) : undefined
  const [reviewStepsRequest, setReviewStepsRequest] = useState(0)
  const [reviewStepIndex, setReviewStepIndex] = useState<number>()
  const [summaryRequest, setSummaryRequest] = useState(0)
  /** The businesses whose full assessment the Assistant has written this
   *  session. Module memory, not storage: it outlives leaving the record and
   *  coming back, and every new load starts at "Generate". */
  const [generated, setGenerated] = useState<ReadonlySet<string>>(() => GENERATED)
  const [recommendRequest, setRecommendRequest] = useState<{ area: string; index: number; request: number }>()

  /**
   * Run the standing workflow, from where the report would be.
   *
   * The same composition the composer sends — its own brief and the parts under
   * it — so the run this starts and the run the reader could have sent by hand
   * are the same run.
   */
  const runStanding = () => {
    if (!standing) return
    const composed = composeAssessment(standing, agent.skills, agent.disabled ?? [])
    if (!composed) return
    analysis.run(
      composed.prompt,
      [],
      'report',
      [standing.name],
      '',
      composed.assessments.length > 0 ? composed.assessments : policy
    )
  }





  /*
   * What the tabs read: the assessment's snapshot.
   *
   * A report carries its own copy of the insights, attributes and sources it
   * read, and the determination was made on that copy — so that is what the
   * three tabs show. The live record stands in only when no report exists.
   */
  const scopeRecord = view ? record : selected
  const scopeResults: Derived[] = view ? results : live
  const scopeGroupFor = useMemo(() => makeGroupFor(categoriesOf(scopeRecord)), [scopeRecord])
  const scopeGrouped = useMemo(
    () =>
      GROUPS.map((g) => ({
        ...g,
        rows: scopeResults.filter((r) => !r.notReported && scopeGroupFor(r.insightId) === g.id)
      })).filter((g) => g.rows.length > 0),
    [scopeResults, scopeGroupFor]
  )
  /** What the assessment flagged in this moment's reading, marked in the rows
   *  the way the report marks them. */
  const scopeNegatives = useMemo(() => negativesFor(scopeRecord, scopeResults), [scopeRecord, scopeResults])
  const scopeSources = useMemo(
    () => sourcesFor(scopeRecord, scopeResults, scopeGroupFor),
    [scopeRecord, scopeResults, scopeGroupFor]
  )
  // The app's Sources tab, with the prototype's Submitted card kept at its head.
  const scopeSubmitted = useMemo(() => scopeSources.find((s) => s.id === SUBMITTED_CARD), [scopeSources])
  const scopeOrderedSources = useMemo(() => appOrderedSources(scopeSources, scopeRecord), [scopeSources, scopeRecord])
  /** The rail: the panel's own views, then under its divider one item per
   *  kind of source the business has, in place of a single Sources. */
  const railViews = useMemo<PanelViewDef[]>(
    () => [
      ...PANEL_VIEWS.filter((v) => v.id !== 'sources'),
      ...sourceGroupsIn(scopeSources).map((g) => ({ id: `sources:${g.id}` as PanelView, label: g.label, icon: g.icon, foot: true }))
    ],
    [scopeSources]
  )
  /** The rail item a source is under; a screening result, none — every source. */
  const viewOfSource = (s: (typeof scopeSources)[number]): PanelView => {
    const group = sourceGroupOf(s)
    return group ? `sources:${group.id}` : 'sources'
  }
  /** The sources the panel shows: one kind, or — `sources` — every one. */
  const panelSources = (view: PanelView) =>
    view === 'sources' ? scopeOrderedSources : scopeOrderedSources.filter((s) => viewOfSource(s) === view)

  const [revealed, setRevealed] = useState<string[]>([])
  /**
   * Which face of the report is on screen.
   *
   * The assessment and the three lists are the same object — one report, read
   * four ways — so they are tabs of one document rather than a document with a
   * reference panel bolted to its right. The assessment is what a report is
   * for, so it opens on it.
   */
  const panelRef = useRef<HTMLDivElement | null>(null)
  /**
   * The report's head — crumb, name and controls — sticks to the top of the
   * scroller, and the filter bar pins directly under it. The head publishes
   * its measured height as `--report-head-h` and the bar reads it, the
   * mechanism the businesses list uses for its table header, so the two never
   * overlap however the head wraps.
   */
  const headRef = useRef<HTMLDivElement | null>(null)
  /**
   * Whether the report has scrolled under the head. Pinned, the lowest of the
   * pinned bars — the head, or the filter bar under it when narrowed — casts
   * a shadow, so the reader can see the report sliding beneath; at rest there
   * is none. Read off the head's position, which works whichever element is
   * scrolling (the panel from `wide`, the document below it).
   */
  const [pinned, setPinned] = useState(false)
  useEffect(() => {
    const read = () => {
      const head = headRef.current
      if (!head) return
      const panel = panelRef.current
      const top = panel && panel.scrollHeight > panel.clientHeight ? panel.getBoundingClientRect().top : 0
      const scrolled = (panel?.scrollTop ?? 0) > 0 || window.scrollY > 0
      setPinned(scrolled && head.getBoundingClientRect().top <= top + 1)
    }
    read()
    const panel = panelRef.current
    panel?.addEventListener('scroll', read, { passive: true })
    window.addEventListener('scroll', read, { passive: true })
    return () => {
      panel?.removeEventListener('scroll', read)
      window.removeEventListener('scroll', read)
    }
  }, [])
  useEffect(() => {
    const el = headRef.current
    const panel = panelRef.current
    if (!el) return
    // The head's height, for the filter bar to pin under; and the scroll
    // area's inner width, for both bars to paint their canvas and shadow
    // edge to edge while their content keeps to the reading column.
    const root = document.documentElement.style
    const publish = () => {
      root.setProperty('--report-head-h', `${el.offsetHeight}px`)
      if (panel) root.setProperty('--report-scroll-w', `${panel.clientWidth}px`)
    }
    publish()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(publish)
    observer.observe(el)
    if (panel) observer.observe(panel)
    return () => {
      observer.disconnect()
      root.removeProperty('--report-head-h')
      root.removeProperty('--report-scroll-w')
    }
  })

  /** Open the right-hand panel on one of its views. */
  const showPanel = (view: PanelView) => {
    setPanelView(view)
    if (view === 'assistant') {
      if (assistantState === 'pill') setAssistantState(readAssistantState())
    } else setChatOpen(true)
  }

  /**
   * A citation names a category, so following it opens the Insights panel at
   * that grouping. Every insight the paragraph cited is revealed at once,
   * which is the thing the citation was standing for.
   */
  const reveal = (ids: string[], groupId: string) => {
    showPanel('insights')
    setRevealed(ids)
    window.setTimeout(() => {
      document.getElementById(`group-${groupId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 60)
    window.setTimeout(() => setRevealed([]), 2400)
  }
  const jumpToGroup = (groupId: string, insightIds: string[]) => reveal(insightIds, groupId)

  const revealedSet = useMemo(() => new Set(revealed), [revealed])

  /**
   * The report narrowed to one assessment: its cards and nothing else, under
   * its summary. Set from the Assistant — a block's title or its "All cards"
   * chip — and cleared from the report's banner, or by the same block again.
   */
  const [focus, setFocus] = useState<ReportFocus | null>(null)
  /** The area as the filter bar names it: its workflow's name, else the policy's. */
  const focusName = focus ? (workflowByAssessmentId(focus.id)?.name ?? policy.find((p) => p.id === focus.id)?.name ?? focus.title) : ''
  const focusAssessment = (c: BriefCard) => {
    const narrowing = focus?.id !== c.id
    setFocus(narrowing ? { id: c.id, title: c.title, sentence: c.sentence, cards: c.cards } : null)
    // Narrowed, the report starts again from the top, where the filter bar
    // says what changed. Widened, the reader stays where they chose to leave.
    if (narrowing) {
      panelRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }
  // Escape leaves the narrowed view, as it leaves any mode — unless the key is
  // meant for a field or a dialog that is open.
  useEffect(() => {
    if (!focus) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const t = e.target as HTMLElement | null
      if (t && (t.closest('input, textarea, [contenteditable="true"]') || document.querySelector('[role="dialog"]'))) return
      setFocus(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focus])
  /**
   * An assistant chip leads to its card IN THE REPORT, and only there: the
   * report scrolls to the card's top. Nothing opens — not the card's
   * Insights, not the Insights view. Named by group (an answer's chip), the
   * group's first card. Narrowed to an assessment the card isn't part of, the
   * report widens back to the whole first, so there is a card to land on.
   */
  const landOn = (cardId: string) =>
    panelRef.current
      ?.querySelector<HTMLElement>(`[id^="${cardAnchor(cardId)}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const pendingCard = useRef<string | null>(null)
  /** The card a chip just led to: its data opens. */
  const [expandCard, setExpandCard] = useState<{ card: string; n: number }>()
  const jumpToCard = (cardId: string) => {
    setExpandCard((cur) => ({ card: cardId, n: (cur?.n ?? 0) + 1 }))
    if (!focus || focus.cards.includes(cardId) || focus.cards.some((c) => c.startsWith(`${cardId}-`))) return landOn(cardId)
    pendingCard.current = cardId
    setFocus(null)
  }
  /**
   * An insight, followed — a row's lead or one of its chips — leads to what it
   * found: the report narrowed to its card, with the card's header filter on
   * the rows that matter (the inactive filings, the open liens, the screening
   * hits) and none of them folded. A finding the card shows whole needs no filter.
   */
  const [reportView, setReportView] = useState<{ card: string; filter?: RegistrationFilter | StatusFilter; lead?: boolean; n: number }>()
  const followChip = (insight: PanelInsight | undefined, group: PanelGroup) => {
    const key = insight?.id.split(':')[0]
    const against = insight?.intent === 'failure' || insight?.intent === 'warning'
    const filter = ((): RegistrationFilter | StatusFilter | undefined => {
      // The category itself: its card whole.
      if (!insight) return 'all'
      // The domestic filing's sub status: every kind, the domestic filing alone (`lead`).
      if (key === 'sos_domestic_sub_status') return 'all'
      if (key === 'sos_inactive' || key === 'sos_domestic') return against ? 'inactive' : 'active'
      if (key === 'sos_active') return 'active'
      // Liens, litigation, bankruptcies, the screens: what stands, or — passed —
      // what was dismissed or closed, where there is any.
      if (/^(liens|litigation|bankruptcy|screening-)/.test(group.cardId)) return against ? 'standing' : 'all'
      return undefined
    })()
    // The report narrowed to the card, as its row narrows it; the card opened,
    // filtered, every row shown.
    const lead = key === 'sos_domestic_sub_status'
    setReportView((cur) => ({ card: group.cardId, filter, lead, n: (cur?.n ?? 0) + 1 }))
    setExpandCard((cur) => ({ card: group.cardId, n: (cur?.n ?? 0) + 1 }))
    applyInsightFilter({ outcome: insightFilter.outcome, cards: new Set([group.cardId]) })
    panelRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  /**
   * An area, chosen: the report narrowed to the cards the area is read from
   * (`REVIEW_AREAS`), plus any its open steps cite. The same area again
   * widens back out.
   */
  const groups = useMemo(() => (assessment ? reviewGroups(assessment, revision?.resolved) : []), [assessment, revision?.resolved])
  const showArea = (areaId: ReviewAreaId) => {
    const area = REVIEW_AREAS.find((a) => a.id === areaId)
    if (!area) return
    const id = `area-${areaId}`
    if (focus?.id === id) return setFocus(null)
    // The area's own cards — fixed per area — and whatever its steps add.
    const fromSteps = (groups.find((g) => g.id === areaId)?.steps ?? []).flatMap((s) => {
      const step = assessment?.steps[s.index]
      return step ? evidenceByCard(step.cites, results, groupFor).sources.map((src) => src.id) : []
    })
    const cards = [...new Set([...area.cards, ...fromSteps])]
    setFocus({ id, title: area.label, cards })
    panelRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const selectedArea = focus?.id.startsWith('area-') ? (focus.id.slice(5) as ReviewAreaId) : undefined
  /** The brief, as narrowed: the selected area's block, or the Assistant's
   *  own narrowing's. Nothing, unnarrowed. */
  const areaOfBriefCard = (c: BriefCard) => areaOfAssessmentName(workflowByAssessmentId(c.id)?.name ?? policy.find((p) => p.id === c.id)?.name, c.id)
  const shownArea = selectedArea
  /** Every insight on the report, the same reading: the spark under the score. */
  /** Arrived from the overview's Regenerate on "Full Business KYB": run it once. */
  const location = useLocation()
  const navigate = useNavigate()
  const regenerateAsked = useRef(Boolean((location.state as { regenerate?: boolean } | null)?.regenerate))
  useEffect(() => {
    if (!regenerateAsked.current || !standing) return
    regenerateAsked.current = false
    runStanding()
  }, [standing])
  /** Every insight on the report, grouped by the card it is about, in the
   *  report's order; within a group, failed first, then needs review, passed,
   *  context. The left column lists them in place of the areas. */
  const allInsights = useMemo(() => {
    const RANK = { fail: 0, review: 1, pass: 2, neutral: 3 } as const
    return shownResults
      .filter((r) => !r.notReported)
      .map((r) => ({ r, card: cardFor(r.insightId, groupFor), outcome: outcomeOf(r, record) }))
      .sort((a, b) => cardIndex(a.card) - cardIndex(b.card) || RANK[a.outcome] - RANK[b.outcome] || (STATE_RANK[a.r.state] ?? 3) - (STATE_RANK[b.r.state] ?? 3))
      .map(({ r, card, outcome }) => ({ id: r.insightId, statement: r.statement, outcome, group: cardById(card)?.label ?? card }))
  }, [shownResults, groupFor, record])
  /** The same insights for the panel: one group per card, worst first. */
  const panelGroups = useMemo<PanelGroup[]>(() => {
    // One mark against, counted as one (`statusOf`); drawn red only where it
    // fails outright — a check for review is the X in ink.
    const INTENT = { fail: 'failure', review: 'warning', pass: 'success', neutral: 'unknown' } as const
    const byCard = new Map<string, PanelGroup>()
    const RANK = { fail: 0, review: 1, pass: 2, neutral: 3 } as const
    shownResults
      .filter((r) => !r.notReported)
      .map((r) => ({ r, card: cardFor(r.insightId, groupFor), outcome: outcomeOf(r, record) }))
      .sort((a, b) => cardIndex(a.card) - cardIndex(b.card) || RANK[a.outcome] - RANK[b.outcome] || (STATE_RANK[a.r.state] ?? 3) - (STATE_RANK[b.r.state] ?? 3))
      .forEach(({ r, card, outcome }) => {
        const g = byCard.get(card) ?? { cardId: card, label: cardById(card)?.label ?? card, insights: [] }
        // The finding in its own words: a bare value — "match", "Mixboard
        // Inc." — doesn't say what matched or what the name is.
        const statement = statementOf(r, record)
        const verdict = r.insightId === 'submitted_name_dba' && r.value ? `Listed as a DBA of ${r.value}` : statement
        g.insights.push({ id: r.insightId, intent: INTENT[outcome], verdict, statement, why: whyOf(r.insightId, record) })
        byCard.set(card, g)
      })
    // Names: led by the business's own name, and saying what else was found —
    // a DBA held by another entity, the record's other names.
    const names = byCard.get('name')
    if (names) {
      const submitted = record.names?.find((n) => (n as { submitted?: boolean }).submitted)?.name ?? record.name
      const others = (record.names ?? []).filter((n) => !(n as { submitted?: boolean }).submitted && !sameName(n.name, submitted))
      const head = names.insights[0]
      names.insights = [
        { id: 'name:head', intent: head.intent, verdict: displayName(submitted), statement: head.statement, synthetic: true },
        ...names.insights,
        ...(others.length
          ? [
              {
                id: 'name:others',
                intent: 'unknown' as const,
                verdict: `${others.length} other name${others.length > 1 ? 's' : ''} found`,
                statement: `Also on the record: ${others.map((n) => n.name).join(', ')}.`,
                synthetic: true
              }
            ]
          : [])
      ]
    }
    // The workflow's assessments that need an input the record lacks: listed
    // whether or not they produced insights, saying what they need.
    for (const card of REPORT_CARDS) {
      if (workflowCards && !workflowCards.has(card.id)) continue
      const needs = missingInputs(card.id, record)
      if (!needs.length) continue
      byCard.set(card.id, { ...(byCard.get(card.id) ?? { cardId: card.id, label: card.label, insights: [] }), needs })
    }
    for (const g of byCard.values()) {
      g.summary = assessmentSummary(g, record)
      g.updated = ran ? dayjs(ran).format('MMM D, YYYY') : undefined
    }
    // Worst rows first, as the source orders its panel; the report's order
    // within a kind. One that can't be read yet sits after the findings.
    const ORDER = ['failure', 'warning', 'pending', 'success', 'unknown']
    const worst = (g: PanelGroup) => ORDER.indexOf(g.needs?.length ? 'pending' : (g.insights[0]?.intent ?? 'unknown'))
    return [...byCard.values()].sort((a, b) => worst(a) - worst(b))
  }, [shownResults, groupFor, record, workflowCards, ran])
  /**
   * What the floating bubble leads with — the Assistant's latest word to the
   * reader, while it is put away: an answer being written; a reply not yet
   * read in the Assistant; else, with assessments needing review and nothing
   * decided, the way to review the assessment's summary. None, the summary.
   */
  const lastTurn = analysis.thread[analysis.thread.length - 1]
  const [seenReply, setSeenReply] = useState<string>()
  // Opening the Assistant reads what is in it.
  useEffect(() => {
    if (assistantState !== 'pill' && lastTurn) setSeenReply(lastTurn.id)
  }, [assistantState, lastTurn?.id])
  const needReview = panelGroups.filter((g) => statusOf(g) === 'failure').length
  const openAssistantWindow = () => {
    setAssistantPresentationRaw('floating')
    setAssistantStateRaw('window')
  }
  const bubbleNotice: BubbleNotice | undefined =
    analysis.waiting && analysis.waitingKind === 'question'
      ? { kind: 'working', title: 'Working on your question' }
      : lastTurn && lastTurn.kind === 'question' && lastTurn.id !== seenReply
        ? {
            kind: 'reply',
            title: 'New reply',
            context: lastTurn.typed || undefined,
            text: lastTurn.result.sections
              .filter((s) => s.id !== 'recommendation')
              .flatMap((s) => s.body.map((b) => b.text))[0],
            actionLabel: 'Open conversation',
            onAction: openAssistantWindow
          }
        : needReview > 0 && !review.change
          ? {
              kind: 'review',
              title: 'Review assessment summary',
              text: `${needReview} of ${panelGroups.length} assessments need review. ${panelRead ?? ''}`.trim(),
              actionLabel: 'Review summary',
              onAction: () => {
                // The assessment's summary, opened in the Assistant's window.
                GENERATED.add(selected.id)
                setGenerated(new Set(GENERATED))
                openAssistantWindow()
                setSummaryRequest((request) => request + 1)
              }
            }
          : undefined
  /**
   * TIN Match without a TIN: the two ways to one — Middesk finds it, or the
   * reader submits it, which orders TIN Match with it, on the details step.
   */
  const tinRequest = useTinRequest(selected.id)
  const tinActions = {
    requestedAt: tinRequest?.at,
    onRequest: () => requestTin(selected.id),
    onCancelRequest: () => cancelTinRequest(selected.id),
    onSubmit: (tin: string) =>
      navigate('/order', { state: { businessId: selected.id, origin: location.pathname, customOrderId: 'report:tin', tin } })
  }
  /** The panel's assessments, with what the reader can do on TIN Match. */
  const panelGroupsShown = panelGroups.map((g) =>
    g.cardId !== 'tin' || !g.needs?.length
      ? g
      : {
          ...g,
          summary: tinRequest ? 'Middesk is finding the TIN. TIN Match runs once it is found.' : g.summary,
          actions: tinRequest ? undefined : (
            <>
              <ActionButton onClick={() => requestTin(selected.id)} size="compact" variant="secondary">
                Let Middesk find it
              </ActionButton>
              {/* To the TIN card, where it is typed. */}
              <ActionButton onClick={() => followChip(undefined, g)} size="compact" variant="quiet">
                Submit TIN
              </ActionButton>
            </>
          )
        }
  )
  /** A row of the panel: the report narrowed to its card; the same row again widens it. */
  /**
   * The Insights card at the report's head: an outcome and the cards picked
   * under it. It narrows the report as everything else does — through
   * `focus` — so the back tab and the panel's rows undo it, and reset it.
   */
  const [insightFilter, setInsightFilter] = useState<InsightFilter>(NO_FILTER)
  const applyInsightFilter = (next: InsightFilter) => {
    setInsightFilter(next)
    const cards = next.cards.size
      ? [...next.cards]
      : next.outcome === 'all'
        ? []
        : panelGroups.filter((g) => inStatus(g, next.outcome)).map((g) => g.cardId)
    if (!cards.length) return setFocus(null)
    const title = next.cards.size
      ? panelGroups.filter((g) => next.cards.has(g.cardId)).map((g) => g.label).join(', ')
      : outcomeWord(next.outcome)
    setFocus({ id: INSIGHT_FILTER, title, cards })
  }
  // Narrowed some other way, or widened again: the card reads All.
  useEffect(() => {
    if (focus?.id !== INSIGHT_FILTER) setInsightFilter(NO_FILTER)
  }, [focus])

  const briefShown = !brief
    ? undefined
    : shownArea
      ? { cards: brief.cards.filter((c) => areaOfBriefCard(c) === shownArea), title: REVIEW_AREAS.find((a) => a.id === shownArea)?.label }
      : // A card chosen in the panel has no brief block: the back tab is the way back.
        focus && !focus.id.startsWith('area-') && !focus.id.startsWith('card-')
        ? { cards: brief.cards.filter((c) => c.id === focus.id), title: focusName }
        : // The whole report: no assessment card. The full account is the
          // Assistant's ("Generate full assessment"), not the page's.
          undefined
  // Widened for a chip: land once the whole report has drawn.
  useEffect(() => {
    const cardId = pendingCard.current
    if (focus || !cardId) return
    pendingCard.current = null
    landOn(cardId)
  }, [focus])

  /**
   * An attribute's source chip names a record, and the record is in Sources
   * in full. Exact card, else the first of that type: a tax permit's card id
   * carries its state ("src:Tax permit · Pennsylvania") and the chip that
   * cites it only knows the type.
   */
  const [sourceFocus, setSourceFocus] = useState<string | null>(null)
  const flashSource = (id: string) => {
    setSourceFocus(id)
    window.setTimeout(() => setSourceFocus(null), 2400)
  }
  const resolveSource = (sources: typeof scopeSources, cardId: string) =>
    sources.find((x) => x.id === cardId) ?? sources.find((x) => x.id.startsWith(cardId))
  /** The identity's source, picked in the Sources column. */
  /** A summary tag's card, by its source id: ringed, then scrolled to. */
  const jumpToSourceCard = (id: string) => {
    flashSource(id)
    // To the card's top: it opens as it is followed, and centring a card that
    // is still growing lands mid-body.
    window.setTimeout(() => {
      document.getElementById(`source-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 60)
  }

  /** Open the timeline on one change and mark it; or on one filing, alone. */
  const [timelineFocus, setTimelineFocus] = useState<{ eventId?: string; kinds?: Kind[]; filing?: string; n: number }>()
  const jumpToTimeline = (eventId: string, kinds?: Kind[]) => {
    showPanel('timeline')
    setTimelineFocus((f) => ({ eventId, kinds, n: (f?.n ?? 0) + 1 }))
  }
  const showFilingTimeline = (filing: string) => {
    showPanel('timeline')
    setTimelineFocus((f) => ({ filing, n: (f?.n ?? 0) + 1 }))
  }
  // The filings with timeline history: their Sources cards get a Timeline button.
  const timelineFilings = useMemo(() => filingsWithTimeline(selected.id), [selected.id])
  const filingTimeline = (src: { registration?: { state?: string | null; fileNumber?: string | null } }) => {
    const key = src.registration && filingKey(src.registration.state ?? undefined, src.registration.fileNumber ?? undefined)
    return key && timelineFilings.has(key) ? () => showFilingTimeline(key) : undefined
  }

  const jumpToSource = (cardId: string) => {
    const hit = resolveSource(scopeSources, cardId)
    showPanel(hit ? viewOfSource(hit) : 'sources')
    if (!hit) return
    flashSource(hit.id)
    window.setTimeout(() => {
      document.getElementById(`source-${hit.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 60)
  }


  return (
    <ScreenshotViewerProvider>
    <div
      /* `--chat-w` is the third region's width, and CSS owns it: the report's
         inset is computed from the same value in the same pass, so a resize can
         never leave the column and the report a frame out of step. It is zero
         below `wide`, where the chat has no column and the composer is the
         fixed bar it has always been. */
      // Below `wide`, the rail's width kept clear at the right: the rail stays,
      // and the panel opens over the report from it.
      ref={rootRef}
      className="core-theme min-h-full pr-[49px] wide:h-screen wide:overflow-hidden wide:pr-0 [--chat-w:0px] wide:[--chat-w:400px] desk:[--chat-w:460px]"
      style={
        {
          '--panel-w': `${PANEL_W}px`,
          // The report's inset from the right: the open column where it docks,
          // else the rail alone (the panel lies over the report).
          '--report-inset': docked ? 'var(--chat-w)' : '49px',
          ...(columnOpen ? {} : { '--chat-w': RAIL_W }),
          // The column's own width (400, 460 from `desk`), not half the window:
          // half crowded the report out of docking on any ordinary screen. A
          // width the reader has dragged wins — they have said what they want.
          ...(columnOpen && chatW !== null ? { '--chat-w': `${chatW}px` } : {})
        } as React.CSSProperties
      }
    >
      {/* Below `wide` the report is the page: the canvas grey edge to edge,
          under its own header band, no gutter and no outer card — the cards
          are inside it. It used to float as one card 24px in from the window
          with 48 more inside, so a 660px window put its prose 72px from either
          edge — most of the screen was margin. The composer's clearance lives
          on the scroller now, so the ground is continuous under the report. */}
      {/* Three regions, each fixed to the window, each with a variable the
          others read: the nav rail (`--nav-w`, set by Shell), the chat
          (`--chat-w`, on the root above), and the report, which takes what is
          left. Nothing in the middle column has to know the other two exist. */}
      <div className="min-h-screen bg-surface-canvas wide:flex wide:h-screen wide:flex-col wide:bg-transparent wide:pb-6">



        {/*
          * Nothing about the business is printed here.
          *
          * The name and the entity line are in the fixed bar above, which is on
          * screen at every scroll position; what the business does leads the
          * report, under its own heading. Saying any of it a second time put
          * the same fact on one screen twice, 200px apart.
          */}
        {/*
          * Two columns: the assessment, and the record it was written from.
          *
          * They were tabs, which meant checking an insight lost your place in the
          * report and reading the report hid the evidence. Side by side they are
          * what they always were — an argument and its sources.
          */}

        {/*
          * The document: its description, its contents and its prose, on one
          * surface.
          *
          * These were three unrelated elements that happened to line up: a
          * fixed `aria-hidden` div painting the white, a separately fixed rail
          * carrying an inline `left`, and a report placed by padding on the
          * page container. The rail's left edge, the report's left edge and the
          * white's right edge were three numbers agreeing by coincidence, so
          * every layout change knocked one of them out of line with the other
          * two. One element holds all three now, and it IS the white.
          *
          * It starts at the top of the window: the page's own header is the
          * band at the head of this column, not a bar fixed across the page.
          */}
        <div className="contents wide:fixed wide:left-[var(--nav-w)] wide:top-0 wide:bottom-0 wide:right-[calc(var(--panel-w)_+_var(--report-inset))] wide:z-0 wide:flex wide:justify-center wide:bg-surface-canvas">
        {/* The report region, edge to edge of the white.
            It used to be the measure itself — `basis-[800px] max-w-[1000px]`,
            centred by the wrapper — which meant the tab bar's rule stopped
            where the prose stopped, with white either side of it. The rule
            belongs to the region and the measure belongs to the text, so the
            region spans and each band inside it centres its own `MEASURE`. */}
        <div className="min-w-0 wide:flex wide:min-h-0 wide:w-full wide:flex-col">
          {/*
            * The report scrolls itself.
            *
            * It used to scroll the document, which put a window-edge scrollbar
            * 24px from the panel's own — two vertical bars side by side, for two
            * regions that move independently. One scroller per column, each
            * ending where its column ends, and the window does not scroll at
            * all. `pb-40` is the composer's clearance, now inside the thing the
            * composer sits over.
            */}
          {/*
            * The report's own tabs.
            *
            * The assessment and the insights, attributes and sources it read
            * are one thing — a report — and they used to be two columns that
            * did not know about each other. They are faces of the same document
            * now, switched from its head, with the report they belong to named
            * beside them.
            */}
          <TabsRoot
            value="assessment"
            className="flex min-h-0 flex-col wide:flex-1"
          >

            {/*
              * The report scrolls itself, under its own tabs.
              *
              * The tail was 160px of clearance for a composer that floated over
              * this column. The composer is in the chat column now, so what is
              * left is ordinary breathing room at the end of a document.
              * Below `wide` the composer is still fixed over the page, and
              * `pb-56` is what clears it: `pb-40` was shorter than the dock once
              * it carried a token row, so the last paragraph sat behind it and
              * could not be scrolled to.
              */}
            <div
              ref={panelRef}
              className="relative z-10 min-w-0 bg-surface-canvas pb-56 pt-0 wide:pt-[54px] wide:min-h-0 wide:flex-1 wide:bg-transparent wide:pb-12 wide:overflow-y-auto panel-scroll [overflow-anchor:none]"
            >
              <div className={MEASURE}>
                {/* One report column: the determination opens it at every
                    width, rather than pinned in a rail beside it. On a phone
                    the card takes its stacked lock-up on its own (`NARROW_AT`
                    in `DeterminationCard`). */}
                <div className="flex">
                  {/*
                    * The list column, in the margin.
                    *
                    * At `desk` the pane's measure leaves room beside it, so the
                    * tab's list sits there and stays put while the pane
                    * scrolls — a reader picks the next grouping while reading,
                    * so the list belongs beside the reading. Below `desk` there
                    * is no margin and the same column sits in the flow above
                    * the pane: a narrow window loses the pinning, not the list.
                    */}
                  <div className="min-w-0 flex-1">
                    {/* The tab's content, straight on the canvas. It sat in a
                        framed pane with a crumb head, and everything inside it
                        was already a card — a card in a card, with a crumb
                        repeating what the column's selected row and the card's
                        own title already said. */}
                    <div>
              <TabsContent value="assessment" className="mt-0">
            {/*
              * No report, where the report goes.
              *
              * The three tabs each say this too, but a reader looking at the
              * document itself was getting a name, a paragraph and then 600px
              * of nothing — a page that reads as broken rather than as one
              * nobody has assessed yet. The action is the same run the composer
              * sends, put where the absence is.
              */}
            {!view && !running && (
              <EmptyState
                className="mt-10"
                title="No report yet"
                description={`Nobody has assessed ${displayName(selected.name)} yet. Running ${standing?.name ?? 'the assessment'} reads the record and writes the report, with the insights, attributes and sources it read kept alongside it.`}
                actionLabel={standing ? `Run ${standing.name}` : undefined}
                onAction={standing ? runStanding : undefined}
              />
            )}
            {/* The report's head: the business, the assessment it was run under,
                the call and the score. The one place the recommendation is
                acted on. */}
            {/* With no report there is no hero, so the crumb, the name and the
                assignee head the page on their own. */}
            {/* The head sticks: at the scroller's true top from \`wide\` (its
                54px padding lifted, as the filter bar's is), on the canvas so
                the cards pass under it. */}
            {/* The business at the top, as on its overview: the crumb, the
                name, the reviewer's status and the facts of its identity. */}
            {/* The business's profile, pinned as the report scrolls under it —
                the same band as on its overview, Run assessment included. */}
            {/* At `wide` the report scrolls inside its own column, which pads
                its top by 54px; the band pins at the column's true top by
                lifting that padding, as the report's old head did. */}
            <div ref={headRef} className="sticky top-0 z-[5] wide:top-[-54px]">
              <IdentityHeader
                record={selected}
                defaultStatus={determined}
                assessment={scope.name}
                onOpenTimeline={() => navigate(`/businesses/${selected.id}/timeline`)}
                onOpenActivity={() => navigate(`/businesses/${selected.id}/activity`)}
                onRunAssessment={() =>
                  navigate('/order', {
                    state: { businessId: selected.id, origin: location.pathname }
                  })
                }
              />
            </div>
            {/* One column under the head: the assessment, then the report's cards. */}
            <div className={cn('pt-8', hero && 'flex items-start gap-4')}>
              {/* No gap on the column itself: the report's first child is its
                  zero-height sticky bar, and a gap there pushed the first card
                  16px below the score card's top. The brief spaces itself. */}
              {/* Full height (self-stretch), the report's column. */}
              <div className="min-w-0 flex-1 self-stretch">
              {/* The assessment, over the report: its name and call, what it found,
                  the way to run it — across the column, above Business details. */}
              {hero && !assessment && (
                // Nothing of this assessment could be read yet — its orders are
                // still running.
                <section aria-label="Assessment" className="mb-4">
                  <div className="rounded-card border border-border bg-card" style={{ viewTransitionName: assessmentTransitionName(scope.id) }}>
                    <div className="flex flex-col gap-1 px-4 py-4">
                      <h2 className="m-0 text-base font-semibold">{scope.name}</h2>
                      <p className="m-0 text-[var(--core-color-text-secondary)]">
                        {scopedRead?.ordering ? 'Results are still coming in.' : 'No insights came back for this assessment.'}
                      </p>
                    </div>
                  </div>
                </section>
              )}
              {/* The summary is the Assistant's opening line now, floating over
                  its bubble (`SummaryBubble`), not a card in the report. */}
              {/* Narrowed to an area, its assessment first, then the cards it was read from. */}
              {hero && brief && briefShown && (
                <div className="mb-4">
                <AssessmentBrief
                  brief={brief}
                  cards={briefShown.cards}
                  title={briefShown.title}
                  // The area's answer, in one paragraph.
                  prose={shownArea ? areaBrief(shownArea, record, summaries) : undefined}
                  results={results}
                  record={record}
                  // Nothing open in the area: it meets the policy, and says so.
                  satisfied={Boolean(shownArea) && (groups.find((g) => g.id === shownArea)?.steps.length ?? 0) === 0}
                  // The area's first open step: the Assistant walks on from it.
                  onRecommend={
                    shownArea && (groups.find((g) => g.id === shownArea)?.steps.length ?? 0) > 0
                      ? () => {
                          const group = groups.find((g) => g.id === shownArea)!
                          showPanel('assistant')
                          setRecommendRequest((cur) => ({ area: group.label, index: group.steps[0].index, request: (cur?.request ?? 0) + 1 }))
                        }
                      : undefined
                  }
                />
                </div>
              )}
              <GroupedReport
                documents={retrieved}
                record={record}
                results={shownResults}
                groupFor={groupFor}
                negatives={negatives}
                revealed={revealedSet}
                only={
                  focus
                    ? new Set(focus.cards.filter((c) => !workflowCards || workflowCards.has(c)))
                    : workflowCards
                }
                // Narrowed, the report says so — what it is narrowed to and the
                // way back — so a reader never takes a part for the whole.
                focus={focus ? { id: focus.id, name: focus.title, onClear: () => setFocus(null) } : undefined}
                // The insights are listed in the left card, grouped by card,
                // so the cards carry none of their own.
                hideInsights
                pinned={pinned}
                expand={expandCard}
                view={reportView}
                tinActions={tinActions}
                onJumpToSource={jumpToSource}
                onJumpToTimeline={jumpToTimeline}
              />
              </div>
            </div>

              </TabsContent>

                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsRoot>
        </div>
        </div>
      </div>

      <AssessmentEditor
        open={agentOpen !== null}
        startOn={agentOpen ?? 'list'}
        onClose={() => setAgentOpen(null)}
        skills={agent.skills}
        workflow={standing}
        onRenameWorkflow={(id, name) => {
          const w = agent.skills.find((x) => x.id === id)
          if (w) void agent.updateSkill(id, name, w.instructions)
        }}
        onCreateSkill={(name, instructions) => void agent.createSkill(name, instructions)}
        onUpdateSkill={(id, name, instructions) => void agent.updateSkill(id, name, instructions)}
        onDeleteSkill={(id) => void agent.deleteSkill(id)}
      />

      {/*
        * The chat's own column, down the right-hand side.
        *
        * The report reads left, where the nav rail already anchors the page and
        * the eye starts; the conversation sits beside it at the outer edge,
        * which is also where the old reference panel was docked and where
        * `--panel-w` still reserves for it.
        *
        * `contents` below `wide`: the aside stops being a box, the composer
        * inside it is `fixed` on its own, and the narrow page is exactly what it
        * has always been. It is also why the composer is placed by CSS rather
        * than mounted conditionally — crossing the breakpoint must not throw
        * away what someone has typed.
        *
        * No `z-index`. The column sits under the nav rail so an unpinned rail
        * still hover-expands over it, the way the header already does.
        */}
      <aside
        aria-label="Analysis conversation"
        // Fixed at the right edge: the rail, and the panel beside it when open.
        // Where the report still fits beside it (`docked`), the report is inset
        // by the whole column; where it would not, by the rail alone, and the
        // panel lies over it.
        className="fixed bottom-0 right-0 top-0 z-30 flex flex-row wide:w-[var(--chat-w)]"
      >
        {/* The seam is a handle. It is inside the column so it moves with it,
            and it is the column's own left edge — the one the report is on the
            other side of. */}
        {isWide && columnOpen && (
          <ColumnResizer
            width={chatW ?? (window.innerWidth >= 1504 ? 460 : 400)}
            onResize={setChatW}
            onReset={() => setChatW(null)}
          />
        )}

        {/* The assistant: the column itself when docked, a window over the
            report when floating, the pill when minimised. A sibling of the
            other views' box rather than inside it, because that box is
            `hidden` when the column is put away — and the pill has to stay on
            screen precisely then. Its own width and height are forced to the
            column's, since the column is already sized by `--chat-w` and the
            seam above; the kit's own rail width would fight it. */}
        {/* The business summed up, as the Assistant's opening line: just above
            its bubble while it is collapsed, until put away. */}
        {/* Off for now (Sara): the floating bubble, its summary and its
            "Review assessment summary". The Assistant opens from the rail. */}
        {SHOW_ASSISTANT_BUBBLE && hero && assessment && assistantState === 'pill' && (!summaryDismissed || bubbleNotice?.kind === 'reply' || bubbleNotice?.kind === 'working') && (
          // Beside the rail's Assistant bubble, its foot level with it.
          <div className="fixed bottom-4 right-[61px] z-floating w-[22.5rem] max-w-[calc(100vw-5rem)]">
            <SummaryBubble
              decided={decisionLine}
              notice={bubbleNotice}
              onAsk={(question) => {
                // Opens the Assistant as its floating window, beside the
                // report, and carries the question on there.
                setAssistantPresentationRaw('floating')
                setAssistantStateRaw('window')
                // The summary goes with it, as the thread's first message.
                if (panelRead) setOpener((cur) => cur ?? { text: panelRead, at: new Date().toISOString() })
                if (question.trim()) setAskRequest((cur) => ({ text: question, n: (cur?.n ?? 0) + 1 }))
              }}
              onDismiss={() => setSummaryDismissed(true)}
              summary={panelRead || undefined}
              writing={scoped ? summaryRuns.isRunning(scope.id) : running}
            />
          </div>
        )}
        <AssistantPanel
          askRequest={askRequest}
          opener={opener}
          record={record}
          results={results}
          groupFor={groupFor}
          analysis={analysis}
          custom={agent.skills.filter((x) => !(agent.disabled ?? []).includes(x.id))}
          disabled={agent.disabled ?? []}
          policy={policy}
          state={assistantState}
          presentation={assistantPresentation}
          canDock={false}
          onStateChange={(next) => {
            setAssistantState(next)
          }}
          onPresentationChange={setAssistantPresentation}
          onJumpToGroup={jumpToCard}
          brief={brief}
          focus={focus}
          onFocusAssessment={focusAssessment}
          revision={revision}
          assessmentInHeader
          reviewStepsRequest={reviewStepsRequest}
          reviewStepIndex={reviewStepIndex}
          summaryRequest={summaryRequest}
          briefGenerated={generated.has(selected.id)}
          recommendRequest={recommendRequest}
          // The assessment's read and its next steps, opened from the panel.
          assessmentTurn={
            <NextStepsTurn
              // The fuller picture first: the sectioned brief — for an
              // assessment, its read and only its own cards' sections.
              assessment={
                assessmentBrief && (
                  <BriefTurn
                    at={scopedRead?.summary?.at || analysis.selected?.at || new Date().toISOString()}
                    brief={assessmentBrief}
                    focus={focus}
                    groupFor={groupFor}
                    onFocusAssessment={focusAssessment}
                    onJumpToCard={(anchor) =>
                      panelRef.current
                        ?.querySelector<HTMLElement>(`[id="${anchor}"]`)
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }
                    onJumpToGroup={jumpToCard}
                    record={record}
                    results={results}
                  />
                )
              }
              at={scopedRead?.summary?.at || analysis.selected?.at || new Date().toISOString()}
              businessName={displayName(selected.name)}
              onRequest={requestStep}
              onRun={runStep}
              onUpload={(step, files) => void uploadStep(step, files)}
              onViewResults={(step) =>
                step.kind === 'expand' && step.adds?.length ? jumpToCard(cardFor(step.adds[0], groupFor)) : landOn('documents')
              }
              read={panelRead}
              record={stepRecord}
              running={runningStep}
              steps={nextSteps}
              title={scope.name}
            />
          }
          // A brief card's title: the report scrolls to that card.
          onJumpToCard={(anchor) =>
            panelRef.current
              ?.querySelector<HTMLElement>(`[id="${anchor}"]`)
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        />

        {/* The panel. White, and the report beyond it is the canvas grey: the
            report is a run of white cards now — the call, the formation grid,
            the insight stacks — and cards want a ground to sit on, while the
            conversation is one continuous surface that reads best as paper.
            It was the other way round while the report was a single white
            sheet.

            `hidden` rather than unmounted when the panel is put away, and
            `contents` below `wide` where there is no column at all — either way
            the composer inside it is never thrown away, so what someone has
            half-typed survives both. */}
        <div className={panelClass}>
            {chatOpen && panelView !== 'assistant' && (
            <ChatPanelHeader
              view={panelView}
              views={railViews}
              // Order another assessment on this business, from the panel that lists them.
              action={
                panelView === 'insights' ? (
                  <ActionButton
                    leadingIcon={<Plus aria-hidden="true" size={14} strokeWidth={1.75} />}
                    onClick={() =>
                      navigate('/order', {
                        state: { businessId: selected.id, origin: location.pathname }
                      })
                    }
                    size="compact"
                    variant="secondary"
                  >
                    Add assessment
                  </ActionButton>
                ) : undefined
              }
            />
            )}

            {panelView === 'timeline' && (
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 panel-scroll">
                <Timeline
                  businessId={selected.id}
                  focus={timelineFocus}
                  onOpenFiling={(f) => {
                    // The filing's Secretary of State card in Sources: same state, and
                    // the same number once a letter prefix is set aside ("C64323091"
                    // on the timeline is "64323091" on the filing); else the state's
                    // only filing.
                    const digits = (n?: string | null) => (n ?? '').replace(/^[A-Za-z]+/, '').replace(/[^0-9A-Za-z]/g, '')
                    const inState = scopeSources.filter((x) => x.registration && x.registration.state === f.state)
                    const src =
                      inState.find((x) => digits(x.registration!.fileNumber) === digits(f.fileNumber)) ??
                      (inState.length === 1 ? inState[0] : undefined)
                    if (!src) return
                    showPanel(viewOfSource(src))
                    jumpToSourceCard(src.id)
                  }}
                />
              </div>
            )}

            {/* The assessment's evidence, beside the assessment: the insights
                it read, grouped; the attributes behind them; the sources they
                came from. */}
            {panelView === 'insights' && (
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 panel-scroll">
                {/* The report's insights: which way they read, the bar, the
                    insights by report card — each narrowing the report. */}
                <InsightsFilterCard filter={insightFilter} groups={panelGroupsShown} onChange={applyInsightFilter} onChip={followChip} />
              </div>
            )}

            {/* Its alerts and what has happened to it here, as one: monitoring
                to opt into first, then the activity. */}
            {panelView === 'activity' && (
              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4 panel-scroll">
                <AlertsCard titled={false} />
                <ActivityTab
                  // Each assessment completed as its workflow did — the run, where the
                  // workflow keeps no completion of its own.
                  assessed={(scope.completedAt ?? ran) ? panelGroups.map((g) => ({ label: g.label, at: (scope.completedAt ?? ran)! })) : []}
                  dense
                  record={selected}
                  reads={reads}
                />
              </div>
            )}
            {panelView === 'alerts' && (
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 panel-scroll">
                <AlertsCard titled={false} />
              </div>
            )}

            {/* Every source, or one kind of them: its cards, and — all of
                them — the summary over them. What the customer submitted
                leads wherever it belongs. */}
            {(panelView === 'sources' || panelView.startsWith('sources:')) && (
              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4 panel-scroll">
                {scopeSubmitted && (panelView === 'sources' || viewOfSource(scopeSubmitted) === panelView) && (
                  <SourceDetail source={scopeSubmitted} record={scopeRecord} focused={sourceFocus === scopeSubmitted.id} />
                )}
                {panelView === 'sources' && (
                  <SourcesSummary sources={scopeOrderedSources} record={scopeRecord} onJump={jumpToSourceCard} />
                )}
                {panelSources(panelView).map((src) =>
                  // In its own kind, each third-party profile is a source of its own.
                  panelView === 'sources:web' && appTypeOf(src) === 'profiles' ? (
                    <ProfileSourceCards key={src.id} record={scopeRecord} />
                  ) : (
                    <SourceDetail
                      key={src.id}
                      source={src}
                      record={scopeRecord}
                      focused={sourceFocus === src.id}
                      onShowTimeline={filingTimeline(src)}
                    />
                  )
                )}
              </div>
            )}

        </div>

        {/* The rail, always, at every width. Putting the panel away leaves the
            list of what it could show rather than a bare edge. */}
        {(
          <ChatRail
            views={railViews}
            // The Assistant's way in: its bubble at the rail's foot, opening
            // it as it was last left, or minimizing it again.
            assistantOpen={assistantState !== 'pill'}
            onAssistant={() => setAssistantState(assistantState === 'pill' ? readAssistantState() : 'pill')}
            open={columnOpen}
            onHide={() => {
              if (panelView === 'assistant') setAssistantState('pill')
              else setChatOpen(false)
            }}
            view={panelView}
            onOpen={(v) => {
              // Picking the view you are already on puts the column away, the
              // way a nav rail's current entry does nothing but this one has
              // somewhere to go. The assistant's entry docks it: the rail is
              // the column's, and a floating window is not in the column.
              if (columnOpen && v === panelView) {
                if (v === 'assistant') setAssistantState('pill')
                else setChatOpen(false)
                return
              }
              setPanelView(v)
              if (v === 'assistant') {
                setAssistantPresentation('docked')
                setAssistantState('window')
              } else setChatOpen(true)
            }}
          />
        )}
      </aside>
    </div>
    </ScreenshotViewerProvider>
  )
}
