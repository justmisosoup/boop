import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router'

import {
  ActionButton,
  ChatSources,
  MetaChip,
  MutedText,
  Surface,
  TabsContent,
  TabsCount,
  TabsList,
  TabsRoot,
  TabsTrigger,
  Text
} from '@/core'

import { AnalysisDock } from '../components/AnalysisDock'
import { AttributesTab, countAttributes } from '../components/AttributesTab'
import { AnalysisPanel } from '../components/AnalysisPanel'
import { AssessmentIndex } from '../components/AssessmentIndex'
import { PanelGroup } from '../components/PanelGroup'
import { BusinessIdentity } from '../components/BusinessIdentity'
import { BusinessLede } from '../components/BusinessLede'
import { ScreenshotViewerProvider } from '../components/ScreenshotViewer'
import { SourcesTab, sourcesFor } from '../components/SourcesTab'
import { InsightRow } from '../components/InsightRow'
import { categoriesOf, deriveResults, type BusinessRecord, type Derived } from '../lib/deriveResults'
import { byId, describe } from '../lib/records'
import { GROUPS, type GroupId, makeGroupFor } from '../lib/groups'
import { useAnalysis } from '../lib/useAnalysis'
import { AssessmentEditor } from '../components/AssessmentEditor'
import { composeAssessment } from '../lib/library'
import { cn } from '../utils/twUtils'
import { useAgent } from '../lib/useAgent'
import { useLede } from '../lib/useLede'

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
const PANEL_W = 480

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
  const derived = useMemo(() => deriveResults(selected), [selected])
  const results: Derived[] = useMemo(() => derived, [derived])
  const undetermined = derived.filter((r) => r.reasonUndetermined).length

  // The skill that runs on arrival. Not a special case: it is the same thing a
  // reader could have dropped into the composer themselves.
  // The customer's assessments — the one that runs and the parts under it.
  const agent = useAgent()
  // Asked for on arrival and reused verbatim after: the business's own
  // description, independent of any assessment.
  const lede = useLede(selected.id, selected.name)

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
  const analysis = useAnalysis(selected, results)

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
  const latestRun = analysis.versions[analysis.versions.length - 1]
  // A held report carries no skills, so the workflow the page knows about
  // stands in for it — otherwise a reload loses the name.
  const runSkills = latestRun?.skills?.length
    ? latestRun.skills
    : standing?.name
      ? [standing.name]
      : []
  const analysedWith = latestRun ? (
    // The roll-up, not a chip: core's own `ChatSources`, which stacks the
    // sources' tiles and opens to the list.
    <ChatSources
      align="end"
      label="Analysed with"
      sources={[
        ...runSkills.map((name) => ({
          id: `skill:${name}`,
          label: name,
          title: name,
          annotation: 'Assessment workflow'
        })),
        {
          id: 'middesk-context',
          label: 'Middesk context',
          title: 'Middesk context',
          annotation: 'The business record this run was read against'
        }
      ]}
    />
  ) : null
  const [agentOpen, setAgentOpen] = useState<string | null>(null)

  /**
   * What each section of the report rests on, for the index to open.
   *
   * Not a synthetic checklist — these are the insights the section actually
   * cited, taken off its own paragraphs. The assessments have no sub-steps
   * defined anywhere (they are flat in `agent.json`), so the honest answer to
   * "what did this one do" is the checks it read, which is exactly what `cites`
   * records.
   */
  const { presentSections, sectionSteps } = useMemo(() => {
    const live = [
      ...(analysis.draft?.sections ?? []),
      ...(analysis.active?.result.sections ?? [])
    ]
    const present = new Set<string>()
    const steps = new Map<string, Array<{ label: string }>>()

    for (const section of live) {
      present.add(section.id)
      const ids = new Set<string>()
      for (const para of section.body ?? []) for (const c of para.cites ?? []) ids.add(c)
      for (const gap of section.gaps ?? []) for (const c of gap.cites ?? []) ids.add(c)
      /**
       * The steps that section took, in the order they happen.
       *
       * The run-level vocabulary, distributed to the section it belongs to
       * rather than kept in one flat list beside the report. An assessment
       * reads the record and cites what it found; the recommendation weighs
       * the assessments and writes the call. The citation count is real — it
       * is taken off the section's own paragraphs.
       */
      steps.set(
        section.id,
        section.id === 'recommendation'
          ? [{ label: 'Considered context' }, { label: 'Built a recommendation' }]
          : [
              { label: 'Read the business identity record' },
              {
                label: `Cited ${ids.size} insight${ids.size === 1 ? '' : 's'}`
              }
            ]
      )
    }
    // The head of the report — the name and what the business does — is always
    // on the page, so the index's first entry is never pending.
    present.add('lede')
    return { presentSections: present, sectionSteps: steps }
  }, [analysis.draft, analysis.active, results])

  /** What the index lists: the pillars this report is laid out in. */
  const reportSections = useMemo(() => {
    const live = analysis.waiting ? analysis.waitingPolicy : (analysis.active?.policy ?? policy)
    // Same order the report is laid out in — recommendation first. The index
    // has to match the page or clicking it sends the reader to the wrong place.
    return [
      // What the report opens with, before it argues anything: the business
      // itself. The index is a map of the page, and the page starts here.
      { id: 'lede', heading: selected.name },
      { id: 'recommendation', heading: 'Recommendations' },
      ...live.map(({ id, name }) => ({ id, heading: name }))
    ]
  }, [analysis.waiting, analysis.waitingPolicy, analysis.active, policy, selected.name])

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
  const reported = useMemo(() => derived.filter((r) => !r.notReported), [derived])

  const categories = useMemo(() => categoriesOf(selected), [selected])
  const groupFor = useMemo(() => makeGroupFor(categories), [categories])
  const attributeCount = useMemo(
    () => countAttributes(selected, results, groupFor),
    [selected, results, groupFor]
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
  const [filter] = useState<'all' | 'found' | 'not_found'>('found')

  const visible = useMemo(
    () =>
      filter === 'all'
        ? results
        : results.filter((r) => (filter === 'found' ? !r.notReported : r.notReported)),
    [results, filter]
  )

  const grouped = GROUPS.map((g) => ({
    ...g,
    rows: visible.filter((r) => groupOf(r) === g.id)
  })).filter((g) => g.rows.length > 0)
  const [dockOpen, setDockOpen] = useState(true)
  const [revealed, setRevealed] = useState<string[]>([])
  // The reference panel's own tab. 'analysis' was the default while the report
  // was a tab beside these; now that it has its own column, that value matches
  // nothing here and the panel rendered empty.
  const [tab, setTab] = useState('insights')
  const panelRef = useRef<HTMLElement | null>(null)
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
    () => sourcesFor(selected, results, groupFor),
    [selected, results, groupFor]
  )
  const sourceCount = recordSources.length

  const reveal = (ids: string[], anchor: string) => {
    setTab('insights')
    setRevealed(ids)
    window.setTimeout(() => {
      // `start`, not `center`: the anchor is a whole group now, and centring a
      // 22-row group puts its heading off the top of the panel — so following a
      // citation landed the reader mid-list with no idea which group they were
      // in. The group carries its own `scroll-mt`.
      document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 60)
    window.setTimeout(() => setRevealed([]), 2400)
  }

  /**
   * A citation names a category, so following it lands on that category — the
   * Insights tab is already grouped the same way. Every insight the paragraph
   * cited there is revealed at once, which is the thing the citation was
   * standing for.
   */
  const jumpToGroup = (groupId: string, insightIds: string[]) =>
    reveal(insightIds, `group-${groupId}`)

  /**
   * An attribute's source chip names a record, and the record is in the Sources
   * tab in full. Following it out to the registry's own page left the reader to
   * find their way back to what we actually hold.
   */
  const [sourceFocus, setSourceFocus] = useState<string | null>(null)
  const jumpToSource = (cardId: string) => {
    setTab('sources')
    setSourceFocus(cardId)
    // The tab's content mounts on the switch, so the card does not exist yet
    // and its section is still laying out for a frame or two after it does.
    // Retried rather than delayed by a guessed constant.
    let tries = 0
    const land = () => {
      // Exact card, else the first of that type: a tax permit's card id carries
      // its state ("src:Tax permit · Pennsylvania") and the chip that cites it
      // only knows the type.
      const el =
        document.getElementById(`source-${cardId}`) ??
        document.querySelector(`[id^="source-${cardId.replace(/"/g, '\\"')}"]`)
      if (el) return el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      if (tries++ < 20) requestAnimationFrame(land)
    }
    requestAnimationFrame(land)
    window.setTimeout(() => setSourceFocus(null), 2400)
  }

  return (
    <ScreenshotViewerProvider>
    <div
      className="core-theme min-h-full wide:h-screen wide:overflow-hidden"
      style={
        {
          '--panel-w': `${PANEL_W}px`
        } as React.CSSProperties
      }
    >
      {/* The tail clears the composer, which is fixed over the page: `pb-40` was
          shorter than the dock once it carried a token row, so the last
          paragraph of a report sat behind it and could not be scrolled to. */}
      {/* The rail is fixed, so the page has to leave it room — otherwise it
          sits on top of the report at every width where both are visible. */}
      {/* Both rails are fixed to the window, so the page reserves the gutters
          they sit in. Nothing in the middle column has to know they exist. */}
      <div className="mx-auto max-w-[1048px] px-6 pb-56 pt-20 wide:flex wide:h-screen wide:max-w-none wide:flex-col wide:pb-6">


        {/*
          * Who this whole screen is about, and it never leaves.
          *
          * It used to appear only once the page heading had scrolled away, and
          * only below `lg` — so on the layout anyone actually uses, a reader
          * four screens into a report had nothing on screen naming the business
          * except a line in the margin. A report this long needs its subject
          * fixed to the top of it.
          */}
        {/* `left-[var(--nav-w)]`: the bar is fixed to the window, and the
            global nav rail is too — so it starts where the rail ends rather
            than under it. The Shell sets the variable. */}
        {/* `z-chrome`, under the global nav: the rail hover-expands over the
            page, and at `z-floating` this bar was painted across the top of
            that overlay. */}
        <header className="fixed right-0 top-0 z-chrome border-b border-solid border-border bg-card left-[var(--nav-w)]">
          <div className="mx-auto flex items-center gap-4 px-6 py-2">
            {/* There is a list to go back to now. It sits before the name
                because that is the order the two were arrived at. */}
            <Link
              to="/businesses"
              aria-label="Back to Businesses"
              className="-ml-1 flex size-7 shrink-0 items-center justify-center rounded-control text-text-secondary no-underline transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.5} />
            </Link>
            <div className="flex min-w-0 items-baseline gap-3">
              <Text size="sm" className="shrink-0 truncate font-medium">
                {selected.name}
              </Text>
              <MutedText className="truncate text-caption">{describe(selected)}</MutedText>
            </div>
          </div>
        </header>

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
          * `top-[57px]` is the fixed header's own bottom edge, so the white
          * starts below the bar rather than running underneath it, and
          * `pt-[23px]` keeps the rail and the report on the baseline they
          * already sit on.
          */}
        <div className="contents wide:fixed wide:left-[var(--nav-w)] wide:top-[57px] wide:bottom-0 wide:right-[var(--panel-w)] wide:z-0 wide:flex wide:justify-center wide:bg-card wide:px-6">
        {/* The index mirrors the report: what is on the page, what is being
            written, what has not started. Taken from the sections actually
            rendered rather than from the run's own bookkeeping, so it is right
            for a live run and for a replay alike. */}
        <AssessmentIndex
          sections={reportSections}
          present={presentSections}
          steps={sectionSteps}
          running={analysis.waiting}
        />

        {/* The report's measure: 800 wanted, 1000 at most.
            `min-w-[800px]` was a hard floor, so at a narrow window with the
            panel dragged out the report ran past the white and under the
            panel. A basis is a preference: it holds 800 wherever 800 fits,
            grows to 1000, and gives way rather than overlap. */}
        <div className="min-w-0 desk:ml-6 wide:flex wide:min-h-0 wide:max-w-[1000px] wide:shrink wide:grow wide:basis-[800px] wide:flex-col">
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
          <div className="relative z-10 min-w-0 rounded-card bg-card px-8 py-7 wide:min-h-0 wide:flex-1 wide:rounded-none wide:bg-transparent wide:px-8 wide:pb-40 wide:pt-[51px] wide:overflow-y-auto panel-scroll">
            {/*
              * The lede, at the head of the report and at every width.
              *
              * The contents rail carried it above `desk` and this was the copy
              * for everything below, so the paragraph saying what the company
              * does was either 224px wide and clamped at six lines, or
              * somewhere else entirely, depending on the window. One copy now,
              * here, and the rail is a contents list.
              *
              * It has to be inside the report rather than a sibling of the
              * document container: at `wide` that container is `fixed`, so a
              * sibling rendered into the flow underneath it and was covered by
              * the white — present in the DOM, never on screen.
              *
              * The entity line is in the fixed bar. So is the registered name,
              * but the heading here is the name the lede itself opens with,
              * which is usually the one the business trades under.
              */}
            <header id="section-lede" className="mb-8 scroll-mt-6">
              <BusinessLede text={lede} name={selected.name} trailing={analysedWith} />
            </header>
            {/* What the record holds about the business, before the report
                starts reading it. Attributes only — the filing facts an account
                is opened against. */}
            <BusinessIdentity record={selected} />
            <AnalysisPanel
              versions={analysis.versions}
              business={selected.name}
              entityLine={describe(selected)}
              record={selected}
              results={results}
              // The count the Insights tab shows — what this business actually
              // has — not every check the catalog defines.
              insightCount={reported.length}
              categories={categories}
              waiting={analysis.waiting}
              waitingKind={analysis.waitingKind}
              waitingSkills={analysis.waitingSkills}
              waitingTyped={analysis.waitingTyped}
              acknowledged={analysis.acknowledged}
              // The run's own manifest while one is in flight; the store's
              // otherwise, so the panel is laid out before anything is sent.
              policy={analysis.waiting ? analysis.waitingPolicy : policy}
              arrived={analysis.arrived}
              draft={analysis.draft}
              slow={analysis.slow}
              error={analysis.error}
              onJumpToGroup={jumpToGroup}
              superseded={analysis.superseded}
            />
          </div>
        </div>

          {/* Fixed, not sticky: sticky still travels with the page until it
              catches, so the record moved while the report it belongs to moved
              — two things scrolling past each other. It holds still now, and
              scrolls inside itself. */}

          <aside
            ref={panelRef}
            // A docked side panel, not a column floating over the page: flush
            // to the window's right edge, running from under the fixed bar to
            // the bottom, on its own surface with a left border that IS the
            // boundary between the record and the report. The horizontal inset
            // is NOT here — it is on the tab strip and each tab's contents, so
            // the pinned strip spans the panel's full width instead of stopping
            // 16px short of each edge.
            className="mt-10 min-w-0 wide:fixed wide:right-0 wide:top-[57px] wide:bottom-0 wide:mt-0 wide:flex wide:w-[var(--panel-w)] wide:flex-col wide:overflow-y-auto wide:border-l wide:border-solid wide:border-border wide:bg-background panel-scroll">
            <TabsRoot value={tab} onValueChange={showTab} className="flex flex-col">
              <TabsList className="sticky top-0 z-10 shrink-0 bg-background px-4">
                <TabsTrigger value="insights">
                  Insights
                  <TabsCount>{reported.length}</TabsCount>
                </TabsTrigger>
                <TabsTrigger value="attributes">
                  Attributes
                  <TabsCount>{attributeCount}</TabsCount>
                </TabsTrigger>
                <TabsTrigger value="sources">
                  Sources
                  <TabsCount>{sourceCount}</TabsCount>
                </TabsTrigger>
              </TabsList>
          <TabsContent value="insights" className="space-y-4 px-4 pt-4">
            {/* The Found/Not found/All control is gone from the panel.
                The filter it drove is still applied — `filter` is held at
                `found`, so what shows is what the record establishes — but it
                is no longer a decision put to the reader. 123 of the 155 checks
                returned nothing here, and offering to show them was offering to
                bury the 32 that said something. */}

            {/* Open. The insights ARE the tab — a reader scanning for what the
                record does and does not establish wants to see the findings,
                not a directory of places findings might be. The headings stay
                collapsible for putting away a group you have finished with,
                but closed is not the resting state. */}
            {grouped.map((group) => (
              <PanelGroup
                key={group.id}
                id={`group-${group.id}`}
                label={group.label}
                count={group.rows.length}
                defaultOpen
                // A citation landed in this group: open it, or the rows it was
                // pointing at are behind a closed heading.
                openWhen={group.rows.some((r) => revealed.includes(r.insightId))}
              >
                <Surface variant="default" padding="none" className="overflow-hidden">
                  <div className="divide-y divide-solid divide-border">
                    {group.rows.map((r) => (
                      <InsightRow
                        key={r.insightId}
                        result={r}
                        record={selected}
                        reveal={revealed.includes(r.insightId)}
                        onJumpToSource={jumpToSource}
                      />
                    ))}
                  </div>
                </Surface>
              </PanelGroup>
            ))}

          </TabsContent>

          <TabsContent value="attributes" className="space-y-6 px-4 pt-4">
            <AttributesTab
              record={selected}
              results={results}
              groupFor={groupFor}
              onJumpToSource={jumpToSource}
            />
          </TabsContent>

          <TabsContent value="sources" className="space-y-4 px-4 pt-4">
            <SourcesTab
              record={selected}
              results={results}
              groupFor={groupFor}
              focus={sourceFocus}
            />
          </TabsContent>

            </TabsRoot>
          </aside>
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

      <AnalysisDock
        open={dockOpen}
        setOpen={setDockOpen}
        onSend={({ prompt, assessments, attachments, skills, typed, kind }) =>
          analysis.run(
            prompt,
            analysis.pinned,
            attachments,
            kind,
            skills,
            typed,
            // What the composer actually put in the box, so a disabled part or
            // an edit between render and send cannot drift from what runs.
            assessments.length > 0 ? assessments : policy
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
        results={results}
        onUnpin={(id) => analysis.unpin(id)}
        hasAnalysis={analysis.versions.length > 0}
      />
    </div>
    </ScreenshotViewerProvider>
  )
}
