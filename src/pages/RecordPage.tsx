import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Navigate, useNavigate, useParams } from 'react-router'

import {
  EmptyState,
  IconActionButton,
  MutedText,
  PageHeader,
  PageHeaderBand,
  PageHeaderActions,
  PageHeading,
  TabsContent,
  TabsRoot,
  type FloatingPanelPresentation,
  type FloatingPanelState
} from '@/core'

import { areasOf, identityScore, negativesFor, type AssessmentWeight } from '../lib/identityScore'
import { AssistantPanel } from '../components/Assistant/AssistantPanel'
import { ColumnResizer } from '../components/ColumnResizer'
import { Timeline } from '../components/Timeline'
import type { Kind } from '../lib/timeline/types'
import { ChatPanelHeader, ChatRail, type PanelView } from '../components/ChatPanelHeader'
import { useWide } from '../hooks/useWide'
import { InsightStack } from '../components/InsightStack'

import { AssigneeDropdown } from '../components/BusinessStatusBar/AssigneeDropdown'
import { StatusDropdown } from '../components/BusinessStatusBar/StatusDropdown'
import { statusForBand, useReview } from '../lib/review'
import { changedInsights } from '../lib/diff'
import { reportLabel, reportStamp } from '../lib/reportLabels'
import { GroupedReport } from '../components/Report/GroupedReport'
import { ReportHero } from '../components/Report/ReportHero'
import { cardAnchor } from '../lib/reportCards'
import type { BriefCard, ReportFocus } from '../lib/reportBrief'
import { ScreenshotViewerProvider } from '../components/ScreenshotViewer'
import { SourceDetail, SourcesSummary, appOrderedSources, sourcesFor } from '../components/SourcesTab'
import { SUBMITTED_CARD } from '../lib/sourceCards'
import { CardLabel } from '../components/CardLabel'
import { InsightRow } from '../components/InsightRow'
import { categoriesOf, deriveResults, type BusinessRecord, type Derived } from '../lib/deriveResults'
import { areaSummaries } from '../lib/areaSummaries'
import { byId } from '../lib/records'
import { GROUPS, makeGroupFor } from '../lib/groups'
import { useAnalysis } from '../lib/useAnalysis'
import { AssessmentEditor } from '../components/AssessmentEditor'
import { composeAssessment } from '../lib/library'
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
 * 992 leaves the report 896px (56rem) of content at `wide`, less the 48 either
 * side: one column now — the determination, the Formation card, the
 * assessment cards — with no rail or reports panel beside it, so the 1200 it
 * was ran the two-column grids and the prose long. Core's widths either side
 * are 768 (`narrow`) and 1200.
 */

const MEASURE = 'mx-auto w-full max-w-[992px] px-6 wide:px-12'

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
  const { businessId } = useParams()
  const selected = byId(businessId)

  // An id that isn't one of the ingested records: back to the list rather than
  // a half-rendered screen.
  if (!selected) return <Navigate replace to='/businesses' />

  return <Record key={selected.id} record={selected} />
}

/**
 * One business, one assessment.
 *
 * The page is the business's newest assessment: the report under the
 * Assessment tab, and the insights, attributes and sources that run read
 * under the other three. A business used to list several runs with a page
 * each; that has been set aside, see `heldReports.ts`.
 */
function Record({ record: selected }: { record: BusinessRecord }) {
  const navigate = useNavigate()
  /** What the business is now. What a new report is run against. */
  const live = useMemo(() => deriveResults(selected), [selected])

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
  const view = analysis.selected
    ? (analysis.selected.snapshot ?? { recordId: selected.id, record: selected, results: live })
    : null
  const record = view?.record ?? selected
  const results: Derived[] = view?.results ?? []

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
  const determined = statusForBand(score?.band.id)
  const review = useReview(selected.id, determined)

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
  const [chatOpen, setChatOpen] = useState(false)

  /** What the right-hand column is showing. The picker in its own header, and
   *  the rail it collapses to, both set this. */
  const [panelView, setPanelView] = useState<PanelView>('assistant')

  /**
   * The assistant's own state: pill, window or expanded, docked or floating.
   *
   * Docked, it IS the right-hand column and its state decides whether the
   * column is open. Floating, it is a window over the report and the column
   * is put away to the rail. Below `wide` there is no column to dock into, so
   * the preference is remembered and not honoured: the window floats.
   */
  const [assistantState, setAssistantStateRaw] = useState<FloatingPanelState>(readAssistantState)
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
  const assistantPresentation: FloatingPanelPresentation =
    isWide && assistantPreference === 'docked' ? 'docked' : 'floating'
  const assistantDocked = assistantPresentation === 'docked' && assistantState !== 'pill'

  /**
   * Whether the column has something in it.
   *
   * On the assistant it is the docked panel's own state; on the other four
   * views it is the flag the rail toggles. One answer for the layout below,
   * which sizes the column and insets the report from it.
   */
  const columnOpen = panelView === 'assistant' ? assistantDocked : chatOpen

  /**
   * Written out rather than composed from `wide:` variants.
   *
   * The three states are `display: contents`, `display: flex` and
   * `display: none`, and Tailwind resolves two utilities setting one property
   * by stylesheet order rather than by the order they are written — so
   * `contents wide:hidden` is a coin toss. One string, one display.
   */
  const panelClass = !isWide
    ? 'contents'
    : chatOpen && panelView !== 'assistant'
      ? 'flex min-w-0 flex-1 flex-col border-l border-solid border-border bg-card'
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
  /** A report on screen, so its hero heads the page. */
  const hero = Boolean(view && brief)
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
  /**
   * What has moved since the open report was written.
   *
   * Reading a report's snapshot, a reviewer needs to know whether the record
   * still says what the report read. Empty when the report has no snapshot,
   * or when nothing has changed.
   */
  const changedSince = useMemo(
    () => (view && analysis.selected?.snapshot ? changedInsights(results, live) : []),
    [view, analysis.selected?.snapshot, results, live]
  )
  const scopeSources = useMemo(
    () => sourcesFor(scopeRecord, scopeResults, scopeGroupFor),
    [scopeRecord, scopeResults, scopeGroupFor]
  )
  // The app's Sources tab, with the prototype's Submitted card kept at its head.
  const scopeSubmitted = useMemo(() => scopeSources.find((s) => s.id === SUBMITTED_CARD), [scopeSources])
  const scopeOrderedSources = useMemo(() => appOrderedSources(scopeSources, scopeRecord), [scopeSources, scopeRecord])

  /** What moved since the report, said once at the head of an evidence panel. */
  const drift =
    changedSince.length > 0 ? (
      <MutedText className="block text-caption">
        {changedSince.length} {changedSince.length === 1 ? 'insight has' : 'insights have'} changed in the current
        identity since this report
      </MutedText>
    ) : null

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

  /** Open the right-hand panel on one of its views. */
  const showPanel = (view: PanelView) => {
    setPanelView(view)
    if (view === 'assistant') {
      if (assistantState === 'pill') setAssistantState('window')
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
  const focusAssessment = (c: BriefCard) =>
    setFocus((cur) => (cur?.id === c.id ? null : { id: c.id, title: c.title, sentence: c.sentence, cards: c.cards }))
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
  const jumpToCard = (cardId: string) => {
    if (!focus || focus.cards.includes(cardId) || focus.cards.some((c) => c.startsWith(`${cardId}-`))) return landOn(cardId)
    pendingCard.current = cardId
    setFocus(null)
  }
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

  /** Open the timeline on one change and mark it. */
  const [timelineFocus, setTimelineFocus] = useState<{ eventId: string; kinds?: Kind[]; n: number }>()
  const jumpToTimeline = (eventId: string, kinds?: Kind[]) => {
    showPanel('timeline')
    setTimelineFocus((f) => ({ eventId, kinds, n: (f?.n ?? 0) + 1 }))
  }

  const jumpToSource = (cardId: string) => {
    const hit = resolveSource(scopeSources, cardId)
    showPanel('sources')
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
      className="core-theme min-h-full wide:h-screen wide:overflow-hidden [--chat-w:0px] wide:[--chat-w:400px] desk:[--chat-w:460px]"
      style={
        {
          '--panel-w': `${PANEL_W}px`,
          ...(columnOpen ? {} : { '--chat-w': RAIL_W }),
          // The timeline is a chart with a year axis and a 144px label column:
          // at the assistant's width it is a sparkline with truncated values,
          // so opening it takes the half of the window it needs. A width the
          // reader has dragged wins over both — they have said what they want.
          ...(columnOpen && chatW === null && panelView !== 'assistant' ? { '--chat-w': '50%' } : {}),
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
        <div className="contents wide:fixed wide:left-[var(--nav-w)] wide:top-0 wide:bottom-0 wide:right-[calc(var(--panel-w)_+_var(--chat-w))] wide:z-0 wide:flex wide:justify-center wide:bg-surface-canvas">
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
              * The page header, the dashboard's pattern: where you came from,
              * what you are looking at, and the faces of it — a band across the
              * head of the column, its rule edge to edge, its content on the
              * report's measure. The tabs are up here, above the scroller, so
              * the report cannot scroll past them; the report they belong to
              * is named at the head of the column below. It replaces a bar fixed across the whole
              * window that carried the name in 14px and left the tabs on a
              * second bar below it.
              *
              * Sticky, for the widths where the page scrolls rather than the
              * column: the report passes under it and the band stays whole
              * across the page. At `wide` the column scrolls inside itself and
              * the band sits above the scroller, so `sticky` is inert there.
              */}
            <PageHeaderBand className="sticky top-0 z-chrome flex h-[49px] shrink-0 items-center border-b border-solid border-border bg-surface-canvas px-0 py-0">
              <PageHeader className={cn(MEASURE, 'w-full gap-2')}>
                {/* A back arrow beside the name, not a breadcrumb: the only
                    place up is the list, and a crumb that named the business
                    over a heading that named it again said it twice. */}
                {/* The arrow hangs in the left margin — 32px button plus the
                    8px gap — so the name starts where the tabs start. The
                    assignee and the status sit in the report's hero; with no
                    report, the assignee stays here. */}
                <div className="-ml-10 flex min-w-0 items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-2">
                    {/* A button that navigates, not `asChild` over a Link: the
                        core button renders its icon slots beside the child, so
                        Radix's Slot sees several children and throws. */}
                    <IconActionButton
                      variant="quiet"
                      size="compact"
                      aria-label="All businesses"
                      onClick={() => navigate('/businesses')}
                    >
                      <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.75} />
                    </IconActionButton>
                    <PageHeading size="md" weight="normal">{selected.name}</PageHeading>
                  </div>
                  {/* With a report, the report's hero carries these. */}
                  {!hero && (
                    <PageHeaderActions className="shrink-0">
                      <AssigneeDropdown businessId={selected.id} />
                    </PageHeaderActions>
                  )}
                </div>
              </PageHeader>
            </PageHeaderBand>

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
              className="relative z-10 min-w-0 bg-surface-canvas pb-56 pt-6 wide:min-h-0 wide:flex-1 wide:bg-transparent wide:pb-12 wide:overflow-y-auto panel-scroll"
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
              * No determination card at the head of the report. The call is
              * the status control in the page header and the first thing the
              * Assistant says (its opening message carries the ring, the word
              * and the reason), so the report opens on the record's facts.
              */}
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
                description={`Nobody has assessed ${selected.name} yet. Running ${standing?.name ?? 'the assessment'} reads the record and writes the report, with the insights, attributes and sources it read kept alongside it.`}
                actionLabel={standing ? `Run ${standing.name}` : undefined}
                onAction={standing ? runStanding : undefined}
              />
            )}
            {/* The report's head: the business, the assessment it was run under,
                the call and the score. The one place the recommendation is
                acted on. */}
            {hero && analysis.selected && brief && (
              <div className="mb-8">
                <ReportHero
                  record={record}
                  report={analysis.selected}
                  controls={
                    <>
                      <AssigneeDropdown businessId={selected.id} />
                      <StatusDropdown businessId={selected.id} defaultStatus={determined} />
                    </>
                  }
                />
              </div>
            )}
            {/* The record, by group — the Insights tab's grouping, each with
                its data view and its review tasks. With or without a report:
                these are the record's facts; what the assessment made of
                them is the Assistant's, whose citations land here. */}
            <div className={!view && !running ? 'mt-6' : undefined}>
              <GroupedReport
                record={record}
                results={results}
                groupFor={groupFor}
                negatives={negatives}
                revealed={revealedSet}
                only={focus ? new Set(focus.cards) : undefined}
                focus={focus ? { title: focus.title, sentence: focus.sentence, onClear: () => setFocus(null) } : undefined}
                onJumpToSource={jumpToSource}
                onJumpToTimeline={jumpToTimeline}
              />
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
        className="contents wide:fixed wide:bottom-0 wide:right-0 wide:top-0 wide:flex wide:w-[var(--chat-w)] wide:flex-row"
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
        <AssistantPanel
          className={cn(
            assistantPresentation === 'docked' &&
              (assistantDocked && panelView === 'assistant'
                ? '!static !h-full !w-full min-w-0 flex-1'
                : // Put away, or another view has the column: not a zero-width
                  // rail (its header spilled over the Timeline's) but gone. The
                  // pill is the panel's sibling and stays; the rail's entry
                  // brings the panel back.
                  'hidden')
          )}
          record={record}
          results={results}
          groupFor={groupFor}
          analysis={analysis}
          custom={agent.skills.filter((x) => !(agent.disabled ?? []).includes(x.id))}
          disabled={agent.disabled ?? []}
          policy={policy}
          state={assistantState}
          presentation={assistantPresentation}
          canDock={isWide}
          onStateChange={(next) => {
            setAssistantState(next)
            // Opening it on a column showing another view brings the
            // assistant back to the front of the column.
            if (next !== 'pill') setPanelView('assistant')
          }}
          onPresentationChange={setAssistantPresentation}
          onJumpToGroup={jumpToCard}
          brief={brief}
          focus={focus}
          onFocusAssessment={focusAssessment}
          revision={revision}
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
            {isWide && chatOpen && panelView !== 'assistant' && (
            <ChatPanelHeader view={panelView} />
            )}

            {panelView === 'timeline' && (
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 panel-scroll">
                <Timeline businessId={selected.id} focus={timelineFocus} />
              </div>
            )}

            {/* The assessment's evidence, beside the assessment: the insights
                it read, grouped; the attributes behind them; the sources they
                came from. Each says, first, whether the record has moved since
                the report was written. */}
            {panelView === 'insights' && (
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 panel-scroll">
                {drift}
                {scopeGrouped.map((group) => (
                  <div key={group.id} id={`group-${group.id}`} className="scroll-mt-4">
                    <InsightStack title={group.label}>
                      {group.rows.map((r) => (
                        <InsightRow
                          key={r.insightId}
                          result={r}
                          record={scopeRecord}
                          negative={scopeNegatives.has(r.insightId)}
                          reveal={revealed.includes(r.insightId)}
                          onJumpToSource={jumpToSource}
                        />
                      ))}
                    </InsightStack>
                  </div>
                ))}
              </div>
            )}

            {panelView === 'sources' && (
              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4 panel-scroll">
                {drift}
                {scopeSubmitted && (
                  <SourceDetail source={scopeSubmitted} record={scopeRecord} focused={sourceFocus === scopeSubmitted.id} />
                )}
                <SourcesSummary sources={scopeOrderedSources} record={scopeRecord} onJump={jumpToSourceCard} />
                {scopeOrderedSources.map((src) => (
                  <SourceDetail key={src.id} source={src} record={scopeRecord} focused={sourceFocus === src.id} />
                ))}
              </div>
            )}

        </div>

        {/* The rail, always. Putting the panel away leaves the list of what it
            could show rather than a bare edge. */}
        {isWide && (
          <ChatRail
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
