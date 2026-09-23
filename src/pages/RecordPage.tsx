import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router'

import {
  ActionButton,
  ChatSources,
  EmptyState,
  Heading,
  MetaChip,
  MutedText,
  PageBreadcrumb,
  PageBreadcrumbItem,
  PageHeader,
  PageHeaderBand,
  PageHeading,
  SegmentedControl,
  SegmentedControlItem,
  Surface,
  TabsContent,
  TabsCount,
  TabsList,
  TabsRoot,
  TabsTrigger
} from '@/core'

import { AnalysisDock } from '../components/AnalysisDock'
import { AttributeGroupDetail, attributeGroups, countAttributes } from '../components/AttributesTab'
import { AnalysisPanel } from '../components/AnalysisPanel'
import { AnalysisSources } from '../components/AnalysisSources'
import { areasOf, identityScore, negativesFor, type AssessmentWeight } from '../lib/identityScore'
import { AnalysisChat } from '../components/AnalysisChat'
import { ColumnResizer } from '../components/ColumnResizer'
import { Timeline } from '../components/Timeline'
import { ChatPanelHeader, ChatRail, type PanelView } from '../components/ChatPanelHeader'
import { useWide } from '../hooks/useWide'
import { InsightStack } from '../components/InsightStack'
import { DeterminationCard } from '../components/DeterminationCard'
import { ReportSwitcher } from '../components/ReportSwitcher'
import { reportDate, reportLabel } from '../lib/reportLabels'
import { FormationCard } from '../components/FormationCard'
import { ScreenshotViewerProvider } from '../components/ScreenshotViewer'
import { SourceDetail, sourceSections, sourceSummary, sourcesFor } from '../components/SourcesTab'
import { ListColumn, RowCount } from '../components/ListColumn'
import { CardLabel } from '../components/CardLabel'
import { InsightRow } from '../components/InsightRow'
import { categoriesOf, deriveResults, type BusinessRecord, type Derived } from '../lib/deriveResults'
import { byId } from '../lib/records'
import { GROUPS, type GroupId, makeGroupFor } from '../lib/groups'
import { useAnalysis } from '../lib/useAnalysis'
import { AssessmentEditor } from '../components/AssessmentEditor'
import { composeAssessment } from '../lib/library'
import { cn } from '../utils/twUtils'
import { useAgent } from '../lib/useAgent'

/**
 * What the assessment workflow runs against.
 *
 * The concepts, not the records underneath them. Listing the record's own
 * sources here said the same thing the answer's citations already say, one
 * filing at a time; the workflow is not written against the Delaware
 * registration, it is written against what these three hold.
 */
const CONTEXT = [
  { id: 'context:entities', label: 'Middesk Entities' },
  { id: 'context:jurisdictions', label: 'Middesk Jurisdictions' },
  { id: 'context:industries', label: 'Middesk Industries' }
]

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
 * 1200 is core's `PageContainer` "comfortable" width. It was 1000, set when
 * the report was one column of prose; with the reports panel taking 240 of it
 * and a gutter, 1000 left the report about 730px and a third of the region
 * empty. At 1200 the report gets about 830px — the two-column grids and the
 * insight rows fill without a line running long.
 */
type ReportFace = 'report' | 'insights' | 'attributes' | 'sources'
/** The faces of one report — the report, and its own snapshot of the three. */
const FACES: Array<{ value: ReportFace; label: string }> = [
  { value: 'report', label: 'Report' },
  { value: 'insights', label: 'Insights' },
  { value: 'attributes', label: 'Attributes' },
  { value: 'sources', label: 'Sources' }
]

/** The top-level tabs, as the pane's breadcrumb names them. */
const TAB_LABEL: Record<string, string> = {
  assessment: 'Reports',
  insights: 'Insights',
  attributes: 'Attributes',
  sources: 'Sources'
}

const MEASURE = 'mx-auto w-full max-w-[1200px] px-6 wide:px-12'

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

  return <Record record={selected} />
}

function Record({ record: selected }: { record: BusinessRecord }) {
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
        .map((x) => ({ id: x.id, name: x.name, instructions: x.instructions })),
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

  /**
   * What the report was read from, at the head of the page.
   *
   * It used to sit on the recommendation's heading line, which put it a third
   * of the way down a report it describes the whole of — and a follow-up
   * printed a second copy further down. One roll-up, at the top, naming the
   * latest run's workflow: the skills it was composed from, and the record it
   * was read against. Nothing to say before a run has happened, so it is not
   * rendered then.
   */
  const latestRun = analysis.selected
  // A held report carries no skills, so the workflow the page knows about
  // stands in for it — otherwise a reload loses the name.
  const runSkills = standing?.name ? [standing.name] : []
  const analysedWith = latestRun ? (
    // The roll-up, not a chip: core's own `ChatSources`, which stacks the
    // sources' tiles and opens to the list.
    <ChatSources
      // Opens from its own left edge: hung to the right, the list swung out
      // over the reports panel beside the card.
      align="start"
      label="Processed"
      sources={[
        ...runSkills.map((name) => ({
          id: `skill:${name}`,
          label: name,
          title: name,
          annotation: 'Assessment workflow'
        })),
        {
          id: 'middesk-context',
          label: 'Middesk Context',
          title: 'Middesk Context',
          annotation: 'Industries, entities, jurisdictions, ages...'
        }
      ]}
    />
  ) : null
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
   * Open by default — it is the thing a reviewer acts with, and a report you
   * cannot ask about is a document. Dismissing it gives the whole width back to
   * the report, and the control that dismissed it is what brings it back, in
   * the corner it was dismissed from.
   */
  const [chatOpen, setChatOpen] = useState(true)

  /** What the right-hand column is showing. The picker in its own header, and
   *  the rail it collapses to, both set this. */
  const [panelView, setPanelView] = useState<PanelView>('assistant')

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
    : chatOpen
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
  /**
   * Insights that actually reported.
   *
   * The tab counts these, not every insight evaluated. The list below includes
   * every check the catalog defines so a reader can see what was never answered,
   * but counting those would say a business has 63 insights when half of them
   * are the absence of one.
   */
  const reported = useMemo(() => results.filter((r) => !r.notReported), [results])

  const categories = useMemo(() => categoriesOf(record), [record])
  const groupFor = useMemo(() => makeGroupFor(categories), [categories])
  /**
   * Guarded on the report, not on the row count.
   *
   * `attributeRowsByGroup` seeds a business's licences before it looks at the
   * insight list, so a business with a licence and no report would count
   * attributes it has no report to show them in.
   */
  const attributeCount = useMemo(
    () => (view ? countAttributes(record, results, groupFor) : 0),
    [view, record, results, groupFor]
  )
  const groupOf = (result: (typeof results)[number]) => groupFor(result.insightId)

  /**
   * Found / Not found / All.
   *
   * "Found" is a check that reported anything at all — a result, an unknown, a
   * no-result with a reason. "Not found" is a check the record never mentioned:
   * the catalog says it exists and this business has nothing for it, which is
   * most of the list once every insight is evaluated rather than only the ones
   * that ran.
   */
  /**
   * Still applied, no longer offered.
   *
   * The control that changed it is gone from the panel; the filter itself stays
   * so the tab shows what the record establishes rather than every check that
   * was defined. Kept as state rather than a constant because the value is
   * still a product decision someone may want to move.
   */
  /**
   * A report, named by when it was asked.
   *
   * A date, not "2 days ago": two reports on one business can be months apart,
   * and the question the picker answers is which reading you are looking at,
   * not how recent it is. A report kept before this was recorded has no date to
   * print.
   */
  /**
   * Which report you are reading, and the way to another.
   *
   * On the document beside its tabs, not up in the page chrome: it names the
   * thing the tabs are faces of. Switch it and the assessment and all three
   * lists change together, because they all resolve from it.
   */
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
      analysis.pinned,
      [],
      'report',
      [standing.name],
      '',
      composed.assessments.length > 0 ? composed.assessments : policy
    )
  }

  /** Switching report is landing on a different page: start at the top of it,
   *  with nothing revealed from the one before. */
  const selectReport = (id: string) => {
    analysis.select(id)
    setRevealed([])
    panelRef.current?.scrollTo({ top: 0 })
  }

  /** A row on the reports panel: read that report, here. */
  const openReport = (id: string) => selectReport(id)


  /**
   * What the tabs say when there is no report.
   *
   * These are a report's insights, attributes and sources, so without one there
   * is nothing to show — not an empty record, an unassessed one. Guarded on the
   * report rather than on a row count: `attributeRowsByGroup` seeds a
   * business's licences before it reads the insight list, so counting rows
   * would have put attributes under a business nobody has assessed.
   */
  const nothingYet = (what: string) => (
    <EmptyState
      title="No report yet"
      description={`Run the assessment to see the ${what} it read.`}
    />
  )

  const [filter] = useState<'all' | 'found' | 'not_found'>('found')

  const visible = useMemo(
    () =>
      filter === 'all'
        ? results
        : results.filter((r) => (filter === 'found' ? !r.notReported : r.notReported)),
    [results, filter]
  )

  /** The open report's insights, by grouping: what its Insights face shows. */
  const grouped = useMemo(
    () =>
      GROUPS.map((g) => ({
        ...g,
        rows: visible.filter((r) => groupOf(r) === g.id)
      })).filter((g) => g.rows.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visible, groupFor]
  )
  /** The open report's attributes, by grouping: what its Attributes face shows. */
  const snapshotAttributeGroups = useMemo(
    () => (view ? attributeGroups(record, results, groupFor) : []),
    [view, record, results, groupFor]
  )

  /*
   * The business identity, live.
   *
   * A report is a snapshot: it carries its own copy of the insights,
   * attributes and sources it read, and its faces show that copy. The
   * top-level Insights, Attributes and Sources tabs are not a report's —
   * they are the identity's, read from the record as it is now, whichever
   * report is open. Same groupings, same cells, different moment.
   */
  const liveGroupFor = useMemo(() => makeGroupFor(categoriesOf(selected)), [selected])
  const liveGrouped = useMemo(
    () =>
      GROUPS.map((g) => ({
        ...g,
        rows: live.filter((r) => !r.notReported && liveGroupFor(r.insightId) === g.id)
      })).filter((g) => g.rows.length > 0),
    [live, liveGroupFor]
  )
  const liveInsightCount = useMemo(() => live.filter((r) => !r.notReported).length, [live])
  const liveAttributeGroups = useMemo(
    () => attributeGroups(selected, live, liveGroupFor),
    [selected, live, liveGroupFor]
  )
  const liveAttributeCount = useMemo(
    () => countAttributes(selected, live, liveGroupFor),
    [selected, live, liveGroupFor]
  )
  const liveSources = useMemo(() => sourcesFor(selected, live, liveGroupFor), [selected, live, liveGroupFor])
  const liveSourceBands = useMemo(() => sourceSections(liveSources), [liveSources])

  /** What each live tab's column has picked. Unset falls to the first. */
  const [insightGroup, setInsightGroup] = useState<GroupId | null>(null)
  const [attributeGroup, setAttributeGroup] = useState<GroupId | null>(null)
  const [sourceId, setSourceId] = useState<string | null>(null)
  const openInsightGroup = liveGrouped.find((g) => g.id === insightGroup) ?? liveGrouped[0]
  const openAttributeGroup =
    liveAttributeGroups.find((g) => g.id === attributeGroup) ?? liveAttributeGroups[0]
  const openSource = liveSources.find((s) => s.id === sourceId) ?? liveSources[0]

  /**
   * Which face of the open report the pane shows: the report itself, or its
   * own snapshot of the insights, attributes or sources. Back to the report
   * when another report opens.
   */
  const [reportFace, setReportFace] = useState<ReportFace>('report')
  useEffect(() => {
    setReportFace('report')
  }, [analysis.selected?.id])
  const [dockOpen, setDockOpen] = useState(true)
  const [revealed, setRevealed] = useState<string[]>([])
  /**
   * Which face of the report is on screen.
   *
   * The assessment and the three lists are the same object — one report, read
   * four ways — so they are tabs of one document rather than a document with a
   * reference panel bolted to its right. The assessment is what a report is
   * for, so it opens on it.
   */
  const [tab, setTab] = useState('assessment')
  const panelRef = useRef<HTMLDivElement | null>(null)

  /**
   * The assessment tab, which is also the report control.
   *
   * It carries the name of the assessment that produced what you are reading,
   * and the chevron is part of the tab rather than a second control beside it:
   * clicking the tab you are already on opens the other readings. A dropdown
   * across the row named the same thing twice, at a distance from the tab it
   * described.
   */
  const assessmentTrigger = (
    <TabsTrigger
      value="assessment"
      className={cn(
        // Radix's menu writes `data-state="closed"` onto the trigger it shares
        // with the tab, which is the attribute the tab's own active styling
        // keys off — so opening the menu made the tab stop looking selected.
        // Asserted here instead of inferred.
        tab === 'assessment' &&
          'font-semibold !text-[var(--core-color-tab-fg-active)] shadow-[inset_0_-2px_0_0_var(--core-color-tab-indicator)]'
      )}
    >
      Reports
      <TabsCount>{analysis.reports.length}</TabsCount>
    </TabsTrigger>
  )

  /* The Report tab is the report; the list of reports is a tab of its own
     now. The dropdown that used to hang off this trigger listed the runs by
     name and date and said nothing about what each concluded. */
  const assessmentTab = assessmentTrigger

  /**
   * A tab starts at its own top.
   *
   * The column scrolls as a whole, so the scroll position belonged to the panel
   * and not to the tab in it — switching from 1,100px into Insights to Sources,
   * which is shorter than that, landed the reader past the end of it looking at
   * blank space. Each tab is a different list; none of them is 1,100px into
   * another one.
   */
  const showTab = (next: string) => {
    setTab(next)
    panelRef.current?.scrollTo({ top: 0 })
  }

  // Ids the current answer already used — those rows do not offer "add".
  const used = new Set(analysis.active?.result.used ?? [])

  // A citation has to land somewhere: switch to the raw insights, then scroll.
  const recordSources = useMemo(
    () => (view ? sourcesFor(record, results, groupFor) : []),
    [view, record, results, groupFor]
  )
  const sourceCount = recordSources.length

  /**
   * A citation names a category, so following it lands on that category in
   * the report's own Insights face — the snapshot the citation was made
   * against, not the identity as it is now. Every insight the paragraph cited
   * is revealed at once, which is the thing the citation was standing for.
   */
  const reveal = (ids: string[], groupId: string) => {
    setTab('assessment')
    setReportFace('insights')
    setRevealed(ids)
    window.setTimeout(() => {
      // `start`, not `center`: the anchor is a whole group, and centring a
      // 22-row group puts its heading off the top of the pane.
      document
        .getElementById(`group-${groupId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 60)
    window.setTimeout(() => setRevealed([]), 2400)
  }
  const jumpToGroup = (groupId: string, insightIds: string[]) => reveal(insightIds, groupId)

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
  const resolveSource = (sources: typeof liveSources, cardId: string) =>
    sources.find((x) => x.id === cardId) ?? sources.find((x) => x.id.startsWith(cardId))
  /** From inside a report: that report's own copy of the source, in its Sources face. */
  const jumpToSource = (cardId: string) => {
    const hit = resolveSource(recordSources, cardId)
    setTab('assessment')
    setReportFace('sources')
    if (!hit) return
    flashSource(hit.id)
    window.setTimeout(() => {
      document
        .getElementById(`source-${hit.id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 60)
  }
  /** From a live tab: the identity's source, picked in the Sources column. */
  const jumpToLiveSource = (cardId: string) => {
    const hit = resolveSource(liveSources, cardId)
    setTab('sources')
    if (hit) {
      setSourceId(hit.id)
      flashSource(hit.id)
    }
    panelRef.current?.scrollTo({ top: 0 })
  }

  /**
   * The list column, for whichever tab is on: the tab picks the collection,
   * the column lists it, the pane shows what is picked. Rendered twice —
   * pinned beside the pane at `desk`, in the flow above it below — with one
   * of the two hidden, so the choice of where it sits is CSS alone.
   */
  const column = (className: string) => {
    if (tab === 'insights')
      return (
        <ListColumn
          className={className}
          title="Insights"
          count={liveInsightCount}
          sections={[
            {
              key: 'insights',
              items: liveGrouped.map((g) => ({
                id: g.id,
                label: g.label,
                trailing: <RowCount>{g.rows.length}</RowCount>
              }))
            }
          ]}
          selectedId={openInsightGroup?.id}
          onSelect={(id) => {
            setInsightGroup(id as GroupId)
            panelRef.current?.scrollTo({ top: 0 })
          }}
          empty="Nothing on this record reported."
        />
      )
    if (tab === 'attributes')
      return (
        <ListColumn
          className={className}
          title="Attributes"
          count={liveAttributeCount}
          sections={[
            {
              key: 'attributes',
              items: liveAttributeGroups.map((g) => ({
                id: g.id,
                label: g.label,
                trailing: <RowCount>{g.rows.length}</RowCount>
              }))
            }
          ]}
          selectedId={openAttributeGroup?.id}
          onSelect={(id) => {
            setAttributeGroup(id as GroupId)
            panelRef.current?.scrollTo({ top: 0 })
          }}
          empty="No attributes on this record."
        />
      )
    if (tab === 'sources')
      return (
        <ListColumn
          className={className}
          title="Sources"
          count={liveSources.length}
          sections={liveSourceBands.map((band) => ({
            key: band.key,
            label: band.label,
            items: band.items.map((src) => ({
              id: src.id,
              label: src.label,
              sublabel: sourceSummary(src)
            }))
          }))}
          selectedId={openSource?.id}
          onSelect={(id) => {
            setSourceId(id)
            panelRef.current?.scrollTo({ top: 0 })
          }}
          empty="No sources on this record."
        />
      )
    // The Reports tab lists nothing beside the pane: the report's name in the
    // pane's crumb is the switch, so the report has the whole measure.
    return null
  }
  const hasColumn = tab !== 'assessment'

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
          ...(chatOpen ? {} : { '--chat-w': RAIL_W }),
          // The timeline is a chart with a year axis and a 144px label column:
          // at the assistant's width it is a sparkline with truncated values,
          // so opening it takes the half of the window it needs. A width the
          // reader has dragged wins over both — they have said what they want.
          ...(chatOpen && chatW === null && panelView === 'timeline'
            ? { '--chat-w': '50%' }
            : {}),
          ...(chatOpen && chatW !== null ? { '--chat-w': `${chatW}px` } : {})
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
            value={tab}
            onValueChange={showTab}
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
            <PageHeaderBand className="sticky top-0 z-chrome shrink-0 border-b border-solid border-border bg-surface-canvas px-0 pt-4">
              <PageHeader className={cn(MEASURE, 'gap-2')}>
                <PageBreadcrumb>
                  <PageBreadcrumbItem asChild>
                    <Link to="/businesses" className="inline-flex items-center gap-1 no-underline">
                      <ChevronLeft aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={1.5} />
                      All businesses
                    </Link>
                  </PageBreadcrumbItem>
                </PageBreadcrumb>
                <PageHeading weight="normal">{selected.name}</PageHeading>
                <TabsList className="min-w-0 border-0">
                  {assessmentTab}
                  <TabsTrigger value="insights">
                    Insights
                    <TabsCount>{liveInsightCount}</TabsCount>
                  </TabsTrigger>
                  <TabsTrigger value="attributes">
                    Attributes
                    <TabsCount>{liveAttributeCount}</TabsCount>
                  </TabsTrigger>
                  <TabsTrigger value="sources">
                    Sources
                    <TabsCount>{liveSources.length}</TabsCount>
                  </TabsTrigger>
                </TabsList>
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
                <div className="flex desk:gap-6">
                  {/*
                    * The list column, in the margin.
                    *
                    * At `desk` the pane's measure leaves room beside it, so the
                    * tab's list sits there and stays put while the pane
                    * scrolls — a reader picks the next grouping while reading,
                    * so the list belongs beside the reading. Below `desk` there
                    * is no margin and the same column sits in the flow above
                    * the pane: a narrow window loses the pinning, not the list.
                    * The Reports tab has no column — its switch is the report's
                    * own name in the pane's crumb.
                    */}
                  {hasColumn && (
                    <div className="hidden desk:block desk:w-80 desk:shrink-0">
                      {column('sticky top-0')}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    {hasColumn && column('mb-6 desk:hidden')}
                    {/*
                      * The pane. The selected report — whichever face of it the
                      * tabs have open — inside one frame, headed by where you
                      * are: the business, the report, the face. A file
                      * browser's preview pane; the list on the left is what
                      * you pick from, this is what you picked.
                      */}
                    <Surface variant="card" padding="none" className="overflow-hidden">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--core-color-border-divider)] px-4 py-3">
                        {/* A report's own faces: itself, and its snapshot of the
                            insights, attributes and sources it read. The
                            identity's live copies are the tabs above. */}
                        {tab === 'assessment' && (view || running) && (
                          <SegmentedControl
                            aria-label="Which face of this report"
                            size="sm"
                            value={reportFace}
                            onValueChange={(v) => setReportFace(v as ReportFace)}
                          >
                            {FACES.map((f) => (
                              <SegmentedControlItem key={f.value} value={f.value}>
                                {f.label}
                              </SegmentedControlItem>
                            ))}
                          </SegmentedControl>
                        )}
                        {/* Where you are, under the business named in the band
                            above — so not the business again. The segments are
                            one flat list so the crumb puts its chevron between
                            every pair. On the Reports tab the report's own
                            segment is the switch: it names the open run and
                            opens onto the others. */}
                        <PageBreadcrumb>
                          {[
                            ...(tab === 'assessment'
                              ? [
                                  running ? (
                                    <PageBreadcrumbItem key="running" current>
                                      {`Running ${analysis.waitingSkills[0] ?? standing?.name ?? 'the assessment'}`}
                                    </PageBreadcrumbItem>
                                  ) : (
                                    <ReportSwitcher
                                      key="report"
                                      reports={analysis.reports}
                                      selectedId={analysis.selected?.id}
                                      record={record}
                                      onOpen={openReport}
                                      onNew={
                                        standing ? { label: standing.name, run: runStanding, running } : undefined
                                      }
                                    />
                                  ),
                                  reportFace !== 'report' && (
                                    <PageBreadcrumbItem key="face" current>
                                      {FACES.find((f) => f.value === reportFace)?.label}
                                    </PageBreadcrumbItem>
                                  )
                                ]
                              : [
                                  <PageBreadcrumbItem key="tab">{TAB_LABEL[tab] ?? tab}</PageBreadcrumbItem>,
                                  <PageBreadcrumbItem key="item" current>
                                    {tab === 'insights'
                                      ? openInsightGroup?.label
                                      : tab === 'attributes'
                                        ? openAttributeGroup?.label
                                        : openSource?.label}
                                  </PageBreadcrumbItem>
                                ])
                          ]}
                        </PageBreadcrumb>
                      </div>
                      <div className="p-4">
              <TabsContent value="assessment">
              {reportFace === 'report' && (
              <>
            {/*
              * The call opens the report, at every width.
              *
              * The name and the paragraph about the business used to open it —
              * the name is on the fixed bar above, and the paragraph described
              * a business the report is about to assess. What a reader opens
              * the record for is the decision, so the decision is first.
              */}
            {(view || running) && (
              <DeterminationCard
                score={score}
                running={running}
                trailing={
                  /* What the run was processed with, and what it read: the
                     two roll-ups side by side. "Insights used" sat at the foot
                     of the report, under a rule, 2,000px from the call it
                     supported; it is the call's own footnote. */
                  <span className="flex flex-wrap items-center gap-3">
                    {analysedWith}
                    {analysis.reportVersion && (
                      <AnalysisSources
                        className="mt-0"
                        used={analysis.reportVersion.result.used}
                        results={results}
                        categories={categories}
                        onSelect={jumpToGroup}
                      />
                    )}
                  </span>
                }
              />
            )}
            {/* What the state holds, under the call and before the argument.
                With or without a report: these are the record's facts. */}
            <FormationCard
              record={record}
              onJumpToSource={jumpToSource}
              className={view || running ? 'mt-4' : undefined}
            />
            {/* What the record holds about the business, before the report
                starts reading it. Attributes only — the filing facts an account
                is opened against. */}
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
            <AnalysisPanel
              version={analysis.reportVersion}
              record={record}
              results={results}
              categories={categories}
              // Only a report puts this column to work. A typed question is
              // answered in the chat and leaves the report where it is.
              waiting={running}
              // The run's own manifest while one is in flight; the store's
              // otherwise, so the panel is laid out before anything is sent.
              policy={running ? analysis.waitingPolicy : policy}
              draft={analysis.draft}
              onJumpToGroup={jumpToGroup}
              onJumpToSource={jumpToSource}
              negatives={negatives}
              tiers={tiers}
            />

            {/* No column at this width, so the turns sit under the report —
                which is where the conversation has always been here. */}
            {!isWide && analysis.selected && (
              <AnalysisChat
                className="mt-10"
                scroll={false}
                turns={analysis.questions}
                waiting={analysis.waiting && analysis.waitingKind === 'question'}
                waitingTyped={analysis.waitingTyped}
                waitingSkills={analysis.waitingSkills}
                error={analysis.error}
                results={results}
                record={record}
                categories={categories}
                negatives={negatives}
                onJumpToGroup={jumpToGroup}
                onJumpToSource={jumpToSource}
              />
            )}
              </>
              )}

              {/* The report's own insights: the snapshot it cited, grouped as
                  the live tab groups them, every group on one page so a
                  citation can land on its group. */}
              {reportFace === 'insights' &&
                (view ? (
                  <div className="space-y-4">
                    {grouped.map((group) => (
                      <div key={group.id} id={`group-${group.id}`} className="scroll-mt-6">
                        <InsightStack title={group.label}>
                          {group.rows.map((r) => (
                            <InsightRow
                              key={r.insightId}
                              result={r}
                              record={record}
                              reveal={revealed.includes(r.insightId)}
                              onJumpToSource={jumpToSource}
                            />
                          ))}
                        </InsightStack>
                      </div>
                    ))}
                  </div>
                ) : (
                  nothingYet('insights')
                ))}

              {reportFace === 'attributes' &&
                (view ? (
                  <div className="space-y-4">
                    {snapshotAttributeGroups.map((group) => (
                      <AttributeGroupDetail
                        key={group.id}
                        group={group}
                        record={record}
                        onJumpToSource={jumpToSource}
                      />
                    ))}
                  </div>
                ) : (
                  nothingYet('attributes')
                ))}

              {reportFace === 'sources' &&
                (view ? (
                  <div className="space-y-6">
                    {sourceSections(recordSources).map((band) => (
                      <section key={band.key} className="space-y-3">
                        <CardLabel as="h4" className="font-semibold">
                          {band.label}
                        </CardLabel>
                        {band.items.map((src) => (
                          <SourceDetail
                            key={src.id}
                            source={src}
                            record={record}
                            focused={sourceFocus === src.id}
                          />
                        ))}
                      </section>
                    ))}
                  </div>
                ) : (
                  nothingYet('sources')
                ))}
              </TabsContent>

          {/* The identity's own insights, attributes and sources — the record
              as it is now, whichever report is open. The column picks one
              grouping or one source; this is it. */}
          <TabsContent value="insights">
            {openInsightGroup ? (
              <InsightStack title={openInsightGroup.label}>
                {openInsightGroup.rows.map((r) => (
                  <InsightRow
                    key={r.insightId}
                    result={r}
                    record={selected}
                    onJumpToSource={jumpToLiveSource}
                  />
                ))}
              </InsightStack>
            ) : (
              <EmptyState title="No insights" description="Nothing on this record has reported." />
            )}
          </TabsContent>

          <TabsContent value="attributes">
            {openAttributeGroup ? (
              <AttributeGroupDetail
                group={openAttributeGroup}
                record={selected}
                onJumpToSource={jumpToLiveSource}
              />
            ) : (
              <EmptyState title="No attributes" description="The record holds no attributes yet." />
            )}
          </TabsContent>

          <TabsContent value="sources">
            {openSource ? (
              <SourceDetail source={openSource} record={selected} focused={sourceFocus === openSource.id} />
            ) : (
              <EmptyState title="No sources" description="Nothing on the record cites a source yet." />
            )}
          </TabsContent>
                      </div>
                    </Surface>
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
        {isWide && chatOpen && (
          <ColumnResizer
            width={chatW ?? (window.innerWidth >= 1504 ? 460 : 400)}
            onResize={setChatW}
            onReset={() => setChatW(null)}
          />
        )}

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
            {isWide && chatOpen && (
            <ChatPanelHeader view={panelView} />
            )}

            {panelView === 'timeline' && (
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 panel-scroll">
                <Timeline businessId={selected.id} />
              </div>
            )}

            {panelView === 'assistant' && analysis.selected && (
              <AnalysisChat
                // A different report is a different conversation: remounting
                // resets the log's stick-to-bottom, which would otherwise stay
                // detached from where the reader had scrolled in the last one.
                key={analysis.selected.id}
                turns={analysis.questions}
                marker={
                  running
                    ? `Running ${analysis.waitingSkills[0] ?? standing?.name ?? 'the assessment'}`
                    : `${reportLabel(analysis.selected)} · ${reportDate(analysis.selected)}`
                }
                waiting={analysis.waiting && analysis.waitingKind === 'question'}
                waitingTyped={analysis.waitingTyped}
                waitingSkills={analysis.waitingSkills}
                error={analysis.error}
                results={results}
                record={record}
                categories={categories}
                negatives={negatives}
                onJumpToGroup={jumpToGroup}
                onJumpToSource={jumpToSource}
              />
            )}

      {(!isWide || panelView === 'assistant') && (
      <AnalysisDock
        docked={isWide}
        open={dockOpen}
        setOpen={setDockOpen}
        // Which report a question joins. A report ignores it and starts its own.
        report={
          analysis.selected
            ? { id: analysis.selected.id, label: reportLabel(analysis.selected) }
            : null
        }
        onSend={({ prompt, assessments, attachments, skills, typed, kind, target }) =>
          analysis.run(
            prompt,
            analysis.pinned,
            attachments,
            kind,
            skills,
            typed,
            // What the composer actually put in the box, so a disabled part or
            // an edit between render and send cannot drift from what runs.
            assessments.length > 0 ? assessments : policy,
            target
          )
        }
        // Switched off means not offered: the menu lists what can be run, and
        // an entry that is off would be a row you can pick and nothing happens.
        custom={agent.skills.filter((x) => !(agent.disabled ?? []).includes(x.id))}
        disabled={agent.disabled ?? []}
        onCreateSkill={() => setAgentOpen('new')}
        // The standing assessment IS the settings page, so editing it opens
        // that page rather than an editor nested inside itself.
        onEditSkill={(id) => setAgentOpen(id === standing?.id ? 'list' : id)}
        onUpdateSkill={(id, name, instructions) => void agent.updateSkill(id, name, instructions)}
        waiting={analysis.waiting}
        pinned={analysis.pinned}
        // Live, not the report's: the composer is what runs the next one.
        results={live}
        onUnpin={(id) => analysis.unpin(id)}
        hasAnalysis={analysis.versions.length > 0}
      />
      )}
        </div>

        {/* The rail, always. Putting the panel away leaves the list of what it
            could show rather than a bare edge. */}
        {isWide && (
          <ChatRail
            open={chatOpen}
            onHide={() => setChatOpen(false)}
            view={panelView}
            onOpen={(v) => {
              // Picking the view you are already on puts the column away, the
              // way a nav rail's current entry does nothing but this one has
              // somewhere to go.
              if (chatOpen && v === panelView) setChatOpen(false)
              else {
                setPanelView(v)
                setChatOpen(true)
              }
            }}
          />
        )}
      </aside>
    </div>
    </ScreenshotViewerProvider>
  )
}
